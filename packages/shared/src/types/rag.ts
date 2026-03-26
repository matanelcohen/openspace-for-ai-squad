/**
 * RAG (Retrieval-Augmented Generation) types for the openspace.ai knowledge base.
 *
 * Defines the data model for:
 *   - Document chunking and embedding
 *   - Vector store abstraction
 *   - Query and retrieval pipeline
 *   - Ingestion state tracking
 *   - Configuration
 */

// ── Source Types ──────────────────────────────────────────────────

/** Content source types that can be ingested into the RAG knowledge base. */
export type SourceType =
  | 'commit'
  | 'pull_request'
  | 'doc'
  | 'task'
  | 'decision'
  | 'voice_session'
  | 'chat_thread'
  | 'agent_charter'
  | 'agent_memory';

// ── Chunks ────────────────────────────────────────────────────────

/** Metadata attached to every chunk for filtered retrieval. */
export interface ChunkMetadata {
  /** Content source category. */
  sourceType: SourceType;
  /** Unique ID of the source (commit SHA, PR number, task ID, etc.). */
  sourceId: string;
  /** Position of this chunk within the source document. */
  chunkIndex: number;
  /** Total number of chunks from this source. */
  chunkTotal: number;

  /** Path in .squad/ if applicable (e.g., "tasks/add-auth.md"). */
  squadPath: string | null;
  /** Repository file path for code-related chunks. */
  filePath: string | null;

  /** Agent IDs associated with this chunk. */
  agentIds: string[];
  /** Human or agent who created the source. */
  author: string | null;

  /** ISO-8601 creation timestamp. */
  createdAt: string;
  /** ISO-8601 last-updated timestamp. */
  updatedAt: string;

  /** User-defined or auto-extracted tags. */
  tags: string[];
  /** Task status, decision status, PR state, etc. */
  status: string | null;
  /** Task priority (P0–P3). */
  priority: string | null;

  /** Heading breadcrumb for doc chunks (e.g., "## Arch > ### DB"). */
  headingPath: string | null;
  /** Chat thread grouping ID. */
  threadId: string | null;
  /** Voice session grouping ID. */
  sessionId: string | null;
}

/** A chunk of text ready for embedding. */
export interface Chunk {
  /** Deterministic ID: hash(sourceId + chunkIndex). */
  id: string;
  /** The text content to embed. */
  content: string;
  /** Rich metadata for filtered retrieval. */
  metadata: ChunkMetadata;
  /** Actual token count of this chunk. */
  tokenCount: number;
}

/** A chunk with its computed embedding vector. */
export interface EmbeddedChunk extends Chunk {
  /** The embedding vector (length = configured dimensions). */
  embedding: number[];
}

// ── Vector Store Abstraction ──────────────────────────────────────

/** Filter criteria for chunk operations. */
export interface ChunkFilter {
  sourceType?: SourceType;
  sourceTypes?: SourceType[];
  sourceId?: string;
  agentIds?: string[];
  tags?: string[];
  status?: string[];
  priority?: string[];
  dateRange?: { from?: string; to?: string };
  squadPath?: string;
  threadId?: string;
  sessionId?: string;
}

/** Query parameters for vector similarity search. */
export interface VectorSearchQuery {
  /** The query embedding vector. */
  embedding: number[];
  /** Pre-filter to narrow the search space. */
  filter?: ChunkFilter;
  /** Number of results to return (default: 10). */
  limit?: number;
  /** Minimum similarity score threshold (0–1, default: 0.25). */
  minScore?: number;
}

/** A single result from vector similarity search. */
export interface VectorSearchResult {
  /** Chunk ID. */
  id: string;
  /** Similarity score (0–1, higher is more similar). */
  score: number;
  /** The chunk content. */
  content: string;
  /** Full chunk metadata. */
  metadata: ChunkMetadata;
}

/** Abstract vector store interface — implementations for sqlite-vec and Qdrant. */
export interface VectorStore {
  /** Insert or update chunks with their embeddings. */
  upsert(chunks: EmbeddedChunk[]): Promise<void>;
  /** Search for similar chunks by embedding vector with optional filters. */
  search(query: VectorSearchQuery): Promise<VectorSearchResult[]>;
  /** Delete chunks matching the filter. Returns count of deleted chunks. */
  delete(filter: ChunkFilter): Promise<number>;
  /** Count chunks matching the optional filter. */
  count(filter?: ChunkFilter): Promise<number>;
  /** Initialize the store (create tables/collections). */
  initialize(): Promise<void>;
}

