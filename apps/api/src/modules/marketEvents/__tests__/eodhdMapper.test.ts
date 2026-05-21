import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEodhdEarningsRows } from "../providers/eodhdCalendarProvider";

describe("mapEodhdEarningsRows", () => {
  it("maps upcoming earnings with product summary", () => {
    const now = new Date("2026-05-19T12:00:00Z");
    const rows = mapEodhdEarningsRows(
      [
        {
          code: "NVDA",
          report_date: "2026-05-22",
          before_after_market: "AfterMarket",
          period: "Q1",
          eps_estimate: 1.2,
        },
      ],
      now,
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.symbol, "NVDA.US");
    assert.equal(rows[0]!.eventType, "earnings");
    assert.match(rows[0]!.summary ?? "", /plan przed wydarzeniem/i);
    assert.equal(rows[0]!.eventTime, "after_market");
  });
});
