import crypto from "node:crypto";
import process from "node:process";
import bcrypt from "bcrypt";
import { prisma } from "../../db/index";
import { signAuthToken } from "./authJwt";

const SALT_ROUNDS = 10;

export type AuthUserPayload = {
  id: string;
  email: string;
  name: string | null;
  tier: string;
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

function toAuthUser(user: { id: string; email: string; name: string | null; tier: string }): AuthUserPayload {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    tier: user.tier,
  };
}

async function sendVerificationEmail(to: string, token: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY is not set");
  }

  const verifyUrl = `https://stock-ai.pro/verify?token=${encodeURIComponent(token)}`;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "noreply@stock-ai.pro",
      to: [to],
      subject: "Potwierdź swój email — StockAI Pro",
      text: `Kliknij link aby aktywować konto: ${verifyUrl}`,
      html: `<p>Kliknij link aby aktywować konto: <a href="${verifyUrl}">${verifyUrl}</a></p>`,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Resend API error (${response.status}): ${body}`);
  }
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

  const existing = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT id FROM users WHERE email = ${email} LIMIT 1
  `;
  if (existing.length > 0) {
    throw new Error("Email already in use");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const id = crypto.randomUUID();
  const verifyToken = crypto.randomBytes(32).toString("hex");
  const verifyTokenExp = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const users = await prisma.$queryRaw<
    Array<{ id: string; email: string; name: string | null; tier: string }>
  >`
    INSERT INTO users (id, email, password_hash, name, tier, created_at, email_verified, verify_token, verify_token_exp)
    VALUES (${id}, ${email}, ${passwordHash}, ${name}, 'FREE', NOW(), false, ${verifyToken}, ${verifyTokenExp})
    RETURNING id, email, name, tier
  `;
  const user = users[0];
  if (!user) throw new Error("Failed to create user");

  await sendVerificationEmail(user.email, verifyToken);
  return { user: toAuthUser(user), verificationEmailSent: true };
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthSuccessPayload> {
  const email = normalizeEmail(input.email);
  const password = input.password;

  assertEmail(email);
  assertPassword(password);

  const users = await prisma.$queryRaw<
    Array<{
      id: string;
      email: string;
      name: string | null;
      tier: string;
      password_hash: string;
      email_verified: boolean;
    }>
  >`
    SELECT id, email, name, tier, password_hash, email_verified
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

  await prisma.$executeRaw`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;

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

  const users = await prisma.$queryRaw<Array<{ id: string; verify_token_exp: Date | null }>>`
    SELECT id, verify_token_exp
    FROM users
    WHERE verify_token = ${token}
    LIMIT 1
  `;
  const user = users[0];
  if (!user || !user.verify_token_exp || user.verify_token_exp.getTime() < Date.now()) {
    throw new Error("Verification token expired or invalid");
  }

  await prisma.$executeRaw`
    UPDATE users
    SET email_verified = true,
        verify_token = NULL,
        verify_token_exp = NULL
    WHERE id = ${user.id}
  `;
}

export async function getAuthUserById(userId: string): Promise<AuthUserPayload | null> {
  const users = await prisma.$queryRaw<
    Array<{ id: string; email: string; name: string | null; tier: string }>
  >`
    SELECT id, email, name, tier
    FROM users
    WHERE id = ${userId}
    LIMIT 1
  `;
  const user = users[0] ?? null;
  return user ? toAuthUser(user) : null;
}
