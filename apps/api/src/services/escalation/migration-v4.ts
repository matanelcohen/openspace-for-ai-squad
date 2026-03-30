/**
 * Database migration v4: SLA tracking + notifications tables.
 *
 * Adds:
 *   - escalations.sla_deadline_at column — computed from chain level timeout
 *   - notifications table — reviewer notification persistence
 */

import type Database from 'better-sqlite3';

export function migration_v4(db: Database.Database): void {
  // Add sla_deadline_at to escalations (same as timeout_at initially — can diverge)
  const columns = db.prepare('PRAGMA table_info(escalations)').all() as Array<{ name: string }>;
  const columnNames = new Set(columns.map((c) => c.name));

  if (!columnNames.has('sla_deadline_at')) {
    db.exec(`ALTER TABLE escalations ADD COLUMN sla_deadline_at TEXT;`);
    // Back-fill from timeout_at for existing rows
    db.exec(`UPDATE escalations SET sla_deadline_at = timeout_at WHERE sla_deadline_at IS NULL;`);
  }

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_escalations_sla ON escalations(sla_deadline_at);

    -- Notifications table — persists reviewer notifications
    CREATE TABLE IF NOT EXISTS notifications (
      id             TEXT PRIMARY KEY,
      reviewer_id    TEXT NOT NULL,
      type           TEXT NOT NULL DEFAULT 'escalation_eligible',
      title          TEXT NOT NULL,
      message        TEXT NOT NULL DEFAULT '',
      escalation_id  TEXT REFERENCES escalations(id) ON DELETE CASCADE,
      is_read        INTEGER NOT NULL DEFAULT 0,
      created_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_notifications_reviewer ON notifications(reviewer_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
    CREATE INDEX IF NOT EXISTS idx_notifications_escalation ON notifications(escalation_id);
  `);
}
