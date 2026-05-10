import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { createGlossaryRouter } from "../glossary";

describe("glossary routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";

  beforeEach(async () => {
    const app = express();
    app.use(
      createGlossaryRouter({
        explainFn: async (term, lang) => ({
          term: `${term}-${lang}`,
          explanation: "Simple explanation for retail investor.",
          example: "Example sentence for term.",
          cached: false,
        }),
      }),
    );
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const addr = server.address();
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

  it("GET /api/glossary/explain returns generated payload", async () => {
    const res = await fetch(`${baseUrl}/api/glossary/explain?term=RSI&lang=en`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      term: string;
      explanation: string;
      example: string;
      cached: boolean;
    };
    assert.equal(body.term, "RSI-en");
    assert.equal(body.cached, false);
    assert.ok(body.explanation.length > 0);
    assert.ok(body.example.length > 0);
  });

  it("GET /api/glossary/explain validates missing term", async () => {
    const res = await fetch(`${baseUrl}/api/glossary/explain?lang=en`);
    assert.equal(res.status, 400);
  });
});
