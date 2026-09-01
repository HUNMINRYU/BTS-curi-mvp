import type Database from "better-sqlite3";

export type RankingEntry = {
  readonly rank: number;
  readonly displayName: string;
  readonly totalPoints: number;
  readonly isMe: boolean;
};

export type StudentRanking = {
  readonly leaders: readonly RankingEntry[];
  readonly me: RankingEntry;
};

export type AnonymousClassStatus = {
  readonly studentCount: number;
  readonly onboardingCount: number;
  readonly totalPoints: number;
  readonly averagePoints: number;
  readonly badgeCount: number;
  readonly checklistCompletionCount: number;
};

export type ProfileDistribution = {
  readonly field: "interest" | "goal" | "style" | "hours";
  readonly label: string;
  readonly value: string;
  readonly count: number;
};

export type AnonymousClassInsights = {
  readonly status: AnonymousClassStatus;
  readonly tmi: {
    readonly profileCount: number;
    readonly visible: boolean;
    readonly topValues: readonly ProfileDistribution[];
  };
};

type RankingRow = {
  readonly user_id: string;
  readonly name: string;
  readonly total_points: number;
};

type StatusRow = {
  readonly student_count: number;
  readonly onboarding_count: number;
  readonly total_points: number;
  readonly badge_count: number;
  readonly checklist_completion_count: number;
};

type DistributionRow = {
  readonly value: string;
  readonly count: number;
};

const PROFILE_DISTRIBUTIONS = [
  { field: "interest", label: "관심분야" },
  { field: "goal", label: "학습 목표" },
  { field: "style", label: "학습 스타일" },
  { field: "hours", label: "주간 학습 시간" },
] as const;

function maskedName(name: string): string {
  const [first = "*"] = Array.from(name.trim());
  return `${first}**`;
}

export function createReportQueries(database: Database.Database) {
  const rankingStatement = database.prepare<[], RankingRow>(`
    SELECT users.id AS user_id, users.name,
           COALESCE(SUM(point_events.points), 0) AS total_points
    FROM users
    LEFT JOIN point_events ON point_events.user_id = users.id
    WHERE users.role = 'student'
    GROUP BY users.id, users.name
    ORDER BY total_points DESC, users.id ASC
  `);
  const statusStatement = database.prepare<[], StatusRow>(`
    SELECT
      COUNT(*) AS student_count,
      COUNT(user_profile.user_id) AS onboarding_count,
      COALESCE(SUM(points.total_points), 0) AS total_points,
      COALESCE(SUM(badges.badge_count), 0) AS badge_count,
      COALESCE(SUM(checklist.completed_count), 0) AS checklist_completion_count
    FROM users
    LEFT JOIN user_profile ON user_profile.user_id = users.id
    LEFT JOIN (
      SELECT user_id, SUM(points) AS total_points FROM point_events GROUP BY user_id
    ) points ON points.user_id = users.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS badge_count FROM earned_badges GROUP BY user_id
    ) badges ON badges.user_id = users.id
    LEFT JOIN (
      SELECT user_id, COUNT(*) AS completed_count
      FROM checklist_state WHERE completed = 1 GROUP BY user_id
    ) checklist ON checklist.user_id = users.id
    WHERE users.role = 'student'
  `);
  const profileCountStatement = database.prepare<[], { readonly count: number }>(`
    SELECT COUNT(*) AS count FROM user_profile
  `);

  return {
    getStudentRanking(userId: string): StudentRanking {
      const rows = rankingStatement.all();
      const entries = rows.map((row, index) => ({
        rank: index + 1,
        displayName: maskedName(row.name),
        totalPoints: row.total_points,
        isMe: row.user_id === userId,
      }));
      const me = entries.find((entry) => entry.isMe) ?? {
        rank: entries.length + 1,
        displayName: "*",
        totalPoints: 0,
        isMe: true,
      };
      return { leaders: entries.slice(0, 5), me };
    },
    getAnonymousClassInsights(): AnonymousClassInsights {
      const status = statusStatement.get() ?? {
        student_count: 0,
        onboarding_count: 0,
        total_points: 0,
        badge_count: 0,
        checklist_completion_count: 0,
      };
      const profileCount = profileCountStatement.get()?.count ?? 0;
      const topValues = PROFILE_DISTRIBUTIONS.flatMap(({ field, label }) => {
        const row = database.prepare<[], DistributionRow>(`
          SELECT ${field} AS value, COUNT(*) AS count
          FROM user_profile
          WHERE ${field} IS NOT NULL
          GROUP BY ${field}
          ORDER BY count DESC, value ASC
          LIMIT 1
        `).get();
        return row ? [{ field, label, value: row.value, count: row.count }] : [];
      });
      return {
        status: {
          studentCount: status.student_count,
          onboardingCount: status.onboarding_count,
          totalPoints: status.total_points,
          averagePoints: status.student_count === 0
            ? 0
            : Math.round(status.total_points / status.student_count),
          badgeCount: status.badge_count,
          checklistCompletionCount: status.checklist_completion_count,
        },
        tmi: { profileCount, visible: profileCount >= 5, topValues },
      };
    },
  };
}
