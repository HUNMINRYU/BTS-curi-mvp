import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { ProfessorReport, type ProfessorQaLog } from "@/components/professor-report";
import { getAppDatabase } from "@/lib/app-db";
import { SESSION_COOKIE_NAME } from "@/features/auth/auth";
import { getCatalogCourse } from "@/features/catalog/catalog-data";
import { getTipAggregate, seedDemoTips } from "@/lib/tip-data";

const COURSE_ID = "web-content-development";

export const dynamic = "force-dynamic";

export default async function ProfessorPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const database = getAppDatabase();
  const session = sessionId ? database.getActiveSession(sessionId, new Date()) : null;

  if (!session) redirect("/login");
  if (session.user.role !== "professor") redirect("/");

  seedDemoTips(database);
  const qaLogs: ProfessorQaLog[] = database.listQaLogSummary().map((log) => ({
    ...log,
    courseName: getCatalogCourse(log.courseId)?.name ?? log.courseId,
  }));

  return (
    <ProfessorReport
      classInsights={database.getAnonymousClassInsights()}
      qaLogs={qaLogs}
      tipAggregate={getTipAggregate(database, COURSE_ID)}
    />
  );
}
