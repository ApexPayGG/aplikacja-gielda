import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { prisma } from "../../db/index";
import { createSignalMemoryRouter } from "../signalMemory";

describe("signal memory route", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  const originalFindMany = prisma.signal.findMany;
  const memory = new Map<string, string>();
  const cache = {
    get: async (key: string) => memory.get(key) ?? null,
    set: async (key: string, value: string) => {
      memory.set(key, value);
      return "OK";
    },
  };

  beforeEach(async () => {
    memory.clear();
    const now = Date.now();
    (prisma.signal.findMany as unknown as (args?: unknown) => Promise<unknown[]>) = async () => [
      {
        pattern_type: "breakout",
        score: 82,
        confidence: 84,
        created_at: new Date(now - 2 * 60 * 60 * 1000),
        max_drawdown: 4,
      },
      {
        pattern_type: "breakout",
        score: 75,
        confidence: 78,
        created_at: new Date(now - 8 * 60 * 60 * 1000),
        max_drawdown: 7,
      },
      {
        pattern_type: "mean_reversion",
        score: 68,
        confidence: 71,
        created_at: new Date(now - 16 * 60 * 60 * 1000),
        max_drawdown: 12,
      },
    ];

    const app = express();
    app.use(createSignalMemoryRouter({ cache }));
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") throw new Error("Cannot resolve test address");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    (prisma.signal.findMany as unknown) = originalFindMany;
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((err) => (err ? reject(err) : resolve()));
    });
    server = null;
  });

  it("GET /api/signals/setups/live returns ranked setups with liveScore", async () => {
    const res = await fetch(`${baseUrl}/api/signals/setups/live?limit=10`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { count: number; setups: Array<Record<string, unknown>> };
    assert.equal(body.count, 2);
    assert.ok(Array.isArray(body.setups));
    assert.equal(body.setups[0]?.setup, "breakout");
    assert.equal(typeof body.setups[0]?.avgLiveScore, "number");
    assert.equal(typeof body.setups[0]?.edge, "string");
    assert.equal(typeof (body.setups[0]?.diagnostics as { freshnessPenaltyPts?: number })?.freshnessPenaltyPts, "number");
  });

  it("invalid exchange returns 400", async () => {
    const res = await fetch(`${baseUrl}/api/signals/setups/live?exchange=INVALID`);
    assert.equal(res.status, 400);
  });

  it("auto-rotation returns deltaLiveScore vs previous snapshot", async () => {
    const first = await fetch(`${baseUrl}/api/signals/watchlist/auto-rotation?limit=10`);
    assert.equal(first.status, 200);
    const firstBody = (await first.json()) as { setups: Array<{ deltaLiveScore: number }> };
    assert.ok(firstBody.setups.every((s) => s.deltaLiveScore === 0));

    (prisma.signal.findMany as unknown as (args?: unknown) => Promise<unknown[]>) = async () => {
      const now = Date.now();
      return [
        {
          pattern_type: "breakout",
          score: 90,
          confidence: 88,
          created_at: new Date(now - 60 * 60 * 1000),
          max_drawdown: 3,
        },
        {
          pattern_type: "mean_reversion",
          score: 60,
          confidence: 65,
          created_at: new Date(now - 20 * 60 * 60 * 1000),
          max_drawdown: 14,
        },
      ];
    };

    const second = await fetch(`${baseUrl}/api/signals/watchlist/auto-rotation?limit=10`);
    assert.equal(second.status, 200);
    const secondBody = (await second.json()) as {
      setups: Array<{ setup: string; deltaLiveScore: number; whyNow?: string[] }>;
      rotationWindowMinutes: number;
    };
    assert.equal(secondBody.rotationWindowMinutes, 15);
    assert.ok(secondBody.setups.some((s) => s.setup === "breakout" && s.deltaLiveScore !== 0));
    const breakout = secondBody.setups.find((s) => s.setup === "breakout");
    assert.ok(Array.isArray(breakout?.whyNow));
    assert.equal(breakout?.whyNow?.length, 3);
  });
});
