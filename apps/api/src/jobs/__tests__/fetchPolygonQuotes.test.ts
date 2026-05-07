import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import {
  buildQuoteIdempotencyKey,
  runFetchPolygonQuotesJob,
  type FetchPolygonQuotesDeps,
} from "../fetchPolygonQuotes";

describe("fetchPolygonQuotes job", () => {
  it("buildQuoteIdempotencyKey is stable for ticker + bucket", () => {
    const b = new Date("2026-05-07T12:00:00.000Z");
    const a = buildQuoteIdempotencyKey("aapl", b);
    const b2 = buildQuoteIdempotencyKey("AAPL", b);
    assert.equal(a, b2);
    assert.equal(a.length, 64);
  });

  it("runFetchPolygonQuotesJob upserts per ticker and sends failures to DLQ", async () => {
    const upserts: unknown[] = [];
    const dlq: unknown[] = [];
    const bucket = new Date("2026-05-07T12:03:00.000Z");

    const deps: FetchPolygonQuotesDeps = {
      db: {
        liveQuote: {
          upsert: async (args: { where: { idempotencyKey: string }; create: Record<string, unknown> }) => {
            upserts.push(args);
            return { id: BigInt(1), ...args.create };
          },
        },
      } as unknown as FetchPolygonQuotesDeps["db"],
      polygon: {
        getTopStocks: async () => ["AAA", "BBB"],
        getLatestQuote: async (ticker: string) => {
          if (ticker === "BBB") throw new Error("polygon down");
          return {
            ticker,
            price: 10.5,
            open: 10,
            high: 11,
            low: 9.5,
            close: 10.5,
            volume: BigInt(1000),
            vwap: 10.25,
          };
        },
      },
      dlq: {
        add: async (_name: string, data: unknown) => {
          dlq.push(data);
        },
      } as unknown as FetchPolygonQuotesDeps["dlq"],
      cache: {
        setex: async () => "OK",
      } as unknown as FetchPolygonQuotesDeps["cache"],
      topLimit: 2,
      traceId: "trace-test",
      ingestBucket: bucket,
    };

    const out = await runFetchPolygonQuotesJob(deps);
    assert.equal(out.upserted, 1);
    assert.equal(out.failed, 1);
    assert.equal(out.dlqEnqueued, 1);
    assert.equal(upserts.length, 1);
    const create = (upserts[0] as { create: { ticker: string; price: Prisma.Decimal } }).create;
    assert.equal(create.ticker, "AAA");
    assert.equal(Number(create.price), 10.5);
    assert.ok(dlq.length >= 1);
  });
});
