/**
 * Database migration v4: Agent skill configurations.
 *
 * Adds:
 *   - agent_skill_configs: per-agent skill assignments with config, priority, and enabled state
 */

import type Database from 'better-sqlite3';

export function migration_v4(db: Database.Database): void {
  db.exec(`
    -- Per-agent skill configuration — stores {skillId, config, priority, enabled} per agent
    CREATE TABLE IF NOT EXISTS agent_skill_configs (
      agent_id    TEXT NOT NULL,
      skill_id    TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      priority    INTEGER NOT NULL DEFAULT 0,
      config      TEXT NOT NULL DEFAULT '{}',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL,
      PRIMARY KEY (agent_id, skill_id)
    );

    CREATE INDEX IF NOT EXISTS idx_agent_skill_configs_agent ON agent_skill_configs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_agent_skill_configs_skill ON agent_skill_configs(skill_id);
    CREATE INDEX IF NOT EXISTS idx_agent_skill_configs_priority ON agent_skill_configs(agent_id, priority);
  `);
}
