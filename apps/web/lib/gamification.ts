import type { GamificationSummary } from "@curi/db";

export type { GamificationSummary } from "@curi/db";

export function isGamificationSummary(value: unknown): value is GamificationSummary {
  return typeof value === "object"
    && value !== null
    && "totalPoints" in value
    && typeof value.totalPoints === "number"
    && "level" in value
    && (value.level === 1 || value.level === 2 || value.level === 3)
    && "badges" in value
    && Array.isArray(value.badges)
    && value.badges.every((badge) => typeof badge === "string")
    && "newlyEarnedBadges" in value
    && Array.isArray(value.newlyEarnedBadges)
    && value.newlyEarnedBadges.every((badge) => typeof badge === "string");
}

export function publishGamification(summary: GamificationSummary): void {
  window.dispatchEvent(new CustomEvent("curi:gamification", { detail: summary }));
}
