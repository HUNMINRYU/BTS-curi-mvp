import type { ActiveSession, AppDatabase } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/features/auth/auth";

type GamificationHandlerOptions = {
  now?: () => Date;
};

type StudentSessionResult =
  | { session: ActiveSession }
  | { response: Response };

export type GamificationHandlers = {
  GET(request: Request): Promise<Response>;
};

const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 포인트를 확인할 수 있습니다.";

export function createGamificationHandlers(
  database: AppDatabase,
  options: GamificationHandlerOptions = {},
): GamificationHandlers {
  const now = options.now ?? (() => new Date());

  function requireStudent(request: Request): StudentSessionResult {
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
    const sessionResult = requireStudent(request);
    if ("response" in sessionResult) return sessionResult.response;
    return Response.json({ gamification: database.getGamificationSummary(sessionResult.session.user.id) });
  }

  return { GET };
}

let defaultHandlers: GamificationHandlers | undefined;

function getDefaultHandlers(): GamificationHandlers {
  defaultHandlers ??= createGamificationHandlers(getAppDatabase());
  return defaultHandlers;
}

export async function GET(request: Request): Promise<Response> {
  return getDefaultHandlers().GET(request);
}
