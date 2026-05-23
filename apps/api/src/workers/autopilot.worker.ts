import Alpaca from "@alpacahq/alpaca-trade-api";
import type { AlpacaMode, AutopilotExecutionStatus, PrismaClient, TradeSide } from "@prisma/client";
import { Worker, type ConnectionOptions } from "bullmq";
import IORedis from "ioredis";
import { prisma as defaultPrisma } from "../db";
import { autopilotCryptoService } from "../modules/autopilot/crypto.service";
import { SafeGuardManager } from "../modules/autopilot/SafeGuardManager";

export const AUTOPILOT_EXECUTION_QUEUE_NAME = "autopilot-execution-queue";

export interface AutopilotJobData {
  userId: string;
  ticker: string;
  side: "BUY" | "SELL";
  currentPrice: number;
  signalSourceId: string;
}

type AlpacaClient = InstanceType<typeof Alpaca>;

type AutopilotWorkerDeps = {
  db: PrismaClient;
  safeGuard: SafeGuardManager;
  crypto: typeof autopilotCryptoService;
};

function createAutopilotRedisConnection(): IORedis {
  const host = process.env.REDIS_HOST?.trim() || "127.0.0.1";
  const parsedPort = Number.parseInt(process.env.REDIS_PORT?.trim() || "6379", 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 6379;

  return new IORedis({
    host,
    port,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
}

function mapJobSideToTradeSide(side: AutopilotJobData["side"]): TradeSide {
  return side === "BUY" ? "BUY" : "SELL";
}

function mapJobSideToAlpacaSide(side: AutopilotJobData["side"]): "buy" | "sell" {
  return side === "BUY" ? "buy" : "sell";
}

async function writeExecutionLog(
  db: PrismaClient,
  input: {
    userId: string;
    ticker: string;
    side: TradeSide;
    status: AutopilotExecutionStatus;
    reason?: string | null;
    alpacaOrderId?: string | null;
    calculatedQty: number;
    executionMode: AlpacaMode;
    signalSourceId?: string | null;
  },
): Promise<void> {
  await db.autopilotExecutionLog.create({
    data: {
      userId: input.userId,
      ticker: input.ticker.trim().toUpperCase().slice(0, 20),
      side: input.side,
      status: input.status,
      reason: input.reason ?? null,
      alpacaOrderId: input.alpacaOrderId ?? null,
      calculatedQty: input.calculatedQty,
      executionMode: input.executionMode,
      signalSourceId: input.signalSourceId ?? null,
    },
  });
}

async function bumpExecutedStats(db: PrismaClient, userId: string): Promise<void> {
  const now = new Date();
  await db.userAutopilotStats.upsert({
    where: { userId },
    create: {
      userId,
      totalTradesExecuted: 1,
      lastExecutedAt: now,
    },
    update: {
      totalTradesExecuted: { increment: 1 },
      lastExecutedAt: now,
    },
  });
}

async function loadAlpacaClient(
  db: PrismaClient,
  crypto: typeof autopilotCryptoService,
  userId: string,
): Promise<{ client: AlpacaClient; executionMode: AlpacaMode }> {
  const settings = await db.userAutopilotSettings.findUnique({ where: { userId } });
  if (!settings?.alpacaApiKeyEncrypted?.trim() || !settings.alpacaApiSecretEncrypted?.trim()) {
    throw new Error("Encrypted Alpaca credentials are missing");
  }

  const apiKey = crypto.decrypt(settings.alpacaApiKeyEncrypted);
  const apiSecret = crypto.decrypt(settings.alpacaApiSecretEncrypted);

  const client = new Alpaca({
    keyId: apiKey,
    secretKey: apiSecret,
    paper: settings.alpacaMode === "PAPER",
  });

  return { client, executionMode: settings.alpacaMode };
}

async function resolveSellQuantity(client: AlpacaClient, ticker: string): Promise<number> {
  const symbol = ticker.trim().toUpperCase();
  const positions = (await client.getPositions()) as Array<{ symbol?: string; qty?: string | number }>;
  const position = positions.find((row) => row.symbol?.toUpperCase() === symbol);
  if (!position) {
    throw new Error(`No open Alpaca position for ${symbol}`);
  }
  const qty = Math.floor(Number(position.qty));
  if (!Number.isFinite(qty) || qty <= 0) {
    throw new Error(`Open position for ${symbol} has zero sellable quantity`);
  }
  return qty;
}

export async function processAutopilotJob(
  data: AutopilotJobData,
  deps: AutopilotWorkerDeps = {
    db: defaultPrisma,
    safeGuard: new SafeGuardManager(defaultPrisma),
    crypto: autopilotCryptoService,
  },
): Promise<void> {
  const { db, safeGuard, crypto } = deps;
  const tradeSide = mapJobSideToTradeSide(data.side);
  let executionMode: AlpacaMode = "PAPER";

  try {
    const { client, executionMode: mode } = await loadAlpacaClient(db, crypto, data.userId);
    executionMode = mode;

    const account = (await client.getAccount()) as { equity?: string | number };
    const alpacaEquity = Number(account.equity);
    if (!Number.isFinite(alpacaEquity) || alpacaEquity <= 0) {
      throw new Error("Alpaca account equity is unavailable or non-positive");
    }

    const validation = await safeGuard.validateAndSizeOrder(
      {
        userId: data.userId,
        ticker: data.ticker,
        side: data.side,
        currentPrice: data.currentPrice,
      },
      alpacaEquity,
    );

    if (!validation.ok) {
      await writeExecutionLog(db, {
        userId: data.userId,
        ticker: data.ticker,
        side: tradeSide,
        status: "REJECTED_BY_SAFE_GUARD",
        reason: validation.reason,
        calculatedQty: 0,
        executionMode,
        signalSourceId: data.signalSourceId,
      });
      return;
    }

    executionMode = validation.executionMode;

    let orderQty = validation.calculatedQuantity;
    if (data.side === "SELL") {
      orderQty = await resolveSellQuantity(client, data.ticker);
    }

    if (orderQty <= 0) {
      await writeExecutionLog(db, {
        userId: data.userId,
        ticker: data.ticker,
        side: tradeSide,
        status: "REJECTED_BY_SAFE_GUARD",
        reason: "Order quantity resolved to zero",
        calculatedQty: 0,
        executionMode,
        signalSourceId: data.signalSourceId,
      });
      return;
    }

    const order = (await client.createOrder({
      symbol: data.ticker.trim().toUpperCase(),
      qty: orderQty,
      side: mapJobSideToAlpacaSide(data.side),
      type: "market",
      time_in_force: "day",
    })) as { id?: string };

    await writeExecutionLog(db, {
      userId: data.userId,
      ticker: data.ticker,
      side: tradeSide,
      status: "EXECUTED",
      alpacaOrderId: order.id ?? null,
      calculatedQty: orderQty,
      executionMode,
      signalSourceId: data.signalSourceId,
    });

    await bumpExecutedStats(db, data.userId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await writeExecutionLog(db, {
      userId: data.userId,
      ticker: data.ticker,
      side: tradeSide,
      status: "SYSTEM_ERROR",
      reason: message.slice(0, 500),
      calculatedQty: 0,
      executionMode,
      signalSourceId: data.signalSourceId,
    });
    throw error;
  }
}

const redisConnection = createAutopilotRedisConnection();

export const autopilotWorker = new Worker<AutopilotJobData>(
  AUTOPILOT_EXECUTION_QUEUE_NAME,
  async (job) => {
    await processAutopilotJob(job.data);
  },
  {
    connection: redisConnection as unknown as ConnectionOptions,
    concurrency: 5,
  },
);

autopilotWorker.on("failed", (job, error) => {
  console.error(
    JSON.stringify({
      level: "error",
      event: "autopilot_worker_job_failed",
      jobId: job?.id,
      userId: job?.data.userId,
      ticker: job?.data.ticker,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
});

autopilotWorker.on("completed", (job) => {
  console.log(
    JSON.stringify({
      level: "info",
      event: "autopilot_worker_job_completed",
      jobId: job.id,
      userId: job.data.userId,
      ticker: job.data.ticker,
      side: job.data.side,
    }),
  );
});
