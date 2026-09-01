
import { CuriReward } from "@/components/curi-reward";
import { Timetable } from "@/features/timetable/timetable";

export default function Home() {
  return (
    <main className="student-page">
      <header className="student-page-header">
        <div className="student-page-intro">
          <p className="eyebrow">MY WEEKLY PLAN</p>
          <h1>이번 학기,<br /><span className="student-title-nowrap"><em>내 시간표</em>에서</span> <span className="student-title-nowrap">시작해요.</span></h1>
          <p className="hero-copy">학생의 전공·관심·목표를 이해해 맞춤 과목을 추천하고, 수업 준비부터 실행까지 안내하는 AI 학습 내비게이터</p>
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
