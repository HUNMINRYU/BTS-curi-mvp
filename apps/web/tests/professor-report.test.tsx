import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProfessorReport } from "../components/professor-report";
import type { TipAggregate } from "../lib/tips";

const aggregate: TipAggregate = {
  count: 12,
  visible: true,
  averages: { prerequisite: 1.8, practice: 2.7, workload: 2.2 },
  tags: [{ tag: "VS Code 설치", count: 8 }],
  includesDemo: true,
};

test("교수 리포트는 익명 근거 없음 질문과 구조화 팁 집계만 표시한다", () => {
  const html = renderToStaticMarkup(
    <ProfessorReport
      qaLogs={[{
        courseId: "web-content-development",
        courseName: "웹컨텐츠개발",
        question: "장학금 신청은 어떻게 하나요?",
        count: 3,
        lastOccurredAt: "2026-09-01T10:00:00.000Z",
      }]}
      tipAggregate={aggregate}
    />,
  );

  assert.match(html, /교수 리포트/);
  assert.match(html, /src="\/characters\/curi-heart\.png"/);
  assert.match(html, /웹컨텐츠개발/);
  assert.match(html, /장학금 신청은 어떻게 하나요/);
  assert.match(html, /3회/);
  assert.match(html, /응답 12건/);
  assert.match(html, /공지 한 번으로 반복 질문을 줄여 보세요/);
  assert.doesNotMatch(html, /테스트 학생|테스트 교수|userId/);
  assert.doesNotMatch(html, /업로드|답글|공지 작성/);
});

test("교수 리포트는 근거 없음 질문이 없을 때 명확한 빈 상태를 표시한다", () => {
  const html = renderToStaticMarkup(<ProfessorReport qaLogs={[]} tipAggregate={aggregate} />);
  assert.match(html, /아직 기록된 근거 없음 질문이 없습니다/);
});
