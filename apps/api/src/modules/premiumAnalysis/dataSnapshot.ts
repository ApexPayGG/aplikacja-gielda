import { createHash } from "node:crypto";
import type { PrismaClient } from "@prisma/client";
import { getCompanyBySymbol } from "../../db/company-queries";
import {
  getLatestIndicator,
  getLatestQuoteForCandidates,
  getQuoteHistoryForCandidates,
  getRecentNews,
  resolveCompanyExchange,
} from "../../db/queries";
import { prisma as defaultPrisma } from "../../db/index";
import { getDividendHealth } from "../dividend/dividendModule";
import { marketSignalsService } from "../market-signals/marketSignals.service";

export const STOCK_AI_DATA_SNAPSHOT_VERSION = "1.0" as const;

export type FieldStatus = "ok" | "missing" | "stale" | "not_wired" | "requires_access";

export type SnapshotField<T> = {
  status: FieldStatus;
  value: T | null;
  asOf?: string | null;
  source?: string | null;
};

export type StockAIDataSnapshot = {
  version: typeof STOCK_AI_DATA_SNAPSHOT_VERSION;
  symbol: string;
  resolvedSymbol: string | null;
  computedAt: string;
  company: {
    name: SnapshotField<string | null>;
    exchange: SnapshotField<string | null>;
    sector: SnapshotField<string | null>;
    industry: SnapshotField<string | null>;
    country: SnapshotField<string | null>;
    currency: SnapshotField<string | null>;
  };
  quote: {
    latest: SnapshotField<{
      close: number;
      open: number;
      high: number;
      low: number;
      volume: string;
      changePct: number | null;
      previousClose: number | null;
    } | null>;
    history: SnapshotField<{
      sessionCount: number;
      start: string | null;
      end: string | null;
    } | null>;
  };
  technical: {
    rsi14: SnapshotField<number | null>;
    support60d: SnapshotField<number | null>;
    resistance60d: SnapshotField<number | null>;
    trendSummary: SnapshotField<string | null>;
  };
  fundamentals: {
    peTtm: SnapshotField<number | null>;
    marketCap: SnapshotField<number | null>;
    currency: SnapshotField<string | null>;
  };
  news: SnapshotField<
    Array<{
      title: string;
      timestamp: string;
      source: string;
      url: string | null;
    }> | null
  >;
  marketSignals: SnapshotField<{
    lookbackDays: number;
    total: number;
    averageConfidence: number;
    strongestSignalType: string | null;
  } | null>;
  dividend: SnapshotField<{
    dividendYield: number;
    healthScore: number;
    healthLabel: string;
    trend: string;
    exDate: string;
  } | null>;
  userContext: SnapshotField<{
    userId: string;
    plan: string | null;
    tradingStyle: string | null;
    riskLevelToday: string | null;
    moodToday: number | null;
    watchlistContainsSymbol: boolean | null;
  } | null>;
  dataCoverage: string[];
  missingData: string[];
};

export type BuildStockAIDataSnapshotInput = {
  symbol: string;
  prisma?: PrismaClient;
  /** Attempt dividend load when caller has already enforced product access. */
  includeDividend?: boolean;
  userId?: string | null;
  plan?: string | null;
};

function field<T>(
  status: FieldStatus,
  value: T | null,
  meta?: { asOf?: string | null; source?: string | null },
): SnapshotField<T> {
  return {
    status,
    value,
    asOf: meta?.asOf ?? null,
    source: meta?.source ?? null,
  };
}

function parseDescriptionField(description: string | null | undefined, key: string): string | null {
  if (!description) return null;
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = description.match(new RegExp(`${escaped}\\s*=\\s*([^;\\n]+)`, "i"));
  return match?.[1]?.trim() ?? null;
}

