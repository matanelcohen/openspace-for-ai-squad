/**
 * Retrieval quality benchmarks for the RAG pipeline.
 *
 * Uses a semantic-aware fake embedder to measure:
 *   - Precision@k: fraction of top-k results that are relevant
 *   - Recall@k: fraction of relevant items found in top-k results
 *   - Mean Reciprocal Rank (MRR): 1/rank of the first relevant result
 *
 * Tests use a controlled corpus of known query/answer pairs.
 */

import type { Embedder } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RAGServiceImpl } from '../rag-service.js';
import { SQLiteVectorStore } from '../vector-store.js';

// ── Semantic Embedder ──────────────────────────────────────────────

/**
 * A fake embedder that maps semantically similar terms to similar vectors.
 * Topic clusters ensure related content has higher cosine similarity.
 */
function createSemanticEmbedder(dimensions = 32): Embedder {
  const topicVectors: Record<string, number[]> = {
    auth: [1, 0.2, 0, 0, 0, 0, 0.1, 0],
    database: [0, 1, 0.2, 0, 0, 0, 0, 0.1],
    api: [0, 0, 1, 0.2, 0, 0, 0, 0],
    testing: [0, 0, 0, 1, 0.2, 0, 0, 0],
    deploy: [0, 0, 0, 0, 1, 0.2, 0, 0],
    security: [0.8, 0, 0, 0, 0, 1, 0.2, 0],
    performance: [0, 0.5, 0, 0, 0, 0, 1, 0.2],
    frontend: [0, 0, 0.3, 0, 0, 0, 0, 1],
  };

  const keywords: Record<string, string> = {
    jwt: 'auth',
    token: 'auth',
    authentication: 'auth',
    login: 'auth',
    password: 'auth',
    bcrypt: 'auth',
    oauth: 'auth',
    session: 'auth',
    sql: 'database',
    sqlite: 'database',
    postgres: 'database',
    query: 'database',
    index: 'database',
    migration: 'database',
    schema: 'database',
    table: 'database',
    rest: 'api',
    endpoint: 'api',
    route: 'api',
    http: 'api',
    graphql: 'api',
    openapi: 'api',
    swagger: 'api',
    request: 'api',
    response: 'api',
    test: 'testing',
    vitest: 'testing',
    jest: 'testing',
    coverage: 'testing',
    mock: 'testing',
    assert: 'testing',
    spec: 'testing',
    unit: 'testing',
    docker: 'deploy',
    kubernetes: 'deploy',
    ci: 'deploy',
    pipeline: 'deploy',
    deploy: 'deploy',
    container: 'deploy',
    helm: 'deploy',
    xss: 'security',
    csrf: 'security',
    encryption: 'security',
    vulnerability: 'security',
    sanitize: 'security',
    cors: 'security',
    firewall: 'security',
    cache: 'performance',
    latency: 'performance',
    throughput: 'performance',
    optimize: 'performance',
    optimization: 'performance',
    profiling: 'performance',
    benchmark: 'performance',
    react: 'frontend',
    component: 'frontend',
    css: 'frontend',
    html: 'frontend',
    ui: 'frontend',
    ux: 'frontend',
    tailwind: 'frontend',
  };

  return {
    getDimensions: () => dimensions,
    async embed(text: string): Promise<number[]> {
      const words = text.toLowerCase().split(/\W+/).filter(Boolean);
      const vec = new Array(dimensions).fill(0);

      // Accumulate topic vectors
      for (const word of words) {
        const topic = keywords[word];
        if (topic && topicVectors[topic]) {
          const tv = topicVectors[topic]!;
          for (let i = 0; i < Math.min(tv.length, dimensions); i++) {
            vec[i] += tv[i]!;
          }
        }
      }

      // Add some text-specific noise so different texts aren't identical
      for (let i = 0; i < dimensions; i++) {
        let hash = 0;
        for (let j = 0; j < text.length; j++) {
          hash = ((hash << 5) - hash + text.charCodeAt(j) + i * 17) | 0;
        }
        vec[i] += Math.sin(hash) * 0.1;
      }

      // Normalize
      const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
      return norm > 0 ? vec.map((v: number) => v / norm) : vec.map(() => 1 / Math.sqrt(dimensions));
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return Promise.all(texts.map((t) => this.embed(t)));
    },
  };
}

// ── Corpus & benchmark data ────────────────────────────────────────

interface BenchmarkEntry {
  query: string;
  /** Source IDs that are considered relevant answers. */
  relevantSourceIds: string[];
}

