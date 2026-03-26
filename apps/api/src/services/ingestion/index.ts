/**
 * Ingestion pipeline — barrel export.
 *
 * Re-exports the pipeline, connectors, chunker, and state tracker.
 */

export { IngestionPipeline, type IngestionPipelineConfig, type IngestionResult, type PipelineStats } from './pipeline.js';
export { ChunkStore } from './chunk-store.js';
export { chunkContent, contentHash, estimateTokens, chunkId, type ChunkInput } from './chunker.js';
export { IngestionStateTracker } from './state.js';
export { migration_v3 } from './migration-v3.js';

// Connectors
export {
  GitCommitsConnector,
  PullRequestsConnector,
  DocsConnector,
  TasksConnector,
  type SourceConnector,
  type SourceDocument,
  type ConnectorOptions,
} from './connectors/index.js';
