/**
 * Ingestion Pipeline — orchestrates the full ingest → chunk → embed → store flow.
 *
 * Coordinates source connectors, the content chunker, the embedding provider,
 * the chunk store, and the ingestion state tracker to perform incremental
 * ingestion of project history into the RAG vector store.
 */

import type { ChunkingConfig, Embedder, SourceType } from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

import { ChunkStore } from './chunk-store.js';
import { chunkContent, contentHash } from './chunker.js';
import type { ConnectorOptions, SourceConnector, SourceDocument } from './connectors/types.js';
import { IngestionStateTracker } from './state.js';

// ── Types ──────────────────────────────────────────────────────────

export interface IngestionResult {
  /** Source type that was ingested. */
  sourceType: SourceType;
  /** Total source documents processed (not skipped). */
  documentsProcessed: number;
  /** Total documents skipped (unchanged). */
  documentsSkipped: number;
  /** Total chunks created/updated. */
  chunksCreated: number;
  /** Total chunks from deleted/replaced sources. */
  chunksDeleted: number;
  /** Time taken in milliseconds. */
  timeMs: number;
  /** Errors encountered (non-fatal). */
  errors: string[];
}

export interface PipelineStats {
  /** Total chunks in the store. */
  totalChunks: number;
  /** Chunks by source type. */
  chunksBySourceType: Record<string, number>;
  /** Total ingested sources. */
  totalSources: number;
  /** Sources by type. */
  sourcesByType: Record<string, number>;
}

export interface IngestionPipelineConfig {
  /** SQLite database instance. */
  db: Database.Database;
  /** Embedder for generating vectors (optional — chunks stored without embeddings if absent). */
  embedder?: Embedder;
  /** Chunking configuration overrides. */
  chunking?: Partial<ChunkingConfig>;
  /** Batch size for embedding API calls. Default: 50. */
  embeddingBatchSize?: number;
}

// ── Pipeline ───────────────────────────────────────────────────────

export class IngestionPipeline {
  private readonly stateTracker: IngestionStateTracker;
  private readonly chunkStore: ChunkStore;
  private readonly connectors: Map<SourceType, SourceConnector> = new Map();
  private readonly embedder?: Embedder;
  private readonly chunkingConfig?: Partial<ChunkingConfig>;
  private readonly embeddingBatchSize: number;

  constructor(config: IngestionPipelineConfig) {
    this.stateTracker = new IngestionStateTracker(config.db);
    this.chunkStore = new ChunkStore(config.db);
    this.embedder = config.embedder;
    this.chunkingConfig = config.chunking;
    this.embeddingBatchSize = config.embeddingBatchSize ?? 50;
  }

  /** Register a source connector. */
  registerConnector(connector: SourceConnector): void {
    this.connectors.set(connector.sourceType, connector);
  }

  /** Get all registered source types. */
  getRegisteredSourceTypes(): SourceType[] {
    return [...this.connectors.keys()];
  }

  /**
   * Run ingestion for a specific source type.
   * Fetches sources, checks for changes, chunks, optionally embeds, and stores.
   */
  async ingestSourceType(
    sourceType: SourceType,
    options?: ConnectorOptions,
  ): Promise<IngestionResult> {
    const start = Date.now();
    const result: IngestionResult = {
      sourceType,
      documentsProcessed: 0,
      documentsSkipped: 0,
      chunksCreated: 0,
      chunksDeleted: 0,
      timeMs: 0,
      errors: [],
    };

    const connector = this.connectors.get(sourceType);
    if (!connector) {
      result.errors.push(`No connector registered for source type: ${sourceType}`);
      result.timeMs = Date.now() - start;
      return result;
    }

    let documents: SourceDocument[];
    try {
      documents = await connector.fetchSources(options);
    } catch (err) {
      result.errors.push(`Fetch failed: ${err instanceof Error ? err.message : String(err)}`);
      result.timeMs = Date.now() - start;
      return result;
    }

    for (const doc of documents) {
      try {
        const hash = contentHash(doc.content);

        // Incremental sync: skip unchanged documents
        if (!this.stateTracker.hasChanged(doc.sourceType, doc.sourceId, hash)) {
          result.documentsSkipped++;
          continue;
        }

        // Delete previous chunks for this source
        const deleted = this.chunkStore.deleteBySource(doc.sourceType, doc.sourceId);
        result.chunksDeleted += deleted;

        // Chunk the content
        const chunks = chunkContent(
          {
            sourceId: doc.sourceId,
            content: doc.content,
            metadata: doc.metadata,
          },
          this.chunkingConfig,
        );

        if (chunks.length === 0) continue;

        // Embed if provider is available
        if (this.embedder) {
          const embeddedChunks = await this.embedBatch(chunks);
          this.chunkStore.upsertEmbeddedChunks(embeddedChunks);
        } else {
          this.chunkStore.upsertChunks(chunks);
        }

        result.chunksCreated += chunks.length;
        result.documentsProcessed++;

        // Record ingestion state
        this.stateTracker.record({
          sourceType: doc.sourceType,
          sourceId: doc.sourceId,
          contentHash: hash,
          chunkCount: chunks.length,
          ingestedAt: new Date().toISOString(),
        });
      } catch (err) {
        result.errors.push(
          `Error processing ${doc.sourceId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    result.timeMs = Date.now() - start;
    return result;
  }

  /**
   * Run ingestion for all registered source types.
   */
  async ingestAll(options?: ConnectorOptions): Promise<IngestionResult[]> {
    const results: IngestionResult[] = [];

    for (const sourceType of this.connectors.keys()) {
      const result = await this.ingestSourceType(sourceType, options);
      results.push(result);
    }

    return results;
  }

  /**
   * Force re-ingestion of all sources (clears ingestion state first).
   */
  async reindexAll(options?: ConnectorOptions): Promise<IngestionResult[]> {
    this.stateTracker.clear();
    return this.ingestAll(options);
  }

  /** Get pipeline statistics. */
  getStats(): PipelineStats {
    return {
      totalChunks: this.chunkStore.count(),
      chunksBySourceType: this.chunkStore.countBySourceType(),
      totalSources: Object.values(this.stateTracker.countByType()).reduce((a, b) => a + b, 0),
      sourcesByType: this.stateTracker.countByType(),
    };
  }

  /** Get the ingestion state tracker (for advanced queries). */
  getStateTracker(): IngestionStateTracker {
    return this.stateTracker;
  }

  /** Get the chunk store (for advanced queries). */
  getChunkStore(): ChunkStore {
    return this.chunkStore;
  }

  // ── Private helpers ──────────────────────────────────────────────

  /**
   * Embed a batch of chunks using the configured embedder.
   * Processes in batches to respect API rate limits.
   */
  private async embedBatch(
    chunks: Array<{ id: string; content: string; metadata: import('@matanelcohen/openspace-shared').ChunkMetadata; tokenCount: number }>,
  ): Promise<import('@matanelcohen/openspace-shared').EmbeddedChunk[]> {
    const embedder = this.embedder!;
    const results: import('@matanelcohen/openspace-shared').EmbeddedChunk[] = [];

    for (let i = 0; i < chunks.length; i += this.embeddingBatchSize) {
      const batch = chunks.slice(i, i + this.embeddingBatchSize);
      const texts = batch.map((c) => c.content);
      const embeddings = await embedder.embedBatch(texts);

      for (let j = 0; j < batch.length; j++) {
        results.push({
          ...batch[j]!,
          embedding: embeddings[j]!,
        });
      }
    }

    return results;
  }
}
