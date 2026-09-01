import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase, type AppDatabase } from "@curi/db";

import { createCredentialTestUser } from "./helpers/auth";

const startedAt = "2026-09-01T00:00:00.000Z";
const nextDay = "2026-09-02T00:00:00.000Z";
const courseId = "web-content-development";
const checklistItems = ["vscode", "chrome"] as const;

function withStudent(run: (database: AppDatabase) => void): void {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  try {
    run(database);
  } finally {
    database.close();
  }
}

test("onboarding awards its points and badge exactly once", () => {
  withStudent((database) => {
    assert.deepEqual(database.getGamificationSummary("student-fixture"), {
      totalPoints: 0,
      level: 1,
      badges: [],
      newlyEarnedBadges: [],
    });

    assert.deepEqual(database.awardOnboarding("student-fixture", startedAt), {
      totalPoints: 30,
      level: 1,
      badges: ["나를 아는 학생"],
      newlyEarnedBadges: ["나를 아는 학생"],
    });
    assert.deepEqual(database.awardOnboarding("student-fixture", startedAt), {
      totalPoints: 30,
      level: 1,
      badges: ["나를 아는 학생"],
      newlyEarnedBadges: [],
    });
  });
});

test("checklist completion cannot be farmed after an uncheck and awards one weekly clear", () => {
  withStudent((database) => {
    const first = database.setChecklistItemAndAward({
      userId: "student-fixture",
      courseId,
      itemId: "vscode",
      itemIds: checklistItems,
      weekKey: "week-1",
      completed: true,
      awardedAt: startedAt,
    });
    assert.equal(first.totalPoints, 10);
    assert.deepEqual(first.newlyEarnedBadges, []);

    database.setChecklistItemAndAward({
      userId: "student-fixture",
      courseId,
      itemId: "vscode",
      itemIds: checklistItems,
      weekKey: "week-1",
      completed: false,
      awardedAt: startedAt,
    });
    const rechecked = database.setChecklistItemAndAward({
      userId: "student-fixture",
      courseId,
      itemId: "vscode",
      itemIds: checklistItems,
      weekKey: "week-1",
      completed: true,
      awardedAt: startedAt,
    });
    assert.equal(rechecked.totalPoints, 10);

    const weeklyClear = database.setChecklistItemAndAward({
      userId: "student-fixture",
      courseId,
      itemId: "chrome",
      itemIds: checklistItems,
      weekKey: "week-1",
      completed: true,
      awardedAt: startedAt,
    });
    assert.deepEqual(weeklyClear, {
      totalPoints: 50,
      level: 2,
      badges: ["이번 주 정복"],
      newlyEarnedBadges: ["이번 주 정복"],
    });

    const repeatedWeeklyClear = database.setChecklistItemAndAward({
      userId: "student-fixture",
      courseId,
      itemId: "chrome",
      itemIds: checklistItems,
      weekKey: "week-1",
      completed: true,
      awardedAt: startedAt,
    });
    assert.equal(repeatedWeeklyClear.totalPoints, 50);
    assert.deepEqual(repeatedWeeklyClear.newlyEarnedBadges, []);
  });
});

test("question awards use three distinct normalized questions per UTC day without retaining question text", () => {
  withStudent((database) => {
    const first = database.awardQaQuestion("student-fixture", "  실습   준비물  ", startedAt);
    assert.deepEqual(first, {
      totalPoints: 5,
      level: 1,
      badges: ["호기심 탐험가"],
      newlyEarnedBadges: ["호기심 탐험가"],
    });
    assert.equal(database.awardQaQuestion("student-fixture", "실습 준비물", startedAt).totalPoints, 5);
    assert.equal(database.awardQaQuestion("student-fixture", "두 번째 질문", startedAt).totalPoints, 10);
    assert.equal(database.awardQaQuestion("student-fixture", "세 번째 질문", startedAt).totalPoints, 15);
    const capped = database.awardQaQuestion("student-fixture", "네 번째 질문", startedAt);
    assert.equal(capped.totalPoints, 15);
    assert.deepEqual(capped.newlyEarnedBadges, []);

    const tomorrow = database.awardQaQuestion("student-fixture", "네 번째 질문", nextDay);
    assert.equal(tomorrow.totalPoints, 20);
    for (const eventKey of database.listGamificationEventKeys("student-fixture")) {
      assert.doesNotMatch(eventKey, /실습|준비물|질문/);
    }
  });
});

test("successful course tip awards its points and first-tip badge once", () => {
  withStudent((database) => {
    const summary = database.insertUserCourseTipAndAward({
      courseId,
      userId: "student-fixture",
      prerequisite: 2,
      practice: 2,
      workload: 2,
      tags: ["실습"],
      awardedAt: startedAt,
    });
    assert.deepEqual(summary, {
      totalPoints: 20,
      level: 1,
      badges: ["길잡이"],
      newlyEarnedBadges: ["길잡이"],
    });
  });
});

test("level boundaries are derived from awarded points", () => {
  withStudent((database) => {
    database.awardOnboarding("student-fixture", startedAt);
    database.setChecklistItemAndAward({ userId: "student-fixture", courseId, itemId: "vscode", itemIds: checklistItems, weekKey: "week-1", completed: true, awardedAt: startedAt });
    database.setChecklistItemAndAward({ userId: "student-fixture", courseId, itemId: "chrome", itemIds: checklistItems, weekKey: "week-1", completed: true, awardedAt: startedAt });
    assert.equal(database.getGamificationSummary("student-fixture").level, 2);

    database.awardQaQuestion("student-fixture", "첫 질문", startedAt);
    database.awardQaQuestion("student-fixture", "둘 질문", startedAt);
    database.awardQaQuestion("student-fixture", "셋 질문", startedAt);
    database.insertUserCourseTipAndAward({ courseId, userId: "student-fixture", prerequisite: 1, practice: 1, workload: 1, tags: ["계획"], awardedAt: startedAt });
    assert.deepEqual(database.getGamificationSummary("student-fixture"), {
      totalPoints: 115,
      level: 3,
      badges: ["나를 아는 학생", "이번 주 정복", "호기심 탐험가", "길잡이"],
      newlyEarnedBadges: [],
    });
  });
});
