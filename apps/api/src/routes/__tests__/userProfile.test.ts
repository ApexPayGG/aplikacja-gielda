import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import express from "express";
import { signAuthToken } from "../../modules/auth/authJwt";
import { createUserProfileRouter } from "../userProfile";

describe("user profile routes", () => {
  let server: ReturnType<express.Express["listen"]> | null = null;
  let baseUrl = "";
  const oldSecret = process.env.JWT_SECRET;

  beforeEach(async () => {
    process.env.JWT_SECRET = "test-secret";
    const app = express();
    app.use(express.json());
    app.use(
      createUserProfileRouter({
        getProfileFn: async (userId) => {
          if (userId !== "u-1") return null;
          return {
            id: "u-1",
            email: "jan@example.com",
            name: "Jan Kowalski",
            language: "pl",
            timezone: "Europe/Warsaw",
            avatarUrl: null,
            tier: "PRO",
            lastLoginAt: new Date("2026-05-17T10:00:00.000Z"),
          };
        },
        updateProfileFn: async (userId, input) => {
          return {
            id: userId,
            email: "jan@example.com",
            name: input.name ?? "Jan Kowalski",
            language: input.language ?? "pl",
            timezone: input.timezone ?? "Europe/Warsaw",
            avatarUrl: input.avatar ?? null,
            tier: "PRO",
            lastLoginAt: new Date("2026-05-17T10:00:00.000Z"),
          };
        },
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
    process.env.JWT_SECRET = oldSecret;
    await new Promise<void>((resolve, reject) => {
      if (!server) return resolve();
      server.close((err) => (err ? reject(err) : resolve()));
      server = null;
    });
  });

  it("GET /api/user/profile/:userId returns profile for authenticated owner", async () => {
    const token = signAuthToken({ sub: "u-1", email: "jan@example.com" });
    const res = await fetch(`${baseUrl}/api/user/profile/u-1`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { profile: { id: string; language: string } };
    assert.equal(body.profile.id, "u-1");
    assert.equal(body.profile.language, "pl");
  });

  it("GET /api/user/profile/:userId returns 403 for different authenticated user", async () => {
    const token = signAuthToken({ sub: "u-2", email: "anna@example.com" });
    const res = await fetch(`${baseUrl}/api/user/profile/u-1`, {
      headers: { authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 403);
  });

  it("PUT /api/user/profile/:userId updates profile fields", async () => {
    const token = signAuthToken({ sub: "u-1", email: "jan@example.com" });
    const res = await fetch(`${baseUrl}/api/user/profile/u-1`, {
      method: "PUT",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Jan K.",
        language: "en",
        timezone: "Europe/London",
        avatar: "https://cdn.example.com/avatar.png",
      }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { profile: { name: string; language: string; avatarUrl: string | null } };
    assert.equal(body.profile.name, "Jan K.");
    assert.equal(body.profile.language, "en");
    assert.equal(body.profile.avatarUrl, "https://cdn.example.com/avatar.png");
  });
});
