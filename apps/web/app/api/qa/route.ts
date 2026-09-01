import type { ActiveSession, AppDatabase } from "@curi/db";

import { answerWithBedrock } from "@/lib/bedrock";
import { getAppDatabase } from "@/lib/app-db";
import { getActiveSession } from "@/features/auth/auth";
import { getCatalogCourse } from "@/lib/catalog-data";
import {
  createKnowledgeBaseRetriever,
  KNOWLEDGE_BASE_SEARCH_ERROR_MESSAGE,
  type KnowledgeBaseRetrieval,
  type RetrieveCourseCitations,
} from "@/lib/knowledge-base";
import { answerCourseQuestion, notFoundQaResult, type GenerateGroundedAnswer } from "@/lib/qa";
import { redactPersonalContactInfo } from "@/lib/redact";

const QUESTION_ERROR = "질문은 1자 이상 200자 이하로 입력해 주세요.";
const COURSE_ERROR = "이 과목에서는 Q&A를 제공하지 않습니다.";
const UNAUTHORIZED_ERROR = "로그인이 필요합니다.";
const FORBIDDEN_ERROR = "학생 계정만 질문할 수 있습니다.";

type QaHandlerOptions = {
  generateAnswer?: GenerateGroundedAnswer;
  retrieveCitations?: RetrieveCourseCitations;
  now?: () => Date;
};

type StudentSessionResult = { session: ActiveSession } | { response: Response };

export type QaHandlers = {
  POST(request: Request): Promise<Response>;
};

export function createQaHandlers(database: AppDatabase, options: QaHandlerOptions = {}): QaHandlers {
  const generateAnswer = options.generateAnswer ?? answerWithBedrock;
  const retrieveCitations = options.retrieveCitations ?? createKnowledgeBaseRetriever();
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

  async function POST(request: Request): Promise<Response> {
    const sessionResult = requireStudent(request);
    if ("response" in sessionResult) return sessionResult.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: QUESTION_ERROR }, { status: 400 });
    }

    const courseId = typeof body === "object" && body !== null && "courseId" in body
      ? body.courseId
      : undefined;
    if (typeof courseId !== "string" || !getCatalogCourse(courseId)) {
      return Response.json({ error: COURSE_ERROR }, { status: 400 });
    }

    const question = typeof body === "object" && body !== null && "question" in body
      ? body.question
      : undefined;
    if (typeof question !== "string" || question.trim().length < 1 || question.trim().length > 200) {
      return Response.json({ error: QUESTION_ERROR }, { status: 400 });
    }

    const normalizedQuestion = question.trim();
    const awardedAt = now().toISOString();
    let retrieval: KnowledgeBaseRetrieval;
    try {
      retrieval = await retrieveCitations(courseId, normalizedQuestion);
    } catch {
      const result = notFoundQaResult(KNOWLEDGE_BASE_SEARCH_ERROR_MESSAGE);
      return Response.json({
        ...result,
        gamification: database.awardQaQuestion(sessionResult.session.user.id, normalizedQuestion, awardedAt),
      });
    }
    if (retrieval.status === "search_error") {
      const result = notFoundQaResult(KNOWLEDGE_BASE_SEARCH_ERROR_MESSAGE);
      return Response.json({
        ...result,
        gamification: database.awardQaQuestion(sessionResult.session.user.id, normalizedQuestion, awardedAt),
      });
    }

    const result = await answerCourseQuestion(normalizedQuestion, retrieval.citations, generateAnswer);
    if (result.status === "not_found") {
      database.insertQaLog(courseId, normalizedQuestion, awardedAt);
    }
    return Response.json({
      ...result,
      answer: redactPersonalContactInfo(result.answer),
      citations: result.citations.map((citation) => ({
        ...citation,
        excerpt: redactPersonalContactInfo(citation.excerpt),
      })),
      gamification: database.awardQaQuestion(sessionResult.session.user.id, normalizedQuestion, awardedAt),
    });
  }

  return { POST };
}

let defaultHandlers: QaHandlers | undefined;

function getDefaultHandlers(): QaHandlers {
  defaultHandlers ??= createQaHandlers(getAppDatabase());
  return defaultHandlers;
}

export async function POST(request: Request): Promise<Response> {
  return getDefaultHandlers().POST(request);
}
