import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runPortfolioSnapshotsJob } from "../portfolioSnapshots";

describe("portfolioSnapshots job", () => {
  it("creates snapshots for 3 active users and computes averages", async () => {
    const created: Array<{ userId: string; total_value: number; pnl_pct: number; date: Date }> = [];
    const now = new Date();

    const out = await runPortfolioSnapshotsJob({
      db: {
        virtualTrade: {
          findMany: async () => [{ userId: "u1" }, { userId: "u2" }, { userId: "u3" }],
        },
      } as never,
      portfolioService: {
        takeSnapshot: async (userId: string) => {
          const v = userId === "u1" ? 10_000 : userId === "u2" ? 12_000 : 8_000;
          const pnl = userId === "u1" ? 2 : userId === "u2" ? 5 : -1;
          const row = { userId, total_value: v, pnl_pct: pnl, date: new Date(now) };
          created.push(row);
          return row as never;
        },
      },
    });

    assert.equal(created.length, 3);
    assert.equal(out.users_processed, 3);
    assert.equal(out.snapshots_created, 3);
    assert.equal(out.total_users_tracked, 3);
    assert.equal(out.avg_portfolio_value, 10_000);
    assert.equal(out.avg_pnl_pct, 2);

    for (const s of created) {
      assert.equal(s.date.toISOString().slice(0, 10), now.toISOString().slice(0, 10));
      assert.ok(Number.isFinite(s.total_value));
    }
  });
});
