"use client";

import { useMemo, useSyncExternalStore } from "react";
import type { WeekPlan } from "@/lib/types";
import { SourceBadge } from "./source-badge";

const STORAGE_KEY = "curi:week-7-checklist";

const EMPTY_CHECKLIST = "[]";

function subscribeToChecklist(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener("curi-checklist-change", onStoreChange);
  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener("curi-checklist-change", onStoreChange);
  };
}

function getChecklistSnapshot() {
  return window.localStorage.getItem(STORAGE_KEY) ?? EMPTY_CHECKLIST;
}

function parseChecklist(snapshot: string) {
  try {
    const value: unknown = JSON.parse(snapshot);
    return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
  } catch {
    return [];
  }
}

export function WeeklyCoach({ week }: { week: WeekPlan }) {
  const snapshot = useSyncExternalStore(subscribeToChecklist, getChecklistSnapshot, () => EMPTY_CHECKLIST);
  const completed = useMemo(() => parseChecklist(snapshot), [snapshot]);

  function toggle(id: string) {
    const next = completed.includes(id) ? completed.filter((item) => item !== id) : [...completed, id];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("curi-checklist-change"));
  }

  return (
    <section className="section-card weekly-coach" aria-labelledby="coach-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">THIS WEEK</p>
          <h2 id="coach-title">이번 주 학습 코치</h2>
        </div>
        <span className="week-pill">{week.week}주차</span>
      </div>

      <div className="coach-topic">
        <SourceBadge sourceKind={week.source.sourceKind} />
        <h3>{week.topic}</h3>
        <ul>
          {week.objectives.map((objective) => <li key={objective}>{objective}</li>)}
        </ul>
        {week.assignment && <p className="deadline"><strong>이번 과제</strong>{week.assignment}</p>}
      </div>

      <div className="checklist-block">
        <div>
          <p className="eyebrow">PREP CHECK</p>
          <h3>수업 전 준비</h3>
        </div>
        <ul className="checklist" aria-label="7주차 수업 전 준비 체크리스트">
          {week.preparations.map((preparation) => {
            const checked = completed.includes(preparation.id);
            return (
              <li key={preparation.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(preparation.id)}
                  />
                  <span>{preparation.label}</span>
                  <SourceBadge sourceKind={preparation.source.sourceKind} />
                </label>
              </li>
            );
          })}
        </ul>
        <p className="progress-note" aria-live="polite">{completed.length}/{week.preparations.length} 준비 완료</p>
      </div>
    </section>
  );
}
