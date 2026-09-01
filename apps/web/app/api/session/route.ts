import type { AppDatabase } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import {
  createSessionId,
  expiredSessionCookie,
  getActiveSession,
  getSessionId,
  sessionCookie,
  sessionExpiresAt,
  verifyPassword,
} from "@/lib/auth";

type SessionHandlerOptions = {
  createSessionId?: () => string;
  isProduction?: boolean;
  allowInsecureHttp?: boolean;
  now?: () => Date;
};

export type SessionHandlers = {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
};

const INVALID_LOGIN_ERROR = "아이디 또는 비밀번호를 확인해 주세요.";
const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
// Signup keeps the stricter /^[a-z0-9_]{4,20}$/; login also accepts the
// hyphenated seeded demo accounts (student-test, professor-test).
const USERNAME_PATTERN = /^[a-z0-9_-]{4,20}$/;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 72;

function isValidCredentials(value: unknown): value is { username: string; password: string } {
  if (typeof value !== "object" || value === null || !("username" in value) || !("password" in value)) {
    return false;
  }
  if (Object.keys(value).some((key) => key !== "username" && key !== "password")) {
    return false;
  }
  return typeof value.username === "string"
    && USERNAME_PATTERN.test(value.username)
    && typeof value.password === "string"
    && value.password.length >= PASSWORD_MIN_LENGTH
    && value.password.length <= PASSWORD_MAX_LENGTH;
}

export function createSessionHandlers(
  database: AppDatabase,
  options: SessionHandlerOptions = {},
): SessionHandlers {
  const generateSessionId = options.createSessionId ?? createSessionId;
  const now = options.now ?? (() => new Date());
  const allowInsecureHttp = options.allowInsecureHttp
    ?? process.env.CURI_ALLOW_INSECURE_HTTP === "true";
  const isProduction = (options.isProduction ?? process.env.NODE_ENV === "production")
    && !allowInsecureHttp;

  async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: INVALID_LOGIN_ERROR }, { status: 400 });
    }

    if (!isValidCredentials(body)) {
      return Response.json({ error: INVALID_LOGIN_ERROR }, { status: 400 });
    }

    const credential = database.getCredentialByUsername(body.username);
    if (!credential || !verifyPassword(body.password, credential)) {
      return Response.json({ error: INVALID_LOGIN_ERROR }, { status: 401 });
    }

    const currentTime = now();
    const sessionId = generateSessionId();
    database.createSession({
      id: sessionId,
      userId: credential.user.id,
      expiresAt: sessionExpiresAt(currentTime),
    });

    const redirectTo = credential.user.role === "professor"
      ? "/professor"
      : database.getProfile(credential.user.id) ? "/recommend" : "/onboarding";
    return Response.json(
      { redirectTo },
      { headers: { "set-cookie": sessionCookie(sessionId, isProduction) } },
    );
  }

  async function GET(request: Request): Promise<Response> {
    const session = getActiveSession(database, request, now());
    if (!session) {
      return Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 });
    }
    return Response.json({ user: session.user });
  }

  async function DELETE(request: Request): Promise<Response> {
    const sessionId = getSessionId(request);
    if (sessionId) {
      database.deleteSession(sessionId);
    }
    return new Response(null, {
      status: 204,
      headers: { "set-cookie": expiredSessionCookie(isProduction) },
    });
  }

  return { GET, POST, DELETE };
}

let defaultHandlers: SessionHandlers | undefined;

function getDefaultHandlers(): SessionHandlers {
  defaultHandlers ??= createSessionHandlers(getAppDatabase());
  return defaultHandlers;
}

export async function GET(request: Request): Promise<Response> {
  return getDefaultHandlers().GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return getDefaultHandlers().POST(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return getDefaultHandlers().DELETE(request);
}
