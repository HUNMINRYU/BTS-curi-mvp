import Link from "next/link";

import type { CatalogCourse } from "@/features/catalog/catalog-data";
import { scheduleLabel } from "@/features/timetable/course-schedule";
import { SourceBadge } from "@/components/source-badge";
import { QaPanel } from "@/features/qa/qa-panel";
import { TipsPanel } from "@/features/tips/tips-panel";
import type { TipAggregate } from "@/features/tips/tips";
import type { CourseData, WeekPlan } from "@/lib/types";
import { CourseBackButton } from "./course-back-button";
import { CourseRoadmap } from "./course-roadmap";
import { CourseSyllabusDialog } from "./course-syllabus-dialog";
import { WeeklyCoach } from "./weekly-coach";

type CourseDetailProps = {
  catalogCourse: CatalogCourse;
  course?: CourseData;
  currentWeek?: WeekPlan;
  profileGoal: string | null;
  tipAggregate?: TipAggregate;
};

function CourseHeader({ course, details }: { course: CatalogCourse; details?: CourseData }) {
  return (
    <header className="course-detail-header">
      <CourseBackButton />
      <Link className="course-detail-back" href="/">← 내 시간표</Link>
      <div className="course-detail-heading">
        <div>
          <h1 id="course-title">{course.name}</h1>
          <p>{course.summary}</p>
        </div>
        <div className="course-detail-actions">
          <SourceBadge sourceKind={course.sourceKind} />
          <CourseSyllabusDialog course={course} {...(details ? { details } : {})} />
        </div>
      </div>
    </header>
  );
}

function CatalogCourseDetail({ course }: { course: CatalogCourse }) {
  return (
    <main className="course-detail-page" aria-labelledby="course-title">
      <CourseHeader course={course} />
      <section className="catalog-detail-grid" aria-label="과목 기본 정보">
        <article className="section-card">
          <p className="eyebrow">BEFORE CLASS</p>
          <h2 className="catalog-detail-heading">선수지식</h2>
          <p className="catalog-detail-value">{course.prerequisites.length > 0
            ? course.prerequisites.join(", ")
            : "별도 선수지식 없음"}</p>
          <h2 className="catalog-detail-heading">일정</h2>
          <p className="catalog-detail-value">{scheduleLabel(course)}</p>
          <h2 className="catalog-detail-heading">관련 학습 목표</h2>
          <ul>{course.goalKeywords.map((keyword) => <li key={keyword}>{keyword}</li>)}</ul>
        </article>
      </section>
    </main>
  );
}

export function CourseDetail({ catalogCourse, course, currentWeek, profileGoal, tipAggregate }: CourseDetailProps) {
  if (!course || !currentWeek) {
    return <CatalogCourseDetail course={catalogCourse} />;
  }

  return (
    <main className="course-detail-page" aria-labelledby="course-title">
      <CourseHeader course={catalogCourse} details={course} />
      <p className="personal-goal" aria-label="개인 학습 목표">
        개인 목표 · {profileGoal ?? "수업 흐름 놓치지 않기"}
      </p>
      <div className="dashboard-grid course-detail-dashboard">
        <div>
          <WeeklyCoach profileGoal={profileGoal} week={currentWeek} />
        </div>
        <CourseRoadmap course={course} />
      </div>
      {tipAggregate && <TipsPanel courseId={catalogCourse.id} initialAggregate={tipAggregate} />}
      <QaPanel courseId={catalogCourse.id} />
    </main>
  );
}
