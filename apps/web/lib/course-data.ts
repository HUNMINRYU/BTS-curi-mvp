import courseJson from "../data/course.json";
import supplementJson from "../data/demo-supplement.json";
import type { Citation, CourseData, Preparation, WeekPlan } from "./types";

const ACTUAL_DOCUMENT = "웹컨텐츠개발.pdf";

function actualCitation(week: number, topic: string, objectives: string[]): Citation {
  return {
    id: `actual-week-${week}`,
    documentName: ACTUAL_DOCUMENT,
    sourceKind: "actual",
    week,
    excerpt: `${topic}. ${objectives.join(" ")}`,
  };
}

function demoPreparations(): Preparation[] {
  return supplementJson.preparations.map((preparation) => ({
    id: preparation.id,
    label: preparation.label,
    source: {
      id: `demo-preparation-${preparation.id}`,
      documentName: supplementJson.documentName,
      sourceKind: "demo",
      week: supplementJson.week,
      excerpt: preparation.excerpt,
    },
  }));
}

function buildWeeks(): WeekPlan[] {
  return courseJson.weeks.map((week) => ({
    ...week,
    source: actualCitation(week.week, week.topic, week.objectives),
    preparations: week.week === supplementJson.week ? demoPreparations() : [],
  }));
}

const courseData: CourseData = {
  id: courseJson.id,
  name: courseJson.name,
  summary: courseJson.summary,
  objective: courseJson.objective,
  currentWeek: courseJson.currentWeek,
  assessment: courseJson.assessment,
  weeks: buildWeeks(),
};

export function getCourseData(): CourseData {
  return courseData;
}

export function getCurrentWeek(): WeekPlan {
  const current = courseData.weeks.find(({ week }) => week === courseData.currentWeek);
  if (!current) {
    throw new Error(`현재 주차 ${courseData.currentWeek}의 강의계획이 없습니다.`);
  }
  return current;
}
