import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import { REDIS_TTL_SEC } from "../config/redis";
import { getCacheRedis } from "../redis";
import { type LiveSetupRankingRow, buildLiveSetupRanking } from "../services/signalMemoryService";

const EXCHANGE_WHITELIST = new Set(["US", "GPW", "NYSE", "NASDAQ"]);

type SignalMemoryCacheStore = Pick<ReturnType<typeof getCacheRedis>, "get" | "set">;

type SignalMemoryRouterDeps = {
  db: typeof prisma;
  cache: SignalMemoryCacheStore;
  rankingBuilder: typeof buildLiveSetupRanking;
};

function watchlistSnapshotKey(exchange: string): string {
  return `signals:watchlist:auto-rotation:${exchange}`;
}

function withDeltas(
  current: LiveSetupRankingRow[],
  previous: Array<{ setup: string; avgLiveScore: number }>,
): Array<LiveSetupRankingRow & { deltaLiveScore: number }> {
  const prevMap = new Map(previous.map((p) => [p.setup, p.avgLiveScore]));
  return current.map((row) => ({
    ...row,
    deltaLiveScore: Number((row.avgLiveScore - (prevMap.get(row.setup) ?? row.avgLiveScore)).toFixed(2)),
  }));
}

function toSigned(value: number): string {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

function buildWhyNow(row: LiveSetupRankingRow & { deltaLiveScore: number }): string[] {
  const reasons = [
    `freshness impact ${toSigned(row.diagnostics.freshnessPenaltyPts)} pts`,
    `volatility impact ${toSigned(row.diagnostics.volatilityPenaltyPts)} pts`,
    `confidence impact ${toSigned(row.diagnostics.confidenceBoostPts)} pts`,
    `edge momentum ${toSigned(row.deltaLiveScore)} pts vs previous snapshot`,
  ];
  return reasons.slice(0, 3);
}

function buildContrarianTrigger(row: LiveSetupRankingRow & { deltaLiveScore: number }): string | null {
  if (row.avgLiveScore >= 75 && row.deltaLiveScore <= -6) return "exhaustion_risk";
  if (row.avgLiveScore <= 58 && row.deltaLiveScore >= 6) return "early_revival";
  return null;
}

function buildPlaybookAction(row: LiveSetupRankingRow & { deltaLiveScore: number }): string {
  if (row.avgLiveScore >= 80 && row.deltaLiveScore >= 0) return "add_on_pullback";
  if (row.deltaLiveScore < -4) return "reduce_risk";
  return "watch_for_confirmation";
}

export function createSignalMemoryRouter(deps?: Partial<SignalMemoryRouterDeps>): Router {
  const db = deps?.db ?? prisma;
  const cache = deps?.cache ?? getCacheRedis();
  const rankingBuilder = deps?.rankingBuilder ?? buildLiveSetupRanking;
  const router = Router();

  router.get("/api/signals/setups/live", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
      const exchangeRaw = String(req.query.exchange ?? "").trim().toUpperCase();
      const exchange = exchangeRaw || undefined;
      if (exchange && !EXCHANGE_WHITELIST.has(exchange)) {
        return res.status(400).json({ error: "Invalid exchange. Allowed: US | GPW | NYSE | NASDAQ" });
      }

      const setups = await rankingBuilder({ exchange, limit }, db);
      res.json({
        generatedAt: new Date().toISOString(),
        exchange: exchange ?? "ALL",
        limit,
        count: setups.length,
        setups,
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/signals/watchlist/auto-rotation", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(20, Math.max(1, parseInt(String(req.query.limit ?? "8"), 10) || 8));
      const exchangeRaw = String(req.query.exchange ?? "").trim().toUpperCase();
      const exchange = exchangeRaw || "ALL";
      if (exchange !== "ALL" && !EXCHANGE_WHITELIST.has(exchange)) {
        return res.status(400).json({ error: "Invalid exchange. Allowed: ALL | US | GPW | NYSE | NASDAQ" });
      }

      const ranking = await rankingBuilder(
        { exchange: exchange === "ALL" ? undefined : exchange, limit },
        db,
      );
      const prevRaw = await cache.get(watchlistSnapshotKey(exchange));
      const previous = prevRaw
        ? ((JSON.parse(prevRaw) as { setups?: Array<{ setup: string; avgLiveScore: number }> }).setups ?? [])
        : [];
      const setups = withDeltas(ranking, previous);
      await cache.set(
        watchlistSnapshotKey(exchange),
        JSON.stringify({
          generatedAt: new Date().toISOString(),
          setups: setups.map((s) => ({ setup: s.setup, avgLiveScore: s.avgLiveScore })),
        }),
        "EX",
        REDIS_TTL_SEC.SCREENER,
      );

      res.json({
        generatedAt: new Date().toISOString(),
        exchange,
        limit,
        count: setups.length,
        rotationWindowMinutes: 15,
        setups: setups.map((row) => ({
          ...row,
          contrarianTrigger: buildContrarianTrigger(row),
          playbookAction: buildPlaybookAction(row),
          whyNow: buildWhyNow(row),
        })),
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
