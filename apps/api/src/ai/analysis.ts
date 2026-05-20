import Anthropic, { APIError } from "@anthropic-ai/sdk";
import process from "node:process";
import { buildFallbackBrief } from "../content/sectorFallbacks";
import { getCompanyBySymbol } from "../db/company-queries";
import { getLatestIndicator, getLatestQuote, getQuoteHistory, getRecentNews } from "../db/queries";
import { peekCachedBrief, storeCachedBrief } from "../services/aiBriefCache";
const MODEL = "claude-sonnet-4-6";

export type BriefSection = { lang: string; body: string };

export type AnalysisResult = {
  brief: string;
  updatedAt: string;
  requestedLang: string;
  sections: BriefSection[];
};

function primaryLanguageBase(lang: string): string {
  const trimmed = lang.trim();
  if (!trimmed) return "en";
  return trimmed.split(/[-_]/)[0]!.toLowerCase();
}

function isEnglishLocale(lang: string): boolean {
  return primaryLanguageBase(lang) === "en";
}

function languageNameForPrompt(localeTag: string): string {
  const base = primaryLanguageBase(localeTag);
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "language" });
    return dn.of(base) ?? localeTag;
  } catch {
    return localeTag;
  }
}

type BriefMarketContext = {
  symbol: string;
  companyName?: string | null;
  sector?: string | null;
  industry?: string | null;
  quoteJson: unknown;
  newsTitles: string[];
  rsi: string | null;
  supportLevel: string | null;
  resistanceLevel: string | null;
  trendSummary: string | null;
};

function buildBriefInstructions(localeTag: string): string {
  const structure = `Write a substantive company investment brief (about 4–6 short paragraphs total) covering:
1. Business overview and sector context (competitive dynamics, industry trends)
2. Technical picture: interpret RSI, recent price trend, and support/resistance levels when provided
3. Key risks and potential catalysts (earnings, regulation, macro, news themes)
4. Balanced outlook — not personalized financial advice

Use clear prose (not bullet lists unless necessary).`;

  if (isEnglishLocale(localeTag)) {
    return `Provide analysis in English only.

${structure}

Output plain text only (no section markers).`;
  }

  const langName = languageNameForPrompt(localeTag);
  return `Provide analysis in two sections:
1. [${langName}] — full analysis in ${langName} (locale / BCP 47: ${localeTag})
2. [English] — the same analysis in English

Use exactly this structure so the response can be parsed:
===PRIMARY===
(first section only, in ${langName})
===ENGLISH===
(second section only, in English)

${structure}`;
}

function buildPrompt(ctx: BriefMarketContext, localeTag: string): string {
  const context = `Analyze ${ctx.symbol}${ctx.companyName ? ` (${ctx.companyName})` : ""} based on the following context.

Company sector: ${ctx.sector ?? "(unknown)"}
Industry: ${ctx.industry ?? "(unknown)"}
Latest quote (DB): ${JSON.stringify(ctx.quoteJson)}
Recent news headlines: ${ctx.newsTitles.join(" | ") || "(none)"}
Latest RSI (if any): ${ctx.rsi ?? "(none)"}
Estimated support (60-session low): ${ctx.supportLevel ?? "(none)"}
Estimated resistance (60-session high): ${ctx.resistanceLevel ?? "(none)"}
Price trend (recent sessions): ${ctx.trendSummary ?? "(none)"}

`;

  return context + buildBriefInstructions(localeTag);
}

function summarizePriceTrend(closes: number[]): string | null {
  if (closes.length < 5) return null;
  const recent = closes.slice(-20);
  const first = recent[0]!;
  const last = recent[recent.length - 1]!;
  const changePct = ((last - first) / first) * 100;
  const direction =
    changePct > 2 ? "uptrend" : changePct < -2 ? "downtrend" : "sideways / range-bound";
  return `${direction} (~${changePct.toFixed(1)}% over last ${recent.length} sessions)`;
}

function levelsFromQuoteHistory(closes: number[]): { support: string | null; resistance: string | null } {
  if (closes.length === 0) return { support: null, resistance: null };
  const support = Math.min(...closes);
  const resistance = Math.max(...closes);
  return { support: support.toFixed(2), resistance: resistance.toFixed(2) };
}

