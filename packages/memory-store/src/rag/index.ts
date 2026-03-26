/**
 * RAG pipeline — public API.
 */
export type { ChunkInput } from './chunker.js';
export {
  chunkId,
  chunkText,
  DEFAULT_CHUNKING_CONFIG,
  estimateTokens,
  extractHeadingPath,
} from './chunker.js';
export type { CommitData, DocData, PullRequestData, TaskData } from './connectors.js';
export {
  ingestCommit,
  ingestDoc,
  ingestPullRequest,
  ingestTask,
  splitDiffByFile,
} from './connectors.js';
export type { RAGServiceConfig } from './rag-service.js';
export { RAGServiceImpl } from './rag-service.js';
export { SQLiteVectorStore } from './vector-store.js';
