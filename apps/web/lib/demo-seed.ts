import type { AppDatabase } from "@curi/db";

import { seedDemoTips } from "@/lib/tip-data";

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
  return { tips, qaLogs };
}
