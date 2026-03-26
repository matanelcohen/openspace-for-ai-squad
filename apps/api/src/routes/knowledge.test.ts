import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type Database from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ── Fixtures ───────────────────────────────────────────────────────

let tmpDir: string;
let app: FastifyInstance;

/** Insert test chunks directly into the database for search testing. */
function seedChunks(appInstance: FastifyInstance) {
  const db = (appInstance as unknown as { db: Database.Database }).db;

  // Ensure RAG tables exist (migration v3)
  db.exec(`
    CREATE TABLE IF NOT EXISTS rag_chunks (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, token_count INTEGER NOT NULL DEFAULT 0,
      source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL DEFAULT 0, chunk_total INTEGER NOT NULL DEFAULT 1,
      squad_path TEXT, file_path TEXT, agent_ids TEXT NOT NULL DEFAULT '[]', author TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]', status TEXT, priority TEXT,
      heading_path TEXT, thread_id TEXT, session_id TEXT
    );
    CREATE TABLE IF NOT EXISTS rag_chunk_embeddings (
      chunk_id TEXT PRIMARY KEY, embedding BLOB NOT NULL,
      dimensions INTEGER NOT NULL, model TEXT NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS ingestion_state (
      source_type TEXT NOT NULL, source_id TEXT NOT NULL,
      content_hash TEXT NOT NULL, chunk_count INTEGER NOT NULL DEFAULT 0,
      ingested_at TEXT NOT NULL, PRIMARY KEY (source_type, source_id)
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS rag_chunks_fts USING fts5(
      id UNINDEXED, content, source_type,
      content='rag_chunks', content_rowid='rowid'
    );
    CREATE TRIGGER IF NOT EXISTS rag_chunks_ai AFTER INSERT ON rag_chunks BEGIN
      INSERT INTO rag_chunks_fts(rowid, id, content, source_type)
      VALUES (new.rowid, new.id, new.content, new.source_type);
    END;
  `);

  const now = new Date().toISOString();
  const chunks = [
    {
      id: 'chunk-auth-1',
      content:
        'JWT authentication is implemented using jsonwebtoken with bcrypt for password hashing. Tokens expire after 24 hours.',
      source_type: 'doc',
      source_id: 'auth-guide',
      author: 'leela',
      tags: '["auth","security"]',
      status: 'active',
      priority: 'P1',
      heading_path: 'Authentication > JWT',
      agent_ids: '["leela","bender"]',
    },
    {
      id: 'chunk-db-1',
      content:
        'SQLite is used as the primary database with FTS5 for full-text search. The database schema is managed through versioned migrations.',
      source_type: 'doc',
      source_id: 'db-guide',
      author: 'bender',
      tags: '["database","sqlite"]',
      status: 'active',
      priority: 'P2',
      heading_path: 'Database > SQLite',
      agent_ids: '["bender"]',
    },
    {
      id: 'chunk-api-1',
      content:
        'The REST API is built with Fastify 5. Endpoints follow RESTful conventions with JSON request/response bodies.',
      source_type: 'doc',
      source_id: 'api-guide',
      author: 'bender',
      tags: '["api","fastify"]',
      status: 'active',
      priority: 'P2',
      heading_path: 'API > REST',
      agent_ids: '["bender","fry"]',
    },
    {
      id: 'chunk-deploy-1',
      content:
        'Deployment uses Docker containers orchestrated by Kubernetes. Health checks are configured on the /health endpoint.',
      source_type: 'task',
      source_id: 'deploy-setup',
      author: 'leela',
      tags: '["deploy","kubernetes"]',
      status: 'done',
      priority: 'P1',
      heading_path: 'Deployment',
      agent_ids: '["leela"]',
    },
    {
      id: 'chunk-commit-1',
      content:
        'fix: resolve JWT token refresh race condition that caused intermittent 401 errors during concurrent requests',
      source_type: 'commit',
      source_id: 'abc123',
      author: 'bender',
      tags: '["bugfix"]',
      status: null,
      priority: null,
      heading_path: null,
      agent_ids: '["bender"]',
    },
  ];

  const insert = db.prepare(`
    INSERT OR REPLACE INTO rag_chunks
      (id, content, token_count, source_type, source_id, chunk_index, chunk_total,
       squad_path, file_path, agent_ids, author, created_at, updated_at,
       tags, status, priority, heading_path, thread_id, session_id)
    VALUES (?, ?, ?, ?, ?, 0, 1, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)
  `);

  for (const c of chunks) {
    const tokenCount = Math.ceil(c.content.length / 4);
    insert.run(
      c.id,
      c.content,
      tokenCount,
      c.source_type,
      c.source_id,
      c.agent_ids,
      c.author,
      now,
      now,
      c.tags,
      c.status,
      c.priority,
      c.heading_path,
    );
  }

  // Seed one embedding for vector search test
  const dims = 8;
  const embedding = new Float64Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8]);
  const buf = Buffer.from(embedding.buffer);
  db.prepare(
    `INSERT OR REPLACE INTO rag_chunk_embeddings (chunk_id, embedding, dimensions, model, created_at) VALUES (?, ?, ?, ?, ?)`,
  ).run('chunk-auth-1', buf, dims, 'test-model', now);

  // Seed ingestion state
  db.prepare(
    `INSERT OR REPLACE INTO ingestion_state (source_type, source_id, content_hash, chunk_count, ingested_at) VALUES (?, ?, ?, ?, ?)`,
  ).run('doc', 'auth-guide', 'abc', 1, now);
}

