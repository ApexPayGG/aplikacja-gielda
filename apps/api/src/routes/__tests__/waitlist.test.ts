import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import type { NextFunction, Request, Response } from "express";
import express from "express";
import { createWaitlistRouter } from "../waitlist";

type WaitlistRow = {
  id: string;
  email: string;
  name: string | null;
  source: string | null;
  createdAt: Date;
};

describe("waitlist routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  let entries: WaitlistRow[] = [];

  const users = [
    { id: "admin-user", role: "ADMIN" },
    { id: "normal-user", role: "USER" },
  ];

  const fetchMock = mock.fn(async () => new Response(null, { status: 200 }));

  const requireAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const userId = String(req.headers["x-user-id"] ?? "").trim();
    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as Request & { auth?: { userId: string; email: string } }).auth = {
      userId,
      email: `${userId}@example.com`,
    };
    next();
  };

  beforeEach(async () => {
    entries = [];
    fetchMock.mock.resetCalls();

    const app = express();
    app.use(express.json());
    app.use(
      createWaitlistRouter({
        db: {
          waitlistEntry: {
            findUnique: async ({ where }: { where: { email: string } }) =>
              entries.find((entry) => entry.email === where.email) ?? null,
            create: async ({
              data,
            }: {
              data: { email: string; name: string | null; source: string | null };
            }) => {
              const row: WaitlistRow = {
                id: `entry-${entries.length + 1}`,
                email: data.email,
                name: data.name,
                source: data.source,
                createdAt: new Date(),
              };
              entries.push(row);
              return row;
            },
            count: async () => entries.length,
            findMany: async () => [...entries].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()),
          },
          user: {
            findUnique: async ({ where }: { where: { id: string } }) => {
              const user = users.find((candidate) => candidate.id === where.id);
              return user ? { role: user.role } : null;
            },
          },
        } as never,
        fetchImpl: fetchMock as typeof fetch,
        resendApiKey: "resend-test-key",
        requireAuthMiddleware,
      }),
    );

    await new Promise<void>((resolve) => {
      server = app.listen(0, () => resolve());
    });

    const activeAddress = server?.address();
    if (!activeAddress || typeof activeAddress === "string") {
      throw new Error("Could not resolve waitlist test server address");
    }
    baseUrl = `http://127.0.0.1:${activeAddress.port}`;
  });

  afterEach(async () => {
    if (!server) return;
    await new Promise<void>((resolve, reject) => {
      server?.close((error) => (error ? reject(error) : resolve()));
    });
    server = null;
  });

  it("POST /api/waitlist creates entry and sends confirmation email", async () => {
    const res = await fetch(`${baseUrl}/api/waitlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "NewUser@example.com",
        name: "Ada",
        source: "landing",
      }),
    });

    assert.equal(res.status, 201);
    const body = (await res.json()) as { ok: boolean; alreadyJoined: boolean; count: number };
    assert.equal(body.ok, true);
    assert.equal(body.alreadyJoined, false);
    assert.equal(body.count, 1);
    assert.equal(entries.length, 1);
    assert.equal(entries[0]?.email, "newuser@example.com");
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("POST /api/waitlist is idempotent for existing email", async () => {
    entries.push({
      id: "entry-1",
      email: "existing@example.com",
      name: null,
      source: "pricing",
      createdAt: new Date("2026-05-17T12:00:00.000Z"),
    });

    const res = await fetch(`${baseUrl}/api/waitlist`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "existing@example.com",
        source: "signal",
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { alreadyJoined: boolean; count: number };
    assert.equal(body.alreadyJoined, true);
    assert.equal(body.count, 1);
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("GET /api/waitlist returns social proof count", async () => {
    entries.push(
      {
        id: "entry-1",
        email: "one@example.com",
        name: "One",
        source: "landing",
        createdAt: new Date("2026-05-17T12:00:00.000Z"),
      },
      {
        id: "entry-2",
        email: "two@example.com",
        name: "Two",
        source: "pricing",
        createdAt: new Date("2026-05-17T12:05:00.000Z"),
      },
    );

    const res = await fetch(`${baseUrl}/api/waitlist`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { count: number };
    assert.equal(body.count, 2);
  });

  it("GET /api/admin/waitlist returns 403 for non-admin", async () => {
    const res = await fetch(`${baseUrl}/api/admin/waitlist`, {
      headers: { "x-user-id": "normal-user" },
    });
    assert.equal(res.status, 403);
  });

  it("GET /api/admin/waitlist returns count and entries for admin", async () => {
    entries.push(
      {
        id: "entry-1",
        email: "old@example.com",
        name: "Old",
        source: "landing",
        createdAt: new Date("2026-05-17T10:00:00.000Z"),
      },
      {
        id: "entry-2",
        email: "new@example.com",
        name: "New",
        source: "signal",
        createdAt: new Date("2026-05-17T11:00:00.000Z"),
      },
    );

    const res = await fetch(`${baseUrl}/api/admin/waitlist`, {
      headers: { "x-user-id": "admin-user" },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { count: number; entries: WaitlistRow[] };
    assert.equal(body.count, 2);
    assert.equal(body.entries.length, 2);
    assert.equal(body.entries[0]?.email, "new@example.com");
    assert.equal(body.entries[1]?.email, "old@example.com");
  });
});
