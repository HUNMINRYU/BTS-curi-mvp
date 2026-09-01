import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { periodLabel, periodTime, Timetable } from "../components/timetable";
import type { CatalogCourse } from "../lib/catalog-data";

const webCourse: CatalogCourse = {
  id: "web-course",
  name: "웹콘텐츠개발",
  department: "컴퓨터공학과",
  summary: "웹 개발 수업",
  goalKeywords: ["HTML5"],
  difficulty: "입문",
  prerequisites: ["컴퓨터 기초"],
  interestTags: ["웹 개발"],
  schedule: { day: "월", start: 9, duration: 2 },
  sourceKind: "actual",
};

const practicalCourse: CatalogCourse = {
  ...webCourse,
  id: "studio-course",
  name: "건축설계실기",
  schedule: { day: "목", start: 21, duration: 2 },
};

const unscheduledCourse: CatalogCourse = {
  ...webCourse,
  id: "unscheduled-course",
  name: "시간 미정 과목",
  schedule: null,
};

test("교시는 09:00부터 50분 수업과 10분 휴식 주기로 매핑된다", () => {
  assert.deepEqual(periodTime(1), { startsAt: "09:00", endsAt: "09:50" });
  assert.deepEqual(periodTime(2), { startsAt: "10:00", endsAt: "10:50" });
  assert.equal(periodLabel(13), "13교시 · 21:00–21:50 · 전공 실기");
  assert.equal(periodLabel(15), "15교시 · 23:00–23:50 · 전공 실기");
});

test("시간표는 15교시 그리드의 점유 과목을 키보드 링크와 제거 조작으로 렌더링한다", () => {
  const html = renderToStaticMarkup(<Timetable initialCourses={[webCourse, practicalCourse]} />);

  assert.match(html, /role="grid"/);
  assert.match(html, /aria-label="주간 시간표"/);
  assert.equal((html.match(/role="row"/g) ?? []).length, 16);
  assert.match(html, /role="row"[^>]*><span aria-hidden="true" class="timetable-corner"><\/span>/);
  assert.match(html, /role="row"[^>]*><span class="timetable-hour" role="rowheader"/);
  assert.match(html, /grid-column:2;grid-row:2 \/ span 2/);
  assert.match(html, /grid-column:5;grid-row:14 \/ span 2/);
  assert.match(html, /1교시 · 09:00–09:50/);
  assert.match(html, /15교시 · 23:00–23:50 · 전공 실기/);
  assert.match(html, /href="\/courses\/web-course"/);
  assert.match(html, /웹콘텐츠개발/);
  assert.match(html, /aria-label="웹콘텐츠개발 시간표에서 빼기"/);
  for (const day of ["월", "화", "수", "목", "금", "토", "일"]) {
    assert.match(html, new RegExp(`<span class="timetable-day" role="columnheader">${day}</span>`));
  }
  assert.match(html, /class="timetable-recommendation-cta"/);
  assert.match(html, /src="\/characters\/curi-calendar\.png"/);
  assert.match(html, /개인 맞춤 과목 추천/);
  assert.match(html, /전공·관심·목표에 맞는 수업 찾기/);
  assert.match(html, /href="\/recommend"/);
});

test("모바일 시간표는 첫 실제 수업 요일을 선택하고 전체 탭을 제공한다", () => {
  const html = renderToStaticMarkup(
    <Timetable initialCourses={[webCourse, practicalCourse, unscheduledCourse]} />,
  );

  assert.match(html, /class="timetable-mobile-list"/);
  assert.match(html, /aria-label="모바일 시간표 요일 선택"/);
  assert.match(html, /role="tablist"/);
  assert.match(html, /class="timetable-mobile-tab timetable-mobile-tab--selected"[^>]*>월</);
  assert.match(html, /class="timetable-mobile-tab"[^>]*>전체</);
  assert.match(html, /<h3>월요일<\/h3>/);
  assert.match(html, /09:00–10:50 · 2교시/);
  assert.match(html, /href="\/courses\/web-course"/);
});

test("시간표는 비어 있을 때 추천 화면으로 가는 명확한 다음 행동을 제공한다", () => {
  const html = renderToStaticMarkup(<Timetable initialCourses={[]} />);

  assert.match(html, /시간표가 비어 있습니다/);
  assert.match(html, /src="\/characters\/curi-sleeping\.png"/);
  assert.match(html, /href="\/recommend"/);
});

test("시간이 미정인 과목은 임의의 교시 없이 목록에 표시된다", () => {
  const html = renderToStaticMarkup(<Timetable initialCourses={[unscheduledCourse]} />);

  assert.match(html, /시간 미정/);
  assert.doesNotMatch(html, /class="timetable-course"/);
});
