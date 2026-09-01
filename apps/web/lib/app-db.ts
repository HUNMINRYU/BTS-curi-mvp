import { join } from "node:path";

import { createAppDatabase, type AppDatabase, type UserRole } from "@curi/db";

import { hashPassword } from "./auth";

let database: AppDatabase | undefined;

function createConfiguredAppDatabase(): AppDatabase {
  const appDatabase = createAppDatabase(
    process.env.CURI_APP_DB_PATH ?? join(process.cwd(), ".data", "curi-app.sqlite"),
  );
  const configuredAccounts: Array<{
    id: string;
    username: string;
    name: string;
    role: UserRole;
    password: string | undefined;
  }> = [
    {
      id: "student-test",
      username: "student-test",
      name: "테스트 학생",
      role: "student",
      password: process.env.CURI_STUDENT_TEST_PASSWORD,
    },
    {
      id: "professor-test",
      username: "professor-test",
      name: "테스트 교수",
      role: "professor",
      password: process.env.CURI_PROFESSOR_TEST_PASSWORD,
    },
  ];

  for (const account of configuredAccounts) {
    if (!account.password) continue;
    const { passwordHash, passwordSalt } = hashPassword(account.password);
    appDatabase.upsertCredentialUser({ ...account, passwordHash, passwordSalt });
  }
  return appDatabase;
}

export function getAppDatabase(): AppDatabase {
  database ??= createConfiguredAppDatabase();
  return database;
}
