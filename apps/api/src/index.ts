import "./load-env";
import process from "node:process";
import { startDlqMonitor } from "../../../packages/notifications/src/dlqMonitor";
import { prisma } from "./db/index";
import { PROCESS_SIGNAL_DLQ_NAME, PROCESS_SIGNAL_QUEUE_NAME } from "./jobs/processSignal";
import { startMarketRegimeCache } from "./marketRegime";
import { enqueueDiscordSignalAlert } from "./queues/discordSignalAlerts";
import { getCacheRedis } from "./redis";
import { startScheduler } from "./scheduler";
import { startServer } from "./server";
import { startTelegramBot, stopTelegramBot } from "./telegram/index";

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

function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down…`);
  stopTelegramBot();
  void prisma.$disconnect().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
