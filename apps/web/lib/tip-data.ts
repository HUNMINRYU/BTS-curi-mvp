import type { AppCourseTip, AppDatabase, DemoCourseTipInput } from "@curi/db";

import demoTipsJson from "@/data/demo-tips.json";
import { aggregateTips, type TipAggregate, type TipRecord } from "@/lib/tips";

const DEMO_TIPS: readonly DemoCourseTipInput[] = demoTipsJson.map((tip) => ({
  courseId: tip.courseId,
  demoKey: tip.demoKey,
  prerequisite: tip.prerequisite,
  practice: tip.practice,
  workload: tip.workload,
  tags: tip.tags,
}));

function toTipRecords(rows: readonly AppCourseTip[]): TipRecord[] {
  return rows.map((row) => ({
    prerequisite: row.prerequisite as 1 | 2 | 3,
    practice: row.practice as 1 | 2 | 3,
    workload: row.workload as 1 | 2 | 3,
    tags: row.tags as TipRecord["tags"],
    isDemo: row.isDemo,
  }));
}

export function seedDemoTips(database: AppDatabase): number {
  return database.seedDemoCourseTips(DEMO_TIPS);
}

export function getTipAggregate(database: AppDatabase, courseId: string): TipAggregate {
  return aggregateTips(toTipRecords(database.listCourseTips(courseId)));
}
