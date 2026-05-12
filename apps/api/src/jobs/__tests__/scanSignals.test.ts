import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { MarketBar } from "../scanSignals";
import { runScanSignalsJob } from "../scanSignals";

function buildBars(count: number): MarketBar[] {
  return Array.from({ length: count }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 0, i + 1)).toISOString(),
    open: 100 + i,
    high: 101 + i,
    low: 99 + i,
    close: 100.5 + i,
    volume: 1000 + i * 10,
  }));
}

describe("scanSignals job", () => {
  it("creates signal and enqueues process:signal job when anomalies/patterns exist", async () => {
    const createdSignals: Array<Record<string, unknown>> = [];
    const queuedProcessSignals: Array<{ name: string; payload: unknown }> = [];
    const bars = buildBars(30);

    const result = await runScanSignalsJob({
      db: {
        quote: {
          findMany: async () =>
            bars
              .slice()
              .reverse()
              .map((bar) => ({
                symbol: "AAPL.US",
                timestamp: new Date(bar.timestamp),
                open: bar.open,
                high: bar.high,
                low: bar.low,
                close: bar.close,
                volume: BigInt(bar.volume),
              })),
        },
        company: {
          findFirst: async () => ({ exchange: "US" }),
        },
        signal: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdSignals.push(data);
            return { id: "sig_1", ...data };
          },
        },
      } as never,
      cache: {
        get: async () => null,
        setex: async () => "OK",
      },
      loadTopTickers: async () => ["AAPL"],
      fetchAnalyze: async () => ({
        anomalies: [{ type: "volume_spike" }],
        patterns: [{ type: "bull_flag" }],
      }),
      processSignalQueue: {
        add: async (name: string, payload: unknown) => {
          queuedProcessSignals.push({ name, payload });
          return {} as never;
        },
      } as never,
    });

    assert.equal(result.processed, 1);
    assert.equal(result.signals_created, 1);
    assert.equal(result.alerts_queued, 1);
    assert.equal(createdSignals.length, 1);
    assert.equal(queuedProcessSignals.length, 1);
    assert.equal(queuedProcessSignals[0]?.name, "process:signal");
  });

  it("falls back to exchange suffix when exact ticker has no quotes", async () => {
    const createdSignals: Array<Record<string, unknown>> = [];
    const queuedProcessSignals: Array<{ name: string; payload: unknown }> = [];
    const bars = buildBars(30);
    let quoteFindManyCalls = 0;

    const result = await runScanSignalsJob({
      db: {
        quote: {
          findMany: async ({ where }: { where?: { symbol?: string } }) => {
            quoteFindManyCalls += 1;
            if (where?.symbol === "AAPL.US") {
              return bars
                .slice()
                .reverse()
                .map((bar) => ({
                  symbol: "AAPL.US",
                  timestamp: new Date(bar.timestamp),
                  open: bar.open,
                  high: bar.high,
                  low: bar.low,
                  close: bar.close,
                  volume: BigInt(bar.volume),
                }));
            }
            return [];
          },
        },
        company: {
          findFirst: async () => ({ exchange: "US" }),
        },
        signal: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            createdSignals.push(data);
            return { id: "sig_2", ...data };
          },
        },
      } as never,
      cache: {
        get: async () => null,
        setex: async () => "OK",
      },
      loadTopTickers: async () => ["AAPL"],
      fetchAnalyze: async () => ({
        anomalies: [{ type: "volume_spike" }],
        patterns: [{ type: "bull_flag" }],
      }),
      processSignalQueue: {
        add: async (name: string, payload: unknown) => {
          queuedProcessSignals.push({ name, payload });
          return {} as never;
        },
      } as never,
    });

    assert.ok(quoteFindManyCalls >= 2);
    assert.equal(result.processed, 1);
    assert.equal(result.signals_created, 1);
    assert.equal(result.alerts_queued, 1);
    assert.equal(createdSignals.length, 1);
    assert.equal(queuedProcessSignals.length, 1);
    assert.equal(queuedProcessSignals[0]?.name, "process:signal");
  });
});
