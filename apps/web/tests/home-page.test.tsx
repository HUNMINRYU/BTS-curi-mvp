import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import Home from "../app/page";

test("홈은 모바일에서 단어 단위 제목과 간결한 진행 상태를 제공한다", () => {
  const html = renderToStaticMarkup(<Home />);

  assert.match(
    html,
    /<h1>이번 학기,<br\/><span class="student-title-nowrap"><em>내 시간표<\/em>에서<\/span> <span class="student-title-nowrap">시작해요\.<\/span><\/h1>/,
  );
  assert.match(html, /강의계획서와 시간표를 한곳에서 확인하고, 나에게 맞는 다음 수업을 찾아보세요\./);
  assert.match(html, /class="curi-reward curi-reward--start curi-reward--compact"/);
});
