import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { createProfileHandlers } from "../app/api/profile/route";
import { createSessionHandlers } from "../app/api/session/route";
import { createSignupHandlers } from "../app/api/signup/route";
import { createCredentialTestUser } from "./helpers/auth";

const sessionCookie = (sessionId: string) => `curi_session=${sessionId}`;
const startedAt = new Date("2026-09-01T00:00:00.000Z");
const validProfile = {
  major: "컴퓨터공학과",
  interest: "웹 개발",
  goal: "포트폴리오",
  career: "프론트엔드 개발자",
  style: "직접 해보기",
  hours: "주 5시간",
  avoid: "디자인",
};


test("credential auth stores no plaintext and signup creates a trimmed student account", async () => {
  const database = createAppDatabase(":memory:");
  const { POST } = createSignupHandlers(database, {
    createSessionId: () => "signup-session",
    now: () => startedAt,
    isProduction: false,
  });

  try {
    const response = await POST(new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "new_student", password: "long-enough-password", name: "  새 학생  " }),
    }));
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { redirectTo: "/onboarding" });
    assert.equal(response.headers.get("set-cookie"), "curi_session=signup-session; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax");

    const credential = database.getCredentialByUsername("new_student");
    assert.equal(typeof credential?.user.id, "string");
    assert.notEqual(credential?.user.id, "new_student");
    assert.deepEqual(
      { name: credential?.user.name, role: credential?.user.role },
      { name: "새 학생", role: "student" },
    );
    assert.notEqual(credential?.passwordHash, "long-enough-password");
    assert.notEqual(credential?.passwordSalt, "long-enough-password");
    assert.equal("password" in (credential ?? {}), false);

    const duplicate = await POST(new Request("http://localhost/api/signup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "new_student", password: "another-password", name: "다른 이름" }),
    }));
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), { error: "아이디 또는 비밀번호를 확인해 주세요." });
  } finally {
    database.close();
  }
});

test("signup validates username, password, display name, and rejects legacy user IDs", async () => {
  const database = createAppDatabase(":memory:");
  const { POST } = createSignupHandlers(database, { isProduction: false });
  try {
    for (const body of [
      { username: "ABC_user", password: "long-enough-password", name: "이름" },
      { username: "abc", password: "long-enough-password", name: "이름" },
      { username: "valid_user", password: "short", name: "이름" },
      { username: "valid_user", password: "long-enough-password", name: "   " },
      { username: "valid_user", password: "long-enough-password", name: "이름", userId: "legacy-user-id" },
    ]) {
      const response = await POST(new Request("http://localhost/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      }));
      assert.equal(response.status, 400);
      assert.deepEqual(await response.json(), { error: "아이디 또는 비밀번호를 확인해 주세요." });
    }
  } finally {
    database.close();
  }
});

test("session API authenticates credentials, selects role/profile redirects, and supports GET and DELETE", async () => {
  const database = createAppDatabase(":memory:");
  const studentPassword = createCredentialTestUser(database, { id: "student-user", username: "student_user", name: "학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-user", username: "professor_user", name: "교수", role: "professor" });
  const sessionIds = ["student-session", "complete-student-session", "professor-session"];
  const handlers = createSessionHandlers(database, {
    createSessionId: () => sessionIds.shift() ?? "unexpected-session-id",
    now: () => startedAt,
    isProduction: false,
  });

  try {
    const unauthenticated = await handlers.GET(new Request("http://localhost/api/session"));
    assert.equal(unauthenticated.status, 401);

    const studentLogin = await handlers.POST(new Request("http://localhost/api/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: "student_user", password: studentPassword }),
    }));
    assert.equal(studentLogin.status, 200);
    assert.deepEqual(await studentLogin.json(), { redirectTo: "/onboarding" });
    assert.equal(studentLogin.headers.get("set-cookie"), "curi_session=student-session; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax");

    const currentUser = await handlers.GET(new Request("http://localhost/api/session", { headers: { cookie: sessionCookie("student-session") } }));
    assert.equal(currentUser.status, 200);
    assert.deepEqual(await currentUser.json(), { user: { id: "student-user", name: "학생", role: "student" } });

    const wrongPassword = await handlers.POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "student_user", password: "wrong-password" }),
    }));
    assert.equal(wrongPassword.status, 401);
    assert.deepEqual(await wrongPassword.json(), { error: "아이디 또는 비밀번호를 확인해 주세요." });

    const legacyLogin = await handlers.POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ userId: "legacy-user-id" }),
    }));
    assert.equal(legacyLogin.status, 400);
    assert.deepEqual(await legacyLogin.json(), { error: "아이디 또는 비밀번호를 확인해 주세요." });

    database.upsertProfile({ userId: "student-user", ...validProfile, completedAt: startedAt.toISOString() });
    const completeLogin = await handlers.POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "student_user", password: studentPassword }),
    }));
    assert.deepEqual(await completeLogin.json(), { redirectTo: "/recommend" });

    const professorLogin = await handlers.POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "professor_user", password: "correct-password" }),
    }));
    assert.deepEqual(await professorLogin.json(), { redirectTo: "/professor" });

    const logout = await handlers.DELETE(new Request("http://localhost/api/session", { headers: { cookie: sessionCookie("student-session") } }));
    assert.equal(logout.status, 204);
    assert.equal(logout.headers.get("set-cookie"), "curi_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax");
    assert.equal(database.getActiveSession("student-session", startedAt), null);
  } finally {
    database.close();
  }
});

