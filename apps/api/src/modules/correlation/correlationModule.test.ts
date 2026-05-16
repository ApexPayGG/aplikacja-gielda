import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createCorrelationService } from "./correlationModule";

type QuoteRow = {
  symbol: string;
  timestamp: Date;
  close: number;
};

function createService(rows: QuoteRow[]) {
  return createCorrelationService({
    db: {
      quote: {
        findMany: async () => rows,
      },
    },
    runAiInsight: async (_pairsLabel, fallback) => fallback,
  });
}

describe("correlationModule", () => {
  it("returns 0 when series have no overlapping dates", async () => {
    const service = createService([
      { symbol: "AAPL", timestamp: new Date("2026-01-01T00:00:00.000Z"), close: 100 },
      { symbol: "AAPL", timestamp: new Date("2026-01-02T00:00:00.000Z"), close: 101 },
      { symbol: "MSFT", timestamp: new Date("2026-01-10T00:00:00.000Z"), close: 200 },
      { symbol: "MSFT", timestamp: new Date("2026-01-11T00:00:00.000Z"), close: 199 },
    ]);

    const out = await service.analyze("AAPL", ["MSFT"]);
    assert.equal(out.correlations.length, 1);
    assert.equal(out.correlations[0]?.symbol, "MSFT");
    assert.equal(out.correlations[0]?.correlation, 0);
    assert.equal(out.correlations[0]?.warning, false);
    assert.equal(out.highRiskPairs.length, 0);
  });

  it("returns 0 when one of the series is constant", async () => {
    const service = createService([
      { symbol: "AAPL", timestamp: new Date("2026-01-01T00:00:00.000Z"), close: 10 },
      { symbol: "AAPL", timestamp: new Date("2026-01-02T00:00:00.000Z"), close: 20 },
      { symbol: "AAPL", timestamp: new Date("2026-01-03T00:00:00.000Z"), close: 30 },
      { symbol: "MSFT", timestamp: new Date("2026-01-01T00:00:00.000Z"), close: 5 },
      { symbol: "MSFT", timestamp: new Date("2026-01-02T00:00:00.000Z"), close: 5 },
      { symbol: "MSFT", timestamp: new Date("2026-01-03T00:00:00.000Z"), close: 5 },
    ]);

    const out = await service.analyze("AAPL", ["MSFT"]);
    assert.equal(out.correlations.length, 1);
    assert.equal(out.correlations[0]?.correlation, 0);
    assert.equal(out.highRiskPairs.length, 0);
  });

  it("keeps negative Pearson correlation and does not flag it as high risk", async () => {
    const service = createService([
      { symbol: "AAPL", timestamp: new Date("2026-01-01T00:00:00.000Z"), close: 1 },
      { symbol: "AAPL", timestamp: new Date("2026-01-02T00:00:00.000Z"), close: 2 },
      { symbol: "AAPL", timestamp: new Date("2026-01-03T00:00:00.000Z"), close: 3 },
      { symbol: "AAPL", timestamp: new Date("2026-01-04T00:00:00.000Z"), close: 4 },
      { symbol: "TSLA", timestamp: new Date("2026-01-01T00:00:00.000Z"), close: 4 },
      { symbol: "TSLA", timestamp: new Date("2026-01-02T00:00:00.000Z"), close: 3 },
      { symbol: "TSLA", timestamp: new Date("2026-01-03T00:00:00.000Z"), close: 2 },
      { symbol: "TSLA", timestamp: new Date("2026-01-04T00:00:00.000Z"), close: 1 },
    ]);

    const out = await service.analyze("AAPL", ["TSLA"]);
    assert.equal(out.correlations.length, 1);
    assert.ok((out.correlations[0]?.correlation ?? 0) < 0);
    assert.equal(out.correlations[0]?.warning, false);
    assert.equal(out.highRiskPairs.length, 0);
  });
});
