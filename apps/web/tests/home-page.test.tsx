import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { HomeContent } from "../app/page";

test("홈은 모바일에서 단어 단위 제목과 간결한 진행 상태를 제공한다", () => {
  const html = renderToStaticMarkup(<HomeContent authenticated={false} />);

  assert.match(
    html,
    /<h1>이번 학기,<br\/><span class="student-title-nowrap"><em>내 시간표<\/em>에서<\/span> <span class="student-title-nowrap">시작해요\.<\/span><\/h1>/,
  );
  assert.match(html, /학생의 전공·관심·목표를 이해해 맞춤 과목을 추천하고, 수업 준비부터 실행까지 안내하는 AI 학습 내비게이터/);
  assert.match(html, /class="curi-reward curi-reward--start curi-reward--compact"/);
});
