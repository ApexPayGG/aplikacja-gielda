import Anthropic from "@anthropic-ai/sdk";
import { fetchFinnhubCompanyNews } from "../../scrapers/finnhub.scraper";

export type NewsHalfLifeCategory =
  | "earnings/results"
  | "fed/central bank"
  | "merger/acquisition"
  | "dividend"
  | "default";

export type NewsHalfLifeItem = {
  headline: string;
  date: string;
  halfLifeDays: number;
  expiresAt: string;
  reason: string;
  category: NewsHalfLifeCategory;
};

export type NewsHalfLifeResponse = {
  symbol: string;
  news: NewsHalfLifeItem[];
  mostImpactful: {
    headline: string;
    halfLifeDays: number;
  } | null;
};

type CategoryRule = {
  category: NewsHalfLifeCategory;
  regex: RegExp;
  halfLifeDays: number;
};

const CATEGORY_RULES: CategoryRule[] = [
  { category: "earnings/results", regex: /\b(earnings?|results?)\b/i, halfLifeDays: 5 },
  { category: "fed/central bank", regex: /\b(fed|central\s+bank)\b/i, halfLifeDays: 14 },
  { category: "merger/acquisition", regex: /\b(merger|acquisition)\b/i, halfLifeDays: 30 },
  { category: "dividend", regex: /\bdividend(s)?\b/i, halfLifeDays: 7 },
];

function parseJsonFromText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    return null;
  }
}

function normalizeReason(input: string): string {
  const compact = input.trim().replace(/\s+/g, " ");
  if (!compact) return "Category decay estimate";
  const words = compact.split(" ");
  return words.slice(0, 10).join(" ");
}

function classifyHeadline(headline: string): { category: NewsHalfLifeCategory; halfLifeDays: number } {
  const text = headline.toLowerCase();
  const rule = CATEGORY_RULES.find((entry) => entry.regex.test(text));
  if (rule) {
    return { category: rule.category, halfLifeDays: rule.halfLifeDays };
  }
  return { category: "default", halfLifeDays: 2 };
}

function expiresAt(dateIso: string, halfLifeDays: number): string {
  const date = new Date(dateIso);
  const ms = Math.max(1, halfLifeDays) * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + ms).toISOString();
}

async function estimateHalfLifeWithClaude(
  headline: string,
  fallbackHalfLifeDays: number,
  fallbackReason: string,
): Promise<{ halfLifeDays: number; reason: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return { halfLifeDays: fallbackHalfLifeDays, reason: fallbackReason };
  }

  try {
    const client = new Anthropic({ apiKey });
    const prompt =
      `News: '${headline}'. How long will this impact stock price?\n` +
      "Return JSON: { halfLifeDays: number, reason: string (max 10 words) }";
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 120,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const firstBlock = message.content[0];
    const text = firstBlock?.type === "text" ? firstBlock.text : "";
    const parsed = parseJsonFromText(text) as { halfLifeDays?: number; reason?: string } | null;
    if (!parsed) {
      return { halfLifeDays: fallbackHalfLifeDays, reason: fallbackReason };
    }
    const days = Number(parsed.halfLifeDays);
    const safeHalfLifeDays = Number.isFinite(days) ? Math.max(1, Math.min(90, Math.round(days))) : fallbackHalfLifeDays;
    return {
      halfLifeDays: safeHalfLifeDays,
      reason: normalizeReason(parsed.reason ?? fallbackReason),
    };
  } catch {
    return { halfLifeDays: fallbackHalfLifeDays, reason: fallbackReason };
  }
}

export async function getNewsHalfLife(symbolInput: string): Promise<NewsHalfLifeResponse> {
  const symbol = String(symbolInput ?? "").trim().toUpperCase();
  if (!symbol) throw new Error("Missing symbol");

  const fetchedNews = await fetchFinnhubCompanyNews(symbol, 30);
  const prepared = fetchedNews
    .map((item) => {
      const headline = String(item.headline ?? "").trim();
      const rawDate = Number(item.datetime ?? 0);
      if (!headline || !Number.isFinite(rawDate) || rawDate <= 0) return null;
      const timestampMs = rawDate < 1e12 ? rawDate * 1000 : rawDate;
      const date = new Date(timestampMs).toISOString();
      const classified = classifyHeadline(headline);
      return {
        headline,
        date,
        category: classified.category,
        baseHalfLifeDays: classified.halfLifeDays,
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  if (prepared.length === 0) {
    return { symbol, news: [], mostImpactful: null };
  }

  const mostImpactfulIndex = prepared.reduce((bestIdx, current, idx) => {
    const best = prepared[bestIdx];
    if (current.baseHalfLifeDays > best.baseHalfLifeDays) return idx;
    if (current.baseHalfLifeDays < best.baseHalfLifeDays) return bestIdx;
    return new Date(current.date).getTime() > new Date(best.date).getTime() ? idx : bestIdx;
  }, 0);

  const baseReasonByCategory: Record<NewsHalfLifeCategory, string> = {
    "earnings/results": "Earnings impact fades after guidance digestion",
    "fed/central bank": "Macro policy shift lingers in valuation",
    "merger/acquisition": "Deal narrative reprices stock for weeks",
    dividend: "Dividend signal usually decays within payout cycle",
    default: "General headline impact fades quickly",
  };
  const impactful = prepared[mostImpactfulIndex];
  const aiEstimate = await estimateHalfLifeWithClaude(
    impactful.headline,
    impactful.baseHalfLifeDays,
    normalizeReason(baseReasonByCategory[impactful.category]),
  );

  const news: NewsHalfLifeItem[] = prepared.map((item, idx) => {
    const aiChosen = idx === mostImpactfulIndex;
    const halfLifeDays = aiChosen ? aiEstimate.halfLifeDays : item.baseHalfLifeDays;
    const reason = aiChosen ? aiEstimate.reason : normalizeReason(baseReasonByCategory[item.category]);
    return {
      headline: item.headline,
      date: item.date,
      halfLifeDays,
      expiresAt: expiresAt(item.date, halfLifeDays),
      reason,
      category: item.category,
    };
  });

  const mostImpactful = news[mostImpactfulIndex];
  return {
    symbol,
    news,
    mostImpactful: {
      headline: mostImpactful.headline,
      halfLifeDays: mostImpactful.halfLifeDays,
    },
  };
}
