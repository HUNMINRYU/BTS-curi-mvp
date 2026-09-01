import type { UserProfile } from "@curi/db";

import type { CatalogCourse } from "./catalog-data";

export type RankedCourse = {
  course: CatalogCourse;
  score: number;
};

export type RecommendationProfile = Pick<
  UserProfile,
  "major" | "interest" | "goal" | "career" | "style" | "hours" | "avoid"
>;

export type RecommendationCandidate = Pick<
  CatalogCourse,
  "id" | "name" | "department" | "goalKeywords" | "interestTags" | "prerequisites" | "schedule"
>;

export type RecommendationReasonGenerator = (
  profile: RecommendationProfile,
  candidates: readonly RecommendationCandidate[],
) => Promise<unknown>;

export type Recommendation = RankedCourse & {
  reason: string | null;
};

export type RecommendationResult = {
  recommendations: Recommendation[];
  reasonStatus: "ok" | "model_error";
  message: string | null;
};


const PROFILE_KEYWORDS: Readonly<Record<"goal" | "career" | "style", Readonly<Record<string, readonly string[]>>>> = {
  goal: {
    "기초 다지기": ["기초", "입문"],
    "포트폴리오": ["포트폴리오", "제작", "개발"],
    "실무 역량": ["실무", "운영", "프로젝트"],
    "진로 탐색": ["진로", "탐색", "전공"],
  },
  career: {
    "프론트엔드 개발자": ["프론트엔드", "웹", "사용자 인터페이스"],
    "백엔드 개발자": ["백엔드", "데이터베이스", "SQL"],
    "데이터 분석가": ["데이터", "분석", "통계"],
    "기획자": ["기획", "시장", "의사결정"],
  },
  style: {
    "직접 해보기": ["실습", "제작", "프로그래밍"],
    "함께 토론하기": ["토론", "소통", "협업"],
    "구조적으로 정리하기": ["분석", "구조", "이론"],
    "짧게 반복하기": ["반복", "기초", "연습"],
  },
};

const HOUR_DURATION_LIMITS: Readonly<Record<string, number>> = {
  "주 3시간": 1,
  "주 5시간": 2,
  "주 8시간": 3,
  "주 10시간 이상": 3,
};

function normalize(value: string): string {
  return value.normalize("NFKC").replace(/\s+/g, "").toLowerCase();
}

function includesAvoidValue(course: CatalogCourse, avoid: string): boolean {
  const normalizedAvoid = normalize(avoid);
  return [course.name, course.summary, ...course.goalKeywords, ...course.prerequisites, ...course.interestTags]
    .some((value) => normalize(value).includes(normalizedAvoid));
}

function hasExactNormalizedMatch(value: string | null, values: readonly string[]): boolean {
  if (!value) return false;
  const normalizedValue = normalize(value);
  return values.some((candidate) => normalize(candidate) === normalizedValue);
}

function matchesProfileKeywords(
  value: string | null,
  field: "goal" | "career" | "style",
  course: CatalogCourse,
): boolean {
  if (!value) return false;
  const keywordValues = PROFILE_KEYWORDS[field][value] ?? [];
  return hasExactNormalizedMatch(value, [...course.goalKeywords, ...course.interestTags])
    || keywordValues.some((keyword) => hasExactNormalizedMatch(keyword, [...course.goalKeywords, ...course.interestTags]));
}

function scoreCourse(profile: UserProfile, course: CatalogCourse): number {
  let score = 0;
  if (profile.major === course.department) score += 100;
  if (hasExactNormalizedMatch(profile.interest, course.interestTags)) score += 40;
  if (matchesProfileKeywords(profile.goal, "goal", course)) score += 24;
  if (matchesProfileKeywords(profile.career, "career", course)) score += 16;
  if (matchesProfileKeywords(profile.style, "style", course)) score += 12;
  const durationLimit = profile.hours ? HOUR_DURATION_LIMITS[profile.hours] : undefined;
  if (durationLimit !== undefined && course.schedule && course.schedule.duration <= durationLimit) score += 8;
  return score;
}

export function filterAndRankCourses(
  profile: UserProfile,
  catalog: readonly CatalogCourse[],
  limit = 15,
): RankedCourse[] {
  const maximum = Math.max(0, Math.floor(limit));
  return catalog
    .filter((course) => !profile.avoid || !includesAvoidValue(course, profile.avoid))
    .map((course) => ({ course, score: scoreCourse(profile, course) }))
    .sort((left, right) => right.score - left.score || (left.course.id < right.course.id ? -1 : left.course.id > right.course.id ? 1 : 0))
    .slice(0, maximum);
}

