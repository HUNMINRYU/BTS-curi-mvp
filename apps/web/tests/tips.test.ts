import assert from "node:assert/strict";
import test from "node:test";

import {
  ALLOWED_TIP_TAGS,
  TipValidationError,
  aggregateTips,
  validateTipInput,
  type TipRecord,
} from "../lib/tips";

test("학습 팁은 세 척도, 준비 태그, 동의가 모두 있어야 한다", () => {
  assert.throws(
    () => validateTipInput({ prerequisite: 2, practice: 3, workload: 1, tags: ["HTML/CSS 기초"] }),
    TipValidationError,
  );
});

test("허용 목록 밖의 준비 태그를 거부한다", () => {
  assert.throws(
    () => validateTipInput({
      prerequisite: 2,
      practice: 3,
      workload: 1,
      tags: ["교수 평가"],
      consent: true,
    }),
    TipValidationError,
  );
});

test("유효한 입력은 중복 태그를 제거해 반환한다", () => {
  assert.deepEqual(validateTipInput({
    prerequisite: 1,
    practice: 2,
    workload: 3,
    tags: [ALLOWED_TIP_TAGS[0], ALLOWED_TIP_TAGS[0], ALLOWED_TIP_TAGS[3]],
    consent: true,
  }), {
    prerequisite: 1,
    practice: 2,
    workload: 3,
    tags: ["HTML/CSS 기초", "GitHub 계정"],
    consent: true,
  });
});

test("응답이 5건보다 적으면 평균과 태그 빈도를 숨긴다", () => {
  const records: TipRecord[] = [
    { prerequisite: 1, practice: 2, workload: 3, tags: ["HTML/CSS 기초"], isDemo: true },
    { prerequisite: 2, practice: 2, workload: 2, tags: ["VS Code 설치"], isDemo: false },
    { prerequisite: 3, practice: 1, workload: 1, tags: ["Chrome 설치"], isDemo: false },
    { prerequisite: 2, practice: 3, workload: 2, tags: ["GitHub 계정"], isDemo: false },
  ];

  assert.deepEqual(aggregateTips(records), {
    count: 4,
    visible: false,
    averages: null,
    tags: [],
    includesDemo: true,
  });
});

test("5건부터 평균과 태그 빈도를 정확히 공개한다", () => {
  const records: TipRecord[] = [
    { prerequisite: 1, practice: 3, workload: 2, tags: ["HTML/CSS 기초", "VS Code 설치"], isDemo: true },
    { prerequisite: 2, practice: 2, workload: 1, tags: ["HTML/CSS 기초"], isDemo: true },
    { prerequisite: 3, practice: 1, workload: 3, tags: ["GitHub 계정"], isDemo: false },
    { prerequisite: 2, practice: 3, workload: 2, tags: ["VS Code 설치"], isDemo: false },
    { prerequisite: 2, practice: 1, workload: 2, tags: ["HTML/CSS 기초"], isDemo: false },
  ];

  assert.deepEqual(aggregateTips(records), {
    count: 5,
    visible: true,
    averages: { prerequisite: 2, practice: 2, workload: 2 },
    tags: [
      { tag: "HTML/CSS 기초", count: 3 },
      { tag: "VS Code 설치", count: 2 },
      { tag: "GitHub 계정", count: 1 },
    ],
    includesDemo: true,
  });
});
