import Link from "next/link";

import type { CatalogCourse } from "@/lib/catalog-data";
import type { TipAggregate } from "@/lib/tips";
import type { CourseData, WeekPlan } from "@/lib/types";
import { CourseRoadmap } from "./course-roadmap";
import { CourseSyllabusDialog } from "./course-syllabus-dialog";
import { QaPanel } from "./qa-panel";
import { SourceBadge } from "./source-badge";
import { TipsPanel } from "./tips-panel";
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
          <h2>선수지식</h2>
          {course.prerequisites.length > 0 ? (
            <ul>{course.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : (
            <p>필수 선수지식이 없습니다.</p>
          )}
          <h2>관련 학습 목표</h2>
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
