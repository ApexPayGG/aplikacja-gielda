import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { NewsletterService } from "../newsletter";

const originalFetch = globalThis.fetch;

describe("NewsletterService", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("sendDividendRadar sends email with subject, recipients and sections", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return {
        ok: true,
        status: 200,
        text: async () => "",
      } as Response;
    }) as typeof fetch;

    const service = new NewsletterService("re_test_key");
    await service.sendDividendRadar(["a@x.com", "b@y.com"], {
      top_dividends: [
        { ticker: "AAPL", dy: 3.2, payout_ratio: 55, health_score: 82, brief: "Strong FCF trend." },
      ],
      new_opportunities: [{ ticker: "MSFT", pattern: "breakout", score: 76 }],
      upcoming_ex_dates: [{ ticker: "KO", ex_date: "2026-05-20", amount: 0.48 }],
    });

    assert.equal(calls.length, 1);
    assert.match(calls[0]?.url ?? "", /api\.resend\.com\/emails/);
    const body = JSON.parse(String(calls[0]?.init?.body ?? "{}"));
    assert.ok(String(body.subject).includes("Dywidendowy Radar"));
    assert.deepEqual(body.to, ["a@x.com", "b@y.com"]);
    assert.match(String(body.html), /AAPL/);
    assert.match(String(body.html), /MSFT/);
    assert.match(String(body.html), /KO/);
  });
});