const CORPUS = [
  {
    id: 'auth-jwt',
    content:
      'JWT authentication implementation with access and refresh tokens. Uses RS256 signing.',
    sourceType: 'doc' as const,
    tags: ['auth'],
  },
  {
    id: 'auth-bcrypt',
    content: 'Password hashing using bcrypt with salt rounds of 12. Secure password storage.',
    sourceType: 'doc' as const,
    tags: ['auth', 'security'],
  },
  {
    id: 'auth-oauth',
    content: 'OAuth 2.0 integration with GitHub and Google providers for social login.',
    sourceType: 'doc' as const,
    tags: ['auth'],
  },
  {
    id: 'db-schema',
    content: 'SQLite database schema with migrations. Tables for users, sessions, and tasks.',
    sourceType: 'doc' as const,
    tags: ['database'],
  },
  {
    id: 'db-index',
    content:
      'Database indexing strategy: composite indexes on frequently queried columns for performance.',
    sourceType: 'doc' as const,
    tags: ['database', 'performance'],
  },
  {
    id: 'api-rest',
    content: 'REST API endpoints following OpenAPI 3.0 specification. Versioned at /api/v1/.',
    sourceType: 'doc' as const,
    tags: ['api'],
  },
  {
    id: 'api-graphql',
    content: 'GraphQL API with schema-first design. Resolvers for user, task, and channel queries.',
    sourceType: 'doc' as const,
    tags: ['api'],
  },
  {
    id: 'test-unit',
    content:
      'Unit testing with Vitest. Coverage threshold at 80%. Snapshot tests for UI components.',
    sourceType: 'doc' as const,
    tags: ['testing'],
  },
  {
    id: 'test-e2e',
    content:
      'End-to-end testing with Playwright. Tests for authentication flow, task creation, and chat.',
    sourceType: 'doc' as const,
    tags: ['testing'],
  },
  {
    id: 'deploy-docker',
    content:
      'Docker containerization with multi-stage builds. Image size optimized to under 200MB.',
    sourceType: 'doc' as const,
    tags: ['deploy'],
  },
  {
    id: 'deploy-k8s',
    content: 'Kubernetes deployment with Helm charts. Horizontal pod autoscaler configured.',
    sourceType: 'doc' as const,
    tags: ['deploy'],
  },
  {
    id: 'security-xss',
    content:
      'XSS prevention: input sanitization, Content Security Policy headers, and output encoding.',
    sourceType: 'doc' as const,
    tags: ['security'],
  },
  {
    id: 'security-cors',
    content: 'CORS configuration: allowed origins, methods, and headers. Credentials mode enabled.',
    sourceType: 'doc' as const,
    tags: ['security', 'api'],
  },
  {
    id: 'perf-cache',
    content:
      'Redis caching layer for API responses. Cache invalidation via pub/sub. TTL-based expiration.',
    sourceType: 'doc' as const,
    tags: ['performance'],
  },
  {
    id: 'perf-profiling',
    content:
      'Performance profiling with Node.js built-in profiler. Flame graphs for identifying bottlenecks.',
    sourceType: 'doc' as const,
    tags: ['performance'],
  },
  {
    id: 'frontend-react',
    content:
      'React 19 with Server Components. Tailwind CSS for styling. Zustand for state management.',
    sourceType: 'doc' as const,
    tags: ['frontend'],
  },
];

const BENCHMARKS: BenchmarkEntry[] = [
  {
    query: 'How does JWT authentication work?',
    relevantSourceIds: ['auth-jwt', 'auth-bcrypt', 'auth-oauth'],
  },
  {
    query: 'What database indexes are used?',
    relevantSourceIds: ['db-index', 'db-schema'],
  },
  {
    query: 'REST API endpoints and design',
    relevantSourceIds: ['api-rest', 'api-graphql'],
  },
  {
    query: 'How to run tests?',
    relevantSourceIds: ['test-unit', 'test-e2e'],
  },
  {
    query: 'Docker deployment configuration',
    relevantSourceIds: ['deploy-docker', 'deploy-k8s'],
  },
  {
    query: 'Security vulnerabilities and prevention',
    relevantSourceIds: ['security-xss', 'security-cors', 'auth-bcrypt'],
  },
  {
    query: 'Performance optimization and caching',
    relevantSourceIds: ['perf-cache', 'perf-profiling', 'db-index'],
  },
  {
    query: 'Frontend React component architecture',
    relevantSourceIds: ['frontend-react'],
  },
];

// ── Metric helpers ─────────────────────────────────────────────────

function precisionAtK(retrieved: string[], relevant: Set<string>, k: number): number {
  const topK = retrieved.slice(0, k);
  const hits = topK.filter((id) => relevant.has(id)).length;
  return hits / k;
}

function recallAtK(retrieved: string[], relevant: Set<string>, k: number): number {
  const topK = retrieved.slice(0, k);
  const hits = topK.filter((id) => relevant.has(id)).length;
  return relevant.size > 0 ? hits / relevant.size : 0;
}

function meanReciprocalRank(retrieved: string[], relevant: Set<string>): number {
  for (let i = 0; i < retrieved.length; i++) {
    if (relevant.has(retrieved[i]!)) {
      return 1 / (i + 1);
    }
  }
  return 0;
}

// ── Tests ──────────────────────────────────────────────────────────

