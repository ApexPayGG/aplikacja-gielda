import assert from "node:assert/strict";
import type { PrismaClient } from "@prisma/client";
import { describe, it } from "node:test";
import { deliverWatchlistDailyDigest } from "../eventDeliveryService";
import type { WatchlistDailyDigest } from "../types";

function createDigestDb(userIds: string[]) {
  let notificationCreates = 0;
  const deliveryRows = new Map<string, { status: string }>();

  const db = {
    watchlist: {
      findMany: async () => userIds.map((userId) => ({ userId })),
    },
    eventDelivery: {
      findUnique: async ({ where }: { where: { dedupeKey: string } }) =>
        deliveryRows.get(where.dedupeKey) ?? null,
      upsert: async ({ where, create }: { where: { dedupeKey: string }; create: { status: string } }) => {
        deliveryRows.set(where.dedupeKey, { status: create.status });
      },
    },
    notification: {
      create: async () => {
        notificationCreates += 1;
      },
    },
    get notificationCreates() {
      return notificationCreates;
    },
    seedDelivery(dedupeKey: string, status: string) {
      deliveryRows.set(dedupeKey, { status });
    },
  };

  return db as typeof db & PrismaClient;
}

const digestDeps = {
  buildWatchlistDailyDigest: async (userId: string): Promise<WatchlistDailyDigest> => {
    if (userId === "fail-user") throw new Error("digest failed");
    if (userId === "empty-user") return { headline: "empty", items: [] };
    return {
      headline: "2 events",
      items: [{ title: "AAPL earnings", symbol: "AAPL.US", eventType: "earnings", eventDate: "2026-06-01" }],
    };
  },
  ensureSystemAnchorEvent: async () => ({ id: "system-anchor" }),
};

describe("deliverWatchlistDailyDigest", () => {
  it("does not send notification when digest has no items", async () => {
    const db = createDigestDb(["empty-user"]);
    const result = await deliverWatchlistDailyDigest(db, digestDeps);
    assert.equal(result.digests, 0);
    assert.equal(db.notificationCreates, 0);
  });

  it("continues digest job when one user throws", async () => {
    const db = createDigestDb(["ok-user", "empty-user", "fail-user"]);
    const result = await deliverWatchlistDailyDigest(db, digestDeps);
    assert.equal(result.digests, 1);
    assert.equal(db.notificationCreates, 1);
  });

  it("skips digest when delivery row already exists", async () => {
    const db = createDigestDb(["ok-user"]);
    const dayKey = new Date().toISOString().slice(0, 10);
    db.seedDelivery(`digest:ok-user:${dayKey}`, "failed");
    const result = await deliverWatchlistDailyDigest(db, digestDeps);
    assert.equal(result.digests, 0);
    assert.equal(db.notificationCreates, 0);
  });
});
