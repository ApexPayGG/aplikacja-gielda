import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";

type TrendParam = "rising" | "stable" | "falling";
type SortBy = "score" | "yield" | "growth";

interface ScreenerRow {
  ticker: string;
  exchange: string | null;
  score: number | null;
  dy: number | null;
  payout_ratio: number | null;
  years_consecutive: number;
  trend: TrendParam | null;
  sector: string | null;
  logo: string | null;
  market_cap: number | null;
}

function parseNumberParam(value: unknown): number | null | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseTrend(value: unknown): TrendParam | undefined {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "rising" || v === "stable" || v === "falling") return v;
  return undefined;
}

function parseSortBy(value: unknown): SortBy | null {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "score";
  if (v === "yield") return "yield";
  if (v === "growth") return "growth";
  if (v === "score") return "score";
  return null;
}

function normalizeTrendFromDb(value: string | null | undefined): TrendParam | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (v === "up") return "rising";
  if (v === "down") return "falling";
  if (v === "stable") return "stable";
  return null;
}

function consecutiveYearsCount(yearsAsc: number[]): number {
  if (yearsAsc.length === 0) return 0;
  let streak = 1;
  let best = 1;
  for (let i = 1; i < yearsAsc.length; i += 1) {
    if ((yearsAsc[i] ?? 0) === (yearsAsc[i - 1] ?? 0) + 1) {
      streak += 1;
    } else if (yearsAsc[i] !== yearsAsc[i - 1]) {
      streak = 1;
    }
    if (streak > best) best = streak;
  }
  return best;
}

function computeRecentCuts(yearlyAmountsAsc: Array<{ year: number; amount: number }>): number {
  const sorted = yearlyAmountsAsc.slice().sort((a, b) => a.year - b.year);
  const last5 = sorted.slice(-5);
  let cuts = 0;
  for (let i = 1; i < last5.length; i += 1) {
    if ((last5[i]?.amount ?? 0) < (last5[i - 1]?.amount ?? 0)) cuts += 1;
  }
  return cuts;
}

