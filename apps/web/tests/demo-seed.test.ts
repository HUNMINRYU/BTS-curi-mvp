import assert from "node:assert/strict";
import test from "node:test";

import { createAppDatabase } from "@curi/db";

import { seedDemoState } from "../lib/demo-seed";

const COURSE_ID = "web-content-development";
const now = () => new Date("2026-09-01T00:00:00.000Z");

test("데모 시드는 팁 집계 공개 기준과 교수 리포트 질문을 채운다", () => {
  const database = createAppDatabase(":memory:");
  try {
    const first = seedDemoState(database, now);
    assert.ok(first.tips >= 5, `공개 임계치를 채우지 못했다: tips=${first.tips}`);
    assert.ok(first.qaLogs >= 3, `근거 없음 질문이 부족하다: qaLogs=${first.qaLogs}`);
    assert.equal(database.listCourseTips(COURSE_ID).length, first.tips);
    assert.equal(database.listQaLogSummary().length, first.qaLogs);
  } finally {
    database.close();
  }
});

test("데모 시드를 반복 실행해도 집계가 늘지 않는다", () => {
  const database = createAppDatabase(":memory:");
  try {
    seedDemoState(database, now);
    const tipsAfterFirst = database.listCourseTips(COURSE_ID).length;
    const logsAfterFirst = database.listQaLogSummary();

    assert.deepEqual(seedDemoState(database, now), { tips: 0, qaLogs: 0 });
    assert.equal(database.listCourseTips(COURSE_ID).length, tipsAfterFirst);
    assert.deepEqual(
      database.listQaLogSummary().map((log) => [log.courseId, log.question, log.count]),
      logsAfterFirst.map((log) => [log.courseId, log.question, log.count]),
    );
    for (const log of database.listQaLogSummary()) {
      assert.equal(log.count, 1, `중복 삽입된 질문: ${log.question}`);
    }
  } finally {
    database.close();
  }
});
