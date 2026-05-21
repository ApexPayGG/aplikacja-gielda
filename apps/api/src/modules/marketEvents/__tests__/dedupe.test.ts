import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDividendDedupeKey,
  buildEarningsDedupeKey,
  daysUntilEventDate,
  earningsImportanceForDays,
} from "../dedupe";

describe("marketEvents dedupe", () => {
  it("builds stable earnings keys", () => {
    const a = buildEarningsDedupeKey("NVDA.US", "2026-05-27", "Q1", "upcoming");
    const b = buildEarningsDedupeKey("NVDA.US", "2026-05-27", "Q1", "upcoming");
    assert.equal(a, b);
    assert.match(a, /^NVDA\.US:earnings:/);
  });

  it("builds dividend keys with ex and payment dates", () => {
    const key = buildDividendDedupeKey("KO.US", "2026-06-12", "2026-07-01");
    assert.equal(key, "KO.US:dividend:2026-06-12:2026-07-01");
  });

  it("scores importance by days to earnings", () => {
    assert.equal(earningsImportanceForDays(0), "critical");
    assert.equal(earningsImportanceForDays(1), "high");
    assert.equal(earningsImportanceForDays(10), "low");
  });

  it("computes days until event", () => {
    const days = daysUntilEventDate("2099-01-01", new Date("2098-12-20T12:00:00Z"));
    assert.equal(days, 12);
  });
});
