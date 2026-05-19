import Anthropic, { APIError } from "@anthropic-ai/sdk";
import process from "node:process";
import { buildFallbackBrief } from "../content/sectorFallbacks";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { getCompanyBySymbol } from "../db/company-queries";
import { getLatestIndicator, getLatestQuote, getRecentNews } from "../db/queries";
import { getCacheRedis } from "../redis";
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

function cacheKeySuffixForLang(lang: string): string {
  if (isEnglishLocale(lang)) return "en";
  return lang.toLowerCase().replace(/[^a-z0-9_-]+/g, "") || "und";
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

function buildPrompt(
  symbol: string,
  quoteJson: unknown,
  newsTitles: string[],
  rsi: string | null,
  localeTag: string,
): string {
  const context = `Analyze ${symbol} based on the following context.

Latest quote (DB): ${JSON.stringify(quoteJson)}
Recent news headlines: ${newsTitles.join(" | ") || "(none)"}
Latest RSI (if any): ${rsi ?? "(none)"}

`;

  if (isEnglishLocale(localeTag)) {
    return (
      context +
      `Provide analysis in English only.

Write 2–4 short paragraphs in clear investment-brief style. This is not personalized financial advice.

Output plain text only (no section markers).`
    );
  }

  const langName = languageNameForPrompt(localeTag);
  return (
    context +
    `Provide analysis in two sections:
1. [${langName}] — full analysis in ${langName} (locale / BCP 47: ${localeTag})
2. [English] — the same analysis in English

Use exactly this structure so the response can be parsed:
===PRIMARY===
(first section only, in ${langName})
===ENGLISH===
(second section only, in English)

Each section should be 2–4 short paragraphs. This is not personalized financial advice.`
  );
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

async function readAnalysisCache(cacheKey: string): Promise<AnalysisResult | null> {
  if (!process.env.REDIS_URL?.trim()) return null;
  try {
    const redis = getCacheRedis();
    const cached = await redis.get(cacheKey);
    if (!cached) return null;
    const parsed = JSON.parse(cached) as AnalysisResult;
    if (parsed.updatedAt && Array.isArray(parsed.sections) && parsed.sections.length > 0) {
      return {
        ...parsed,
        brief: parsed.brief || joinBriefForLegacy(parsed.sections),
      };
    }
    // Legacy cache shape { brief, updatedAt } without sections
    const legacy = parsed as unknown as { brief?: string; updatedAt?: string; sections?: BriefSection[] };
    if (legacy.brief && legacy.updatedAt && !legacy.sections) {
      return null;
    }
  } catch {
    /* Redis down or bad payload */
  }
  return null;
}

async function writeAnalysisCache(cacheKey: string, payload: AnalysisResult): Promise<void> {
  if (!process.env.REDIS_URL?.trim()) return;
  try {
    const redis = getCacheRedis();
    await redis.set(cacheKey, JSON.stringify(payload), "EX", REDIS_TTL_SEC.AI_ANALYSIS);
  } catch {
    /* ignore cache write failures */
  }
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
  const cacheKey = redisKeys.analysisBrief(sym, cacheKeySuffixForLang(lang));

  const cached = await readAnalysisCache(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();

  const [quote, news, rsiRow, company] = await Promise.all([
    getLatestQuote(sym),
    getRecentNews(sym, 10),
    getLatestIndicator(sym, "RSI"),
    getCompanyBySymbol(sym),
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

  try {
    const client = new Anthropic({ apiKey });
    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 2048,
      messages: [{ role: "user", content: buildPrompt(sym, quoteJson, newsTitles, rsi, lang) }],
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

    await writeAnalysisCache(cacheKey, out);
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
