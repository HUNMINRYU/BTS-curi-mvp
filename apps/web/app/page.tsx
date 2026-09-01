import { CourseRoadmap } from "@/components/course-roadmap";
import { WeeklyCoach } from "@/components/weekly-coach";
import { getCourseData, getCurrentWeek } from "@/lib/course-data";

export default function Home() {
  const course = getCourseData();
  const currentWeek = getCurrentWeek();

  return (
    <main>
      <header className="hero">
        <nav aria-label="주요 메뉴">
          <a className="brand" href="#top" aria-label="CURI 홈">CURI<span>.</span></a>
          <div>
            <a href="#coach-title">이번 주</a>
            <a href="#roadmap-title">로드맵</a>
          </div>
        </nav>
        <div className="hero-grid" id="top">
          <div>
            <p className="eyebrow">COURSE NAVIGATOR</p>
            <h1>수업의 흐름을<br /><em>놓치지 않게.</em></h1>
            <p className="hero-copy">흩어진 강의계획을 한 학기 로드맵과 오늘의 준비 행동으로 바꿉니다.</p>
          </div>
          <aside className="course-summary" aria-label="과목 요약">
            <p>2025 · 2학기</p>
            <h2>{course.name}</h2>
            <p>{course.summary}</p>
            <div className="semester-progress">
              <span style={{ width: `${(course.currentWeek / course.weeks.length) * 100}%` }} />
            </div>
            <small>{course.currentWeek} / {course.weeks.length}주차</small>
          </aside>
        </div>
      </header>

      <div className="dashboard-grid">
        <WeeklyCoach week={currentWeek} />
        <CourseRoadmap course={course} />
      </div>
    </main>
  );
}
