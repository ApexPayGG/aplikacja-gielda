import crypto from "node:crypto";
import process from "node:process";
import bcrypt from "bcrypt";
import { prisma } from "../../db/index";
import { TRIAL_RULES } from "../../config/pricing";
import { generatePasswordResetEmail } from "../../templates/passwordResetEmail";
import { generateVerificationEmail } from "../../templates/emailVerification";
import { generateWelcomeEmail } from "../../templates/welcomeEmail";
import { ONBOARDING_EMAIL_1_SUBJECT } from "../email/onboardingSequence";
import { signAuthToken } from "./authJwt";

const SALT_ROUNDS = 10;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

type AuthDb = Pick<typeof prisma, "$queryRaw" | "$executeRaw">;

type AuthModuleDeps = {
  fetchImpl?: typeof fetch;
  db?: AuthDb;
};

let authModuleDeps: AuthModuleDeps = {};

function getAuthDb(): AuthDb {
  return authModuleDeps.db ?? prisma;
}

/** Test-only hook to mock Resend HTTP / DB without changing production call sites. */
export function configureAuthModuleDeps(deps: AuthModuleDeps): void {
  authModuleDeps = { ...authModuleDeps, ...deps };
}

/** @deprecated Use configureAuthModuleDeps */
export function configureAuthEmailDeps(deps: Pick<AuthModuleDeps, "fetchImpl">): void {
  configureAuthModuleDeps(deps);
}

export function resetAuthModuleDeps(): void {
  authModuleDeps = {};
}

/** @deprecated Use resetAuthModuleDeps */
export function resetAuthEmailDeps(): void {
  resetAuthModuleDeps();
}

function logEmailDeliveryError(context: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  const safeMessage = message.replace(/https?:\/\/\S+/g, "[url-redacted]");
  console.error(`[auth] ${context}: ${safeMessage}`);
}

export type AuthUserPayload = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  role: string;
};

export type AuthSuccessPayload = {
  user: AuthUserPayload;
  token: string;
};

export type RegisterSuccessPayload = {
  user: AuthUserPayload;
  verificationEmailSent: boolean;
};

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function assertEmail(email: string): void {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error("Invalid email");
  }
}

function assertPassword(password: string): void {
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }
}

function toAuthUser(user: {
  id: string;
  email: string;
  name: string | null;
  tier: string;
  role: string;
}): AuthUserPayload {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
    role: user.role,
  };
}

async function sendResendEmail(input: { to: string; subject: string; text: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const fetchImpl = authModuleDeps.fetchImpl ?? fetch;
  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "hello@stock-ai.pro",
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
}

async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const verifyUrl = `https://stock-ai.pro/verify?token=${encodeURIComponent(token)}`;
  await sendResendEmail({
    to,
    subject: "Potwierdź swój email — StockAI Pro",
    text: `Kliknij link aby aktywować konto: ${verifyUrl}`,
    html: generateVerificationEmail(token, to),
  });
}

async function sendWelcomeEmail(to: string, name?: string | null): Promise<void> {
  await sendResendEmail({
    to,
    subject: ONBOARDING_EMAIL_1_SUBJECT,
    text: "Witaj w StockAI Pro! Zacznij od Dashboard: https://stock-ai.pro/app/dashboard",
    html: generateWelcomeEmail(name ?? undefined),
  });
}

