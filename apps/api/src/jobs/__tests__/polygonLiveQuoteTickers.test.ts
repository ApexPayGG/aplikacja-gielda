import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import pino from "pino";
import {
  parsePolygonLiveQuoteSymbols,
  resolvePolygonLiveQuoteTickers,
} from "../polygonLiveQuoteTickers.js";

const silentLogger = pino({ level: "silent" });

describe("parsePolygonLiveQuoteSymbols", () => {
  it('parses "AAPL, MSFT, aapl, ,NVDA" to deduped uppercase list', () => {
    assert.deepEqual(parsePolygonLiveQuoteSymbols("AAPL, MSFT, aapl, ,NVDA", 100), [
      "AAPL",
      "MSFT",
      "NVDA",
    ]);
  });

  it("respects topLimit cap on env list", () => {
    assert.deepEqual(
      parsePolygonLiveQuoteSymbols("AAPL,MSFT,NVDA,TSLA,SPY,QQQ", 2),
      ["AAPL", "MSFT"],
    );
  });

  it("returns empty for undefined or blank env", () => {
    assert.deepEqual(parsePolygonLiveQuoteSymbols(undefined, 25), []);
    assert.deepEqual(parsePolygonLiveQuoteSymbols("  ,  , ", 25), []);
  });
});

describe("resolvePolygonLiveQuoteTickers", () => {
  it("uses env symbols and does not call getTopStocks", async () => {
    const getTopStocks = mock.fn(async () => ["SHOULD_NOT_CALL"]);
    const out = await resolvePolygonLiveQuoteTickers({
      symbolsEnv: "AAPL, MSFT, aapl, ,NVDA",
      topLimit: 25,
      traceId: "t-env",
      polygon: { getTopStocks },
      logger: silentLogger,
    });
    assert.deepEqual(out.tickers, ["AAPL", "MSFT", "NVDA"]);
    assert.equal(out.source, "env_symbols");
    assert.equal(getTopStocks.mock.callCount(), 0);
  });

  it("applies topLimit when resolving env symbols", async () => {
    const getTopStocks = mock.fn(async () => []);
    const out = await resolvePolygonLiveQuoteTickers({
      symbolsEnv: "AAPL,MSFT,NVDA,TSLA,SPY,QQQ",
      topLimit: 2,
      traceId: "t-cap",
      polygon: { getTopStocks },
      logger: silentLogger,
    });
    assert.deepEqual(out.tickers, ["AAPL", "MSFT"]);
    assert.equal(getTopStocks.mock.callCount(), 0);
  });

  it("calls getTopStocks when env symbols not configured", async () => {
    const getTopStocks = mock.fn(async (limit: number) => ["REF1", "REF2"].slice(0, limit));
    const out = await resolvePolygonLiveQuoteTickers({
      symbolsEnv: undefined,
      topLimit: 2,
      traceId: "t-ref",
      polygon: { getTopStocks },
      logger: silentLogger,
    });
    assert.deepEqual(out.tickers, ["REF1", "REF2"]);
    assert.equal(out.source, "polygon_reference");
    assert.equal(getTopStocks.mock.callCount(), 1);
    assert.deepEqual(getTopStocks.mock.calls[0]?.arguments, [2, "t-ref"]);
  });

  it("warns and fallbacks when env is set but parses empty", async () => {
    const getTopStocks = mock.fn(async () => ["Z"]);
    const out = await resolvePolygonLiveQuoteTickers({
      symbolsEnv: "  , , ",
      topLimit: 5,
      traceId: "t-empty",
      polygon: { getTopStocks },
      logger: silentLogger,
    });
    assert.deepEqual(out.tickers, ["Z"]);
    assert.equal(out.source, "polygon_reference");
    assert.equal(getTopStocks.mock.callCount(), 1);
  });
});
