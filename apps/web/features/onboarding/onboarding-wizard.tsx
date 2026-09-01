"use client";

import Link from "next/link";
import { useState } from "react";

import {
  ONBOARDING_STEPS,
  PROFILE_OPTIONS,
  type ProfileInput,
} from "@/features/onboarding/profile-options";

const emptyProfile: ProfileInput = {
  major: null,
  interest: null,
  goal: null,
  career: null,
  style: null,
  hours: null,
  avoid: null,
};

type OnboardingWizardProps = {
  initialProfile?: ProfileInput;
  mode?: "create" | "edit";
};

type SubmissionError = {
  message: string;
  recovery?: {
    href: "/login";
    label: "로그인하기";
  };
};

type GamificationSummary = {
  totalPoints: number;
  level: 1 | 2 | 3;
  badges: string[];
  newlyEarnedBadges: string[];
};

function isGamificationSummary(value: unknown): value is GamificationSummary {
  return typeof value === "object" && value !== null
    && "totalPoints" in value && typeof value.totalPoints === "number"
    && "level" in value && (value.level === 1 || value.level === 2 || value.level === 3)
    && "badges" in value && Array.isArray(value.badges)
    && value.badges.every((badge) => typeof badge === "string")
    && "newlyEarnedBadges" in value && Array.isArray(value.newlyEarnedBadges)
    && value.newlyEarnedBadges.every((badge) => typeof badge === "string");
}

export async function saveOnboardingProfile(
  profile: ProfileInput,
  request: typeof fetch = fetch,
  publish: (summary: GamificationSummary) => void = (summary) => {
    window.dispatchEvent(new CustomEvent("curi:gamification", { detail: summary }));
  },
  navigate: (href: string) => void = (href) => window.location.assign(href),
  reject: (status?: number) => void = () => undefined,
): Promise<boolean> {
  const response = await request("/api/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(profile),
  });
  if (response.status === 400 || response.status === 401 || response.status === 403) {
    reject(response.status);
    return false;
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || typeof body !== "object" || body === null
    || !("redirectTo" in body) || typeof body.redirectTo !== "string"
    || !("gamification" in body) || !isGamificationSummary(body.gamification)) {
    reject();
    return false;
  }
  publish(body.gamification);
  navigate(body.redirectTo);
  return true;
}

export function onboardingSubmissionError(status?: number): SubmissionError {
  if (status === 400) {
    return { message: "선택하지 않은 항목이 있어요. 모든 항목을 선택한 뒤 다시 시도해 주세요." };
  }
  if (status === 401) {
    return {
      message: "로그인이 필요합니다. 로그인 후 프로필을 완성해 주세요.",
      recovery: { href: "/login", label: "로그인하기" },
    };
  }
  if (status === 403) {
    return {
      message: "학생 계정으로 로그인해야 프로필을 저장할 수 있습니다.",
      recovery: { href: "/login", label: "로그인하기" },
    };
  }
  return { message: "프로필을 저장하지 못했습니다. 다시 시도해 주세요." };
}

export function OnboardingWizard({ initialProfile = emptyProfile, mode = "create" }: OnboardingWizardProps) {
  const [answers, setAnswers] = useState<ProfileInput>(initialProfile);
  const [error, setError] = useState<SubmissionError | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const step = ONBOARDING_STEPS[stepIndex]!;
  const isLastStep = stepIndex === ONBOARDING_STEPS.length - 1;

  async function submitProfile(profile: ProfileInput = answers) {
    setError(null);
    setIsSubmitting(true);

    try {
      await saveOnboardingProfile(
        profile,
        fetch,
        (gamification) => window.dispatchEvent(new CustomEvent("curi:gamification", { detail: gamification })),
        (href) => window.location.assign(href),
        (status) => setError(onboardingSubmissionError(status)),
      );
    } catch {
      setError(onboardingSubmissionError());
    } finally {
      setIsSubmitting(false);
    }
  }

  function continueToNextStep() {
    if (isLastStep) {
      void submitProfile();
      return;
    }
    setStepIndex((current) => current + 1);
  }

  function skipStep() {
    const skippedAnswers: ProfileInput = { ...answers, [step.field]: null };
    setAnswers(skippedAnswers);
    if (isLastStep) {
      void submitProfile(skippedAnswers);
      return;
    }
    setStepIndex((current) => current + 1);
  }

  return (
    <section className="onboarding-card" aria-label={mode === "edit" ? "학생 프로필 수정" : "학생 프로필 온보딩"}>
      <div className="onboarding-progress-copy">
        <p>{mode === "edit" ? "내 수업 취향 수정" : "내 수업 취향 찾기"}</p>
        <span>{stepIndex + 1} / {ONBOARDING_STEPS.length}</span>
      </div>
      <div
        role="progressbar"
        aria-label="온보딩 진행률"
        aria-valuemax={ONBOARDING_STEPS.length}
        aria-valuemin={1}
        aria-valuenow={stepIndex + 1}
        className="onboarding-progress"
      >
        <span style={{ width: `${((stepIndex + 1) / ONBOARDING_STEPS.length) * 100}%` }} />
      </div>
      <ol aria-label="온보딩 진행 단계" className="onboarding-step-list">
        {ONBOARDING_STEPS.map((item, index) => (
          <li aria-current={index === stepIndex ? "step" : undefined} key={item.field}>
            {item.label}
          </li>
        ))}
      </ol>

      <fieldset className="onboarding-question" aria-label={`${step.label} 선택`}>
        <legend>{step.prompt}</legend>
        <div className="choice-chip-list">
          {PROFILE_OPTIONS[step.field].map((option) => (
            <label className="choice-chip" key={option.value}>
              <input
                checked={answers[step.field] === option.value}
                name={step.field}
                onChange={() => setAnswers((current) => ({
                  ...current,
                  [step.field]: option.value,
                }))}
                type="radio"
                value={option.value}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <p aria-live="polite" className="form-status" role="status">
        {error?.message}
        {error?.recovery ? <Link href={error.recovery.href}> {error.recovery.label}</Link> : null}
      </p>
      <div className="wizard-actions">
        <button
          className="text-button"
          disabled={stepIndex === 0 || isSubmitting}
          onClick={() => setStepIndex((current) => current - 1)}
          type="button"
        >
          이전
        </button>
        <button className="text-button" disabled={isSubmitting} onClick={skipStep} type="button">
          건너뛰기
        </button>
        <button className="primary-button" disabled={isSubmitting} onClick={continueToNextStep} type="button">
          {isSubmitting ? "저장 중…" : isLastStep ? mode === "edit" ? "저장하고 추천 보기" : "추천 받기" : "다음"}
        </button>
      </div>
    </section>
  );
}
