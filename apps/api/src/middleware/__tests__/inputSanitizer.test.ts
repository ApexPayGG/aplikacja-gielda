import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createInputSanitizerMiddleware } from "../inputSanitizer";

describe("input sanitizer middleware", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(express.json());
    app.use(createInputSanitizerMiddleware());
    app.post("/echo", (req, res) => {
      res.json({
        body: req.body,
        query: req.query,
      });
    });

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

  it("escapes html and trims body, query and params", async () => {
    const res = await fetch(`${baseUrl}/echo?tag=%20%3Cscript%3Ex%3C%2Fscript%3E%20`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "  jan@example.com  ",
        name: " <b>Jan Kowalski</b> ",
        nested: {
          note: " <img src=x onerror=1> ",
        },
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      body: Record<string, unknown>;
      query: Record<string, unknown>;
    };

    assert.equal(body.body.email, "jan@example.com");
    assert.equal(body.body.name, "&lt;b&gt;Jan Kowalski&lt;/b&gt;");
    assert.deepEqual(body.body.nested, { note: "&lt;img src=x onerror=1&gt;" });
    assert.equal(body.query.tag, "&lt;script&gt;x&lt;/script&gt;");
  });

  it("returns 400 when email is longer than 255 chars", async () => {
    const tooLongEmail = `${"a".repeat(250)}@example.com`;
    const res = await fetch(`${baseUrl}/echo`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: tooLongEmail,
        password: "password123",
      }),
    });

    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.match(body.error, /email/i);
    assert.match(body.error, /255/);
  });
});
