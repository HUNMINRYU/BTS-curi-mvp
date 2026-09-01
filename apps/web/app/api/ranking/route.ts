import type { ActiveSession, AppDatabase } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/lib/auth";

const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 준비왕 랭킹을 확인할 수 있습니다.";

type RankingHandlerOptions = {
  readonly now?: () => Date;
};

export function createRankingHandlers(
  database: AppDatabase,
  options: RankingHandlerOptions = {},
) {
  const now = options.now ?? (() => new Date());

  function requireStudent(request: Request):
    | { readonly session: ActiveSession }
    | { readonly response: Response } {
    const session = getActiveSession(database, request, now());
    if (!session) {
      return { response: Response.json({ error: UNAUTHORIZED_ERROR }, { status: 401 }) };
    }
    if (session.user.role !== "student") {
      return { response: Response.json({ error: FORBIDDEN_ERROR }, { status: 403 }) };
    }
    return { session };
  }

  return {
    async GET(request: Request): Promise<Response> {
      const result = requireStudent(request);
      if ("response" in result) return result.response;
      return Response.json({
        ranking: database.getStudentRanking(result.session.user.id),
      });
    },
  };
}

let defaultHandlers: ReturnType<typeof createRankingHandlers> | undefined;

export async function GET(request: Request): Promise<Response> {
  defaultHandlers ??= createRankingHandlers(getAppDatabase());
  return defaultHandlers.GET(request);
}
