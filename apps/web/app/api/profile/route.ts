import type { ActiveSession, AppDatabase } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/features/auth/auth";
import { validateProfileInput } from "@/features/onboarding/profile-options";

type ProfileHandlerOptions = {
  now?: () => Date;
};

export type ProfileHandlers = {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
};

type StudentSessionResult =
  | { session: ActiveSession }
  | { response: Response };

const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 프로필을 변경할 수 있습니다.";
const INVALID_PROFILE_ERROR = "프로필 선택값을 확인해 주세요.";

export function createProfileHandlers(
  database: AppDatabase,
  options: ProfileHandlerOptions = {},
): ProfileHandlers {
  const now = options.now ?? (() => new Date());

  function requireStudentSession(request: Request): StudentSessionResult {
    const session = getActiveSession(database, request, now());
    if (!session) {
      return { response: Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 }) };
    }
    if (session.user.role !== "student") {
      return { response: Response.json({ error: FORBIDDEN_ERROR }, { status: 403 }) };
    }
    return { session };
  }

  async function GET(request: Request): Promise<Response> {
    const result = requireStudentSession(request);
    if ("response" in result) {
      return result.response;
    }
    return Response.json({ profile: database.getProfile(result.session.user.id) });
  }

  async function POST(request: Request): Promise<Response> {
    const result = requireStudentSession(request);
    if ("response" in result) {
      return result.response;
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: INVALID_PROFILE_ERROR }, { status: 400 });
    }

    const profile = validateProfileInput(body);
    if (!profile) {
      return Response.json({ error: INVALID_PROFILE_ERROR }, { status: 400 });
    }

    const awardedAt = now().toISOString();
    database.upsertProfile({
      userId: result.session.user.id,
      ...profile,
      completedAt: awardedAt,
    });
    return Response.json({
      redirectTo: "/recommend",
      gamification: database.awardOnboarding(result.session.user.id, awardedAt),
    });
  }

  return { GET, POST };
}

let defaultHandlers: ProfileHandlers | undefined;

function getDefaultHandlers(): ProfileHandlers {
  defaultHandlers ??= createProfileHandlers(getAppDatabase());
  return defaultHandlers;
}

export async function GET(request: Request): Promise<Response> {
  return getDefaultHandlers().GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return getDefaultHandlers().POST(request);
}
