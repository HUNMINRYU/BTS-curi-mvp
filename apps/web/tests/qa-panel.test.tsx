import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { QaPanel } from "../features/qa/qa-panel";

test("챗봇은 초기 화면에서 플로팅 실행 버튼만 표시하고 대화 패널은 닫아 둔다", () => {
  const html = renderToStaticMarkup(<QaPanel courseId="web-content-development" />);

  assert.match(html, /AI 도우미 열기/);
  assert.doesNotMatch(html, /aria-controls="curi-chatbot-panel"/);
  assert.match(html, /src="\/characters\/curi-chat\.png"/);
  assert.doesNotMatch(html, /role="dialog"/);
  assert.doesNotMatch(html, /공식 문서에 질문하기/);
});