async function sendPasswordResetEmail(to: string, token: string): Promise<void> {
  const resetUrl = `https://stock-ai.pro/reset-password?token=${encodeURIComponent(token)}`;
  await sendResendEmail({
    to,
    subject: "Reset hasła — StockAI Pro",
    text: `Kliknij link aby ustawić nowe hasło: ${resetUrl}`,
    html: generatePasswordResetEmail(token, to),
  });
}

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string | null;
}): Promise<RegisterSuccessPayload> {
  const email = normalizeEmail(input.email);
  const password = input.password;
  const name = input.name?.trim() ? input.name.trim() : null;

  assertEmail(email);
  assertPassword(password);

  const existing = await getAuthDb().$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    throw new Error("Email already in use");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = crypto.randomUUID();
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyTokenExp = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
  const trialStartedAt = new Date();
  const trialEndsAt = new Date(trialStartedAt.getTime() + TRIAL_RULES.without_card.days * 24 * 60 * 60 * 1000);
  const users = await getAuthDb().$queryRaw<
    Array<{ id: string; email: string; name: string | null; tier: string; role: string }>
  >`
    INSERT INTO users (
      id, email, password_hash, name, tier, role, created_at, email_verified, verify_token, verify_token_exp,
      trial_started_at, trial_ends_at, trial_kind, access_state, subscription_status
    )
    VALUES (
      ${id}, ${email}, ${passwordHash}, ${name}, 'FREE', 'USER', NOW(), false, ${verifyToken}, ${verifyTokenExp},
      ${trialStartedAt}, ${trialEndsAt}, 'without_card', 'TRIAL_ACTIVE', 'free'
    )
    RETURNING id, email, name, tier, role
  `;
  const user = users[0];
  if (!user) throw new Error("Failed to create user");

  let verificationEmailSent = true;
  try {
    await sendVerificationEmail(user.email, verifyToken);
  } catch (error) {
    verificationEmailSent = false;
    logEmailDeliveryError(`verification email failed for ${user.email}`, error);
  }
  return { user: toAuthUser(user), verificationEmailSent };
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthSuccessPayload> {
  const email = normalizeEmail(input.email);
  const password = input.password;

  assertEmail(email);
  assertPassword(password);

  const users = await getAuthDb().$queryRaw<
    Array<{
      id: string;
      email: string;
      name: string | null;
      tier: string;
      role: string;
      password_hash: string;
      email_verified: boolean;
    }>
  >`
    SELECT id, email, name, tier, role, password_hash, email_verified
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;
  const user = users[0];

  if (!user) {
    throw new Error("Invalid credentials");
  }

  const matches = await bcrypt.compare(password, user.password_hash);
  if (!matches) {
    throw new Error("Invalid credentials");
  }
  if (!user.email_verified) {
    throw new Error("Please verify your email first");
  }

  await getAuthDb().$executeRaw`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;

  const token = signAuthToken({ sub: user.id, email: user.email });
  return {
    user: toAuthUser(user),
    token,
  };
}

export async function verifyEmailToken(tokenInput: string): Promise<void> {
  const token = String(tokenInput ?? "").trim();
  if (!token) {
    throw new Error("Invalid verification token");
  }

  const users = await getAuthDb().$queryRaw<Array<{ id: string; email: string; name: string | null; verify_token_exp: Date | null }>>`
    SELECT id, email, name, verify_token_exp
    FROM users
    WHERE verify_token = ${token}
    LIMIT 1
  `;
  const user = users[0];
  if (!user || !user.verify_token_exp || user.verify_token_exp.getTime() < Date.now()) {
    throw new Error("Verification token expired or invalid");
  }

  await getAuthDb().$executeRaw`
    UPDATE users
    SET email_verified = true,
        verify_token = NULL,
        verify_token_exp = NULL
    WHERE id = ${user.id}
  `;

  await sendWelcomeEmail(user.email, user.name);
}

export async function requestPasswordReset(input: { email: string }): Promise<void> {
  const email = normalizeEmail(input.email);
  assertEmail(email);

  const users = await getAuthDb().$queryRaw<Array<{ id: string; email: string }>>`
    SELECT id, email
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;
  const user = users[0];
  if (!user) {
    return;
  }

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExp = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MS);
  await getAuthDb().$executeRaw`
    UPDATE users
    SET password_reset_token = ${resetToken},
        password_reset_token_exp = ${resetTokenExp}
    WHERE id = ${user.id}
  `;
  try {
    await sendPasswordResetEmail(user.email, resetToken);
  } catch (error) {
    logEmailDeliveryError(`password reset email failed for ${user.email}`, error);
  }
}

export async function resendVerificationEmail(input: { email: string }): Promise<void> {
  const email = normalizeEmail(input.email);
  try {
    assertEmail(email);
  } catch {
    return;
  }

  const users = await getAuthDb().$queryRaw<
    Array<{
      id: string;
      email: string;
      email_verified: boolean;
      verify_token: string | null;
      verify_token_exp: Date | null;
    }>
  >`
    SELECT id, email, email_verified, verify_token, verify_token_exp
    FROM users
    WHERE email = ${email}
    LIMIT 1
  `;
  const user = users[0];
  if (!user || user.email_verified) {
    return;
  }

  const now = Date.now();
  const hasValidToken =
    Boolean(user.verify_token?.trim()) &&
    user.verify_token_exp != null &&
    user.verify_token_exp.getTime() > now;

  const verifyToken = hasValidToken ? user.verify_token! : crypto.randomBytes(32).toString("hex");
  if (!hasValidToken) {
    const verifyTokenExp = new Date(now + VERIFY_TOKEN_TTL_MS);
    await getAuthDb().$executeRaw`
      UPDATE users
      SET verify_token = ${verifyToken},
          verify_token_exp = ${verifyTokenExp}
      WHERE id = ${user.id}
    `;
  }

  try {
    await sendVerificationEmail(user.email, verifyToken);
  } catch (error) {
    logEmailDeliveryError(`resend verification email failed for ${user.email}`, error);
  }
}

export async function resetPassword(input: { token: string; newPassword: string }): Promise<void> {
  const token = String(input.token ?? "").trim();
  const newPassword = String(input.newPassword ?? "");

  if (!token) {
    throw new Error("Invalid reset token");
  }
  assertPassword(newPassword);

  const users = await getAuthDb().$queryRaw<Array<{ id: string; password_reset_token_exp: Date | null }>>`
    SELECT id, password_reset_token_exp
    FROM users
    WHERE password_reset_token = ${token}
    LIMIT 1
  `;
  const user = users[0];
  if (!user || !user.password_reset_token_exp || user.password_reset_token_exp.getTime() < Date.now()) {
    throw new Error("Reset token expired or invalid");
  }

  const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await getAuthDb().$executeRaw`
    UPDATE users
    SET password_hash = ${passwordHash},
        password_reset_token = NULL,
        password_reset_token_exp = NULL
    WHERE id = ${user.id}
  `;
}

export async function getAuthUserById(userId: string): Promise<AuthUserPayload | null> {
  const users = await getAuthDb().$queryRaw<
    Array<{ id: string; email: string; name: string | null; tier: string; role: string }>
  >`
    SELECT id, email, name, tier, role
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const user = users[0] ?? null;
  return user ? toAuthUser(user) : null;
}