// ── Setup / Teardown ───────────────────────────────────────────────

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'knowledge-test-'));

  await fs.writeFile(
    path.join(tmpDir, 'team.md'),
    `# Squad Team\n\n## Members\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n| Leela | Lead | agents/leela/charter.md | ✅ Active |\n`,
    'utf-8',
  );

  await fs.writeFile(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ version: 1, allowedModels: ['gpt-5.4'], defaultModel: 'gpt-5.4' }),
    'utf-8',
  );

  app = buildApp({ logger: false, squadDir: tmpDir });
  await app.ready();
  seedChunks(app);
});

afterEach(async () => {
  await app.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ── POST /api/knowledge/search ─────────────────────────────────────

describe('POST /api/knowledge/search', () => {
  it('returns 400 when query is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: {},
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when query is empty string', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: { query: '   ' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when limit is out of range', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: { query: 'test', limit: 200 },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('limit');
  });

  it('searches chunks via FTS keyword match', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: { query: 'JWT authentication' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('results');
    expect(body).toHaveProperty('totalTokens');
    expect(body).toHaveProperty('sources');
    expect(body).toHaveProperty('searchTimeMs');
    expect(Array.isArray(body.results)).toBe(true);

    // Should find the auth chunk
    const authResult = body.results.find(
      (r: { metadata: { sourceId: string } }) => r.metadata.sourceId === 'auth-guide',
    );
    expect(authResult).toBeDefined();
    expect(authResult.score).toBeGreaterThan(0);
    expect(authResult.citationIndex).toBeGreaterThanOrEqual(1);
  });

  it('returns matching sources with attribution', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: { query: 'SQLite database' },
    });

    const body = res.json();
    expect(body.sources.length).toBeGreaterThan(0);

    const source = body.sources[0];
    expect(source).toHaveProperty('citationIndex');
    expect(source).toHaveProperty('sourceType');
    expect(source).toHaveProperty('sourceId');
    expect(source).toHaveProperty('title');
  });

  it('filters by source type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: {
        query: 'authentication',
        filters: { sourceType: 'commit' },
      },
    });

    const body = res.json();
    for (const result of body.results) {
      expect(result.metadata.sourceType).toBe('commit');
    }
  });

  it('filters by date range', async () => {
    const futureDate = '2099-01-01T00:00:00.000Z';
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: {
        query: 'authentication',
        filters: { dateRange: { from: futureDate } },
      },
    });

    const body = res.json();
    expect(body.results).toEqual([]);
  });

  it('filters by author via agent scope', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: {
        query: 'database',
        agentId: 'bender',
      },
    });

    const body = res.json();
    for (const result of body.results) {
      // Chunks should either have no agent restriction or include bender
      const ids = result.metadata.agentIds;
      expect(ids.length === 0 || ids.includes('bender')).toBe(true);
    }
  });

  it('respects limit parameter', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: { query: 'the', limit: 2 },
    });

    const body = res.json();
    expect(body.results.length).toBeLessThanOrEqual(2);
  });

  it('respects token budget', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: { query: 'authentication', tokenBudget: 30 },
    });

    const body = res.json();
    expect(body.totalTokens).toBeLessThanOrEqual(30);
  });

  it('returns searchTimeMs', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/search',
      payload: { query: 'Fastify REST API' },
    });

    const body = res.json();
    expect(typeof body.searchTimeMs).toBe('number');
    expect(body.searchTimeMs).toBeGreaterThanOrEqual(0);
  });
});

// ── POST /api/knowledge/retrieve ───────────────────────────────────

describe('POST /api/knowledge/retrieve', () => {
  it('returns 400 when agentId is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/retrieve',
      payload: { query: 'test' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('agentId');
  });

  it('returns 400 when query is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/retrieve',
      payload: { agentId: 'bender' },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('query');
  });

  it('retrieves context for a specific agent', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/knowledge/retrieve',
      payload: { agentId: 'bender', query: 'database migrations' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('chunks');
    expect(body).toHaveProperty('totalTokens');
    expect(body).toHaveProperty('sources');
    expect(Array.isArray(body.chunks)).toBe(true);
  });
});

// ── GET /api/knowledge/stats ───────────────────────────────────────

describe('GET /api/knowledge/stats', () => {
  it('returns knowledge base statistics', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/knowledge/stats',
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty('totalChunks');
    expect(body).toHaveProperty('chunksBySourceType');
    expect(body).toHaveProperty('totalEmbeddings');
    expect(body).toHaveProperty('lastIngestedAt');
    expect(body.totalChunks).toBe(5);
    expect(body.totalEmbeddings).toBe(1);
    expect(body.chunksBySourceType.doc).toBe(3);
    expect(body.chunksBySourceType.task).toBe(1);
    expect(body.chunksBySourceType.commit).toBe(1);
    expect(body.lastIngestedAt).toBeTruthy();
  });
});
