/**
 * MemoryRecallEngine — retrieves and scores relevant memories for a given context.
 *
 * Combines FTS5 search with strength/recency scoring and threshold filtering.
 * Provides memory attribution for transparency.
 */

import type { MemoryAttribution, MemoryRecallResult } from '@openspace/shared';

import type { MemoryStore } from './memory-store.js';

// ── Configuration ────────────────────────────────────────────────

export interface RecallConfig {
  /** Maximum number of memories to return. Default: 5 */
  maxMemories?: number;
  /** Minimum combined score to pass the relevance filter. Default: 0.3 */
  relevanceThreshold?: number;
  /** Weight for FTS rank in combined score. Default: 0.5 */
  ftsWeight?: number;
  /** Weight for memory strength in combined score. Default: 0.3 */
  strengthWeight?: number;
  /** Weight for recency in combined score. Default: 0.2 */
  recencyWeight?: number;
}

const DEFAULT_CONFIG: Required<RecallConfig> = {
  maxMemories: 5,
  relevanceThreshold: 0.3,
  ftsWeight: 0.5,
  strengthWeight: 0.3,
  recencyWeight: 0.2,
};

// ── MemoryRecallEngine ──────────────────────────────────────────

export class MemoryRecallEngine {
  private readonly store: MemoryStore;
  private readonly config: Required<RecallConfig>;

  constructor(store: MemoryStore, config?: RecallConfig) {
    this.store = store;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Recall relevant memories for a given agent + context query.
   *
   * Returns scored and filtered memories, plus updates recall stats
   * on memories that pass the relevance threshold.
   */
  recall(agentId: string, query: string): MemoryRecallResult[] {
    // Cast a wider net from FTS, then score and filter
    const ftsResults = this.store.recallByFts(agentId, query, this.config.maxMemories * 3);

    if (ftsResults.length === 0) return [];

    const now = Date.now();

    const scored: MemoryRecallResult[] = ftsResults.map(({ memory, ftsRank }) => {
      // Normalize FTS rank (SQLite FTS5 rank is negative, lower = better match)
      // Convert to 0-1 scale where 1 is best
      const normalizedFts = Math.min(1.0, 1.0 / (1.0 + Math.abs(ftsRank)));

      // Recency score: 1.0 for today, decays over 90 days
      const lastUsed = memory.lastRecalledAt
        ? new Date(memory.lastRecalledAt).getTime()
        : new Date(memory.createdAt).getTime();
      const daysSinceUse = (now - lastUsed) / (1000 * 60 * 60 * 24);
      const recencyScore = Math.exp(-daysSinceUse / 90);

      // Combined score
      const score =
        this.config.ftsWeight * normalizedFts +
        this.config.strengthWeight * memory.strength +
        this.config.recencyWeight * recencyScore;

      const passedFilter = score >= this.config.relevanceThreshold;

      return { memory, score, passedFilter };
    });

    // Sort by score descending, take top N that passed filter
    const results = scored
      .filter((r) => r.passedFilter)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.maxMemories);

    // Update recall stats for memories that were returned
    for (const result of results) {
      this.store.recordRecall(result.memory.id, result.score);
    }

    return results;
  }

  /**
   * Build a memory context string suitable for injection into a system prompt.
   * Returns null if no relevant memories were found.
   */
  buildContextBlock(recallResults: MemoryRecallResult[]): string | null {
    if (recallResults.length === 0) return null;

    const lines = recallResults.map((r, i) => {
      const tag = r.memory.type.toUpperCase();
      return `[M${i + 1}:${tag}] ${r.memory.content}`;
    });

    return [
      'Relevant memories from past sessions (reference as [M1], [M2], etc.):',
      ...lines,
    ].join('\n');
  }

  /**
   * Extract attribution records from recall results.
   * These can be stored alongside the task result for transparency.
   */
  buildAttributions(recallResults: MemoryRecallResult[]): MemoryAttribution[] {
    return recallResults.map((r, i) => ({
      memoryId: r.memory.id,
      influence: `[M${i + 1}:${r.memory.type.toUpperCase()}] ${r.memory.content.substring(0, 100)}`,
    }));
  }
}
