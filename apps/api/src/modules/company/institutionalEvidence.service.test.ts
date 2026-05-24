import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MarketSignalDto } from "../market-signals/marketSignals.types";
import {
  buildDirtyTruthCandidates,
  buildInstitutionalEvidenceFromSignals,
  classifyInsiderSignal,
  computeEvidenceScore,
  getInstitutionalEvidence,
  interpretSignal,
  INSTITUTIONAL_EVIDENCE_MAX_BLOCKS,
} from "./institutionalEvidence.service";

const FIXED_NOW = new Date("2026-05-24T12:00:00.000Z");

function makeSignal(overrides: Partial<MarketSignalDto> & Pick<MarketSignalDto, "id" | "signalType" | "title">): MarketSignalDto {
  return {
    ticker: "AAPL",
    source: "test-source",
    confidenceScore: 70,
    summary: null,
    rawPayload: null,
    eventTime: "2026-05-20T10:00:00.000Z",
    createdAt: "2026-05-20T10:00:00.000Z",
    updatedAt: "2026-05-20T10:00:00.000Z",
    ...overrides,
  };
}

describe("institutionalEvidence.service", () => {
  it("returns empty summary with evidenceScore 0 and limitations when no signals exist", async () => {
    const response = await getInstitutionalEvidence(
      { ticker: "AAPL", lookbackDays: 90 },
      {
        now: () => FIXED_NOW,
        listSignals: async () => ({
          ticker: "AAPL",
          lookbackDays: 90,
          signals: [],
          summary: {
            total: 0,
            byType: {},
            strongestSignalType: null,
            averageConfidenceScore: 0,
            whaleAccumulationDetected: false,
          },
        }),
      },
    );

    assert.equal(response.summary.totalSignals, 0);
    assert.equal(response.summary.evidenceScore, 0);
    assert.equal(response.evidenceBlocks.length, 0);
    assert.ok(response.limitations.some((item) => item.includes("No institutional signals")));
  });

  it("produces positive interpretation for insider purchase", () => {
    const signal = makeSignal({
      id: "sig-purchase",
      signalType: "INSIDER_ACTIVITY",
      title: "AAPL insider purchase: $250.0K by Jane Doe",
      summary: "Reported insider purchase by Jane Doe. Estimated transaction value: $250.0K.",
    });

    const interpretation = interpretSignal(signal);
    assert.equal(interpretation.stance, "positive");
    assert.match(interpretation.text, /insider purchase/i);
  });

  it("produces caution interpretation for insider sale", () => {
    const signal = makeSignal({
      id: "sig-sale",
      signalType: "INSIDER_ACTIVITY",
      title: "AAPL insider sale: $900.0K by John Doe",
      summary: "Reported insider sale by John Doe. Estimated transaction value: $900.0K.",
    });

    const interpretation = interpretSignal(signal);
    assert.equal(interpretation.stance, "caution");
    assert.match(interpretation.text, /insider sale/i);
  });

  it("uses conservative congress wording without executive insider framing", () => {
    const signal = makeSignal({
      id: "sig-congress",
      signalType: "INSIDER_ACTIVITY",
      title: "AAPL insider purchase disclosed by Senator Example",
      summary: "Congressional STOCK Act disclosure by Senator Example.",
      rawPayload: {
        ownerTitle: "United States Senator",
        transactionCode: "P",
      },
    });

    const interpretation = interpretSignal(signal);
    assert.equal(classifyInsiderSignal(signal).isCongress, true);
    assert.equal(interpretation.stance, "neutral");
    assert.match(interpretation.text, /legislative officeholder/i);
    assert.match(interpretation.text, /not corporate insider activity/i);
  });

  it("does not fabricate amount when insider value is missing", () => {
    const signal = makeSignal({
      id: "sig-no-value",
      signalType: "INSIDER_ACTIVITY",
      title: "MSFT insider sale disclosed by John Fetterman",
      summary:
        "Reported insider sale by John Fetterman. Transaction value was not disclosed in provider payload.",
    });

    const classification = classifyInsiderSignal(signal);
    assert.equal(classification.transactionValue, null);
    assert.equal(classification.valueDisclosed, false);

    const interpretation = interpretSignal(signal);
    assert.match(interpretation.limitation, /not disclosed/i);
    assert.ok(!interpretation.text.includes("$0"));
  });

  it("uses attention wording for dark pool without buy/sell claims", () => {
    const signal = makeSignal({
      id: "sig-dark",
      signalType: "DARK_POOL",
      title: "AAPL dark pool print detected",
      summary: "Large off-exchange print reported.",
    });

    const interpretation = interpretSignal(signal);
    assert.equal(interpretation.stance, "attention");
    assert.match(interpretation.text, /off-exchange activity/i);
    assert.ok(!interpretation.text.toLowerCase().includes("smart money is buying"));
  });

  it("uses attention wording for options flow without buy/sell claims", () => {
    const signal = makeSignal({
      id: "sig-options",
      signalType: "OPTIONS_FLOW",
      title: "AAPL options flow spike",
      summary: "Elevated options activity detected.",
    });

    const interpretation = interpretSignal(signal);
    assert.equal(interpretation.stance, "attention");
    assert.match(interpretation.text, /speculative attention/i);
    assert.ok(!interpretation.text.toLowerCase().includes("buy"));
    assert.ok(!interpretation.text.toLowerCase().includes("sell"));
  });

  it("creates dirty truth candidate for repeated insider sales", () => {
    const signals = Array.from({ length: 3 }).map((_, index) =>
      makeSignal({
        id: `sale-${index}`,
        signalType: "INSIDER_ACTIVITY",
        title: `AAPL insider sale: $100.0K by Seller ${index}`,
        summary: `Reported insider sale by Seller ${index}. Estimated transaction value: $100.0K.`,
        eventTime: `2026-05-${10 + index}T10:00:00.000Z`,
      }),
    );

    const candidates = buildDirtyTruthCandidates(signals);
    assert.ok(candidates.some((candidate) => candidate.title === "Repeated insider selling"));
  });

  it("creates high-severity dirty truth candidate when aggregate sale value is at least 1M", () => {
    const signals = [
      makeSignal({
        id: "sale-1",
        signalType: "INSIDER_ACTIVITY",
        title: "AAPL insider sale: $600.0K by Exec A",
        summary: "Reported insider sale by Exec A. Estimated transaction value: $600.0K.",
      }),
      makeSignal({
        id: "sale-2",
        signalType: "INSIDER_ACTIVITY",
        title: "AAPL insider sale: $500.0K by Exec B",
        summary: "Reported insider sale by Exec B. Estimated transaction value: $500.0K.",
      }),
    ];

    const candidates = buildDirtyTruthCandidates(signals);
    const material = candidates.find((candidate) => candidate.title === "Material aggregate insider selling");
    assert.ok(material);
    assert.equal(material?.severity, "high");
  });

  it("does not return rawPayload in institutional evidence response", () => {
    const response = buildInstitutionalEvidenceFromSignals({
      ticker: "AAPL",
      lookbackDays: 90,
      now: FIXED_NOW,
      signals: [
        makeSignal({
          id: "sig-secret",
          signalType: "INSIDER_ACTIVITY",
          title: "AAPL insider purchase: $100.0K by Jane Doe",
          rawPayload: { secretField: "hidden-provider-data", transactionCode: "P" },
        }),
      ],
    });

    const serialized = JSON.stringify(response);
    assert.ok(!serialized.includes("rawPayload"));
    assert.ok(!serialized.includes("hidden-provider-data"));
    assert.equal("rawPayload" in (response.evidenceBlocks[0] ?? {}), false);
  });

  it("caps evidence blocks to 20", () => {
    const signals = Array.from({ length: 25 }).map((_, index) =>
      makeSignal({
        id: `sig-${index}`,
        signalType: "SEC_FILING",
        title: `Filing ${index}`,
        confidenceScore: 50 + index,
        eventTime: `2026-05-${String(Math.min(28, index + 1)).padStart(2, "0")}T10:00:00.000Z`,
      }),
    );

    const response = buildInstitutionalEvidenceFromSignals({
      ticker: "AAPL",
      lookbackDays: 90,
      now: FIXED_NOW,
      signals,
    });

    assert.equal(response.evidenceBlocks.length, INSTITUTIONAL_EVIDENCE_MAX_BLOCKS);
    assert.equal(response.evidenceBlocks[0]?.confidenceScore, 74);
  });

  it("computes deterministic bounded evidenceScore", () => {
    const signals = [
      makeSignal({
        id: "sig-1",
        signalType: "INSIDER_ACTIVITY",
        title: "AAPL insider purchase: $250.0K by Jane Doe",
        confidenceScore: 80,
        eventTime: "2026-05-22T10:00:00.000Z",
      }),
      makeSignal({
        id: "sig-2",
        signalType: "DARK_POOL",
        title: "AAPL dark pool print detected",
        confidenceScore: 75,
        eventTime: "2026-05-21T10:00:00.000Z",
      }),
      makeSignal({
        id: "sig-3",
        signalType: "OPTIONS_FLOW",
        title: "AAPL options flow spike",
        confidenceScore: 70,
        eventTime: "2026-05-20T10:00:00.000Z",
      }),
    ];

    const first = computeEvidenceScore(signals, FIXED_NOW);
    const second = computeEvidenceScore(signals, FIXED_NOW);
    assert.equal(first, second);
    assert.ok(first >= 0 && first <= 100);
  });
});
