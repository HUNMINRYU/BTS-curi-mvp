import assert from "node:assert/strict";
import test from "node:test";

import { saveChecklistItem } from "../components/weekly-coach";
import type { GamificationSummary } from "../lib/gamification";

const gamification = {
  totalPoints: 10,
  level: 1 as const,
  badges: [],
  newlyEarnedBadges: [],
};

test("checklist caller publishes the successful response gamification event", async () => {
  const requests: Array<{ input: RequestInfo | URL; init: RequestInit | undefined }> = [];
  const published: GamificationSummary[] = [];
  const state = await saveChecklistItem(
    "vscode",
    true,
    async (input, init) => {
      requests.push({ input, init });
      return Response.json({
        completedItemIds: ["vscode"],
        completedCount: 1,
        totalCount: 3,
        rewardStage: "start",
        gamification,
      });
    },
    (summary) => published.push(summary),
  );

  assert.deepEqual(state, {
    completedItemIds: ["vscode"],
    completedCount: 1,
    totalCount: 3,
    rewardStage: "start",
  });
  assert.deepEqual(published, [gamification]);
  assert.deepEqual(requests, [{
    input: "/api/checklist",
    init: {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ courseId: "web-content-development", itemId: "vscode", completed: true }),
    },
  }]);
});

test("checklist caller does not publish an unsuccessful response", async () => {
  let published = false;
  const state = await saveChecklistItem(
    "vscode",
    true,
    async () => Response.json({ error: "invalid" }, { status: 400 }),
    () => { published = true; },
  );

  assert.equal(state, null);
  assert.equal(published, false);
});
