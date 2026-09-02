
import { cookies } from "next/headers";

import { CuriReward } from "@/components/curi-reward";
import { SESSION_COOKIE_NAME } from "@/features/auth/auth";
import { Timetable } from "@/features/timetable/timetable";
import { getAppDatabase } from "@/lib/app-db";

export const dynamic = "force-dynamic";

export function HomeContent({ authenticated }: { readonly authenticated: boolean }) {
  return (
    <main className="student-page">
      <header className="student-page-header">
        <div className="student-page-intro">
          <p className="eyebrow">MY WEEKLY PLAN</p>
          <h1>이번 학기,<br /><span className="student-title-nowrap"><em>내 시간표</em>에서</span> <span className="student-title-nowrap">시작해요.</span></h1>
          <p className="hero-copy">학생의 전공·관심·목표를 이해해 맞춤 과목을 추천하고, 수업 준비부터 실행까지 안내하는 AI 학습 내비게이터</p>
          {!authenticated ? (
            <a className="primary-button student-signup-cta" href="/signup">회원가입하고 시작하기</a>
          ) : null}
          <CuriReward compact />
        </div>
      </header>
      <div className="student-page-content">
        <Timetable />
      </div>
    </main>
  );
}

export default async function Home() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionId
    ? getAppDatabase().getActiveSession(sessionId, new Date())
    : null;
  return <HomeContent authenticated={session !== null} />;
}
