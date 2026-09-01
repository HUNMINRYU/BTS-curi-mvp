import assert from "node:assert/strict";
import test from "node:test";

import { submitTip } from "../lib/tip-submit";
import type { GamificationSummary } from "../lib/gamification";

const aggregate = {
  count: 13,
  visible: true,
  averages: { prerequisite: 1.8, practice: 2.5, workload: 2.2 },
  tags: [{ tag: "HTML/CSS 기초" as const, count: 6 }],
  includesDemo: true,
};

const gamification = {
  totalPoints: 20,
  level: 1 as const,
  badges: ["길잡이"],
  newlyEarnedBadges: ["길잡이"],
};

test("팁 제출은 지연된 성공 응답 뒤에도 폼을 초기화하고 성공 상태를 반환한다", async () => {
  const formData = new FormData();
  formData.set("prerequisite", "2");
  formData.set("practice", "2");
  formData.set("workload", "2");
  formData.append("tags", "HTML/CSS 기초");
  formData.set("consent", "on");
  let resetCount = 0;
  const published: GamificationSummary[] = [];

  const result = await submitTip(
    "web-content-development",
    formData,
    () => { resetCount += 1; },
    async () => {
      await Promise.resolve();
      return Response.json({ ...aggregate, gamification }, { status: 201 });
    },
    (summary) => published.push(summary),
  );

  assert.equal(resetCount, 1);
  assert.deepEqual(result, {
    aggregate,
    status: "학습 팁을 반영했습니다.",
  });
  assert.deepEqual(published, [gamification]);
});
