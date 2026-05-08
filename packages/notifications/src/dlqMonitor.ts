import { Queue, Worker } from "bullmq";

export interface DlqMonitorDeps {
  redisClient: unknown;
  db: {
    signal: {
      findUnique: (args: { where: { id: string } }) => Promise<{
        id: string;
        ticker: string;
        pattern_type: string;
        score: number | null;
        brief_en: string | null;
        confidence: number;
      } | null>;
    };
    dlqEvent: {
      create: (args: {
        data: { jobId: string; ticker: string; attempt: number; status: string };
      }) => Promise<unknown>;
    };
  };
  enqueueDiscordSignalAlert: (
    input: {
      ticker: string;
      signal: string;
      score: number;
      brief: string;
      confidence?: number;
      timeframe?: string;
      setup?: string;
      logicalChannel?: string;
      retryAttempt?: number;
    },
    opts?: { delay?: number },
  ) => Promise<void>;
  processSignalQueueName: string;
  processSignalDlqQueueName: string;
  monitorQueueName?: string;
  monitorIntervalMs?: number;
}

const DLQ_MONITOR_JOB_NAME = "dlqMonitor";
const BACKOFF_MINUTES = [30, 60, 120];

async function sendCriticalWebhookAlert(failedCount: number): Promise<void> {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL?.trim();
  if (!webhookUrl) return;
  const payload = {
    embeds: [
      {
        title: `⚠️ DLQ Alert: ${failedCount} nieudanych alertów w kolejce`,
        description: "DLQ monitor wykrył krytyczną liczbę nieudanych alertów Discord.",
        color: 0xef4444,
        timestamp: new Date().toISOString(),
      },
    ],
  };
  await fetch(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function writeDlqEvent(
  deps: DlqMonitorDeps,
  payload: { jobId: string; ticker: string; attempt: number; status: string },
): Promise<void> {
  await deps.db.dlqEvent.create({
    data: {
      jobId: payload.jobId,
      ticker: payload.ticker,
      attempt: payload.attempt,
      status: payload.status,
    },
  });
}

export function startDlqMonitor(deps: DlqMonitorDeps): { queue: Queue; worker: Worker } {
  const monitorQueueName = deps.monitorQueueName ?? "dlq-monitor";
  const intervalMs = deps.monitorIntervalMs ?? 30 * 60 * 1000;
  const queue = new Queue(monitorQueueName, { connection: deps.redisClient as never });
  const processQueue = new Queue(deps.processSignalQueueName, { connection: deps.redisClient as never });
  const processDlqQueue = new Queue(deps.processSignalDlqQueueName, { connection: deps.redisClient as never });

  const worker = new Worker(
    monitorQueueName,
    async () => {
      const failedProcessJobs = await processQueue.getJobs(["failed"], 0, 500);
      if (failedProcessJobs.length > 10) {
        await sendCriticalWebhookAlert(failedProcessJobs.length);
      }

      const dlqJobs = await processDlqQueue.getJobs(["waiting", "failed"], 0, 500);
      const discordFailed = dlqJobs.filter((jobItem: { name: string }) => jobItem.name === "discord:signal:failed");
      for (const job of discordFailed) {
        const data = (job.data ?? {}) as { signalId?: string; ticker?: string; retryAttempt?: number };
        const attempt = Number(data.retryAttempt ?? 0) + 1;
        const ticker = (data.ticker ?? "UNKNOWN").toUpperCase();
        if (attempt > 3) {
          await writeDlqEvent(deps, {
            jobId: String(job.id ?? "unknown"),
            ticker,
            attempt: 3,
            status: "retry_exhausted",
          });
          await job.remove().catch(() => undefined);
          continue;
        }

        const signalId = data.signalId;
        if (!signalId) {
          await writeDlqEvent(deps, {
            jobId: String(job.id ?? "unknown"),
            ticker,
            attempt,
            status: "missing_signal_id",
          });
          await job.remove().catch(() => undefined);
          continue;
        }

        const signal = await deps.db.signal.findUnique({ where: { id: signalId } });
        if (!signal) {
          await writeDlqEvent(deps, {
            jobId: String(job.id ?? "unknown"),
            ticker,
            attempt,
            status: "signal_not_found",
          });
          await job.remove().catch(() => undefined);
          continue;
        }

        const delayMs = (BACKOFF_MINUTES[attempt - 1] ?? 120) * 60 * 1000;
        await deps.enqueueDiscordSignalAlert(
          {
            ticker: signal.ticker,
            signal: signal.pattern_type,
            score: signal.score ?? 0,
            brief: signal.brief_en ?? "",
            confidence: signal.confidence,
            setup: signal.pattern_type,
            timeframe: "1D",
            logicalChannel: signal.pattern_type,
            retryAttempt: attempt,
          },
          { delay: delayMs },
        );
        await writeDlqEvent(deps, {
          jobId: String(job.id ?? "unknown"),
          ticker: signal.ticker,
          attempt,
          status: `retry_scheduled_${BACKOFF_MINUTES[attempt - 1] ?? 120}m`,
        });
        await job.remove().catch(() => undefined);
      }
    },
    { connection: deps.redisClient as never },
  );

  void queue.add(
    DLQ_MONITOR_JOB_NAME,
    {},
    {
      repeat: { every: intervalMs },
      jobId: "dlq-monitor-every-30-min",
    },
  );

  return { queue, worker };
}
