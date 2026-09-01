import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { StudentRankingPanel } from "../features/profile/student-ranking";

test("준비왕 패널은 익명 상위권과 내 순위를 구분해 표시한다", () => {
  const html = renderToStaticMarkup(
    <StudentRankingPanel ranking={{
      leaders: [
        { rank: 1, displayName: "가**", totalPoints: 80, isMe: false },
        { rank: 2, displayName: "나**", totalPoints: 60, isMe: true },
      ],
      me: { rank: 2, displayName: "나**", totalPoints: 60, isMe: true },
    }} />,
  );

  assert.match(html, /이번 주 준비왕/);
  assert.match(html, /가\*\*/);
  assert.match(html, /80P/);
  assert.match(html, /내 순위/);
  assert.match(html, /2위/);
  assert.doesNotMatch(html, /가학생|나학생/);
});
