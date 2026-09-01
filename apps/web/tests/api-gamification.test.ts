import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { createGamificationHandlers } from "../app/api/gamification/route";
import { createCredentialTestUser } from "./helpers/auth";

const now = new Date("2026-09-01T00:00:00.000Z");
const expiry = new Date(now.getTime() + 86_400_000).toISOString();

test("gamification summary is available only to the authenticated student", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-fixture", name: "교수", role: "professor" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.createSession({ id: "professor-session", userId: "professor-fixture", expiresAt: expiry });
  database.awardOnboarding("student-fixture", now.toISOString());
  const { GET } = createGamificationHandlers(database, { now: () => now });

  try {
    const unauthenticated = await GET(new Request("http://localhost/api/gamification"));
    assert.equal(unauthenticated.status, 401);

    const professor = await GET(new Request("http://localhost/api/gamification", {
      headers: { cookie: "curi_session=professor-session" },
    }));
    assert.equal(professor.status, 403);

    const student = await GET(new Request("http://localhost/api/gamification", {
      headers: { cookie: "curi_session=student-session" },
    }));
    assert.deepEqual(await student.json(), {
      gamification: {
        totalPoints: 30,
        level: 1,
        badges: ["나를 아는 학생"],
        newlyEarnedBadges: [],
      },
    });
  } finally {
    database.close();
  }
});
