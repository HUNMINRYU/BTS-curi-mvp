import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { CuriReward } from "@/components/curi-reward";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";
import { AbilityDashboard } from "@/features/profile/ability-dashboard";
import { StudentRankingPanel } from "@/features/profile/student-ranking";
import { getAppDatabase } from "@/lib/app-db";
import { SESSION_COOKIE_NAME } from "@/features/auth/auth";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const database = getAppDatabase();
  const session = sessionId ? database.getActiveSession(sessionId, new Date()) : null;

  if (!session) redirect("/login");
  if (session.user.role !== "student") redirect("/professor");

  const profile = database.getProfile(session.user.id);
  if (!profile) redirect("/onboarding");

  return (
    <main className="account-page onboarding-page" aria-labelledby="profile-title">
      <section className="account-intro">
        <p className="eyebrow">UPDATE MY COURSE PROFILE</p>
        <h1 id="profile-title">달라진 나를,<br /><em>추천에 반영해요.</em></h1>
        <p className="account-slogan">전공, 관심분야와 학습 목표를 고치면 다음 추천부터 바로 반영됩니다.</p>
        <CuriReward compact />
      </section>
      <OnboardingWizard
        initialProfile={{
          major: profile.major,
          interest: profile.interest,
          goal: profile.goal,
          career: profile.career,
          style: profile.style,
          hours: profile.hours,
          avoid: profile.avoid,
        }}
        mode="edit"
      />
      <StudentRankingPanel ranking={database.getStudentRanking(session.user.id)} />
      <AbilityDashboard />
    </main>
  );
}
