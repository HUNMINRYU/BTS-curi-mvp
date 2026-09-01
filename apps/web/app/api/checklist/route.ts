import type { ActiveSession, AppDatabase } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/features/auth/auth";
import { getCurrentWeek } from "@/lib/course-data";

const COURSE_ID = "web-content-development";
const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 체크리스트를 변경할 수 있습니다.";
const INVALID_INPUT_ERROR = "체크리스트 항목을 확인해 주세요.";

type ChecklistOptions = {
  itemIds?: readonly string[];
  now?: () => Date;
  weekKey?: string;
};

type StudentSessionResult = { session: ActiveSession } | { response: Response };

export type ChecklistHandlers = {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
};

export function createChecklistHandlers(
  database: AppDatabase,
  options: ChecklistOptions = {},
): ChecklistHandlers {
  const currentWeek = getCurrentWeek();
  const itemIds = options.itemIds ?? currentWeek.preparations.map(({ id }) => id);
  const itemIdSet = new Set(itemIds);
  const now = options.now ?? (() => new Date());
  const weekKey = options.weekKey ?? String(currentWeek.week);

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

  function state(userId: string) {
    const completedItemIds = database.listCompletedChecklistItems(userId, COURSE_ID)
      .filter((itemId) => itemIdSet.has(itemId));
    const ratio = itemIds.length === 0 ? 0 : completedItemIds.length / itemIds.length;
    return {
      completedItemIds,
      completedCount: completedItemIds.length,
      totalCount: itemIds.length,
      rewardStage: ratio === 1 ? "complete" : ratio >= 0.5 ? "growing" : "start",
    };
  }

  async function GET(request: Request): Promise<Response> {
    const sessionResult = requireStudent(request);
    if ("response" in sessionResult) return sessionResult.response;

    const courseId = new URL(request.url).searchParams.get("courseId");
    if (courseId !== COURSE_ID) {
      return Response.json({ error: INVALID_INPUT_ERROR }, { status: 400 });
    }
    return Response.json(state(sessionResult.session.user.id));
  }

  async function POST(request: Request): Promise<Response> {
    const sessionResult = requireStudent(request);
    if ("response" in sessionResult) return sessionResult.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: INVALID_INPUT_ERROR }, { status: 400 });
    }

    if (typeof body !== "object" || body === null || Array.isArray(body)
      || !("courseId" in body) || body.courseId !== COURSE_ID
      || !("itemId" in body) || typeof body.itemId !== "string" || !itemIdSet.has(body.itemId)
      || !("completed" in body) || typeof body.completed !== "boolean") {
      return Response.json({ error: INVALID_INPUT_ERROR }, { status: 400 });
    }

    const gamification = database.setChecklistItemAndAward({
      userId: sessionResult.session.user.id,
      courseId: COURSE_ID,
      itemId: body.itemId,
      itemIds,
      weekKey,
      completed: body.completed,
      awardedAt: now().toISOString(),
    });
    return Response.json({ ...state(sessionResult.session.user.id), gamification });
  }

  return { GET, POST };
}

let defaultHandlers: ChecklistHandlers | undefined;

function getDefaultHandlers(): ChecklistHandlers {
  defaultHandlers ??= createChecklistHandlers(getAppDatabase());
  return defaultHandlers;
}

export async function GET(request: Request): Promise<Response> {
  return getDefaultHandlers().GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return getDefaultHandlers().POST(request);
}
