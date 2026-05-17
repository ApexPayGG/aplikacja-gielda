import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import express from "express";
import { createContactRouter } from "../contact";

describe("contact routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  const fetchMock = mock.fn(async () => new Response(JSON.stringify({ id: "email_123" }), { status: 200 }));

  beforeEach(async () => {
    fetchMock.mock.resetCalls();
    const app = express();
    app.use(express.json());
    app.use(
      createContactRouter({
        fetchImpl: fetchMock as typeof fetch,
        resendApiKey: "resend-test-key",
      }),
    );
    app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const message = err instanceof Error ? err.message : "Internal Server Error";
      res.status(500).json({ error: message });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });
    const address = server?.address();
    if (!address || typeof address === "string") throw new Error("Could not resolve contact test server address");
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = null;
  });

  it("POST /api/contact returns 400 when required fields are missing", async () => {
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "",
        email: "john@example.com",
        subject: "Bug",
        message: "To jest przykładowa wiadomość testowa dłuższa niż 20 znaków.",
      }),
    });

    assert.equal(res.status, 400);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("POST /api/contact sends email via Resend and returns success payload", async () => {
    const res = await fetch(`${baseUrl}/api/contact`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Jan Kowalski",
        email: "jan@example.com",
        subject: "Sugestia",
        message: "To jest przykładowa wiadomość kontaktowa dłuższa niż 20 znaków.",
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { success: boolean };
    assert.deepEqual(body, { success: true });
    assert.equal(fetchMock.mock.callCount(), 1);

    const firstCall = fetchMock.mock.calls[0];
    assert.ok(firstCall);
    const [url, options] = firstCall.arguments as unknown as [string, RequestInit];
    assert.equal(url, "https://api.resend.com/emails");
    assert.equal((options as RequestInit | undefined)?.method, "POST");
    const payload = JSON.parse(String((options as RequestInit | undefined)?.body)) as Record<string, unknown>;
    assert.equal(payload.from, "hello@stock-ai.pro");
    assert.deepEqual(payload.to, ["marcin.chledzik@amcenergy.pl"]);
    assert.equal(payload.subject, "[StockAI Pro Contact] Sugestia");
    assert.match(String(payload.html), /Jan Kowalski/);
    assert.match(String(payload.html), /jan@example\.com/);
  });
});
