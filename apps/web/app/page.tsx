
import { CuriReward } from "@/components/curi-reward";
import { Timetable } from "@/components/timetable";

export default function Home() {
  return (
    <main className="student-page">
      <header className="student-page-header">
        <div className="student-page-intro">
          <p className="eyebrow">MY WEEKLY PLAN</p>
          <h1>이번 학기,<br /><span className="student-title-nowrap"><em>내 시간표</em>에서</span> <span className="student-title-nowrap">시작해요.</span></h1>
          <p className="hero-copy">강의계획서와 시간표를 한곳에서 확인하고, 나에게 맞는 다음 수업을 찾아보세요.</p>
          <a className="primary-button student-signup-cta" href="/signup">회원가입하고 시작하기</a>
          <CuriReward compact />
        </div>
      </header>
      <div className="student-page-content">
        <Timetable />
      </div>
    </main>
  );
}
