import { Queue, Worker } from "bullmq";
import type { Redis } from "ioredis";
import pino from "pino";
import { prisma } from "../db/index";
import { getCacheRedis } from "../redis";

export const DIVIDEND_ALERTS_QUEUE_NAME = "dividend-alerts";
export const DIVIDEND_ALERTS_JOB_NAME = "dividend:alerts";
const ALERT_QUEUE_STORAGE_NAME = "alert-push";

interface DividendRow {
  id: string;
  symbol: string;
  exDate: Date;
  payDate: Date;
  amount: number;
}

export interface DividendAlertsResult {
  exDateAlertsQueued: number;
  changeAlertsQueued: number;
  totalAlertsQueued: number;
}

export interface DividendAlertsDeps {
  db: typeof prisma;
  alertQueue: Pick<Queue, "add">;
  idempotencyStore: Pick<ReturnType<typeof getCacheRedis>, "set" | "get">;
  findUsersForTicker: (ticker: string) => Promise<Array<Record<string, unknown>>>;
}

export const dividendAlertsLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "dividend_alerts_job" },
});

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

async function defaultFindUsersForTicker(ticker: string): Promise<Array<Record<string, unknown>>> {
  const dbMaybe = prisma as unknown as {
    user?: {
      findMany?: (args?: unknown) => Promise<Array<Record<string, unknown>>>;
    };
  };
  if (!dbMaybe.user?.findMany) return [];
  const users = await dbMaybe.user.findMany({});
  return users.filter((u) => {
    const wl = (u.watchlist ?? u.watchedTickers ?? []) as unknown;
    if (!Array.isArray(wl)) return false;
    return wl.map((x) => String(x).toUpperCase()).includes(ticker.toUpperCase());
  });
}

async function buildDefaultDeps(): Promise<DividendAlertsDeps> {
  return {
    db: prisma,
    alertQueue: new Queue(ALERT_QUEUE_STORAGE_NAME, { connection: getCacheRedis() }),
    idempotencyStore: getCacheRedis(),
    findUsersForTicker: defaultFindUsersForTicker,
  };
}

async function markAlertedOnce(
  store: Pick<ReturnType<typeof getCacheRedis>, "set" | "get">,
  key: string,
): Promise<boolean> {
  const existing = await store.get(key);
  if (existing) return false;
  // No `alerted` column in current Dividend schema; Redis key acts as alert marker/idempotency guard.
  await store.set(key, "1", "EX", 60 * 60 * 24 * 30);
  return true;
}