function validateModelReasons(
  modelOutput: unknown,
  candidates: readonly RankedCourse[],
): ReadonlyArray<readonly [string, string]> {
  if (typeof modelOutput !== "object" || modelOutput === null || Array.isArray(modelOutput)
    || !("recommendations" in modelOutput) || !Array.isArray(modelOutput.recommendations)) {
    throw new Error("Recommendation model response must include recommendations.");
  }

  const candidateIds = new Set(candidates.map((candidate) => candidate.course.id));
  const seenCourseIds = new Set<string>();
  const entries: Array<readonly [string, string]> = [];
  for (const recommendation of modelOutput.recommendations) {
    if (typeof recommendation !== "object" || recommendation === null || Array.isArray(recommendation)
      || !("courseId" in recommendation) || !("reason" in recommendation)
      || typeof recommendation.courseId !== "string" || !candidateIds.has(recommendation.courseId)
      || seenCourseIds.has(recommendation.courseId)
      || typeof recommendation.reason !== "string" || recommendation.reason.trim().length === 0) {
      throw new Error("Recommendation reasons are invalid.");
    }
    seenCourseIds.add(recommendation.courseId);
    entries.push([recommendation.courseId, recommendation.reason.trim()]);
  }
  if (entries.length < 3 || entries.length > 5) {
    throw new Error("Recommendation reasons are invalid.");
  }
  return entries;
}

function hasFinalConsonant(value: string): boolean {
  const codePoint = value.trim().codePointAt(value.trim().length - 1);
  return codePoint !== undefined && codePoint >= 0xac00 && codePoint <= 0xd7a3
    && (codePoint - 0xac00) % 28 !== 0;
}
function deterministicReason(profile: UserProfile, course: CatalogCourse): string {
  const evidence: string[] = [];
  if (profile.major === course.department) {
    evidence.push(`${profile.major} 전공`);
  }
  if (profile.interest && hasExactNormalizedMatch(profile.interest, course.interestTags)) {
    evidence.push(`${profile.interest} 관심`);
  }
  if (profile.goal && matchesProfileKeywords(profile.goal, "goal", course)) {
    evidence.push(`${profile.goal} 목표`);
  }
  const durationLimit = profile.hours ? HOUR_DURATION_LIMITS[profile.hours] : undefined;
  if (profile.hours && durationLimit !== undefined && course.schedule && course.schedule.duration <= durationLimit) {
    evidence.push(`${profile.hours} 계획`);
  }
  if (evidence.length === 0) {
    return "비선호 분야를 제외한 과목 중 결정론적 상위 과목입니다.";
  }
  if (evidence.length === 1) {
    return `${evidence[0]}에 맞는 과목입니다.`;
  }
  const leadingEvidence = evidence.slice(0, -1).join("·");
  return `${leadingEvidence}${hasFinalConsonant(leadingEvidence) ? "과" : "와"} ${evidence.at(-1)}에 맞는 과목입니다.`;
}


export async function recommendCourses(
  profile: UserProfile,
  catalog: readonly CatalogCourse[],
  generateReasons: RecommendationReasonGenerator,
  onModelError?: (error: unknown) => void,
): Promise<RecommendationResult> {
  const candidates = filterAndRankCourses(profile, catalog);
  const fallbackRecommendations = candidates.slice(0, 5).map((candidate) => ({
    ...candidate,
    reason: deterministicReason(profile, candidate.course),
  }));
  const recommendationProfile: RecommendationProfile = {
    major: profile.major,
    interest: profile.interest,
    goal: profile.goal,
    career: profile.career,
    style: profile.style,
    hours: profile.hours,
    avoid: profile.avoid,
  };

  try {
    const reasonEntries = validateModelReasons(
      await generateReasons(recommendationProfile, candidates.map(({ course }) => course)),
      candidates,
    );
    const candidateById = new Map(candidates.map((candidate) => [candidate.course.id, candidate]));
    return {
      recommendations: reasonEntries.map(([courseId, reason]) => ({
        ...candidateById.get(courseId)!,
        reason,
      })),
      reasonStatus: "ok",
      message: null,
    };
  } catch (error) {
    onModelError?.(error);
    return {
      recommendations: fallbackRecommendations,
      reasonStatus: "model_error",
      message: "AI 추천 이유 대신 저장된 프로필 기준을 표시합니다.",
    };
  }
}
