import assert from "node:assert/strict";
import test from "node:test";

import catalogJson from "../data/catalog.json";
import demoTipsJson from "../data/demo-tips.json";
import { getCatalog, getCatalogCourse } from "../features/catalog/catalog-data";
import { ALLOWED_TIP_TAGS } from "../lib/tips";

test("카탈로그는 77개 실제 강의정보를 학과별 전체 강의계획서 목록에 맞게 제공한다", () => {
  const catalog = getCatalog();
  const departmentCounts = new Map<string, number>();
  const ids = catalog.map(({ id }) => id);
  const preservedIds = [
    "3d-modeling",
    "accounting-principles-2",
    "ai-erp-production-practice",
    "architectural-design-theory",
    "architectural-environment",
    "architectural-space-planning",
    "architectural-structure",
    "artificial-intelligence",
    "computer-programming-1",
    "corporate-tax-law",
    "database",
    "database-practice",
    "financial-management",
    "government-accounting",
    "java-programming-2",
    "k-culture-and-global-sensitivity",
    "learning-skills-in-digital-society",
    "management-accounting",
    "marriage-and-family",
    "mobile-app-development",
    "principles-of-economics",
    "software-engineering",
    "spatial-form-expression",
    "understanding-contemporary-architecture",
    "understanding-gwangju",
    "value-added-tax-law",
    "web-content-development",
    "western-architecture-history",
  ];

  assert.equal(catalog.length, 77);
  assert.equal(new Set(ids).size, 77);
  for (const id of preservedIds) {
    assert.equal(ids.includes(id), true, `${id} must remain in the catalog`);
  }

  for (const { department } of catalog) {
    departmentCounts.set(department, (departmentCounts.get(department) ?? 0) + 1);
  }

  assert.deepEqual(Object.fromEntries(departmentCounts), {
    "컴퓨터공학과": 18,
    "건축학과": 20,
    "회계세무학과": 15,
    "교양": 24,
  });
  assert.equal(getCatalogCourse("web-content-development")?.name, "웹컨텐츠개발");
  assert.equal(getCatalogCourse("not-a-course"), undefined);
});

test("카탈로그의 모든 공개 필드는 유효 범위이며 연락처 정보를 포함하지 않는다", () => {
  const catalog = getCatalog();
  const validDays: Record<string, true> = { 월: true, 화: true, 수: true, 목: true, 금: true, 토: true, 일: true };
  const validDifficulties: Record<string, true> = { 입문: true, 중급: true, 심화: true };
  const schedules = new Set<string>();

  for (const course of catalog) {
    assert.match(course.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.equal(typeof course.name, "string");
    assert.equal(course.name.length > 0, true);
    assert.equal(typeof course.department, "string");
    assert.equal(course.department.length > 0, true);
    assert.equal(typeof course.summary, "string");
    assert.equal(course.summary.length > 0, true);
    assert.equal(course.goalKeywords.length > 0, true);
    assert.equal(course.goalKeywords.every((keyword) => keyword.trim().length > 0), true);
    assert.equal(validDifficulties[course.difficulty] === true, true);
    assert.equal(Array.isArray(course.prerequisites), true);
    assert.equal(course.interestTags.length > 0, true);
    assert.equal(course.interestTags.every((tag) => tag.trim().length > 0), true);
    if (course.schedule !== null) {
      assert.equal(validDays[course.schedule.day] === true, true);
      assert.equal(Number.isInteger(course.schedule.start), true);
      assert.equal(course.schedule.start >= 9 && course.schedule.start <= 17, true);
      assert.equal(Number.isInteger(course.schedule.duration), true);
      assert.equal(course.schedule.duration >= 1 && course.schedule.duration <= 3, true);

      const slot = `${course.schedule.day}-${course.schedule.start}`;
      assert.equal(schedules.has(slot), false, `${course.id} reuses schedule ${slot}`);
      schedules.add(slot);
    }
  }

  const serializedCatalog = JSON.stringify(catalogJson);
  assert.equal(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(serializedCatalog), false);
  assert.equal(/(?:0\d{1,2}[- ]?)?\d{3,4}[- ]?\d{4}/.test(serializedCatalog), false);
});

test("대표 과목의 데모 팁 12건은 허용 태그와 고정 키만 사용한다", () => {
  const tips = demoTipsJson;
  const allowedTags = new Set<string>(ALLOWED_TIP_TAGS);

  assert.equal(tips.length, 12);
  assert.equal(new Set(tips.map(({ demoKey }) => demoKey)).size, 12);

  for (const tip of tips) {
    assert.match(tip.demoKey, /^web-content-development-demo-\d{2}$/);
    assert.equal(tip.courseId, "web-content-development");
    assert.equal(tip.isDemo, true);
    assert.equal([1, 2, 3].includes(tip.prerequisite), true);
    assert.equal([1, 2, 3].includes(tip.practice), true);
    assert.equal([1, 2, 3].includes(tip.workload), true);
    assert.equal(tip.tags.length > 0, true);
    assert.equal(tip.tags.every((tag) => allowedTags.has(tag)), true);
    assert.equal("userId" in tip, false);
    assert.equal("sessionHash" in tip, false);
  }
});
