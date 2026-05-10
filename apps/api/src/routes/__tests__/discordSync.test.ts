import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createDiscordSyncRouter } from "../discordSync";

describe("discord sync routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createDiscordSyncRouter({
        saveFn: async () => true,
        getFn: async (userId) => (userId === "demo-user" ? "https://discord.com/api/webhooks/demo/123" : null),
        testFn: async (userId) => userId === "demo-user",
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

  it("POST /api/discord/webhook/save persists webhook", async () => {
    const res = await fetch(`${baseUrl}/api/discord/webhook/save`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        userId: "demo-user",
        webhookUrl: "https://discord.com/api/webhooks/demo/123",
      }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { saved: boolean };
    assert.equal(body.saved, true);
  });

  it("GET /api/discord/webhook/:userId returns webhook", async () => {
    const res = await fetch(`${baseUrl}/api/discord/webhook/demo-user`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { webhookUrl: string | null };
    assert.equal(body.webhookUrl, "https://discord.com/api/webhooks/demo/123");
  });

  it("POST /api/discord/webhook/test/:userId sends test message", async () => {
    const res = await fetch(`${baseUrl}/api/discord/webhook/test/demo-user`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { sent: boolean };
    assert.equal(body.sent, true);
  });
});
