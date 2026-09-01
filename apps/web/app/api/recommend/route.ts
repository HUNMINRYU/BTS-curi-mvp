import type { ActiveSession, AppDatabase } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/features/auth/auth";
import { getCatalog, type CatalogCourse } from "@/features/catalog/catalog-data";
import { generateRecommendationReasons } from "@/features/recommendations/recommend-bedrock";
import {
  recommendCourses,
  type RecommendationReasonGenerator,
} from "@/features/recommendations/recommendations";

const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 과목 추천을 받을 수 있습니다.";
const PROFILE_REQUIRED_ERROR = "추천을 받으려면 프로필을 먼저 완료해 주세요.";


function logRecommendationError(error: unknown): void {
  const details = error instanceof Error
    ? {
      name: error.name,
      code: "code" in error && typeof error.code === "string" ? error.code : undefined,
      message: error.message,
    }
    : { name: "UnknownError", code: undefined, message: String(error) };
  console.error("[CURI_RECOMMENDATION_MODEL_ERROR]", details);
}
type StudentSessionResult =
  | { session: ActiveSession }
  | { response: Response };

export type RecommendHandlerOptions = {
  catalog?: readonly CatalogCourse[];
  generateReasons?: RecommendationReasonGenerator;
  now?: () => Date;
};

export type RecommendHandlers = {
  GET(request: Request): Promise<Response>;
};

export function createRecommendHandlers(
  database: AppDatabase,
  options: RecommendHandlerOptions = {},
): RecommendHandlers {
  const catalog = options.catalog ?? getCatalog();
  const generateReasons = options.generateReasons ?? generateRecommendationReasons;
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
    const sessionResult = requireStudentSession(request);
    if ("response" in sessionResult) return sessionResult.response;

    const profile = database.getProfile(sessionResult.session.user.id);
    if (!profile) {
      return Response.json({ error: PROFILE_REQUIRED_ERROR }, { status: 400 });
    }
    return Response.json(await recommendCourses(profile, catalog, generateReasons, logRecommendationError));
  }

  return { GET };
}

let defaultHandlers: RecommendHandlers | undefined;

export async function GET(request: Request): Promise<Response> {
  if (!defaultHandlers) defaultHandlers = createRecommendHandlers(getAppDatabase());
  return defaultHandlers.GET(request);
}
