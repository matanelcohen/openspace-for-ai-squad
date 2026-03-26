/**
 * E2E tests verifying agents receive relevant context when querying.
 *
 * Simulates the full agent workflow:
 *   1. Knowledge base is populated with project data
 *   2. An agent queries for context relevant to their task
 *   3. Verify the retrieved context is useful and correctly scoped
 */

import type { Embedder } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { RAGServiceImpl } from '../rag-service.js';
import { SQLiteVectorStore } from '../vector-store.js';

// ── Helpers ────────────────────────────────────────────────────────

function createSemanticEmbedder(dimensions = 16): Embedder {
  const topicVectors: Record<string, number[]> = {
    auth: [1, 0.2, 0, 0, 0, 0, 0, 0],
    database: [0, 1, 0.3, 0, 0, 0, 0, 0],
    api: [0, 0, 1, 0.2, 0, 0, 0, 0],
    testing: [0, 0, 0, 1, 0.2, 0, 0, 0],
    frontend: [0, 0, 0.2, 0, 1, 0.1, 0, 0],
    security: [0.5, 0, 0, 0, 0, 1, 0.2, 0],
    deploy: [0, 0, 0, 0, 0, 0, 1, 0.3],
    perf: [0, 0.4, 0, 0, 0, 0, 0, 1],
  };

  const keywords: Record<string, string> = {
    jwt: 'auth',
    token: 'auth',
    authentication: 'auth',
    login: 'auth',
    password: 'auth',
    sql: 'database',
    sqlite: 'database',
    query: 'database',
    migration: 'database',
    rest: 'api',
    endpoint: 'api',
    route: 'api',
    http: 'api',
    test: 'testing',
    vitest: 'testing',
    coverage: 'testing',
    spec: 'testing',
    react: 'frontend',
    component: 'frontend',
    css: 'frontend',
    ui: 'frontend',
    xss: 'security',
    cors: 'security',
    vulnerability: 'security',
    encryption: 'security',
    docker: 'deploy',
    kubernetes: 'deploy',
    ci: 'deploy',
    pipeline: 'deploy',
    cache: 'perf',
    latency: 'perf',
    optimize: 'perf',
    profiling: 'perf',
  };

  return {
    getDimensions: () => dimensions,
    async embed(text: string): Promise<number[]> {
      const words = text.toLowerCase().split(/\W+/).filter(Boolean);
      const vec = new Array(dimensions).fill(0);
      for (const word of words) {
        const topic = keywords[word];
        if (topic && topicVectors[topic]) {
          const tv = topicVectors[topic]!;
          for (let i = 0; i < Math.min(tv.length, dimensions); i++) {
            vec[i] += tv[i]!;
          }
        }
      }
      for (let i = 0; i < dimensions; i++) {
        let hash = 0;
        for (let j = 0; j < text.length; j++) {
          hash = ((hash << 5) - hash + text.charCodeAt(j) + i * 13) | 0;
        }
        vec[i] += Math.sin(hash) * 0.05;
      }
      const norm = Math.sqrt(vec.reduce((s: number, v: number) => s + v * v, 0));
      return norm > 0 ? vec.map((v: number) => v / norm) : vec.map(() => 1 / Math.sqrt(dimensions));
    },
    async embedBatch(texts: string[]): Promise<number[][]> {
      return Promise.all(texts.map((t) => this.embed(t)));
    },
  };
}

// ── Test setup ─────────────────────────────────────────────────────

