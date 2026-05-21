import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildDividendDedupeKey } from "../dedupe";
import {
  isDividendExDateInRange,
  mapEodhdDividendRows,
  mapEodhdEarningsRows,
  normalizeEodhdSymbol,
} from "../providers/eodhdCalendarProvider";

const KO_DIV_ROWS = [
  {
    date: "2026-06-15",
    declarationDate: "2026-04-30",
    recordDate: "2026-06-15",
    paymentDate: "2026-07-01",
    period: "Quarterly",
    value: 0.53,
    unadjustedValue: 0.53,
    currency: "USD",
  },
];

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

describe("mapEodhdDividendRows (EODHD /api/div/{symbol})", () => {
  const now = new Date("2026-05-19T12:00:00Z");
  const from = "2026-05-01";
  const to = "2026-06-30";

  it("maps KO.US dividend history row correctly", () => {
    const { events } = mapEodhdDividendRows(KO_DIV_ROWS, "KO", from, to, now);
    assert.equal(events.length, 1);
    const ev = events[0]!;
    assert.equal(ev.symbol, "KO.US");
    assert.equal(ev.eventType, "dividend");
    assert.equal(ev.eventDate, "2026-06-15");
    assert.equal(ev.source, "eodhd_dividends_history");
    assert.equal(ev.dedupeKey, buildDividendDedupeKey("KO.US", "2026-06-15", "2026-07-01"));
    assert.equal(ev.payload?.paymentDate, "2026-07-01");
    assert.equal(ev.payload?.recordDate, "2026-06-15");
    assert.equal(ev.payload?.declarationDate, "2026-04-30");
    assert.equal(ev.payload?.dividendPerShare, 0.53);
    assert.equal(ev.payload?.currency, "USD");
    assert.equal(ev.payload?.period, "Quarterly");
    assert.equal(ev.payload?.exDividendDate, "2026-06-15");
  });

  it("filters rows outside from/to by ex-date", () => {
    const { events, rowsInRange } = mapEodhdDividendRows(
      [
        ...KO_DIV_ROWS,
        { date: "2025-01-01", value: 0.4, paymentDate: "2025-02-01" },
        { date: "2027-01-01", value: 0.4, paymentDate: "2027-02-01" },
      ],
      "KO.US",
      from,
      to,
      now,
    );
    assert.equal(rowsInRange, 1);
    assert.equal(events.length, 1);
    assert.equal(events[0]!.eventDate, "2026-06-15");
  });

  it("deduplicates identical dividend rows", () => {
    const { events } = mapEodhdDividendRows(
      [KO_DIV_ROWS[0], { ...KO_DIV_ROWS[0] }],
      "KO.US",
      from,
      to,
      now,
    );
    assert.equal(events.length, 1);
  });

  it("skips rows without ex-date (date)", () => {
    const { events } = mapEodhdDividendRows(
      [{ paymentDate: "2026-07-01", value: 0.53 }],
      "KO.US",
      from,
      to,
      now,
    );
    assert.equal(events.length, 0);
  });

  it("uses na in dedupe key when paymentDate is missing", () => {
    const { events } = mapEodhdDividendRows(
      [{ date: "2026-06-15", value: 0.53 }],
      "KO",
      from,
      to,
      now,
    );
    assert.equal(events[0]!.dedupeKey, "KO.US:dividend:2026-06-15:na");
  });
});

describe("isDividendExDateInRange", () => {
  it("includes boundary dates", () => {
    assert.equal(isDividendExDateInRange("2026-05-01", "2026-05-01", "2026-06-30"), true);
    assert.equal(isDividendExDateInRange("2026-06-30", "2026-05-01", "2026-06-30"), true);
    assert.equal(isDividendExDateInRange("2026-04-30", "2026-05-01", "2026-06-30"), false);
  });
});

describe("normalizeEodhdSymbol", () => {
  it("appends .US for bare tickers", () => {
    assert.equal(normalizeEodhdSymbol("KO"), "KO.US");
    assert.equal(normalizeEodhdSymbol("KO.US"), "KO.US");
  });
});
