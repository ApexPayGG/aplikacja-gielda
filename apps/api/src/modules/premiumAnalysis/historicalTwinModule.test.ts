import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { findHistoricalTwins } from "./historicalTwinModule";

function createPrismaMock(queryRows: unknown[]) {
  return {
    company: {
      findUnique: async ({ where }: { where: { symbol: string } }) => {
        if (where.symbol === "AAPL") return { symbol: "AAPL", sector: "Tech" };
        return { symbol: where.symbol, sector: "Tech" };
      },
      findMany: async () => [{ symbol: "MSFT" }, { symbol: "GOOGL" }],
    },
    fundamental: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        if (typeof where.metric === "object") {
          return [
            { metric: "eps_ttm", value: 5 },
            { metric: "revenue", value: 130 },
            { metric: "revenue", value: 120 },
            { metric: "revenue", value: 110 },
            { metric: "revenue", value: 100 },
            { metric: "eps", value: 8 },
            { metric: "eps", value: 7 },
            { metric: "eps", value: 6 },
            { metric: "eps", value: 5 },
          ];
        }
        return [
          { symbol: "MSFT", value: 6 },
          { symbol: "GOOGL", value: 7 },
        ];
      },
    },
    technicalIndicator: {
      findFirst: async () => ({ value: 55 }),
    },
    quote: {
      findFirst: async () => ({ close: 200 }),
      findMany: async ({ where }: { where: { symbol?: unknown } }) => {
        if (typeof where.symbol === "object" && where.symbol !== null) {
          return [
            { symbol: "MSFT", close: 350 },
            { symbol: "GOOGL", close: 180 },
          ];
        }
        return Array.from({ length: 25 }).map((_, idx) => ({
          close: 200 - idx,
          volume: 1000 + idx * 10,
        }));
      },
    },
    $queryRawUnsafe: async () => queryRows,
  } as any;
}

describe("historicalTwinModule cosine search", () => {
  it("returns explicit fallback when historical table has no rows", async () => {
    const prisma = createPrismaMock([]);
    const out = await findHistoricalTwins(prisma, "AAPL", 3, 60);

    assert.equal(out.twins.length, 0);
    assert.deepEqual(out.fallback, {
      fallback: true,
      reason: "insufficient_historical_data",
    });
  });

  it("maps cosine similarity rows into twins payload", async () => {
    const prisma = createPrismaMock([
      {
        symbol: "NVDA",
        snapshot_date: new Date("2024-01-10T00:00:00.000Z"),
        price_close: 620.5,
        price_change_5d: 5.4,
        outcome_5d: 2.1,
        outcome_20d: 8.7,
        similarity: 0.83,
      },
    ]);
    const out = await findHistoricalTwins(prisma, "AAPL", 3, 60);

    assert.equal(out.twins.length, 1);
    assert.equal(out.twins[0]?.ticker, "NVDA");
    assert.equal(out.twins[0]?.match_score, 83);
    assert.equal(out.twins[0]?.outcome_5y.total_return_pct, 8.7);
  });
});
