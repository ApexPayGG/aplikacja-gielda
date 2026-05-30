import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { evaluateCompanyImportWaitRead } from "./companySearchModule.js";

describe("evaluateCompanyImportWaitRead", () => {
  const symbol = "AMD.US";

  it("returns null when lock held and count is only partial (e.g. 27)", () => {
    const result = evaluateCompanyImportWaitRead({
      quotesCount: 27,
      lockHeld: true,
      existingCount: 0,
      symbol,
    });
    assert.equal(result, null);
  });

  it("returns null when lock held and count is 20", () => {
    const result = evaluateCompanyImportWaitRead({
      quotesCount: 20,
      lockHeld: true,
      existingCount: 0,
      symbol,
    });
    assert.equal(result, null);
  });

  it("returns result when lock released and count >= 10", () => {
    const result = evaluateCompanyImportWaitRead({
      quotesCount: 251,
      lockHeld: false,
      existingCount: 0,
      symbol,
    });
    assert.ok(result);
    assert.equal(result.quotesCount, 251);
    assert.equal(result.shared, true);
    assert.equal(result.cacheHit, true);
    assert.equal(result.imported, true);
  });

  it("returns result when count >= 200 even if lock still held", () => {
    const result = evaluateCompanyImportWaitRead({
      quotesCount: 220,
      lockHeld: true,
      existingCount: 0,
      symbol,
    });
    assert.ok(result);
    assert.equal(result.quotesCount, 220);
  });

  it("returns null when lock released but count still below minimum", () => {
    const result = evaluateCompanyImportWaitRead({
      quotesCount: 5,
      lockHeld: false,
      existingCount: 0,
      symbol,
    });
    assert.equal(result, null);
  });
});
