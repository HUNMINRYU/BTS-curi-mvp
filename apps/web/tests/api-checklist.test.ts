import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { createCredentialTestUser } from "./helpers/auth";

import { createChecklistHandlers } from "../app/api/checklist/route";

const now = new Date("2026-09-01T00:00:00.000Z");
const expiry = new Date(now.getTime() + 86_400_000).toISOString();
const studentHeaders = { "content-type": "application/json", cookie: "curi_session=student-session" };
const items = ["vscode", "chrome", "javascript-runtime"] as const;

test("체크리스트 API는 로그인 학생의 완료 상태와 성장 단계를 저장한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  const { GET, POST } = createChecklistHandlers(database, { now: () => now, itemIds: items });

  try {
    const initial = await GET(new Request("http://localhost/api/checklist?courseId=web-content-development", {
      headers: studentHeaders,
    }));
    assert.deepEqual(await initial.json(), {
      completedItemIds: [],
      completedCount: 0,
      totalCount: 3,
      rewardStage: "start",
    });

    const first = await POST(new Request("http://localhost/api/checklist", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-content-development", itemId: "vscode", completed: true }),
    }));
    assert.deepEqual(await first.json(), {
      completedItemIds: ["vscode"],
      completedCount: 1,
      totalCount: 3,
      rewardStage: "start",
      gamification: {
        totalPoints: 10,
        level: 1,
        badges: [],
        newlyEarnedBadges: [],
      },
    });

    await POST(new Request("http://localhost/api/checklist", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-content-development", itemId: "chrome", completed: true }),
    }));
    const complete = await POST(new Request("http://localhost/api/checklist", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-content-development", itemId: "javascript-runtime", completed: true }),
    }));
    assert.deepEqual(await complete.json(), {
      completedItemIds: ["chrome", "javascript-runtime", "vscode"],
      completedCount: 3,
      totalCount: 3,
      rewardStage: "complete",
      gamification: {
        totalPoints: 60,
        level: 2,
        badges: ["이번 주 정복"],
        newlyEarnedBadges: ["이번 주 정복"],
      },
    });

    const persisted = await GET(new Request("http://localhost/api/checklist?courseId=web-content-development", {
      headers: studentHeaders,
    }));
    assert.deepEqual((await persisted.json()).completedItemIds, ["chrome", "javascript-runtime", "vscode"]);
  } finally {
    database.close();
  }
});

test("체크리스트 API는 교수와 허용되지 않은 항목을 거부한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-fixture", name: "교수", role: "professor" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.createSession({ id: "professor-session", userId: "professor-fixture", expiresAt: expiry });
  const { GET, POST } = createChecklistHandlers(database, { now: () => now, itemIds: items });

  try {
    const professor = await GET(new Request("http://localhost/api/checklist?courseId=web-content-development", {
      headers: { cookie: "curi_session=professor-session" },
    }));
    assert.equal(professor.status, 403);

    const invalid = await POST(new Request("http://localhost/api/checklist", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-content-development", itemId: "unknown", completed: true }),
    }));
    assert.equal(invalid.status, 400);
    assert.deepEqual(database.listCompletedChecklistItems("student-fixture", "web-content-development"), []);
    assert.deepEqual(database.getGamificationSummary("student-fixture"), {
      totalPoints: 0,
      level: 1,
      badges: [],
      newlyEarnedBadges: [],
    });
  } finally {
    database.close();
  }
});
