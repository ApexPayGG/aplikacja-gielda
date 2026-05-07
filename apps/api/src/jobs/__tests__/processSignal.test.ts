import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { discordBot } from "../../integrations/discord";
import { processSignalLogger, runProcessSignalJob } from "../processSignal";

describe("processSignal job", () => {
  it("updates signal, queues alerts and posts Discord signal (GPW/US channel)", async () => {
    const queuedAlerts: Array<{ name: string; payload: unknown }> = [];
    const queuedDlq: Array<{ name: string; payload: unknown }> = [];
    const logs: Array<Record<string, unknown>> = [];
    const discordSignalCalls: Array<{ channel: string; payload: unknown }> = [];

    const signalRows = [
      {
        id: "sig_123",
        ticker: "AAPL",
        exchange: "GPW",
        pattern_type: "supportBounce",
        confidence: 85,
        technical_data: {
          rsi: 52,
          macd: 1.2,
          volume_ratio: 2.3,
          support_level: 184.5,
          price_position: 0.61,
        },
        historical_count: 30,
        win_rate: 64,
        avg_return_10d: 2.4,
        max_drawdown: 4.8,
        score: null,
      },
      {
        id: "sig_124",
        ticker: "MSFT",
        exchange: "US",
        pattern_type: "breakout",
        confidence: 82,
        technical_data: {
          rsi: 58,
          macd: 0.9,
          volume_ratio: 2.0,
          support_level: 300,
          price_position: 0.72,
        },
        historical_count: 26,
        win_rate: 61,
        avg_return_10d: 1.9,
        max_drawdown: 5.1,
        score: null,
      },
    ];

    const originalDiscordSendSignal = discordBot.sendSignal.bind(discordBot);
    (discordBot as { sendSignal: (channel: any, signal: any) => Promise<void> }).sendSignal = async (
      channel,
      signal,
    ) => {
      discordSignalCalls.push({ channel, payload: signal });
    };
    const originalInfo = processSignalLogger.info.bind(processSignalLogger);
    (processSignalLogger as unknown as { info: (obj: Record<string, unknown>) => void }).info = (
      obj: Record<string, unknown>,
    ) => {
      logs.push(obj);
      originalInfo(obj as never);
    };

    try {
      const dbMock = {
        signal: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            signalRows.find((s) => s.id === where.id) ?? null,
          update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
            const base = signalRows.find((s) => s.id === where.id)!;
            return { ...base, ...data };
          },
        },
        virtualTrade: {
          findFirst: async () => null,
        },
      } as never;

      const deps = {
        db: dbMock,
        fetchRecentNews: async () => [{ title: "Apple demand remains strong", timestamp: new Date(), sentiment: "positive" }],
        classifySentiment: async () => ({ score: 70, label: "positive" }),
        fetchMacroContext: async () => ({ marketSentiment: "bullish", sectorTrend: "up", vix: 16 }),
        generateSignalBrief: async () => ({ pl: "PL brief test", en: "EN brief test" }),
        scoreSignal: async () => ({
          score: 74,
          reasoning:
            "Score 74 bo: technical 80, history 65, sentiment 70, fundamentals 75, macro 60",
        }),
        getUsersWithMatchingCriteria: async () => [{ id: "u1" }, { id: "u2" }],
        alertQueue: {
          add: async (name: string, payload: unknown) => {
            queuedAlerts.push({ name, payload });
            return {} as never;
          },
        } as never,
        dlqQueue: {
          add: async (name: string, payload: unknown) => {
            queuedDlq.push({ name, payload });
            return {} as never;
          },
        } as never,
      };

      const out1 = await runProcessSignalJob({ signalId: "sig_123" }, deps);
      const out2 = await runProcessSignalJob({ signalId: "sig_124" }, deps);

      assert.equal(out1.signalId, "sig_123");
      assert.equal(out2.signalId, "sig_124");
      assert.equal(out1.score, 74);
      assert.equal(out2.score, 74);
      assert.equal(queuedAlerts.length, 4);
      assert.equal(queuedAlerts[0]?.name, "alert:push");
      assert.equal(queuedDlq.length, 0);
      assert.equal(discordSignalCalls.length, 2);
      assert.equal(discordSignalCalls[0]?.channel, "signals_gpw");
      assert.equal(discordSignalCalls[1]?.channel, "signals_us");

      const processedLog = logs.find((l) => l.msg === "signal_processed");
      assert.ok(processedLog, "Expected signal_processed log");
      assert.equal(processedLog?.score, 74);

      const alertPayload = queuedAlerts[0]?.payload as { signal: { brief_pl?: string; brief_en?: string; score?: number } };
      assert.ok(alertPayload.signal.brief_pl, "brief_pl should be populated");
      assert.ok(alertPayload.signal.brief_en, "brief_en should be populated");
      assert.equal(alertPayload.signal.score, 74);
    } finally {
      (discordBot as { sendSignal: typeof originalDiscordSendSignal }).sendSignal = originalDiscordSendSignal;
      (processSignalLogger as unknown as { info: typeof originalInfo }).info = originalInfo;
    }
  });
});
