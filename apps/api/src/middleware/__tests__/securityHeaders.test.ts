import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createSecurityHeadersMiddleware } from "../securityHeaders";

describe("security headers middleware", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  async function startApp(isProduction: boolean): Promise<void> {
    const app = express();
    app.use(createSecurityHeadersMiddleware({ isProduction }));
    app.get("/health", (_req, res) => {
      res.json({ ok: true });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server!.address();
    if (!addr || typeof addr === "string") throw new Error("no port");
    baseUrl = `http://127.0.0.1:${addr.port}`;
  }

  afterEach(async () => {
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("sets strict security headers and disables HSTS outside production", async () => {
    await startApp(false);
    const res = await fetch(`${baseUrl}/health`);

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
    assert.equal(res.headers.get("strict-transport-security"), null);
    assert.match(String(res.headers.get("content-security-policy")), /default-src 'self'/);
  });

  it("enables HSTS in production", async () => {
    await startApp(true);
    const res = await fetch(`${baseUrl}/health`);
    const hsts = res.headers.get("strict-transport-security");

    assert.equal(res.status, 200);
    assert.ok(hsts);
    assert.match(hsts, /max-age=/);
  });
});
