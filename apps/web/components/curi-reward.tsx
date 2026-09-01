"use client";

import { useEffect, useState } from "react";

import { CuriMascot, rewardPresentation, type RewardStage } from "./curi-mascot";

type RewardState = {
  completedCount: number;
  totalCount: number;
  rewardStage: RewardStage;
};

const INITIAL_STATE: RewardState = { completedCount: 0, totalCount: 3, rewardStage: "start" };
const LABELS: Record<RewardState["rewardStage"], string> = {
  start: "새싹 CURI",
  growing: "성장 중 CURI",
  complete: "준비 완료 CURI",
};

function isRewardState(value: unknown): value is RewardState {
  return typeof value === "object" && value !== null
    && "completedCount" in value && typeof value.completedCount === "number"
    && "totalCount" in value && typeof value.totalCount === "number"
    && "rewardStage" in value
    && (value.rewardStage === "start" || value.rewardStage === "growing" || value.rewardStage === "complete");
}

export function CuriReward({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState(INITIAL_STATE);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/checklist?courseId=web-content-development");
        if (response.status === 401) return;
        const payload: unknown = await response.json();
        if (!cancelled && response.ok && isRewardState(payload)) setState(payload);
      } catch {
        if (!cancelled) setMessage("진행률을 불러오지 못했습니다.");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const percentage = state.totalCount === 0 ? 0 : Math.round((state.completedCount / state.totalCount) * 100);
  const reward = rewardPresentation(state.rewardStage);
  return (
    <aside className={`curi-reward curi-reward--${state.rewardStage} ${compact ? "curi-reward--compact" : ""}`} aria-label={`CURI 성장 진행률 ${percentage}%`}>
      <CuriMascot className="curi-reward-mascot" variant={reward.variant} />
      <div>
        <span className={`reward-badge reward-badge--${state.rewardStage}`}>{LABELS[state.rewardStage]}</span>
        <strong>{percentage}%</strong>
        <div className="reward-progress" aria-hidden="true"><span style={{ width: `${percentage}%` }} /></div>
        <small aria-live="polite">{message || reward.message}</small>
      </div>
    </aside>
  );
}
