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
