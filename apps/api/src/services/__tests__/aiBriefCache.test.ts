import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AnalysisResult } from "../../ai/analysis";
import {
  BriefGenerationBusyError,
  storeCachedBrief,
  withBriefGenerationLock,
} from "../aiBriefCache";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sampleBrief(): AnalysisResult {
  return {
    brief: "Test brief body",
    updatedAt: new Date().toISOString(),
    requestedLang: "en",
    sections: [{ lang: "en", body: "Test brief body" }],
  };
}

describe("withBriefGenerationLock", () => {
  it("does not run work twice while lock is held (memory lock fallback)", async () => {
    const prevRedis = process.env.REDIS_URL;
    const prevWait = process.env.AI_BRIEF_LOCK_WAIT_MS;
    delete process.env.REDIS_URL;
    process.env.AI_BRIEF_LOCK_WAIT_MS = "500";

    try {
      let runs = 0;
      const symbol = `LOCK_${Date.now()}`;

      const first = withBriefGenerationLock(symbol, "en", async () => {
        runs += 1;
        await sleep(200);
        return sampleBrief();
      });

      await sleep(30);
      await assert.rejects(
        withBriefGenerationLock(symbol, "en", async () => {
          runs += 1;
          return sampleBrief();
        }),
        BriefGenerationBusyError,
      );

      await first;
      assert.equal(runs, 1);
    } finally {
      if (prevRedis) process.env.REDIS_URL = prevRedis;
      else delete process.env.REDIS_URL;
      if (prevWait) process.env.AI_BRIEF_LOCK_WAIT_MS = prevWait;
      else delete process.env.AI_BRIEF_LOCK_WAIT_MS;
    }
  });

  it("waiter reuses cache after leader stores result (requires Redis)", async () => {
    if (!process.env.REDIS_URL?.trim()) return;

    let runs = 0;
    const symbol = `STAMPEDE_${Date.now()}`;

    const work = async (): Promise<AnalysisResult> => {
      runs += 1;
      await sleep(100);
      const payload = sampleBrief();
      await storeCachedBrief(symbol, "en", payload);
      return payload;
    };

    const [a, b] = await Promise.all([
      withBriefGenerationLock(symbol, "en", work),
      withBriefGenerationLock(symbol, "en", work),
    ]);

    assert.equal(runs, 1);
    assert.equal(a.brief, b.brief);
  });
});
