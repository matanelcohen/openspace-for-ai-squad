/**
 * Memory types — represents stored agent memories.
 *
 * Extended with RAG-aware fields for embedding, recall scoring,
 * strength decay, and provenance tracking.
 */

/** Categories of agent memory. */
export type MemoryType = 'preference' | 'pattern' | 'decision';

/** A single stored memory entry for an agent. */
export interface Memory {
  /** Unique identifier. */
  id: string;
  /** The agent this memory belongs to. */
  agentId: string;
  /** Category of the memory. */
  type: MemoryType;
  /** Human-readable summary of the memory. */
  content: string;
  /** The session ID where this memory originated. */
  sourceSession: string;
  /** ISO date when the memory was created. */
  createdAt: string;
  /** ISO date when the memory was last updated. */
  updatedAt: string;
  /** ISO date when this memory was last recalled/used, if ever. */
  lastRecalledAt: string | null;
  /** Whether this memory is currently enabled. */
  enabled: boolean;

  // ── RAG Integration Fields ────────────────────────────────────

  /** ID of the corresponding RAG chunk (null if not yet embedded). */
  embeddingId: string | null;
  /** Relevance score from the most recent recall (0–1). */
  relevanceScore: number;
  /** Number of times this memory has been recalled via RAG search. */
  recallCount: number;
  /**
   * Strength factor (0–1, 1 = full strength).
   * Decays over time when the memory is not recalled.
   * Half-life is configurable (default: 90 days).
   */
  strength: number;
  /** IDs of source RAG chunks that informed this memory (provenance). */
  sourceChunkIds: string[];
  /** SHA-256 hash of content for similarity deduplication. */
  contentHash: string | null;
}

/** Settings controlling memory for a specific agent or globally. */
export interface MemorySettings {
  /** Whether memory is enabled globally. */
  globalEnabled: boolean;
  /** Per-agent memory enabled state. Key is agentId. */
  agentEnabled: Record<string, boolean>;
}

/** Result of a memory consolidation operation. */
export interface MemoryConsolidationResult {
  /** Number of memories merged with similar ones. */
  merged: number;
  /** Number of weak memories archived (strength below threshold). */
  archived: number;
  /** Number of active memories remaining. */
  remaining: number;
}