// ── Embedding ─────────────────────────────────────────────────────

/** Embedding provider type. */
export type EmbeddingProvider = 'openai' | 'ollama' | 'copilot';

/** Configuration for the embedding model. */
export interface EmbeddingConfig {
  /** Which provider to use. */
  provider: EmbeddingProvider;
  /** Model identifier (e.g., "text-embedding-3-small"). */
  model: string;
  /** Output vector dimensions (e.g., 1536 or 512 for matryoshka). */
  dimensions: number;
  /** Number of texts to embed in a single API call. */
  batchSize: number;
  /** Max tokens per chunk (chunks exceeding this are rejected). */
  maxTokensPerChunk: number;
}

/** Abstract embedder interface. */
export interface Embedder {
  /** Embed a single text string. */
  embed(text: string): Promise<number[]>;
  /** Embed multiple texts in a batch. */
  embedBatch(texts: string[]): Promise<number[][]>;
  /** Get the configured dimensions. */
  getDimensions(): number;
}

// ── Retrieval Pipeline ────────────────────────────────────────────

/** Search request submitted to the RAG service. */
export interface RAGSearchRequest {
  /** Natural language query. */
  query: string;
  /** Scope retrieval to a specific agent's knowledge + memories. */
  agentId?: string;
  /** Metadata filters to narrow results. */
  filters?: ChunkFilter;
  /** Max results to return (default: 10). */
  limit?: number;
  /** Max tokens in the assembled context (default: 4096). */
  tokenBudget?: number;
  /** Whether to include the agent's memories (default: true). */
  includeMemories?: boolean;
  /** Combine vector search with FTS5 keyword search (default: true). */
  hybridSearch?: boolean;
}

/** A single retrieved chunk with citation info. */
export interface RetrievedChunk {
  /** The chunk text content. */
  content: string;
  /** Combined relevance score (0–1). */
  score: number;
  /** Full metadata. */
  metadata: ChunkMetadata;
  /** Citation index for source attribution in LLM prompt ([1], [2], ...). */
  citationIndex: number;
}

/** Source attribution for a retrieved chunk. */
export interface SourceAttribution {
  /** Citation index matching RetrievedChunk.citationIndex. */
  citationIndex: number;
  /** Content source type. */
  sourceType: SourceType;
  /** Source identifier. */
  sourceId: string;
  /** Human-readable title or summary. */
  title: string;
  /** Link to the source (PR URL, file path, etc.), if available. */
  url: string | null;
}

/** Assembled retrieval context ready for LLM prompt injection. */
export interface RetrievalContext {
  /** Retrieved chunks ordered by relevance. */
  chunks: RetrievedChunk[];
  /** Total tokens used by all chunks. */
  totalTokens: number;
  /** Source attributions for citation. */
  sources: SourceAttribution[];
}

/** Response from the RAG search API endpoint. */
export interface RAGSearchResponse {
  /** Retrieved chunks. */
  results: RetrievedChunk[];
  /** Total tokens consumed. */
  totalTokens: number;
  /** Source attributions. */
  sources: SourceAttribution[];
  /** Search latency in milliseconds. */
  searchTimeMs: number;
}

// ── Ingestion ─────────────────────────────────────────────────────

/** Tracks what has been ingested for incremental updates. */
export interface IngestionState {
  /** Content source type. */
  sourceType: SourceType;
  /** Source identifier. */
  sourceId: string;
  /** SHA-256 hash of the source content (change detection). */
  contentHash: string;
  /** Number of chunks produced from this source. */
  chunkCount: number;
  /** ISO-8601 timestamp of last ingestion. */
  ingestedAt: string;
}

/** Statistics about the RAG knowledge base. */
export interface RAGStats {
  /** Total number of chunks in the store. */
  totalChunks: number;
  /** Chunk counts by source type. */
  chunksBySourceType: Record<SourceType, number>;
  /** Total number of agent memories. */
  totalMemories: number;
  /** When the last ingestion occurred. */
  lastIngestedAt: string | null;
  /** Vector store backend in use. */
  vectorStoreProvider: string;
  /** Embedding model in use. */
  embeddingModel: string;
}

