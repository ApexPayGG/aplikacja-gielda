import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildQuoteSymbolCandidates,
  toEodhdSymbolFromTicker,
} from "../quoteSymbolResolution.js";

describe("quoteSymbolResolution", () => {
  it("builds AAPL and AAPL.US candidates", () => {
    const candidates = buildQuoteSymbolCandidates("AAPL");
    assert.deepEqual(candidates, ["AAPL", "AAPL.US"]);
  });

  it("resolves AAPL.US query to base and US variants", () => {
    const candidates = buildQuoteSymbolCandidates("AAPL.US");
    assert.ok(candidates.includes("AAPL.US"));
    assert.ok(candidates.includes("AAPL"));
  });

  it("adds WAR suffix when exchange is GPW", () => {
    const candidates = buildQuoteSymbolCandidates("PKN", "GPW");
    assert.ok(candidates.includes("PKN"));
    assert.ok(candidates.includes("PKN.WAR"));
    assert.ok(candidates.includes("PKN.US"));
  });

  it("adds XETRA suffix for DAX exchange", () => {
    const candidates = buildQuoteSymbolCandidates("SAP", "XETRA");
    assert.ok(candidates.includes("SAP.XETRA"));
  });

  it("toEodhdSymbol does not double suffix", () => {
    assert.equal(toEodhdSymbolFromTicker("PKN.WAR"), "PKN.WAR");
    assert.equal(toEodhdSymbolFromTicker("AAPL.US"), "AAPL.US");
  });

  it("toEodhdSymbol maps GPW base to WAR", () => {
    assert.equal(toEodhdSymbolFromTicker("PKN", "GPW"), "PKN.WAR");
  });

  it("toEodhdSymbol defaults to US", () => {
    assert.equal(toEodhdSymbolFromTicker("MSFT"), "MSFT.US");
  });
});
