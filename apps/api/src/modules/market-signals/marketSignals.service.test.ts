import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeMarketSignalTicker,
  parseMarketSignalIngestInput,
  parseMarketSignalType,
  summarizeMarketSignals,
  validateConfidenceScore,
} from "./marketSignals.service";
import type { SummarizableMarketSignal } from "./marketSignals.types";

function signal(
  signalType: SummarizableMarketSignal["signalType"],
  confidenceScore: number,
): SummarizableMarketSignal {
  return { signalType, confidenceScore };
}

describe("MarketSignalsService", () => {
  it("normalizes ticker symbols to uppercase", () => {
    assert.equal(normalizeMarketSignalTicker(" aapl "), "AAPL");
    assert.equal(normalizeMarketSignalTicker("msft"), "MSFT");
  });

  it("rejects invalid signalType on ingest parse", () => {
    const parsed = parseMarketSignalIngestInput(
      {
        ticker: "AAPL",
        signalType: "INVALID_TYPE",
        source: "manual",
        confidenceScore: 80,
        title: "Test signal",
      },
      new Date("2026-05-24T12:00:00.000Z"),
    );
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.match(parsed.error, /signalType/);
    assert.equal(parseMarketSignalType("OPTIONS_FLOW"), "OPTIONS_FLOW");
    assert.equal(parseMarketSignalType("bad"), null);
  });

  it("rejects confidenceScore outside 0-100", () => {
    assert.equal(validateConfidenceScore(-1).ok, false);
    assert.equal(validateConfidenceScore(101).ok, false);
    assert.equal(validateConfidenceScore(55).ok, true);
  });

  it("summarizeMarketSignals counts by type", () => {
    const summary = summarizeMarketSignals([
      signal("OPTIONS_FLOW", 72),
      signal("DARK_POOL", 78),
      signal("DARK_POOL", 81),
      signal("SEC_FILING", 60),
    ]);

    assert.equal(summary.total, 4);
    assert.equal(summary.byType.OPTIONS_FLOW, 1);
    assert.equal(summary.byType.DARK_POOL, 2);
    assert.equal(summary.byType.SEC_FILING, 1);
  });

  it("calculates strongestSignalType by average confidence", () => {
    const summary = summarizeMarketSignals([
      signal("OPTIONS_FLOW", 90),
      signal("OPTIONS_FLOW", 88),
      signal("DARK_POOL", 70),
    ]);

    assert.equal(summary.strongestSignalType, "OPTIONS_FLOW");
  });

  it("detects whale accumulation from two high-confidence dark pool prints", () => {
    const summary = summarizeMarketSignals([
      signal("DARK_POOL", 76),
      signal("DARK_POOL", 80),
      signal("SEC_FILING", 40),
    ]);

    assert.equal(summary.whaleAccumulationDetected, true);
  });

  it("detects whale accumulation from explicit whale accumulation signal", () => {
    const summary = summarizeMarketSignals([signal("WHALE_ACCUMULATION", 82)]);
    assert.equal(summary.whaleAccumulationDetected, true);
  });

  it("does not detect whale accumulation for clean low-confidence signals", () => {
    const summary = summarizeMarketSignals([
      signal("DARK_POOL", 60),
      signal("OPTIONS_FLOW", 55),
      signal("INSIDER_ACTIVITY", 45),
    ]);

    assert.equal(summary.whaleAccumulationDetected, false);
  });
});
