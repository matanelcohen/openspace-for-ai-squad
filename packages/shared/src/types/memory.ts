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

/** A memory returned from a recall query, with relevance metadata. */
export interface MemoryRecallResult {
  /** The memory entry. */
  memory: Memory;
  /** Combined relevance score (FTS rank + strength + recency). */
  score: number;
  /** Whether this memory passed the relevance threshold. */
  passedFilter: boolean;
}

/** Attribution record: which memories influenced an agent's decisions. */
export interface MemoryAttribution {
  /** ID of the memory that was used. */
  memoryId: string;
  /** Short description of how this memory influenced the output. */
  influence: string;
}

/** Input to the memory extraction step after a task completes. */
export interface MemoryExtractionInput {
  /** The agent that executed the task. */
  agentId: string;
  /** The task ID. */
  taskId: string;
  /** The task title. */
  taskTitle: string;
  /** The task description (original). */
  taskDescription: string;
  /** The agent's output/result text. */
  resultContent: string;
  /** Progress log entries from execution. */
  progressLog: string[];
}

/** A single extracted memory from an LLM extraction step. */
export interface ExtractedMemory {
  /** Category of the memory. */
  type: MemoryType;
  /** Human-readable content of the memory. */
  content: string;
}

// ── Memory Store Service Types ──────────────────────────────────

/** Input for creating a new memory via the API. */
export interface MemoryCreateInput {
  /** The agent this memory belongs to. */
  agentId: string;
  /** Category of the memory. */
  type: MemoryType;
  /** Human-readable content of the memory. */
  content: string;
  /** The session ID where this memory originated. */
  sourceSession: string;
  /** Optional task ID that produced this memory. */
  sourceTaskId?: string | null;
  /** Optional tags for categorization. */
  tags?: string[];
  /** Optional importance score override (0–1, default auto-calculated). */
  importance?: number;
  /** Optional TTL in seconds. Memory expires after this duration. */
  ttlSeconds?: number | null;
}

/** Input for updating an existing memory. */
export interface MemoryUpdateInput {
  /** Updated content (triggers re-embedding). */
  content?: string;
  /** Updated type. */
  type?: MemoryType;
  /** Updated tags. */
  tags?: string[];
  /** Updated importance score (0–1). */
  importance?: number;
  /** Enable or disable the memory. */
  enabled?: boolean;
}

/** Request for semantic memory search. */
export interface MemorySearchRequest {
  /** Natural language query for semantic search. */
  query: string;
  /** Scope search to a specific agent. */
  agentId?: string;
  /** Filter by memory types. */
  types?: MemoryType[];
  /** Filter by tags (any match). */
  tags?: string[];
  /** Maximum number of results (default: 10). */
  topK?: number;
  /** Minimum similarity threshold (0–1, default: 0.25). */
  threshold?: number;
  /** Whether to include FTS5 hybrid search (default: true). */
  hybridSearch?: boolean;
}

/** A single result from semantic memory search. */
export interface MemorySearchResult {
  /** The memory entry. */
  memory: Memory;
  /** Cosine similarity score (0–1). */
  similarityScore: number;
  /** FTS rank score if hybrid search was used, null otherwise. */
  ftsScore: number | null;
  /** Final combined score used for ranking. */
  combinedScore: number;
}

/** Response from the memory search API. */
export interface MemorySearchResponse {
  /** Matching memories ordered by relevance. */
  results: MemorySearchResult[];
  /** Total number of memories searched. */
  totalSearched: number;
  /** Search latency in milliseconds. */
  searchTimeMs: number;
}

/** Memory with extended metadata for the API layer. */
export interface MemoryWithMeta extends Memory {
  /** Tags for categorization. */
  tags: string[];
  /** Importance score (0–1). Higher = more important. */
  importance: number;
  /** ISO date when this memory expires, or null if no expiration. */
  expiresAt: string | null;
  /** Whether an embedding vector exists for this memory. */
  hasEmbedding: boolean;
}

/** Statistics about the memory store. */
export interface MemoryStoreStats {
  /** Total number of memories. */
  totalMemories: number;
  /** Number of enabled memories. */
  enabledMemories: number;
  /** Number of memories with embeddings. */
  embeddedMemories: number;
  /** Number of expired memories. */
  expiredMemories: number;
  /** Counts per memory type. */
  byType: Record<MemoryType, number>;
  /** Counts per agent. */
  byAgent: Record<string, number>;
}
