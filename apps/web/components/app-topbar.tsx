import { cookies } from "next/headers";

import type { AppDatabase, AppUser, GamificationSummary } from "@curi/db";
import { getAppDatabase } from "@/lib/app-db";
import { SESSION_COOKIE_NAME } from "@/lib/auth";
import { AppTopbarClient } from "./app-topbar-client";

export type AppTopbarState = {
  user: AppUser | null;
  gamification: GamificationSummary | null;
};

export function getAppTopbarState(
  database: AppDatabase,
  sessionId: string | undefined,
  now: Date,
): AppTopbarState {
  const session = sessionId ? database.getActiveSession(sessionId, now) : null;
  const user = session?.user ?? null;
  const gamification = user?.role === "student" ? database.getGamificationSummary(user.id) : null;
  return { user, gamification };
}

export async function AppTopbar() {
  const cookieStore = await cookies();
  const database = getAppDatabase();
  const sessionCookie = await cookieStore.get(SESSION_COOKIE_NAME);
  const { user, gamification } = getAppTopbarState(
    database,
    sessionCookie?.value,
    new Date(),
  );

  return <AppTopbarClient gamification={gamification} user={user} />;
}