function computeTrend(yearlyAmountsAsc: Array<{ year: number; amount: number }>): TrendParam {
  if (yearlyAmountsAsc.length < 3) return "stable";
  const sorted = yearlyAmountsAsc.slice().sort((a, b) => a.year - b.year);
  const last = sorted[sorted.length - 1]?.amount ?? 0;
  const prev = sorted[sorted.length - 2]?.amount ?? 0;
  const prev2 = sorted[sorted.length - 3]?.amount ?? 0;
  if (last > prev && prev >= prev2) return "rising";
  if (last < prev && prev <= prev2) return "falling";
  return "stable";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

async function calculateDividendHealthSafe(input: {
  years_consecutive: number;
  recent_cuts: number;
  trend: TrendParam;
  payout_ratio: number;
  dividend_yield: number;
  sector_avg_yield: number;
  cagr_5y: number;
}): Promise<{ score: number; breakdown: Record<string, unknown> }> {
  try {
    const module = (await import("../../../../packages/dividends/src/scoring")) as {
      calculateDividendHealth?: (i: typeof input) => { score: number; breakdown: Record<string, unknown> };
    };
    if (module.calculateDividendHealth) {
      return module.calculateDividendHealth(input);
    }
  } catch {
    // fallback below
  }
  const continuity = input.recent_cuts <= 0 ? 100 : input.recent_cuts === 1 ? 70 : 30;
  const trend = input.trend === "rising" ? 100 : input.trend === "stable" ? 80 : 40;
  const safety =
    input.payout_ratio < 60 ? 100 : input.payout_ratio <= 75 ? 80 : input.payout_ratio <= 90 ? 50 : 20;
  const yieldDiff = input.dividend_yield - input.sector_avg_yield;
  const yieldScore = yieldDiff >= 0 ? 100 : yieldDiff >= -1 ? 80 : yieldDiff >= -3 ? 60 : 40;
  const growth = input.cagr_5y > 8 ? 100 : input.cagr_5y >= 5 ? 80 : input.cagr_5y >= 2 ? 60 : 40;
  const score = Math.round(continuity * 0.25 + trend * 0.25 + safety * 0.25 + yieldScore * 0.15 + growth * 0.1);
  return {
    score,
    breakdown: {
      continuity,
      trend,
      safety,
      yield: yieldScore,
      growth,
      payout_ratio: input.payout_ratio,
      cagr_5y: input.cagr_5y,
      reasoning: `Score ${score} bo: continuity ${continuity}, trend ${trend}, safety ${safety}, yield ${yieldScore}, growth ${growth}`,
    },
  };
}

export function createDividendsRouter(): Router {
  const router = Router();

  router.get("/api/dividends/screener", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dyMin = parseNumberParam(req.query.dy_min);
      const dyMax = parseNumberParam(req.query.dy_max);
      const yearsMin = parseNumberParam(req.query.years_min);
      const payoutMax = parseNumberParam(req.query.payout_max);
      const trend = parseTrend(req.query.trend);
      const sector = String(req.query.sector ?? "").trim();
      const exchange = String(req.query.exchange ?? "").trim().toUpperCase();
      const sortBy = parseSortBy(req.query.sort_by);

      if (dyMin === null || dyMax === null || yearsMin === null || payoutMax === null) {
        res.status(400).json({ error: "Invalid number in query params" });
        return;
      }

      if (req.query.trend !== undefined && trend === undefined) {
        res.status(400).json({ error: "Invalid trend. Allowed: rising | stable | falling" });
        return;
      }
      if (req.query.sort_by !== undefined && sortBy === null) {
        res.status(400).json({ error: "Invalid sort_by. Allowed: score | yield | growth" });
        return;
      }

      const [companies, signals, dividends, histories, intelligence, sustainability] = await Promise.all([
        prisma.company.findMany({
          select: { symbol: true, sector: true, logoUrl: true },
        }),
        prisma.signal.findMany({
          orderBy: [{ ticker: "asc" }, { created_at: "desc" }],
          select: { ticker: true, exchange: true, score: true, created_at: true },
        }),
        prisma.dividend.findMany({
          orderBy: [{ symbol: "asc" }, { exDate: "desc" }],
          select: { symbol: true, yield: true },
        }),
        prisma.dividendHistory.findMany({
          orderBy: [{ symbol: "asc" }, { year: "asc" }],
          select: { symbol: true, year: true, cagr5Y: true },
        }),
        prisma.dividendIntelligence.findMany({
          select: { symbol: true, trendDirection: true },
        }),
        prisma.dividendSustainabilityScore.findMany({
          select: { symbol: true, payoutRatio: true },
        }),
      ]);

      const byCompany = new Map(companies.map((c) => [c.symbol, c]));
      const byLatestSignal = new Map<string, { exchange: string; score: number | null }>();
      for (const s of signals) {
        if (!byLatestSignal.has(s.ticker)) {
          byLatestSignal.set(s.ticker, { exchange: s.exchange, score: s.score ?? null });
        }
      }
      const byLatestYield = new Map<string, number | null>();
      for (const d of dividends) {
        if (!byLatestYield.has(d.symbol)) {
          byLatestYield.set(d.symbol, d.yield ?? null);
        }
      }
      const byYears = new Map<string, number[]>();
      const byGrowth = new Map<string, number | null>();
      for (const h of histories) {
        const list = byYears.get(h.symbol) ?? [];
        list.push(h.year);
        byYears.set(h.symbol, list);
        byGrowth.set(h.symbol, h.cagr5Y ?? byGrowth.get(h.symbol) ?? null);
      }
      const byTrend = new Map(intelligence.map((i) => [i.symbol, normalizeTrendFromDb(String(i.trendDirection))]));
      const byPayout = new Map(sustainability.map((s) => [s.symbol, s.payoutRatio ?? null]));

      const rows: ScreenerRow[] = [];
      for (const [ticker, company] of byCompany) {
        const latestSignal = byLatestSignal.get(ticker);
        const dy = byLatestYield.get(ticker) ?? null;
        const payout = byPayout.get(ticker) ?? null;
        const yearsConsecutive = consecutiveYearsCount((byYears.get(ticker) ?? []).sort((a, b) => a - b));
        const trendRow = byTrend.get(ticker) ?? null;

        rows.push({
          ticker,
          exchange: latestSignal?.exchange ?? null,
          score: latestSignal?.score ?? null,
          dy,
          payout_ratio: payout,
          years_consecutive: yearsConsecutive,
          trend: trendRow,
          sector: company.sector ?? null,
          logo: company.logoUrl ?? null,
          market_cap: null,
        });
      }

      const filtered = rows.filter((r) => {
        if (dyMin !== undefined && (r.dy === null || r.dy < dyMin)) return false;
        if (dyMax !== undefined && (r.dy === null || r.dy > dyMax)) return false;
        if (yearsMin !== undefined && r.years_consecutive < yearsMin) return false;
        if (payoutMax !== undefined && (r.payout_ratio === null || r.payout_ratio > payoutMax)) return false;
        if (trend !== undefined && r.trend !== trend) return false;
        if (sector && r.sector !== sector) return false;
        if (exchange && r.exchange !== exchange) return false;
        return true;
      });

      filtered.sort((a, b) => {
        if (sortBy === "yield") return (b.dy ?? -Infinity) - (a.dy ?? -Infinity);
        if (sortBy === "growth") return (byGrowth.get(b.ticker) ?? -Infinity) - (byGrowth.get(a.ticker) ?? -Infinity);
        return (b.score ?? -Infinity) - (a.score ?? -Infinity);
      });

      const results = filtered.slice(0, 50).map((r) => ({
        ticker: r.ticker,
        exchange: r.exchange,
        dy: r.dy,
        payout_ratio: r.payout_ratio,
        years_consecutive: r.years_consecutive,
        trend: r.trend,
        sector: r.sector,
        logo: r.logo,
        market_cap: r.market_cap,
        score: r.score,
      }));

      res.json({
        results,
        count: results.length,
        filters: {
          dy_min: dyMin ?? null,
          dy_max: dyMax ?? null,
          years_min: yearsMin ?? null,
          payout_max: payoutMax ?? null,
          trend: trend ?? null,
          sector: sector || null,
          exchange: exchange || null,
          sort_by: sortBy,
        },
      });
    } catch (e) {
      next(e);
    }
  });

  router.get("/api/dividends/:ticker", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ticker = String(req.params.ticker ?? "").trim().toUpperCase();
      if (!ticker) {
        res.status(400).json({ error: "Missing ticker" });
        return;
      }

      const company = await prisma.company.findUnique({
        where: { symbol: ticker },
        select: { symbol: true, name: true, sector: true, logoUrl: true },
      });
      if (!company) {
        res.status(404).json({ error: "Ticker not found" });
        return;
      }

      const [dividends, histories, latestSignal, intelligence, sustainability, fundamentals] = await Promise.all([
        prisma.dividend.findMany({
          where: { symbol: ticker },
          orderBy: { exDate: "desc" },
          take: 120,
          select: { exDate: true, payDate: true, amount: true, yield: true },
        }),
        prisma.dividendHistory.findMany({
          where: { symbol: ticker },
          orderBy: { year: "desc" },
          select: { year: true, totalAmount: true, cagr5Y: true },
        }),
        prisma.signal.findFirst({
          where: { ticker },
          orderBy: { created_at: "desc" },
          select: { exchange: true, score: true },
        }),
        prisma.dividendIntelligence.findUnique({
          where: { symbol: ticker },
          select: { trendDirection: true, safetyReason: true },
        }),
        prisma.dividendSustainabilityScore.findUnique({
          where: { symbol: ticker },
          select: { payoutRatio: true },
        }),
        prisma.fundamental.findMany({
          where: { symbol: ticker, metric: { in: ["eps_ttm", "eps", "fcf"] } },
          orderBy: { lastUpdated: "desc" },
          select: { metric: true, value: true },
        }),
      ]);

      const yearly = histories
        .map((h) => ({ year: h.year, amount: h.totalAmount }))
        .sort((a, b) => a.year - b.year);
      const yearsConsecutive = consecutiveYearsCount(yearly.map((y) => y.year));
      const recentCuts = computeRecentCuts(yearly);
      const trend = computeTrend(yearly);
      const cagr5y = histories[0]?.cagr5Y ?? 0;
      const currentAmount = dividends[0]?.amount ?? 0;
      const currentYield = dividends[0]?.yield ?? null;
      const sectorYieldAvg = average(dividends.map((d) => d.yield).filter((y): y is number => y !== null));

      const epsRow = fundamentals.find((f) => f.metric === "eps_ttm") ?? fundamentals.find((f) => f.metric === "eps");
      const epsTtm = epsRow ? Number(epsRow.value) : null;
      const fcfRow = fundamentals.find((f) => f.metric === "fcf");
      const _fcf = fcfRow ? Number(fcfRow.value) : null;
      const payoutRatio =
        epsTtm !== null && epsTtm > 0 ? Math.max(0, Math.min(100, Number(((currentAmount / epsTtm) * 100).toFixed(2)))) : null;

      const health = await calculateDividendHealthSafe({
        years_consecutive: yearsConsecutive,
        recent_cuts: recentCuts,
        trend,
        payout_ratio: payoutRatio ?? sustainability?.payoutRatio ?? 0,
        dividend_yield: currentYield ?? 0,
        sector_avg_yield: sectorYieldAvg,
        cagr_5y: cagr5y ?? 0,
      });

      const history = dividends
        .map((d) => ({
          year: d.exDate.getUTCFullYear(),
          amount: d.amount,
          ex_date: d.exDate.toISOString(),
          payment_date: d.payDate.toISOString(),
          dy: d.yield ?? null,
          payout: payoutRatio,
        }))
        .sort((a, b) => b.year - a.year);

      const now = new Date();
      const nextEx = dividends
        .filter((d) => d.exDate > now)
        .sort((a, b) => a.exDate.getTime() - b.exDate.getTime())[0];
      const nextPay = dividends
        .filter((d) => d.payDate > now)
        .sort((a, b) => a.payDate.getTime() - b.payDate.getTime())[0];

      res.json({
        ticker,
        exchange: latestSignal?.exchange ?? null,
        company: {
          name: company.name,
          sector: company.sector,
          logo: company.logoUrl,
          market_cap: null,
        },
        dividend: {
          current_yield: currentYield,
          current_amount: currentAmount,
          payout_ratio: payoutRatio,
          years_consecutive: yearsConsecutive,
          cagr_5y: cagr5y,
          trend,
        },
        health_score: health.score,
        health_breakdown: health.breakdown,
        history,
        next_ex_date: nextEx ? nextEx.exDate.toISOString() : null,
        next_payment_date: nextPay ? nextPay.payDate.toISOString() : null,
        ai_assessment: intelligence?.safetyReason ?? null,
      });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
