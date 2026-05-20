import Anthropic, { APIError } from "@anthropic-ai/sdk";
import process from "node:process";
import { buildFallbackBrief } from "../content/sectorFallbacks";
import { getCompanyBySymbol } from "../db/company-queries";
import { getLatestIndicator, getLatestQuote, getQuoteHistory, getRecentNews } from "../db/queries";
import {
  peekCachedBriefEnglish,
  peekCachedBriefExact,
  storeCachedBrief,
  withBriefGenerationLock,
} from "../services/aiBriefCache";
import {
  type AiCallTelemetry,
  logAiCallFromAnthropicResponse,
  logAiUsageEvent,
} from "../services/aiCostTelemetry";

const MODEL = "claude-sonnet-4-6";
const TRANSLATION_MODEL = process.env.AI_BRIEF_TRANSLATION_MODEL?.trim() || "claude-haiku-4-5";

export type BriefSection = { lang: string; body: string };

export type AnalysisResult = {
  brief: string;
  updatedAt: string;
  requestedLang: string;
  sections: BriefSection[];
};

export type AnalyzeStockContext = {
  userId?: string | null;
  plan?: string;
  endpoint?: string;
  clientIp?: string | null;
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

function telemetryBase(ctx: AnalyzeStockContext | undefined, sym: string, lang: string): AiCallTelemetry {
  return {
    userId: ctx?.userId ?? null,
    plan: ctx?.plan ?? "unknown",
    endpoint: ctx?.endpoint ?? "ai_brief",
    symbol: sym,
    lang,
  };
}

function logCacheHit(ctx: AnalyzeStockContext | undefined, sym: string, lang: string, startedAt: number): void {
  logAiUsageEvent({
    userId: ctx?.userId ?? null,
    plan: ctx?.plan ?? "unknown",
    endpoint: ctx?.endpoint ?? "ai_brief",
    symbol: sym,
    lang,
    cacheHit: true,
    model: null,
    inputTokens: null,
    outputTokens: null,
    estimatedCostUsd: 0,
    latencyMs: Date.now() - startedAt,
    createdAt: new Date().toISOString(),
  });
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

async function translateBriefFromEnglish(
  enBrief: AnalysisResult,
  targetLang: string,
  sym: string,
  ctx?: AnalyzeStockContext,
): Promise<AnalysisResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;

  const enSection = enBrief.sections.find((s) => primaryLanguageBase(s.lang) === "en") ?? enBrief.sections[0];
  if (!enSection?.body) return null;

  const langName = languageNameForPrompt(targetLang);
  const startedAt = Date.now();
  const telemetry = telemetryBase(ctx, sym, targetLang);

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: TRANSLATION_MODEL,
      max_tokens: 1800,
      temperature: 0.1,
      messages: [
        {
          role: "user",
          content: `Translate the following investment brief into ${langName} (locale ${targetLang}). Keep financial terminology accurate. Output plain text only, same structure and length as the source.\n\n${enSection.body}`,
        },
      ],
    });

    logAiCallFromAnthropicResponse(telemetry, TRANSLATION_MODEL, startedAt, msg.usage);

    const block = msg.content[0];
    const body = block.type === "text" ? block.text.trim() : "";
    if (!body) return null;

    const updatedAt = new Date().toISOString();
    const sections: BriefSection[] = isEnglishLocale(targetLang)
      ? [{ lang: "en", body }]
      : [
          { lang: targetLang, body },
          { lang: "en", body: enSection.body },
        ];

    return {
      brief: joinBriefForLegacy(sections),
      updatedAt,
      requestedLang: targetLang,
      sections,
    };
  } catch (err) {
    logAiUsageEvent({
      userId: telemetry.userId ?? null,
      plan: telemetry.plan ?? "unknown",
      endpoint: telemetry.endpoint,
      symbol: sym,
      lang: targetLang,
      cacheHit: false,
      model: TRANSLATION_MODEL,
      inputTokens: null,
      outputTokens: null,
      estimatedCostUsd: null,
      latencyMs: Date.now() - startedAt,
      createdAt: new Date().toISOString(),
      meta: { error: err instanceof Error ? err.message : "translation_failed" },
    });
    return null;
  }
}

async function generateBriefWithClaude(
  sym: string,
  lang: string,
  promptContext: BriefMarketContext,
  ctx?: AnalyzeStockContext,
): Promise<AnalysisResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY missing");
  }

  const startedAt = Date.now();
  const telemetry = telemetryBase(ctx, sym, lang);
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 1500,
    messages: [{ role: "user", content: buildPrompt(promptContext, lang) }],
  });

  logAiCallFromAnthropicResponse(telemetry, MODEL, startedAt, msg.usage);

  const block = msg.content[0];
  const rawBrief = block.type === "text" ? block.text : "";
  const updatedAt = new Date().toISOString();
  const sections = parseBriefSections(rawBrief, lang);
  return {
    brief: joinBriefForLegacy(sections),
    updatedAt,
    requestedLang: lang,
    sections,
  };
}

/**
 * Claude Sonnet brief + shared Redis cache (global per symbol+lang, not per user).
 */
export async function analyzeStock(
  symbol: string,
  localeTag = "en",
  ctx?: AnalyzeStockContext,
): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const sym = symbol.toUpperCase();
  const lang = normalizeRequestLang(localeTag);

  const exact = await peekCachedBriefExact(sym, lang);
  if (exact) {
    logCacheHit(ctx, sym, lang, startedAt);
    return exact;
  }

  return withBriefGenerationLock(sym, lang, async () => {
    const afterLock = await peekCachedBriefExact(sym, lang);
    if (afterLock) {
      logCacheHit(ctx, sym, lang, startedAt);
      return afterLock;
    }

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

    if (!isEnglishLocale(lang)) {
      const enCached = await peekCachedBriefEnglish(sym);
      if (enCached) {
        const translated = await translateBriefFromEnglish(enCached, lang, sym, ctx);
        if (translated) {
          await storeCachedBrief(sym, lang, translated);
          return translated;
        }
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
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
      const out = await generateBriefWithClaude(sym, lang, promptContext, ctx);
      await storeCachedBrief(sym, lang, out);
      if (isEnglishLocale(lang)) {
        await storeCachedBrief(sym, "en", out);
      } else {
        const enSection = out.sections.find((s) => primaryLanguageBase(s.lang) === "en");
        if (enSection) {
          await storeCachedBrief(sym, "en", {
            brief: enSection.body,
            updatedAt: out.updatedAt,
            requestedLang: "en",
            sections: [{ lang: "en", body: enSection.body }],
          });
        }
      }
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
  });
}
