import type { AppDatabase, CredentialUserInput, UserRole } from "@curi/db";

import { hashPassword } from "../../lib/auth";

export const TEST_PASSWORD = "correct-password";

type TestUser = {
  id: string;
  username?: string;
  name: string;
  role: UserRole;
  password?: string;
};

export function createCredentialTestUser(database: AppDatabase, input: TestUser): string {
  const password = input.password ?? TEST_PASSWORD;
  const { passwordHash, passwordSalt } = hashPassword(password);
  const user: CredentialUserInput = {
    id: input.id,
    username: input.username ?? input.id,
    name: input.name,
    role: input.role,
    passwordHash,
    passwordSalt,
  };
  database.createCredentialUser(user);
  return password;
}

export function createTestSession(
  database: AppDatabase,
  input: { id: string; userId: string; expiresAt: string },
): void {
  database.createSession(input);
}
