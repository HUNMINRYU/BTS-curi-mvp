import type { AppDatabase } from "@curi/db";

import { getCurrentWeek } from "@/features/course/course-data";
import { seedDemoTips } from "@/features/tips/tip-data";

export type DemoSeedResult = {
  readonly tips: number;
  readonly qaLogs: number;
};

/**
 * 강의계획서에 근거가 없어 Q&A가 "근거 없음"으로 처리하는 질문들이다.
 * 교수 리포트가 빈 상태로 시연되지 않도록 시드한다.
 */
const DEMO_UNANSWERED_QUESTIONS = [
  { courseId: "web-content-development", question: "장학금 신청은 어떻게 하나요?" },
  { courseId: "web-content-development", question: "재수강하면 성적에 상한이 있나요?" },
  { courseId: "web-content-development", question: "노트북이 없으면 실습을 어떻게 하나요?" },
] as const;
const DEMO_STUDENT_ID = "student-test";
const DEMO_COURSE_ID = "web-content-development";
const DEMO_STUDENT_COURSE_IDS = [
  "artificial-intelligence",
  "database",
  DEMO_COURSE_ID,
] as const;

function logKey(courseId: string, question: string): string {
  return `${courseId}\u0000${question}`;
}

export function seedDemoState(database: AppDatabase, now = () => new Date()): DemoSeedResult {
  const tips = seedDemoTips(database);
  const existing = new Set(
    database.listQaLogSummary().map((log) => logKey(log.courseId, log.question)),
  );

  const createdAt = now().toISOString();
  let qaLogs = 0;
  for (const entry of DEMO_UNANSWERED_QUESTIONS) {
    if (existing.has(logKey(entry.courseId, entry.question))) continue;
    database.insertQaLog(entry.courseId, entry.question, createdAt);
    qaLogs += 1;
  }

  const demoStudent = database.getUser(DEMO_STUDENT_ID);
  if (demoStudent?.role === "student") {
    database.upsertProfile({
      userId: DEMO_STUDENT_ID,
      major: "컴퓨터공학과",
      interest: "AI",
      goal: "포트폴리오",
      career: "프론트엔드 개발자",
      style: "직접 해보기",
      hours: "주 5시간",
      avoid: "발표",
      completedAt: createdAt,
    });
    for (const courseId of DEMO_STUDENT_COURSE_IDS) {
      database.addUserCourse(DEMO_STUDENT_ID, courseId);
    }
    database.awardOnboarding(DEMO_STUDENT_ID, createdAt);

    const currentWeek = getCurrentWeek();
    const firstPreparation = currentWeek.preparations[0];
    if (firstPreparation) {
      database.setChecklistItemAndAward({
        userId: DEMO_STUDENT_ID,
        courseId: DEMO_COURSE_ID,
        itemId: firstPreparation.id,
        itemIds: currentWeek.preparations.map(({ id }) => id),
        weekKey: String(currentWeek.week),
        completed: true,
        awardedAt: createdAt,
      });
    }
  }
  return { tips, qaLogs };
}
