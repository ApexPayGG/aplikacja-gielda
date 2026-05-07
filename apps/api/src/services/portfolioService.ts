import type { PortfolioSnapshot, PrismaClient, TradeSide, VirtualTrade } from "@prisma/client";
import { getCacheRedis } from "../redis";
import { redisKeys } from "../config/redis";
import { prisma } from "../db/index";

type RedisLike = Pick<ReturnType<typeof getCacheRedis>, "get">;

export interface CreateVirtualTradeInput {
  userId: string;
  ticker: string;
  exchange: string;
  side: TradeSide;
  quantity: number;
  price: number;
  signal_id?: string;
  notes?: string;
}

export interface PortfolioCalcResult {
  holdings: Record<string, { qty: number; avg_price: number; current_value: number }>;
  total_value: number;
  realized_pnl: number;
  unrealized_pnl: number;
  total_pnl: number;
  total_pnl_pct: number;
  cash: number;
}

export class PortfolioService {
  private readonly db: PrismaClient;

  private readonly redis: RedisLike;

  constructor(deps?: { db?: PrismaClient; redis?: RedisLike }) {
    this.db = deps?.db ?? (prisma as PrismaClient);
    this.redis = deps?.redis ?? getCacheRedis();
  }

  async createVirtualTrade(input: CreateVirtualTradeInput): Promise<VirtualTrade> {
    return this.db.virtualTrade.create({
      data: {
        userId: input.userId,
        ticker: input.ticker.toUpperCase(),
        exchange: input.exchange.toUpperCase(),
        side: input.side,
        quantity: input.quantity,
        price: input.price,
        signal_id: input.signal_id ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  async calculatePortfolio(userId: string): Promise<PortfolioCalcResult> {
    const trades = await this.db.virtualTrade.findMany({
      where: { userId },
      orderBy: { executed_at: "asc" },
    });

    const lots = new Map<string, { qty: number; avg: number }>();
    let cash = 0;
    let realizedPnl = 0;
    let costOpen = 0;

    for (const t of trades) {
      const ticker = t.ticker.toUpperCase();
      const state = lots.get(ticker) ?? { qty: 0, avg: 0 };
      const qty = Number(t.quantity);
      const px = Number(t.price);

      if (t.side === "BUY") {
        const newQty = state.qty + qty;
        const newAvg = newQty > 0 ? (state.avg * state.qty + px * qty) / newQty : 0;
        lots.set(ticker, { qty: newQty, avg: newAvg });
        cash -= px * qty;
      } else {
        const sold = Math.min(qty, state.qty);
        realizedPnl += (px - state.avg) * sold;
        state.qty = Math.max(0, state.qty - sold);
        if (state.qty === 0) state.avg = 0;
        lots.set(ticker, state);
        cash += px * qty;
      }
    }

    const holdings: PortfolioCalcResult["holdings"] = {};
    let holdingsValue = 0;

    for (const [ticker, state] of lots) {
      if (state.qty <= 0) continue;
      const current = await this.getCurrentPriceFromCache(ticker);
      const currentValue = Number((state.qty * current).toFixed(6));
      holdings[ticker] = {
        qty: Number(state.qty.toFixed(6)),
        avg_price: Number(state.avg.toFixed(6)),
        current_value: currentValue,
      };
      holdingsValue += currentValue;
      costOpen += state.qty * state.avg;
    }

    const unrealizedPnl = holdingsValue - costOpen;
    const totalValue = holdingsValue + cash;
    const totalPnl = realizedPnl + unrealizedPnl;
    const investedBase = Math.max(1, costOpen);

    return {
      holdings,
      total_value: Number(totalValue.toFixed(6)),
      realized_pnl: Number(realizedPnl.toFixed(6)),
      unrealized_pnl: Number(unrealizedPnl.toFixed(6)),
      total_pnl: Number(totalPnl.toFixed(6)),
      total_pnl_pct: Number(((totalPnl / investedBase) * 100).toFixed(6)),
      cash: Number(cash.toFixed(6)),
    };
  }

  async takeSnapshot(userId: string): Promise<PortfolioSnapshot> {
    const p = await this.calculatePortfolio(userId);
    const benchmarkWig = await this.getCurrentPriceFromCache("WIG");
    const benchmarkSp500 = await this.getCurrentPriceFromCache("SP500");
    return this.db.portfolioSnapshot.create({
      data: {
        userId,
        total_value: p.total_value,
        cash: p.cash,
        holdings: p.holdings,
        pnl_daily: 0,
        pnl_total: p.total_pnl,
        pnl_pct: p.total_pnl_pct,
        benchmark_wig: benchmarkWig > 0 ? benchmarkWig : null,
        benchmark_sp500: benchmarkSp500 > 0 ? benchmarkSp500 : null,
      },
    });
  }

  async getPortfolioHistory(userId: string, days = 30): Promise<PortfolioSnapshot[]> {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - Math.max(1, days));
    return this.db.portfolioSnapshot.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "desc" },
    });
  }

  private async getCurrentPriceFromCache(ticker: string): Promise<number> {
    const key = redisKeys.quoteLatest(ticker);
    const raw = await this.redis.get(key);
    if (!raw) return this.getFallbackPriceFromDb(ticker);
    try {
      const parsed = JSON.parse(raw) as { close?: string | number };
      const price = Number(parsed.close ?? 0);
      return Number.isFinite(price) && price > 0 ? price : this.getFallbackPriceFromDb(ticker);
    } catch {
      return this.getFallbackPriceFromDb(ticker);
    }
  }

  private async getFallbackPriceFromDb(ticker: string): Promise<number> {
    const row = await this.db.quote.findFirst({
      where: { symbol: ticker.toUpperCase() },
      orderBy: { timestamp: "desc" },
      select: { close: true },
    });
    const price = Number(row?.close ?? 0);
    return Number.isFinite(price) && price > 0 ? price : 0;
  }
}
