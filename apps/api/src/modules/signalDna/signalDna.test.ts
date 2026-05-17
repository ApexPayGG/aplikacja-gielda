import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createSignalDnaService } from "./signalDna";

describe("signal DNA service", () => {
  it("finds top 3 twins sorted by similarity", async () => {
    const service = createSignalDnaService({
      db: {
        signal: {
          findUnique: async ({ where }: { where: { id: string } }) => {
            if (where.id === "s1") {
              return {
                id: "s1",
                ticker: "AAPL",
                pattern_type: "breakout",
                marketRegime: "RISK_OFF",
                created_at: new Date("2026-05-01T00:00:00.000Z"),
                technical_data: { rsi: 56, volume_ratio: 1.2, atr: 0.9 },
              };
            }
            if (where.id === "hs1") {
              return {
                id: "hs1",
                ticker: "AAPL",
                pattern_type: "breakout",
                marketRegime: null,
                created_at: new Date("2026-04-20T00:00:00.000Z"),
                technical_data: { rsi: 55, volume_ratio: 1.15, atr: 0.95 },
              };
            }
            if (where.id === "hs2") {
              return {
                id: "hs2",
                ticker: "MSFT",
                pattern_type: "breakout",
                marketRegime: null,
                created_at: new Date("2026-04-18T00:00:00.000Z"),
                technical_data: { rsi: 54, volume_ratio: 1.4, atr: 1.3 },
              };
            }
            if (where.id === "hs3") {
              return {
                id: "hs3",
                ticker: "NVDA",
                pattern_type: "breakout",
                marketRegime: null,
                created_at: new Date("2026-04-15T00:00:00.000Z"),
                technical_data: { rsi: 30, volume_ratio: 0.7, atr: 2.4 },
              };
            }
            return null;
          },
        },
        paperTrade: {
          findMany: async () => [
            {
              id: "pt1",
              ticker: "AAPL",
              signalId: "hs1",
              direction: "LONG",
              entryPrice: 100,
              exitPrice: 112,
              status: "CLOSED",
              entryAt: new Date("2026-04-20T00:00:00.000Z"),
              marketRegime: "RISK_OFF",
            },
            {
              id: "pt2",
              ticker: "MSFT",
              signalId: "hs2",
              direction: "LONG",
              entryPrice: 200,
              exitPrice: 210,
              status: "CLOSED",
              entryAt: new Date("2026-04-18T00:00:00.000Z"),
              marketRegime: "RISK_OFF",
            },
            {
              id: "pt3",
              ticker: "NVDA",
              signalId: "hs3",
              direction: "LONG",
              entryPrice: 300,
              exitPrice: 285,
              status: "CLOSED",
              entryAt: new Date("2026-04-15T00:00:00.000Z"),
              marketRegime: "RISK_OFF",
            },
          ],
        },
      },
      cache: { get: async () => null, set: async () => "OK" },
      narrate: async () => "narrative",
    });

    const twins = await service.findSignalTwins("s1");
    assert.equal(twins.length, 3);
    assert.equal(twins[0]?.ticker, "AAPL");
    assert.equal(twins[0]?.similarity, 100);
    assert.ok((twins[0]?.resultPct ?? 0) > 0);
    assert.ok((twins[2]?.similarity ?? 0) <= (twins[1]?.similarity ?? 0));
  });

  it("caches dna summary for 60 minutes", async () => {
    let cacheSetCalls = 0;
    const cacheStore = new Map<string, string>();
    const service = createSignalDnaService({
      db: {
        signal: {
          findUnique: async () => ({
            id: "s1",
            ticker: "AAPL",
            pattern_type: "breakout",
            marketRegime: "RISK_OFF",
            created_at: new Date("2026-05-01T00:00:00.000Z"),
            technical_data: { rsi: 56, volume_ratio: 1.2, atr: 0.9 },
          }),
        },
        paperTrade: {
          findMany: async () => [],
        },
      },
      cache: {
        get: async (key: string) => cacheStore.get(key) ?? null,
        set: async (key: string, value: string) => {
          cacheSetCalls += 1;
          cacheStore.set(key, value);
          return "OK";
        },
      },
      narrate: async () => "narrative",
    });

    const first = await service.getSignalDnaSummary("s1");
    const second = await service.getSignalDnaSummary("s1");
    assert.equal(first.aiNarrative, "narrative");
    assert.equal(second.aiNarrative, "narrative");
    assert.equal(cacheSetCalls, 1);
  });
});
