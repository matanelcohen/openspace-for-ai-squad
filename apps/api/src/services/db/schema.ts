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
  status      TEXT NOT NULL DEFAULT 'pending',
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

-- Chat channels table (group conversations with a subset of agents)
CREATE TABLE IF NOT EXISTS chat_channels (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  description      TEXT NOT NULL DEFAULT '',
  member_agent_ids TEXT NOT NULL DEFAULT '[]',
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chat_channels_name ON chat_channels(name);

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

-- Auth users table
CREATE TABLE IF NOT EXISTS auth_users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'member',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_users_email ON auth_users(email);

-- Auth refresh tokens table (supports revocation & rotation)
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TEXT NOT NULL,
  revoked    INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_hash ON auth_refresh_tokens(token_hash);

-- Traces table — aggregated trace metadata for fast list/filter queries
CREATE TABLE IF NOT EXISTS traces (
  id                TEXT PRIMARY KEY,
  root_span_name    TEXT NOT NULL DEFAULT '',
  agent_name        TEXT,
  status            TEXT NOT NULL DEFAULT 'unset',
  start_time        INTEGER NOT NULL,
  end_time          INTEGER,
  duration_ms       INTEGER,
  span_count        INTEGER NOT NULL DEFAULT 0,
  total_tokens      INTEGER NOT NULL DEFAULT 0,
  prompt_tokens     INTEGER NOT NULL DEFAULT 0,
  completion_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd          REAL NOT NULL DEFAULT 0,
  error_message     TEXT,
  created_at        TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_traces_agent ON traces(agent_name);
CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status);
CREATE INDEX IF NOT EXISTS idx_traces_start_time ON traces(start_time);
CREATE INDEX IF NOT EXISTS idx_traces_duration ON traces(duration_ms);
CREATE INDEX IF NOT EXISTS idx_traces_cost ON traces(cost_usd);
CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at);

-- Spans table — individual spans belonging to traces
CREATE TABLE IF NOT EXISTS spans (
  id              TEXT PRIMARY KEY,
  trace_id        TEXT NOT NULL REFERENCES traces(id) ON DELETE CASCADE,
  parent_span_id  TEXT,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unset',
  start_time      INTEGER NOT NULL,
  end_time        INTEGER,
  duration_ms     INTEGER,
  attributes      TEXT NOT NULL DEFAULT '{}',
  events          TEXT NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS idx_spans_trace ON spans(trace_id);
CREATE INDEX IF NOT EXISTS idx_spans_parent ON spans(parent_span_id);
CREATE INDEX IF NOT EXISTS idx_spans_kind ON spans(kind);
CREATE INDEX IF NOT EXISTS idx_spans_start_time ON spans(start_time);

-- Metadata table for tracking sync state
CREATE TABLE IF NOT EXISTS _meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ── Agent Memory Tables ───────────────────────────────────────────

-- Memories table — stores extracted agent memories for cross-session recall
CREATE TABLE IF NOT EXISTS memories (
  id               TEXT PRIMARY KEY,
  agent_id         TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'decision',   -- 'preference' | 'pattern' | 'decision'
  content          TEXT NOT NULL,
  source_session   TEXT NOT NULL,
  source_task_id   TEXT,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  last_recalled_at TEXT,
  enabled          INTEGER NOT NULL DEFAULT 1,
  relevance_score  REAL NOT NULL DEFAULT 0.0,
  recall_count     INTEGER NOT NULL DEFAULT 0,
  strength         REAL NOT NULL DEFAULT 1.0,
  content_hash     TEXT
);

CREATE INDEX IF NOT EXISTS idx_memories_agent    ON memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_memories_type     ON memories(type);
CREATE INDEX IF NOT EXISTS idx_memories_enabled  ON memories(enabled);
CREATE INDEX IF NOT EXISTS idx_memories_strength ON memories(strength);
CREATE INDEX IF NOT EXISTS idx_memories_created  ON memories(created_at);

-- FTS5 for memory recall (full-text search over content)
CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
  id UNINDEXED,
  content,
  type,
  content='memories',
  content_rowid='rowid'
);

-- Triggers to keep memories FTS in sync
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
  INSERT INTO memories_fts(rowid, id, content, type)
  VALUES (new.rowid, new.id, new.content, new.type);
END;

CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, type)
  VALUES ('delete', old.rowid, old.id, old.content, old.type);
END;

CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
  INSERT INTO memories_fts(memories_fts, rowid, id, content, type)
  VALUES ('delete', old.rowid, old.id, old.content, old.type);
  INSERT INTO memories_fts(rowid, id, content, type)
  VALUES (new.rowid, new.id, new.content, new.type);
END;

-- ── Escalation / HITL Tables ──────────────────────────────────────

-- Escalation chains define the review path (agent → reviewer → admin)
CREATE TABLE IF NOT EXISTS escalation_chains (
  id    TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  data  TEXT NOT NULL DEFAULT '[]'   -- JSON array of EscalationChainLevel
);

-- Confidence thresholds per chain
CREATE TABLE IF NOT EXISTS escalation_thresholds (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  threshold        REAL    NOT NULL,
  escalation_level INTEGER NOT NULL,
  agent_roles      TEXT    NOT NULL DEFAULT '[]'  -- JSON array of role strings
);

-- Main escalation items (review queue)
CREATE TABLE IF NOT EXISTS escalations (
  id             TEXT    PRIMARY KEY,
  status         TEXT    NOT NULL DEFAULT 'pending',
  reason         TEXT    NOT NULL,
  priority       TEXT    NOT NULL DEFAULT 'medium',
  chain_id       TEXT    NOT NULL REFERENCES escalation_chains(id),
  current_level  INTEGER NOT NULL DEFAULT 1,
  context        TEXT    NOT NULL DEFAULT '{}',  -- JSON EscalationContext
  workflow_state TEXT,                            -- serialized workflow snapshot
  claimed_by     TEXT,
  claimed_at     TEXT,
  created_at     TEXT    NOT NULL,
  updated_at     TEXT    NOT NULL,
  timeout_at     TEXT    NOT NULL,
  review_comment TEXT
);

CREATE INDEX IF NOT EXISTS idx_escalations_status    ON escalations(status);
CREATE INDEX IF NOT EXISTS idx_escalations_priority  ON escalations(priority);
CREATE INDEX IF NOT EXISTS idx_escalations_chain     ON escalations(chain_id);
CREATE INDEX IF NOT EXISTS idx_escalations_claimed   ON escalations(claimed_by);
CREATE INDEX IF NOT EXISTS idx_escalations_timeout   ON escalations(timeout_at);
CREATE INDEX IF NOT EXISTS idx_escalations_created   ON escalations(created_at);

-- Audit trail for every escalation event
CREATE TABLE IF NOT EXISTS escalation_audit_trail (
  id               TEXT PRIMARY KEY,
  escalation_id    TEXT NOT NULL REFERENCES escalations(id) ON DELETE CASCADE,
  action           TEXT NOT NULL,
  actor            TEXT NOT NULL,
  timestamp        TEXT NOT NULL,
  details          TEXT,
  previous_status  TEXT,
  new_status       TEXT,
  snapshot_before  TEXT,   -- JSON snapshot of item before action
  snapshot_after   TEXT    -- JSON snapshot of item after action
);

CREATE INDEX IF NOT EXISTS idx_audit_escalation ON escalation_audit_trail(escalation_id);
CREATE INDEX IF NOT EXISTS idx_audit_action     ON escalation_audit_trail(action);
CREATE INDEX IF NOT EXISTS idx_audit_actor      ON escalation_audit_trail(actor);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp  ON escalation_audit_trail(timestamp);
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
