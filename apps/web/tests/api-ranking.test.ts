import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { createRankingHandlers } from "../app/api/ranking/route";
import { createCredentialTestUser } from "./helpers/auth";

const now = new Date("2026-09-01T00:00:00.000Z");
const expiry = new Date(now.getTime() + 86_400_000).toISOString();

test("준비왕 랭킹 API는 로그인 학생에게만 익명 순위를 반환한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-a", name: "가학생", role: "student" });
  createCredentialTestUser(database, { id: "student-b", name: "나학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-test", name: "테스트 교수", role: "professor" });
  database.createSession({ id: "student-session", userId: "student-b", expiresAt: expiry });
  database.createSession({ id: "professor-session", userId: "professor-test", expiresAt: expiry });
  database.awardOnboarding("student-a", now.toISOString());
  database.awardOnboarding("student-b", now.toISOString());
  database.awardQaQuestion("student-a", "질문", now.toISOString());
  const { GET } = createRankingHandlers(database, { now: () => now });

  try {
    const unauthenticated = await GET(new Request("http://localhost/api/ranking"));
    assert.equal(unauthenticated.status, 401);

    const professor = await GET(new Request("http://localhost/api/ranking", {
      headers: { cookie: "curi_session=professor-session" },
    }));
    assert.equal(professor.status, 403);

    const student = await GET(new Request("http://localhost/api/ranking", {
      headers: { cookie: "curi_session=student-session" },
    }));
    assert.equal(student.status, 200);
    assert.deepEqual(await student.json(), {
      ranking: {
        leaders: [
          { rank: 1, displayName: "가**", totalPoints: 35, isMe: false },
          { rank: 2, displayName: "나**", totalPoints: 30, isMe: true },
        ],
        me: { rank: 2, displayName: "나**", totalPoints: 30, isMe: true },
      },
    });
  } finally {
    database.close();
  }
});
