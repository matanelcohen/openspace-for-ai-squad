/**
 * @matanelcohen/openspace-memory-store — embedding-based memory storage and retrieval.
 *
 * Provides a complete memory store with:
 * - CRUD operations with automatic deduplication
 * - Embedding pipeline with pluggable providers
 * - Hybrid search (vector similarity + FTS5 full-text)
 * - Memory lifecycle (decay, expiration, importance scoring)
 * - SQLite storage with schema management
 */

// Core service
export { MemoryStoreService } from './memory-store.js';
export type { MemoryStoreConfig } from './memory-store.js';

// Embedding
export { bufferToEmbedding, cosineSimilarity, embeddingToBuffer } from './embedding.js';
export type { Embedding, EmbeddingProvider } from './embedding.js';

// Lifecycle
export {
  applyDecay,
  boostDuplicate,
  calculateImportance,
  contentHash,
  decayFactor,
  DEFAULT_DECAY_CONFIG,
  expireMemories,
  findDuplicate,
  resolveConflict,
} from './lifecycle.js';
export type { ConflictStrategy, DecayConfig, ImportanceFactors } from './lifecycle.js';

// Storage
export {
  hasEmbeddingSupport,
  hasMemorySchema,
  initializeMemorySchema,
  MEMORY_STORE_SCHEMA_VERSION,
} from './storage.js';
export type { EmbeddingRow, FtsRecallRow, MemoryRow } from './storage.js';
