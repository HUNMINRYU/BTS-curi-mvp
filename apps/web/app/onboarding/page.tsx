import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import type { ActiveSession, UserProfile } from "@curi/db";
import { CuriReward } from "@/components/curi-reward";
import { OnboardingWizard } from "@/components/onboarding-wizard";
import { getAppDatabase } from "@/lib/app-db";
import { SESSION_COOKIE_NAME } from "@/features/auth/auth";

type OnboardingSession = Pick<ActiveSession, "user"> | null;
type OnboardingProfile = Pick<UserProfile, "completedAt"> | null;

export const dynamic = "force-dynamic";

export function getOnboardingRedirect(
  session: OnboardingSession,
  profile: OnboardingProfile,
): "/login" | "/professor" | "/recommend" | null {
  if (!session) return "/login";
  if (session.user.role === "professor") return "/professor";
  if (profile?.completedAt) return "/recommend";
  return null;
}

export function OnboardingPageContent() {
  return (
    <main className="account-page onboarding-page" aria-labelledby="onboarding-title">
      <section className="account-intro">
        <p className="eyebrow">PERSONAL COURSE START</p>
        <h1 id="onboarding-title">나에게 맞는 수업을<br /><em>함께 찾아볼까요?</em></h1>
        <p className="account-slogan">CURI는 커리큘럼을 분석하는 AI가 아니라, 학생을 이해하는 AI입니다.</p>
        <CuriReward compact />
      </section>
      <OnboardingWizard />
    </main>
  );
}

export default async function OnboardingPage() {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const database = getAppDatabase();
  const session = sessionId ? database.getActiveSession(sessionId, new Date()) : null;
  const profile = session?.user.role === "student" ? database.getProfile(session.user.id) : null;
  const destination = getOnboardingRedirect(session, profile);

  if (destination) redirect(destination);

  return <OnboardingPageContent />;
}
