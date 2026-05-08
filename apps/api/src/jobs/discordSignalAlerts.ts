import { Queue, Worker } from "bullmq";
import pino from "pino";
import { getDiscordSignalAlertDispatcher } from "../integrations/discordWebhook";
import { getCacheRedis } from "../redis";

export const DISCORD_SIGNAL_ALERTS_QUEUE_NAME = "discord-signal-alerts";
export const DISCORD_SIGNAL_ALERTS_DLQ_NAME = "discord-signal-alerts-dlq";
const DISPATCH_JOB_NAME = "discord:signal:dispatch";
const FLUSH_BATCH_JOB_NAME = "discord:signal:flush-batches";

export interface DiscordSignalAlertJobInput {
  ticker: string;
  signal: string;
  score: number;
  brief: string;
  confidence?: number;
  timeframe?: string;
  setup?: string;
  entry?: number;
  stopLoss?: number;
  takeProfit?: number;
  logicalChannel?: string;
  marketRegime?: string;
  regimeConfidence?: number;
  playbookAction?: string;
  signalDna?: string;
  narrativeHeadline?: string;
  narrativeBody?: string;
  narrativeRisk?: string;
  narrativeConfidence?: "HIGH" | "MEDIUM" | "LOW";
}

const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "discord_signal_alerts_job" },
});

export function registerDiscordSignalAlerts(): { queue: Queue; worker: Worker; dlqQueue: Queue } {
  const queueConnection = getCacheRedis();
  const workerConnection = getCacheRedis();
  const queue = new Queue(DISCORD_SIGNAL_ALERTS_QUEUE_NAME, {
    connection: queueConnection,
    defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 2000 } },
  });
  const dlqQueue = new Queue(DISCORD_SIGNAL_ALERTS_DLQ_NAME, { connection: queueConnection });

  const worker = new Worker(
    DISCORD_SIGNAL_ALERTS_QUEUE_NAME,
    async (job) => {
      if (job.name === FLUSH_BATCH_JOB_NAME) {
        await getDiscordSignalAlertDispatcher().flushAllBatches();
        return { flushedAt: new Date().toISOString() };
      }
      const input = job.data as DiscordSignalAlertJobInput;
      await getDiscordSignalAlertDispatcher().dispatchSignalAlert({
        ticker: input.ticker,
        signal: input.signal,
        score: input.score,
        brief: input.brief,
        meta: {
          confidence: input.confidence,
          timeframe: input.timeframe,
          setup: input.setup,
          entry: input.entry,
          stopLoss: input.stopLoss,
          takeProfit: input.takeProfit,
          logicalChannel: input.logicalChannel,
          marketRegime: input.marketRegime,
          regimeConfidence: input.regimeConfidence,
          playbookAction: input.playbookAction,
          signalDna: input.signalDna,
          narrativeHeadline: input.narrativeHeadline,
          narrativeBody: input.narrativeBody,
          narrativeRisk: input.narrativeRisk,
          narrativeConfidence: input.narrativeConfidence,
        },
      });
      return { dispatchedAt: new Date().toISOString(), ticker: input.ticker, signal: input.signal };
    },
    { connection: workerConnection },
  );

  worker.on("failed", async (job, err) => {
    logger.error({
      msg: "discord_signal_alert_job_failed",
      jobId: job?.id,
      jobName: job?.name,
      err: err instanceof Error ? err.message : String(err),
    });
    if (!job || job.name === FLUSH_BATCH_JOB_NAME) return;
    await dlqQueue.add("discord:signal:failed", {
      input: job.data,
      err: err instanceof Error ? err.message : String(err),
      failedAt: new Date().toISOString(),
    });
  });

  return { queue, worker, dlqQueue };
}

export async function enqueueDiscordSignalAlert(queue: Queue, input: DiscordSignalAlertJobInput): Promise<void> {
  await queue.add(DISPATCH_JOB_NAME, input);
}

export async function scheduleDiscordBatchFlush(queue: Queue): Promise<void> {
  await queue.add(
    FLUSH_BATCH_JOB_NAME,
    {},
    {
      repeat: { every: 60 * 1000 },
      jobId: "discord-signal-flush-every-minute",
    },
  );
}
