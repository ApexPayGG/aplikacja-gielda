import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createDigestRouter } from "../digest";

describe("digest routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(
      createDigestRouter({
        previewFn: async (userId, lang) => ({
          digest: `Digest for ${userId} in ${lang ?? "auto"}`,
          date: "2026-05-10",
        }),
        sendFn: async (userId, lang) => ({
          digest: `Sent digest for ${userId} in ${lang ?? "auto"}`,
          date: "2026-05-10",
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

  it("GET /api/digest/preview/:userId returns digest preview", async () => {
    const res = await fetch(`${baseUrl}/api/digest/preview/demo-user?lang=en`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { digest: string; date: string };
    assert.equal(body.digest, "Digest for demo-user in en");
    assert.equal(body.date, "2026-05-10");
  });

  it("GET /api/digest/preview without userId uses demo-user fallback", async () => {
    const res = await fetch(`${baseUrl}/api/digest/preview?lang=pl`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { digest: string };
    assert.equal(body.digest, "Digest for demo-user in pl");
  });

  it("GET /api/digest/preview/:userId without lang keeps language undefined", async () => {
    const res = await fetch(`${baseUrl}/api/digest/preview/demo-user`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { digest: string };
    assert.equal(body.digest, "Digest for demo-user in auto");
  });

  it("POST /api/digest/send/:userId sends digest immediately", async () => {
    const res = await fetch(`${baseUrl}/api/digest/send/demo-user?lang=de`, { method: "POST" });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { digest: string };
    assert.equal(body.digest, "Sent digest for demo-user in de");
  });
});
