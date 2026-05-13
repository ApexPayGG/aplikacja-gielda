import jwt from "jsonwebtoken";

const JWT_EXPIRES_IN = "7d";

type AuthTokenPayload = {
  sub: string;
  email: string;
};

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || !secret.trim()) {
    throw new Error("JWT_SECRET is not set");
  }
  return secret;
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: JWT_EXPIRES_IN });
}

export function verifyAuthToken(token: string): AuthTokenPayload {
  const decoded = jwt.verify(token, getJwtSecret());
  if (typeof decoded !== "object" || decoded == null) {
    throw new Error("Invalid token payload");
  }

  const sub = String(decoded.sub ?? "").trim();
  const email = String(decoded.email ?? "").trim();
  if (!sub || !email) {
    throw new Error("Invalid token payload");
  }

  return { sub, email };
}
