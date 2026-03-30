/**
 * KnowledgeSearchService — similarity search and retrieval for the RAG knowledge base.
 *
 * Implements:
 *   - Embedding-based vector similarity search (cosine similarity)
 *   - FTS5 keyword search over rag_chunks_fts
 *   - Hybrid search combining both with configurable alpha
 *   - Metadata filtering (source type, date range, author, etc.)
 *   - Reranking pass for improved relevance
 *   - Response formatting with source attribution and token budgets
 */

import type {
  ChunkFilter,
  ChunkMetadata,
  Embedder,
  RAGSearchRequest,
  RAGSearchResponse,
  RetrievalConfig,
  RetrievalContext,
  RetrievedChunk,
  SourceAttribution,
  SourceType,
} from '@matanelcohen/openspace-shared';
import type Database from 'better-sqlite3';

// ── Internal types ─────────────────────────────────────────────────

interface ChunkRow {
  id: string;
  content: string;
  token_count: number;
  source_type: string;
  source_id: string;
  chunk_index: number;
  chunk_total: number;
  squad_path: string | null;
  file_path: string | null;
  agent_ids: string;
  author: string | null;
  created_at: string;
  updated_at: string;
  tags: string;
  status: string | null;
  priority: string | null;
  heading_path: string | null;
  thread_id: string | null;
  session_id: string | null;
}

interface FtsChunkRow extends ChunkRow {
  rank: number;
}

interface ScoredChunk {
  id: string;
  content: string;
  metadata: ChunkMetadata;
  tokenCount: number;
  score: number;
  vectorScore: number;
  ftsScore: number;
}

// ── Default config ─────────────────────────────────────────────────

const DEFAULT_RETRIEVAL_CONFIG: RetrievalConfig = {
  defaultTopK: 10,
  tokenBudget: 4096,
  hybridSearch: true,
  minScore: 0.25,
  reranking: true,
};

// ── Cosine similarity ──────────────────────────────────────────────

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }

  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dotProduct / denom;
}

// ── Row → metadata helper ──────────────────────────────────────────

function rowToMetadata(row: ChunkRow): ChunkMetadata {
  return {
    sourceType: row.source_type as SourceType,
    sourceId: row.source_id,
    chunkIndex: row.chunk_index,
    chunkTotal: row.chunk_total,
    squadPath: row.squad_path,
    filePath: row.file_path,
    agentIds: safeParse<string[]>(row.agent_ids, []),
    author: row.author,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    tags: safeParse<string[]>(row.tags, []),
    status: row.status,
    priority: row.priority,
    headingPath: row.heading_path,
    threadId: row.thread_id,
    sessionId: row.session_id,
  };
}

function safeParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

// ── FTS query sanitizer ────────────────────────────────────────────

function sanitizeFtsQuery(query: string): string {
  const terms = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"`)
    .join(' OR ');
  return terms || '""';
}

// ── WHERE clause builder (mirrors chunk-store.ts) ──────────────────

