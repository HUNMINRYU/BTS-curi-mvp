import assert from "node:assert/strict";
import test from "node:test";

import { answerCourseQuestion } from "../lib/qa";
import { searchCitations } from "../lib/search";
import type { Citation } from "../lib/types";

const citations: Citation[] = [
  {
    id: "actual-week-7",
    documentName: "웹컨텐츠개발.pdf",
    sourceKind: "actual",
    week: 7,
    excerpt: "자바스크립트 실습환경을 구축할 수 있다.",
  },
  {
    id: "demo-vscode",
    documentName: "7주차 실습 준비 안내 (데모)",
    sourceKind: "demo",
    week: 7,
    excerpt: "실습 전에 VS Code를 설치하고 실행 여부를 확인하세요.",
  },
  {
    id: "actual-week-3",
    documentName: "웹컨텐츠개발.pdf",
    sourceKind: "actual",
    week: 3,
    excerpt: "HTML5 입력 양식과 시맨틱 요소를 실습으로 학습한다.",
  },
  {
    id: "actual-week-4",
    documentName: "웹컨텐츠개발.pdf",
    sourceKind: "actual",
    week: 4,
    excerpt: "CSS3 스타일 시트 기초와 선택자를 실습으로 학습한다.",
  },
  {
    id: "actual-week-5",
    documentName: "웹컨텐츠개발.pdf",
    sourceKind: "actual",
    week: 5,
    excerpt: "CSS3 박스 모델을 설명하고 활용한다.",
  },
];

test("질문과 겹치는 단어가 많은 공식 근거를 먼저 반환하고 최대 4개로 제한한다", () => {
  const result = searchCitations("7주차 실습 전에 VS Code 준비", citations, 4);

  assert.deepEqual(result.map(({ id }) => id), ["demo-vscode", "actual-week-7", "actual-week-3", "actual-week-4"]);
  assert.equal(result.length <= 4, true);
});

test("문서명만 일치하는 질문은 근거 없음으로 처리한다", async () => {
  for (const question of [
    "웹컨텐츠개발 교수님 연락처가 궁금해요",
    "pdf 자료는 어디서 받나요",
  ]) {
    const result = await answerCourseQuestion(
      question,
      searchCitations(question, citations),
      async () => "근거 없이 생성된 답변",
    );

    assert.equal(result.status, "not_found");
    assert.deepEqual(result.citations, []);
  }
});

test("실습 전 준비 질문은 본문 근거 네 개를 유지한다", () => {
  assert.deepEqual(
    searchCitations("실습 전에 무엇을 준비해야 하나요?", citations).map(({ id }) => id),
    ["demo-vscode", "actual-week-7", "actual-week-3", "actual-week-4"],
  );
});

test("겹치는 단어가 없는 질문에는 공식 근거를 만들지 않는다", () => {
  assert.deepEqual(searchCitations("장학금 신청 방법", citations), []);
});
