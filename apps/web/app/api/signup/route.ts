import { randomUUID, timingSafeEqual } from "node:crypto";
import type { AppDatabase, CredentialUserInput } from "@curi/db";
import { DuplicateUsernameError } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import {
  createSessionId,
  hashPassword,
  sessionCookie,
  sessionExpiresAt,
} from "@/features/auth/auth";

type SignupHandlerOptions = {
  createSessionId?: () => string;
  isProduction?: boolean;
  allowInsecureHttp?: boolean;
  now?: () => Date;
  professorInviteCode?: string;
};

export type SignupHandlers = {
  POST(request: Request): Promise<Response>;
};

const INVALID_SIGNUP_ERROR = "아이디 또는 비밀번호를 확인해 주세요.";
const USERNAME_PATTERN = /^[a-z0-9_]{4,20}$/;
const PASSWORD_MIN_LENGTH = 10;
const PASSWORD_MAX_LENGTH = 72;
const NAME_MAX_LENGTH = 30;
const INVITE_CODE_MAX_LENGTH = 128;

type SignupInput = {
  readonly username: string;
  readonly password: string;
  readonly name: string;
  readonly role: "student" | "professor";
  readonly professorInviteCode?: string;
};

function isSignupInput(value: unknown): value is SignupInput {
  if (typeof value !== "object" || value === null
    || !("username" in value) || !("password" in value) || !("name" in value) || !("role" in value)) {
    return false;
  }
  if (Object.keys(value).some((key) => ![
    "username",
    "password",
    "name",
    "role",
    "professorInviteCode",
  ].includes(key))) {
    return false;
  }
  return typeof value.username === "string"
    && USERNAME_PATTERN.test(value.username)
    && typeof value.password === "string"
    && value.password.length >= PASSWORD_MIN_LENGTH
    && value.password.length <= PASSWORD_MAX_LENGTH
    && typeof value.name === "string"
    && value.name.trim().length > 0
    && value.name.trim().length <= NAME_MAX_LENGTH
    && (value.role === "student" || value.role === "professor")
    && (!("professorInviteCode" in value)
      || (typeof value.professorInviteCode === "string"
        && value.professorInviteCode.length <= INVITE_CODE_MAX_LENGTH));
}

function matchesInviteCode(candidate: string | undefined, expected: string | undefined): boolean {
  if (!candidate || !expected) return false;
  const candidateBytes = Buffer.from(candidate);
  const expectedBytes = Buffer.from(expected);
  return candidateBytes.length === expectedBytes.length
    && timingSafeEqual(candidateBytes, expectedBytes);
}

export function createSignupHandlers(
  database: AppDatabase,
  options: SignupHandlerOptions = {},
): SignupHandlers {
  const generateSessionId = options.createSessionId ?? createSessionId;
  const now = options.now ?? (() => new Date());
  const allowInsecureHttp = options.allowInsecureHttp
    ?? process.env.CURI_ALLOW_INSECURE_HTTP === "true";
  const isProduction = (options.isProduction ?? process.env.NODE_ENV === "production")
    && !allowInsecureHttp;
  const professorInviteCode = options.professorInviteCode
    ?? process.env.CURI_PROFESSOR_SIGNUP_CODE;

  async function POST(request: Request): Promise<Response> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: INVALID_SIGNUP_ERROR }, { status: 400 });
    }
    if (!isSignupInput(body)) {
      return Response.json({ error: INVALID_SIGNUP_ERROR }, { status: 400 });
    }
    if (body.role === "professor"
      && !matchesInviteCode(body.professorInviteCode?.trim(), professorInviteCode?.trim())) {
      return Response.json({ error: INVALID_SIGNUP_ERROR }, { status: 403 });
    }

    const { passwordHash, passwordSalt } = hashPassword(body.password);
    const input: CredentialUserInput = {
      id: randomUUID(),
      username: body.username,
      name: body.name.trim(),
      role: body.role,
      passwordHash,
      passwordSalt,
    };
    let user;
    try {
      user = database.createCredentialUser(input);
    } catch (error) {
      if (error instanceof DuplicateUsernameError) {
        return Response.json({ error: INVALID_SIGNUP_ERROR }, { status: 409 });
      }
      throw error;
    }

    const sessionId = generateSessionId();
    database.createSession({
      id: sessionId,
      userId: user.id,
      expiresAt: sessionExpiresAt(now()),
    });
    return Response.json(
      { redirectTo: body.role === "professor" ? "/professor" : "/onboarding" },
      { status: 201, headers: { "set-cookie": sessionCookie(sessionId, isProduction) } },
    );
  }

  return { POST };
}

let defaultHandlers: SignupHandlers | undefined;

function getDefaultHandlers(): SignupHandlers {
  defaultHandlers ??= createSignupHandlers(getAppDatabase());
  return defaultHandlers;
}

export async function POST(request: Request): Promise<Response> {
  return getDefaultHandlers().POST(request);
}
