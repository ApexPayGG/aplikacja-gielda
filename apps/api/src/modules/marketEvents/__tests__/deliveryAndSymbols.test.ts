import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldDeliverForDaysBefore } from "../eventDeliveryService";
import {
  buildWatchlistSymbolWhere,
  expandWatchlistSymbols,
  sortEventsByImportance,
} from "../marketEventsService";

describe("shouldDeliverForDaysBefore", () => {
  it("matches only exact offsets in daysBefore", () => {
    const days = [7, 3, 1, 0];
    assert.equal(shouldDeliverForDaysBefore(7, days), true);
    assert.equal(shouldDeliverForDaysBefore(0, days), true);
    assert.equal(shouldDeliverForDaysBefore(-1, days), false);
    assert.equal(shouldDeliverForDaysBefore(-2, days), false);
    assert.equal(shouldDeliverForDaysBefore(2, days), false);
  });
});

describe("expandWatchlistSymbols", () => {
  it("includes base and suffixed forms", () => {
    const expanded = expandWatchlistSymbols(["AAPL", "CPS.WAR"]);
    assert.ok(expanded.includes("AAPL"));
    assert.ok(expanded.includes("AAPL.US"));
    assert.ok(expanded.includes("CPS.WAR"));
    assert.ok(expanded.includes("CPS"));
    assert.equal(expanded.includes("CPS.US"), false);
  });
});

describe("buildWatchlistSymbolWhere", () => {
  it("matches bare ticker to any exchange suffix", () => {
    const where = buildWatchlistSymbolWhere(["AAPL"]);
    const or = (where as { OR: Array<{ symbol: unknown }> }).OR;
    const inClause = or.find((c) => typeof c.symbol === "object" && c.symbol !== null && "in" in c.symbol) as
      | { symbol: { in: string[] } }
      | undefined;
    assert.ok(inClause?.symbol.in.includes("AAPL"));
    assert.ok(inClause?.symbol.in.includes("AAPL.US"));
    assert.ok(or.some((c) => typeof c.symbol === "object" && c.symbol !== null && "startsWith" in c.symbol));
  });
});

describe("sortEventsByImportance", () => {
  it("orders by eventDate asc then importance within day", () => {
    const day1 = new Date("2026-05-20T00:00:00.000Z");
    const day2 = new Date("2026-05-21T00:00:00.000Z");
    const sorted = sortEventsByImportance([
      { importance: "low", eventDate: day2 },
      { importance: "critical", eventDate: day1 },
      { importance: "medium", eventDate: day1 },
    ]);
    assert.equal(sorted[0]!.importance, "critical");
    assert.equal(sorted[1]!.importance, "medium");
    assert.equal(sorted[2]!.importance, "low");
  });
});
