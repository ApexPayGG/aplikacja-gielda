import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runDividendAlertsJob } from "../dividendAlerts";

describe("dividendAlerts job", () => {
  it("queues ex-date alerts for dividends in next 14 days", async () => {
    const queued: Array<{ name: string; payload: any }> = [];
    const now = new Date();
    const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const out = await runDividendAlertsJob({
      db: {
        dividend: {
          findMany: async (args?: any) => {
            if (args?.where?.exDate?.gte) {
              return [
                {
                  id: "d_future_1",
                  symbol: "AAPL",
                  exDate: in7d,
                  payDate: new Date(in7d.getTime() + 10 * 24 * 60 * 60 * 1000),
                  amount: 1.25,
                },
              ];
            }
            return [];
          },
        },
      } as never,
      alertQueue: {
        add: async (name: string, payload: any) => {
          queued.push({ name, payload });
          return {} as never;
        },
      } as never,
      idempotencyStore: {
        get: async () => null,
        set: async () => "OK",
      } as never,
      findUsersForTicker: async () => [{ id: "u1" }, { id: "u2" }],
    });

    assert.equal(out.exDateAlertsQueued, 2);
    assert.equal(queued.length, 2);
    assert.equal(queued[0]?.payload.type, "dividend:ex-date");
    assert.equal(queued[0]?.payload.ticker, "AAPL");
    assert.equal(queued[0]?.payload.amount, 1.25);
  });

  it("queues amount-change alerts for >10% YoY change", async () => {
    const queued: Array<{ name: string; payload: any }> = [];
    const now = new Date();
    const curr = new Date(Date.UTC(now.getUTCFullYear(), 3, 10));
    const prev = new Date(Date.UTC(now.getUTCFullYear() - 1, 3, 8));

    const out = await runDividendAlertsJob({
      db: {
        dividend: {
          findMany: async (args?: any) => {
            if (args?.where?.exDate?.gte && args?.where?.exDate?.lte) {
              const hasSymbol = Boolean(args?.where?.symbol);
              if (hasSymbol) {
                return [
                  {
                    id: "d_prev",
                    symbol: "MSFT",
                    exDate: prev,
                    payDate: new Date(prev.getTime() + 7 * 24 * 60 * 60 * 1000),
                    amount: 1.0,
                  },
                ];
              }
              // ex-date upcoming or current-year query
              if (args?.where?.exDate?.gte instanceof Date && args?.where?.exDate?.lte instanceof Date) {
                return [];
              }
            }
            if (args?.where?.exDate?.gte && !args?.where?.symbol) {
              return [
                {
                  id: "d_curr",
                  symbol: "MSFT",
                  exDate: curr,
                  payDate: new Date(curr.getTime() + 7 * 24 * 60 * 60 * 1000),
                  amount: 1.12,
                },
              ];
            }
            return [];
          },
        },
      } as never,
      alertQueue: {
        add: async (name: string, payload: any) => {
          queued.push({ name, payload });
          return {} as never;
        },
      } as never,
      idempotencyStore: {
        get: async () => null,
        set: async () => "OK",
      } as never,
      findUsersForTicker: async () => [{ id: "u_change" }],
    });

    assert.equal(out.changeAlertsQueued, 1);
    const changeAlert = queued.find((q) => q.payload.type === "dividend:change");
    assert.ok(changeAlert);
    assert.equal(changeAlert?.payload.ticker, "MSFT");
    assert.equal(changeAlert?.payload.old_amount, 1.0);
    assert.equal(changeAlert?.payload.new_amount, 1.12);
    assert.equal(changeAlert?.payload.change_pct, 12);
  });
});
