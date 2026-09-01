import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase, type UserProfile } from "@curi/db";

import { createCredentialTestUser } from "./helpers/auth";

import { createRecommendHandlers } from "../app/api/recommend/route";
import type { CatalogCourse } from "../features/catalog/catalog-data";

const now = new Date("2026-09-01T00:00:00.000Z");
const expiry = new Date(now.getTime() + 86_400_000).toISOString();
const studentCookie = { cookie: "curi_session=student-session" };

const profile: UserProfile = {
  userId: "student-fixture",
  major: "컴퓨터공학과",
  interest: "웹 개발",
  goal: "포트폴리오",
  career: "프론트엔드 개발자",
  style: "직접 해보기",
  hours: "주 5시간",
  avoid: null,
  completedAt: now.toISOString(),
};

function course(id: string, index: number): CatalogCourse {
  return {
    id,
    name: `${id} 과목`,
    department: "컴퓨터공학과",
    summary: "웹 개발 수업",
    goalKeywords: ["포트폴리오", "프론트엔드", "제작"],
    difficulty: "입문",
    prerequisites: [],
    interestTags: ["웹 개발", "프로그래밍"],
    schedule: { day: "월", start: 9 + index, duration: 1 },
    sourceKind: "actual",
  };
}

const catalog = Array.from({ length: 6 }, (_, index) => course(`course-${index + 1}`, index));

function prepareStudentDatabase() {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.upsertProfile(profile);
  return database;
}

test("추천 API는 모델이 고른 후보 3개와 프로필 근거 이유를 반환한다", async () => {
  const database = prepareStudentDatabase();
  const { GET } = createRecommendHandlers(database, {
    catalog,
    now: () => now,
    generateReasons: async () => ({
      recommendations: [
        { courseId: "course-2", reason: "웹 개발 관심과 포트폴리오 목표에 맞는 제작 수업입니다." },
        { courseId: "course-3", reason: "프론트엔드 개발자 진로와 직접 해보기 학습 방식에 맞습니다." },
        { courseId: "course-4", reason: "주 5시간 투자 계획에 맞는 짧은 수업입니다." },
      ],
    }),
  });

  try {
    const response = await GET(new Request("http://localhost/api/recommend", { headers: studentCookie }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      recommendations: [
        { course: catalog[1], score: 200, reason: "웹 개발 관심과 포트폴리오 목표에 맞는 제작 수업입니다." },
        { course: catalog[2], score: 200, reason: "프론트엔드 개발자 진로와 직접 해보기 학습 방식에 맞습니다." },
        { course: catalog[3], score: 200, reason: "주 5시간 투자 계획에 맞는 짧은 수업입니다." },
      ],
      reasonStatus: "ok",
      message: null,
    });
  } finally {
    database.close();
  }
});

test("추천 API는 후보 밖 ID를 모델이 반환하면 결정론적 상위 5개로 폴백한다", async () => {
  const database = prepareStudentDatabase();
  const { GET } = createRecommendHandlers(database, {
    catalog,
    now: () => now,
    generateReasons: async () => ({
      recommendations: [
        { courseId: "course-1", reason: "웹 개발 관심에 맞습니다." },
        { courseId: "outside-catalog", reason: "후보 밖 과목입니다." },
        { courseId: "course-3", reason: "포트폴리오 목표에 맞습니다." },
      ],
    }),
  });

  try {
    const response = await GET(new Request("http://localhost/api/recommend", { headers: studentCookie }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.reasonStatus, "model_error");
    assert.equal(body.message, "AI 추천 이유 대신 저장된 프로필 기준을 표시합니다.");
    assert.deepEqual(body.recommendations.map((item: { reason: string }) => item.reason), [
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
    ]);
  } finally {
    database.close();
  }
});

test("추천 API는 구조가 잘못된 모델 응답에도 결정론적 상위 5개로 폴백한다", async () => {
  const database = prepareStudentDatabase();
  const { GET } = createRecommendHandlers(database, {
    catalog,
    now: () => now,
    generateReasons: async () => ({
      recommendations: [{ courseId: "course-1" }],
    }),
  });

  try {
    const response = await GET(new Request("http://localhost/api/recommend", { headers: studentCookie }));
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.reasonStatus, "model_error");
    assert.equal(body.message, "AI 추천 이유 대신 저장된 프로필 기준을 표시합니다.");
    assert.equal(body.recommendations.length, 5);
  } finally {
    database.close();
  }
});

test("추천 API는 모델 오류에도 결정론적 상위 5개를 유지한다", async () => {
  const database = prepareStudentDatabase();
  const { GET } = createRecommendHandlers(database, {
    catalog,
    now: () => now,
    generateReasons: async () => {
      throw new Error("Bedrock unavailable");
    },
  });

  try {
    const response = await GET(new Request("http://localhost/api/recommend", { headers: studentCookie }));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.reasonStatus, "model_error");
    assert.equal(body.message, "AI 추천 이유 대신 저장된 프로필 기준을 표시합니다.");
    assert.deepEqual(body.recommendations.map((item: { reason: string }) => item.reason), [
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
      "컴퓨터공학과 전공·웹 개발 관심·포트폴리오 목표와 주 5시간 계획에 맞는 과목입니다.",
    ]);
  } finally {
    database.close();
  }
});

test("추천 API는 프로필 없는 학생과 교수 계정을 거부한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-fixture", name: "교수", role: "professor" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.createSession({ id: "professor-session", userId: "professor-fixture", expiresAt: expiry });
  const { GET } = createRecommendHandlers(database, { catalog, now: () => now, generateReasons: async () => ({ recommendations: [] }) });

  try {
    const missingProfile = await GET(new Request("http://localhost/api/recommend", { headers: studentCookie }));
    assert.equal(missingProfile.status, 400);

    const professor = await GET(new Request("http://localhost/api/recommend", {
      headers: { cookie: "curi_session=professor-session" },
    }));
    assert.equal(professor.status, 403);
  } finally {
    database.close();
  }
});
