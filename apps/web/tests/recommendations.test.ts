import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { RecommendationsPanel } from "../components/recommendations-panel";


import type { UserProfile } from "@curi/db";

import { getCatalog, type CatalogCourse } from "../lib/catalog-data";
import { PROFILE_OPTIONS } from "../lib/profile-options";
import { filterAndRankCourses, recommendCourses } from "../lib/recommendations";


const completedAt = "2026-09-01T00:00:00.000Z";
const realCatalog = getCatalog();


function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    userId: "student-fixture",
    major: null,
    interest: null,
    goal: null,
    career: null,
    style: null,
    hours: null,
    avoid: null,
    completedAt,
    ...overrides,
  };
}

function course({ id, ...overrides }: Partial<CatalogCourse> & Pick<CatalogCourse, "id">): CatalogCourse {
  return {
    id,
    name: id,
    department: "교양",
    summary: "학기 수업 개요",
    goalKeywords: ["기초"],
    difficulty: "입문",
    prerequisites: [],
    interestTags: ["일반"],
    schedule: { day: "월", start: 9, duration: 2 },
    sourceKind: "actual",
    ...overrides,
  };
}
test("실카탈로그의 관심·목표 옵션은 정확한 태그로 과목과 연결된다", () => {
  for (const field of ["interest", "goal"] as const) {
    for (const { value } of PROFILE_OPTIONS[field]) {
      assert.ok(
        realCatalog.some((catalogCourse) => catalogCourse.interestTags.includes(value)
          || catalogCourse.goalKeywords.includes(value)),
        `${field} 옵션 ${value}에 해당하는 과목이 없습니다.`,
      );
    }
  }
});

test("실카탈로그의 전공·진로·학습스타일 옵션은 추천 점수를 높인다", () => {
  for (const { value: major } of PROFILE_OPTIONS.major) {
    assert.ok(
      filterAndRankCourses(profile({ major }), realCatalog, realCatalog.length)
        .some((recommendation) => recommendation.score > 0),
      `전공 옵션 ${major}에 해당하는 과목이 없습니다.`,
    );
  }

  for (const { value: career } of PROFILE_OPTIONS.career) {
    assert.ok(
      filterAndRankCourses(profile({ career }), realCatalog, realCatalog.length)
        .some((recommendation) => recommendation.score > 0),
      `진로 옵션 ${career}에 해당하는 과목이 없습니다.`,
    );
  }

  for (const { value: style } of PROFILE_OPTIONS.style) {
    assert.ok(
      filterAndRankCourses(profile({ style }), realCatalog, realCatalog.length)
        .some((recommendation) => recommendation.score > 0),
      `학습스타일 옵션 ${style}에 해당하는 과목이 없습니다.`,
    );
  }
});

test("실카탈로그의 비선호 옵션은 적어도 한 과목을 추천에서 제외한다", () => {
  for (const { value: avoid } of PROFILE_OPTIONS.avoid) {
    const recommendations = filterAndRankCourses(
      profile({ avoid }),
      realCatalog,
      realCatalog.length,
    );

    assert.ok(
      recommendations.length < realCatalog.length,
      `비선호 옵션 ${avoid}이(가) 제외하는 과목이 없습니다.`,
    );
  }
});

test("실카탈로그의 모든 주간 시간 옵션은 허용 시간의 과목과 연결된다", () => {
  const weeklyTimeLimits = {
    "주 3시간": 1,
    "주 5시간": 2,
    "주 8시간": 3,
    "주 10시간 이상": 3,
  } as const;

  for (const [hours, maximumDuration] of Object.entries(weeklyTimeLimits)) {
    assert.ok(
      realCatalog.some((catalogCourse) => catalogCourse.schedule?.duration !== undefined
        && catalogCourse.schedule.duration <= maximumDuration),
      `${hours} 옵션에 해당하는 과목이 없습니다.`,
    );
  }
});

test("수학 비선호는 회계원리2와 경제학원론을 관련 추천에서 제외한다", () => {
  const recommendationIds = filterAndRankCourses(
    profile({ avoid: "수학" }),
    realCatalog,
    realCatalog.length,
  ).map(({ course: catalogCourse }) => catalogCourse.id);

  assert.equal(recommendationIds.includes("accounting-principles-2"), false);
  assert.equal(recommendationIds.includes("principles-of-economics"), false);
});

test("관심분야만 바꾸면 실카탈로그 상위 다섯 과목 순서가 바뀐다", () => {
  const webTopFive = filterAndRankCourses(profile({ interest: "웹 개발" }), realCatalog, 5)
    .map(({ course: catalogCourse }) => catalogCourse.id);
  const aiTopFive = filterAndRankCourses(profile({ interest: "AI" }), realCatalog, 5)
    .map(({ course: catalogCourse }) => catalogCourse.id);

  assert.equal(webTopFive[0], "web-content-development");
  assert.equal(aiTopFive[0], "artificial-intelligence");
  assert.notDeepEqual(webTopFive, aiTopFive);
});

test("실카탈로그 추천 이유는 선택한 관심분야를 포함한다", async () => {
  const result = await recommendCourses(
    profile({ interest: "AI" }),
    realCatalog,
    async () => { throw new Error("model unavailable"); },
  );
  const aiRecommendation = result.recommendations.find(
    (recommendation) => recommendation.course.id === "artificial-intelligence",
  );

  assert.match(aiRecommendation?.reason ?? "", /AI 관심/);
});

