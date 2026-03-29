/**
 * Ingestion pipeline — barrel export.
 *
 * Re-exports the pipeline, connectors, chunker, and state tracker.
 */

export { ChunkStore } from './chunk-store.js';
export { chunkContent, chunkId, type ChunkInput,contentHash, estimateTokens } from './chunker.js';
export { migration_v3 } from './migration-v3.js';
export { IngestionPipeline, type IngestionPipelineConfig, type IngestionResult, type PipelineStats } from './pipeline.js';
export { IngestionStateTracker } from './state.js';

// Connectors
export {
  type ConnectorOptions,
  DocsConnector,
  GitCommitsConnector,
  PullRequestsConnector,
  type SourceConnector,
  type SourceDocument,
  TasksConnector,
} from './connectors/index.js';
