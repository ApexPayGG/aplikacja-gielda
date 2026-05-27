import type { Server } from "node:http";
import type { Express } from "express";

/** Close an HTTP test server and drop any keep-alive connections. */
export async function closeTestServer(server: Server | null | undefined): Promise<void> {
  if (!server) return;

  await new Promise<void>((resolve, reject) => {
    server.closeAllConnections?.();
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

/** Start Express on an ephemeral port for integration-style fetch tests. */
export async function startTestServer(app: Express): Promise<{
  server: Server;
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server = await new Promise<Server>((resolve, reject) => {
    const listener = app.listen(0, () => resolve(listener));
    listener.once("error", reject);
  });

  const addr = server.address();
  if (!addr || typeof addr === "string") {
    await closeTestServer(server);
    throw new Error("no port");
  }

  return {
    server,
    baseUrl: `http://127.0.0.1:${addr.port}`,
    close: () => closeTestServer(server),
  };
}

/** Run a callback against a short-lived test server. */
export async function withTestServer(
  app: Express,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  const { baseUrl, close } = await startTestServer(app);
  try {
    await run(baseUrl);
  } finally {
    await close();
  }
}

/** Disconnect Prisma when a test file finishes (import side-effect only). */
export async function disconnectTestPrisma(): Promise<void> {
  const { prisma } = await import("../db");
  await prisma.$disconnect();
}
