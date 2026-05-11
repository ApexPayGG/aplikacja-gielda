import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import type { PrismaClient } from "@prisma/client";
import { createHistoricalTwinsRouter } from "../historicaltwins";

describe("historical twins routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    let runResolve: (() => void) | null = null;
    const runStarted = new Promise<void>((resolve) => {
      runResolve = resolve;
    });

    let callCount = 0;
    app.use(
      createHistoricalTwinsRouter({} as PrismaClient, {
        runSnapshotFn: async () => {
          callCount += 1;
          runResolve?.();
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 20);
          });
        },
      }),
    );

    app.get("/_test/calls", (_req, res) => {
      res.json({ callCount });
    });

    app.get("/_test/wait", async (_req, res) => {
      await runStarted;
      res.json({ started: true });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("POST /api/historicaltwins/snapshot/run returns started=true and triggers async job", async () => {
    const res = await fetch(`${baseUrl}/api/historicaltwins/snapshot/run`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { started: boolean };
    assert.equal(body.started, true);

    const waitRes = await fetch(`${baseUrl}/_test/wait`);
    assert.equal(waitRes.status, 200);

    const callsRes = await fetch(`${baseUrl}/_test/calls`);
    const callsBody = (await callsRes.json()) as { callCount: number };
    assert.equal(callsBody.callCount, 1);
  });
});