describe('RAG Retrieval Quality Benchmarks', () => {
  let db: Database.Database;
  let store: SQLiteVectorStore;
  let service: RAGServiceImpl;

  beforeAll(async () => {
    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    store = new SQLiteVectorStore(db);
    service = new RAGServiceImpl({
      embedder: createSemanticEmbedder(),
      vectorStore: store,
      defaultTopK: 10,
      minScore: 0,
    });
    await service.initialize();

    // Ingest the full corpus
    for (const entry of CORPUS) {
      await service.ingestSource(entry.sourceType, entry.id, entry.content, {
        tags: entry.tags,
      });
    }
  });

  afterAll(async () => {
    await service.shutdown();
    db.close();
  });

  it('corpus is fully ingested', async () => {
    const stats = await service.getStats();
    expect(stats.totalChunks).toBeGreaterThanOrEqual(CORPUS.length);
  });

  // ── Per-query benchmarks ─────────────────────────────────────────

  for (const benchmark of BENCHMARKS) {
    describe(`Query: "${benchmark.query}"`, () => {
      it('retrieves at least one relevant result in top 5', async () => {
        const response = await service.search({
          query: benchmark.query,
          limit: 5,
        });

        const retrievedIds = response.results.map((r) => r.metadata.sourceId);
        const relevant = new Set(benchmark.relevantSourceIds);
        const recall = recallAtK(retrievedIds, relevant, 5);

        expect(recall).toBeGreaterThan(0);
      });

      it('has non-zero precision@5', async () => {
        const response = await service.search({
          query: benchmark.query,
          limit: 5,
        });

        const retrievedIds = response.results.map((r) => r.metadata.sourceId);
        const relevant = new Set(benchmark.relevantSourceIds);
        const precision = precisionAtK(retrievedIds, relevant, Math.min(5, retrievedIds.length));

        expect(precision).toBeGreaterThan(0);
      });

      it('has non-zero MRR', async () => {
        const response = await service.search({
          query: benchmark.query,
          limit: 10,
        });

        const retrievedIds = response.results.map((r) => r.metadata.sourceId);
        const relevant = new Set(benchmark.relevantSourceIds);
        const mrr = meanReciprocalRank(retrievedIds, relevant);

        expect(mrr).toBeGreaterThan(0);
      });
    });
  }

  // ── Aggregate quality metrics ────────────────────────────────────

  describe('aggregate quality metrics', () => {
    it('mean precision@5 >= 0.15 across all benchmarks', async () => {
      let totalPrecision = 0;

      for (const benchmark of BENCHMARKS) {
        const response = await service.search({
          query: benchmark.query,
          limit: 5,
        });

        const retrievedIds = response.results.map((r) => r.metadata.sourceId);
        const relevant = new Set(benchmark.relevantSourceIds);
        totalPrecision += precisionAtK(retrievedIds, relevant, Math.min(5, retrievedIds.length));
      }

      const meanPrecision = totalPrecision / BENCHMARKS.length;
      expect(meanPrecision).toBeGreaterThanOrEqual(0.15);
    });

    it('mean recall@10 >= 0.2 across all benchmarks', async () => {
      let totalRecall = 0;

      for (const benchmark of BENCHMARKS) {
        const response = await service.search({
          query: benchmark.query,
          limit: 10,
        });

        const retrievedIds = response.results.map((r) => r.metadata.sourceId);
        const relevant = new Set(benchmark.relevantSourceIds);
        totalRecall += recallAtK(retrievedIds, relevant, Math.min(10, retrievedIds.length));
      }

      const meanRecall = totalRecall / BENCHMARKS.length;
      expect(meanRecall).toBeGreaterThanOrEqual(0.2);
    });

    it('mean MRR >= 0.2 across all benchmarks', async () => {
      let totalMRR = 0;

      for (const benchmark of BENCHMARKS) {
        const response = await service.search({
          query: benchmark.query,
          limit: 10,
        });

        const retrievedIds = response.results.map((r) => r.metadata.sourceId);
        const relevant = new Set(benchmark.relevantSourceIds);
        totalMRR += meanReciprocalRank(retrievedIds, relevant);
      }

      const avgMRR = totalMRR / BENCHMARKS.length;
      expect(avgMRR).toBeGreaterThanOrEqual(0.2);
    });
  });

  // ── Topic isolation ──────────────────────────────────────────────

  describe('topic isolation', () => {
    it('auth query does not return deploy results in top 3', async () => {
      const response = await service.search({
        query: 'JWT authentication tokens',
        limit: 3,
      });

      const sourceIds = response.results.map((r) => r.metadata.sourceId);
      expect(sourceIds).not.toContain('deploy-docker');
      expect(sourceIds).not.toContain('deploy-k8s');
    });

    it('database query does not return frontend results in top 3', async () => {
      const response = await service.search({
        query: 'SQL database schema migration',
        limit: 3,
      });

      const sourceIds = response.results.map((r) => r.metadata.sourceId);
      expect(sourceIds).not.toContain('frontend-react');
    });
  });
});