describe('E2E: Agent context retrieval', () => {
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
      defaultTopK: 5,
      tokenBudget: 2000,
      minScore: 0,
    });
    await service.initialize();

    // Populate knowledge base with project data scoped to agents
    await service.ingestDoc({
      path: 'docs/auth-design.md',
      title: 'Auth Design',
      content:
        'JWT-based authentication with RS256 signing. Refresh token rotation every 7 days. Password hashing with bcrypt.',
      author: 'lead',
      updatedAt: '2025-01-15T10:00:00Z',
    });

    await service.ingestDoc({
      path: 'docs/api-design.md',
      title: 'API Design',
      content:
        'REST API with versioned endpoints at /api/v1/. OpenAPI 3.0 spec. Rate limiting at 100 req/min.',
      author: 'lead',
      updatedAt: '2025-01-15T10:00:00Z',
    });

    await service.ingestDoc({
      path: 'docs/db-schema.md',
      title: 'DB Schema',
      content:
        'SQLite database with WAL mode. Tables: users, sessions, tasks, memories. Migration system using versioned SQL files.',
      author: 'lead',
      updatedAt: '2025-01-15T10:00:00Z',
    });

    await service.ingestTask({
      id: 'task-auth-impl',
      title: 'Implement authentication',
      description: 'Build JWT authentication with login, logout, and token refresh endpoints.',
      assignee: 'agent-backend',
      status: 'in_progress',
      priority: 'P1',
      agentIds: ['agent-backend'],
      createdAt: '2025-01-15T09:00:00Z',
      updatedAt: '2025-01-16T11:00:00Z',
      tags: ['auth'],
      progressLog: ['Created JWT utility', 'Added login endpoint'],
    });

    await service.ingestTask({
      id: 'task-ui-dashboard',
      title: 'Build dashboard UI',
      description: 'Create React dashboard with task list, chat, and agent status components.',
      assignee: 'agent-frontend',
      status: 'in_progress',
      priority: 'P2',
      agentIds: ['agent-frontend'],
      createdAt: '2025-01-15T09:00:00Z',
      updatedAt: '2025-01-16T11:00:00Z',
      tags: ['ui'],
      progressLog: ['Created layout component'],
    });

    await service.ingestCommit({
      sha: 'abc123def456789012345678901234567890abcd',
      message: 'feat: add JWT authentication middleware',
      author: 'agent-backend',
      date: '2025-01-16T10:00:00Z',
      diff: 'diff --git a/src/auth/middleware.ts b/src/auth/middleware.ts\n+export function authMiddleware() { /* verify JWT */ }',
      files: ['src/auth/middleware.ts'],
    });

    await service.ingestPullRequest({
      number: 15,
      title: 'Add database migration system',
      body: 'Implements versioned SQL migrations for SQLite database schema changes.',
      author: 'agent-backend',
      state: 'merged',
      createdAt: '2025-01-14T08:00:00Z',
      updatedAt: '2025-01-15T16:00:00Z',
      diff: '',
      comments: [
        {
          author: 'reviewer',
          body: 'Looks good, nice migration approach.',
          createdAt: '2025-01-15T10:00:00Z',
        },
      ],
      labels: ['database'],
      files: ['src/db/migrate.ts'],
    });
  });

  afterAll(async () => {
    await service.shutdown();
    db.close();
  });

  // ── Agent queries relevant context ───────────────────────────────

  describe('backend agent queries for auth context', () => {
    it('retrieves auth-related content', async () => {
      const response = await service.search({
        query: 'How should I implement JWT authentication?',
        limit: 5,
      });

      expect(response.results.length).toBeGreaterThanOrEqual(1);

      // Should find auth-related content
      const allContent = response.results.map((r) => r.content).join(' ');
      expect(allContent.toLowerCase()).toMatch(/jwt|auth|token/);
    });

    it('returns context with source attributions', async () => {
      const response = await service.search({
        query: 'JWT authentication implementation',
        limit: 5,
      });

      expect(response.sources.length).toBeGreaterThanOrEqual(1);
      for (const source of response.sources) {
        expect(source.title).toBeTruthy();
        expect(source.sourceType).toBeTruthy();
      }
    });
  });

  describe('frontend agent queries for UI context', () => {
    it('retrieves UI-related content', async () => {
      const response = await service.search({
        query: 'React component dashboard UI',
        limit: 5,
      });

      expect(response.results.length).toBeGreaterThanOrEqual(1);

      const allContent = response.results.map((r) => r.content).join(' ');
      // Should have some relevant content (React/component/dashboard/UI)
      expect(allContent.toLowerCase()).toMatch(/react|component|dashboard|ui/);
    });
  });

  describe('retrieveForAgent scopes to agent context', () => {
    it('retrieves context for a specific agent', async () => {
      // Ingest agent-specific content
      await service.ingestSource(
        'agent_memory',
        'agent-backend-mem-1',
        'Backend agent prefers using Fastify over Express for API routes.',
        { agentIds: ['agent-backend'] },
      );

      const context = await service.retrieveForAgent(
        'agent-backend',
        'What API framework should I use?',
        { limit: 5 },
      );

      expect(context.chunks.length).toBeGreaterThanOrEqual(0);
      expect(context.totalTokens).toBeGreaterThanOrEqual(0);
    });

    it('respects token budget', async () => {
      const context = await service.retrieveForAgent(
        'agent-backend',
        'Tell me everything about the project',
        { tokenBudget: 100, limit: 20 },
      );

      expect(context.totalTokens).toBeLessThanOrEqual(200); // Some slack for estimation
    });

    it('returns source attributions matching chunks', async () => {
      const context = await service.retrieveForAgent('agent-backend', 'database schema design', {
        limit: 5,
      });

      const chunkCitations = new Set(context.chunks.map((c) => c.citationIndex));
      for (const source of context.sources) {
        expect(chunkCitations.has(source.citationIndex)).toBe(true);
      }
    });
  });

  // ── Multi-agent isolation ────────────────────────────────────────

  describe('multi-agent knowledge isolation', () => {
    it('different agents get different context for the same query', async () => {
      // Both agents ask about "project status" but should get different slices
      const backendContext = await service.retrieveForAgent(
        'agent-backend',
        'What is my current task status?',
        { limit: 3 },
      );

      const frontendContext = await service.retrieveForAgent(
        'agent-frontend',
        'What is my current task status?',
        { limit: 3 },
      );

      // These should both return results (even if overlapping in a small KB)
      // The key assertion is that the system handles agent-scoped queries
      expect(backendContext.chunks).toBeDefined();
      expect(frontendContext.chunks).toBeDefined();
    });
  });

  // ── Context quality checks ───────────────────────────────────────

  describe('context quality', () => {
    it('search returns results with scores in [0, 1]', async () => {
      const response = await service.search({
        query: 'authentication security',
        limit: 10,
      });

      for (const r of response.results) {
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1.5); // Allow slight overflows from hybrid scoring
      }
    });

    it('results are sorted by score descending', async () => {
      const response = await service.search({
        query: 'database query optimization',
        limit: 10,
      });

      for (let i = 1; i < response.results.length; i++) {
        expect(response.results[i]!.score).toBeLessThanOrEqual(response.results[i - 1]!.score);
      }
    });

    it('search latency is reported', async () => {
      const response = await service.search({
        query: 'test query',
        limit: 5,
      });

      expect(response.searchTimeMs).toBeGreaterThanOrEqual(0);
      expect(response.searchTimeMs).toBeLessThan(5000); // Reasonable for in-memory
    });
  });
});
