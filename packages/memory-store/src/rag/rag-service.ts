/**
 * RAG service — orchestrates the full ingest → chunk → embed → store → query pipeline.
 *
 * Connects ingestion connectors, chunker, embedding provider, and vector store
 * into a cohesive retrieval-augmented generation service.
 */

import type {
  ChunkMetadata,
  EmbeddedChunk,
  Embedder,
  RAGSearchRequest,
  RAGSearchResponse,
  RAGStats,
  RetrievalContext,
  RetrievedChunk,
  SourceAttribution,
  SourceType,
} from '@matanelcohen/openspace-shared';

import type { ChunkInput } from './chunker.js';
import { type ChunkingConfig, chunkText, DEFAULT_CHUNKING_CONFIG } from './chunker.js';
import {
  type CommitData,
  type DocData,
  ingestCommit,
  ingestDoc,
  ingestPullRequest,
  ingestTask,
  type PullRequestData,
  type TaskData,
} from './connectors.js';
import type { SQLiteVectorStore } from './vector-store.js';

// ── Configuration ──────────────────────────────────────────────────

export interface RAGServiceConfig {
  embedder: Embedder;
  vectorStore: SQLiteVectorStore;
  chunking?: ChunkingConfig;
  defaultTopK?: number;
  tokenBudget?: number;
  minScore?: number;
}

// ── RAGServiceImpl ─────────────────────────────────────────────────

export class RAGServiceImpl {
  private readonly embedder: Embedder;
  private readonly vectorStore: SQLiteVectorStore;
  private readonly chunkingConfig: ChunkingConfig;
  private readonly defaultTopK: number;
  private readonly tokenBudget: number;
  private readonly minScore: number;
  private initialized = false;

  constructor(config: RAGServiceConfig) {
    this.embedder = config.embedder;
    this.vectorStore = config.vectorStore;
    this.chunkingConfig = config.chunking ?? DEFAULT_CHUNKING_CONFIG;
    this.defaultTopK = config.defaultTopK ?? 10;
    this.tokenBudget = config.tokenBudget ?? 4096;
    this.minScore = config.minScore ?? 0.25;
  }

  async initialize(): Promise<void> {
    await this.vectorStore.initialize();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    this.initialized = false;
  }

  // ── Ingestion ────────────────────────────────────────────────────

  /**
   * Ingest raw source content: connector → chunk → embed → store.
   */
  async ingestSource(
    sourceType: SourceType,
    sourceId: string,
    content: string,
    metadata?: Partial<ChunkMetadata>,
  ): Promise<{ chunksCreated: number }> {
    this.ensureInitialized();

    const chunkInputs: ChunkInput[] = [
      {
        sourceId: `${sourceType}:${sourceId}`,
        content,
        metadata: {
          sourceType,
          sourceId,
          squadPath: null,
          filePath: null,
          agentIds: [],
          author: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          tags: [],
          status: null,
          priority: null,
          headingPath: null,
          threadId: null,
          sessionId: null,
          ...metadata,
        },
      },
    ];

    return this.processChunkInputs(chunkInputs);
  }

  /** Ingest a commit using the commit connector. */
  async ingestCommit(data: CommitData): Promise<{ chunksCreated: number }> {
    this.ensureInitialized();
    const inputs = ingestCommit(data);
    return this.processChunkInputs(inputs);
  }

  /** Ingest a pull request using the PR connector. */
  async ingestPullRequest(data: PullRequestData): Promise<{ chunksCreated: number }> {
    this.ensureInitialized();
    const inputs = ingestPullRequest(data);
    return this.processChunkInputs(inputs);
  }

  /** Ingest a documentation file using the doc connector. */
  async ingestDoc(data: DocData): Promise<{ chunksCreated: number }> {
    this.ensureInitialized();
    const inputs = ingestDoc(data);
    return this.processChunkInputs(inputs);
  }

  /** Ingest a task using the task connector. */
  async ingestTask(data: TaskData): Promise<{ chunksCreated: number }> {
    this.ensureInitialized();
    const inputs = ingestTask(data);
    return this.processChunkInputs(inputs);
  }

  // ── Search ───────────────────────────────────────────────────────