function parseBriefSections(raw: string, localeTag: string): BriefSection[] {
  const text = raw.trim();
  if (isEnglishLocale(localeTag)) {
    return [{ lang: "en", body: text }];
  }
  const re = /^===PRIMARY===\s*\r?\n([\s\S]*?)\r?\n===ENGLISH===\s*\r?\n([\s\S]*)$/i;
  const m = text.match(re);
  if (m) {
    const primary = m[1]!.trim();
    const english = m[2]!.trim();
    return [
      { lang: localeTag, body: primary },
      { lang: "en", body: english },
    ];
  }
  return [{ lang: localeTag, body: text }];
}

function joinBriefForLegacy(sections: BriefSection[]): string {
  return sections.map((s) => s.body).join("\n\n---\n\n");
}

function normalizeRequestLang(lang: string | undefined): string {
  const s = (lang ?? "en").trim();
  return s || "en";
}

function isLlmAuthOrConfigError(err: unknown): boolean {
  if (err instanceof APIError && (err.status === 401 || err.status === 403)) return true;
  if (err && typeof err === "object" && "error" in err) {
    const nested = (err as { error?: { type?: string; message?: string } }).error;
    const nestedMsg = String(nested?.message ?? "").toLowerCase();
    if (nested?.type === "authentication_error" || nestedMsg.includes("invalid x-api-key")) {
      return true;
    }
  }
  if (err instanceof Error) {
    const msg = err.message.toLowerCase();
    return (
      msg.includes("anthropic_api_key") ||
      msg.includes("401") ||
      msg.includes("authentication") ||
      msg.includes("invalid x-api-key") ||
      msg.includes("invalid api key") ||
      msg.includes("authentication_error")
    );
  }
  return false;
}
/**
 * Claude Sonnet brief + optional Redis cache when REDIS_URL is set.
 * @param localeTag BCP 47 tag from the client (e.g. pl, de, en-GB). English locales → EN-only; others → locale + EN.
 */
export async function analyzeStock(symbol: string, localeTag = "en"): Promise<AnalysisResult> {
  const sym = symbol.toUpperCase();
  const lang = normalizeRequestLang(localeTag);

  const cached = await peekCachedBrief(sym, lang);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  const [quote, news, rsiRow, company, quoteHistory] = await Promise.all([
    getLatestQuote(sym),
    getRecentNews(sym, 10),
    getLatestIndicator(sym, "RSI"),
    getCompanyBySymbol(sym),
    getQuoteHistory(sym, 60),
  ]);

  const fallbackContext = {
    symbol: sym,
    companyName: company?.name,
    sector: company?.sector,
    industry: company?.industry,
    localeTag: lang,
    closePrice: quote?.close?.toString() ?? null,
    rsi: rsiRow ? rsiRow.value.toString() : null,
  };

  if (!apiKey) {
    console.warn(`[analysis] ANTHROPIC_API_KEY missing — serving sector fallback brief for ${sym}`);
    return buildFallbackBrief(fallbackContext);
  }

  const quoteJson = quote
    ? {
        timestamp: quote.timestamp.toISOString(),
        close: quote.close.toString(),
        volume: quote.volume.toString(),
        source: quote.source,
      }
    : null;

  const newsTitles = news.map((n) => n.title);
  const rsi = rsiRow ? rsiRow.value.toString() : null;
  const closes = quoteHistory.map((q) => Number(q.close)).filter((v) => Number.isFinite(v));
  const { support, resistance } = levelsFromQuoteHistory(closes);
  const trendSummary = summarizePriceTrend(closes);

  const promptContext: BriefMarketContext = {
    symbol: sym,
    companyName: company?.name,
    sector: company?.sector,
    industry: company?.industry,
    quoteJson,
    newsTitles,
    rsi,
    supportLevel: support,
    resistanceLevel: resistance,
    trendSummary,
  };

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      messages: [{ role: "user", content: buildPrompt(promptContext, lang) }],
    });

    const block = msg.content[0];
    const rawBrief = block.type === "text" ? block.text : "";
    const updatedAt = new Date().toISOString();
    const sections = parseBriefSections(rawBrief, lang);
    const out: AnalysisResult = {
      brief: joinBriefForLegacy(sections),
      updatedAt,
      requestedLang: lang,
      sections,
    };

    await storeCachedBrief(sym, lang, out);
    return out;
  } catch (err) {
    if (isLlmAuthOrConfigError(err)) {
      console.warn(
        `[analysis] LLM auth/config failure for ${sym} — serving sector fallback brief`,
        err instanceof Error ? err.message : err,
      );
      return buildFallbackBrief(fallbackContext);
    }
    console.warn(
      `[analysis] LLM request failed for ${sym} — serving sector fallback brief`,
      err instanceof Error ? err.message : err,
    );
    return buildFallbackBrief(fallbackContext);
  }
}
