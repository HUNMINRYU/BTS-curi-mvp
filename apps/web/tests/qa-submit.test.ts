import assert from "node:assert/strict";
import test from "node:test";

import { askCourseQuestion } from "../features/qa/qa-panel";
import type { GamificationSummary } from "../lib/gamification";

const gamification = {
  totalPoints: 5,
  level: 1 as const,
  badges: ["호기심 탐험가"],
  newlyEarnedBadges: ["호기심 탐험가"],
};

test("Q and A caller publishes gamification only for a valid successful answer", async () => {
  const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  const published: GamificationSummary[] = [];
  const result = await askCourseQuestion(
    "web-content-development",
    "실습 준비물은 무엇인가요?",
    async (input, init) => {
      requests.push({ input, init });
      return Response.json({
        status: "answered",
        answer: "공식 수업 자료를 준비하세요.",
        citations: [],
        gamification,
      });
    },
    (summary) => published.push(summary),
  );

  assert.deepEqual(result, {
    result: {
      status: "answered",
      answer: "공식 수업 자료를 준비하세요.",
      citations: [],
    },
    error: null,
  });
  assert.deepEqual(published, [gamification]);
  assert.deepEqual(requests, [{
    input: "/api/qa",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: "web-content-development", question: "실습 준비물은 무엇인가요?" }),
    },
  }]);
});

test("Q and A caller keeps API failures out of gamification events", async () => {
  let published = false;
  const result = await askCourseQuestion(
    "web-content-development",
    "질문",
    async () => Response.json({ error: "invalid" }, { status: 400 }),
    () => { published = true; },
  );

  assert.deepEqual(result, { result: null, error: "invalid" });
  assert.equal(published, false);
});
