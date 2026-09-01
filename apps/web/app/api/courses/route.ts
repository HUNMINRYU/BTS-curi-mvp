import type { ActiveSession, AppDatabase } from "@curi/db";

import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/lib/auth";
import { getCatalog, type CatalogCourse } from "@/lib/catalog-data";

const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 시간표를 변경할 수 있습니다.";
const INVALID_COURSE_ERROR = "과목을 확인해 주세요.";

type StudentSessionResult =
  | { session: ActiveSession }
  | { response: Response };

export type CoursesHandlerOptions = {
  catalog?: readonly CatalogCourse[];
  now?: () => Date;
};

export type CoursesHandlers = {
  GET(request: Request): Promise<Response>;
  POST(request: Request): Promise<Response>;
  DELETE(request: Request): Promise<Response>;
};

export function createCoursesHandlers(
  database: AppDatabase,
  options: CoursesHandlerOptions = {},
): CoursesHandlers {
  const catalog = options.catalog ?? getCatalog();
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

  async function readCatalogCourse(request: Request): Promise<CatalogCourse | null> {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return null;
    }
    if (typeof body !== "object" || body === null || Array.isArray(body)
      || !("courseId" in body) || typeof body.courseId !== "string") {
      return null;
    }
    return catalog.find((course) => course.id === body.courseId) ?? null;
  }

  function listSelectedCourses(userId: string): CatalogCourse[] {
    const selectedIds = database.listUserCourseIds(userId);
    return catalog.filter((course) => selectedIds.includes(course.id));
  }

  async function GET(request: Request): Promise<Response> {
    const sessionResult = requireStudentSession(request);
    if ("response" in sessionResult) return sessionResult.response;
    return Response.json({ courses: listSelectedCourses(sessionResult.session.user.id) });
  }

  async function POST(request: Request): Promise<Response> {
    const sessionResult = requireStudentSession(request);
    if ("response" in sessionResult) return sessionResult.response;
    const course = await readCatalogCourse(request);
    if (!course) return Response.json({ error: INVALID_COURSE_ERROR }, { status: 400 });

    database.addUserCourse(sessionResult.session.user.id, course.id);
    return Response.json({ courses: listSelectedCourses(sessionResult.session.user.id) });
  }

  async function DELETE(request: Request): Promise<Response> {
    const sessionResult = requireStudentSession(request);
    if ("response" in sessionResult) return sessionResult.response;
    const course = await readCatalogCourse(request);
    if (!course) return Response.json({ error: INVALID_COURSE_ERROR }, { status: 400 });

    database.removeUserCourse(sessionResult.session.user.id, course.id);
    return Response.json({ courses: listSelectedCourses(sessionResult.session.user.id) });
  }

  return { GET, POST, DELETE };
}

let defaultHandlers: CoursesHandlers | undefined;

export async function GET(request: Request): Promise<Response> {
  if (!defaultHandlers) defaultHandlers = createCoursesHandlers(getAppDatabase());
  return defaultHandlers.GET(request);
}

export async function POST(request: Request): Promise<Response> {
  if (!defaultHandlers) defaultHandlers = createCoursesHandlers(getAppDatabase());
  return defaultHandlers.POST(request);
}

export async function DELETE(request: Request): Promise<Response> {
  if (!defaultHandlers) defaultHandlers = createCoursesHandlers(getAppDatabase());
  return defaultHandlers.DELETE(request);
}
