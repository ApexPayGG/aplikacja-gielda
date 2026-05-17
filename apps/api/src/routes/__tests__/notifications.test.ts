import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createNotificationsRouter } from "../notifications";

describe("notifications preferences routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createNotificationsRouter({
        getPreferencesFn: async () => ({
          discordWebhook: "https://discord.com/api/webhooks/demo/123",
          telegramChatId: "111222333",
          notifySignals: true,
          notifyDividends: false,
          minSignalScore: 75,
        }),
        updatePreferencesFn: async (_userId, input) => ({
          discordWebhook: input.discordWebhook ?? null,
          telegramChatId: input.telegramChatId ?? null,
          notifySignals: input.notifySignals ?? true,
          notifyDividends: input.notifyDividends ?? true,
          minSignalScore: input.minSignalScore ?? 70,
        }),
        sendTestNotificationFn: async () => ({ discordSent: true, telegramSent: true }),
        listNotificationsFn: async (_userId, limit) => ({
          notifications: [
            {
              id: "n-1",
              userId: "demo-user",
              type: "SIGNAL",
              title: "Nowy sygnał",
              message: "AAPL przekroczył poziom wejścia",
              read: false,
              link: "/signals/AAPL",
              createdAt: new Date("2026-05-17T20:00:00.000Z"),
            },
            {
              id: "n-2",
              userId: "demo-user",
              type: "SYSTEM",
              title: "Aktualizacja",
              message: "Aplikacja została zaktualizowana",
              read: true,
              link: null,
              createdAt: new Date("2026-05-17T19:00:00.000Z"),
            },
          ].slice(0, limit),
          unreadCount: 1,
        }),
        markAllAsReadFn: async () => ({ updatedCount: 3 }),
        markNotificationAsReadFn: async (id) => ({
          id,
          userId: "demo-user",
          type: "SIGNAL",
          title: "Nowy sygnał",
          message: "AAPL przekroczył poziom wejścia",
          read: true,
          link: "/signals/AAPL",
          createdAt: new Date("2026-05-17T20:00:00.000Z"),
        }),
      }),
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("GET /api/notifications/preferences/:userId returns user preferences", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/preferences/demo-user`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { minSignalScore: number; notifyDividends: boolean };
    assert.equal(body.minSignalScore, 75);
    assert.equal(body.notifyDividends, false);
  });

  it("PUT /api/notifications/preferences/:userId saves preferences", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/preferences/demo-user`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        discordWebhook: "https://discord.com/api/webhooks/new/123",
        telegramChatId: "888999",
        notifySignals: false,
        notifyDividends: true,
        minSignalScore: 90,
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { notifySignals: boolean; minSignalScore: number };
    assert.equal(body.notifySignals, false);
    assert.equal(body.minSignalScore, 90);
  });

  it("POST /api/notifications/preferences/:userId/test triggers test send", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/preferences/demo-user/test`, {
      method: "POST",
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { discordSent: boolean; telegramSent: boolean };
    assert.equal(body.discordSent, true);
    assert.equal(body.telegramSent, true);
  });

  it("GET /api/notifications/:userId returns notifications and unread count", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/demo-user?limit=1`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { notifications: Array<{ id: string }>; unreadCount: number };
    assert.equal(body.notifications.length, 1);
    assert.equal(body.notifications[0]?.id, "n-1");
    assert.equal(body.unreadCount, 1);
  });

  it("PUT /api/notifications/:userId/read-all marks all as read", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/demo-user/read-all`, {
      method: "PUT",
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { updatedCount: number };
    assert.equal(body.updatedCount, 3);
  });

  it("PUT /api/notifications/:id/read marks one notification as read", async () => {
    const res = await fetch(`${baseUrl}/api/notifications/n-1/read`, {
      method: "PUT",
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { id: string; read: boolean };
    assert.equal(body.id, "n-1");
    assert.equal(body.read, true);
  });
});
