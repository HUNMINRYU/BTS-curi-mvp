import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ProfessorReport } from "../components/professor-report";
import type { TipAggregate } from "../features/tips/tips";

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

test("교수 리포트는 익명 학급 현황과 5명 이상 TMI 집계를 표시한다", () => {
  const html = renderToStaticMarkup(
    <ProfessorReport
      qaLogs={[]}
      tipAggregate={aggregate}
      classInsights={{
        status: {
          studentCount: 6,
          onboardingCount: 5,
          totalPoints: 150,
          averagePoints: 25,
          badgeCount: 5,
          checklistCompletionCount: 4,
        },
        tmi: {
          profileCount: 5,
          visible: true,
          topValues: [
            { field: "interest", label: "관심분야", value: "웹 개발", count: 3 },
            { field: "goal", label: "학습 목표", value: "포트폴리오", count: 3 },
            { field: "style", label: "학습 스타일", value: "직접 해보기", count: 4 },
            { field: "hours", label: "주간 학습 시간", value: "주 3시간", count: 3 },
          ],
        },
      }}
    />,
  );

  assert.match(html, /익명 학급 현황/);
  assert.match(html, /학생 6명/);
  assert.match(html, /<dt>온보딩<\/dt><dd>5명<\/dd>/);
  assert.match(html, /평균 25P/);
  assert.match(html, /우리 학급 TMI/);
  assert.match(html, /웹 개발/);
  assert.match(html, /3명/);
  assert.doesNotMatch(html, /테스트 학생|student-/);
});

test("교수 TMI는 프로필 응답 5명 미만이면 분포를 숨긴다", () => {
  const html = renderToStaticMarkup(
    <ProfessorReport
      qaLogs={[]}
      tipAggregate={aggregate}
      classInsights={{
        status: {
          studentCount: 2,
          onboardingCount: 2,
          totalPoints: 60,
          averagePoints: 30,
          badgeCount: 2,
          checklistCompletionCount: 0,
        },
        tmi: { profileCount: 2, visible: false, topValues: [] },
      }}
    />,
  );
  assert.match(html, /프로필 응답 5명부터 공개합니다/);
});
