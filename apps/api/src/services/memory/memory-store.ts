/**
 * MemoryStore — SQLite-backed CRUD for the `memories` table.
 *
 * Provides create, read, update, and FTS5-powered recall for agent memories.
 * Handles content-hash deduplication and strength decay.
 */

import { createHash } from 'node:crypto';

import type { Memory, MemoryConsolidationResult, MemoryType } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

// ── Types ────────────────────────────────────────────────────────

export interface CreateMemoryInput {
  agentId: string;
  type: MemoryType;
  content: string;
  sourceSession: string;
  sourceTaskId?: string | null;
}

export interface MemoryRow {
  id: string;
  agent_id: string;
  type: string;
  content: string;
  source_session: string;
  source_task_id: string | null;
  created_at: string;
  updated_at: string;
  last_recalled_at: string | null;
  enabled: number;
  relevance_score: number;
  recall_count: number;
  strength: number;
  content_hash: string | null;
}

export interface FtsRecallRow extends MemoryRow {
  rank: number;
}

// ── Helpers ──────────────────────────────────────────────────────

function contentHash(content: string): string {
  return createHash('sha256').update(content.trim().toLowerCase()).digest('hex');
}

function rowToMemory(row: MemoryRow): Memory {
  return {
    id: row.id,
    agentId: row.agent_id,
    type: row.type as MemoryType,
    content: row.content,
    sourceSession: row.source_session,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastRecalledAt: row.last_recalled_at,
    enabled: row.enabled === 1,
    embeddingId: null,
    relevanceScore: row.relevance_score,
    recallCount: row.recall_count,
    strength: row.strength,
    sourceChunkIds: [],
    contentHash: row.content_hash,
  };
}

function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── MemoryStore ─────────────────────────────────────────────────

export class MemoryStore {
  constructor(private readonly db: Database.Database) {}

  /**
   * Create a new memory. Deduplicates by content hash — if an identical
   * memory already exists for the same agent, its strength is boosted instead.
   */
  create(input: CreateMemoryInput): Memory {
    const hash = contentHash(input.content);
    const now = new Date().toISOString();

    // Dedup check: same agent + same content hash
    const existing = this.db
      .prepare<[string, string], MemoryRow>(
        `SELECT * FROM memories WHERE agent_id = ? AND content_hash = ? AND enabled = 1`,
      )
      .get(input.agentId, hash);

    if (existing) {
      // Boost strength of existing memory instead of creating a duplicate
      const newStrength = Math.min(1.0, existing.strength + 0.2);
      this.db
        .prepare(`UPDATE memories SET strength = ?, updated_at = ? WHERE id = ?`)
        .run(newStrength, now, existing.id);
      return rowToMemory({ ...existing, strength: newStrength, updated_at: now });
    }

    const id = generateId();
    this.db
      .prepare(
        `INSERT INTO memories (id, agent_id, type, content, source_session, source_task_id, created_at, updated_at, content_hash)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(id, input.agentId, input.type, input.content, input.sourceSession, input.sourceTaskId ?? null, now, now, hash);

    return rowToMemory(
      this.db.prepare<[string], MemoryRow>(`SELECT * FROM memories WHERE id = ?`).get(id)!,
    );
  }

  /** Retrieve a single memory by ID. */
  getById(id: string): Memory | null {
    const row = this.db
      .prepare<[string], MemoryRow>(`SELECT * FROM memories WHERE id = ?`)
      .get(id);
    return row ? rowToMemory(row) : null;
  }

  /** List all enabled memories for an agent, ordered by strength descending. */
  listByAgent(agentId: string, limit = 50): Memory[] {
    const rows = this.db
      .prepare<[string, number], MemoryRow>(
        `SELECT * FROM memories WHERE agent_id = ? AND enabled = 1 ORDER BY strength DESC LIMIT ?`,
      )
      .all(agentId, limit);
    return rows.map(rowToMemory);
  }

  /**
   * Full-text search recall using FTS5.
   * Returns memories ranked by FTS relevance, filtered to enabled memories for the agent.
   */
  recallByFts(agentId: string, query: string, limit = 10): Array<{ memory: Memory; ftsRank: number }> {
    // Sanitize query for FTS5 — wrap each word in quotes to avoid syntax errors
    const sanitized = query
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `"${w}"`)
      .join(' OR ');

    if (!sanitized) return [];

    const rows = this.db
      .prepare<[string, string, number], FtsRecallRow>(
        `SELECT m.*, fts.rank
         FROM memories_fts fts
         JOIN memories m ON m.rowid = fts.rowid
         WHERE memories_fts MATCH ?
           AND m.agent_id = ?
           AND m.enabled = 1
         ORDER BY fts.rank
         LIMIT ?`,
      )
      .all(sanitized, agentId, limit);

    return rows.map((row) => ({
      memory: rowToMemory(row),
      ftsRank: row.rank,
    }));
  }

  /** Record that a memory was recalled (updates stats). */
  recordRecall(memoryId: string, relevanceScore: number): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE memories
         SET last_recalled_at = ?,
             recall_count = recall_count + 1,
             relevance_score = ?,
             updated_at = ?
         WHERE id = ?`,
      )
      .run(now, relevanceScore, now, memoryId);
  }

  /** Apply strength decay to all memories for an agent. */
  decayStrength(agentId: string, decayFactor: number): number {
    const result = this.db
      .prepare(
        `UPDATE memories SET strength = strength * ?, updated_at = ? WHERE agent_id = ? AND enabled = 1`,
      )
      .run(decayFactor, new Date().toISOString(), agentId);
    return result.changes;
  }

  /**
   * Consolidate memories for an agent:
   * - Archive memories with strength below threshold
   * - Return stats
   */
  consolidate(agentId: string, strengthThreshold = 0.1): MemoryConsolidationResult {
    const now = new Date().toISOString();

    // Archive weak memories
    const archiveResult = this.db
      .prepare(
        `UPDATE memories SET enabled = 0, updated_at = ? WHERE agent_id = ? AND enabled = 1 AND strength < ?`,
      )
      .run(now, agentId, strengthThreshold);

    // Count remaining
    const remaining = this.db
      .prepare<[string], { count: number }>(
        `SELECT COUNT(*) as count FROM memories WHERE agent_id = ? AND enabled = 1`,
      )
      .get(agentId);

    return {
      merged: 0,
      archived: archiveResult.changes,
      remaining: remaining?.count ?? 0,
    };
  }

  /** Disable a specific memory. */
  disable(memoryId: string): void {
    this.db
      .prepare(`UPDATE memories SET enabled = 0, updated_at = ? WHERE id = ?`)
      .run(new Date().toISOString(), memoryId);
  }
}
