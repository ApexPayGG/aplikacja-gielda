import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBehavioralAnalysis,
  detectFomoBias,
  detectLowConvictionChasing,
  detectOvertrading,
  detectRevengeTrading,
  detectSizeEscalation,
  resolveRiskLevel,
} from "./traderPsyche.service";
import type { NormalizedTradeRecord, PreTradeCheckInput } from "./traderPsyche.types";

const USER_ID = "user-1";

function at(iso: string): Date {
  return new Date(iso);
}

function makeTrade(overrides: Partial<NormalizedTradeRecord> & Pick<NormalizedTradeRecord, "id" | "openedAt">): NormalizedTradeRecord {
  return {
    userId: USER_ID,
    ticker: "AAPL",
    side: "BUY",
    notional: 1_000,
    quantity: 10,
    closedAt: null,
    pnlAmount: null,
    pnlPct: null,
    signalScore: null,
    intradayMovePct: null,
    fundamentalsChecked: null,
    ...overrides,
  };
}

describe("TraderPsycheService behavioral detection", () => {
  it("detects FOMO_BIAS for long entry after +15% move without fundamentals check", () => {
    const proposal: PreTradeCheckInput = {
      ticker: "AAPL",
      side: "BUY",
      intradayMovePct: 16,
      fundamentalsChecked: false,
    };
    assert.equal(detectFomoBias(proposal), true);
  });

  it("detects REVENGE_TRADING when reopening within 30 minutes after a loss", () => {
    const trades = [
      makeTrade({
        id: "loss-1",
        openedAt: at("2026-05-22T10:00:00.000Z"),
        closedAt: at("2026-05-22T10:05:00.000Z"),
        pnlAmount: -120,
      }),
      makeTrade({
        id: "revenge-1",
        openedAt: at("2026-05-22T10:20:00.000Z"),
      }),
    ];

    assert.equal(detectRevengeTrading(trades, at("2026-05-22T12:00:00.000Z")), true);
  });

  it("detects OVERTRADING when more than 10 trades occur in one day", () => {
    const day = "2026-05-22";
    const trades = Array.from({ length: 11 }, (_, index) =>
      makeTrade({
        id: `trade-${index}`,
        openedAt: at(`${day}T${String(10 + index).padStart(2, "0")}:00:00.000Z`),
      }),
    );

    assert.equal(detectOvertrading(trades, at(`${day}T20:00:00.000Z`)), true);
  });

  it("detects SIZE_ESCALATION when next size is at least 2x median after a loss", () => {
    const trades = [
      ...Array.from({ length: 9 }, (_, index) =>
        makeTrade({
          id: `base-${index}`,
          openedAt: at(`2026-05-20T${String(10 + index).padStart(2, "0")}:00:00.000Z`),
          notional: 1_000,
        }),
      ),
      makeTrade({
        id: "loss",
        openedAt: at("2026-05-21T10:00:00.000Z"),
        closedAt: at("2026-05-21T10:30:00.000Z"),
        pnlAmount: -150,
        notional: 1_000,
      }),
    ];

    assert.equal(detectSizeEscalation(trades, 2_500), true);
  });

  it("detects LOW_CONVICTION_CHASING for weak signal into extended move", () => {
    const proposal: PreTradeCheckInput = {
      ticker: "NVDA",
      side: "LONG",
      signalScore: 55,
      intradayMovePct: 6.5,
    };
    assert.equal(detectLowConvictionChasing(proposal), true);
  });

  it("returns LOW risk and ALLOW for clean user history", () => {
    const trades = [
      makeTrade({ id: "clean-1", openedAt: at("2026-05-20T10:00:00.000Z"), notional: 1_000 }),
      makeTrade({
        id: "clean-2",
        openedAt: at("2026-05-21T11:00:00.000Z"),
        closedAt: at("2026-05-21T15:00:00.000Z"),
        pnlAmount: 80,
        notional: 1_100,
      }),
    ];

    const result = buildBehavioralAnalysis({
      userId: USER_ID,
      trades,
      now: at("2026-05-22T12:00:00.000Z"),
      lookbackDays: 30,
      ticker: null,
    });

    assert.equal(result.riskLevel, "LOW");
    assert.equal(result.recommendedAction, "ALLOW");
    assert.equal(result.flags.length, 0);
    assert.equal(result.score, 0);
  });

  it("raises riskLevel to HIGH or CRITICAL when multiple flags combine", () => {
    const day = "2026-05-22";
    const trades = [
      makeTrade({
        id: "loss-1",
        openedAt: at(`${day}T09:00:00.000Z`),
        closedAt: at(`${day}T09:10:00.000Z`),
        pnlAmount: -100,
      }),
      makeTrade({
        id: "loss-2",
        openedAt: at(`${day}T09:20:00.000Z`),
        closedAt: at(`${day}T09:25:00.000Z`),
        pnlAmount: -80,
      }),
      makeTrade({ id: "tilt-1", openedAt: at(`${day}T09:30:00.000Z`) }),
      makeTrade({ id: "tilt-2", openedAt: at(`${day}T09:40:00.000Z`) }),
      makeTrade({ id: "tilt-3", openedAt: at(`${day}T09:50:00.000Z`) }),
      makeTrade({
        id: "revenge",
        openedAt: at(`${day}T09:55:00.000Z`),
      }),
    ];

    const proposal: PreTradeCheckInput = {
      ticker: "TSLA",
      side: "BUY",
      intradayMovePct: 18,
      signalScore: 50,
      intendedNotional: 5_000,
      fundamentalsChecked: false,
    };

    const result = buildBehavioralAnalysis({
      userId: USER_ID,
      trades,
      now: at(`${day}T12:00:00.000Z`),
      lookbackDays: 30,
      ticker: proposal.ticker,
      proposal,
    });

    assert.ok(["HIGH", "CRITICAL"].includes(result.riskLevel));
    assert.ok(result.flags.includes("FOMO_BIAS"));
    assert.ok(result.flags.includes("LOW_CONVICTION_CHASING"));
    assert.ok(result.score >= 46);
    assert.notEqual(result.recommendedAction, "ALLOW");
    assert.equal(resolveRiskLevel(result.score, result.flags), result.riskLevel);
  });
});