  /** Semantic search with optional filters and hybrid ranking. */
  async search(request: RAGSearchRequest): Promise<RAGSearchResponse> {
    this.ensureInitialized();
    const start = performance.now();
    const limit = request.limit ?? this.defaultTopK;
    const minScore = this.minScore;

    // Embed the query
    const queryEmbedding = await this.embedder.embed(request.query);

    // Vector search
    const vectorResults = await this.vectorStore.search({
      embedding: queryEmbedding,
      filter: request.filters,
      limit: limit * 3, // over-fetch for re-ranking
      minScore,
    });

    // Optionally blend with FTS
    const ftsBoost = new Map<string, number>();
    if (request.hybridSearch !== false) {
      const ftsResults = this.vectorStore.ftsSearch(request.query, limit * 3);
      for (const fts of ftsResults) {
        const normalizedRank = Math.min(1.0, 1.0 / (1.0 + Math.abs(fts.rank)));
        ftsBoost.set(fts.id, normalizedRank);
      }
    }

    // Combine scores
    const results: RetrievedChunk[] = [];
    let citationIdx = 1;

    for (const vr of vectorResults) {
      const ftsScore = ftsBoost.get(vr.id) ?? 0;
      const combinedScore = vr.score * 0.7 + ftsScore * 0.3;

      results.push({
        content: vr.content,
        score: combinedScore,
        metadata: vr.metadata,
        citationIndex: citationIdx++,
      });
    }

    results.sort((a, b) => b.score - a.score);
    const topResults = results.slice(0, limit);

    // Build sources
    const sources: SourceAttribution[] = topResults.map((r) => ({
      citationIndex: r.citationIndex,
      sourceType: r.metadata.sourceType,
      sourceId: r.metadata.sourceId,
      title: this.sourceTitle(r.metadata),
      url: null,
    }));

    // Estimate total tokens
    let totalTokens = 0;
    for (const r of topResults) {
      totalTokens += Math.ceil(r.content.length / 4);
    }

    return {
      results: topResults,
      totalTokens,
      sources,
      searchTimeMs: Math.round(performance.now() - start),
    };
  }

  /** Retrieve context scoped to an agent. */
  async retrieveForAgent(
    agentId: string,
    query: string,
    options?: Partial<RAGSearchRequest>,
  ): Promise<RetrievalContext> {
    const response = await this.search({
      query,
      agentId,
      filters: {
        ...options?.filters,
        agentIds: [agentId],
      },
      limit: options?.limit ?? this.defaultTopK,
      tokenBudget: options?.tokenBudget ?? this.tokenBudget,
      hybridSearch: options?.hybridSearch,
    });

    // Trim to token budget
    const budget = options?.tokenBudget ?? this.tokenBudget;
    const chunks: RetrievedChunk[] = [];
    let tokensSoFar = 0;

    for (const r of response.results) {
      const chunkTokens = Math.ceil(r.content.length / 4);
      if (tokensSoFar + chunkTokens > budget) break;
      chunks.push(r);
      tokensSoFar += chunkTokens;
    }

    return {
      chunks,
      totalTokens: tokensSoFar,
      sources: response.sources.filter((s) =>
        chunks.some((c) => c.citationIndex === s.citationIndex),
      ),
    };
  }

  /** Get knowledge base statistics. */
  async getStats(): Promise<RAGStats> {
    this.ensureInitialized();
    const totalChunks = await this.vectorStore.count();

    const sourceTypes: SourceType[] = [
      'commit',
      'pull_request',
      'doc',
      'task',
      'decision',
      'voice_session',
      'chat_thread',
      'agent_charter',
      'agent_memory',
    ];

    const chunksBySourceType: Record<string, number> = {};
    for (const st of sourceTypes) {
      chunksBySourceType[st] = await this.vectorStore.count({ sourceType: st });
    }

    return {
      totalChunks,
      chunksBySourceType: chunksBySourceType as Record<SourceType, number>,
      totalMemories: 0,
      lastIngestedAt: null,
      vectorStoreProvider: 'sqlite-vec',
      embeddingModel: 'test',
    };
  }

  // ── Private ──────────────────────────────────────────────────────

  private async processChunkInputs(inputs: ChunkInput[]): Promise<{ chunksCreated: number }> {
    let totalChunks = 0;

    for (const input of inputs) {
      const chunks = chunkText(input, this.chunkingConfig);
      if (chunks.length === 0) continue;

      // Batch embed
      const texts = chunks.map((c) => c.content);
      const embeddings = await this.embedder.embedBatch(texts);

      // Create embedded chunks
      const embeddedChunks: EmbeddedChunk[] = chunks.map((chunk, i) => ({
        ...chunk,
        embedding: embeddings[i]!,
      }));

      await this.vectorStore.upsert(embeddedChunks);
      totalChunks += embeddedChunks.length;
    }

    return { chunksCreated: totalChunks };
  }

  private sourceTitle(metadata: ChunkMetadata): string {
    switch (metadata.sourceType) {
      case 'commit':
        return `Commit ${metadata.sourceId.slice(0, 8)}`;
      case 'pull_request':
        return `PR #${metadata.sourceId}`;
      case 'doc':
        return metadata.squadPath ?? `Doc ${metadata.sourceId}`;
      case 'task':
        return `Task ${metadata.sourceId}`;
      default:
        return `${metadata.sourceType}:${metadata.sourceId}`;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('RAGService not initialized. Call initialize() first.');
    }
  }
}
