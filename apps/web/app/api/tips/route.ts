import {
  DuplicateCourseTipError,
  type ActiveSession,
  type AppDatabase,
} from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/features/auth/auth";
import { getTipAggregate, seedDemoTips } from "@/features/tips/tip-data";
import { TipValidationError, validateTipInput } from "@/features/tips/tips";

const COURSE_ID = "web-content-development";
const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 학습 팁을 제출할 수 있습니다.";
const COURSE_ERROR = "과목을 확인해 주세요.";
const DUPLICATE_ERROR = "이 계정은 이미 학습 팁을 제출했습니다.";
const STORAGE_ERROR = "학습 팁을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";

type TipsHandlerOptions = {
  now?: () => Date;
};

type StudentSessionResult = { session: ActiveSession } | { response: Response };

export type TipsHandlers = {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
};

export function createTipsHandlers(database: AppDatabase, options: TipsHandlerOptions = {}): TipsHandlers {
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

    const courseId = new URL(request.url).searchParams.get("courseId");
    if (courseId !== COURSE_ID) {
      return Response.json({ error: COURSE_ERROR }, { status: 400 });
    }
    return Response.json(getTipAggregate(database, COURSE_ID));
  }

  async function POST(request: Request): Promise<Response> {
    const sessionResult = requireStudent(request);
    if ("response" in sessionResult) return sessionResult.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "학습 팁 입력을 확인해 주세요." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null || !("courseId" in body) || body.courseId !== COURSE_ID) {
      return Response.json({ error: COURSE_ERROR }, { status: 400 });
    }

    try {
      const input = validateTipInput(body);
      const gamification = database.insertUserCourseTipAndAward({
        courseId: COURSE_ID,
        userId: sessionResult.session.user.id,
        prerequisite: input.prerequisite,
        practice: input.practice,
        workload: input.workload,
        tags: input.tags,
        awardedAt: now().toISOString(),
      });
      return Response.json({ ...getTipAggregate(database, COURSE_ID), gamification }, { status: 201 });
    } catch (error) {
      if (error instanceof TipValidationError) {
        return Response.json({ error: error.message }, { status: 400 });
      }
      if (error instanceof DuplicateCourseTipError) {
        return Response.json({ error: DUPLICATE_ERROR }, { status: 409 });
      }
      return Response.json({ error: STORAGE_ERROR }, { status: 500 });
    }
  }

  return { GET, POST };
}

let defaultHandlers: TipsHandlers | undefined;

function getDefaultHandlers(): TipsHandlers {
  if (!defaultHandlers) {
    const database = getAppDatabase();
    seedDemoTips(database);
    defaultHandlers = createTipsHandlers(database);
  }
  return defaultHandlers;
}

export async function GET(request: Request): Promise<Response> {
  return getDefaultHandlers().GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return getDefaultHandlers().POST(request);
}
