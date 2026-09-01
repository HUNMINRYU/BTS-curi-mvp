import type { CourseData } from "@/lib/types";
import { SourceBadge } from "./source-badge";
import { CuriMascot } from "./curi-mascot";

function statusFor(week: number, currentWeek: number) {
  if (week < currentWeek) return "완료";
  if (week === currentWeek) return "현재";
  return "예정";
}

export function CourseRoadmap({ course }: { course: CourseData }) {
  return (
    <section className="section-card" aria-labelledby="roadmap-title">
      <div className="section-heading">
        <div className="section-title-group">
          <CuriMascot className="section-mascot" variant="reading" />
          <div>
            <p className="eyebrow">SEMESTER MAP</p>
            <h2 id="roadmap-title">한 학기 로드맵</h2>
          </div>
        </div>
        <p>{course.currentWeek}주차 진행 중</p>
      </div>
      <ol className="roadmap-list">
        {course.weeks.map((week) => {
          const status = statusFor(week.week, course.currentWeek);
          const isMilestone = week.week === 8 || week.week === 15;
          return (
            <li className={`roadmap-item roadmap-item--${status} ${isMilestone ? "roadmap-item--milestone" : ""}`} key={week.week}>
              <div className="week-marker" aria-hidden="true">{week.week}</div>
              <div className="week-content">
                <div className="week-meta">
                  <span>{week.week}주차 · {status}</span>
                  <SourceBadge sourceKind={week.source.sourceKind} />
                </div>
                <h3>{week.topic}</h3>
                <p>{week.objectives[0]}</p>
                {week.assignment && <p className="assignment">과제 · {week.assignment}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
