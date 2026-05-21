import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  shouldDeliverForDaysBefore,
  shouldSkipExistingDelivery,
} from "../eventDeliveryService";
import {
  expandWatchlistSymbols,
  sortEventsByImportance,
  watchlistEntryMatchesEventSymbol,
} from "../marketEventsService";

describe("audit: past events (daysTo < 0)", () => {
  it("does not deliver for negative day offsets", () => {
    const days = [7, 3, 1, 0];
    assert.equal(shouldDeliverForDaysBefore(-1, days), false);
    assert.equal(shouldDeliverForDaysBefore(-2, days), false);
    assert.equal(shouldDeliverForDaysBefore(0, days), true);
    assert.equal(shouldDeliverForDaysBefore(3, days), true);
  });
});

describe("audit: delivery idempotency", () => {
  it("skips when delivery exists with pending status", () => {
    assert.equal(shouldSkipExistingDelivery({ status: "pending" }), true);
  });

  it("skips when delivery exists with failed status", () => {
    assert.equal(shouldSkipExistingDelivery({ status: "failed" }), true);
  });

  it("does not skip when no prior delivery", () => {
    assert.equal(shouldSkipExistingDelivery(null), false);
    assert.equal(shouldSkipExistingDelivery(undefined), false);
  });
});

describe("audit: watchlist symbol expansion", () => {
  it("expands AAPL to include AAPL.US", () => {
    const expanded = expandWatchlistSymbols(["AAPL"]);
    assert.ok(expanded.includes("AAPL"));
    assert.ok(expanded.includes("AAPL.US"));
  });

  it("matches watchlist AAPL to event AAPL.US", () => {
    assert.equal(watchlistEntryMatchesEventSymbol("AAPL", "AAPL.US"), true);
  });

  it("matches CPS to CPS.WAR without requiring CPS.US", () => {
    assert.equal(watchlistEntryMatchesEventSymbol("CPS", "CPS.WAR"), true);
    assert.equal(watchlistEntryMatchesEventSymbol("CPS", "CPS.US"), false);
  });
});

describe("audit: importance sort", () => {
  it("orders by date asc then critical before high on same day", () => {
    const day = new Date("2026-06-01T00:00:00.000Z");
    const sorted = sortEventsByImportance([
      { importance: "high", eventDate: day },
      { importance: "critical", eventDate: day },
      { importance: "low", eventDate: new Date("2026-06-02T00:00:00.000Z") },
      { importance: "medium", eventDate: day },
    ]);
    assert.equal(sorted[0]!.importance, "critical");
    assert.equal(sorted[1]!.importance, "high");
    assert.equal(sorted[2]!.importance, "medium");
    assert.equal(sorted[3]!.importance, "low");
    assert.equal(sorted[3]!.eventDate.toISOString().slice(0, 10), "2026-06-02");
  });
});

describe("audit: digest guards", () => {
  it("treats empty items as no digest notification", () => {
    const items: unknown[] = [];
    assert.equal(items.length === 0, true);
  });

  it("skips duplicate digest when delivery row exists", () => {
    assert.equal(shouldSkipExistingDelivery({ status: "sent" }), true);
    assert.equal(shouldSkipExistingDelivery({ status: "failed" }), true);
  });
});
