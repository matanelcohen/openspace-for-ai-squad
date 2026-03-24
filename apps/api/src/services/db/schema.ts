/**
 * SQLite database schema for the openspace.ai index/cache layer.
 *
 * Tables:
 *   tasks            — Indexed copy of .squad/tasks/*.md
 *   decisions        — Full-text-searchable copy of decisions from decisions.md
 *   chat_messages    — Chat message storage
 *   activity_events  — Activity event log
 *
 * FTS5 virtual tables:
 *   decisions_fts    — Full-text search over decision title + rationale
 *   tasks_fts        — Full-text search over task title + description
 *
 * SQLite is the CACHE. .squad/ files are the source of truth.
 * If they conflict, files win.
 */

import type Database from 'better-sqlite3';

// ── Schema DDL ─────────────────────────────────────────────────────

const SCHEMA_SQL = `
-- Tasks table — mirrors .squad/tasks/*.md
CREATE TABLE IF NOT EXISTS tasks (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'backlog',
  priority    TEXT NOT NULL DEFAULT 'P2',
  assignee    TEXT,
  labels      TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  sort_index  INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);

-- Decisions table — mirrors decisions.md entries
CREATE TABLE IF NOT EXISTS decisions (
  id             TEXT PRIMARY KEY,
  title          TEXT NOT NULL,
  author         TEXT NOT NULL DEFAULT 'Unknown',
  date           TEXT NOT NULL,
  rationale      TEXT NOT NULL DEFAULT '',
  status         TEXT NOT NULL DEFAULT 'active',
  affected_files TEXT NOT NULL DEFAULT '[]'
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id         TEXT PRIMARY KEY,
  sender     TEXT NOT NULL,
  recipient  TEXT NOT NULL,
  content    TEXT NOT NULL,
  timestamp  TEXT NOT NULL,
  thread_id  TEXT
);

CREATE INDEX IF NOT EXISTS idx_chat_timestamp ON chat_messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_chat_sender ON chat_messages(sender);
CREATE INDEX IF NOT EXISTS idx_chat_recipient ON chat_messages(recipient);
CREATE INDEX IF NOT EXISTS idx_chat_thread ON chat_messages(thread_id);

-- Activity events table
CREATE TABLE IF NOT EXISTS activity_events (
  id                TEXT PRIMARY KEY,
  type              TEXT NOT NULL,
  agent_id          TEXT NOT NULL,
  description       TEXT NOT NULL DEFAULT '',
  timestamp         TEXT NOT NULL,
  related_entity_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_activity_timestamp ON activity_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_activity_agent ON activity_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_activity_type ON activity_events(type);

-- FTS5 virtual tables for full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS decisions_fts USING fts5(
  id UNINDEXED,
  title,
  rationale,
  author,
  content='decisions',
  content_rowid='rowid'
);

CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
  id UNINDEXED,
  title,
  description,
  content='tasks',
  content_rowid='rowid'
);

-- Triggers to keep FTS in sync with base tables
CREATE TRIGGER IF NOT EXISTS decisions_ai AFTER INSERT ON decisions BEGIN
  INSERT INTO decisions_fts(rowid, id, title, rationale, author)
  VALUES (new.rowid, new.id, new.title, new.rationale, new.author);
END;

CREATE TRIGGER IF NOT EXISTS decisions_ad AFTER DELETE ON decisions BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, id, title, rationale, author)
  VALUES ('delete', old.rowid, old.id, old.title, old.rationale, old.author);
END;

CREATE TRIGGER IF NOT EXISTS decisions_au AFTER UPDATE ON decisions BEGIN
  INSERT INTO decisions_fts(decisions_fts, rowid, id, title, rationale, author)
  VALUES ('delete', old.rowid, old.id, old.title, old.rationale, old.author);
  INSERT INTO decisions_fts(rowid, id, title, rationale, author)
  VALUES (new.rowid, new.id, new.title, new.rationale, new.author);
END;

CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
  INSERT INTO tasks_fts(rowid, id, title, description)
  VALUES (new.rowid, new.id, new.title, new.description);
END;

CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description)
  VALUES ('delete', old.rowid, old.id, old.title, old.description);
END;

CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
  INSERT INTO tasks_fts(tasks_fts, rowid, id, title, description)
  VALUES ('delete', old.rowid, old.id, old.title, old.description);
  INSERT INTO tasks_fts(rowid, id, title, description)
  VALUES (new.rowid, new.id, new.title, new.description);
END;

-- Team members table — stored directly in SQLite (not markdown)
CREATE TABLE IF NOT EXISTS team_members (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL UNIQUE,
  role        TEXT NOT NULL,
  department  TEXT NOT NULL,
  skills      TEXT NOT NULL DEFAULT '[]',
  rank        TEXT NOT NULL DEFAULT 'mid',
  status      TEXT NOT NULL DEFAULT 'active',
  joined_at   TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_team_members_department ON team_members(department);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_members_rank ON team_members(rank);
CREATE INDEX IF NOT EXISTS idx_team_members_email ON team_members(email);

-- FTS5 for team member search (name, role, skills)
CREATE VIRTUAL TABLE IF NOT EXISTS team_members_fts USING fts5(
  id UNINDEXED,
  name,
  role,
  skills,
  content='team_members',
  content_rowid='rowid'
);

-- Triggers to keep team_members FTS in sync
CREATE TRIGGER IF NOT EXISTS team_members_ai AFTER INSERT ON team_members BEGIN
  INSERT INTO team_members_fts(rowid, id, name, role, skills)
  VALUES (new.rowid, new.id, new.name, new.role, new.skills);
END;

CREATE TRIGGER IF NOT EXISTS team_members_ad AFTER DELETE ON team_members BEGIN
  INSERT INTO team_members_fts(team_members_fts, rowid, id, name, role, skills)
  VALUES ('delete', old.rowid, old.id, old.name, old.role, old.skills);
END;

CREATE TRIGGER IF NOT EXISTS team_members_au AFTER UPDATE ON team_members BEGIN
  INSERT INTO team_members_fts(team_members_fts, rowid, id, name, role, skills)
  VALUES ('delete', old.rowid, old.id, old.name, old.role, old.skills);
  INSERT INTO team_members_fts(rowid, id, name, role, skills)
  VALUES (new.rowid, new.id, new.name, new.role, new.skills);
END;

-- Metadata table for tracking sync state
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

// ── Public API ─────────────────────────────────────────────────────

/**
 * Initialize the database schema. Safe to call multiple times
 * (all statements use IF NOT EXISTS).
 */
export function initializeSchema(db: Database.Database): void {
  db.exec(SCHEMA_SQL);

  // Record schema version
  db.prepare(`INSERT OR REPLACE INTO _meta (key, value) VALUES ('schema_version', '1')`).run();
}
