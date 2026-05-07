import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { PrismaClient } from "@prisma/client";
import { runScanSignalsJob, scanSignalsLogger } from "../scanSignals";
import { runProcessSignalJob } from "../processSignal";

const TEST_SYMBOL = "AAPL";
const TEST_SOURCE = "scan-signals-integration";
const TEST_EXCHANGE = "US";

const testDbUrl = process.env.DATABASE_URL_TEST;

describe("scanSignals integration", { skip: !testDbUrl }, () => {
  const testPrisma = new PrismaClient({
    datasourceUrl: testDbUrl!,
  });

  async function seedQuotes30Bars5Days(): Promise<void> {
    const now = Date.now();
    const startMs = now - 5 * 24 * 60 * 60 * 1000;
    const stepMs = 4 * 60 * 60 * 1000;

    const rows = Array.from({ length: 30 }, (_, i) => {
      const base = 180 + i * 0.4;
      return {
        symbol: TEST_SYMBOL,
        timestamp: new Date(startMs + i * stepMs),
        open: base,
        high: base + 1.2,
        low: base - 0.8,
        close: base + 0.5,
        volume: BigInt(1_000_000 + i * 12_500),
        source: TEST_SOURCE,
      };
    });

    await testPrisma.quote.createMany({ data: rows });
  }

  const queuedProcessSignals: Array<{ name: string; payload: unknown }> = [];
  const queuedProcessAlerts: Array<{ name: string; payload: unknown }> = [];
  const capturedLogs: Array<Record<string, unknown>> = [];
  let originalInfo: typeof scanSignalsLogger.info;
  let createdSignalId: string | null = null;
  let runStartedAt = new Date();

  before(async () => {
    await testPrisma.company.upsert({
      where: { symbol: TEST_SYMBOL },
      update: {},
      create: {
        symbol: TEST_SYMBOL,
        name: "Apple Inc. (integration)",
        sector: "Technology",
        industry: "Consumer Electronics",
        webUrl: "https://apple.com",
      },
    });

    await testPrisma.signal.deleteMany({
      where: { ticker: TEST_SYMBOL, exchange: TEST_EXCHANGE },
    });
    await testPrisma.quote.deleteMany({
      where: { symbol: TEST_SYMBOL, source: TEST_SOURCE },
    });

    await seedQuotes30Bars5Days();

    originalInfo = scanSignalsLogger.info.bind(scanSignalsLogger);
    (scanSignalsLogger as unknown as { info: (obj: Record<string, unknown>) => void }).info = (
      obj: Record<string, unknown>,
    ) => {
      capturedLogs.push(obj);
      originalInfo(obj as never);
    };
  });

  after(async () => {
    (scanSignalsLogger as unknown as { info: typeof originalInfo }).info = originalInfo;
    if (createdSignalId) {
      await testPrisma.signal.delete({ where: { id: createdSignalId } }).catch(() => undefined);
    }
    await testPrisma.quote.deleteMany({ where: { symbol: TEST_SYMBOL, source: TEST_SOURCE } });
    await testPrisma.$disconnect();
  });

  it("creates signal, enqueues process job and validates scan -> process -> alert flow", async () => {
    runStartedAt = new Date();
    queuedProcessSignals.length = 0;
    queuedProcessAlerts.length = 0;
    capturedLogs.length = 0;

    const result = await runScanSignalsJob({
      db: testPrisma as never,
      cache: {
        get: async () => null,
        setex: async () => "OK",
      },
      loadTopTickers: async () => [TEST_SYMBOL],
      fetchAnalyze: async () => ({
        anomalies: [{ type: "volumeAnomaly", ratio: 2.3 }],
        patterns: [{ type: "supportBounce", confidence: 85 }],
      }),
      processSignalQueue: {
        add: async (name: string, payload: unknown) => {
          queuedProcessSignals.push({ name, payload });
          return {} as never;
        },
      } as never,
    });

    const signal = await testPrisma.signal.findFirst({
      where: { ticker: TEST_SYMBOL, exchange: TEST_EXCHANGE },
      orderBy: { created_at: "desc" },
    });
    assert.ok(signal, "Signal should be created");
    createdSignalId = signal?.id ?? null;

    assert.equal(result.processed, 1);
    assert.equal(result.signals_created, 1);
    assert.equal(result.alerts_queued, 1);
    assert.equal(signal?.pattern_type, "supportBounce");
    assert.equal(signal?.confidence, 85);
    assert.ok(signal?.technical_data, "technical_data should be populated");

    const technicalData = signal?.technical_data as { anomalies?: unknown[]; patterns?: unknown[] } | null;
    assert.equal(technicalData?.anomalies?.length ?? 0, 1);
    assert.equal(technicalData?.patterns?.length ?? 0, 1);

    const expectedMin = new Date(runStartedAt.getTime() + 24 * 60 * 60 * 1000 - 60_000);
    const expectedMax = new Date(runStartedAt.getTime() + 24 * 60 * 60 * 1000 + 60_000);
    assert.ok(
      signal?.expires_at && signal.expires_at >= expectedMin && signal.expires_at <= expectedMax,
      "expires_at should be now + 24h (+/- 60s)",
    );

    assert.equal(queuedProcessSignals.length, 1);
    assert.equal(queuedProcessSignals[0]?.name, "process:signal");
    const processPayload = queuedProcessSignals[0]?.payload as { signalId?: string } | undefined;
    assert.equal(processPayload?.signalId, signal?.id);

    await runProcessSignalJob(
      { signalId: signal?.id ?? "" },
      {
        db: testPrisma as never,
        fetchRecentNews: async () => [{ title: "Apple momentum remains strong", timestamp: new Date() }],
        classifySentiment: async () => ({ score: 68, label: "positive" }),
        fetchMacroContext: async () => ({ marketSentiment: "bullish", sectorTrend: "up", vix: 17 }),
        generateSignalBrief: async () => ({ pl: "PL generated brief", en: "EN generated brief" }),
        scoreSignal: async () => ({
          score: 74,
          reasoning:
            "Score 74 bo: technical 80, history 65, sentiment 70, fundamentals 75, macro 60",
        }),
        getUsersWithMatchingCriteria: async () => [{ id: "process-user-1" }],
        alertQueue: {
          add: async (name: string, payload: unknown) => {
            queuedProcessAlerts.push({ name, payload });
            return {} as never;
          },
        } as never,
        dlqQueue: {
          add: async () => ({} as never),
        } as never,
      },
    );

    const processedSignal = await testPrisma.signal.findUnique({ where: { id: signal?.id } });
    assert.ok(processedSignal?.brief_pl, "brief_pl should be populated after process job");
    assert.ok(processedSignal?.brief_en, "brief_en should be populated after process job");
    assert.equal(processedSignal?.score, 74);
    assert.equal(queuedProcessAlerts.length, 1);
    assert.equal(queuedProcessAlerts[0]?.name, "alert:push");

    const finishLog = capturedLogs.find((l) => l.msg === "scan_signals_finished");
    assert.ok(finishLog, "Expected pino finish log");
    assert.equal(finishLog?.signals_created, 1);
  });
});
