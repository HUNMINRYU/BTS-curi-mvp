import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { createCredentialTestUser } from "./helpers/auth";

import { createQaHandlers } from "../app/api/qa/route";
import type { RetrieveCourseCitations } from "../features/qa/knowledge-base";
import type { Citation } from "../lib/types";

const now = new Date("2026-09-01T00:00:00.000Z");
const expiry = new Date(now.getTime() + 86_400_000).toISOString();
const studentHeaders = { "content-type": "application/json", cookie: "curi_session=student-session" };
const officialCitation: Citation = {
  id: "kb-1",
  documentName: "syllabus.pdf",
  sourceKind: "actual",
  week: 7,
  excerpt: "7주차 공식 수업 내용입니다.",
};

function request(body: unknown, headers: Record<string, string> = studentHeaders) {
  return new Request("http://localhost/api/qa", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

function retrieveCitations(citations: Citation[]): RetrieveCourseCitations {
  return async () => ({ status: "success", citations });
}

test("Q&A API는 로그인 학생과 catalog의 전공·교양 과목을 허용한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-fixture", name: "교수", role: "professor" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.createSession({ id: "professor-session", userId: "professor-fixture", expiresAt: expiry });
  const retrievedCourseIds: string[] = [];
  const { POST } = createQaHandlers(database, {
    now: () => now,
    generateAnswer: async () => "답변",
    retrieveCitations: async (courseId) => {
      retrievedCourseIds.push(courseId);
      return { status: "success", citations: [officialCitation] };
    },
  });

  try {
    const unauthenticated = await POST(request(
      { courseId: "web-content-development", question: "7주차 주제는?" },
      { "content-type": "application/json" },
    ));
    assert.equal(unauthenticated.status, 401);

    const professor = await POST(request(
      { courseId: "web-content-development", question: "7주차 주제는?" },
      { "content-type": "application/json", cookie: "curi_session=professor-session" },
    ));
    assert.equal(professor.status, 403);
    assert.equal(database.getGamificationSummary("student-fixture").totalPoints, 0);

    const majorCourse = await POST(request({ courseId: "database", question: "7주차 주제는?" }));
    assert.equal(majorCourse.status, 200);
    assert.deepEqual((await majorCourse.json()).gamification, {
      totalPoints: 5,
      level: 1,
      badges: ["호기심 탐험가"],
      newlyEarnedBadges: ["호기심 탐험가"],
    });

    const generalCourse = await POST(request({
      courseId: "k-culture-and-global-sensitivity",
      question: "7주차 주제는?",
    }));
    assert.equal(generalCourse.status, 200);
    assert.equal((await generalCourse.json()).gamification.totalPoints, 5);

    const invalidCourse = await POST(request({ courseId: "not-in-catalog", question: "7주차 주제는?" }));
    assert.equal(invalidCourse.status, 400);
    assert.deepEqual(retrievedCourseIds, ["database", "k-culture-and-global-sensitivity"]);
  } finally {
    database.close();
  }
});

test("Q&A API는 200자를 넘는 질문을 400으로 거부한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  const { POST } = createQaHandlers(database, { now: () => now, generateAnswer: async () => "호출되면 안 됩니다." });

  try {
    const response = await POST(request({ courseId: "web-content-development", question: "가".repeat(201) }));
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), { error: "질문은 1자 이상 200자 이하로 입력해 주세요." });
    assert.equal(database.getGamificationSummary("student-fixture").totalPoints, 0);
  } finally {
    database.close();
  }
});

