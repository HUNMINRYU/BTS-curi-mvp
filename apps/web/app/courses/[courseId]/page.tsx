import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { CourseDetail } from "@/features/course/course-detail";
import { getAppDatabase } from "@/lib/app-db";
import { SESSION_COOKIE_NAME } from "@/features/auth/auth";
import { getCatalogCourse } from "@/features/catalog/catalog-data";
import { getCourseData, getCurrentWeek } from "@/features/course/course-data";
import { getTipAggregate, seedDemoTips } from "@/features/tips/tip-data";

export const dynamic = "force-dynamic";

type CoursePageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function CoursePage({ params }: CoursePageProps) {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const database = getAppDatabase();
  const session = sessionId ? database.getActiveSession(sessionId, new Date()) : null;

  if (!session) {
    redirect("/login");
  }
  if (session.user.role !== "student") {
    redirect("/professor");
  }

  const { courseId } = await params;
  const catalogCourse = getCatalogCourse(courseId);
  if (!catalogCourse) {
    notFound();
  }

  const profileGoal = database.getProfile(session.user.id)?.goal ?? null;
  seedDemoTips(database);
  const tipAggregate = getTipAggregate(database, courseId);
  if (courseId === "web-content-development") {
    return (
      <CourseDetail
        catalogCourse={catalogCourse}
        course={getCourseData()}
        currentWeek={getCurrentWeek()}
        profileGoal={profileGoal}
        tipAggregate={tipAggregate}
      />
    );
  }

  return <CourseDetail catalogCourse={catalogCourse} profileGoal={profileGoal} />;
}
