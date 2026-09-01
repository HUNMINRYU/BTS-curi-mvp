import assert from "node:assert/strict";
import test from "node:test";

import { redactPersonalContactInfo } from "../lib/redact";

test("강의계획서 chunk의 이메일 주소를 마스킹한다", () => {
  assert.equal(
    redactPersonalContactInfo("담당 교수 이메일은 professor.name@gwangju.ac.kr입니다."),
    "담당 교수 이메일은 [이메일 비공개]입니다.",
  );
});

test("하이픈 유무와 국제 표기를 포함한 전화번호를 마스킹한다", () => {
  assert.equal(
    redactPersonalContactInfo("연락처: 010-1234-5678 / 01012345678 / +82 10-1234-5678"),
    "연락처: [전화번호 비공개] / [전화번호 비공개] / [전화번호 비공개]",
  );
});

test("일반 한국어 강의 내용은 변경하지 않는다", () => {
  const courseText = "웹컨텐츠개발 7주차에는 HTML과 CSS를 활용한 반응형 페이지를 실습합니다.";

  assert.equal(redactPersonalContactInfo(courseText), courseText);
});
