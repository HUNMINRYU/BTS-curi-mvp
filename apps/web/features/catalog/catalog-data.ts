import catalogJson from "@/data/catalog.json";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"] as const;
const DIFFICULTIES = ["입문", "중급", "심화"] as const;
const SOURCE_KINDS = ["actual", "demo"] as const;
const EXPECTED_DEPARTMENT_COUNTS: Record<string, number> = {
  "컴퓨터공학과": 18,
  "건축학과": 20,
  "회계세무학과": 15,
  "교양": 24,
};
const COURSE_FIELDS: Record<string, true> = {
  id: true,
  name: true,
  department: true,
  summary: true,
  goalKeywords: true,
  difficulty: true,
  prerequisites: true,
  interestTags: true,
  schedule: true,
  sourceKind: true,
};
const SCHEDULE_FIELDS: Record<string, true> = {
  day: true,
  start: true,
  duration: true,
};
const CONTACT_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|(?:0\d{1,2}[- ]?)?\d{3,4}[- ]?\d{4}/i;

export type CatalogCourse = {
  id: string;
  name: string;
  department: string;
  summary: string;
  goalKeywords: string[];
  difficulty: (typeof DIFFICULTIES)[number];
  prerequisites: string[];
  interestTags: string[];
  schedule: {
    day: (typeof DAYS)[number];
    start: number;
    duration: number;
  } | null;
  sourceKind: (typeof SOURCE_KINDS)[number];
};

function fail(message: string): never {
  throw new Error(`catalog.json is invalid: ${message}`);
}


function hasOnlyFields(value: object, fields: Record<string, true>, location: string): void {
  for (const key of Object.keys(value)) {
    if (!fields[key]) {
      fail(`${location} has an unexpected field: ${key}`);
    }
  }

  for (const field of Object.keys(fields)) {
    if (!(field in value)) {
      fail(`${location} is missing ${field}`);
    }
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString);
}

function isOneOf<T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function isCatalogCourse(value: unknown, index: number): value is CatalogCourse {
  const location = `course at index ${index}`;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail(`${location} must be an object`);
  }

  const course = value as Record<string, unknown>;
  hasOnlyFields(course, COURSE_FIELDS, location);

  if (!isNonEmptyString(course.id) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(course.id)) {
    fail(`${location} has an invalid id`);
  }
  if (!isNonEmptyString(course.name)) {
    fail(`${location} has an invalid name`);
  }
  if (!isNonEmptyString(course.department)) {
    fail(`${location} has an invalid department`);
  }
  if (!isNonEmptyString(course.summary)) {
    fail(`${location} has an invalid summary`);
  }
  if (!isStringArray(course.goalKeywords) || course.goalKeywords.length === 0) {
    fail(`${location} has invalid goalKeywords`);
  }
  if (!isOneOf(course.difficulty, DIFFICULTIES)) {
    fail(`${location} has an invalid difficulty`);
  }
  if (!isStringArray(course.prerequisites)) {
    fail(`${location} has invalid prerequisites`);
  }
  if (!isStringArray(course.interestTags) || course.interestTags.length === 0) {
    fail(`${location} has invalid interestTags`);
  }
  if (course.schedule !== null) {
    if (
      typeof course.schedule !== "object" ||
      Array.isArray(course.schedule)
    ) {
      fail(`${location} has an invalid schedule`);
    }

    const schedule = course.schedule as Record<string, unknown>;
    hasOnlyFields(schedule, SCHEDULE_FIELDS, `${location} schedule`);
    if (!isOneOf(schedule.day, DAYS)) {
      fail(`${location} has an invalid schedule day`);
    }
    if (
      typeof schedule.start !== "number" ||
      !Number.isInteger(schedule.start) ||
      schedule.start < 9 ||
      schedule.start > 17
    ) {
      fail(`${location} has an invalid schedule start`);
    }
    if (
      typeof schedule.duration !== "number" ||
      !Number.isInteger(schedule.duration) ||
      schedule.duration < 1 ||
      schedule.duration > 3
    ) {
      fail(`${location} has an invalid schedule duration`);
    }
  }
  if (!isOneOf(course.sourceKind, SOURCE_KINDS) || course.sourceKind !== "actual") {
    fail(`${location} has an invalid sourceKind`);
  }

  return true;
}

function validateCatalog(value: unknown): readonly CatalogCourse[] {
  if (!Array.isArray(value)) {
    fail("root value must be an array");
  }
  if (value.length !== 77) {
    fail(`expected 77 courses, received ${value.length}`);
  }
  if (CONTACT_PATTERN.test(JSON.stringify(value))) {
    fail("personal contact information is not permitted");
  }

  const catalog: CatalogCourse[] = [];
  const ids = new Set<string>();
  const scheduleSlots = new Set<string>();
  const departmentCounts: Record<string, number> = {
    "컴퓨터공학과": 0,
    "건축학과": 0,
    "회계세무학과": 0,
    "교양": 0,
  };

  for (const [index, course] of value.entries()) {
    if (!isCatalogCourse(course, index)) {
      fail(`course at index ${index} failed validation`);
    }
    if (ids.has(course.id)) {
      fail(`duplicate course id: ${course.id}`);
    }
    const currentDepartmentCount = departmentCounts[course.department];
    if (currentDepartmentCount === undefined) {
      fail(`course at index ${index} has an unsupported department`);
    }

    if (course.schedule !== null) {
      const scheduleSlot = `${course.schedule.day}-${course.schedule.start}`;
      if (scheduleSlots.has(scheduleSlot)) {
        fail(`duplicate schedule slot: ${scheduleSlot}`);
      }
      scheduleSlots.add(scheduleSlot);
    }

    ids.add(course.id);
    departmentCounts[course.department] = currentDepartmentCount + 1;
    catalog.push(course);
  }

  for (const [department, expectedCount] of Object.entries(EXPECTED_DEPARTMENT_COUNTS)) {
    const actualCount = departmentCounts[department];
    if (actualCount !== expectedCount) {
      fail(`${department} must contain ${expectedCount} courses`);
    }
  }

  return Object.freeze(catalog);
}

const catalog = validateCatalog(catalogJson);
const catalogById = new Map<string, CatalogCourse>();

for (const course of catalog) {
  catalogById.set(course.id, course);
}

export function getCatalog(): readonly CatalogCourse[] {
  return catalog;
}

export function getCatalogCourse(id: string): CatalogCourse | undefined {
  return catalogById.get(id);
}
