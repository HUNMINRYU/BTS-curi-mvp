export const COURSE_TIPS_SCHEMA = `
CREATE TABLE IF NOT EXISTS course_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  session_hash TEXT NOT NULL,
  prerequisite INTEGER NOT NULL CHECK (prerequisite BETWEEN 1 AND 3),
  practice INTEGER NOT NULL CHECK (practice BETWEEN 1 AND 3),
  workload INTEGER NOT NULL CHECK (workload BETWEEN 1 AND 3),
  tags_json TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(course_id, session_hash)
);
`;

export const APP_DATABASE_SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'professor'))
);

CREATE TABLE IF NOT EXISTS credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS user_profile (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  major TEXT,
  interest TEXT,
  goal TEXT,
  career TEXT,
  style TEXT,
  hours TEXT,
  avoid TEXT,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_courses (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  PRIMARY KEY (user_id, course_id)
);

CREATE TABLE IF NOT EXISTS checklist_state (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  course_id TEXT NOT NULL,
  item_id TEXT NOT NULL,
  completed INTEGER NOT NULL CHECK (completed IN (0, 1)),
  PRIMARY KEY (user_id, course_id, item_id)
);

CREATE TABLE IF NOT EXISTS course_tips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  demo_key TEXT,
  prerequisite INTEGER NOT NULL CHECK (prerequisite BETWEEN 1 AND 3),
  practice INTEGER NOT NULL CHECK (practice BETWEEN 1 AND 3),
  workload INTEGER NOT NULL CHECK (workload BETWEEN 1 AND 3),
  tags_json TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(course_id, user_id),
  UNIQUE(course_id, demo_key)
);

CREATE TABLE IF NOT EXISTS qa_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS point_events (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  points INTEGER NOT NULL,
  awarded_at TEXT NOT NULL,
  PRIMARY KEY (user_id, event_key)
);
CREATE INDEX IF NOT EXISTS point_events_user_type_awarded_at_idx
  ON point_events(user_id, event_type, awarded_at);

CREATE TABLE IF NOT EXISTS earned_badges (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL,
  awarded_at TEXT NOT NULL,
  PRIMARY KEY (user_id, badge_key)
);
`;
