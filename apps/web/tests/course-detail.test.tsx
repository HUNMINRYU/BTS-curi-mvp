import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { CourseDetail } from "../components/course-detail";
import { CourseSyllabusContents } from "../components/course-syllabus-dialog";
import { getCatalogCourse } from "../features/catalog/catalog-data";
import { getCourseData, getCurrentWeek } from "../lib/course-data";
const tipAggregate = {
  count: 12,
  visible: true,
  averages: { prerequisite: 1.8, practice: 2.7, workload: 2.2 },
  tags: [{ tag: "VS Code 설치" as const, count: 8 }],
  includesDemo: true,
};


test("대표 과목 상세는 15주 로드맵과 개인 목표가 반영된 이번 주 안내를 제공한다", () => {
  const course = getCatalogCourse("web-content-development");
  assert.ok(course);

  const markup = renderToStaticMarkup(
    <CourseDetail
      catalogCourse={course}
      course={getCourseData()}
      currentWeek={getCurrentWeek()}
      profileGoal="포트폴리오 완성"
      tipAggregate={tipAggregate}
    />,
  );
  assert.match(markup, /class="checklist-goal"[^>]*>포트폴리오 완성 목표에 맞춘 준비 행동입니다\.<\/p>/);
  assert.match(markup, /aria-label="이전 페이지로 돌아가기"/);
  assert.match(markup, /class="course-detail-back-mobile"/);
  assert.match(markup, /class="course-detail-back" href="\/"/);
  assert.match(markup, /웹컨텐츠개발/);
  assert.match(markup, /개인 목표 · 포트폴리오 완성/);
  assert.equal((markup.match(/class="roadmap-item /g) ?? []).length, 15);
  assert.match(markup, /source-badge--actual">강의계획서</);
  assert.match(markup, /데모 데이터/);
  assert.match(markup, /AI 도우미 열기/);
  assert.match(markup, /aria-controls="course-syllabus-dialog"/);
  assert.match(markup, />강의계획서 보기<\/button>/);
  assert.doesNotMatch(markup, /<dialog/);
  assert.match(markup, /수강생 학습 팁/);
  assert.match(markup, /12건/);
  assert.doesNotMatch(markup, /읽어주기 시작/);
  assert.doesNotMatch(markup, /읽어주기 중지/);
});

test("대표 과목 강의계획서 본문은 평가와 15주 수업 계획을 제공한다", () => {
  const course = getCatalogCourse("web-content-development");
  assert.ok(course);

  const markup = renderToStaticMarkup(
    <CourseSyllabusContents course={course} details={getCourseData()} />,
  );

  assert.match(markup, /평가 방법/);
  assert.match(markup, /주차별 수업 계획/);
  assert.equal((markup.match(/주차<\/span>/g) ?? []).length, 15);
  assert.match(markup, /15주차/);
  assert.match(markup, /기말 프로젝트/);
});

test("일반 과목 상세는 카탈로그의 개요와 선수지식만 제공한다", () => {
  const course = getCatalogCourse("database-practice");
  assert.ok(course);

  const markup = renderToStaticMarkup(
    <CourseDetail catalogCourse={course} profileGoal="취업 역량 강화" />,
  );

  assert.match(markup, /데이터베이스실습/);
  assert.match(markup, /심화/);
  assert.match(markup, /선수지식/);
  assert.match(markup, /<h2 class="catalog-detail-heading">일정<\/h2>/);
  assert.match(markup, /catalog-detail-value">수요일 09:00 · 2시간</);
  assert.equal((markup.match(/class="catalog-detail-heading"/g) ?? []).length, 3);
  assert.match(markup, /aria-controls="course-syllabus-dialog"/);
  assert.match(markup, />강의계획서 보기<\/button>/);
  assert.match(markup, /데이터베이스/);
  assert.doesNotMatch(markup, /COURSE OVERVIEW/);
  assert.doesNotMatch(markup, /한 학기 로드맵/);
  assert.doesNotMatch(markup, /AI 도우미 열기/);
});

test("일반 과목 강의계획서 본문은 공통 정보만 제공한다", () => {
  const course = getCatalogCourse("database-practice");
  assert.ok(course);

  const markup = renderToStaticMarkup(<CourseSyllabusContents course={course} />);

  assert.match(markup, /개설 학과/);
  assert.match(markup, /난이도/);
  assert.match(markup, /수업 시간/);
  assert.match(markup, /선수지식/);
  assert.match(markup, /학습 목표/);
  assert.doesNotMatch(markup, /평가 방법/);
  assert.doesNotMatch(markup, /주차별 수업 계획/);
});
