export const PROFILE_FIELDS = [
  "major",
  "interest",
  "goal",
  "career",
  "style",
  "hours",
  "avoid",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type ProfileInput = Record<ProfileField, string | null>;

type ProfileOption = {
  label: string;
  value: string;
};

export const PROFILE_OPTIONS: Record<ProfileField, readonly ProfileOption[]> = {
  major: [
    { value: "컴퓨터공학과", label: "컴퓨터공학과" },
    { value: "건축학과", label: "건축학과" },
    { value: "회계세무학과", label: "회계세무학과" },
  ],
  interest: [
    { value: "웹 개발", label: "웹 개발" },
    { value: "AI", label: "AI" },
    { value: "데이터 분석", label: "데이터 분석" },
    { value: "디지털 콘텐츠", label: "디지털 콘텐츠" },
  ],
  goal: [
    { value: "기초 다지기", label: "기초 다지기" },
    { value: "포트폴리오", label: "포트폴리오" },
    { value: "실무 역량", label: "실무 역량" },
    { value: "진로 탐색", label: "진로 탐색" },
  ],
  career: [
    { value: "프론트엔드 개발자", label: "프론트엔드 개발자" },
    { value: "백엔드 개발자", label: "백엔드 개발자" },
    { value: "데이터 분석가", label: "데이터 분석가" },
    { value: "기획자", label: "기획자" },
  ],
  style: [
    { value: "직접 해보기", label: "직접 해보기" },
    { value: "함께 토론하기", label: "함께 토론하기" },
    { value: "구조적으로 정리하기", label: "구조적으로 정리하기" },
    { value: "짧게 반복하기", label: "짧게 반복하기" },
  ],
  hours: [
    { value: "주 3시간", label: "주 3시간" },
    { value: "주 5시간", label: "주 5시간" },
    { value: "주 8시간", label: "주 8시간" },
    { value: "주 10시간 이상", label: "주 10시간 이상" },
  ],
  avoid: [
    { value: "디자인", label: "디자인" },
    { value: "수학", label: "수학" },
    { value: "발표", label: "발표" },
    { value: "팀 프로젝트", label: "팀 프로젝트" },
  ],
};

export const ONBOARDING_STEPS: readonly {
  field: ProfileField;
  label: string;
  prompt: string;
}[] = [
  { field: "major", label: "전공", prompt: "현재 전공을 골라 주세요." },
  { field: "interest", label: "관심분야", prompt: "요즘 가장 관심 있는 분야는 무엇인가요?" },
  { field: "goal", label: "목표", prompt: "이번 학기에 이루고 싶은 목표를 골라 주세요." },
  { field: "career", label: "진로", prompt: "어떤 진로를 생각하고 있나요?" },
  { field: "style", label: "학습스타일", prompt: "가장 편한 학습 방식을 골라 주세요." },
  { field: "hours", label: "투자 시간", prompt: "일주일에 투자할 수 있는 시간을 골라 주세요." },
  { field: "avoid", label: "비선호 분야", prompt: "가능하면 피하고 싶은 분야를 골라 주세요." },
];

export function validateProfileInput(value: unknown): ProfileInput | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const input = value as Record<string, unknown>;
  const keys = Object.keys(input);
  if (keys.length !== PROFILE_FIELDS.length || !PROFILE_FIELDS.every((field) => field in input)) {
    return null;
  }

  const profile = {} as ProfileInput;
  for (const field of PROFILE_FIELDS) {
    const selected = input[field];
    if (selected !== null && (typeof selected !== "string"
      || !PROFILE_OPTIONS[field].some((option) => option.value === selected))) {
      return null;
    }
    profile[field] = selected;
  }
  return profile;
}