test("Q&A API는 근거 없는 질문에서 모델을 호출하지 않고 실제 과목 ID로 로그를 저장한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  let modelCalls = 0;
  const { POST } = createQaHandlers(database, {
    now: () => now,
    retrieveCitations: retrieveCitations([]),
    generateAnswer: async () => {
      modelCalls += 1;
      return "호출되면 안 됩니다.";
    },
  });

  try {
    const response = await POST(request({
      courseId: "k-culture-and-global-sensitivity",
      question: "장학금 신청 방법은 무엇인가요?",
    }));
    assert.equal(response.status, 200);
    assert.equal(modelCalls, 0);
    assert.deepEqual(await response.json(), {
      status: "not_found",
      answer: "공식 문서에서 근거를 찾지 못했습니다. 담당자에게 확인해 주세요.",
      citations: [],
      gamification: {
        totalPoints: 5,
        level: 1,
        badges: ["호기심 탐험가"],
        newlyEarnedBadges: ["호기심 탐험가"],
      },
    });
    assert.deepEqual(database.listQaLogSummary(), [{
      courseId: "k-culture-and-global-sensitivity",
      question: "장학금 신청 방법은 무엇인가요?",
      count: 1,
      lastOccurredAt: now.toISOString(),
    }]);
  } finally {
    database.close();
  }
});

test("Q&A API는 검색 오류를 model_error로 처리하거나 근거 없음 로그를 남기지 않는다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  let modelCalls = 0;
  const { POST } = createQaHandlers(database, {
    now: () => now,
    retrieveCitations: async () => ({ status: "search_error" }),
    generateAnswer: async () => {
      modelCalls += 1;
      return "호출되면 안 됩니다.";
    },
  });

  try {
    const response = await POST(request({
      courseId: "database",
      question: "7주차 주제는?",
    }));
    assert.equal(response.status, 200);
    assert.equal(modelCalls, 0);
    assert.deepEqual(await response.json(), {
      status: "not_found",
      answer: "공식 문서를 검색할 수 없습니다. 잠시 후 다시 시도해 주세요.",
      citations: [],
      gamification: {
        totalPoints: 5,
        level: 1,
        badges: ["호기심 탐험가"],
        newlyEarnedBadges: ["호기심 탐험가"],
      },
    });
    assert.deepEqual(database.listQaLogSummary(), []);
  } finally {
    database.close();
  }
});

test("Q&A API는 답변과 citation의 개인 연락처를 마스킹한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  const citationWithContactInfo: Citation = {
    ...officialCitation,
    excerpt: "담당 교수 이메일 professor.name@gwangju.ac.kr, 전화 010-1234-5678",
  };
  const { POST } = createQaHandlers(database, {
    now: () => now,
    retrieveCitations: retrieveCitations([citationWithContactInfo]),
    generateAnswer: async () => "professor.name@gwangju.ac.kr 또는 01012345678로 문의하세요.",
  });

  try {
    const response = await POST(request({
      courseId: "web-content-development",
      question: "담당 교수에게 어떻게 문의하나요?",
    }));
    const result = await response.json();

    assert.equal(response.status, 200);
    assert.equal(result.answer, "[이메일 비공개] 또는 [전화번호 비공개]로 문의하세요.");
    assert.equal(
      result.citations[0].excerpt,
      "담당 교수 이메일 [이메일 비공개], 전화 [전화번호 비공개]",
    );
    assert.equal(JSON.stringify(result.citations).includes("professor.name@gwangju.ac.kr"), false);
  } finally {
    database.close();
  }
});

test("Q&A API는 모델 오류에서도 검색한 공식 근거를 반환하고 로그를 남기지 않는다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  const { POST } = createQaHandlers(database, {
    now: () => now,
    retrieveCitations: retrieveCitations([officialCitation]),
    generateAnswer: async () => { throw new Error("Bedrock unavailable"); },
  });

  try {
    const response = await POST(request({
      courseId: "web-content-development",
      question: "7주차 실습 전에 무엇을 준비해야 하나요?",
    }));
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.status, "model_error");
    assert.equal(result.answer, "AI 답변을 생성하지 못했습니다. 아래 공식 근거를 확인해 주세요.");
    assert.deepEqual(result.citations, [officialCitation]);
    assert.deepEqual(result.gamification, {
      totalPoints: 5,
      level: 1,
      badges: ["호기심 탐험가"],
      newlyEarnedBadges: ["호기심 탐험가"],
    });
    assert.deepEqual(database.listQaLogSummary(), []);
  } finally {
    database.close();
  }
});
