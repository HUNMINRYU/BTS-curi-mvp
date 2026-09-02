import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("닫힌 챗봇 shell은 배경 컨트롤 클릭을 가로채지 않는다", () => {
  assert.match(
    css,
    /\.chatbot-shell\s*\{[\s\S]*?pointer-events:\s*none;/,
  );
  assert.match(
    css,
    /\.chatbot-panel,\s*\.chatbot-launcher\s*\{[\s\S]*?pointer-events:\s*auto;/,
  );
});

test("추천 상세 label과 value는 같은 수직 시작선에 놓인다", () => {
  assert.match(
    css,
    /\.recommendation-details dd\s*\{[^}]*margin-top:\s*0;/,
  );
});

test("1교시 compact 카드는 부가 정보를 숨겨 행 안에 머문다", () => {
  assert.match(
    css,
    /\.timetable-course--compact \.timetable-course-time,\s*\.timetable-course--compact \.timetable-course-badges\s*\{[^}]*display:\s*none;/,
  );
});