test("선택한 세 학과는 같은 학과 과목을 우선 추천한다", () => {
  const catalog = [
    course({ id: "architecture-course", department: "건축학과" }),
    course({ id: "computer-course", department: "컴퓨터공학과" }),
    course({ id: "accounting-course", department: "회계세무학과" }),
  ];

  for (const [major, expectedCourseId] of [
    ["컴퓨터공학과", "computer-course"],
    ["건축학과", "architecture-course"],
    ["회계세무학과", "accounting-course"],
  ] as const) {
    assert.equal(filterAndRankCourses(profile({ major }), catalog)[0]?.course.id, expectedCourseId);
  }
});

test("비선호 값이 이름·개요·키워드·선수지식·관심 태그에 있으면 과목을 제외한다", () => {
  const catalog = [
    course({ id: "avoid-name", name: "발표 실습" }),
    course({ id: "avoid-summary", summary: "발표 중심 수업" }),
    course({ id: "avoid-goal", goalKeywords: ["발표"] }),
    course({ id: "avoid-prerequisite", prerequisites: ["발표 경험"] }),
    course({ id: "avoid-interest", interestTags: ["발표"] }),
  ];

  assert.deepEqual(filterAndRankCourses(profile({ avoid: "발표" }), catalog), []);
});

test("동점 과목은 카탈로그 입력 순서와 무관하게 ID로 안정 정렬한다", () => {
  const catalog = [course({ id: "z-course" }), course({ id: "a-course" })];

  assert.deepEqual(
    filterAndRankCourses(profile(), catalog).map((item) => item.course.id),
    ["a-course", "z-course"],
  );
});

test("시간 미정 과목도 추천 정렬에서 제외되거나 예외를 내지 않는다", () => {
  const unscheduled = course({ id: "unscheduled-course", schedule: null });

  assert.deepEqual(
    filterAndRankCourses(profile({ hours: "주 5시간" }), [unscheduled]).map((item) => item.course.id),
    ["unscheduled-course"],
  );
});

test("결정론적 추천 이유는 마지막 근거와 앞 근거를 올바른 한국어 조사로 연결한다", async () => {
  const recommendation = course({
    id: "web-course",
    department: "컴퓨터공학과",
    interestTags: ["웹 개발"],
    schedule: { day: "월", start: 9, duration: 2 },
  });

  const result = await recommendCourses(
    profile({ major: "컴퓨터공학과", interest: "웹 개발", hours: "주 10시간 이상" }),
    [recommendation],
    async () => { throw new Error("model unavailable"); },
  );

  assert.equal(
    result.recommendations[0]?.reason,
    "컴퓨터공학과 전공·웹 개발 관심과 주 10시간 이상 계획에 맞는 과목입니다.",
  );
});

test("추천 모델 오류는 폴백을 유지하면서 서버 진단 콜백에 전달한다", async () => {
  const failure = Object.assign(new Error("Bedrock request failed"), { name: "ValidationException", code: "ValidationException" });
  const captured: unknown[] = [];

  const result = await recommendCourses(
    profile(),
    [course({ id: "fallback-course" })],
    async () => { throw failure; },
    (error) => captured.push(error),
  );

  assert.equal(result.reasonStatus, "model_error");
  assert.deepEqual(captured, [failure]);
});

test("추천 패널은 이유·출처·선수지식·일정과 시간표 담기 조작을 접근 가능하게 렌더링한다", () => {
  const recommendation = course({
    id: "web-course",
    name: "웹콘텐츠개발",
    prerequisites: ["컴퓨터 기초"],
    schedule: { day: "월", start: 9, duration: 2 },
  });

  const html = renderToStaticMarkup(createElement(RecommendationsPanel, {
    initialData: {
      recommendations: [{
        course: recommendation,
        score: 100,
        reason: "웹 개발 관심과 포트폴리오 목표에 맞는 수업입니다.",
      }],
      reasonStatus: "ok",
      message: null,
    },
    initialSelectedCourseIds: [],
  }));

  assert.match(html, /aria-labelledby="recommendations-title"/);
  assert.match(html, /웹 개발 관심과 포트폴리오 목표에 맞는 수업입니다/);
  assert.match(html, /실제 강의계획서/);
  assert.match(html, /선수지식/);
  assert.match(html, /월요일 09:00 · 2시간/);
  assert.match(html, /시간표에 담기/);
});

test("추천 패널은 시간 미정 과목의 일정을 안전하게 표시한다", () => {
  const recommendation = course({ id: "unscheduled-course", schedule: null });
  const html = renderToStaticMarkup(createElement(RecommendationsPanel, {
    initialData: {
      recommendations: [{ course: recommendation, score: 100, reason: "관심 분야에 맞습니다." }],
      reasonStatus: "ok",
      message: null,
    },
    initialSelectedCourseIds: [],
  }));

  assert.match(html, /시간 미정/);
});

test("추천 패널은 이미 시간표에 담긴 과목의 중복 추가를 비활성화한다", () => {
  const recommendation = course({ id: "web-course", name: "웹콘텐츠개발" });
  const html = renderToStaticMarkup(createElement(RecommendationsPanel, {
    initialData: {
      recommendations: [{
        course: recommendation,
        score: 100,
        reason: "웹 개발 관심에 맞는 수업입니다.",
      }],
      reasonStatus: "ok",
      message: null,
    },
    initialSelectedCourseIds: ["web-course"],
  }));

  assert.match(html, /disabled=""/);
  assert.match(html, /시간표에 담았습니다/);
  assert.doesNotMatch(html, />시간표에 담기</);
});
