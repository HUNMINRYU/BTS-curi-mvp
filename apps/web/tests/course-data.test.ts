import assert from "node:assert/strict";
import test from "node:test";

import { getCourseData, getCurrentWeek } from "../lib/course-data";

test("로드맵은 실제 강의계획서의 15주 순서와 데모 기준 현재 주차를 보존한다", () => {
  const course = getCourseData();

  assert.equal(course.id, "web-content-development");
  assert.equal(course.name, "웹컨텐츠개발");
  assert.equal(course.currentWeek, 7);
  assert.deepEqual(
    course.weeks.map(({ week }) => week),
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  );
  assert.equal(course.weeks[7]?.topic, "중간고사");
  assert.equal(course.weeks[14]?.topic, "기말 프로젝트");
  assert.equal(course.weeks.every(({ source }) => source.sourceKind === "actual"), true);
});

test("현재 주차 코치는 실제 목표와 표시된 데모 준비 항목을 분리한다", () => {
  const currentWeek = getCurrentWeek();

  assert.equal(currentWeek.week, 7);
  assert.equal(currentWeek.topic, "자바스크립트 기초");
  assert.deepEqual(currentWeek.objectives, [
    "자바스크립트로 무엇을 할 수 있는지 설명할 수 있다.",
    "자바스크립트 실습환경을 구축할 수 있다.",
  ]);
  assert.equal(currentWeek.assignment, "기말 프로젝트 제안서 제출");
  assert.equal(currentWeek.source.sourceKind, "actual");
  assert.deepEqual(
    currentWeek.preparations.map(({ label, source }) => [label, source.sourceKind]),
    [
      ["VS Code 설치", "demo"],
      ["Chrome 개발자도구 확인", "demo"],
      ["JavaScript 실행 환경 확인", "demo"],
    ],
  );
});
