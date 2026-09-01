import assert from "node:assert/strict";
import test from "node:test";

import { createTipsDatabase, type NewCourseTip } from "@curi/db";

const demoTips: NewCourseTip[] = Array.from({ length: 12 }, (_, index) => ({
  courseId: "web-content-development",
  sessionHash: `demo-session-hash-${String(index + 1).padStart(2, "0")}`,
  prerequisite: (index % 3) + 1,
  practice: ((index + 1) % 3) + 1,
  workload: ((index + 2) % 3) + 1,
  tags: index % 2 === 0 ? ["HTML/CSS 기초", "VS Code 설치"] : ["Chrome 설치"],
  isDemo: true,
}));

test("데모 팁 12건을 반복 시드해도 동일한 12건만 유지한다", () => {
  const database = createTipsDatabase(":memory:");

  try {
    database.seedTips(demoTips);
    database.seedTips(demoTips);

    const stored = database.listTips("web-content-development");
    assert.equal(stored.length, 12);
    assert.equal(stored.every((tip) => tip.isDemo), true);
  } finally {
    database.close();
  }
});
