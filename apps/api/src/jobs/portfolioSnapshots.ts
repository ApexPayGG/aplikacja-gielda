import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import pino from "pino";
import { prisma } from "../db/index";
import { discordBot } from "../integrations/discord";
import { PortfolioService } from "../services/portfolioService";

export const PORTFOLIO_SNAPSHOTS_QUEUE_NAME = "portfolio-snapshots";
export const PORTFOLIO_SNAPSHOTS_JOB_NAME = "portfolio:snapshots";

export interface PortfolioSnapshotsResult {
  users_processed: number;
  snapshots_created: number;
  avg_portfolio_value: number;
  avg_pnl_pct: number;
  total_users_tracked: number;
}

interface PortfolioServiceLike {
  takeSnapshot: (userId: string) => Promise<{ total_value: number; pnl_pct: number; date: Date }>;
}

export interface PortfolioSnapshotsDeps {
  db: typeof prisma;
  portfolioService: PortfolioServiceLike;
}

export const portfolioSnapshotsLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "portfolio_snapshots_job" },
});

export async function runPortfolioSnapshotsJob(
  depsInput?: Partial<PortfolioSnapshotsDeps>,
): Promise<PortfolioSnapshotsResult> {
  const deps: PortfolioSnapshotsDeps = {
    db: depsInput?.db ?? prisma,
    portfolioService: depsInput?.portfolioService ?? new PortfolioService(),
  };

  const rows = await deps.db.virtualTrade.findMany({
    select: { userId: true },
    distinct: ["userId"],
  });
  const userIds = [...new Set(rows.map((r) => r.userId).filter(Boolean))];

  portfolioSnapshotsLogger.info({
    msg: "portfolio_snapshots_started",
    totalUsersTracked: userIds.length,
  });

  const snapshots: Array<{ total_value: number; pnl_pct: number }> = [];
  let processed = 0;

  for (const userId of userIds) {
    const snap = await deps.portfolioService.takeSnapshot(userId);
    processed += 1;
    snapshots.push({
      total_value: Number(snap.total_value ?? 0),
      pnl_pct: Number(snap.pnl_pct ?? 0),
    });
    portfolioSnapshotsLogger.info({
      msg: "portfolio_snapshot_user_processed",
      userId,
      progress: `${processed}/${userIds.length}`,
    });
  }

  const avgPortfolioValue =
    snapshots.length > 0
      ? snapshots.reduce((acc, s) => acc + s.total_value, 0) / snapshots.length
      : 0;
  const avgPnlPct =
    snapshots.length > 0 ? snapshots.reduce((acc, s) => acc + s.pnl_pct, 0) / snapshots.length : 0;

  const result: PortfolioSnapshotsResult = {
    users_processed: processed,
    snapshots_created: snapshots.length,
    avg_portfolio_value: Number(avgPortfolioValue.toFixed(6)),
    avg_pnl_pct: Number(avgPnlPct.toFixed(6)),
    total_users_tracked: userIds.length,
  };

  // Post weekly results to Discord (only on Thursdays)
  const today = new Date();
  if (today.getDay() === 4) {
    const weekStart = new Date(today);
    weekStart.setUTCDate(weekStart.getUTCDate() - 7);
    const dbMaybe = deps.db as unknown as {
      signal?: {
        findMany?: (args: unknown) => Promise<Array<{ win_rate: number | null; avg_return_10d: number | null }>>;
      };
    };
    const weeklySignals = dbMaybe.signal?.findMany
      ? await dbMaybe.signal.findMany({
          where: { created_at: { gte: weekStart } },
          select: { win_rate: true, avg_return_10d: true },
        })
      : [];
    const totalSignalsWeek = weeklySignals.length;
    const winRateWeek =
      totalSignalsWeek > 0
        ? weeklySignals.reduce((acc, s) => acc + Number(s.win_rate ?? 0), 0) / totalSignalsWeek
        : 0;
    const avgReturnWeek =
      totalSignalsWeek > 0
        ? weeklySignals.reduce((acc, s) => acc + Number(s.avg_return_10d ?? 0), 0) / totalSignalsWeek
        : 0;
    await discordBot
      .sendWeeklyResults({
        total_signals: totalSignalsWeek,
        win_rate: Number(winRateWeek.toFixed(2)),
        avg_return: Number(avgReturnWeek.toFixed(2)),
      })
      .catch((err) => portfolioSnapshotsLogger.error({ err }, "Discord weekly failed"));
  }

  portfolioSnapshotsLogger.info({
    msg: "portfolio_snapshots_finished",
    ...result,
  });

  return result;
}

export function registerPortfolioSnapshots(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker } {
  const queue = new Queue(PORTFOLIO_SNAPSHOTS_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
    },
  });
  const worker = new Worker(
    PORTFOLIO_SNAPSHOTS_QUEUE_NAME,
    async (job) => {
      portfolioSnapshotsLogger.info({ msg: "start", jobId: job.id, name: job.name });
      const out = await runPortfolioSnapshotsJob();
      portfolioSnapshotsLogger.info({ msg: "end", jobId: job.id, ...out });
      return out;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    portfolioSnapshotsLogger.error({
      msg: "worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker };
}

export async function scheduleDailyPortfolioSnapshotsJob(queue: Queue): Promise<void> {
  await queue.add(
    PORTFOLIO_SNAPSHOTS_JOB_NAME,
    {},
    {
      repeat: {
        pattern: "0 17 * * *",
        tz: "Etc/UTC",
      },
      jobId: "daily-portfolio-snapshots-5pm-utc",
    },
  );
}
