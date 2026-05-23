import "./load-env";
import process from "node:process";
import { startDlqMonitor } from "./modules/dlqMonitor";
import { prisma } from "./db/index";
import { PROCESS_SIGNAL_DLQ_NAME, PROCESS_SIGNAL_QUEUE_NAME } from "./jobs/processSignal";
import { startMarketRegimeCache } from "./marketRegime";
import { enqueueDiscordSignalAlert } from "./queues/discordSignalAlerts";
import { getCacheRedis } from "./redis";
import { startScheduler } from "./scheduler";
import { startServer } from "./server";
import { startTelegramBot, stopTelegramBot } from "./telegram/index";
import { autopilotWorker } from "./workers/autopilot.worker";
import { newsSentimentWorker } from "./workers/newsSentiment.worker";

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  await startScheduler();
  startMarketRegimeCache(["SPY", "QQQ", "DIA"]);
  startDlqMonitor({
    redisClient: getCacheRedis(),
    db: prisma,
    enqueueDiscordSignalAlert,
    processSignalQueueName: PROCESS_SIGNAL_QUEUE_NAME,
    processSignalDlqQueueName: PROCESS_SIGNAL_DLQ_NAME,
  });
  await startServer(port);
  await startTelegramBot();
}

async function shutdown(signal: string): Promise<void> {
  console.log(`\n${signal} received, shutting down…`);
  stopTelegramBot();
  try {
    await autopilotWorker.close();
  } catch (error) {
    console.error(
      "[shutdown] autopilot worker close failed:",
      error instanceof Error ? error.message : error,
    );
  }
  try {
    await newsSentimentWorker.close();
  } catch (error) {
    console.error(
      "[shutdown] news sentiment worker close failed:",
      error instanceof Error ? error.message : error,
    );
  }
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
