import "./load-env";
import process from "node:process";
import { prisma } from "./db/index";
import { startScheduler } from "./scheduler";
import { startServer } from "./server";

async function main(): Promise<void> {
  const port = parseInt(process.env.PORT ?? "3000", 10);
  await startScheduler();
  await startServer(port);
}

function shutdown(signal: string): void {
  console.log(`\n${signal} received, shutting down…`);
  void prisma.$disconnect().finally(() => process.exit(0));
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
