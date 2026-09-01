import assert from "node:assert/strict";
import test from "node:test";

import { answerCourseQuestion } from "../features/qa/qa";
import type { Citation } from "../lib/types";

const groundedCitation: Citation = {
  id: "demo-preparation-vscode",
  documentName: "7주차 실습 준비 안내 (데모)",
  sourceKind: "demo",
  week: 7,
  excerpt: "실습 전에 VS Code를 설치하고 실행 여부를 확인하세요.",
};

test("공식 근거가 없으면 생성 모델을 호출하지 않고 not_found를 반환한다", async () => {
  const result = await answerCourseQuestion(
    "장학금 신청 방법은 무엇인가요?",
    [],
    async () => {
      throw new Error("근거 없음 경로에서 생성 모델을 호출하면 안 됩니다.");
    },
  );

  assert.deepEqual(result, {
    status: "not_found",
    answer: "공식 문서에서 근거를 찾지 못했습니다. 담당자에게 확인해 주세요.",
    citations: [],
  });
});

test("공식 근거가 있으면 답변과 동일한 근거를 반환한다", async () => {
  const result = await answerCourseQuestion(
    "실습 전에 무엇을 준비해야 하나요?",
    [groundedCitation],
    async () => "실습 전에 VS Code를 설치하고 실행 여부를 확인하세요.",
  );

  assert.equal(result.status, "answered");
  assert.equal(result.answer, "실습 전에 VS Code를 설치하고 실행 여부를 확인하세요.");
  assert.deepEqual(result.citations, [groundedCitation]);
});

test("생성 모델 호출이 실패해도 공식 근거를 잃지 않는다", async () => {
  const result = await answerCourseQuestion(
    "실습 전에 무엇을 준비해야 하나요?",
    [groundedCitation],
    async () => {
      throw new Error("Bedrock unavailable");
    },
  );

  assert.deepEqual(result, {
    status: "model_error",
    answer: "AI 답변을 생성하지 못했습니다. 아래 공식 근거를 확인해 주세요.",
    citations: [groundedCitation],
  });
});
