import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterEventsForWatchlistSymbols } from "../marketEventsService";
import type { NormalizedMarketEvent } from "../types";

describe("filterEventsForWatchlistSymbols", () => {
  it("keeps macro and tracked symbols only", () => {
    const events: NormalizedMarketEvent[] = [
      {
        symbol: "AAPL.US",
        eventType: "earnings",
        eventDate: "2026-05-20",
        importance: "high",
        title: "AAPL",
        source: "test",
        dedupeKey: "a",
      },
      {
        symbol: "ZZZZ.US",
        eventType: "earnings",
        eventDate: "2026-05-21",
        importance: "low",
        title: "ZZZZ",
        source: "test",
        dedupeKey: "z",
      },
      {
        symbol: null,
        eventType: "macro",
        eventDate: "2026-05-20",
        importance: "medium",
        title: "CPI",
        source: "test",
        dedupeKey: "m",
      },
    ];
    const filtered = filterEventsForWatchlistSymbols(events, new Set(["AAPL.US"]));
    assert.equal(filtered.length, 2);
    assert.equal(filtered.some((e) => e.symbol === "ZZZZ.US"), false);
  });
});
