export const ALLOWED_TIP_TAGS = [
  "HTML/CSS 기초",
  "VS Code 설치",
  "Chrome 설치",
  "GitHub 계정",
  "JavaScript 기초",
] as const;

export type TipScale = 1 | 2 | 3;
export type TipTag = (typeof ALLOWED_TIP_TAGS)[number];

export type TipInput = {
  prerequisite: TipScale;
  practice: TipScale;
  workload: TipScale;
  tags: TipTag[];
  consent: true;
};

export type TipRecord = Omit<TipInput, "consent"> & {
  isDemo: boolean;
};

export type TipAggregate = {
  count: number;
  visible: boolean;
  averages: null | {
    prerequisite: number;
    practice: number;
    workload: number;
  };
  tags: Array<{ tag: TipTag; count: number }>;
  includesDemo: boolean;
};

export class TipValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TipValidationError";
  }
}

function isScale(value: unknown): value is TipScale {
  return value === 1 || value === 2 || value === 3;
}

function isAllowedTag(value: unknown): value is TipTag {
  return typeof value === "string" && (ALLOWED_TIP_TAGS as readonly string[]).includes(value);
}

export function validateTipInput(value: unknown): TipInput {
  if (typeof value !== "object" || value === null) {
    throw new TipValidationError("학습 팁 입력을 확인해 주세요.");
  }

  const input = value as Record<string, unknown>;
  if (!isScale(input.prerequisite) || !isScale(input.practice) || !isScale(input.workload)) {
    throw new TipValidationError("세 항목을 모두 선택해 주세요.");
  }
  if (!Array.isArray(input.tags) || input.tags.length === 0 || !input.tags.every(isAllowedTag)) {
    throw new TipValidationError("준비 태그를 하나 이상 선택해 주세요.");
  }
  if (input.consent !== true) {
    throw new TipValidationError("수집 동의가 필요합니다.");
  }

  return {
    prerequisite: input.prerequisite,
    practice: input.practice,
    workload: input.workload,
    tags: [...new Set(input.tags)],
    consent: true,
  };
}

function average(records: TipRecord[], field: "prerequisite" | "practice" | "workload") {
  const value = records.reduce((total, record) => total + record[field], 0) / records.length;
  return Number(value.toFixed(1));
}

export function aggregateTips(records: TipRecord[]): TipAggregate {
  const count = records.length;
  const includesDemo = records.some((record) => record.isDemo);
  if (count < 5) {
    return { count, visible: false, averages: null, tags: [], includesDemo };
  }

  const tagCounts = new Map<TipTag, number>();
  for (const record of records) {
    for (const tag of new Set(record.tags)) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const tags = ALLOWED_TIP_TAGS
    .map((tag) => ({ tag, count: tagCounts.get(tag) ?? 0 }))
    .filter(({ count: tagCount }) => tagCount > 0)
    .sort((left, right) => right.count - left.count);

  return {
    count,
    visible: true,
    averages: {
      prerequisite: average(records, "prerequisite"),
      practice: average(records, "practice"),
      workload: average(records, "workload"),
    },
    tags,
    includesDemo,
  };
}
