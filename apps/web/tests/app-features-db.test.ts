import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase, type AppDatabase } from "@curi/db";

import { createCredentialTestUser, createTestSession } from "./helpers/auth";

const now = new Date("2026-09-01T00:00:00.000Z");

function createStudentSession(database: AppDatabase, id = "student-session") {
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  createTestSession(database, {
    id,
    userId: "student-fixture",
    expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
  });
}

test("체크리스트 상태는 사용자·과목·항목별로 저장되고 해제된다", () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  try {
    database.setChecklistItem("student-fixture", "web-content-development", "vscode", true);
    database.setChecklistItem("student-fixture", "web-content-development", "chrome", true);
    assert.deepEqual(
      database.listCompletedChecklistItems("student-fixture", "web-content-development"),
      ["chrome", "vscode"],
    );

    database.setChecklistItem("student-fixture", "web-content-development", "vscode", false);
    assert.deepEqual(
      database.listCompletedChecklistItems("student-fixture", "web-content-development"),
      ["chrome"],
    );
  } finally {
    database.close();
  }
});

test("근거 없음 질문은 익명으로 기록되고 같은 문구는 교수 집계에서 묶인다", () => {
  const database = createAppDatabase(":memory:");
  try {
    database.insertQaLog("web-content-development", "장학금 신청은 어떻게 하나요?", now.toISOString());
    database.insertQaLog("web-content-development", "장학금 신청은 어떻게 하나요?", now.toISOString());
    database.insertQaLog("database", "교재는 무엇인가요?", now.toISOString());

    assert.deepEqual(database.listQaLogSummary(), [
      {
        courseId: "web-content-development",
        question: "장학금 신청은 어떻게 하나요?",
        count: 2,
        lastOccurredAt: now.toISOString(),
      },
      {
        courseId: "database",
        question: "교재는 무엇인가요?",
        count: 1,
        lastOccurredAt: now.toISOString(),
      },
    ]);
  } finally {
    database.close();
  }
});

test("구조화 팁은 데모 시드가 멱등이고 로그인 사용자당 과목 1회를 보장한다", () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  const demoTip = {
    courseId: "web-content-development",
    demoKey: "demo-01",
    prerequisite: 1,
    practice: 3,
    workload: 2,
    tags: ["VS Code 설치"],
  };

  try {
    assert.equal(database.seedDemoCourseTips([demoTip]), 1);
    assert.equal(database.seedDemoCourseTips([demoTip]), 0);
    database.insertUserCourseTipAndList({
      courseId: "web-content-development",
      userId: "student-fixture",
      prerequisite: 2,
      practice: 3,
      workload: 2,
      tags: ["JavaScript 기초"],
    });
    assert.equal(database.listCourseTips("web-content-development").length, 2);
    assert.throws(() => database.insertUserCourseTipAndList({
      courseId: "web-content-development",
      userId: "student-fixture",
      prerequisite: 1,
      practice: 1,
      workload: 1,
      tags: ["HTML/CSS 기초"],
    }), /already exists/i);
  } finally {
    database.close();
  }
});

test("학생 세션 준비 헬퍼는 API 테스트에 쓸 수 있다", () => {
  const database = createAppDatabase(":memory:");
  try {
    createStudentSession(database);
    assert.equal(database.getActiveSession("student-session", now)?.user.role, "student");
  } finally {
    database.close();
  }
});

test("준비왕 랭킹은 포인트순·동점 ID순이며 현재 학생 순위를 표시한다", () => {
  const database = createAppDatabase(":memory:");
  try {
    for (const [id, name] of [
      ["student-a", "가나다"],
      ["student-b", "나학생"],
      ["student-c", "다학생"],
      ["student-d", "라학생"],
      ["student-e", "마학생"],
      ["student-f", "바학생"],
    ] as const) {
      createCredentialTestUser(database, { id, name, role: "student" });
    }
    database.awardOnboarding("student-a", now.toISOString());
    database.awardOnboarding("student-b", now.toISOString());
    database.awardQaQuestion("student-b", "질문", now.toISOString());
    database.awardOnboarding("student-c", now.toISOString());
    database.awardQaQuestion("student-c", "질문", now.toISOString());
    database.awardOnboarding("student-d", now.toISOString());
    database.awardOnboarding("student-e", now.toISOString());
    database.awardOnboarding("student-f", now.toISOString());

    assert.deepEqual(database.getStudentRanking("student-f"), {
      leaders: [
        { rank: 1, displayName: "나**", totalPoints: 35, isMe: false },
        { rank: 2, displayName: "다**", totalPoints: 35, isMe: false },
        { rank: 3, displayName: "가**", totalPoints: 30, isMe: false },
        { rank: 4, displayName: "라**", totalPoints: 30, isMe: false },
        { rank: 5, displayName: "마**", totalPoints: 30, isMe: false },
      ],
      me: { rank: 6, displayName: "바**", totalPoints: 30, isMe: true },
    });
  } finally {
    database.close();
  }
});

test("교수용 학급 현황과 TMI는 학생 식별정보 없이 집계한다", () => {
  const database = createAppDatabase(":memory:");
  try {
    for (const [index, interest] of ["웹 개발", "웹 개발", "AI", "웹 개발", "AI"].entries()) {
      const id = `student-${index}`;
      createCredentialTestUser(database, { id, name: `학생 ${index}`, role: "student" });
      database.upsertProfile({
        userId: id,
        major: "컴퓨터공학과",
        interest,
        goal: index < 3 ? "포트폴리오" : "취업",
        career: "프론트엔드 개발자",
        style: index < 4 ? "직접 해보기" : "강의 듣기",
        hours: index < 2 ? "주 5시간" : "주 3시간",
        avoid: null,
        completedAt: now.toISOString(),
      });
      database.awardOnboarding(id, now.toISOString());
    }
    createCredentialTestUser(database, { id: "student-incomplete", name: "미완료 학생", role: "student" });
    createCredentialTestUser(database, { id: "professor-test", name: "테스트 교수", role: "professor" });
    database.setChecklistItem("student-0", "web-content-development", "vscode", true);

    assert.deepEqual(database.getAnonymousClassInsights(), {
      status: {
        studentCount: 6,
        onboardingCount: 5,
        totalPoints: 150,
        averagePoints: 25,
        badgeCount: 5,
        checklistCompletionCount: 1,
      },
      tmi: {
        profileCount: 5,
        visible: true,
        topValues: [
          { field: "interest", label: "관심분야", value: "웹 개발", count: 3 },
          { field: "goal", label: "학습 목표", value: "포트폴리오", count: 3 },
          { field: "style", label: "학습 스타일", value: "직접 해보기", count: 4 },
          { field: "hours", label: "주간 학습 시간", value: "주 3시간", count: 3 },
        ],
      },
    });
  } finally {
    database.close();
  }
});