test("seeded demo accounts with hyphenated usernames can log in", async () => {
  const database = createAppDatabase(":memory:");
  const professorPassword = createCredentialTestUser(database, { id: "professor-test", username: "professor-test", name: "테스트 교수", role: "professor" });
  const studentPassword = createCredentialTestUser(database, { id: "student-test", username: "student-test", name: "테스트 학생", role: "student", password: "student-demo-password" });
  const sessionIds = ["professor-demo-session", "student-demo-session"];
  const handlers = createSessionHandlers(database, {
    createSessionId: () => sessionIds.shift() ?? "unexpected-session-id",
    now: () => startedAt,
    isProduction: false,
  });

  try {
    const professorLogin = await handlers.POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "professor-test", password: professorPassword }),
    }));
    assert.equal(professorLogin.status, 200);
    assert.deepEqual(await professorLogin.json(), { redirectTo: "/professor" });

    const studentLogin = await handlers.POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "student-test", password: studentPassword }),
    }));
    assert.equal(studentLogin.status, 200);
    assert.deepEqual(await studentLogin.json(), { redirectTo: "/onboarding" });
  } finally {
    database.close();
  }
});

test("production session cookies are Secure", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "secure-user", username: "secure_user", name: "보안 사용자", role: "student" });
  const { POST } = createSessionHandlers(database, { createSessionId: () => "secure-session", now: () => startedAt, isProduction: true });
  try {
    const response = await POST(new Request("http://localhost/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: "secure_user", password: "correct-password" }),
    }));
    assert.equal(response.headers.get("set-cookie"), "curi_session=secure-session; Path=/; Max-Age=86400; HttpOnly; SameSite=Lax; Secure");
  } finally {
    database.close();
  }
});

test("profile API blocks professors and persists every submitted field", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "professor-user", username: "professor_user", name: "교수", role: "professor" });
  createCredentialTestUser(database, { id: "student-user", username: "student_user", name: "학생", role: "student" });
  const { GET, POST } = createProfileHandlers(database, { now: () => startedAt });
  const expiry = new Date(startedAt.getTime() + 86_400_000).toISOString();
  try {
    database.createSession({ id: "professor-session", userId: "professor-user", expiresAt: expiry });
    const professorProfile = await GET(new Request("http://localhost/api/profile", { headers: { cookie: sessionCookie("professor-session") } }));
    assert.equal(professorProfile.status, 403);
    database.createSession({ id: "student-session", userId: "student-user", expiresAt: expiry });
    const invalidProfile = await POST(new Request("http://localhost/api/profile", { method: "POST", headers: { "content-type": "application/json", cookie: sessionCookie("student-session") }, body: JSON.stringify({ ...validProfile, goal: "알 수 없는 목표" }) }));
    assert.equal(invalidProfile.status, 400);
    assert.equal(database.getProfile("student-user"), null);
    const savedProfile = await POST(new Request("http://localhost/api/profile", { method: "POST", headers: { "content-type": "application/json", cookie: sessionCookie("student-session") }, body: JSON.stringify(validProfile) }));
    assert.equal(savedProfile.status, 200);
    assert.deepEqual(await savedProfile.json(), {
      redirectTo: "/recommend",
      gamification: {
        totalPoints: 30,
        level: 1,
        badges: ["나를 아는 학생"],
        newlyEarnedBadges: ["나를 아는 학생"],
      },
    });
    assert.deepEqual(database.getProfile("student-user"), { userId: "student-user", ...validProfile, completedAt: startedAt.toISOString() });
  } finally {
    database.close();
  }
});
