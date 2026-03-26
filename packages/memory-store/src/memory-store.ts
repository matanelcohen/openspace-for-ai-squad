/**
 * MemoryStoreService — the main entry point for the memory store package.
 *
 * Provides CRUD, embedding-based semantic search, hybrid FTS+vector search,
 * and memory lifecycle management (dedup, decay, expiration, importance).
 */

import type Database from 'better-sqlite3';

import type {
  Memory,
  MemoryConsolidationResult,
  MemoryCreateInput,
  MemorySearchRequest,
  MemorySearchResponse,
  MemorySearchResult,
  MemoryStoreStats,
  MemoryType,
  MemoryUpdateInput,
  MemoryWithMeta,
} from '@openspace/shared';

import type { Embedding, EmbeddingProvider } from './embedding.js';
import {
  bufferToEmbedding,
  cosineSimilarity,
  embeddingToBuffer,
} from './embedding.js';
import {
  applyDecay,
  boostDuplicate,
  calculateImportance,
  contentHash,
  type ConflictStrategy,
  type DecayConfig,
  DEFAULT_DECAY_CONFIG,
  expireMemories,
  findDuplicate,
} from './lifecycle.js';
import type {
  EmbeddingRow,
  FtsRecallRow,
  MemoryRow,
} from './storage.js';

// ── Configuration ──────────────────────────────────────────────────

export interface MemoryStoreConfig {
  /** Embedding provider for vector search. If null, only FTS search is available. */
  embeddingProvider?: EmbeddingProvider | null;
  /** Decay configuration for strength management. */
  decay?: DecayConfig;
  /** Default conflict resolution strategy. */
  conflictStrategy?: ConflictStrategy;
  /** Whether to auto-embed on create/update. Default: true */
  autoEmbed?: boolean;
}

const DEFAULT_CONFIG: Required<MemoryStoreConfig> = {
  embeddingProvider: null,
  decay: DEFAULT_DECAY_CONFIG,
  conflictStrategy: 'merge_boost',
  autoEmbed: true,
};

// ── Helpers ────────────────────────────────────────────────────────

