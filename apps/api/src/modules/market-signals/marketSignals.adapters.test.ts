import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clampConfidence,
  getEodhdTransactionDirection,
  getEodhdTransactionValue,
  parseEodhdInsiderActivityPayload,
  parsePolygonDarkPoolPayload,
  parsePolygonOptionsFlowPayload,
  parseSecFilingPayload,
} from "./marketSignals.adapters";

describe("marketSignals.adapters", () => {
  it("maps high premium polygon options flow to OPTIONS_FLOW", () => {
    const signals = parsePolygonOptionsFlowPayload({
      results: [
        {
          ticker: "AAPL",
          underlying_ticker: "AAPL",
          contract_type: "call",
          expiration_date: "2026-06-19",
          strike_price: 250,
          volume: 12000,
          open_interest: 1800,
          premium: 5_200_000,
          trade_timestamp: "2026-05-23T14:30:00.000Z",
        },
      ],
    });

    assert.equal(signals.length, 1);
    assert.equal(signals[0]?.signalType, "OPTIONS_FLOW");
    assert.equal(signals[0]?.ticker, "AAPL");
    assert.match(signals[0]?.title ?? "", /AAPL unusual call options flow/i);
    assert.match(signals[0]?.title ?? "", /\$5\.2M premium/);
  });

  it("boosts options flow confidence from volume/open_interest ratio", () => {
    const signals = parsePolygonOptionsFlowPayload({
      results: [
        {
          ticker: "AAPL",
          contract_type: "put",
          volume: 9000,
          open_interest: 3000,
          premium: 1_500_000,
          trade_timestamp: "2026-05-23T14:30:00.000Z",
        },
      ],
    });

    assert.equal(signals[0]?.confidenceScore, 90);
  });

  it("ignores dark pool prints below $50M notional", () => {
    const signals = parsePolygonDarkPoolPayload({
      results: [
        {
          ticker: "AAPL",
          price: 190.12,
          size: 100_000,
          exchange: "DARK",
          sip_timestamp: "2026-05-23T15:45:00.000Z",
        },
      ],
    });

    assert.deepEqual(signals, []);
  });

  it("includes dark pool prints above $50M with confidence >= 70", () => {
    const signals = parsePolygonDarkPoolPayload({
      results: [
        {
          ticker: "AAPL",
          price: 190,
          size: 300_000,
          exchange: "DARK",
          sip_timestamp: "2026-05-23T15:45:00.000Z",
        },
      ],
    });

    assert.equal(signals.length, 1);
    assert.equal(signals[0]?.signalType, "DARK_POOL");
    assert.equal(signals[0]?.confidenceScore, 80);
    assert.match(signals[0]?.title ?? "", /\$57\.0M notional/);
  });

  it("maps SEC 10-Q filings to confidence 65", () => {
    const signals = parseSecFilingPayload({
      filings: [
        {
          ticker: "AAPL",
          form: "10-Q",
          accessionNumber: "0000320193-26-000010",
          filedAt: "2026-05-23T12:00:00.000Z",
          description: "Quarterly report",
        },
      ],
    });

    assert.equal(signals[0]?.confidenceScore, 65);
    assert.equal(signals[0]?.title, "AAPL SEC filing: 10-Q");
  });

  it("maps SEC 10-K filings to confidence 70", () => {
    const signals = parseSecFilingPayload({
      filings: [
        {
          ticker: "AAPL",
          form: "10-K",
          filedAt: "2026-05-23T12:00:00.000Z",
        },
      ],
    });

    assert.equal(signals[0]?.confidenceScore, 70);
  });

  it("maps EODHD insider purchase ticker from AAPL.US", () => {
    const signals = parseEodhdInsiderActivityPayload({
      data: [
        {
          code: "AAPL.US",
          ownerName: "Jane Doe",
          transactionDate: "2026-05-23",
          transactionCode: "P",
          securitiesTransacted: 5000,
          transactionPrice: 190,
        },
      ],
    });

    assert.equal(signals[0]?.ticker, "AAPL");
    assert.equal(signals[0]?.signalType, "INSIDER_ACTIVITY");
    assert.match(signals[0]?.title ?? "", /insider purchase: \$950\.0K by Jane Doe/);
    assert.match(signals[0]?.summary ?? "", /Estimated transaction value: \$950\.0K/);
    assert.equal(signals[0]?.confidenceScore, 65);
  });

  it("boosts EODHD insider purchase confidence for large transaction value", () => {
    const signals = parseEodhdInsiderActivityPayload({
      data: [
        {
          code: "AAPL.US",
          ownerName: "Jane Doe",
          transactionDate: "2026-05-23",
          transactionCode: "P",
          securitiesTransacted: 10_000,
          transactionPrice: 150,
        },
      ],
    });

    assert.equal(signals[0]?.confidenceScore, 75);
  });

  it("maps EODHD transactionCode P to purchase direction", () => {
    assert.equal(getEodhdTransactionDirection({ transactionCode: "P" }), "purchase");
  });

  it("maps EODHD transactionCode S to sale direction", () => {
    assert.equal(getEodhdTransactionDirection({ transactionCode: "S" }), "sale");
  });

  it("maps transactionAcquiredDisposed A to purchase when transactionCode is missing", () => {
    assert.equal(getEodhdTransactionDirection({ transactionAcquiredDisposed: "A" }), "purchase");
  });

  it("maps transactionAcquiredDisposed D to sale when transactionCode is missing", () => {
    assert.equal(getEodhdTransactionDirection({ transactionAcquiredDisposed: "D" }), "sale");
  });

  it("uses positive transactionAmount as EODHD transaction value", () => {
    assert.equal(
      getEodhdTransactionValue({
        transactionAmount: 1_250_000,
        securitiesTransacted: 100,
        transactionPrice: 10,
      }),
      1_250_000,
    );
  });

  it("falls back to securitiesTransacted times transactionPrice for EODHD value", () => {
    assert.equal(
      getEodhdTransactionValue({
        securitiesTransacted: 5000,
        transactionPrice: 190,
      }),
      950_000,
    );
  });

  it("falls back to transactionShares times transactionPrice for EODHD value", () => {
    assert.equal(
      getEodhdTransactionValue({
        transactionShares: 2000,
        transactionPrice: 250,
      }),
      500_000,
    );
  });

  it("does not include $0 in EODHD title when transaction value is missing", () => {
    const signals = parseEodhdInsiderActivityPayload({
      data: [
        {
          code: "MSFT.US",
          ownerName: "John Fetterman",
          transactionDate: "2026-05-23",
          transactionCode: "S",
        },
      ],
    });

    assert.match(signals[0]?.title ?? "", /MSFT insider sale disclosed by John Fetterman/);
    assert.ok(!(signals[0]?.title ?? "").includes("$0"));
    assert.match(signals[0]?.summary ?? "", /Transaction value was not disclosed in provider payload/);
  });

  it("uses sale wording in EODHD insider sale title", () => {
    const signals = parseEodhdInsiderActivityPayload({
      data: [
        {
          code: "MSFT.US",
          ownerName: "Jane Doe",
          transactionDate: "2026-05-23",
          transactionCode: "S",
          transactionAmount: 1_200_000,
        },
      ],
    });

    assert.match(signals[0]?.title ?? "", /MSFT insider sale: \$1\.2M by Jane Doe/);
    assert.ok(!(signals[0]?.title ?? "").includes("purchase"));
  });

  it("scores EODHD purchase confidence higher than sale and boosts large values", () => {
    const purchase = parseEodhdInsiderActivityPayload({
      data: [
        {
          code: "AAPL.US",
          ownerName: "Jane Doe",
          transactionDate: "2026-05-23",
          transactionCode: "P",
          transactionAmount: 1_000_000,
        },
      ],
    });
    const sale = parseEodhdInsiderActivityPayload({
      data: [
        {
          code: "AAPL.US",
          ownerName: "Jane Doe",
          transactionDate: "2026-05-23",
          transactionCode: "S",
          transactionAmount: 1_000_000,
        },
      ],
    });
    const largePurchase = parseEodhdInsiderActivityPayload({
      data: [
        {
          code: "AAPL.US",
          ownerName: "Jane Doe",
          transactionDate: "2026-05-23",
          transactionCode: "P",
          transactionAmount: 10_000_000,
        },
      ],
    });

    assert.ok((purchase[0]?.confidenceScore ?? 0) >= (sale[0]?.confidenceScore ?? 0));
    assert.equal(purchase[0]?.confidenceScore, 75);
    assert.equal(sale[0]?.confidenceScore, 70);
    assert.equal(largePurchase[0]?.confidenceScore, 80);
  });

  it("returns empty array for malformed payloads", () => {
    assert.deepEqual(parsePolygonOptionsFlowPayload(null), []);
    assert.deepEqual(parsePolygonDarkPoolPayload("bad"), []);
    assert.deepEqual(parseSecFilingPayload([]), []);
    assert.deepEqual(parseEodhdInsiderActivityPayload(undefined), []);
  });

  it("caps confidence at 100", () => {
    const signals = parsePolygonOptionsFlowPayload({
      results: [
        {
          ticker: "AAPL",
          contract_type: "call",
          volume: 30_000,
          open_interest: 1_000,
          premium: 5_000_000,
          trade_timestamp: "2026-05-23T14:30:00.000Z",
        },
      ],
    });

    assert.equal(clampConfidence(150), 100);
    assert.ok((signals[0]?.confidenceScore ?? 0) <= 100);
  });
});
