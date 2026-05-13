import crypto from "node:crypto";
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

export async function registerUser(input: {
  email: string;
  password: string;
  name?: string | null;
}): Promise<AuthSuccessPayload> {
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
  const users = await prisma.$queryRaw<
    Array<{ id: string; email: string; name: string | null; tier: string }>
  >`
    INSERT INTO users (id, email, password_hash, name, tier, created_at)
    VALUES (${id}, ${email}, ${passwordHash}, ${name}, 'FREE', NOW())
    RETURNING id, email, name, tier
  `;
  const user = users[0];
  if (!user) throw new Error("Failed to create user");

  const token = signAuthToken({ sub: user.id, email: user.email });
  return { user: toAuthUser(user), token };
}

export async function loginUser(input: { email: string; password: string }): Promise<AuthSuccessPayload> {
  const email = normalizeEmail(input.email);
  const password = input.password;

  assertEmail(email);
  assertPassword(password);

  const users = await prisma.$queryRaw<
    Array<{ id: string; email: string; name: string | null; tier: string; password_hash: string }>
  >`
    SELECT id, email, name, tier, password_hash
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

  await prisma.$executeRaw`UPDATE users SET last_login_at = NOW() WHERE id = ${user.id}`;

  const token = signAuthToken({ sub: user.id, email: user.email });
  return {
    user: toAuthUser(user),
    token,
  };
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
