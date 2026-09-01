import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

import Database from "better-sqlite3";

import { APP_DATABASE_SCHEMA, COURSE_TIPS_SCHEMA } from "./schema";

export type NewCourseTip = {
  courseId: string;
  sessionHash: string;
  prerequisite: number;
  practice: number;
  workload: number;
  tags: string[];
  isDemo: boolean;
};

export type StoredCourseTip = NewCourseTip & {
  id: number;
  createdAt: string;
};

type CourseTipRow = {
  id: number;
  course_id: string;
  session_hash: string;
  prerequisite: number;
  practice: number;
  workload: number;
  tags_json: string;
  is_demo: number;
  created_at: string;
};

export class DuplicateCourseTipError extends Error {
  constructor() {
    super("A tip already exists for this course and session.");
    this.name = "DuplicateCourseTipError";
  }
}

export type TipsDatabase = {
  close(): void;
  listTips(courseId: string): StoredCourseTip[];
  insertTipAndList(tip: NewCourseTip): StoredCourseTip[];
  seedTips(tips: readonly NewCourseTip[]): number;
};

function mapRow(row: CourseTipRow): StoredCourseTip {
  const tags: unknown = JSON.parse(row.tags_json);
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    throw new Error(`Invalid tags_json for course tip ${row.id}.`);
  }

  return {
    id: row.id,
    courseId: row.course_id,
    sessionHash: row.session_hash,
    prerequisite: row.prerequisite,
    practice: row.practice,
    workload: row.workload,
    tags,
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
  };
}

