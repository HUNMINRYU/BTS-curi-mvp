import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { createCredentialTestUser } from "./helpers/auth";

import { createCoursesHandlers } from "../app/api/courses/route";
import type { CatalogCourse } from "../features/catalog/catalog-data";

const now = new Date("2026-09-01T00:00:00.000Z");
const expiry = new Date(now.getTime() + 86_400_000).toISOString();
const studentHeaders = { "content-type": "application/json", cookie: "curi_session=student-session" };

const catalog: CatalogCourse[] = [
  {
    id: "web-course",
    name: "웹 과목",
    department: "컴퓨터공학과",
    summary: "웹 개발 수업",
    goalKeywords: ["HTML5"],
    difficulty: "입문",
    prerequisites: ["컴퓨터 기초"],
    interestTags: ["웹 개발"],
    schedule: { day: "월", start: 9, duration: 2 },
    sourceKind: "actual",
  },
  {
    id: "database-course",
    name: "데이터베이스 과목",
    department: "컴퓨터공학과",
    summary: "데이터베이스 수업",
    goalKeywords: ["SQL"],
    difficulty: "중급",
    prerequisites: ["프로그래밍 기초"],
    interestTags: ["데이터"],
    schedule: { day: "화", start: 10, duration: 2 },
    sourceKind: "actual",
  },
];

test("과목 API는 학생 시간표 선택을 중복 없이 저장하고 목록·삭제 결과를 카탈로그 레코드로 반환한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  const { DELETE, GET, POST } = createCoursesHandlers(database, { catalog, now: () => now });

  try {
    const initial = await GET(new Request("http://localhost/api/courses", { headers: studentHeaders }));
    assert.deepEqual(await initial.json(), { courses: [] });

    const firstAdd = await POST(new Request("http://localhost/api/courses", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-course" }),
    }));
    assert.equal(firstAdd.status, 200);
    assert.deepEqual(await firstAdd.json(), { courses: [catalog[0]] });

    const duplicateAdd = await POST(new Request("http://localhost/api/courses", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-course" }),
    }));
    assert.equal(duplicateAdd.status, 200);
    assert.deepEqual(await duplicateAdd.json(), { courses: [catalog[0]] });
    assert.deepEqual(database.listUserCourseIds("student-fixture"), ["web-course"]);

    const persisted = await GET(new Request("http://localhost/api/courses", { headers: studentHeaders }));
    assert.deepEqual(await persisted.json(), { courses: [catalog[0]] });

    const removed = await DELETE(new Request("http://localhost/api/courses", {
      method: "DELETE",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-course" }),
    }));
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { courses: [] });

    const removedAgain = await DELETE(new Request("http://localhost/api/courses", {
      method: "DELETE",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "web-course" }),
    }));
    assert.equal(removedAgain.status, 200);
    assert.deepEqual(await removedAgain.json(), { courses: [] });
  } finally {
    database.close();
  }
});

test("과목 API는 카탈로그 밖 ID와 교수 계정을 거부한다", async () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  createCredentialTestUser(database, { id: "professor-fixture", name: "교수", role: "professor" });
  database.createSession({ id: "student-session", userId: "student-fixture", expiresAt: expiry });
  database.createSession({ id: "professor-session", userId: "professor-fixture", expiresAt: expiry });
  const { GET, POST } = createCoursesHandlers(database, { catalog, now: () => now });

  try {
    const invalidCourse = await POST(new Request("http://localhost/api/courses", {
      method: "POST",
      headers: studentHeaders,
      body: JSON.stringify({ courseId: "unknown-course" }),
    }));
    assert.equal(invalidCourse.status, 400);
    assert.deepEqual(database.listUserCourseIds("student-fixture"), []);

    const professor = await GET(new Request("http://localhost/api/courses", {
      headers: { cookie: "curi_session=professor-session" },
    }));
    assert.equal(professor.status, 403);
  } finally {
    database.close();
  }
});
