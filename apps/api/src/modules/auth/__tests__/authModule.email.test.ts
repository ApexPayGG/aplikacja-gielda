import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";
import {
  configureAuthModuleDeps,
  registerUser,
  requestPasswordReset,
  resendVerificationEmail,
  resetAuthModuleDeps,
} from "../authModule.js";

describe("authModule email delivery", () => {
  const fetchMock = mock.fn(async () => new Response("error", { status: 500 }));
  const queryRaw = mock.fn<(...args: unknown[]) => Promise<unknown[]>>();
  const executeRaw = mock.fn<(...args: unknown[]) => Promise<number>>();
  const oldResendKey = process.env.RESEND_API_KEY;

  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-resend-key";
    queryRaw.mock.resetCalls();
    executeRaw.mock.resetCalls();
    fetchMock.mock.resetCalls();
    configureAuthModuleDeps({
      fetchImpl: fetchMock as typeof fetch,
      db: {
        $queryRaw: queryRaw as unknown as typeof import("../../../db/index.js").prisma.$queryRaw,
        $executeRaw: executeRaw as unknown as typeof import("../../../db/index.js").prisma.$executeRaw,
      },
    });
  });

  afterEach(() => {
    resetAuthModuleDeps();
    process.env.RESEND_API_KEY = oldResendKey;
  });

  it("register returns verificationEmailSent false when Resend fails", async () => {
    queryRaw.mock.mockImplementation(async (...args: unknown[]) => {
      const sql = String((args[0] as TemplateStringsArray | undefined)?.[0] ?? "");
      if (sql.includes("SELECT id FROM users")) return [];
      if (sql.includes("INSERT INTO users")) {
        return [
          {
            id: "u-new",
            email: "new@example.com",
            name: null,
            tier: "FREE",
            role: "USER",
          },
        ];
      }
      return [];
    });

    const result = await registerUser({
      email: "new@example.com",
      password: "password123",
    });

    assert.equal(result.user.email, "new@example.com");
    assert.equal(result.verificationEmailSent, false);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("forgot-password does not throw when Resend fails", async () => {
    queryRaw.mock.mockImplementation(async (...args: unknown[]) => {
      const sql = String((args[0] as TemplateStringsArray | undefined)?.[0] ?? "");
      if (sql.includes("FROM users")) {
        return [{ id: "u-1", email: "jan@example.com" }];
      }
      return [];
    });
    executeRaw.mock.mockImplementation(async () => 1);

    await assert.doesNotReject(async () => {
      await requestPasswordReset({ email: "jan@example.com" });
    });
    assert.equal(executeRaw.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 1);
  });

  it("resend-verification is neutral for unknown email", async () => {
    queryRaw.mock.mockImplementation(async () => []);

    await assert.doesNotReject(async () => {
      await resendVerificationEmail({ email: "missing@example.com" });
    });
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("resend-verification is neutral for already verified user", async () => {
    queryRaw.mock.mockImplementation(async () => [
      {
        id: "u-1",
        email: "verified@example.com",
        email_verified: true,
        verify_token: "tok",
        verify_token_exp: new Date(Date.now() + 60_000),
      },
    ]);

    await resendVerificationEmail({ email: "verified@example.com" });
    assert.equal(fetchMock.mock.callCount(), 0);
  });

  it("resend-verification attempts send for unverified user with valid token", async () => {
    fetchMock.mock.mockImplementation(async () => new Response(JSON.stringify({ id: "email_1" }), { status: 200 }));

    queryRaw.mock.mockImplementation(async () => [
      {
        id: "u-2",
        email: "pending@example.com",
        email_verified: false,
        verify_token: "valid-token",
        verify_token_exp: new Date(Date.now() + 60 * 60 * 1000),
      },
    ]);

    await resendVerificationEmail({ email: "pending@example.com" });
    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(executeRaw.mock.callCount(), 0);
  });

  it("resend-verification does not throw when Resend fails", async () => {
    queryRaw.mock.mockImplementation(async () => [
      {
        id: "u-3",
        email: "pending2@example.com",
        email_verified: false,
        verify_token: null,
        verify_token_exp: null,
      },
    ]);
    executeRaw.mock.mockImplementation(async () => 1);

    await assert.doesNotReject(async () => {
      await resendVerificationEmail({ email: "pending2@example.com" });
    });
    assert.equal(executeRaw.mock.callCount(), 1);
    assert.equal(fetchMock.mock.callCount(), 1);
  });
});
