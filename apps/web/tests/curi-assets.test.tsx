import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";

import { AppTopbarClient } from "../components/app-topbar-client";
import { CuriMascot, rewardPresentation } from "../components/curi-mascot";
import { CuriReward } from "../components/curi-reward";
import { CourseDetail } from "../components/course-detail";
import { RecommendationsPanel } from "../features/recommendations/recommendations-panel";
import { QaPanel } from "../components/qa-panel";
import { getCatalogCourse } from "../features/catalog/catalog-data";
import { getCourseData, getCurrentWeek } from "../lib/course-data";
import { appMetadata } from "../lib/app-metadata";

test("11개 신규 CURI 자산은 가이드 파일명과 대체 텍스트로 매핑된다", () => {
  const expected = [
    ["reading", "책을 읽는 CURI"],
    ["writing", "메모하는 CURI"],
    ["checklist", "체크리스트를 든 CURI"],
    ["calendar", "달력을 든 CURI"],
    ["chat", "말을 거는 CURI"],
    ["search", "과목을 찾는 CURI"],
    ["star", "별을 안은 CURI"],
    ["heart", "하트를 안은 CURI"],
    ["question", "궁금해하는 CURI"],
    ["running", "달리는 CURI"],
    ["sleeping", "잠든 CURI"],
  ] as const;

  for (const [variant, alt] of expected) {
    const markup = renderToStaticMarkup(<CuriMascot variant={variant} />);
    assert.match(markup, new RegExp(`src="/characters/curi-${variant}\\.png"`));
    assert.match(markup, new RegExp(`alt="${alt}"`));
    assert.ok(existsSync(fileURLToPath(new URL(`../public/characters/curi-${variant}.png`, import.meta.url))));
  }
});

test("화면은 신규 CURI 포즈를 역할에 맞게 표시한다", () => {
  const course = getCatalogCourse("web-content-development");
  assert.ok(course);
  const topbar = renderToStaticMarkup(<AppTopbarClient currentPath="/" user={null} />);
  const reward = renderToStaticMarkup(<CuriReward compact />);
  const detail = renderToStaticMarkup(
    <CourseDetail
      catalogCourse={course}
      course={getCourseData()}
      currentWeek={getCurrentWeek()}
      profileGoal="포트폴리오"
    />,
  );
  const chatbot = renderToStaticMarkup(<QaPanel courseId="web-content-development" />);

  assert.match(topbar, /src="\/characters\/curi-brand\.png"/);
  assert.match(reward, /src="\/characters\/curi-sleeping\.png"/);
  assert.match(reward, /쿠리가 자고 있어요…/);
  assert.match(detail, /src="\/characters\/curi-sleeping\.png"/);
  assert.match(detail, /src="\/characters\/curi-reading\.png"/);
  assert.match(chatbot, /src="\/characters\/curi-chat\.png"/);
});

test("체크리스트 보상 단계가 바뀌면 포즈와 aria-live 문구가 함께 바뀐다", () => {
  assert.deepEqual(rewardPresentation("start"), {
    message: "쿠리가 자고 있어요…",
    variant: "sleeping",
  });
  assert.deepEqual(rewardPresentation("growing"), {
    message: "쿠리가 달리는 중!",
    variant: "running",
  });
  assert.deepEqual(rewardPresentation("complete"), {
    message: "쿠리가 별을 안았어요! 이번 주 완주!",
    variant: "star",
  });
});

test("추천을 계산하는 동안 생각 중인 CURI와 명확한 상태를 표시한다", () => {
  const markup = renderToStaticMarkup(<RecommendationsPanel initialSelectedCourseIds={[]} />);

  assert.match(markup, /class="recommendation-loading"/);
  assert.match(markup, /src="\/characters\/curi-thinking\.png"/);
  assert.match(markup, /alt="추천 과목을 고민하는 CURI"/);
  assert.match(markup, /role="status"/);
  assert.match(markup, /나에게 맞는 수업을 찾고 있어요/);
});

test("브라우저 메타는 제공된 CURI 로고 파생 아이콘을 사용한다", () => {
  assert.deepEqual(appMetadata.icons, {
    icon: "/icon-192x192.png",
    apple: "/apple-icon-180x180.png",
  });
  assert.equal(appMetadata.manifest, "/manifest.webmanifest");
});
