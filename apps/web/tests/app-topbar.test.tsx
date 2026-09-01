import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { createAppDatabase } from "@curi/db";

import { getAppTopbarState } from "../components/app-topbar";
import { createCredentialTestUser } from "./helpers/auth";
import { AppTopbarClient, badgeAnnouncement, logoutSession } from "../components/app-topbar-client";

test("public topbar offers signup and login with an accessible mobile menu", () => {
  const markup = renderToStaticMarkup(<AppTopbarClient currentPath="/login" gamification={null} user={null} />);

  assert.match(markup, /class="app-topbar"/);
  assert.match(markup, /aria-label="주요 메뉴 열기"/);
  assert.match(markup, /aria-controls="app-topbar-menu"/);
  assert.match(markup, /aria-expanded="false"/);
  assert.match(markup, /href="\/signup"[^>]*>회원가입<\/a>/);
  assert.match(markup, /<a aria-current="page" href="\/login">로그인<\/a>/);
  assert.doesNotMatch(markup, /로그아웃/);
});

test("student topbar exposes navigation, exact points and level, and logout", () => {
  const markup = renderToStaticMarkup(
    <AppTopbarClient
      currentPath="/recommend"
      gamification={{ totalPoints: 85, level: 2, badges: ["나를 아는 학생"], newlyEarnedBadges: [] }}
      user={{ id: "student-test", name: "테스트 학생", role: "student" }}
    />,
  );

  assert.match(markup, /테스트 학생/);
  assert.match(markup, /85P/);
  assert.match(markup, /Lv\.2/);
  assert.match(markup, /href="\/"[^>]*>내 시간표<\/a>/);
  assert.match(markup, /<a aria-current="page" href="\/recommend">과목 추천<\/a>/);
  assert.match(markup, /href="\/profile"[^>]*>프로필 수정<\/a>/);
  assert.match(markup, /<button[^>]*class="topbar-logout"[^>]*>로그아웃<\/button>/);
  assert.match(markup, /aria-live="polite"[^>]*aria-atomic="true"/);
});

test("professor topbar provides a click-only professor path without student points", () => {
  const markup = renderToStaticMarkup(
    <AppTopbarClient
      currentPath="/professor"
      gamification={null}
      user={{ id: "professor-test", name: "테스트 교수", role: "professor" }}
    />,
  );

  assert.match(markup, /<a aria-current="page" href="\/professor">교수 리포트<\/a>/);
  assert.doesNotMatch(markup, />내 시간표<\/a>|>과목 추천<\/a>|\d+P|Lv\./);
});

test("new badge announcements preserve every exact earned badge name", () => {
  assert.equal(
    badgeAnnouncement(["나를 아는 학생", "호기심 탐험가"]),
    "새 배지를 획득했습니다: 나를 아는 학생, 호기심 탐험가",
  );
  assert.equal(badgeAnnouncement([]), "");
});

test("server topbar loads the authenticated student's gamification summary", () => {
  const database = createAppDatabase(":memory:");
  createCredentialTestUser(database, { id: "student-fixture", name: "학생", role: "student" });
  const now = new Date("2026-09-01T00:00:00.000Z");
  database.createSession({
    id: "student-session",
    userId: "student-fixture",
    expiresAt: new Date(now.getTime() + 86_400_000).toISOString(),
  });
  database.awardOnboarding("student-fixture", now.toISOString());

  try {
    assert.deepEqual(getAppTopbarState(database, "student-session", now), {
      user: { id: "student-fixture", name: "학생", role: "student" },
      gamification: {
        totalPoints: 30,
        level: 1,
        badges: ["나를 아는 학생"],
        newlyEarnedBadges: [],
      },
    });
  } finally {
    database.close();
  }
});

test("logout deletes the session before routing to login", async () => {
  const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  let destination = "";

  const didLogout = await logoutSession(
    async (input, init) => {
      requests.push({ input, init });
      return new Response(null, { status: 204 });
    },
    (href) => {
      destination = href;
    },
  );

  assert.equal(didLogout, true);
  assert.deepEqual(requests, [{ input: "/api/session", init: { method: "DELETE" } }]);
  assert.equal(destination, "/login");
});
