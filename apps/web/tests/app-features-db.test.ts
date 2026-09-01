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
