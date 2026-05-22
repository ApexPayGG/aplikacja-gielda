import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { symbolBase } from "./companyLogoLookup";

describe("companyLogoLookup", () => {
  it("symbolBase strips exchange suffix", () => {
    assert.equal(symbolBase("AAPL.US"), "AAPL");
    assert.equal(symbolBase("PKN"), "PKN");
    assert.equal(symbolBase("000660.KO"), "000660");
  });
});