export function createTipsDatabase(filename: string): TipsDatabase {
  if (filename !== ":memory:" && filename !== "") {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const database = new Database(filename);
  database.pragma("journal_mode = WAL");
  database.exec(COURSE_TIPS_SCHEMA);

  const listStatement = database.prepare<[string], CourseTipRow>(`
    SELECT id, course_id, session_hash, prerequisite, practice, workload,
           tags_json, is_demo, created_at
    FROM course_tips
    WHERE course_id = ?
    ORDER BY id ASC
  `);
  const insertStatement = database.prepare(`
    INSERT INTO course_tips (
      course_id, session_hash, prerequisite, practice, workload, tags_json, is_demo
    ) VALUES (
      @courseId, @sessionHash, @prerequisite, @practice, @workload, @tagsJson, @isDemo
    )
  `);
  const seedStatement = database.prepare(`
    INSERT OR IGNORE INTO course_tips (
      course_id, session_hash, prerequisite, practice, workload, tags_json, is_demo
    ) VALUES (
      @courseId, @sessionHash, @prerequisite, @practice, @workload, @tagsJson, @isDemo
    )
  `);

  function listTips(courseId: string): StoredCourseTip[] {
    return listStatement.all(courseId).map(mapRow);
  }

  const insertTipAndListTransaction = database.transaction((tip: NewCourseTip) => {
    insertStatement.run({
      courseId: tip.courseId,
      sessionHash: tip.sessionHash,
      prerequisite: tip.prerequisite,
      practice: tip.practice,
      workload: tip.workload,
      tagsJson: JSON.stringify(tip.tags),
      isDemo: tip.isDemo ? 1 : 0,
    });
    return listTips(tip.courseId);
  });
  const seedTipsTransaction = database.transaction((tips: readonly NewCourseTip[]) => {
    let inserted = 0;
    for (const tip of tips) {
      inserted += seedStatement.run({
        courseId: tip.courseId,
        sessionHash: tip.sessionHash,
        prerequisite: tip.prerequisite,
        practice: tip.practice,
        workload: tip.workload,
        tagsJson: JSON.stringify(tip.tags),
        isDemo: tip.isDemo ? 1 : 0,
      }).changes;
    }
    return inserted;
  });

  return {
    close: () => database.close(),
    listTips,
    seedTips(tips) {
      return seedTipsTransaction.immediate(tips);
    },
    insertTipAndList(tip) {
      try {
        return insertTipAndListTransaction.immediate(tip);
      } catch (error) {
        if (error instanceof Database.SqliteError && error.code.startsWith("SQLITE_CONSTRAINT_UNIQUE")) {
          throw new DuplicateCourseTipError();
        }
        throw error;
      }
    },
  };
}

export type UserRole = "student" | "professor";

export type AppUser = {
  id: string;
  name: string;
  role: UserRole;
};

export type UserProfile = {
  userId: string;
  major: string | null;
  interest: string | null;
  goal: string | null;
  career: string | null;
  style: string | null;
  hours: string | null;
  avoid: string | null;
  completedAt: string;
};

export type NewSession = {
  id: string;
  userId: string;
  expiresAt: string;
};

export type ActiveSession = {
  id: string;
  expiresAt: string;
  user: AppUser;
};

export type UserCourse = {
  userId: string;
  courseId: string;
};
export type QaLogSummary = {
  courseId: string;
  question: string;
  count: number;
  lastOccurredAt: string;
};

export type CourseTipInput = {
  courseId: string;
  prerequisite: number;
  practice: number;
  workload: number;
  tags: string[];
};

export type DemoCourseTipInput = CourseTipInput & { demoKey: string };
export type UserCourseTipInput = CourseTipInput & { userId: string };

export type AppCourseTip = CourseTipInput & {
  id: number;
  userId: string | null;
  demoKey: string | null;
  isDemo: boolean;
  createdAt: string;
};

export type GamificationSummary = {
  totalPoints: number;
  level: 1 | 2 | 3;
  badges: string[];
  newlyEarnedBadges: string[];
};

export type ChecklistAwardInput = {
  userId: string;
  courseId: string;
  itemId: string;
  itemIds: readonly string[];
  weekKey: string;
  completed: boolean;
  awardedAt: string;
};

export type UserCourseTipAwardInput = UserCourseTipInput & {
  awardedAt: string;
};

export type CredentialUserInput = {
  id: string;
  username: string;
  name: string;
  role: UserRole;
  passwordHash: string;
  passwordSalt: string;
};

export type CredentialRecord = {
  user: AppUser;
  username: string;
  passwordHash: string;
  passwordSalt: string;
};

export class DuplicateUsernameError extends Error {
  constructor() {
    super("A user with that username already exists.");
    this.name = "DuplicateUsernameError";
  }
}

export type AppDatabase = {
  close(): void;
  createCredentialUser(input: CredentialUserInput): AppUser;
  upsertCredentialUser(input: CredentialUserInput): AppUser;
  getCredentialByUsername(username: string): CredentialRecord | null;
  getUser(userId: string): AppUser | null;
  createSession(session: NewSession): void;
  getActiveSession(sessionId: string, now: Date): ActiveSession | null;
  deleteSession(sessionId: string): void;
  getProfile(userId: string): UserProfile | null;
  upsertProfile(profile: UserProfile): void;
  listUserCourseIds(userId: string): string[];
  addUserCourse(userId: string, courseId: string): void;
  removeUserCourse(userId: string, courseId: string): void;
  listCompletedChecklistItems(userId: string, courseId: string): string[];
  setChecklistItem(userId: string, courseId: string, itemId: string, completed: boolean): void;
  setChecklistItemAndAward(input: ChecklistAwardInput): GamificationSummary;
  awardOnboarding(userId: string, awardedAt: string): GamificationSummary;
  awardQaQuestion(userId: string, question: string, awardedAt: string): GamificationSummary;
  getGamificationSummary(userId: string): GamificationSummary;
  listGamificationEventKeys(userId: string): string[];
  insertQaLog(courseId: string, question: string, createdAt: string): void;
  listQaLogSummary(): QaLogSummary[];
  listCourseTips(courseId: string): AppCourseTip[];
  seedDemoCourseTips(tips: readonly DemoCourseTipInput[]): number;
  insertUserCourseTipAndList(tip: UserCourseTipInput): AppCourseTip[];
  insertUserCourseTipAndAward(tip: UserCourseTipAwardInput): GamificationSummary;
};

type UserRow = {
  id: string;
  name: string;
  role: UserRole;
};

type SessionRow = {
  session_id: string;
  expires_at: string;
  user_id: string;
  user_name: string;
  user_role: UserRole;
};

type ProfileRow = {
  user_id: string;
  major: string | null;
  interest: string | null;
  goal: string | null;
  career: string | null;
  style: string | null;
  hours: string | null;
  avoid: string | null;
  completed_at: string;
};

type UserCourseRow = {
  course_id: string;
};
type ChecklistRow = { item_id: string };
type QaLogSummaryRow = {
  course_id: string;
  question: string;
  count: number;
  last_occurred_at: string;
};
type AppCourseTipRow = {
  id: number;
  course_id: string;
  user_id: string | null;
  demo_key: string | null;
  prerequisite: number;
  practice: number;
  workload: number;
  tags_json: string;
  is_demo: number;
  created_at: string;
};
type CredentialRow = UserRow & {
  username: string;
  password_hash: string;
  password_salt: string;
};
type TotalPointsRow = { total_points: number };
type BadgeRow = { badge_key: string };
type EventKeyRow = { event_key: string };
type QaCountRow = { count: number };

type PointAwardInput = {
  userId: string;
  eventKey: string;
  eventType: string;
  points: number;
  awardedAt: string;
  badges: readonly string[];
};

function gamificationLevel(totalPoints: number): 1 | 2 | 3 {
  if (totalPoints >= 100) return 3;
  if (totalPoints >= 50) return 2;
  return 1;
}

function normalizedQuestion(question: string): string {
  return question.trim().replace(/\s+/gu, " ").toLowerCase();
}




function mapUser(row: UserRow): AppUser {
  return { id: row.id, name: row.name, role: row.role };
}
function mapCredential(row: CredentialRow): CredentialRecord {
  return {
    user: mapUser(row),
    username: row.username,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
  };
}

function mapProfile(row: ProfileRow): UserProfile {
  return {
    userId: row.user_id,
    major: row.major,
    interest: row.interest,
    goal: row.goal,
    career: row.career,
    style: row.style,
    hours: row.hours,
    avoid: row.avoid,
    completedAt: row.completed_at,
  };
}

function mapSession(row: SessionRow): ActiveSession {
  return {
    id: row.session_id,
    expiresAt: row.expires_at,
    user: { id: row.user_id, name: row.user_name, role: row.user_role },
  };
}
function mapQaLogSummary(row: QaLogSummaryRow): QaLogSummary {
  return {
    courseId: row.course_id,
    question: row.question,
    count: row.count,
    lastOccurredAt: row.last_occurred_at,
  };
}

function mapAppCourseTip(row: AppCourseTipRow): AppCourseTip {
  const tags: unknown = JSON.parse(row.tags_json);
  if (!Array.isArray(tags) || !tags.every((tag) => typeof tag === "string")) {
    throw new Error(`Invalid tags_json for course tip ${row.id}.`);
  }
  return {
    id: row.id,
    courseId: row.course_id,
    userId: row.user_id,
    demoKey: row.demo_key,
    prerequisite: row.prerequisite,
    practice: row.practice,
    workload: row.workload,
    tags,
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
  };
}
export function createAppDatabase(filename: string): AppDatabase {
  if (filename !== ":memory:" && filename !== "") {
    mkdirSync(dirname(filename), { recursive: true });
  }

  const database = new Database(filename);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  database.exec(APP_DATABASE_SCHEMA);

  const createUserStatement = database.prepare(`
    INSERT INTO users (id, name, role) VALUES (@id, @name, @role)
  `);
  const upsertUserStatement = database.prepare(`
    INSERT INTO users (id, name, role) VALUES (@id, @name, @role)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, role = excluded.role
  `);
  const createCredentialStatement = database.prepare(`
    INSERT INTO credentials (user_id, username, password_hash, password_salt)
    VALUES (@id, @username, @passwordHash, @passwordSalt)
  `);
  const upsertCredentialStatement = database.prepare(`
    INSERT INTO credentials (user_id, username, password_hash, password_salt)
    VALUES (@id, @username, @passwordHash, @passwordSalt)
    ON CONFLICT(user_id) DO UPDATE SET
      username = excluded.username,
      password_hash = excluded.password_hash,
      password_salt = excluded.password_salt
  `);
  const getCredentialStatement = database.prepare<[string], CredentialRow>(`
    SELECT users.id, users.name, users.role,
           credentials.username, credentials.password_hash, credentials.password_salt
    FROM credentials
    INNER JOIN users ON users.id = credentials.user_id
    WHERE credentials.username = ?
  `);
  const getUserStatement = database.prepare<[string], UserRow>(`
    SELECT id, name, role FROM users WHERE id = ?
  `);

  const createSessionStatement = database.prepare(`
    INSERT INTO sessions (id, user_id, expires_at)
    VALUES (@id, @userId, @expiresAt)
  `);
  const getSessionStatement = database.prepare<[string], SessionRow>(`
    SELECT
      sessions.id AS session_id,
      sessions.expires_at,
      users.id AS user_id,
      users.name AS user_name,
      users.role AS user_role
    FROM sessions
    INNER JOIN users ON users.id = sessions.user_id
    WHERE sessions.id = ?
  `);
  const deleteSessionStatement = database.prepare<[string]>(`
    DELETE FROM sessions WHERE id = ?
  `);
  const getProfileStatement = database.prepare<[string], ProfileRow>(`
    SELECT user_id, major, interest, goal, career, style, hours, avoid, completed_at
    FROM user_profile
    WHERE user_id = ?
  `);
  const upsertProfileStatement = database.prepare(`
    INSERT INTO user_profile (
      user_id, major, interest, goal, career, style, hours, avoid, completed_at
    ) VALUES (
      @userId, @major, @interest, @goal, @career, @style, @hours, @avoid, @completedAt
    )
    ON CONFLICT(user_id) DO UPDATE SET
      major = excluded.major,
      interest = excluded.interest,
      goal = excluded.goal,
      career = excluded.career,
      style = excluded.style,
      hours = excluded.hours,
      avoid = excluded.avoid,
      completed_at = excluded.completed_at
  `);
  const listUserCourseIdsStatement = database.prepare<[string], UserCourseRow>(`
    SELECT course_id
    FROM user_courses
    WHERE user_id = ?
    ORDER BY course_id ASC
  `);
  const addUserCourseStatement = database.prepare(`
    INSERT OR IGNORE INTO user_courses (user_id, course_id)
    VALUES (@userId, @courseId)
  `);
  const removeUserCourseStatement = database.prepare(`
    DELETE FROM user_courses
    WHERE user_id = @userId AND course_id = @courseId
  `);
  const listChecklistStatement = database.prepare<[string, string], ChecklistRow>(`
    SELECT item_id FROM checklist_state
    WHERE user_id = ? AND course_id = ? AND completed = 1
    ORDER BY item_id ASC
  `);
  const setChecklistStatement = database.prepare(`
    INSERT INTO checklist_state (user_id, course_id, item_id, completed)
    VALUES (@userId, @courseId, @itemId, @completed)
    ON CONFLICT(user_id, course_id, item_id) DO UPDATE SET completed = excluded.completed
  `);
  const insertPointEventStatement = database.prepare(`
    INSERT OR IGNORE INTO point_events (user_id, event_key, event_type, points, awarded_at)
    VALUES (@userId, @eventKey, @eventType, @points, @awardedAt)
  `);
  const totalPointsStatement = database.prepare<[string], TotalPointsRow>(`
    SELECT COALESCE(SUM(points), 0) AS total_points
    FROM point_events
    WHERE user_id = ?
  `);
  const listBadgesStatement = database.prepare<[string], BadgeRow>(`
    SELECT badge_key
    FROM earned_badges
    WHERE user_id = ?
    ORDER BY awarded_at ASC, rowid ASC
  `);
  const insertBadgeStatement = database.prepare(`
    INSERT OR IGNORE INTO earned_badges (user_id, badge_key, awarded_at)
    VALUES (@userId, @badgeKey, @awardedAt)
  `);
  const listGamificationEventKeysStatement = database.prepare<[string], EventKeyRow>(`
    SELECT event_key
    FROM point_events
    WHERE user_id = ?
    ORDER BY awarded_at ASC, rowid ASC
  `);
  const qaAwardCountStatement = database.prepare<[string, string, string], QaCountRow>(`
    SELECT COUNT(*) AS count
    FROM point_events
    WHERE user_id = ? AND event_type = 'qa' AND awarded_at >= ? AND awarded_at < ?
  `);
  const insertQaLogStatement = database.prepare(`
    INSERT INTO qa_logs (course_id, question, created_at)
    VALUES (@courseId, @question, @createdAt)
  `);
  const listQaLogSummaryStatement = database.prepare<[], QaLogSummaryRow>(`
    SELECT course_id, question, COUNT(*) AS count, MAX(created_at) AS last_occurred_at
    FROM qa_logs
    GROUP BY course_id, question
    ORDER BY count DESC, last_occurred_at DESC, question ASC
  `);
  const listCourseTipsStatement = database.prepare<[string], AppCourseTipRow>(`
    SELECT id, course_id, user_id, demo_key, prerequisite, practice, workload,
           tags_json, is_demo, created_at
    FROM course_tips
    WHERE course_id = ?
    ORDER BY id ASC
  `);
  const seedDemoCourseTipStatement = database.prepare(`
    INSERT OR IGNORE INTO course_tips (
      course_id, user_id, demo_key, prerequisite, practice, workload, tags_json, is_demo
    ) VALUES (
      @courseId, NULL, @demoKey, @prerequisite, @practice, @workload, @tagsJson, 1
    )
  `);
  const insertUserCourseTipStatement = database.prepare(`
    INSERT INTO course_tips (
      course_id, user_id, demo_key, prerequisite, practice, workload, tags_json, is_demo
    ) VALUES (
      @courseId, @userId, NULL, @prerequisite, @practice, @workload, @tagsJson, 0
    )
  `);

  const seedDemoCourseTipsTransaction = database.transaction((tips: readonly DemoCourseTipInput[]) => {
    let inserted = 0;
    for (const tip of tips) {
      inserted += seedDemoCourseTipStatement.run({ ...tip, tagsJson: JSON.stringify(tip.tags) }).changes;
    }
    return inserted;
  });

  const insertUserCourseTipAndListTransaction = database.transaction((tip: UserCourseTipInput) => {
    insertUserCourseTipStatement.run({ ...tip, tagsJson: JSON.stringify(tip.tags) });
    return listCourseTipsStatement.all(tip.courseId).map(mapAppCourseTip);
  });

  const createCredentialUserTransaction = database.transaction((input: CredentialUserInput) => {
    createUserStatement.run(input);
    createCredentialStatement.run(input);
    return { id: input.id, name: input.name, role: input.role } satisfies AppUser;
  });
  const upsertCredentialUserTransaction = database.transaction((input: CredentialUserInput) => {
    upsertUserStatement.run(input);
    upsertCredentialStatement.run(input);
    return { id: input.id, name: input.name, role: input.role } satisfies AppUser;
  });

  function createCredentialUser(input: CredentialUserInput): AppUser {
    try {
      return createCredentialUserTransaction.immediate(input);
    } catch (error) {
      if (error instanceof Database.SqliteError && error.code.startsWith("SQLITE_CONSTRAINT_UNIQUE")) {
        throw new DuplicateUsernameError();
      }
      throw error;
    }
  }

  function upsertCredentialUser(input: CredentialUserInput): AppUser {
    try {
      return upsertCredentialUserTransaction.immediate(input);
    } catch (error) {
      if (error instanceof Database.SqliteError && error.code.startsWith("SQLITE_CONSTRAINT_UNIQUE")) {
        throw new DuplicateUsernameError();
      }
      throw error;
    }
  }
  function getGamificationSummary(userId: string, newlyEarnedBadges: string[] = []): GamificationSummary {
    const totalPoints = totalPointsStatement.get(userId)?.total_points ?? 0;
    return {
      totalPoints,
      level: gamificationLevel(totalPoints),
      badges: listBadgesStatement.all(userId).map((row) => row.badge_key),
      newlyEarnedBadges,
    };
  }

  function listGamificationEventKeys(userId: string): string[] {
    const rows = listGamificationEventKeysStatement.all(userId);
    return rows.map((row) => row.event_key);
  }

  function recordPointAward(input: PointAwardInput): GamificationSummary {
    if (insertPointEventStatement.run(input).changes === 0) {
      return getGamificationSummary(input.userId);
    }

    const newlyEarnedBadges: string[] = [];
    for (const badgeKey of input.badges) {
      if (insertBadgeStatement.run({ userId: input.userId, badgeKey, awardedAt: input.awardedAt }).changes === 1) {
        newlyEarnedBadges.push(badgeKey);
      }
    }
    return getGamificationSummary(input.userId, newlyEarnedBadges);
  }

  const awardOnboardingTransaction = database.transaction((userId: string, awardedAt: string) => {
    return recordPointAward({
      userId,
      eventKey: "onboarding",
      eventType: "onboarding",
      points: 30,
      awardedAt,
      badges: ["나를 아는 학생"],
    });
  });
  const awardQaQuestionTransaction = database.transaction((userId: string, question: string, awardedAt: string) => {
    const normalized = normalizedQuestion(question);
    const dayKey = awardedAt.slice(0, 10);
    const nextDay = new Date(`${dayKey}T00:00:00.000Z`);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);
    const existingCount = qaAwardCountStatement.get(userId, `${dayKey}T00:00:00.000Z`, nextDay.toISOString())?.count ?? 0;
    const eventKey = `qa:${dayKey}:${createHash("sha256").update(normalized).digest("hex")}`;
    if (existingCount >= 3) {
      return getGamificationSummary(userId);
    }
    return recordPointAward({
      userId,
      eventKey,
      eventType: "qa",
      points: 5,
      awardedAt,
      badges: ["호기심 탐험가"],
    });
  });
  const setChecklistItemAndAwardTransaction = database.transaction((input: ChecklistAwardInput) => {
    setChecklistStatement.run({ ...input, completed: input.completed ? 1 : 0 });
    if (!input.completed) {
      return getGamificationSummary(input.userId);
    }

    recordPointAward({
      userId: input.userId,
      eventKey: `checklist:${input.courseId}:${input.itemId}`,
      eventType: "checklist_item",
      points: 10,
      awardedAt: input.awardedAt,
      badges: [],
    });
    const completedItemIds = new Set(listChecklistStatement.all(input.userId, input.courseId).map((row) => row.item_id));
    if (!input.itemIds.every((itemId) => completedItemIds.has(itemId))) {
      return getGamificationSummary(input.userId);
    }
    return recordPointAward({
      userId: input.userId,
      eventKey: `weekly-clear:${input.courseId}:${input.weekKey}`,
      eventType: "weekly_clear",
      points: 30,
      awardedAt: input.awardedAt,
      badges: ["이번 주 정복"],
    });
  });
  const insertUserCourseTipAndAwardTransaction = database.transaction((tip: UserCourseTipAwardInput) => {
    insertUserCourseTipStatement.run({ ...tip, tagsJson: JSON.stringify(tip.tags) });
    return recordPointAward({
      userId: tip.userId,
      eventKey: `tip:${tip.courseId}`,
      eventType: "course_tip",
      points: 20,
      awardedAt: tip.awardedAt,
      badges: ["길잡이"],
    });
  });

  return {
    close: () => database.close(),
    createCredentialUser,
    upsertCredentialUser,
    getCredentialByUsername(username) {
      const row = getCredentialStatement.get(username);
      return row ? mapCredential(row) : null;
    },
    getUser(userId) {
      const row = getUserStatement.get(userId);
      return row ? mapUser(row) : null;
    },
    createSession(session) {
      createSessionStatement.run(session);
    },
    getActiveSession(sessionId, now) {
      const row = getSessionStatement.get(sessionId);
      if (!row) {
        return null;
      }
      if (row.expires_at <= now.toISOString()) {
        deleteSessionStatement.run(sessionId);
        return null;
      }
      return mapSession(row);
    },
    deleteSession(sessionId) {
      deleteSessionStatement.run(sessionId);
    },
    getProfile(userId) {
      const row = getProfileStatement.get(userId);
      return row ? mapProfile(row) : null;
    },
    upsertProfile(profile) {
      upsertProfileStatement.run(profile);
    },
    listUserCourseIds(userId) {
      return listUserCourseIdsStatement.all(userId).map((row) => row.course_id);
    },
    addUserCourse(userId, courseId) {
      addUserCourseStatement.run({ userId, courseId });
    },
    removeUserCourse(userId, courseId) {
      removeUserCourseStatement.run({ userId, courseId });
    },
    listCompletedChecklistItems(userId, courseId) {
      return listChecklistStatement.all(userId, courseId).map((row) => row.item_id);
    },
    setChecklistItem(userId, courseId, itemId, completed) {
      setChecklistStatement.run({ userId, courseId, itemId, completed: completed ? 1 : 0 });
    },
    setChecklistItemAndAward(input) {
      return setChecklistItemAndAwardTransaction.immediate(input);
    },
    awardOnboarding(userId, awardedAt) {
      return awardOnboardingTransaction.immediate(userId, awardedAt);
    },
    awardQaQuestion(userId, question, awardedAt) {
      return awardQaQuestionTransaction.immediate(userId, question, awardedAt);
    },
    getGamificationSummary,
    listGamificationEventKeys,
    insertQaLog(courseId, question, createdAt) {
      insertQaLogStatement.run({ courseId, question, createdAt });
    },
    listQaLogSummary() {
      return listQaLogSummaryStatement.all().map(mapQaLogSummary);
    },
    listCourseTips(courseId) {
      return listCourseTipsStatement.all(courseId).map(mapAppCourseTip);
    },
    seedDemoCourseTips(tips) {
      return seedDemoCourseTipsTransaction.immediate(tips);
    },
    insertUserCourseTipAndList(tip) {
      try {
        return insertUserCourseTipAndListTransaction.immediate(tip);
      } catch (error) {
        if (error instanceof Database.SqliteError && error.code.startsWith("SQLITE_CONSTRAINT_UNIQUE")) {
          throw new DuplicateCourseTipError();
        }
        throw error;
      }
    },
    insertUserCourseTipAndAward(tip) {
      try {
        return insertUserCourseTipAndAwardTransaction.immediate(tip);
      } catch (error) {
        if (error instanceof Database.SqliteError && error.code.startsWith("SQLITE_CONSTRAINT_UNIQUE")) {
          throw new DuplicateCourseTipError();
        }
        throw error;
      }
    }
  };
}