// ── Chunking Configuration ────────────────────────────────────────

/** Configuration for the chunking pipeline. */
export interface ChunkingConfig {
  /** Target chunk size in tokens (default: 512). */
  targetTokens: number;
  /** Hard maximum chunk size in tokens (default: 1024). */
  maxTokens: number;
  /** Overlap between sequential chunks in tokens (default: 64). */
  overlapTokens: number;
}

// ── Vector Store Configuration ────────────────────────────────────

/** Which vector store backend to use. */
export type VectorStoreProvider = 'sqlite-vec' | 'qdrant';

/** Configuration for the vector store. */
export interface VectorStoreConfig {
  /** Backend provider. */
  provider: VectorStoreProvider;
  /** SQLite database path (for sqlite-vec). */
  sqlitePath?: string;
  /** Qdrant server URL (for qdrant). */
  qdrantUrl?: string;
  /** Qdrant API key (optional, for cloud). */
  qdrantApiKey?: string;
  /** Collection name in the vector store. */
  collection: string;
}

// ── Retrieval Configuration ───────────────────────────────────────

/** Configuration for the retrieval pipeline. */
export interface RetrievalConfig {
  /** Default number of results per search. */
  defaultTopK: number;
  /** Default token budget for context assembly. */
  tokenBudget: number;
  /** Whether to use hybrid search (vector + FTS5) by default. */
  hybridSearch: boolean;
  /** Minimum similarity score to include a result. */
  minScore: number;
  /** Whether to use cross-encoder re-ranking. */
  reranking: boolean;
}

// ── Memory Configuration ──────────────────────────────────────────

/** Configuration for the agent memory system. */
export interface MemoryConfig {
  /** Whether agent memory is enabled. */
  enabled: boolean;
  /** Memory decay half-life in days (default: 90). */
  halfLifeDays: number;
  /** How often to run consolidation in seconds (default: 86400 = 1 day). */
  consolidationIntervalSeconds: number;
  /** Maximum active memories per agent (default: 200). */
  maxPerAgent: number;
  /** Cosine similarity threshold for dedup merging (default: 0.92). */
  similarityThreshold: number;
}

// ── Top-Level RAG Configuration ───────────────────────────────────

/** Complete RAG system configuration. */
export interface RAGConfig {
  /** Feature flag to enable/disable the RAG pipeline. */
  enabled: boolean;
  /** Vector store settings. */
  vectorStore: VectorStoreConfig;
  /** Embedding model settings. */
  embedding: EmbeddingConfig;
  /** Retrieval pipeline settings. */
  retrieval: RetrievalConfig;
  /** Chunking pipeline settings. */
  chunking: ChunkingConfig;
  /** Agent memory settings. */
  memory: MemoryConfig;
}

// ── RAG Service Interface ─────────────────────────────────────────

/** The main RAG service used by the API layer. */
export interface RAGService {
  /** Semantic search with optional filters and hybrid ranking. */
  search(request: RAGSearchRequest): Promise<RAGSearchResponse>;

  /** Retrieve context scoped to a specific agent (includes their memories). */
  retrieveForAgent(
    agentId: string,
    query: string,
    options?: Partial<RAGSearchRequest>,
  ): Promise<RetrievalContext>;

  /** Ingest a source into the knowledge base (chunk → embed → store). */
  ingestSource(
    sourceType: SourceType,
    sourceId: string,
    content: string,
    metadata?: Partial<ChunkMetadata>,
  ): Promise<void>;

  /** Ingest a .squad/ file by path (infers source type). */
  ingestSquadFile(filePath: string): Promise<void>;

  /** Full re-index of all known sources. */
  reindexAll(): Promise<{ chunksCreated: number; timeMs: number }>;

  /** Get knowledge base statistics. */
  getStats(): Promise<RAGStats>;

  /** Initialize the RAG service (create tables, connect to vector store). */
  initialize(): Promise<void>;

  /** Graceful shutdown. */
  shutdown(): Promise<void>;
}
