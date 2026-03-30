/**
 * Source connector interface — defines the contract for ingestion connectors.
 *
 * Each connector fetches raw content + metadata from a specific source type
 * (git commits, PRs, docs, tasks). The pipeline then chunks, embeds, and upserts.
 */

import type { ChunkMetadata, SourceType } from '@matanelcohen/openspace-shared';

/** A single document fetched from a source, ready for chunking. */
export interface SourceDocument {
  /** Unique identifier for this source item (commit SHA, PR number, file path, task ID). */
  sourceId: string;
  /** The source type category. */
  sourceType: SourceType;
  /** Raw text content to be chunked and embedded. */
  content: string;
  /** Partial metadata to attach to all chunks from this document. */
  metadata: Omit<ChunkMetadata, 'chunkIndex' | 'chunkTotal'>;
}

/** Options passed to connectors for controlling fetch behavior. */
export interface ConnectorOptions {
  /** Only fetch sources newer than this ISO-8601 timestamp. */
  since?: string;
  /** Maximum number of sources to fetch per run. */
  limit?: number;
}

/** Interface that all source connectors must implement. */
export interface SourceConnector {
  /** The source type this connector handles. */
  readonly sourceType: SourceType;

  /** Fetch source documents for ingestion. */
  fetchSources(options?: ConnectorOptions): Promise<SourceDocument[]>;
}