async function resolveCanonicalSymbol(db: PrismaClient, inputTicker: string): Promise<string | null> {
  const requested = inputTicker.trim().toUpperCase();
  if (!requested) return null;
  const base = requested.split(".")[0]?.trim() ?? requested;

  const exact = await db.company.findUnique({
    where: { symbol: requested },
    select: { symbol: true },
  });
  if (exact?.symbol) return exact.symbol;

  const byBase = await db.company.findFirst({
    where: { OR: [{ symbol: base }, { symbol: { startsWith: `${base}.` } }] },
    orderBy: { symbol: "asc" },
    select: { symbol: true },
  });
  if (byBase?.symbol) return byBase.symbol;

  const quoteExact = await db.quote.findFirst({
    where: { symbol: requested },
    orderBy: { timestamp: "desc" },
    select: { symbol: true },
  });
  if (quoteExact?.symbol) return quoteExact.symbol;

  const quoteByBase = await db.quote.findFirst({
    where: { OR: [{ symbol: base }, { symbol: { startsWith: `${base}.` } }] },
    orderBy: { timestamp: "desc" },
    select: { symbol: true },
  });
  return quoteByBase?.symbol ?? null;
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

function levelsFromQuoteHistory(closes: number[]): { support: number | null; resistance: number | null } {
  if (closes.length === 0) return { support: null, resistance: null };
  return { support: Math.min(...closes), resistance: Math.max(...closes) };
}

function trackCoverage(snapshot: StockAIDataSnapshot, path: string, status: FieldStatus): void {
  if (status === "ok") {
    if (!snapshot.dataCoverage.includes(path)) snapshot.dataCoverage.push(path);
    return;
  }

  const missingKey = `${path}:${status}`;
  if (!snapshot.missingData.includes(missingKey)) snapshot.missingData.push(missingKey);
}

export async function buildStockAIDataSnapshot(
  input: BuildStockAIDataSnapshotInput,
): Promise<StockAIDataSnapshot> {
  const db = input.prisma ?? defaultPrisma;
  const computedAt = new Date().toISOString();
  const requested = input.symbol.trim().toUpperCase();
  const resolvedSymbol = await resolveCanonicalSymbol(db, requested);
  const workSymbol = resolvedSymbol ?? requested;

  const [company, quoteBundle, news, rsiRow] = await Promise.all([
    getCompanyBySymbol(workSymbol),
    getLatestQuoteForCandidates(workSymbol, await resolveCompanyExchange(workSymbol)),
    getRecentNews(workSymbol, 8),
    getLatestIndicator(workSymbol, "RSI"),
  ]);

  const historyBundle = await getQuoteHistoryForCandidates(workSymbol, 60, company?.exchange ?? null);
  const historyRows = historyBundle?.rows ?? [];
  const closes = historyRows.map((q) => Number(q.close)).filter(Number.isFinite);
  const levels = levelsFromQuoteHistory(closes);
  const trend = summarizePriceTrend(closes);

  const latestQuote = quoteBundle?.quote ?? null;
  const previousClose =
    closes.length > 1 ? closes[closes.length - 2]! : null;
  const latestClose = latestQuote ? Number(latestQuote.close) : null;
  const changePct =
    latestClose != null && previousClose != null && previousClose !== 0
      ? ((latestClose - previousClose) / previousClose) * 100
      : null;

  const descCountry =
    parseDescriptionField(company?.description, "Country") ??
    parseDescriptionField(company?.description, "Market");
  const descCurrency = parseDescriptionField(company?.description, "Currency");

  const epsRow = await db.fundamental
    .findFirst({
      where: { symbol: workSymbol, metric: "eps_ttm", year: 0 },
      orderBy: { lastUpdated: "desc" },
      select: { value: true, lastUpdated: true },
    })
    .catch(() => null);

  const marketCapRow = await db.fundamental
    .findFirst({
      where: { symbol: workSymbol, metric: "market_cap", year: 0 },
      orderBy: { lastUpdated: "desc" },
      select: { value: true, lastUpdated: true },
    })
    .catch(() => null);

  let signalsField: SnapshotField<StockAIDataSnapshot["marketSignals"]["value"]> = field(
    "not_wired",
    null,
    { source: "market_signals" },
  );
  try {
    const signals = await marketSignalsService.listSignals({ ticker: workSymbol, lookbackDays: 30 });
    signalsField = field(
      "ok",
      {
        lookbackDays: signals.lookbackDays,
        total: signals.summary.total,
        averageConfidence: signals.summary.averageConfidenceScore,
        strongestSignalType: signals.summary.strongestSignalType,
      },
      { asOf: computedAt, source: "market_signals_db" },
    );
  } catch {
    signalsField = field("missing", null, { source: "market_signals" });
  }

  let dividendField: SnapshotField<StockAIDataSnapshot["dividend"]["value"]> = field(
    input.includeDividend ? "missing" : "requires_access",
    null,
    { source: "dividend_module" },
  );
  if (input.includeDividend) {
    try {
      const div = await getDividendHealth(workSymbol);
      dividendField = field(
        "ok",
        {
          dividendYield: div.dividendYield,
          healthScore: div.healthScore,
          healthLabel: div.healthLabel,
          trend: div.trend,
          exDate: div.exDate,
        },
        { asOf: div.exDate, source: "dividend_module" },
      );
    } catch {
      dividendField = field("requires_access", null, { source: "dividend_module" });
    }
  }

  let userContextField: SnapshotField<StockAIDataSnapshot["userContext"]["value"]> = field(
    "not_wired",
    null,
    { source: "user_context" },
  );
  if (input.userId?.trim()) {
    const userId = input.userId.trim();
    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    const [profile, checkIn, watchlistHit] = await Promise.all([
      db.traderProfile.findUnique({ where: { userId } }).catch(() => null),
      db.dailyCheckIn
        .findFirst({
          where: { userId, createdAt: { gte: dayStart, lt: dayEnd } },
          orderBy: { createdAt: "desc" },
        })
        .catch(() => null),
      db.watchlist
        .findFirst({ where: { userId, symbol: workSymbol }, select: { id: true } })
        .catch(() => null),
    ]);

    userContextField = field(
      "ok",
      {
        userId,
        plan: input.plan ?? null,
        tradingStyle: profile?.tradingStyle ?? null,
        riskLevelToday: checkIn?.riskLevel ?? null,
        moodToday: checkIn?.mood ?? null,
        watchlistContainsSymbol: Boolean(watchlistHit),
      },
      { asOf: computedAt, source: "trader_profile_checkin_watchlist" },
    );
  }

  const peValue =
    latestClose != null && epsRow && Number(epsRow.value) > 0
      ? latestClose / Number(epsRow.value)
      : null;

  const snapshot: StockAIDataSnapshot = {
    version: STOCK_AI_DATA_SNAPSHOT_VERSION,
    symbol: requested,
    resolvedSymbol,
    computedAt,
    company: {
      name: field(company?.name ? "ok" : "missing", company?.name ?? null, { source: "companies" }),
      exchange: field(company?.exchange ? "ok" : "missing", company?.exchange ?? null, {
        source: "companies",
      }),
      sector: field(company?.sector ? "ok" : "missing", company?.sector ?? null, { source: "companies" }),
      industry: field(company?.industry ? "ok" : "missing", company?.industry ?? null, {
        source: "companies",
      }),
      country: field(descCountry ? "ok" : "missing", descCountry, { source: "company_description" }),
      currency: field(descCurrency ? "ok" : "missing", descCurrency, { source: "company_description" }),
    },
    quote: {
      latest: latestQuote
        ? field(
            "ok",
            {
              close: latestClose!,
              open: Number(latestQuote.open),
              high: Number(latestQuote.high),
              low: Number(latestQuote.low),
              volume: latestQuote.volume.toString(),
              changePct,
              previousClose,
            },
            { asOf: latestQuote.timestamp.toISOString(), source: latestQuote.source },
          )
        : field("missing", null, { source: "quotes" }),
      history:
        historyRows.length > 0
          ? field(
              "ok",
              {
                sessionCount: historyRows.length,
                start: historyRows[0]?.timestamp.toISOString() ?? null,
                end: historyRows.at(-1)?.timestamp.toISOString() ?? null,
              },
              {
                asOf: historyRows.at(-1)?.timestamp.toISOString() ?? null,
                source: historyBundle?.resolvedSymbol ?? workSymbol,
              },
            )
          : field("missing", null, { source: "quotes" }),
    },
    technical: {
      rsi14: rsiRow
        ? field("ok", Number(rsiRow.value), {
            asOf: rsiRow.timestamp.toISOString(),
            source: "technical_indicators",
          })
        : field("missing", null, { source: "technical_indicators" }),
      support60d: levels.support != null ? field("ok", levels.support, { source: "quote_history_60d" }) : field("missing", null),
      resistance60d:
        levels.resistance != null
          ? field("ok", levels.resistance, { source: "quote_history_60d" })
          : field("missing", null),
      trendSummary: trend
        ? field("ok", trend, { asOf: computedAt, source: "quote_history_60d" })
        : field("missing", null, { source: "quote_history_60d" }),
    },
    fundamentals: {
      peTtm: peValue != null
        ? field("ok", peValue, {
            asOf: epsRow?.lastUpdated?.toISOString() ?? null,
            source: "fundamentals_eps_ttm",
          })
        : field("missing", null, { source: "fundamentals" }),
      marketCap: marketCapRow
        ? field("ok", Number(marketCapRow.value), {
            asOf: marketCapRow.lastUpdated?.toISOString() ?? null,
            source: "fundamentals_market_cap",
          })
        : field("missing", null, { source: "fundamentals" }),
      currency: field(descCurrency ? "ok" : "missing", descCurrency, { source: "company_description" }),
    },
    news:
      news.length > 0
        ? field(
            "ok",
            news.map((n: { title: string; timestamp: Date; source: string; url: string }) => ({
              title: n.title,
              timestamp: n.timestamp.toISOString(),
              source: n.source,
              url: n.url,
            })),
            { asOf: news[0]?.timestamp.toISOString() ?? null, source: "news" },
          )
        : field("missing", null, { source: "news" }),
    marketSignals: signalsField,
    dividend: dividendField,
    userContext: userContextField,
    dataCoverage: [],
    missingData: [],
  };

  const paths: Array<[string, FieldStatus]> = [
    ["company.name", snapshot.company.name.status],
    ["company.sector", snapshot.company.sector.status],
    ["quote.latest", snapshot.quote.latest.status],
    ["quote.history", snapshot.quote.history.status],
    ["technical.rsi14", snapshot.technical.rsi14.status],
    ["fundamentals.peTtm", snapshot.fundamentals.peTtm.status],
    ["news", snapshot.news.status],
    ["marketSignals", snapshot.marketSignals.status],
    ["dividend", snapshot.dividend.status],
    ["userContext", snapshot.userContext.status],
  ];
  for (const [path, status] of paths) trackCoverage(snapshot, path, status);

  return snapshot;
}

/** Stable hash for cache keys - based on symbol, version, and material quote/fundamental as-of stamps. */
export function createSnapshotHash(snapshot: StockAIDataSnapshot): string {
  const payload = {
    version: snapshot.version,
    symbol: snapshot.symbol,
    resolvedSymbol: snapshot.resolvedSymbol,
    quoteAsOf: snapshot.quote.latest.asOf,
    historyEnd: snapshot.quote.history.value?.end ?? null,
    rsiAsOf: snapshot.technical.rsi14.asOf,
    peAsOf: snapshot.fundamentals.peTtm.asOf,
    marketCapAsOf: snapshot.fundamentals.marketCap.asOf,
    newsAsOf: snapshot.news.asOf,
    signalsTotal: snapshot.marketSignals.value?.total ?? null,
    dividendAsOf: snapshot.dividend.asOf,
    userId: snapshot.userContext.value?.userId ?? null,
  };
  return createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex").slice(0, 32);
}
