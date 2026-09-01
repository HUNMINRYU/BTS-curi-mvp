import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { createCredentialTestUser } from "./helpers/auth";

import { createTipsHandlers } from "../app/api/tips/route";

const now = new Date("2026-09-01T00:00:00.000Z");
const expiry = new Date(now.getTime() + 86_400_000).toISOString();
const studentHeaders = { "content-type": "application/json", cookie: "curi_session=student-session" };
const validTip = {
  courseId: "web-content-development",
  prerequisite: 2,
  practice: 3,
  workload: 2,
  tags: ["VS Code 설치", "JavaScript 기초"],
  consent: true,
};

test("팁 API는 데모 집계를 반환하고 로그인 사용자당 과목 1회만 저장한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.seedDemoCourseTips(Array.from({ length: 5 }, (_, index) => ({
    courseId: "web-content-development",
    demoKey: `demo-${index}`,
    prerequisite: 1,
    practice: 3,
    workload: 2,
    tags: ["VS Code 설치"],
  })));
  const { GET, POST } = createTipsHandlers(database, { now: () => now });

  try {
    const initial = await GET(new Request(
      "http://localhost/api/tips?courseId=web-content-development",
      { headers: studentHeaders },
    ));
    assert.equal(initial.status, 200);
    assert.equal((await initial.json()).count, 5);

    const first = await POST(new Request("http://localhost/api/tips", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify(validTip),
    }));
    assert.equal(first.status, 201);
    const firstPayload = await first.json();
    assert.equal(firstPayload.count, 6);
    assert.deepEqual(firstPayload.gamification, {
      totalPoints: 20,
      level: 1,
      badges: ["길잡이"],
      newlyEarnedBadges: ["길잡이"],
    });

    const duplicate = await POST(new Request("http://localhost/api/tips", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify(validTip),
    }));
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: "이 계정은 이미 학습 팁을 제출했습니다." });
  } finally {
    database.close();
  }
});

test("팁 API는 미인증·교수·잘못된 입력을 거부한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-fixture", name: "교수", role: "professor" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.createSession({ id: "professor-session", userId: "professor-fixture", expiresAt: expiry });
  const { GET, POST } = createTipsHandlers(database, { now: () => now });

  try {
    const unauthenticated = await GET(new Request(
      "http://localhost/api/tips?courseId=web-content-development",
    ));
    assert.equal(unauthenticated.status, 401);

    const professor = await POST(new Request("http://localhost/api/tips", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: "curi_session=professor-session" },
      body: JSON.stringify(validTip),
    }));
    assert.equal(professor.status, 403);

    const invalid = await POST(new Request("http://localhost/api/tips", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ ...validTip, tags: [] }),
    }));
    assert.equal(invalid.status, 400);
    assert.equal(database.listCourseTips("web-content-development").length, 0);
    assert.equal(database.getGamificationSummary("student-fixture").totalPoints, 0);
  } finally {
    database.close();
  }
});
