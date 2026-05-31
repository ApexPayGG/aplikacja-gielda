import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeFrequencyToken,
  parseCalendarSymbols,
  resolveDividendDataStatus,
} from "../dividendCalendarService";

describe("dividendCalendarService", () => {
  it("normalizeFrequencyToken lowercases and underscores", () => {
    assert.equal(normalizeFrequencyToken("Quarterly"), "quarterly");
    assert.equal(normalizeFrequencyToken("semi-annual"), "semi_annual");
    assert.equal(normalizeFrequencyToken(""), null);
  });

  it("parseCalendarSymbols caps and dedupes", () => {
    assert.deepEqual(parseCalendarSymbols("aapl,msft,AAPL"), ["AAPL", "MSFT"]);
    assert.equal(parseCalendarSymbols(""), undefined);
  });

  it("resolveDividendDataStatus marks mock_seed as estimated", () => {
    const ex = new Date("2026-06-01T00:00:00.000Z");
    const pay = new Date("2026-06-15T00:00:00.000Z");
    assert.equal(
      resolveDividendDataStatus({
        exDate: ex,
        payDate: pay,
        amount: 1,
        source: "mock_seed",
        createdAt: new Date(),
      }),
      "estimated",
    );
  });

  it("resolveDividendDataStatus marks missing when amount invalid", () => {
    assert.equal(
      resolveDividendDataStatus({
        exDate: new Date(),
        payDate: new Date(),
        amount: 0,
        source: "eodhd",
        createdAt: new Date(),
      }),
      "missing",
    );
  });
});
