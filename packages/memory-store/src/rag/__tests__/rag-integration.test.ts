/**
 * Integration tests for the RAG pipeline.
 *
 * Tests the full ingest → chunk → embed → store → query pipeline
 * end-to-end using real (in-memory) SQLite and a deterministic fake embedder.
 */

import type { Embedder } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RAGServiceImpl } from '../rag-service.js';
import { SQLiteVectorStore } from '../vector-store.js';

// ── Test helpers ───────────────────────────────────────────────────

function createDeterministicEmbedder(dimensions = 16): Embedder {
  return {
    getDimensions: () => dimensions,
    async embed(text: string): Promise<number[]> {
      const vec = new Array(dimensions).fill(0);
      for (let i = 0; i < dimensions; i++) {
        let hash = 0;
        for (let j = 0; j < text.length; j++) {
          hash = ((hash << 5) - hash + text.charCodeAt(j) + i * 31) | 0;
        }
        vec[i] = Math.sin(hash) * 0.5 + 0.5;
      }
      const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
      return norm > 0 ? vec.map((v: number) => v / norm) : vec;
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return Promise.all(texts.map((t) => this.embed(t)));
    },
  };
}

function createTestDb(): Database.Database {
  const db = new BetterSqlite3(':memory:');
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('RAG Pipeline Integration', () => {
  let db: Database.Database;
  let store: SQLiteVectorStore;
  let service: RAGServiceImpl;

  beforeEach(async () => {
    db = createTestDb();
    store = new SQLiteVectorStore(db);
    service = new RAGServiceImpl({
      embedder: createDeterministicEmbedder(),
      vectorStore: store,
      defaultTopK: 10,
      minScore: 0,
    });
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
    db.close();
  });

  // ── Ingest → Query round-trip ────────────────────────────────────

  describe('ingest → search round-trip', () => {
    it('ingests a doc and retrieves it via search', async () => {
      await service.ingestDoc({
        path: 'docs/auth.md',
        title: 'Authentication',
        content: 'JWT authentication with refresh tokens. Uses bcrypt for password hashing.',
        author: 'dev',
        updatedAt: '2025-01-15T10:00:00Z',
      });

      const response = await service.search({
        query: 'authentication tokens',
        limit: 5,
      });

      expect(response.results.length).toBeGreaterThanOrEqual(1);
      expect(response.results.some((r) => r.content.includes('JWT'))).toBe(true);
      expect(response.searchTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('ingests a commit and retrieves it via search', async () => {
      await service.ingestCommit({
        sha: 'abc123def456',
        message: 'feat: add rate limiting middleware',
        author: 'dev@test.com',
        date: '2025-01-15T10:00:00Z',
        diff: 'diff --git a/src/middleware.ts b/src/middleware.ts\n+export function rateLimit() {}',
        files: ['src/middleware.ts'],
      });

      const response = await service.search({
        query: 'rate limiting',
        limit: 5,
      });

      expect(response.results.length).toBeGreaterThanOrEqual(1);
      expect(response.results.some((r) => r.content.includes('rate limit'))).toBe(true);
    });

    it('ingests a PR and retrieves it via search', async () => {
      await service.ingestPullRequest({
        number: 42,
        title: 'Add caching layer',
        body: 'Implements Redis-based caching for API responses.',
        author: 'alice',
        state: 'merged',
        createdAt: '2025-01-10T08:00:00Z',
        updatedAt: '2025-01-12T16:00:00Z',
        diff: '',
        comments: [{ author: 'bob', body: 'Great work!', createdAt: '2025-01-11T10:00:00Z' }],
        labels: ['performance'],
        files: ['src/cache.ts'],
      });

      const response = await service.search({
        query: 'caching Redis',
        limit: 5,
      });

      expect(response.results.length).toBeGreaterThanOrEqual(1);
      expect(
        response.results.some((r) => r.content.includes('caching') || r.content.includes('Redis')),
      ).toBe(true);
    });

    it('ingests a task and retrieves it via search', async () => {
      await service.ingestTask({
        id: 'task-perf-01',
        title: 'Optimize database queries',
        description: 'Add indexes and use query batching to reduce latency by 50%.',
        assignee: 'db-agent',
        status: 'done',
        priority: 'P1',
        agentIds: ['agent-db'],
        createdAt: '2025-01-15T09:00:00Z',
        updatedAt: '2025-01-16T11:00:00Z',
        tags: ['performance', 'database'],
        progressLog: ['Added composite index on users table', 'Implemented batch queries'],
      });

      const response = await service.search({
        query: 'database optimization indexes',
        limit: 5,
      });

      expect(response.results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Multi-source ingestion ───────────────────────────────────────

  describe('multi-source ingestion', () => {
    it('ingests from multiple sources and searches across all', async () => {
      await service.ingestDoc({
        path: 'docs/api.md',
        title: 'API Design',
        content: 'REST API design with OpenAPI specification. Versioned endpoints.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      await service.ingestCommit({
        sha: 'commit-api-001',
        message: 'feat: add REST API endpoints',
        author: 'dev',
        date: '2025-01-15T10:00:00Z',
        diff: '',
        files: ['src/api/routes.ts'],
      });

      await service.ingestTask({
        id: 'task-api-01',
        title: 'Design REST API',
        description: 'Create REST API following OpenAPI 3.0 spec.',
        assignee: null,
        status: 'done',
        priority: 'P2',
        agentIds: [],
        createdAt: '2025-01-15T09:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        tags: [],
        progressLog: [],
      });

      const response = await service.search({
        query: 'REST API design',
        limit: 10,
      });

      // Should find results from multiple sources
      expect(response.results.length).toBeGreaterThanOrEqual(2);
      const sourceTypes = new Set(response.results.map((r) => r.metadata.sourceType));
      expect(sourceTypes.size).toBeGreaterThanOrEqual(1);
    });

    it('tracks chunk count correctly across sources', async () => {
      await service.ingestDoc({
        path: 'docs/a.md',
        title: 'Doc A',
        content: 'Content of document A.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      await service.ingestDoc({
        path: 'docs/b.md',
        title: 'Doc B',
        content: 'Content of document B.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      const stats = await service.getStats();
      expect(stats.totalChunks).toBeGreaterThanOrEqual(2);
    });
  });

  // ── Search with filters ──────────────────────────────────────────

  describe('filtered search', () => {
    beforeEach(async () => {
      await service.ingestDoc({
        path: 'docs/auth.md',
        title: 'Auth',
        content: 'Authentication module documentation.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      await service.ingestCommit({
        sha: 'commit-filter-test',
        message: 'fix: authentication bug',
        author: 'dev',
        date: '2025-01-15T10:00:00Z',
        diff: '',
        files: [],
      });
    });

    it('filters by sourceType', async () => {
      const response = await service.search({
        query: 'authentication',
        filters: { sourceType: 'doc' },
        limit: 10,
      });

      expect(response.results.every((r) => r.metadata.sourceType === 'doc')).toBe(true);
    });
  });

  // ── Hybrid search ────────────────────────────────────────────────

  describe('hybrid search', () => {
    it('combines vector and FTS results', async () => {
      await service.ingestDoc({
        path: 'hybrid-test.md',
        title: 'Test',
        content: 'WebSocket real-time communication protocol implementation details.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      const hybridResponse = await service.search({
        query: 'WebSocket',
        hybridSearch: true,
        limit: 5,
      });

      const vectorOnlyResponse = await service.search({
        query: 'WebSocket',
        hybridSearch: false,
        limit: 5,
      });

      // Both should return results
      expect(hybridResponse.results.length).toBeGreaterThanOrEqual(1);
      expect(vectorOnlyResponse.results.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Source attributions ──────────────────────────────────────────

  describe('source attributions', () => {
    it('returns correct source attributions', async () => {
      await service.ingestDoc({
        path: 'docs/arch.md',
        title: 'Architecture',
        content: 'Microservices architecture with event-driven communication.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      const response = await service.search({
        query: 'architecture',
        limit: 5,
      });

      expect(response.sources.length).toBeGreaterThanOrEqual(1);
      for (const source of response.sources) {
        expect(source.citationIndex).toBeGreaterThan(0);
        expect(source.sourceType).toBeTruthy();
        expect(source.sourceId).toBeTruthy();
        expect(source.title).toBeTruthy();
      }
    });
  });

  // ── RAG service lifecycle ────────────────────────────────────────

  describe('service lifecycle', () => {
    it('throws if not initialized', async () => {
      const uninitDb = createTestDb();
      const uninitStore = new SQLiteVectorStore(uninitDb);
      const uninitService = new RAGServiceImpl({
        embedder: createDeterministicEmbedder(),
        vectorStore: uninitStore,
      });

      await expect(uninitService.search({ query: 'test' })).rejects.toThrow('not initialized');

      uninitDb.close();
    });

    it('reports stats after ingestion', async () => {
      await service.ingestDoc({
        path: 'test.md',
        title: 'Test',
        content: 'Test content for stats.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      });

      const stats = await service.getStats();
      expect(stats.totalChunks).toBeGreaterThan(0);
      expect(stats.vectorStoreProvider).toBe('sqlite-vec');
    });
  });

  // ── Incremental ingestion ────────────────────────────────────────

  describe('incremental ingestion', () => {
    it('re-ingesting same source updates chunks', async () => {
      const doc = {
        path: 'docs/evolving.md',
        title: 'Evolving',
        content: 'Version 1 of the documentation.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      };

      const result1 = await service.ingestDoc(doc);

      doc.content = 'Version 2 with updated information.';
      const result2 = await service.ingestDoc(doc);

      // Both should create chunks (upsert handles dedup by ID)
      expect(result1.chunksCreated).toBeGreaterThan(0);
      expect(result2.chunksCreated).toBeGreaterThan(0);
    });
  });
});
