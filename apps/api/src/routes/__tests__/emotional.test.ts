import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createEmotionalRouter } from "../emotional";

describe("emotional routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  const rows: Array<{
    userId: string;
    clickRate: number;
    tradeFrequency: number;
    avgDecisionTime: number;
    stressDetected: boolean;
    suggestion: string | null;
    createdAt: Date;
  }> = [];

  beforeEach(async () => {
    rows.length = 0;
    const app = express();
    app.use(express.json());
    app.use(
      createEmotionalRouter({
        db: {
          emotionalEvent: {
            create: async ({ data }: any) => {
              const row = {
                userId: String(data.userId),
                clickRate: Number(data.clickRate),
                tradeFrequency: Number(data.tradeFrequency),
                avgDecisionTime: Number(data.avgDecisionTime),
                stressDetected: Boolean(data.stressDetected),
                suggestion: data.suggestion == null ? null : String(data.suggestion),
                createdAt: new Date(),
              };
              rows.push(row);
              return { id: "evt_1", ...row };
            },
            findFirst: async ({ where }: any) => {
              const userRows = rows
                .filter((r) => r.userId === String(where.userId))
                .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
              return userRows[0] ?? null;
            },
          },
        } as never,
        suggestor: async () => "Take a short break, breathe deeply, and return with a calmer mindset.",
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("POST /api/emotional/track returns stress + suggestion + level", async () => {
    const res = await fetch(`${baseUrl}/api/emotional/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        clickRate: 45,
        tradeFrequency: 2,
        avgDecisionTime: 4,
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { stressDetected: boolean; suggestion?: string; level: string };
    assert.equal(body.stressDetected, true);
    assert.equal(body.level, "MEDIUM");
    assert.equal(typeof body.suggestion, "string");
  });

  it("GET /api/emotional/status/:userId returns latest status", async () => {
    await fetch(`${baseUrl}/api/emotional/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        clickRate: 5,
        tradeFrequency: 1,
        avgDecisionTime: 6,
      }),
    });

    const res = await fetch(`${baseUrl}/api/emotional/status/demo-user`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { currentLevel: string; lastChecked: string | null };
    assert.equal(body.currentLevel, "LOW");
    assert.equal(typeof body.lastChecked, "string");
  });
});
