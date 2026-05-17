import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createPostTradeReflectionRouter } from "../postTradeReflection";

describe("postTradeReflection routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createPostTradeReflectionRouter({
        createPostTradeReflection: async (input) => ({
          reflection: {
            id: "r1",
            userId: input.userId,
            tradeId: input.tradeId,
            followedPlan: input.followedPlan,
            emotion: input.emotion ?? null,
            lesson: input.lesson ?? null,
            aiInsight: "Respect stop placement; your process beats prediction over a long sample.",
            createdAt: new Date("2026-05-13T20:00:00.000Z").toISOString(),
          },
          aiInsight: "Respect stop placement; your process beats prediction over a long sample.",
        }),
        getPostTradeReflections: async (userId, limit) => ({
          reflections: Array.from({ length: Math.min(limit ?? 10, 2) }).map((_, idx) => ({
            id: `r${idx + 1}`,
            userId,
            tradeId: `t${idx + 1}`,
            followedPlan: idx === 0,
            emotion: idx === 0 ? "Confident" : "Fear",
            lesson: "Keep position sizing consistent.",
            aiInsight: "Position sizing stayed stable; continue prioritizing process over outcome variance.",
            createdAt: new Date("2026-05-13T20:00:00.000Z").toISOString(),
          })),
        }),
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    if (!server) throw new Error("Server not started");
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

  it("POST /api/reflection returns reflection and ai insight", async () => {
    const res = await fetch(`${baseUrl}/api/reflection`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        tradeId: "trade-1",
        followedPlan: true,
        emotion: "Confident",
        lesson: "Wait for confirmation candle.",
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      reflection: { tradeId: string; followedPlan: boolean };
      aiInsight: string;
    };
    assert.equal(body.reflection.tradeId, "trade-1");
    assert.equal(body.reflection.followedPlan, true);
    assert.equal(typeof body.aiInsight, "string");
    assert.ok(body.aiInsight.length > 0);
  });

  it("GET /api/reflection/:userId returns bounded list", async () => {
    const res = await fetch(`${baseUrl}/api/reflection/demo-user?limit=2`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { reflections: Array<{ userId: string }> };
    assert.equal(body.reflections.length, 2);
    assert.ok(body.reflections.every((row) => row.userId === "demo-user"));
  });
});
