import type { TipAggregate } from "@/lib/tips";

import {
  isGamificationSummary,
  publishGamification,
  type GamificationSummary,
} from "./gamification";

export type TipSubmitResult = {
  aggregate: TipAggregate | null;
  status: string;
};

export async function submitTip(
  courseId: string,
  data: FormData,
  reset: () => void,
  request: typeof fetch = fetch,
  publish: (summary: GamificationSummary) => void = publishGamification,
): Promise<TipSubmitResult> {
  const payload = {
    courseId,
    prerequisite: Number(data.get("prerequisite")),
    practice: Number(data.get("practice")),
    workload: Number(data.get("workload")),
    tags: data.getAll("tags"),
    consent: data.get("consent") === "on",
  };

  try {
    const response = await request("/api/tips", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result: unknown = await response.json();
    if (!response.ok) {
      const message = typeof result === "object" && result !== null && "error" in result
        ? String(result.error)
        : "학습 팁을 저장하지 못했습니다.";
      return { aggregate: null, status: message };
    }

    if (typeof result !== "object" || result === null || Array.isArray(result)) {
      return { aggregate: null, status: "학습 팁을 저장하지 못했습니다." };
    }
    const { gamification, ...aggregate } = result as TipAggregate & { gamification?: unknown };
    if (isGamificationSummary(gamification)) publish(gamification);
    reset();
    return { aggregate, status: "학습 팁을 반영했습니다." };
  } catch {
    return { aggregate: null, status: "서버에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요." };
  }
}
