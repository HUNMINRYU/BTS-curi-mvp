"use client";

import { useState, type FormEvent } from "react";

import {
  ALLOWED_TIP_TAGS,
  type TipAggregate,
  type TipScale,
} from "@/features/tips/tips";
import { submitTip } from "@/features/tips/tip-submit";

type TipsPanelProps = {
  courseId: string;
  initialAggregate: TipAggregate;
};

const SCALE_OPTIONS: readonly TipScale[] = [1, 2, 3];

function AggregateView({ aggregate }: { aggregate: TipAggregate }) {
  return (
    <section className="tips-summary" aria-labelledby="tips-summary-title">
      <div className="tips-heading-row">
        <div>
          <p className="eyebrow">STUDENT INSIGHT</p>
          <h2 id="tips-summary-title">수강생 학습 팁</h2>
        </div>
        <span>{aggregate.count}건</span>
      </div>
      <p>수강생 참고 정보{aggregate.includesDemo ? " · 데모 데이터 포함" : ""}</p>
      {aggregate.visible && aggregate.averages ? (
        <>
          <dl className="tip-averages">
            <div><dt>선수지식 필요도</dt><dd>{aggregate.averages.prerequisite}</dd></div>
            <div><dt>실습 비중</dt><dd>{aggregate.averages.practice}</dd></div>
            <div><dt>과제량</dt><dd>{aggregate.averages.workload}</dd></div>
          </dl>
          <ul className="tip-tags">
            {aggregate.tags.map(({ tag, count }) => <li key={tag}>{tag} <span>{count}</span></li>)}
          </ul>
        </>
      ) : (
        <p>응답 5건부터 집계를 공개합니다.</p>
      )}
    </section>
  );
}

function ScaleField({ label, name }: { label: string; name: string }) {
  return (
    <fieldset className="tip-scale-field">
      <legend>{label}</legend>
      <div>
        {SCALE_OPTIONS.map((value) => (
          <label key={value}>
            <input name={name} required type="radio" value={value} />
            <span>{value}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function TipsPanel({ courseId, initialAggregate }: TipsPanelProps) {
  const [aggregate, setAggregate] = useState(initialAggregate);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setStatus("");

    const form = event.currentTarget;
    const result = await submitTip(
      courseId,
      new FormData(form),
      () => form.reset(),
    );
    if (result.aggregate) setAggregate(result.aggregate);
    setStatus(result.status);
    setPending(false);
  }

  return (
    <section className="section-card tips-panel" aria-labelledby="tips-form-title">
      <AggregateView aggregate={aggregate} />
      <form onSubmit={submit}>
        <h2 id="tips-form-title">내 경험 남기기</h2>
        <ScaleField label="선수지식 필요도" name="prerequisite" />
        <ScaleField label="실습 비중" name="practice" />
        <ScaleField label="과제량" name="workload" />
        <fieldset className="tip-tag-field">
          <legend>준비 태그</legend>
          <div>
            {ALLOWED_TIP_TAGS.map((tag) => (
              <label key={tag}>
                <input name="tags" type="checkbox" value={tag} />
                <span>{tag}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="tip-consent">
          <input name="consent" required type="checkbox" />
          <span>구조화된 학습 팁 수집에 동의합니다.</span>
        </label>
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? "저장 중" : "학습 팁 제출"}
        </button>
        <p className="form-status" aria-live="polite">{status}</p>
      </form>
    </section>
  );
}