export async function runDividendAlertsJob(depsInput?: Partial<DividendAlertsDeps>): Promise<DividendAlertsResult> {
  const deps: DividendAlertsDeps = depsInput
    ? ({
        db: depsInput.db ?? prisma,
        alertQueue:
          depsInput.alertQueue ??
          (({ add: async () => ({}) } as unknown) as Pick<Queue, "add">),
        idempotencyStore:
          depsInput.idempotencyStore ??
          ({
            get: async () => null,
            set: async () => "OK",
          } as Pick<ReturnType<typeof getCacheRedis>, "set" | "get">),
        findUsersForTicker: depsInput.findUsersForTicker ?? defaultFindUsersForTicker,
      } as DividendAlertsDeps)
    : await buildDefaultDeps();
  const result: DividendAlertsResult = {
    exDateAlertsQueued: 0,
    changeAlertsQueued: 0,
    totalAlertsQueued: 0,
  };

  dividendAlertsLogger.info({ msg: "dividend_alerts_started" });

  const now = new Date();
  const start = addDays(now, 1);
  const end = addDays(now, 14);

  // 1) Ex-date alerts for next 14 days
  const upcoming = (await deps.db.dividend.findMany({
    where: {
      exDate: { gte: start, lte: end },
    },
    select: { id: true, symbol: true, exDate: true, payDate: true, amount: true },
    orderBy: { exDate: "asc" },
  })) as DividendRow[];

  for (const d of upcoming) {
    const markKey = `alerted:dividend:ex-date:${d.id}:${ymd(d.exDate)}`;
    const shouldSend = await markAlertedOnce(deps.idempotencyStore, markKey);
    if (!shouldSend) continue;
    const users = await deps.findUsersForTicker(d.symbol);
    for (const user of users) {
      await deps.alertQueue.add("alert:push", {
        user,
        type: "dividend:ex-date",
        ticker: d.symbol,
        ex_date: d.exDate.toISOString(),
        amount: d.amount,
        days_until: 14,
      });
      result.exDateAlertsQueued += 1;
      result.totalAlertsQueued += 1;
    }
  }

  // 2) Amount-change alerts (>10% YoY around same date ±30 days)
  const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
  const currYearDividends = (await deps.db.dividend.findMany({
    where: { exDate: { gte: startOfYear } },
    select: { id: true, symbol: true, exDate: true, payDate: true, amount: true },
    orderBy: { exDate: "desc" },
  })) as DividendRow[];

  for (const curr of currYearDividends) {
    const lastYearDate = new Date(curr.exDate);
    lastYearDate.setUTCFullYear(lastYearDate.getUTCFullYear() - 1);
    const winStart = addDays(lastYearDate, -30);
    const winEnd = addDays(lastYearDate, 30);

    const candidates = (await deps.db.dividend.findMany({
      where: {
        symbol: curr.symbol,
        exDate: { gte: winStart, lte: winEnd },
      },
      select: { id: true, symbol: true, exDate: true, payDate: true, amount: true },
      orderBy: { exDate: "desc" },
      take: 1,
    })) as DividendRow[];
    const prev = candidates[0];
    if (!prev || prev.amount === 0) continue;
    const changePct = ((curr.amount - prev.amount) / prev.amount) * 100;
    if (Math.abs(changePct) <= 10) continue;

    const markKey = `alerted:dividend:change:${curr.id}:${prev.id}`;
    const shouldSend = await markAlertedOnce(deps.idempotencyStore, markKey);
    if (!shouldSend) continue;
    const users = await deps.findUsersForTicker(curr.symbol);
    for (const user of users) {
      await deps.alertQueue.add("alert:push", {
        user,
        type: "dividend:change",
        ticker: curr.symbol,
        old_amount: prev.amount,
        new_amount: curr.amount,
        change_pct: Number(changePct.toFixed(2)),
      });
      result.changeAlertsQueued += 1;
      result.totalAlertsQueued += 1;
    }
  }

  dividendAlertsLogger.info({
    msg: "dividend_alerts_finished",
    exDateAlertsQueued: result.exDateAlertsQueued,
    changeAlertsQueued: result.changeAlertsQueued,
    totalAlertsQueued: result.totalAlertsQueued,
  });
  return result;
}

export function registerDividendAlerts(
  queueConnection: Redis,
  workerConnection: Redis,
): { queue: Queue; worker: Worker; alertQueue: Queue } {
  const queue = new Queue(DIVIDEND_ALERTS_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 4000 },
    },
  });
  const alertQueue = new Queue(ALERT_QUEUE_STORAGE_NAME, { connection: queueConnection });
  const worker = new Worker(
    DIVIDEND_ALERTS_QUEUE_NAME,
    async (job) => {
      dividendAlertsLogger.info({ msg: "start", jobId: job.id, name: job.name });
      const out = await runDividendAlertsJob({ alertQueue, idempotencyStore: getCacheRedis() });
      dividendAlertsLogger.info({ msg: "end", jobId: job.id, ...out });
      return out;
    },
    { connection: workerConnection },
  );

  worker.on("failed", (job, err) => {
    dividendAlertsLogger.error({
      msg: "worker_job_failed",
      jobId: job?.id,
      err: err instanceof Error ? err.message : String(err),
    });
  });

  return { queue, worker, alertQueue };
}

export async function scheduleDailyDividendAlertsJob(queue: Queue): Promise<void> {
  await queue.add(
    DIVIDEND_ALERTS_JOB_NAME,
    {},
    {
      repeat: {
        pattern: "0 6 * * *",
        tz: "Etc/UTC",
      },
      jobId: "daily-dividend-alerts-6am-utc",
    },
  );
}