function buildWhereClause(filter: ChunkFilter): { where: string; params: unknown[] } {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.sourceType) {
    conditions.push('c.source_type = ?');
    params.push(filter.sourceType);
  }

  if (filter.sourceTypes && filter.sourceTypes.length > 0) {
    conditions.push(`c.source_type IN (${filter.sourceTypes.map(() => '?').join(',')})`);
    params.push(...filter.sourceTypes);
  }

  if (filter.sourceId) {
    conditions.push('c.source_id = ?');
    params.push(filter.sourceId);
  }

  if (filter.agentIds && filter.agentIds.length > 0) {
    // agent_ids is stored as JSON array — match any
    const agentConditions = filter.agentIds.map(() => `c.agent_ids LIKE ?`);
    conditions.push(`(${agentConditions.join(' OR ')})`);
    params.push(...filter.agentIds.map((id: string) => `%"${id}"%`));
  }

  if (filter.tags && filter.tags.length > 0) {
    const tagConditions = filter.tags.map(() => `c.tags LIKE ?`);
    conditions.push(`(${tagConditions.join(' OR ')})`);
    params.push(...filter.tags.map((tag: string) => `%"${tag}"%`));
  }

  if (filter.dateRange?.from) {
    conditions.push('c.created_at >= ?');
    params.push(filter.dateRange.from);
  }

  if (filter.dateRange?.to) {
    conditions.push('c.created_at <= ?');
    params.push(filter.dateRange.to);
  }

  if (filter.squadPath) {
    conditions.push('c.squad_path = ?');
    params.push(filter.squadPath);
  }

  if (filter.status && filter.status.length > 0) {
    conditions.push(`c.status IN (${filter.status.map(() => '?').join(',')})`);
    params.push(...filter.status);
  }

  if (filter.priority && filter.priority.length > 0) {
    conditions.push(`c.priority IN (${filter.priority.map(() => '?').join(',')})`);
    params.push(...filter.priority);
  }

  if (filter.threadId) {
    conditions.push('c.thread_id = ?');
    params.push(filter.threadId);
  }

  if (filter.sessionId) {
    conditions.push('c.session_id = ?');
    params.push(filter.sessionId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return { where, params };
}

// ── KnowledgeSearchService ─────────────────────────────────────────

export interface KnowledgeSearchConfig {
  db: Database.Database;
  embedder?: Embedder | null;
  retrieval?: Partial<RetrievalConfig>;
  /** Weight for vector similarity in hybrid scoring (0–1). Default: 0.7 */
  hybridAlpha?: number;
}

export class KnowledgeSearchService {
  private readonly db: Database.Database;
  private readonly embedder: Embedder | null;
  private readonly config: RetrievalConfig;
  private readonly hybridAlpha: number;

  constructor(opts: KnowledgeSearchConfig) {
    this.db = opts.db;
    this.embedder = opts.embedder ?? null;
    this.config = { ...DEFAULT_RETRIEVAL_CONFIG, ...opts.retrieval };
    this.hybridAlpha = opts.hybridAlpha ?? 0.7;
  }

  // ── Main search ────────────────────────────────────────────────

  /**
   * Full-featured search: hybrid vector+keyword, metadata filtering,
   * reranking, token budget assembly, and source attribution.
   */
  async search(request: RAGSearchRequest): Promise<RAGSearchResponse> {
    const start = performance.now();

    const limit = request.limit ?? this.config.defaultTopK;
    const minScore = this.config.minScore;
    const useHybrid = request.hybridSearch ?? this.config.hybridSearch;
    const tokenBudget = request.tokenBudget ?? this.config.tokenBudget;

    // Widen the candidate pool for reranking
    const candidateLimit = this.config.reranking ? limit * 3 : limit;

    let candidates: ScoredChunk[];

    if (useHybrid && this.embedder) {
      candidates = await this.hybridSearch(request.query, request.filters, candidateLimit);
    } else if (this.embedder) {
      candidates = await this.vectorSearch(request.query, request.filters, candidateLimit);
    } else {
      candidates = this.keywordSearch(request.query, request.filters, candidateLimit);
    }

    // Apply agent scope filter
    if (request.agentId) {
      candidates = candidates.filter(
        (c) => c.metadata.agentIds.length === 0 || c.metadata.agentIds.includes(request.agentId!),
      );
    }

    // Apply minimum score threshold
    candidates = candidates.filter((c) => c.score >= minScore);

    // Rerank for improved relevance
    if (this.config.reranking) {
      candidates = this.rerank(candidates, request.query);
    }

    // Sort by score descending
    candidates.sort((a, b) => b.score - a.score);

    // Assemble results within token budget
    const { results, totalTokens, sources } = this.assembleResults(candidates, limit, tokenBudget);

    const searchTimeMs = Math.round(performance.now() - start);

    return { results, totalTokens, sources, searchTimeMs };
  }

  // ── Agent-scoped retrieval ─────────────────────────────────────

  /**
   * Retrieve context scoped to a specific agent.
   * Convenience wrapper over search() with agent filtering.
   */
  async retrieveForAgent(
    agentId: string,
    query: string,
    options?: Partial<RAGSearchRequest>,
  ): Promise<RetrievalContext> {
    const response = await this.search({
      query,
      agentId,
      includeMemories: true,
      ...options,
    });

    return {
      chunks: response.results,
      totalTokens: response.totalTokens,
      sources: response.sources,
    };
  }

  // ── Knowledge base statistics ──────────────────────────────────

  getStats(): {
    totalChunks: number;
    chunksBySourceType: Record<string, number>;
    totalEmbeddings: number;
    lastIngestedAt: string | null;
  } {
    const totalRow = this.db
      .prepare<[], { cnt: number }>(`SELECT COUNT(*) as cnt FROM rag_chunks`)
      .get();

    const typeRows = this.db
      .prepare<
        [],
        { source_type: string; cnt: number }
      >(`SELECT source_type, COUNT(*) as cnt FROM rag_chunks GROUP BY source_type`)
      .all();

    const embeddingRow = this.db
      .prepare<[], { cnt: number }>(`SELECT COUNT(*) as cnt FROM rag_chunk_embeddings`)
      .get();

    const lastRow = this.db
      .prepare<
        [],
        { ingested_at: string }
      >(`SELECT ingested_at FROM ingestion_state ORDER BY ingested_at DESC LIMIT 1`)
      .get();

    const chunksBySourceType: Record<string, number> = {};
    for (const row of typeRows) {
      chunksBySourceType[row.source_type] = row.cnt;
    }

    return {
      totalChunks: totalRow?.cnt ?? 0,
      chunksBySourceType,
      totalEmbeddings: embeddingRow?.cnt ?? 0,
      lastIngestedAt: lastRow?.ingested_at ?? null,
    };
  }

  // ── Vector similarity search ───────────────────────────────────

  private async vectorSearch(
    query: string,
    filters?: ChunkFilter,
    limit = 10,
  ): Promise<ScoredChunk[]> {
    if (!this.embedder) return [];

    const queryEmbedding = await this.embedder.embed(query);

    // Fetch chunks with embeddings, applying metadata filters
    const { where, params } = filters ? buildWhereClause(filters) : { where: '', params: [] };

    const rows = this.db
      .prepare<unknown[], ChunkRow & { embedding: Buffer; dimensions: number }>(
        `SELECT c.*, e.embedding, e.dimensions
         FROM rag_chunks c
         INNER JOIN rag_chunk_embeddings e ON e.chunk_id = c.id
         ${where}`,
      )
      .all(...params);

    const scored: ScoredChunk[] = [];

    for (const row of rows) {
      const storedEmbedding = bufferToFloat64Array(row.embedding, row.dimensions);
      const score = cosineSimilarity(queryEmbedding, storedEmbedding);

      scored.push({
        id: row.id,
        content: row.content,
        metadata: rowToMetadata(row),
        tokenCount: row.token_count,
        score,
        vectorScore: score,
        ftsScore: 0,
      });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit);
  }

  // ── FTS5 keyword search ────────────────────────────────────────

  private keywordSearch(query: string, filters?: ChunkFilter, limit = 10): ScoredChunk[] {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const safeQuery = sanitizeFtsQuery(trimmed);

    // Build metadata filter conditions (prefixed with c.)
    const { where: filterWhere, params: filterParams } = filters
      ? buildWhereClause(filters)
      : { where: '', params: [] };

    // Convert "WHERE ..." to "AND ..." for combining with FTS MATCH
    const filterConditions = filterWhere ? filterWhere.replace('WHERE ', 'AND ') : '';

    // Use positional params: [safeQuery, ...filterParams, limit]
    const sql = `
      SELECT c.*, fts.rank
      FROM rag_chunks_fts fts
      JOIN rag_chunks c ON c.rowid = fts.rowid
      WHERE rag_chunks_fts MATCH ?
      ${filterConditions}
      ORDER BY fts.rank
      LIMIT ?
    `;

    const rows = this.db
      .prepare<unknown[], FtsChunkRow>(sql)
      .all(safeQuery, ...filterParams, limit);

    return rows.map((row) => {
      // Normalize FTS rank to 0-1 (FTS5 rank is negative, lower = more relevant)
      const score = Math.min(1.0, 1.0 / (1.0 + Math.abs(row.rank)));

      return {
        id: row.id,
        content: row.content,
        metadata: rowToMetadata(row),
        tokenCount: row.token_count,
        score,
        vectorScore: 0,
        ftsScore: score,
      };
    });
  }

  // ── Hybrid search ──────────────────────────────────────────────

  private async hybridSearch(
    query: string,
    filters?: ChunkFilter,
    limit = 10,
  ): Promise<ScoredChunk[]> {
    // Run both searches in parallel
    const [vectorResults, keywordResults] = await Promise.all([
      this.vectorSearch(query, filters, limit),
      Promise.resolve(this.keywordSearch(query, filters, limit)),
    ]);

    // Merge results by chunk ID
    const merged = new Map<string, ScoredChunk>();

    for (const result of vectorResults) {
      merged.set(result.id, { ...result });
    }

    for (const result of keywordResults) {
      const existing = merged.get(result.id);
      if (existing) {
        existing.ftsScore = result.ftsScore;
      } else {
        merged.set(result.id, { ...result });
      }
    }

    // Compute hybrid score: alpha * vector + (1 - alpha) * fts
    const alpha = this.hybridAlpha;
    for (const chunk of merged.values()) {
      chunk.score = alpha * chunk.vectorScore + (1 - alpha) * chunk.ftsScore;
    }

    const results = Array.from(merged.values());
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  // ── Reranking ──────────────────────────────────────────────────

  /**
   * Reranking pass that boosts scores based on:
   *   - Recency: newer content gets a boost
   *   - Query-heading overlap: chunks whose heading matches query terms
   *   - Source diversity: slight penalty for duplicate source IDs
   */
  private rerank(candidates: ScoredChunk[], query: string): ScoredChunk[] {
    const queryTerms = new Set(
      query
        .toLowerCase()
        .split(/\s+/)
        .filter((t) => t.length > 2),
    );
    const now = Date.now();
    const seenSources = new Map<string, number>();

    for (const chunk of candidates) {
      let boost = 0;

      // Recency boost: 0–0.1 based on age (max boost for content < 7 days old)
      const ageMs = now - new Date(chunk.metadata.createdAt).getTime();
      const ageDays = ageMs / (1000 * 60 * 60 * 24);
      boost += 0.1 * Math.exp(-ageDays / 30);

      // Heading relevance boost: 0–0.1 based on term overlap
      if (chunk.metadata.headingPath) {
        const headingLower = chunk.metadata.headingPath.toLowerCase();
        let matchCount = 0;
        for (const term of queryTerms) {
          if (headingLower.includes(term)) matchCount++;
        }
        if (queryTerms.size > 0) {
          boost += 0.1 * (matchCount / queryTerms.size);
        }
      }

      // Source diversity penalty: -0.05 for each repeated source
      const sourceKey = `${chunk.metadata.sourceType}:${chunk.metadata.sourceId}`;
      const seen = seenSources.get(sourceKey) ?? 0;
      if (seen > 0) {
        boost -= 0.05 * Math.min(seen, 3);
      }
      seenSources.set(sourceKey, seen + 1);

      chunk.score = Math.max(0, Math.min(1, chunk.score + boost));
    }

    return candidates;
  }

  // ── Result assembly ────────────────────────────────────────────

  private assembleResults(
    candidates: ScoredChunk[],
    limit: number,
    tokenBudget: number,
  ): { results: RetrievedChunk[]; totalTokens: number; sources: SourceAttribution[] } {
    const results: RetrievedChunk[] = [];
    const sourceMap = new Map<string, SourceAttribution>();
    let totalTokens = 0;
    let citationIndex = 1;

    for (const chunk of candidates) {
      if (results.length >= limit) break;
      if (totalTokens + chunk.tokenCount > tokenBudget) continue;

      // Build source attribution
      const sourceKey = `${chunk.metadata.sourceType}:${chunk.metadata.sourceId}`;
      if (!sourceMap.has(sourceKey)) {
        sourceMap.set(sourceKey, {
          citationIndex,
          sourceType: chunk.metadata.sourceType,
          sourceId: chunk.metadata.sourceId,
          title: buildSourceTitle(chunk.metadata),
          url: chunk.metadata.squadPath ?? chunk.metadata.filePath,
        });
        citationIndex++;
      }

      const attribution = sourceMap.get(sourceKey)!;

      results.push({
        content: chunk.content,
        score: chunk.score,
        metadata: chunk.metadata,
        citationIndex: attribution.citationIndex,
      });

      totalTokens += chunk.tokenCount;
    }

    return {
      results,
      totalTokens,
      sources: Array.from(sourceMap.values()),
    };
  }
}

// ── Helpers ────────────────────────────────────────────────────────

function bufferToFloat64Array(buf: Buffer, dimensions: number): number[] {
  const float64 = new Float64Array(buf.buffer, buf.byteOffset, dimensions);
  return Array.from(float64);
}

function buildSourceTitle(metadata: ChunkMetadata): string {
  const parts: string[] = [];

  if (metadata.headingPath) {
    parts.push(metadata.headingPath);
  } else if (metadata.squadPath) {
    parts.push(metadata.squadPath);
  } else if (metadata.sourceId) {
    parts.push(metadata.sourceId);
  }

  const typeLabel = metadata.sourceType.replace(/_/g, ' ');
  return parts.length > 0 ? `${typeLabel}: ${parts.join(' > ')}` : typeLabel;
}