function generateId(): string {
  return `mem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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

function rowToMemoryWithMeta(
  row: MemoryRow,
  tags: string[],
  hasEmbedding: boolean,
): MemoryWithMeta {
  return {
    ...rowToMemory(row),
    tags,
    importance: row.importance,
    expiresAt: row.expires_at,
    hasEmbedding,
  };
}

// ── MemoryStoreService ─────────────────────────────────────────────

export class MemoryStoreService {
  private readonly db: Database.Database;
  private readonly config: Required<MemoryStoreConfig>;

  constructor(db: Database.Database, config?: MemoryStoreConfig) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ── CRUD ─────────────────────────────────────────────────────────

  /**
   * Create a new memory. Handles deduplication — if identical content exists
   * for the same agent, the existing memory's strength is boosted instead.
   */
  async create(input: MemoryCreateInput): Promise<MemoryWithMeta> {
    const hash = contentHash(input.content);
    const now = new Date().toISOString();

    // Dedup check
    const existing = findDuplicate(this.db, input.agentId, hash);
    if (existing) {
      const newStrength = boostDuplicate(this.db, existing.id, existing.strength);
      const tags = this.getTags(existing.id);
      const hasEmbed = this.hasEmbedding(existing.id);
      return rowToMemoryWithMeta(
        { ...existing, strength: newStrength, updated_at: now },
        tags,
        hasEmbed,
      );
    }

    const id = generateId();
    const importance =
      input.importance ?? calculateImportance(input.content, input.type, !!input.sourceTaskId);
    const expiresAt = input.ttlSeconds
      ? new Date(Date.now() + input.ttlSeconds * 1000).toISOString()
      : null;

    this.db
      .prepare(
        `INSERT INTO memories (id, agent_id, type, content, source_session, source_task_id, created_at, updated_at, content_hash, importance, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.agentId,
        input.type,
        input.content,
        input.sourceSession,
        input.sourceTaskId ?? null,
        now,
        now,
        hash,
        importance,
        expiresAt,
      );

    // Tags
    if (input.tags?.length) {
      this.setTags(id, input.tags);
    }

    // Auto-embed
    if (this.config.autoEmbed && this.config.embeddingProvider) {
      await this.embedMemory(id, input.content);
    }

    const row = this.db
      .prepare<[string], MemoryRow>(`SELECT * FROM memories WHERE id = ?`)
      .get(id)!;

    return rowToMemoryWithMeta(row, input.tags ?? [], this.hasEmbedding(id));
  }

  /** Retrieve a single memory by ID, with full metadata. */
  getById(id: string): MemoryWithMeta | null {
    const row = this.db
      .prepare<[string], MemoryRow>(`SELECT * FROM memories WHERE id = ?`)
      .get(id);
    if (!row) return null;
    return rowToMemoryWithMeta(row, this.getTags(id), this.hasEmbedding(id));
  }

  /** List enabled memories for an agent, ordered by importance then strength. */
  list(agentId: string, limit = 50, offset = 0): MemoryWithMeta[] {
    const rows = this.db
      .prepare<[string, number, number], MemoryRow>(
        `SELECT * FROM memories WHERE agent_id = ? AND enabled = 1
         ORDER BY importance DESC, strength DESC LIMIT ? OFFSET ?`,
      )
      .all(agentId, limit, offset);

    return rows.map((row) =>
      rowToMemoryWithMeta(row, this.getTags(row.id), this.hasEmbedding(row.id)),
    );
  }

  /**
   * Update an existing memory. Triggers re-embedding if content changes.
   */
  async update(id: string, input: MemoryUpdateInput): Promise<MemoryWithMeta | null> {
    const existing = this.db
      .prepare<[string], MemoryRow>(`SELECT * FROM memories WHERE id = ?`)
      .get(id);
    if (!existing) return null;

    const now = new Date().toISOString();
    const updates: string[] = ['updated_at = ?'];
    const params: unknown[] = [now];

    if (input.content !== undefined) {
      updates.push('content = ?', 'content_hash = ?');
      params.push(input.content, contentHash(input.content));
    }
    if (input.type !== undefined) {
      updates.push('type = ?');
      params.push(input.type);
    }
    if (input.importance !== undefined) {
      updates.push('importance = ?');
      params.push(input.importance);
    }
    if (input.enabled !== undefined) {
      updates.push('enabled = ?');
      params.push(input.enabled ? 1 : 0);
    }

    params.push(id);
    this.db.prepare(`UPDATE memories SET ${updates.join(', ')} WHERE id = ?`).run(...params);

    // Update tags if provided
    if (input.tags !== undefined) {
      this.setTags(id, input.tags);
    }

    // Re-embed if content changed
    if (input.content !== undefined && this.config.autoEmbed && this.config.embeddingProvider) {
      await this.embedMemory(id, input.content);
    }

    return this.getById(id);
  }

  /** Soft-delete a memory (sets enabled = 0). */
  delete(id: string): boolean {
    const result = this.db
      .prepare(`UPDATE memories SET enabled = 0, updated_at = ? WHERE id = ? AND enabled = 1`)
      .run(new Date().toISOString(), id);
    return result.changes > 0;
  }

  /** Hard-delete a memory and its associated data. */
  hardDelete(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM memories WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  // ── Search ───────────────────────────────────────────────────────

  /**
   * Semantic + hybrid search over memories.
   *
   * If an embedding provider is configured, computes cosine similarity
   * against stored embeddings. Optionally combines with FTS5 text search.
   */
  async search(request: MemorySearchRequest): Promise<MemorySearchResponse> {
    const start = performance.now();
    const topK = request.topK ?? 10;
    const threshold = request.threshold ?? 0.25;
    const useHybrid = request.hybridSearch !== false;

    // Expire any stale memories first
    expireMemories(this.db);

    let vectorResults: Array<{ row: MemoryRow; similarity: number }> = [];
    let ftsResults: Array<{ row: MemoryRow; ftsRank: number }> = [];

    // Vector search
    if (this.config.embeddingProvider) {
      vectorResults = await this.vectorSearch(request, topK * 3);
    }

    // FTS search (hybrid)
    if (useHybrid) {
      ftsResults = this.ftsSearch(request, topK * 3);
    }

    // Merge results
    const merged = this.mergeResults(vectorResults, ftsResults, threshold, topK);

    const searchTimeMs = Math.round(performance.now() - start);

    // Count total searched
    const countQuery = request.agentId
      ? this.db
          .prepare<[string], { count: number }>(
            `SELECT COUNT(*) as count FROM memories WHERE agent_id = ? AND enabled = 1`,
          )
          .get(request.agentId)
      : this.db
          .prepare<[], { count: number }>(
            `SELECT COUNT(*) as count FROM memories WHERE enabled = 1`,
          )
          .get();

    return {
      results: merged,
      totalSearched: countQuery?.count ?? 0,
      searchTimeMs,
    };
  }

  // ── Lifecycle Operations ─────────────────────────────────────────

  /** Apply strength decay to all memories for an agent. */
  decay(agentId: string): { updated: number; archived: number } {
    return applyDecay(this.db, agentId, this.config.decay);
  }

  /** Run expiration check and disable expired memories. */
  expire(): number {
    return expireMemories(this.db);
  }

  /** Consolidate memories: decay + expire + archive weak ones. */
  consolidate(agentId: string, strengthThreshold = 0.1): MemoryConsolidationResult {
    const now = new Date().toISOString();

    // Apply decay first
    applyDecay(this.db, agentId, this.config.decay);

    // Expire
    expireMemories(this.db);

    // Archive weak memories
    const archiveResult = this.db
      .prepare(
        `UPDATE memories SET enabled = 0, updated_at = ? WHERE agent_id = ? AND enabled = 1 AND strength < ?`,
      )
      .run(now, agentId, strengthThreshold);

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

  /** Record that a memory was recalled. Updates stats + boosts strength. */
  recordRecall(memoryId: string, relevanceScore: number): void {
    const now = new Date().toISOString();
    this.db
      .prepare(
        `UPDATE memories
         SET last_recalled_at = ?,
             recall_count = recall_count + 1,
             relevance_score = ?,
             strength = MIN(1.0, strength + 0.05),
             updated_at = ?
         WHERE id = ?`,
      )
      .run(now, relevanceScore, now, memoryId);
  }

  /** Get store statistics. */
  stats(): MemoryStoreStats {
    const total = this.db
      .prepare<[], { count: number }>(`SELECT COUNT(*) as count FROM memories`)
      .get()!.count;

    const enabled = this.db
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) as count FROM memories WHERE enabled = 1`,
      )
      .get()!.count;

    const embedded = this.db
      .prepare<[], { count: number }>(
        `SELECT COUNT(*) as count FROM memory_embeddings`,
      )
      .get()!.count;

    const expired = this.db
      .prepare<[string], { count: number }>(
        `SELECT COUNT(*) as count FROM memories WHERE enabled = 1 AND expires_at IS NOT NULL AND expires_at <= ?`,
      )
      .get(new Date().toISOString())!.count;

    const byTypeRows = this.db
      .prepare<[], { type: string; count: number }>(
        `SELECT type, COUNT(*) as count FROM memories WHERE enabled = 1 GROUP BY type`,
      )
      .all();

    const byType: Record<MemoryType, number> = {
      preference: 0,
      pattern: 0,
      decision: 0,
    };
    for (const row of byTypeRows) {
      byType[row.type as MemoryType] = row.count;
    }

    const byAgentRows = this.db
      .prepare<[], { agent_id: string; count: number }>(
        `SELECT agent_id, COUNT(*) as count FROM memories WHERE enabled = 1 GROUP BY agent_id`,
      )
      .all();

    const byAgent: Record<string, number> = {};
    for (const row of byAgentRows) {
      byAgent[row.agent_id] = row.count;
    }

    return { totalMemories: total, enabledMemories: enabled, embeddedMemories: embedded, expiredMemories: expired, byType, byAgent };
  }

  // ── Embedding Management ─────────────────────────────────────────

  /** Generate and store an embedding for a specific memory. */
  async embedMemory(memoryId: string, content: string): Promise<void> {
    if (!this.config.embeddingProvider) return;

    const embedding = await this.config.embeddingProvider.embed(content);
    const buf = embeddingToBuffer(embedding);
    const now = new Date().toISOString();

    this.db
      .prepare(
        `INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding, dimensions, model, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(memoryId, buf, this.config.embeddingProvider.dimensions, this.config.embeddingProvider.modelId, now);
  }

  /**
   * Batch-embed all memories that lack embeddings.
   * Useful for backfilling after enabling an embedding provider.
   */
  async embedAll(batchSize = 50): Promise<number> {
    if (!this.config.embeddingProvider) return 0;

    const rows = this.db
      .prepare<[number], Pick<MemoryRow, 'id' | 'content'>>(
        `SELECT m.id, m.content FROM memories m
         LEFT JOIN memory_embeddings e ON m.id = e.memory_id
         WHERE m.enabled = 1 AND e.memory_id IS NULL
         LIMIT ?`,
      )
      .all(batchSize);

    if (rows.length === 0) return 0;

    const texts = rows.map((r) => r.content);
    const embeddings = await this.config.embeddingProvider.embedBatch(texts);
    const now = new Date().toISOString();

    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO memory_embeddings (memory_id, embedding, dimensions, model, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    );

    this.db.transaction(() => {
      for (let i = 0; i < rows.length; i++) {
        stmt.run(
          rows[i]!.id,
          embeddingToBuffer(embeddings[i]!),
          this.config.embeddingProvider!.dimensions,
          this.config.embeddingProvider!.modelId,
          now,
        );
      }
    })();

    return rows.length;
  }

  // ── Private ──────────────────────────────────────────────────────

  private async vectorSearch(
    request: MemorySearchRequest,
    limit: number,
  ): Promise<Array<{ row: MemoryRow; similarity: number }>> {
    if (!this.config.embeddingProvider) return [];

    const queryEmbedding = await this.config.embeddingProvider.embed(request.query);

    // Build the filter query
    const conditions: string[] = ['m.enabled = 1'];
    const params: unknown[] = [];

    if (request.agentId) {
      conditions.push('m.agent_id = ?');
      params.push(request.agentId);
    }
    if (request.types?.length) {
      conditions.push(`m.type IN (${request.types.map(() => '?').join(', ')})`);
      params.push(...request.types);
    }

    const sql = `
      SELECT m.*, e.embedding, e.dimensions
      FROM memories m
      JOIN memory_embeddings e ON m.id = e.memory_id
      WHERE ${conditions.join(' AND ')}
    `;

    const rows = this.db.prepare<unknown[], MemoryRow & { embedding: Buffer; dimensions: number }>(sql).all(...params);

    // Tag filter (post-query since tags are in a separate table)
    let filtered = rows;
    if (request.tags?.length) {
      const tagSet = new Set(request.tags);
      filtered = rows.filter((row) => {
        const memTags = this.getTags(row.id);
        return memTags.some((t) => tagSet.has(t));
      });
    }

    // Compute similarities
    const results = filtered
      .map((row) => {
        const storedEmbedding = bufferToEmbedding(row.embedding);
        const similarity = cosineSimilarity(queryEmbedding, storedEmbedding);
        return { row, similarity };
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    return results;
  }

  private ftsSearch(
    request: MemorySearchRequest,
    limit: number,
  ): Array<{ row: MemoryRow; ftsRank: number }> {
    // Sanitize query for FTS5
    const sanitized = request.query
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => `"${w}"`)
      .join(' OR ');

    if (!sanitized) return [];

    const conditions: string[] = ['m.enabled = 1'];
    const params: unknown[] = [sanitized];

    if (request.agentId) {
      conditions.push('m.agent_id = ?');
      params.push(request.agentId);
    }
    if (request.types?.length) {
      conditions.push(`m.type IN (${request.types.map(() => '?').join(', ')})`);
      params.push(...request.types);
    }

    params.push(limit);

    const sql = `
      SELECT m.*, fts.rank
      FROM memories_fts fts
      JOIN memories m ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ?
        AND ${conditions.join(' AND ')}
      ORDER BY fts.rank
      LIMIT ?
    `;

    const rows = this.db.prepare<unknown[], FtsRecallRow>(sql).all(...params);

    // Tag filter
    let filtered = rows;
    if (request.tags?.length) {
      const tagSet = new Set(request.tags);
      filtered = rows.filter((row) => {
        const memTags = this.getTags(row.id);
        return memTags.some((t) => tagSet.has(t));
      });
    }

    return filtered.map((row) => ({ row, ftsRank: row.rank }));
  }

  private mergeResults(
    vectorResults: Array<{ row: MemoryRow; similarity: number }>,
    ftsResults: Array<{ row: MemoryRow; ftsRank: number }>,
    threshold: number,
    topK: number,
  ): MemorySearchResult[] {
    const scoreMap = new Map<
      string,
      { row: MemoryRow; similarity: number; ftsScore: number | null }
    >();

    // Add vector results
    for (const { row, similarity } of vectorResults) {
      scoreMap.set(row.id, { row, similarity, ftsScore: null });
    }

    // Merge FTS results
    for (const { row, ftsRank } of ftsResults) {
      // Normalize FTS rank to 0–1 (rank is negative, lower = better)
      const normalizedFts = Math.min(1.0, 1.0 / (1.0 + Math.abs(ftsRank)));

      const existing = scoreMap.get(row.id);
      if (existing) {
        existing.ftsScore = normalizedFts;
      } else {
        scoreMap.set(row.id, { row, similarity: 0, ftsScore: normalizedFts });
      }
    }

    // Compute combined scores and filter
    const results: MemorySearchResult[] = [];

    for (const [, { row, similarity, ftsScore }] of scoreMap) {
      // Weighted combination: 60% vector, 25% FTS, 15% importance/strength
      const vectorWeight = similarity > 0 ? 0.6 : 0;
      const ftsWeight = ftsScore !== null ? 0.25 : 0;
      const metaWeight = 0.15;
      const totalWeight = vectorWeight + ftsWeight + metaWeight || 1;

      const combinedScore =
        (vectorWeight * similarity +
          ftsWeight * (ftsScore ?? 0) +
          metaWeight * (row.importance * 0.5 + row.strength * 0.5)) /
        totalWeight;

      if (combinedScore < threshold) continue;

      const tags = this.getTags(row.id);
      const hasEmbed = this.hasEmbedding(row.id);

      results.push({
        memory: rowToMemoryWithMeta(row, tags, hasEmbed),
        similarityScore: similarity,
        ftsScore,
        combinedScore,
      });
    }

    // Sort by combined score descending, take top K
    results.sort((a, b) => b.combinedScore - a.combinedScore);
    return results.slice(0, topK);
  }

  private getTags(memoryId: string): string[] {
    const rows = this.db
      .prepare<[string], { tag: string }>(
        `SELECT tag FROM memory_tags WHERE memory_id = ?`,
      )
      .all(memoryId);
    return rows.map((r) => r.tag);
  }

  private setTags(memoryId: string, tags: string[]): void {
    this.db.prepare(`DELETE FROM memory_tags WHERE memory_id = ?`).run(memoryId);
    const stmt = this.db.prepare(
      `INSERT INTO memory_tags (memory_id, tag) VALUES (?, ?)`,
    );
    for (const tag of tags) {
      stmt.run(memoryId, tag);
    }
  }

  private hasEmbedding(memoryId: string): boolean {
    const row = this.db
      .prepare<[string], { memory_id: string }>(
        `SELECT memory_id FROM memory_embeddings WHERE memory_id = ?`,
      )
      .get(memoryId);
    return !!row;
  }
}
