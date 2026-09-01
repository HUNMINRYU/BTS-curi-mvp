import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

import type { ActiveSession, AppDatabase, CredentialRecord } from "@curi/db";

export const SESSION_COOKIE_NAME = "curi_session";
export const SESSION_MAX_AGE_SECONDS = 86_400;
const PASSWORD_KEY_LENGTH = 64;
const PASSWORD_SALT_LENGTH = 16;
const SCRYPT_OPTIONS = { N: 16_384, r: 8, p: 1 } as const;

export function hashPassword(password: string): { passwordHash: string; passwordSalt: string } {
  const salt = randomBytes(PASSWORD_SALT_LENGTH);
  const hash = scryptSync(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_OPTIONS);
  return { passwordHash: hash.toString("hex"), passwordSalt: salt.toString("hex") };
}

export function verifyPassword(password: string, record: Pick<CredentialRecord, "passwordHash" | "passwordSalt">): boolean {
  try {
    const expected = Buffer.from(record.passwordHash, "hex");
    const salt = Buffer.from(record.passwordSalt, "hex");
    const actual = scryptSync(password, salt, PASSWORD_KEY_LENGTH, SCRYPT_OPTIONS);
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function createSessionId(): string {
  return randomBytes(32).toString("base64url");
}

export function sessionExpiresAt(now: Date): string {
  return new Date(now.getTime() + SESSION_MAX_AGE_SECONDS * 1_000).toISOString();
}

export function getSessionId(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const cookie of cookieHeader.split(";")) {
    const [name, ...valueParts] = cookie.trim().split("=");
    if (name === SESSION_COOKIE_NAME && valueParts.length > 0) {
      try {
        return decodeURIComponent(valueParts.join("="));
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function getActiveSession(
  database: AppDatabase,
  request: Request,
  now: Date,
): ActiveSession | null {
  const sessionId = getSessionId(request);
  return sessionId ? database.getActiveSession(sessionId, now) : null;
}

export function sessionCookie(value: string, isProduction: boolean): string {
  const secure = isProduction ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}; HttpOnly; SameSite=Lax${secure}`;
}

export function expiredSessionCookie(isProduction: boolean): string {
  const secure = isProduction ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure}`;
}
