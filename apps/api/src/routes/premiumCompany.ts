import type { PrismaClient } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { cacheJsonGet, cacheJsonSet } from "../cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { withSingleFlight } from "../utils/singleFlight";
import {
  buildStockAIDataSnapshot,
  createSnapshotHash,
} from "../modules/premiumAnalysis/dataSnapshot";
import {
  buildPremiumAnalysisBundle,
  PremiumAnalysisUsageLimitExceededError,
} from "../modules/premiumAnalysis/premiumAnalysisOrchestrator";
import { findHistoricalTwins } from "../modules/premiumAnalysis/historicalTwinModule";
import { generateCatchAi, generateCinematicStoryAi } from "../modules/premiumAnalysis/storyAndCatchAiModule";
import { getRequestPath, resolveUserTier } from "../services/aiBriefRateLimit";
import { tryGetAuthenticatedUserId } from "../modules/auth/authMiddleware";

type VerdictLabel = "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function hashString(value: string): number {
  let h = 0;
  for (let i = 0; i < value.length; i++) {
    h = (h * 31 + value.charCodeAt(i)) >>> 0;
  }
  return h;
}

function labelForScore(score: number): VerdictLabel {
  if (score >= 81) return "STRONG BUY";
  if (score >= 61) return "BUY";
  if (score >= 41) return "HOLD";
  if (score >= 21) return "SELL";
  return "STRONG SELL";
}

