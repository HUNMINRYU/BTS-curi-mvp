import assert from "node:assert/strict";
import test from "node:test";

import {
  createAppDatabase,
  DuplicateUsernameError,
  type AppDatabase,
  type CredentialUserInput,
} from "@curi/db";

const credential: CredentialUserInput = {
  id: "user-1",
  username: "alice_1",
  name: "Alice",
  role: "student",
  passwordHash: "hash-1",
  passwordSalt: "salt-1",
};

function withDatabase(run: (database: AppDatabase) => void) {
  const database = createAppDatabase(":memory:");
  try {
    run(database);
  } finally {
    database.close();
  }
}

test("credential users can be created and retrieved without exposing plaintext passwords", () => {
  withDatabase((database) => {
    assert.deepEqual(database.createCredentialUser(credential), {
      id: "user-1",
      name: "Alice",
      role: "student",
    });
    assert.deepEqual(database.getCredentialByUsername("alice_1"), {
      user: { id: "user-1", name: "Alice", role: "student" },
      username: "alice_1",
      passwordHash: "hash-1",
      passwordSalt: "salt-1",
    });
  });
});

test("duplicate usernames are rejected", () => {
  withDatabase((database) => {
    database.createCredentialUser(credential);
    assert.throws(
      () => database.createCredentialUser({ ...credential, id: "user-2" }),
      DuplicateUsernameError,
    );
  });
});

test("credential users can be upserted by user id", () => {
  withDatabase((database) => {
    database.createCredentialUser(credential);
    assert.deepEqual(database.upsertCredentialUser({
      ...credential,
      name: "Alice Updated",
      role: "professor",
      passwordHash: "hash-2",
      passwordSalt: "salt-2",
    }), { id: "user-1", name: "Alice Updated", role: "professor" });
    assert.deepEqual(database.getCredentialByUsername("alice_1"), {
      user: { id: "user-1", name: "Alice Updated", role: "professor" },
      username: "alice_1",
      passwordHash: "hash-2",
      passwordSalt: "salt-2",
    });
  });
});

test("bare app databases create no implicit accounts", () => {
  withDatabase((database) => {
    assert.equal(database.getUser("student-fixture"), null);
    assert.equal(database.getUser("professor-fixture"), null);
    assert.equal(database.getCredentialByUsername("student-fixture"), null);
  });
});
