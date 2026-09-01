"use client";
import Link from "next/link";

import { useEffect, useState } from "react";

import { SourceBadge } from "@/components/source-badge";
import { scheduleLabel } from "@/lib/course-schedule";
import type { RecommendationResult } from "@/lib/recommendations";

export type RecommendationsPanelProps = {
  initialData?: RecommendationResult;
  initialSelectedCourseIds?: readonly string[];
};

type RecommendationError = {
  message: string;
  recovery?: {
    href: "/login" | "/onboarding";
    label: "로그인하기" | "온보딩 시작하기";
  };
};

export function recommendationError(
  status?: number,
  fallback = "추천 과목을 불러오지 못했습니다. 다시 시도해 주세요.",
): RecommendationError {
  if (status === 400) {
    return {
      message: "추천을 받으려면 프로필을 먼저 완성해 주세요.",
      recovery: { href: "/onboarding", label: "온보딩 시작하기" },
    };
  }
  if (status === 401) {
    return {
      message: "로그인이 필요합니다. 로그인 후 추천을 확인해 주세요.",
      recovery: { href: "/login", label: "로그인하기" },
    };
  }
  if (status === 403) {
    return {
      message: "학생 계정으로 로그인해야 추천을 확인할 수 있습니다.",
      recovery: { href: "/login", label: "로그인하기" },
    };
  }
  return { message: fallback };
}

function isRecommendationResult(value: unknown): value is RecommendationResult {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("recommendations" in value) || !Array.isArray(value.recommendations)
    || !("reasonStatus" in value) || (value.reasonStatus !== "ok" && value.reasonStatus !== "model_error")) {
    return false;
  }
  return value.recommendations.every((recommendation) => typeof recommendation === "object"
    && recommendation !== null && "course" in recommendation && "reason" in recommendation
    && typeof recommendation.course === "object" && recommendation.course !== null
    && "id" in recommendation.course && "name" in recommendation.course
    && "sourceKind" in recommendation.course
    && typeof recommendation.course.id === "string" && typeof recommendation.course.name === "string"
    && (recommendation.reason === null || typeof recommendation.reason === "string"));
}

function selectedCourseIds(value: unknown): readonly string[] | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)
    || !("courses" in value) || !Array.isArray(value.courses)) {
    return null;
  }
  const ids = value.courses.map((course) => (
    typeof course === "object" && course !== null && "id" in course && typeof course.id === "string"
      ? course.id
      : null
  ));
  return ids.every((id): id is string => id !== null) ? ids : null;
}