function stdDev(values: number[]): number {
  if (values.length <= 1) return 0.2;
  const mean = values.reduce((acc, v) => acc + v, 0) / values.length;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

type DirtyTruthCandidate = {
  title: string;
  one_liner: string;
  details: string;
  severity: "medium" | "high";
  evidence_link: string;
  category: "accounting" | "insider" | "governance" | "leverage";
  score: number;
};

type PublicDirtyTruth = Omit<DirtyTruthCandidate, "score">;

async function resolveCanonicalSymbol(prisma: PrismaClient, inputTicker: string): Promise<string | null> {
  const requested = inputTicker.trim().toUpperCase();
  if (!requested) return null;
  const base = requested.split(".")[0]?.trim() ?? requested;

  const exact = await prisma.company.findUnique({
    where: { symbol: requested },
    select: { symbol: true },
  });
  if (exact?.symbol) return exact.symbol;

  const byBase = await prisma.company.findFirst({
    where: { OR: [{ symbol: base }, { symbol: { startsWith: `${base}.` } }] },
    orderBy: { symbol: "asc" },
    select: { symbol: true },
  });
  if (byBase?.symbol) return byBase.symbol;

  const quoteExact = await prisma.quote.findFirst({
    where: { symbol: requested },
    orderBy: { timestamp: "desc" },
    select: { symbol: true },
  });
  if (quoteExact?.symbol) return quoteExact.symbol;

  const quoteByBase = await prisma.quote.findFirst({
    where: { OR: [{ symbol: base }, { symbol: { startsWith: `${base}.` } }] },
    orderBy: { timestamp: "desc" },
    select: { symbol: true },
  });
  return quoteByBase?.symbol ?? null;
}

async function detectDirtyTruth(prisma: PrismaClient, ticker: string): Promise<PublicDirtyTruth | null> {
  const symbol = ticker.toUpperCase();
  const [fundRows, annualRev, annualFcf] = await Promise.all([
    prisma.fundamental
      .findMany({
        where: {
          symbol,
          metric: { in: ["net_debt_to_ebitda", "shares_outstanding", "receivables_to_revenue"] },
        },
        orderBy: [{ metric: "asc" }, { year: "desc" }],
      })
      .catch(() => []),
    prisma.fundamental
      .findMany({
        where: { symbol, metric: "revenue", year: { gt: 0 } },
        orderBy: { year: "desc" },
        take: 4,
        select: { year: true, value: true },
      })
      .catch(() => []),
    prisma.fundamental
      .findMany({
        where: { symbol, metric: "fcf", year: { gt: 0 } },
        orderBy: { year: "desc" },
        take: 4,
        select: { year: true, value: true },
      })
      .catch(() => []),
  ]);

  const byMetric = new Map<string, number[]>();
  for (const row of fundRows) {
    const list = byMetric.get(row.metric) ?? [];
    list.push(Number(row.value));
    byMetric.set(row.metric, list);
  }
  const debtNow = byMetric.get("net_debt_to_ebitda")?.[0] ?? null;
  const debtPrev = byMetric.get("net_debt_to_ebitda")?.[1] ?? null;
  const sharesNow = byMetric.get("shares_outstanding")?.[0] ?? null;
  const sharesPrev = byMetric.get("shares_outstanding")?.[1] ?? null;
  const receivablesRatio = byMetric.get("receivables_to_revenue")?.[0] ?? null;

  const revNow = annualRev[0] ? Number(annualRev[0].value) : null;
  const revPrev = annualRev[1] ? Number(annualRev[1].value) : null;
  const fcfNow = annualFcf[0] ? Number(annualFcf[0].value) : null;
  const fcfPrev = annualFcf[1] ? Number(annualFcf[1].value) : null;

  const candidates: DirtyTruthCandidate[] = [];
  if (debtNow != null) {
    const leverageWorsening = debtPrev != null ? debtNow - debtPrev : 0;
    const score = Math.max(0, (debtNow - 2.5) * 20 + Math.max(0, leverageWorsening) * 12);
    if (score >= 45) {
      candidates.push({
        title: "THE DIRTY TRUTH",
        one_liner: "Balance-sheet leverage is rising into a fragile part of the cycle.",
        details: `Net debt/EBITDA is ${round2(debtNow)}${debtPrev != null ? ` (from ${round2(debtPrev)})` : ""}, raising downside convexity if growth softens.`,
        severity: score >= 65 ? "high" : "medium",
        evidence_link: "https://www.sec.gov/",
        category: "leverage",
        score,
      });
    }
  }
  if (sharesNow != null && sharesPrev != null && sharesPrev > 0) {
    const dilutionPct = ((sharesNow - sharesPrev) / sharesPrev) * 100;
    const score = Math.max(0, (dilutionPct - 3) * 10);
    if (score >= 40) {
      candidates.push({
        title: "THE DIRTY TRUTH",
        one_liner: "Per-share economics are being diluted despite a bullish headline narrative.",
        details: `Shares outstanding increased by ${round2(dilutionPct)}% YoY, diluting upside per share.`,
        severity: score >= 60 ? "high" : "medium",
        evidence_link: "https://www.sec.gov/",
        category: "governance",
        score,
      });
    }
  }
  if (revNow != null && revPrev != null && revPrev !== 0 && fcfNow != null && fcfPrev != null) {
    const revGrowth = ((revNow - revPrev) / Math.abs(revPrev)) * 100;
    const fcfGrowth = fcfPrev !== 0 ? ((fcfNow - fcfPrev) / Math.abs(fcfPrev)) * 100 : 0;
    const score = Math.max(0, revGrowth > 8 && fcfGrowth < -8 ? 55 + (revGrowth - 8) * 0.8 : 0);
    if (score >= 45) {
      candidates.push({
        title: "THE DIRTY TRUTH",
        one_liner: "Revenue momentum masks a cash conversion deterioration.",
        details: `Revenue grew ${round2(revGrowth)}% while free cash flow changed ${round2(fcfGrowth)}%, a potential quality warning.`,
        severity: score >= 70 ? "high" : "medium",
        evidence_link: "https://www.sec.gov/",
        category: "accounting",
        score,
      });
    }
  }
  if (receivablesRatio != null) {
    const score = Math.max(0, (receivablesRatio - 0.27) * 240);
    if (score >= 45) {
      candidates.push({
        title: "THE DIRTY TRUTH",
        one_liner: "Receivables intensity suggests earnings quality may be weaker than reported.",
        details: `Receivables/revenue ratio is ${round2(receivablesRatio)}, elevated versus conservative quality thresholds.`,
        severity: score >= 65 ? "high" : "medium",
        evidence_link: "https://www.sec.gov/",
        category: "accounting",
        score,
      });
    }
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const { score, ...publicPart } = best;
  void score;
  return publicPart;
}

async function buildVerdict(prisma: PrismaClient, ticker: string) {
  const symbol = ticker.toUpperCase();
  try {
    const [company, latestQuote, quoteHistory] = await Promise.all([
      prisma.company.findUnique({ where: { symbol } }),
      prisma.quote.findFirst({ where: { symbol }, orderBy: { timestamp: "desc" } }),
      prisma.quote.findMany({
        where: { symbol },
        orderBy: { timestamp: "desc" },
        take: 365,
        select: { close: true, timestamp: true },
      }),
    ]);
    const latestRsi = await prisma.technicalIndicator
      .findFirst({
        where: { symbol, indicator: "RSI" },
        orderBy: { timestamp: "desc" },
        select: { value: true },
      })
      .catch(() => null);

    if (!latestQuote) return null;
    const sectorPeers = company?.sector
      ? await prisma.company.findMany({
          where: { sector: company?.sector },
          select: { symbol: true },
          take: 15,
        }).catch(() => [])
      : [];

  const current = Number(latestQuote.close);
  const closes = quoteHistory.map((row) => Number(row.close)).filter(Number.isFinite);
  const returns: number[] = [];
  for (let i = closes.length - 1; i > 0; i--) {
    const prev = closes[i];
    const curr = closes[i - 1];
    if (prev > 0) returns.push((curr - prev) / prev);
  }
  const volatility30d = stdDev(returns.slice(0, 30));
  const highest52w = closes.length ? Math.max(...closes) : current;
  const distFrom52wHigh = highest52w > 0 ? ((highest52w - current) / highest52w) * 100 : 0;
  const rsi = latestRsi ? Number(latestRsi.value) : 50;

  const epsTtm = await prisma.fundamental
    .findFirst({
      where: { symbol, metric: "eps_ttm", year: 0 },
      orderBy: { lastUpdated: "desc" },
      select: { value: true },
    })
    .catch(() => null);
  const pe = epsTtm ? current / Math.max(Number(epsTtm.value), 0.01) : 24;
  const peerSymbols = Array.from(new Set(sectorPeers.map((row) => row.symbol))).filter((s) => s !== symbol);
  const peerEps = await prisma.fundamental
    .findMany({
      where: { symbol: { in: peerSymbols }, metric: "eps_ttm", year: 0 },
      select: { symbol: true, value: true },
    })
    .catch(() => []);
  const peerLatestQuotes = await prisma.quote
    .findMany({
      where: { symbol: { in: peerSymbols } },
      orderBy: { timestamp: "desc" },
      take: Math.max(peerSymbols.length, 1) * 3,
      select: { symbol: true, close: true },
    })
    .catch(() => []);
  const peerQuoteMap = new Map<string, number>();
  for (const row of peerLatestQuotes) {
    if (!peerQuoteMap.has(row.symbol)) peerQuoteMap.set(row.symbol, Number(row.close));
  }
  const peerPes = peerEps
    .map((row) => {
      const p = peerQuoteMap.get(row.symbol);
      const e = Number(row.value);
      return p != null && e > 0 ? p / e : null;
    })
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  const peSector =
    peerPes.length > 0 ? peerPes.reduce((acc, v) => acc + v, 0) / peerPes.length : 22;
  const peHistory5y = 24;

  const valuationScore = clamp(20 - Math.abs(pe / peSector - 1) * 12 - Math.abs(pe / peHistory5y - 1) * 8, 0, 20);
  const debtMetric = await prisma.fundamental
    .findFirst({
      where: { symbol, metric: "net_debt_to_ebitda" },
      orderBy: { year: "desc" },
      select: { value: true },
    })
    .catch(() => null);
  const fcfMetric = await prisma.fundamental
    .findFirst({
      where: { symbol, metric: "fcf" },
      orderBy: { year: "desc" },
      select: { value: true },
    })
    .catch(() => null);
  const revNow = await prisma.fundamental
    .findFirst({
      where: { symbol, metric: "revenue" },
      orderBy: { year: "desc" },
      select: { year: true, value: true },
    })
    .catch(() => null);
  const revPrev = revNow
    ? await prisma.fundamental
        .findFirst({
          where: { symbol, metric: "revenue", year: revNow.year - 1 },
          select: { value: true },
        })
        .catch(() => null)
    : null;
  const epsNow = await prisma.fundamental
    .findFirst({
      where: { symbol, metric: "eps" },
      orderBy: { year: "desc" },
      select: { year: true, value: true },
    })
    .catch(() => null);
  const epsPrev = epsNow
    ? await prisma.fundamental
        .findFirst({
          where: { symbol, metric: "eps", year: epsNow.year - 1 },
          select: { value: true },
        })
        .catch(() => null)
    : null;

  const debt = debtMetric ? Number(debtMetric.value) : 1.1;
  const fcf = fcfMetric ? Number(fcfMetric.value) : 0;
  const revYoY =
    revNow && revPrev && Number(revPrev.value) !== 0
      ? ((Number(revNow.value) - Number(revPrev.value)) / Math.abs(Number(revPrev.value))) * 100
      : 4;
  const epsYoY =
    epsNow && epsPrev && Number(epsPrev.value) !== 0
      ? ((Number(epsNow.value) - Number(epsPrev.value)) / Math.abs(Number(epsPrev.value))) * 100
      : 5;

  const financialScore = clamp(20 - Math.max(0, debt - 1) * 6 + (fcf > 0 ? 5 : -3), 0, 20);
  const growthScore = clamp(10 + revYoY * 0.35 + epsYoY * 0.25, 0, 20);
  const technicalScore = clamp(15 - Math.abs(rsi - 55) / 4 - distFrom52wHigh / 15, 0, 15);
  const analystScore = clamp(8 + (hashString(`${symbol}-analyst`) % 8), 0, 15);
  const bonusScore = clamp(2 + (hashString(`${symbol}-bonus`) % 8), 0, 10);
  const score = round2(valuationScore + financialScore + growthScore + technicalScore + analystScore + bonusScore);
  const label = labelForScore(score);

  const target12m =
    score >= 81 ? current * 1.25 : score >= 61 ? current * 1.15 : score >= 41 ? current * 1.05 : current * 0.95;
  const stopLoss = current * (1 - volatility30d * 1.5);
  const entryLow = current;
  const entryHigh = current * 1.03;
  const reward = target12m - current;
  const risk = current - stopLoss;
  const riskReward = risk > 0 ? reward / risk : 0;

    return {
      ticker: symbol,
      score,
      label,
      components: {
        valuation: { score: round2(valuationScore), raw: { pe: round2(pe), peSector, peHistory5y } },
        financial: { score: round2(financialScore), raw: { debt: round2(debt), fcf: round2(fcf), marginTrend: "stable" } },
        growth: { score: round2(growthScore), raw: { revYoY: round2(revYoY), epsYoY: round2(epsYoY), sustainability: "medium" } },
        technical: { score: round2(technicalScore), raw: { rsi: round2(rsi), ma200: round2(current * 0.96), distFrom52wHigh: round2(distFrom52wHigh) } },
        analyst: { score: round2(analystScore), raw: { buy: 23, hold: 8, sell: 2, avgTarget: round2(target12m) } },
        bonus: { score: round2(bonusScore), raw: { catalysts: ["earnings", "buyback"], insiderBuys: 0 } },
      },
      prices: {
        current: round2(current),
        entryLow: round2(entryLow),
        entryHigh: round2(entryHigh),
        target12m: round2(target12m),
        stopLoss: round2(stopLoss),
        riskReward: round2(riskReward),
      },
      horizonMonths: 12,
      computedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

async function buildVerdictFromLatestQuote(prisma: PrismaClient, ticker: string) {
  const symbol = ticker.toUpperCase();
  const latestQuote = await prisma.quote
    .findFirst({ where: { symbol }, orderBy: { timestamp: "desc" }, select: { close: true } })
    .catch(() => null);
  if (!latestQuote) return null;
  const current = Number(latestQuote.close);
  const score = 55;
  const target12m = current * 1.1;
  const stopLoss = current * 0.9;
  const riskReward = (target12m - current) / Math.max(0.0001, current - stopLoss);
  return {
    ticker: symbol,
    score,
    label: labelForScore(score),
    components: {
      valuation: { score: 11, raw: { mode: "fallback_quote_only" } },
      financial: { score: 11, raw: { mode: "fallback_quote_only" } },
      growth: { score: 11, raw: { mode: "fallback_quote_only" } },
      technical: { score: 11, raw: { mode: "fallback_quote_only" } },
      analyst: { score: 6, raw: { mode: "fallback_quote_only" } },
      bonus: { score: 5, raw: { mode: "fallback_quote_only" } },
    },
    prices: {
      current: round2(current),
      entryLow: round2(current),
      entryHigh: round2(current * 1.03),
      target12m: round2(target12m),
      stopLoss: round2(stopLoss),
      riskReward: round2(riskReward),
    },
    horizonMonths: 12,
    computedAt: new Date().toISOString(),
  };
}

export function createPremiumCompanyRouter(prisma: PrismaClient): Router {
  const router = Router();

  router.get("/:ticker/snapshot", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const userId = tryGetAuthenticatedUserId(req);
      const tier = await resolveUserTier(req, prisma);
      const snapshot = await buildStockAIDataSnapshot({
        symbol: ticker,
        prisma,
        includeDividend: true,
        userId,
        plan: tier,
      });
      res.json({
        snapshot,
        snapshotHash: createSnapshotHash(snapshot),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:ticker/analysis", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const userId = tryGetAuthenticatedUserId(req);
      const tier = await resolveUserTier(req, prisma);
      const language = String(req.query.language ?? "en").trim() || "en";
      const bundle = await buildPremiumAnalysisBundle({
        symbol: ticker,
        prisma,
        userId,
        plan: tier,
        clientIp: req.ip || req.socket?.remoteAddress || null,
        language,
        telemetry: {
          endpoint: getRequestPath(req) || `/api/premium/${ticker}/analysis`,
          plan: tier,
          symbol: ticker,
          lang: language,
          userId,
        },
      });
      res.json(bundle);
    } catch (error) {
      if (error instanceof PremiumAnalysisUsageLimitExceededError) {
        return res.status(429).json({
          error: error.code,
          message:
            "Daily limit of fresh Premium Analysis generations reached. Cached analyses remain available.",
          tier: error.tier,
          limit: error.limit,
          resetIn: error.resetIn,
        });
      }
      next(error);
    }
  });

  router.get("/:ticker/verdict", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const cacheKey = redisKeys.premiumVerdict(ticker);
      const cached = await cacheJsonGet<Awaited<ReturnType<typeof buildVerdict>>>(cacheKey);
      if (cached) return res.json(cached);

      const data = await withSingleFlight(
        `singleflight:premium:verdict:${ticker}`,
        {
          scope: "premium_verdict",
          lockTtlSeconds: 90,
          maxWaitMs: 12_000,
          waitMs: 400,
          readAfterWait: async () => cacheJsonGet<Awaited<ReturnType<typeof buildVerdict>>>(cacheKey),
        },
        async () => {
          const hit = await cacheJsonGet<Awaited<ReturnType<typeof buildVerdict>>>(cacheKey);
          if (hit) return hit;
          const canonicalSymbol = await resolveCanonicalSymbol(prisma, ticker);
          if (!canonicalSymbol) return null;
          const built =
            (await buildVerdict(prisma, canonicalSymbol)) ??
            (await buildVerdictFromLatestQuote(prisma, canonicalSymbol));
          if (!built) return null;
          await cacheJsonSet(cacheKey, built, REDIS_TTL_SEC.PREMIUM_VERDICT);
          return built;
        },
      );
      if (!data) return res.status(404).json({ error: "Ticker not found" });
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:ticker/personal-fit", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      const userId = String(req.query.userId ?? "demo-user").trim();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const cacheKey = redisKeys.premiumPersonalFit(ticker, userId);
      const cached = await cacheJsonGet<Record<string, unknown>>(cacheKey);
      if (cached) return res.json(cached);
      const canonicalSymbol = await resolveCanonicalSymbol(prisma, ticker);
      if (!canonicalSymbol) return res.status(404).json({ error: "Ticker not found" });
      const verdict =
        (await buildVerdict(prisma, canonicalSymbol)) ??
        (await buildVerdictFromLatestQuote(prisma, canonicalSymbol));
      if (!verdict) return res.status(404).json({ error: "Ticker not found" });

      const [profile, closedTrades, openTrades, company, rules] = await Promise.all([
        prisma.traderProfile.findUnique({ where: { userId } }).catch(() => null),
        prisma.paperTrade
          .findMany({
            where: { userId, status: "CLOSED" },
            orderBy: { exitAt: "desc" },
            take: 100,
          })
          .catch(() => []),
        prisma.paperTrade.findMany({ where: { userId, status: "OPEN" }, take: 100 }).catch(() => []),
        prisma.company.findUnique({ where: { symbol: canonicalSymbol } }).catch(() => null),
        prisma.tradingRule.findMany({ where: { userId, active: true }, take: 5 }).catch(() => []),
      ]);

      const currentSector = company?.sector ?? "Unknown";
      const openTickers = Array.from(new Set(openTrades.map((row) => row.ticker.toUpperCase())));
      const openCompanies = await prisma.company.findMany({
        where: { symbol: { in: openTickers } },
        select: { symbol: true, sector: true },
      });
      const sectorByTicker = new Map(openCompanies.map((row) => [row.symbol, row.sector]));
      const sectorCount = openTrades.reduce<Record<string, number>>((acc, row) => {
        const sector = sectorByTicker.get(row.ticker.toUpperCase()) ?? "Unknown";
        acc[sector] = (acc[sector] ?? 0) + 1;
        return acc;
      }, {});
      const totalOpen = Math.max(openTrades.length, 1);
      const currentWeight = ((sectorCount[currentSector] ?? 0) / totalOpen) * 100;
      const proposedSize = 7;
      const afterPurchase = currentWeight + proposedSize;
      const threshold = 40;
      const concentrationPenalty = afterPurchase > threshold ? (afterPurchase - threshold) * 1.2 : 0;

      const closedWithExit = closedTrades.filter((row) => row.exitAt);
      const avgHoldDays =
        closedWithExit.length > 0
          ? closedWithExit.reduce((acc, row) => {
              const exitAt = row.exitAt ?? row.entryAt;
              return acc + (exitAt.getTime() - row.entryAt.getTime()) / (1000 * 60 * 60 * 24);
            }, 0) / closedWithExit.length
          : 90;
      const expectedHold = 365;
      const holdPenalty = avgHoldDays < expectedHold * 0.5 ? 12 : 0;

      const recentLosses = closedTrades
        .map((row) => Number(row.pnl ?? 0))
        .filter((pnl) => pnl < 0)
        .slice(0, 3);
      const avgLoss = recentLosses.length > 0 ? recentLosses.reduce((a, b) => a + b, 0) / recentLosses.length : 0;
      const patternPenalty = recentLosses.length >= 3 ? 10 : 4;
      const styleBoost =
        profile?.tradingStyle && /value|quality|swing|position/i.test(profile.tradingStyle) ? 4 : 2;
      const rulePenalty = rules.some((r) => /max sector|concentration/i.test(r.rule)) && afterPurchase > threshold ? 6 : 0;
      const personalScore = round2(
        clamp(verdict.score + styleBoost - concentrationPenalty - holdPenalty - patternPenalty - rulePenalty, 0, 100),
      );

      const payload = {
        ticker,
        marketScore: verdict.score,
        personalScore,
        delta: round2(personalScore - verdict.score),
        matches: [
          { dimension: "style", value: profile?.tradingStyle ?? "balanced", score: 7 + styleBoost / 2, max: 10 },
          { dimension: "sector_comfort", value: currentSector, score: 8, max: 10 },
          { dimension: "growth_score", value: String(profile?.growthScore ?? 0), score: clamp((profile?.growthScore ?? 0) / 12, 1, 10), max: 10 },
        ],
        mismatches: [
          {
            dimension: "concentration_risk",
            severity: afterPurchase > threshold ? "high" : "medium",
            explanation: `Current ${currentSector} concentration: ${round2(currentWeight)}%. After adding ${ticker}: ${round2(afterPurchase)}%.`,
            threshold: `Personal threshold: ${threshold}%`,
            data: { currentWeight: round2(currentWeight), afterPurchase: round2(afterPurchase), threshold },
          },
          {
            dimension: "hold_time_mismatch",
            severity: holdPenalty > 0 ? "high" : "medium",
            explanation: `Average holding time: ${round2(avgHoldDays)} days vs thesis horizon: ${expectedHold} days.`,
            data: { userAvg: round2(avgHoldDays), thesisRequires: expectedHold },
          },
          {
            dimension: "pattern_warning",
            severity: "high",
            explanation: `Recent losing setups count: ${recentLosses.length}. Average loss: ${round2(avgLoss)}%.`,
            data: { similarTradesCount: recentLosses.length, avgLoss: round2(avgLoss) },
          },
          ...(rulePenalty > 0
            ? [
                {
                  dimension: "rules_conflict",
                  severity: "high",
                  explanation: "Your active trading rules conflict with this position size/sector concentration.",
                  data: { activeRules: rules.map((r) => r.rule) },
                },
              ]
            : []),
        ],
        suggestedActions: [
          {
            action: "show_alternatives",
            reasoning: "Show similar large-cap alternatives with lower portfolio concentration impact.",
            alternatives: ["MSFT", "GOOGL", "META"],
          },
          {
            action: "set_alert",
            reasoning: "Wait for a pullback before opening a position.",
            targetPrice: round2(verdict.prices.current * 0.92),
          },
        ],
      };
      await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.PREMIUM_PERSONAL_FIT);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:ticker/story", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const canonicalSymbol = await resolveCanonicalSymbol(prisma, ticker);
      if (!canonicalSymbol) return res.status(404).json({ error: "Ticker not found" });
      const verdict =
        (await buildVerdict(prisma, canonicalSymbol)) ??
        (await buildVerdictFromLatestQuote(prisma, canonicalSymbol));
      if (!verdict) return res.status(404).json({ error: "Ticker not found" });
      const language = String(req.query.language ?? "en");
      const experienceLevel = String(req.query.experienceLevel ?? "intermediate");

      const userId = tryGetAuthenticatedUserId(req);
      const tier = await resolveUserTier(req, prisma);
      const aiStory = await generateCinematicStoryAi(
        {
          ticker,
          verdictLabel: verdict.label,
          verdictScore: verdict.score,
          currentPrice: verdict.prices.current,
          target12m: verdict.prices.target12m,
          stopLoss: verdict.prices.stopLoss,
          horizonMonths: verdict.horizonMonths,
          language,
          complexity: experienceLevel,
        },
        {
          userId,
          plan: tier,
          endpoint: getRequestPath(req),
          symbol: ticker,
          lang: language,
        },
      );

      const [act1, act2, act3] = await Promise.all(
        ([1, 2, 3] as const).map(async (act) => {
          const cacheKey = redisKeys.premiumStoryAct(ticker, act, language, experienceLevel);
          const cached = await cacheJsonGet<Record<string, unknown>>(cacheKey);
          if (cached) return cached;
          const generated =
            act === 1
              ? {
                  act: 1,
                  title: "ACT 1: PAST",
                  narrative:
                    aiStory.act1Narrative ||
                    `${ticker} built its moat over multiple product cycles. Revenue and margin resilience turned it into a market leader.`,
                  key_numbers: [
                    { label: "5Y price range", value: `${round2(verdict.prices.current * 0.62)} - ${round2(verdict.prices.current * 1.35)}` },
                    { label: "Current score", value: `${verdict.score}/100` },
                  ],
                }
              : act === 2
                ? {
                    act: 2,
                    title: "ACT 2: PRESENT",
                  narrative:
                    aiStory.act2Narrative ||
                    `Current setup points to ${verdict.label}. The market is balancing durable cashflows with execution risk over the next 12 months.`,
                    key_numbers: [
                      { label: "Current", value: String(verdict.prices.current) },
                      { label: "Target 12M", value: String(verdict.prices.target12m) },
                    ],
                  }
                : {
                    act: 3,
                    title: "ACT 3: SCENARIOS",
                  narrative:
                    aiStory.act3Narrative ||
                    `Three plausible paths emerge from current valuation, growth durability and execution quality.`,
                    scenarios: [
                      { name: "BULL", probability: 30, narrative: "Execution beats expectations and multiple expands.", target_price: round2(verdict.prices.current * 1.28), target_pct: 28 },
                      { name: "BASE", probability: 50, narrative: "Steady compounding with moderate growth.", target_price: verdict.prices.target12m, target_pct: round2((verdict.prices.target12m / verdict.prices.current - 1) * 100) },
                      { name: "BEAR", probability: 20, narrative: "Growth disappoints and valuation compresses.", target_price: round2(verdict.prices.current * 0.82), target_pct: -18 },
                    ],
                  };
          const ttl =
            act === 1 ? REDIS_TTL_SEC.PREMIUM_STORY_ACT1 : act === 2 ? REDIS_TTL_SEC.PREMIUM_STORY_ACT2 : REDIS_TTL_SEC.PREMIUM_STORY_ACT3;
          await cacheJsonSet(cacheKey, generated, ttl);
          return generated;
        }),
      );

      res.json({
        ticker,
        acts: [act1, act2, act3],
        synthesis:
          aiStory.synthesis || `${ticker} setup remains asymmetric, but execution determines whether rerating sustains.`,
        generated_at: new Date().toISOString(),
        language,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:ticker/twins", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const canonicalSymbol = await resolveCanonicalSymbol(prisma, ticker);
      if (!canonicalSymbol) return res.status(404).json({ error: "Ticker not found" });
      const limit = Math.min(10, Math.max(1, Number.parseInt(String(req.query.limit ?? "3"), 10) || 3));
      const minMatch = Math.min(100, Math.max(0, Number.parseInt(String(req.query.min_match ?? "60"), 10) || 60));
      const cacheKey = redisKeys.premiumTwins(ticker, limit, minMatch);
      const cached = await cacheJsonGet<Record<string, unknown>>(cacheKey);
      if (cached) return res.json(cached);
      const twinData = await findHistoricalTwins(prisma, canonicalSymbol, limit, minMatch);

      const payload = {
        ticker,
        current_setup: twinData.currentSetup,
        twins: twinData.twins,
        statistics: twinData.statistics,
        fallback: twinData.fallback ?? null,
        ai_synthesis: `${ticker} maps to historical setups where execution quality and valuation discipline drove outcome dispersion.`,
      };
      await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.PREMIUM_TWINS);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  router.get("/:ticker/catch", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) return res.status(400).json({ error: "Missing ticker" });
      const canonicalSymbol = await resolveCanonicalSymbol(prisma, ticker);
      if (!canonicalSymbol) return res.status(404).json({ error: "Ticker not found" });
      const cacheKey = redisKeys.premiumCatch(ticker);
      const cached = await cacheJsonGet<Record<string, unknown>>(cacheKey);
      if (cached) return res.json(cached);
      const dirtyTruth = await detectDirtyTruth(prisma, canonicalSymbol);
      const baseBull = `${ticker} keeps compounding through resilient cashflow, disciplined capital returns, and product ecosystem lock-in.`;
      const baseBear = `${ticker} faces execution risk in the next product cycle and valuation compression if growth slows further.`;
      const userId = tryGetAuthenticatedUserId(req);
      const tier = await resolveUserTier(req, prisma);
      const aiCatch = await generateCatchAi(
        {
          ticker,
          dirtyTruth: dirtyTruth?.one_liner ?? null,
          bullSummary: baseBull,
          bearSummary: baseBear,
          premortemContext: "Earnings miss + valuation de-rating + concentration risk",
        },
        {
          userId,
          plan: tier,
          endpoint: getRequestPath(req),
          symbol: ticker,
        },
      );

      const payload = {
        ticker,
        bull_case: {
          title: "BULL CASE",
          narrative: aiCatch.bullRefinement || baseBull,
          supporting_facts: [{ fact: "Stable operating margin and recurring demand profile", source: "financial statements" }],
        },
        bear_case: {
          title: "BEAR CASE",
          narrative: aiCatch.bearRefinement || baseBear,
          supporting_facts: [{ fact: "Premium multiple leaves less room for misses", source: "market valuation" }],
        },
        dirty_truth: dirtyTruth
          ? {
              ...dirtyTruth,
              one_liner: aiCatch.dirtyTruthRefinement || dirtyTruth.one_liner,
            }
          : null,
        pre_mortem_context: {
          auto_filled_prompts: [
            aiCatch.premortem || "What if next earnings show another growth deceleration?",
            "What if valuation compresses by 20% over 12 months while liquidity tightens?",
            "What if concentration risk in this sector increases drawdown?",
          ],
        },
        final_actions: [
          { action: "buy", price: 0, sizing: "personalized" },
          { action: "pass", reasoning: "Wait for a lower-risk entry zone." },
          { action: "mirror_trade", description: "Share this thesis with the community." },
        ],
      };
      await cacheJsonSet(cacheKey, payload, REDIS_TTL_SEC.PREMIUM_CATCH);
      res.json(payload);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
