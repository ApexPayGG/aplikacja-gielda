import { Queue } from "bullmq";
import type IORedis from "ioredis";
import IORedisClient from "ioredis";
import {
  AUTOPILOT_EXECUTION_QUEUE_NAME,
  type AutopilotJobData,
} from "../../workers/autopilot.worker";

export type AutopilotAiVerdict = "BULLISH_BUY" | "BEARISH_SELL" | "HOLD";

export type DispatchAiIntentPayload = {
  userId: string;
  ticker: string;
  aiVerdict: AutopilotAiVerdict;
  currentPrice: number;
  signalSourceId: string;
};

export type DispatchAiIntentResult = {
  queued: boolean;
  jobId?: string;
  reason?: string;
};

const EXECUTE_AUTOPILOT_TRADE_JOB_NAME = "execute-autopilot-trade";

function createAutopilotQueueConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (redisUrl) {
    return new IORedisClient(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
    });
  }

  const host = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  const parsedPort = Number.parseInt(process.env.REDIS_PORT?.trim() || "6379", 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 6379;

  return new IORedisClient({
    host,
    port,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

function mapAiVerdictToSide(verdict: Exclude<AutopilotAiVerdict, "HOLD">): AutopilotJobData["side"] {
  return verdict === "BULLISH_BUY" ? "BUY" : "SELL";
}

export class AutopilotOrchestratorService {
  private readonly queue: Queue<AutopilotJobData>;
  private readonly ownsConnection: boolean;
  private readonly connection: IORedis | null;

  constructor(connection?: IORedis) {
    if (connection) {
      this.connection = null;
      this.ownsConnection = false;
      this.queue = new Queue<AutopilotJobData>(AUTOPILOT_EXECUTION_QUEUE_NAME, { connection });
      return;
    }

    const redis = createAutopilotQueueConnection();
    this.connection = redis;
    this.ownsConnection = true;
    this.queue = new Queue<AutopilotJobData>(AUTOPILOT_EXECUTION_QUEUE_NAME, { connection: redis });
  }

  public async dispatchAiIntent(payload: DispatchAiIntentPayload): Promise<DispatchAiIntentResult> {
    if (payload.aiVerdict === "HOLD") {
      return {
        queued: false,
        reason: "AI generated a HOLD intent. No execution required.",
      };
    }

    const side = mapAiVerdictToSide(payload.aiVerdict);
    const jobData: AutopilotJobData = {
      userId: payload.userId.trim(),
      ticker: payload.ticker.trim().toUpperCase(),
      side,
      currentPrice: payload.currentPrice,
      signalSourceId: payload.signalSourceId.trim(),
    };

    try {
      const job = await this.queue.add(EXECUTE_AUTOPILOT_TRADE_JOB_NAME, jobData, {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: { age: 86400 },
      });

      return {
        queued: true,
        jobId: job.id != null ? String(job.id) : undefined,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        JSON.stringify({
          level: "error",
          event: "autopilot_orchestrator_dispatch_failed",
          userId: payload.userId,
          ticker: payload.ticker,
          aiVerdict: payload.aiVerdict,
          message,
        }),
      );
      return {
        queued: false,
        reason: message,
      };
    }
  }

  async close(): Promise<void> {
    await this.queue.close();
    if (this.ownsConnection && this.connection) {
      await this.connection.quit();
    }
  }
}

export const autopilotOrchestratorService = new AutopilotOrchestratorService();
