/**
 * Memory lifecycle — deduplication, conflict resolution, decay, expiration,
 * and importance scoring.
 */

import { createHash } from 'node:crypto';

import type Database from 'better-sqlite3';

import type { MemoryRow } from './storage.js';

// ── Content Hashing ────────────────────────────────────────────────

/** SHA-256 hash of normalized content for deduplication. */
export function contentHash(content: string): string {
  return createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
}

// ── Importance Scoring ─────────────────────────────────────────────

export interface ImportanceFactors {
  /** Base importance from memory type (decision > pattern > preference). */
  typeWeight: number;
  /** Content length factor — very short or very long content scores lower. */
  lengthFactor: number;
  /** Whether the memory has a source task (grounded memories score higher). */
  hasSourceTask: boolean;
}

const TYPE_WEIGHTS: Record<string, number> = {
  decision: 0.7,
  pattern: 0.5,
  preference: 0.4,
};

/** Calculate an importance score (0–1) from content characteristics. */
export function calculateImportance(
  content: string,
  type: string,
  hasSourceTask: boolean,
): number {
  const typeWeight = TYPE_WEIGHTS[type] ?? 0.5;

  // Optimal length is 50–200 chars. Penalize extremes.
  const len = content.trim().length;
  let lengthFactor: number;
  if (len < 10) lengthFactor = 0.3;
  else if (len < 50) lengthFactor = 0.7;
  else if (len <= 200) lengthFactor = 1.0;
  else if (len <= 500) lengthFactor = 0.8;
  else lengthFactor = 0.6;

  const taskBonus = hasSourceTask ? 0.1 : 0;

  return Math.min(1.0, typeWeight * 0.5 + lengthFactor * 0.4 + taskBonus);
}

// ── Strength Decay ─────────────────────────────────────────────────

export interface DecayConfig {
  /** Half-life in days. Default: 90 */
  halfLifeDays: number;
  /** Minimum strength before a memory is considered for archival. Default: 0.05 */
  archiveThreshold: number;
}

export const DEFAULT_DECAY_CONFIG: DecayConfig = {
  halfLifeDays: 90,
  archiveThreshold: 0.05,
};

/**
 * Compute the decay factor for a given number of elapsed days.
 * Uses exponential decay: factor = 2^(-days / halfLife)
 */
export function decayFactor(elapsedDays: number, halfLifeDays: number): number {
  return Math.pow(2, -elapsedDays / halfLifeDays);
}

/**
 * Apply time-based strength decay to all enabled memories for an agent.
 * Returns the number of memories updated.
 */
export function applyDecay(
  db: Database.Database,
  agentId: string,
  config: DecayConfig = DEFAULT_DECAY_CONFIG,
): { updated: number; archived: number } {
  const now = new Date();
  const nowIso = now.toISOString();

  // Get all enabled memories for the agent
  const rows = db
    .prepare<[string], Pick<MemoryRow, 'id' | 'updated_at' | 'strength'>>(
      `SELECT id, updated_at, strength FROM memories WHERE agent_id = ? AND enabled = 1`,
    )
    .all(agentId);

  let updated = 0;
  let archived = 0;

  const updateStmt = db.prepare(
    `UPDATE memories SET strength = ?, updated_at = ? WHERE id = ?`,
  );
  const archiveStmt = db.prepare(
    `UPDATE memories SET enabled = 0, updated_at = ? WHERE id = ?`,
  );

  db.transaction(() => {
    for (const row of rows) {
      const lastUpdate = new Date(row.updated_at);
      const daysSince = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);

      if (daysSince < 0.01) continue; // Skip very recent updates

      const factor = decayFactor(daysSince, config.halfLifeDays);
      const newStrength = row.strength * factor;

      if (newStrength < config.archiveThreshold) {
        archiveStmt.run(nowIso, row.id);
        archived++;
      } else {
        updateStmt.run(newStrength, nowIso, row.id);
        updated++;
      }
    }
  })();

  return { updated, archived };
}

// ── Expiration ─────────────────────────────────────────────────────

/**
 * Disable all memories whose expires_at has passed.
 * Returns the number of expired memories disabled.
 */
export function expireMemories(db: Database.Database): number {
  const now = new Date().toISOString();
  const result = db
    .prepare(
      `UPDATE memories SET enabled = 0, updated_at = ? WHERE enabled = 1 AND expires_at IS NOT NULL AND expires_at <= ?`,
    )
    .run(now, now);
  return result.changes;
}

// ── Deduplication ──────────────────────────────────────────────────

/**
 * Find an existing memory with the same content hash for the given agent.
 * Returns the existing row or null.
 */
export function findDuplicate(
  db: Database.Database,
  agentId: string,
  hash: string,
): MemoryRow | null {
  return (
    db
      .prepare<[string, string], MemoryRow>(
        `SELECT * FROM memories WHERE agent_id = ? AND content_hash = ? AND enabled = 1`,
      )
      .get(agentId, hash) ?? null
  );
}

/**
 * Boost an existing memory's strength when a duplicate is detected.
 * Returns the updated strength.
 */
export function boostDuplicate(
  db: Database.Database,
  memoryId: string,
  currentStrength: number,
): number {
  const newStrength = Math.min(1.0, currentStrength + 0.2);
  db.prepare(`UPDATE memories SET strength = ?, updated_at = ? WHERE id = ?`).run(
    newStrength,
    new Date().toISOString(),
    memoryId,
  );
  return newStrength;
}

// ── Conflict Resolution ────────────────────────────────────────────

export type ConflictStrategy = 'keep_existing' | 'keep_newer' | 'merge_boost';

/**
 * Resolve a conflict when a new memory partially overlaps an existing one.
 * Default strategy: merge_boost (keep existing, boost its strength).
 */
export function resolveConflict(
  db: Database.Database,
  existingId: string,
  existingStrength: number,
  _newContent: string,
  strategy: ConflictStrategy = 'merge_boost',
): { action: 'kept_existing' | 'replaced' | 'boosted'; memoryId: string } {
  switch (strategy) {
    case 'keep_existing':
      return { action: 'kept_existing', memoryId: existingId };
    case 'keep_newer':
      // Caller handles insert; we just disable the old one
      db.prepare(`UPDATE memories SET enabled = 0, updated_at = ? WHERE id = ?`).run(
        new Date().toISOString(),
        existingId,
      );
      return { action: 'replaced', memoryId: existingId };
    case 'merge_boost':
    default: {
      boostDuplicate(db, existingId, existingStrength);
      return { action: 'boosted', memoryId: existingId };
    }
  }
}
