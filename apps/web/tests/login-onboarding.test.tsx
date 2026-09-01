import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import LoginPage from "../app/login/page";
import SignupPage from "../app/signup/page";
import {
  OnboardingPageContent,
  getOnboardingRedirect,
} from "../app/onboarding/page";
import Home from "../app/page";
import {
  OnboardingWizard,
  onboardingSubmissionError,
  saveOnboardingProfile,
} from "../features/onboarding/onboarding-wizard";
import { recommendationError } from "../features/recommendations/recommendations-panel";

const savedProfile = {
  major: "컴퓨터공학과",
  interest: "AI",
  goal: "실무 역량",
  career: "백엔드 개발자",
  style: "구조적으로 정리하기",
  hours: "주 8시간",
  avoid: "발표",
} as const;

test("login page exposes only labeled credential fields and a signup path", () => {
  const markup = renderToStaticMarkup(<LoginPage />);

  assert.match(markup, /<main[^>]*aria-labelledby="login-title"/);
  assert.match(markup, /<label[^>]*for="login-username"[^>]*>아이디<\/label>/);
  assert.match(markup, /<input(?=[^>]*id="login-username")(?=[^>]*name="username")(?=[^>]*autoComplete="username")[^>]*>/);
  assert.match(markup, /<label[^>]*for="login-password"[^>]*>비밀번호<\/label>/);
  assert.match(markup, /<input(?=[^>]*id="login-password")(?=[^>]*name="password")(?=[^>]*type="password")(?=[^>]*autoComplete="current-password")[^>]*>/);
  assert.match(markup, /href="\/signup"[^>]*>회원가입<\/a>/);
  assert.doesNotMatch(markup, /데모 계정|학생 데모|교수 데모|userId/);
});

test("signup and main page make account creation the visible starting path", () => {
  const signupMarkup = renderToStaticMarkup(<SignupPage />);
  const homeMarkup = renderToStaticMarkup(<Home />);

  assert.match(signupMarkup, /<main[^>]*aria-labelledby="signup-title"/);
  assert.match(signupMarkup, /<label[^>]*for="signup-username"[^>]*>아이디<\/label>/);
  assert.match(signupMarkup, /<label[^>]*for="signup-name"[^>]*>이름<\/label>/);
  assert.match(signupMarkup, /<label[^>]*for="signup-password"[^>]*>비밀번호<\/label>/);
  assert.match(signupMarkup, /href="\/login"[^>]*>로그인<\/a>/);
  assert.match(homeMarkup, /href="\/signup"[^>]*>회원가입하고 시작하기<\/a>/);
});

test("onboarding page server rendering provides an accessible seven-step sequence", () => {
  const markup = renderToStaticMarkup(<OnboardingPageContent />);

  assert.match(markup, /<main[^>]*aria-labelledby="onboarding-title"/);
  assert.match(markup, /aria-label="온보딩 진행 단계"/);
  assert.match(markup, /role="progressbar"[^>]*aria-valuemax="7"/);
  assert.match(markup, /aria-label="전공 선택"/);
  assert.match(markup, /aria-live="polite"/);

  for (const step of ["전공", "관심분야", "목표", "진로", "학습스타일", "투자 시간", "비선호 분야"]) {
    assert.match(markup, new RegExp(`>${step}<`));
  }

  for (const department of ["컴퓨터공학과", "건축학과", "회계세무학과"]) {
    assert.match(markup, new RegExp(`value="${department}"[^>]*\\/><span>${department}</span>`));
  }
  assert.doesNotMatch(markup, /value="경영학"|value="디자인"|value="자유전공"/);
});

test("onboarding access redirects anonymous, professor, and completed student sessions", () => {
  const studentSession = { user: { id: "student-test", name: "테스트 학생", role: "student" } } as const;
  const professorSession = { user: { id: "professor-test", name: "테스트 교수", role: "professor" } } as const;

  assert.equal(getOnboardingRedirect(null, null), "/login");
  assert.equal(getOnboardingRedirect(professorSession, null), "/professor");
  assert.equal(getOnboardingRedirect(studentSession, { completedAt: "2026-09-01T00:00:00.000Z" }), "/recommend");
  assert.equal(getOnboardingRedirect(studentSession, null), null);
});

test("profile and recommendation errors give each recovery path", () => {
  assert.deepEqual(onboardingSubmissionError(401).recovery, { href: "/login", label: "로그인하기" });
  assert.deepEqual(onboardingSubmissionError(403).recovery, { href: "/login", label: "로그인하기" });
  assert.match(onboardingSubmissionError(400).message, /모든 항목/);

  assert.deepEqual(recommendationError(401).recovery, { href: "/login", label: "로그인하기" });
  assert.deepEqual(recommendationError(403).recovery, { href: "/login", label: "로그인하기" });
  assert.deepEqual(recommendationError(400).recovery, { href: "/onboarding", label: "온보딩 시작하기" });
});

test("successful onboarding publishes gamification before navigating", async () => {
  const events: string[] = [];
  const gamification = {
    totalPoints: 30,
    level: 1 as const,
    badges: ["나를 아는 학생"],
    newlyEarnedBadges: ["나를 아는 학생"],
  };

  const saved = await saveOnboardingProfile(
    savedProfile,
    async () => Response.json({ redirectTo: "/recommend", gamification }),
    (summary) => events.push(`badge:${summary.newlyEarnedBadges.join(",")}`),
    (href) => events.push(`navigate:${href}`),
  );

  assert.equal(saved, true);
  assert.deepEqual(events, ["badge:나를 아는 학생", "navigate:/recommend"]);
});

test("onboarding submission maps 400, 401, and 403 before reading a success body", async () => {
  for (const status of [400, 401, 403]) {
    let rejectedStatus: number | undefined;
    const saved = await saveOnboardingProfile(
      savedProfile,
      async () => new Response(null, { status }),
      () => assert.fail("failed profile save must not publish gamification"),
      () => assert.fail("failed profile save must not navigate"),
      (rejected) => {
        rejectedStatus = rejected;
      },
    );

    assert.equal(saved, false);
    assert.equal(rejectedStatus, status);
  }
});

test("profile editor starts from every saved answer and exposes edit-mode copy", () => {
  const markup = renderToStaticMarkup(
    <OnboardingWizard initialProfile={savedProfile} mode="edit" />,
  );

  assert.match(markup, /내 수업 취향 수정/);
  assert.match(markup, /<input(?=[^>]*value="컴퓨터공학과")(?=[^>]*checked="")[^>]*>/);
  assert.match(markup, /aria-label="학생 프로필 수정"/);
});