export function RecommendationsPanel({ initialData, initialSelectedCourseIds }: RecommendationsPanelProps) {
  const [data, setData] = useState<RecommendationResult | null>(initialData ?? null);
  const [error, setError] = useState<RecommendationError | null>(null);
  const [addedCourseIds, setAddedCourseIds] = useState<readonly string[] | null>(initialSelectedCourseIds ?? null);
  const [addingCourseId, setAddingCourseId] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/recommend");
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          if (!cancelled) setError(recommendationError(response.status));
          return;
        }
        const body: unknown = await response.json();
        if (!response.ok || !isRecommendationResult(body)) {
          if (!cancelled) setError(recommendationError());
          return;
        }
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError(recommendationError());
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialData]);

  useEffect(() => {
    if (initialSelectedCourseIds) return;
    let cancelled = false;

    void (async () => {
      try {
        const response = await fetch("/api/courses");
        if (response.status === 400 || response.status === 401 || response.status === 403) {
          if (!cancelled) setError(recommendationError(response.status, "시간표를 확인하지 못했습니다. 다시 시도해 주세요."));
          return;
        }
        const ids = selectedCourseIds(await response.json());
        if (!response.ok || ids === null) {
          if (!cancelled) setError(recommendationError(undefined, "시간표를 확인하지 못했습니다. 다시 시도해 주세요."));
          return;
        }
        if (!cancelled) setAddedCourseIds(ids);
      } catch {
        if (!cancelled) setError(recommendationError(undefined, "시간표를 확인하지 못했습니다. 다시 시도해 주세요."));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [initialSelectedCourseIds]);

  async function addCourse(courseId: string) {
    setAddingCourseId(courseId);
    setError(null);
    try {
      const response = await fetch("/api/courses", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ courseId }),
      });
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        setError(recommendationError(response.status, "시간표에 과목을 담지 못했습니다. 다시 시도해 주세요."));
        return;
      }
      const ids = selectedCourseIds(await response.json());
      if (!response.ok || ids === null) {
        setError(recommendationError(undefined, "시간표에 과목을 담지 못했습니다. 다시 시도해 주세요."));
        return;
      }
      setAddedCourseIds(ids);
    } catch {
      setError(recommendationError(undefined, "시간표에 과목을 담지 못했습니다. 다시 시도해 주세요."));
    } finally {
      setAddingCourseId(null);
    }
  }

  return (
    <section className="recommendations-panel" aria-labelledby="recommendations-title">
      <div className="section-heading recommendation-heading">
        <div>
          <p className="eyebrow">PERSONAL COURSE MATCH</p>
          <h2 id="recommendations-title">나에게 맞는 과목 추천</h2>
        </div>
        <Link className="text-link" href="/">내 시간표 보기</Link>
      </div>
      <p className="section-intro">저장한 프로필을 바탕으로 다음 수업을 골랐습니다.</p>
      <p aria-live="polite" className="form-status" role="status">
        {error?.message}
        {error?.recovery ? <Link href={error.recovery.href}> {error.recovery.label}</Link> : null}
      </p>

      {!data && !error ? (
        <div className="recommendation-loading" role="status" aria-live="polite">
          <img
            alt="추천 과목을 고민하는 CURI"
            className="recommendation-loading-mascot"
            height="210"
            src="/characters/curi-thinking.png"
            width="195"
          />
          <div>
            <strong>나에게 맞는 수업을 찾고 있어요</strong>
            <span aria-hidden="true" className="recommendation-loading-dots"><i /><i /><i /></span>
            <p>전공, 관심분야, 목표와 학습 방식을 함께 살펴보고 있습니다.</p>
          </div>
        </div>
      ) : null}
      {data?.reasonStatus === "model_error" && data.message ? (
        <p className="recommendation-fallback" role="status">{data.message}</p>
      ) : null}
      {data ? (
        <ol className="recommendation-list">
          {data.recommendations.map((recommendation) => {
            const isAdded = addedCourseIds?.includes(recommendation.course.id) ?? false;
            const titleId = `recommendation-${recommendation.course.id}`;
            return (
              <li key={recommendation.course.id}>
                <article className="recommendation-card" aria-labelledby={titleId}>
                  <div className="recommendation-card-header">
                    <div>
                      <p className="course-department">{recommendation.course.department}</p>
                      <h3 id={titleId}>
                        <Link href={`/courses/${recommendation.course.id}`}>{recommendation.course.name}</Link>
                      </h3>
                    </div>
                    <SourceBadge sourceKind={recommendation.course.sourceKind} />
                  </div>
                  <p className="recommendation-summary">{recommendation.course.summary}</p>
                  <p className="recommendation-reason">
                    {recommendation.reason ?? "결정론적 추천 결과입니다. 추천 이유를 준비하지 못했습니다."}
                  </p>
                  <dl className="recommendation-details">
                    <div>
                      <dt>선수지식</dt>
                      <dd>{recommendation.course.prerequisites.length > 0
                        ? recommendation.course.prerequisites.join(", ")
                        : "별도 선수지식 없음"}</dd>
                    </div>
                    <div>
                      <dt>일정</dt>
                      <dd>{scheduleLabel(recommendation.course)}</dd>
                    </div>
                  </dl>
                  <button
                    className="primary-button"
                    disabled={addedCourseIds === null || isAdded || addingCourseId === recommendation.course.id}
                    onClick={() => void addCourse(recommendation.course.id)}
                    type="button"
                  >
                    {addedCourseIds === null ? "시간표 확인 중…" : isAdded ? "시간표에 담았습니다" : addingCourseId === recommendation.course.id ? "담는 중…" : "시간표에 담기"}
                  </button>
                </article>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}
