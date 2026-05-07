import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { PolygonClient } from "../../../../packages/data/src/polygon/client";

describe("PolygonClient", () => {
  it("getTopStocks parses reference tickers", async () => {
    const fetchMock = mock.fn(async (url: string | URL) => {
      const u = String(url);
      assert.ok(u.includes("/v3/reference/tickers"));
      return new Response(
        JSON.stringify({
          results: [{ ticker: "A" }, { ticker: "B" }],
        }),
        { status: 200 },
      );
    });

    const client = new PolygonClient({
      apiKey: "test-key",
      fetchFn: fetchMock as unknown as typeof fetch,
    });
    const tickers = await client.getTopStocks(2, "tid");
    assert.deepEqual(tickers, ["A", "B"]);
    assert.equal(fetchMock.mock.calls.length, 1);
  });

  it("getLatestQuote uses 5m aggregate when present", async () => {
    let call = 0;
    const fetchMock = mock.fn(async (url: string | URL) => {
      call += 1;
      const u = String(url);
      if (u.includes("/v2/aggs/ticker")) {
        return new Response(
          JSON.stringify({
            results: [{ o: 1, h: 2, l: 0.5, c: 1.5, v: 100, vw: 1.25, t: 1_700_000_000_000 }],
          }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });

    const client = new PolygonClient({
      apiKey: "k",
      fetchFn: fetchMock as unknown as typeof fetch,
    });
    const q = await client.getLatestQuote("AAA", "t2");
    assert.equal(q.ticker, "AAA");
    assert.equal(q.price, 1.5);
    assert.equal(q.volume, BigInt(100));
    assert.ok(call >= 1);
  });
});
