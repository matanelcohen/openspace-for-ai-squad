/**
 * Database migration v5: Skill Gallery catalog tables.
 *
 * Adds:
 *   skill_gallery      — catalog of public/community skills for browse & install
 *   skill_gallery_fts  — FTS5 index for gallery search
 */

import type Database from 'better-sqlite3';

export const migration_v5 = (db: Database.Database): void => {
  db.exec(`
    -- Skill gallery catalog
    CREATE TABLE IF NOT EXISTS skill_gallery (
      id             TEXT PRIMARY KEY,
      name           TEXT NOT NULL,
      description    TEXT NOT NULL DEFAULT '',
      author         TEXT NOT NULL DEFAULT '',
      category       TEXT NOT NULL DEFAULT 'other',
      tags           TEXT NOT NULL DEFAULT '[]',
      icon           TEXT NOT NULL DEFAULT '🔧',
      version        TEXT NOT NULL DEFAULT '1.0.0',
      source_url     TEXT NOT NULL DEFAULT '',
      source_path    TEXT NOT NULL DEFAULT '',
      source_ref     TEXT NOT NULL DEFAULT 'main',
      install_count  INTEGER NOT NULL DEFAULT 0,
      featured       INTEGER NOT NULL DEFAULT 0,
      added_at       TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_skill_gallery_category ON skill_gallery(category);
    CREATE INDEX IF NOT EXISTS idx_skill_gallery_featured ON skill_gallery(featured);
    CREATE INDEX IF NOT EXISTS idx_skill_gallery_installs ON skill_gallery(install_count);
    CREATE INDEX IF NOT EXISTS idx_skill_gallery_added    ON skill_gallery(added_at);

    -- FTS5 for gallery search (name, description, tags, author)
    CREATE VIRTUAL TABLE IF NOT EXISTS skill_gallery_fts USING fts5(
      id UNINDEXED,
      name,
      description,
      tags,
      author,
      content='skill_gallery',
      content_rowid='rowid'
    );

    -- Triggers to keep FTS in sync
    CREATE TRIGGER IF NOT EXISTS skill_gallery_ai AFTER INSERT ON skill_gallery BEGIN
      INSERT INTO skill_gallery_fts(rowid, id, name, description, tags, author)
      VALUES (new.rowid, new.id, new.name, new.description, new.tags, new.author);
    END;

    CREATE TRIGGER IF NOT EXISTS skill_gallery_ad AFTER DELETE ON skill_gallery BEGIN
      INSERT INTO skill_gallery_fts(skill_gallery_fts, rowid, id, name, description, tags, author)
      VALUES ('delete', old.rowid, old.id, old.name, old.description, old.tags, old.author);
    END;

    CREATE TRIGGER IF NOT EXISTS skill_gallery_au AFTER UPDATE ON skill_gallery BEGIN
      INSERT INTO skill_gallery_fts(skill_gallery_fts, rowid, id, name, description, tags, author)
      VALUES ('delete', old.rowid, old.id, old.name, old.description, old.tags, old.author);
      INSERT INTO skill_gallery_fts(rowid, id, name, description, tags, author)
      VALUES (new.rowid, new.id, new.name, new.description, new.tags, new.author);
    END;
  `);
};
