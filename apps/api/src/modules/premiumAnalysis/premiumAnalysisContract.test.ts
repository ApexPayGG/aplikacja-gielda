import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildSamplePremiumAnalysisContract,
  PremiumAnalysisContractSchema,
  validatePremiumAnalysisContract,
} from "./premiumAnalysisContract";

describe("premiumAnalysisContract", () => {
  it("valid sample contract passes", () => {
    const sample = buildSamplePremiumAnalysisContract("MSFT.US");
    const result = validatePremiumAnalysisContract(sample);
    assert.equal(result.success, true);
    if (result.success) {
      assert.equal(result.data.symbol, "MSFT.US");
      assert.equal(result.data.executiveVerdict.label, "constructive");
    }
    const direct = PremiumAnalysisContractSchema.safeParse(sample);
    assert.equal(direct.success, true);
  });

  it("invalid verdict label fails", () => {
    const sample = buildSamplePremiumAnalysisContract();
    const invalid = {
      ...sample,
      executiveVerdict: {
        ...sample.executiveVerdict,
        label: "STRONG BUY",
      },
    };
    const result = validatePremiumAnalysisContract(invalid);
    assert.equal(result.success, false);
  });

  it("duplicate scenario type fails", () => {
    const sample = buildSamplePremiumAnalysisContract();
    const invalid = {
      ...sample,
      scenarios: {
        ...sample.scenarios,
        scenarios: [
          sample.scenarios.scenarios[0],
          { ...sample.scenarios.scenarios[1], name: "bull" as const },
          sample.scenarios.scenarios[2],
        ],
      },
    };
    const result = validatePremiumAnalysisContract(invalid);
    assert.equal(result.success, false);
  });
  it("missing scenario fails", () => {
    const sample = buildSamplePremiumAnalysisContract();
    const invalid = {
      ...sample,
      scenarios: {
        ...sample.scenarios,
        scenarios: sample.scenarios.scenarios.slice(0, 2),
      },
    };
    const result = validatePremiumAnalysisContract(invalid);
    assert.equal(result.success, false);
  });
});
