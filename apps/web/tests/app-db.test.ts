import assert from "node:assert/strict";
import test from "node:test";

import { getAppDatabase } from "../lib/app-db";
import { verifyPassword } from "../features/auth/auth";

test("app database seeds configured credential accounts once with hash and salt only", () => {
  const previousPath = process.env.CURI_APP_DB_PATH;
  const previousStudentPassword = process.env.CURI_STUDENT_TEST_PASSWORD;
  const previousProfessorPassword = process.env.CURI_PROFESSOR_TEST_PASSWORD;
  process.env.CURI_APP_DB_PATH = ":memory:";
  process.env.CURI_STUDENT_TEST_PASSWORD = "student-secure-password";
  process.env.CURI_PROFESSOR_TEST_PASSWORD = "professor-secure-password";

  try {
    const database = getAppDatabase();
    const student = database.getCredentialByUsername("student-test");
    const professor = database.getCredentialByUsername("professor-test");
    assert.deepEqual(student?.user, { id: "student-test", name: "테스트 학생", role: "student" });
    assert.deepEqual(professor?.user, { id: "professor-test", name: "테스트 교수", role: "professor" });
    assert.equal(verifyPassword("student-secure-password", student!), true);
    assert.equal(verifyPassword("professor-secure-password", professor!), true);
    assert.equal("password" in (student ?? {}), false);
    assert.equal(getAppDatabase().getCredentialByUsername("student-test")?.passwordHash, student?.passwordHash);
    database.close();
  } finally {
    if (previousPath === undefined) delete process.env.CURI_APP_DB_PATH;
    else process.env.CURI_APP_DB_PATH = previousPath;
    if (previousStudentPassword === undefined) delete process.env.CURI_STUDENT_TEST_PASSWORD;
    else process.env.CURI_STUDENT_TEST_PASSWORD = previousStudentPassword;
    if (previousProfessorPassword === undefined) delete process.env.CURI_PROFESSOR_TEST_PASSWORD;
    else process.env.CURI_PROFESSOR_TEST_PASSWORD = previousProfessorPassword;
  }
});
