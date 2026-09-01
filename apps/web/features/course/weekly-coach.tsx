"use client";

import { useEffect, useState } from "react";

import { CuriMascot, rewardPresentation, type RewardStage } from "@/components/curi-mascot";
import { SourceBadge } from "@/components/source-badge";
import type { WeekPlan } from "@/lib/types";
import {
  isGamificationSummary,
  publishGamification,
  type GamificationSummary,
} from "@/lib/gamification";


export type ChecklistState = {
  completedItemIds: string[];
  completedCount: number;
  totalCount: number;
  rewardStage: RewardStage;
};

const EMPTY_STATE: ChecklistState = {
  completedItemIds: [],
  completedCount: 0,
  totalCount: 0,
  rewardStage: "start",
};

const REWARD_LABELS: Record<RewardStage, string> = {
  start: "새싹 CURI",
  growing: "성장 중 CURI",
  complete: "준비 완료 CURI",
};

function isChecklistState(value: unknown): value is ChecklistState {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    && "completedItemIds" in value && Array.isArray(value.completedItemIds)
    && value.completedItemIds.every((item) => typeof item === "string")
    && "completedCount" in value && typeof value.completedCount === "number"
    && "totalCount" in value && typeof value.totalCount === "number"
    && "rewardStage" in value
    && (value.rewardStage === "start" || value.rewardStage === "growing" || value.rewardStage === "complete");
}

export async function saveChecklistItem(
  itemId: string,
  completed: boolean,
  request: typeof fetch = fetch,
  publish: (summary: GamificationSummary) => void = publishGamification,
): Promise<ChecklistState | null> {
  const response = await request("/api/checklist", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ courseId: "web-content-development", itemId, completed }),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok || !isChecklistState(payload)
    || !(typeof payload === "object" && payload !== null && "gamification" in payload)
    || !isGamificationSummary(payload.gamification)) {
    return null;
  }

  publish(payload.gamification);
  return {
    completedItemIds: payload.completedItemIds,
    completedCount: payload.completedCount,
    totalCount: payload.totalCount,
    rewardStage: payload.rewardStage,
  };
}

export function WeeklyCoach({ week, profileGoal }: { week: WeekPlan; profileGoal?: string | null }) {
  const [checklist, setChecklist] = useState<ChecklistState>({ ...EMPTY_STATE, totalCount: week.preparations.length });
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/checklist?courseId=web-content-development");
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        const payload: unknown = await response.json();
        if (!cancelled && response.ok && isChecklistState(payload)) setChecklist(payload);
        if (!cancelled && (!response.ok || !isChecklistState(payload))) setError("준비 상태를 불러오지 못했습니다.");
      } catch {
        if (!cancelled) setError("준비 상태를 불러오지 못했습니다.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function toggle(itemId: string) {
    const completed = !checklist.completedItemIds.includes(itemId);
    setPendingItemId(itemId);
    setError("");
    try {
      const nextChecklist = await saveChecklistItem(itemId, completed);
      if (nextChecklist) setChecklist(nextChecklist);
      else setError("준비 상태를 저장하지 못했습니다.");
    } catch {
      setError("준비 상태를 저장하지 못했습니다.");
    } finally {
      setPendingItemId(null);
    }
  }

  const percentage = checklist.totalCount === 0
    ? 0
    : Math.round((checklist.completedCount / checklist.totalCount) * 100);
  const circumference = 2 * Math.PI * 24;
  const dashOffset = circumference * (1 - percentage / 100);
  const reward = rewardPresentation(checklist.rewardStage);

  return (
    <section className="section-card weekly-coach" aria-labelledby="coach-title">
      <div className="section-heading">
        <div className="section-title-group">
          <CuriMascot className="section-mascot reward-mascot" variant={reward.variant} />
          <div>
            <p className="eyebrow">THIS WEEK</p>
            <h2 id="coach-title">이번 주 학습 코치</h2>
          </div>
        </div>
        <span className="week-pill">{week.week}주차</span>
      </div>

      <div className="reward-status" aria-label={`준비 진행률 ${percentage}%`}>
        <svg className="reward-ring" viewBox="0 0 56 56" aria-hidden="true">
          <circle className="reward-ring-track" cx="28" cy="28" r="24" />
          <circle
            className="reward-ring-value"
            cx="28"
            cy="28"
            r="24"
            strokeDasharray={circumference}
            strokeDashoffset={dashOffset}
          />
        </svg>
        <div><strong>{percentage}%</strong><span className={`reward-badge reward-badge--${checklist.rewardStage}`}>{REWARD_LABELS[checklist.rewardStage]}</span></div>
      </div>

      <div className="coach-topic">
        <SourceBadge sourceKind={week.source.sourceKind} />
        <h3>{week.topic}</h3>
        <ul>{week.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
        {week.assignment && <p className="deadline"><strong>이번 과제</strong>{week.assignment}</p>}
      </div>

      <div className="checklist-block">
        <div><p className="eyebrow">PREP CHECK</p><h3>수업 전 준비</h3></div>
        {profileGoal && <p className="checklist-goal">{profileGoal} 목표에 맞춘 준비 행동입니다.</p>}
        <ul className="checklist" aria-label={`${week.week}주차 수업 전 준비 체크리스트`}>
          {week.preparations.map((preparation) => {
            const checked = checklist.completedItemIds.includes(preparation.id);
            return (
              <li key={preparation.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={pendingItemId === preparation.id}
                    onChange={() => void toggle(preparation.id)}
                  />
                  <span>{preparation.label}</span>
                  <SourceBadge sourceKind={preparation.source.sourceKind} />
                </label>
              </li>
            );
          })}
        </ul>
        <p className="progress-note" aria-live="polite">
          {error || reward.message}
        </p>
      </div>
    </section>
  );
}
