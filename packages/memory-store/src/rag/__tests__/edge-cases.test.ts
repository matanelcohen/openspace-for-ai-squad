/**
 * Edge case tests for the RAG pipeline.
 *
 * Covers: empty repos, large diffs, non-English content,
 * concurrent ingestion, extreme inputs, and boundary conditions.
 */

import type { Embedder } from '@openspace/shared';
import type Database from 'better-sqlite3';
import BetterSqlite3 from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { chunkText, estimateTokens } from '../chunker.js';
import { ingestCommit, ingestDoc, ingestPullRequest, ingestTask } from '../connectors.js';
import { RAGServiceImpl } from '../rag-service.js';
import { SQLiteVectorStore } from '../vector-store.js';

// ── Helpers ────────────────────────────────────────────────────────

function createEmbedder(dimensions = 8): Embedder {
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

const baseMetadata = {
  sourceType: 'doc' as const,
  sourceId: 'test',
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
};

// ── Empty / Minimal Input Tests ────────────────────────────────────

describe('Edge cases: empty/minimal inputs', () => {
  describe('empty repo simulation', () => {
    it('handles commit with no files and no diff', () => {
      const inputs = ingestCommit({
        sha: 'abc123',
        message: 'Initial empty commit',
        author: 'dev',
        date: '2025-01-01T00:00:00Z',
        diff: '',
        files: [],
      });
      // Should still produce a summary chunk for the message
      expect(inputs.length).toBe(1);
    });

    it('handles completely empty commit', () => {
      const inputs = ingestCommit({
        sha: 'empty',
        message: '',
        author: 'dev',
        date: '2025-01-01T00:00:00Z',
        diff: '',
        files: [],
      });
      expect(inputs).toEqual([]);
    });

    it('handles empty PR', () => {
      const inputs = ingestPullRequest({
        number: 1,
        title: 'Empty PR',
        body: '',
        author: 'dev',
        state: 'open',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        diff: '',
        comments: [],
        labels: [],
        files: [],
      });
      // Summary chunk should still be created
      expect(inputs.length).toBe(1);
      expect(inputs[0]!.content).toContain('(no description)');
    });

    it('handles empty task', () => {
      const inputs = ingestTask({
        id: 'empty-task',
        title: 'Empty task',
        description: '',
        assignee: null,
        status: 'pending',
        priority: null,
        agentIds: [],
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-01T00:00:00Z',
        tags: [],
        progressLog: [],
      });
      expect(inputs.length).toBe(1);
    });
  });

  describe('empty doc', () => {
    it('returns empty for whitespace doc', () => {
      expect(
        ingestDoc({ path: 'test.md', title: 'T', content: '  \n\t ', author: null, updatedAt: '' }),
      ).toEqual([]);
    });
  });
});

// ── Large Input Tests ──────────────────────────────────────────────

describe('Edge cases: large inputs', () => {
  describe('large diff handling', () => {
    it('handles diff with 10,000+ lines', () => {
      const lines = Array.from({ length: 10000 }, (_, i) => `+line ${i}: const x${i} = ${i};`);
      const diff = [
        'diff --git a/huge.ts b/huge.ts',
        '--- /dev/null',
        '+++ b/huge.ts',
        '@@ -0,0 +1,10000 @@',
        ...lines,
      ].join('\n');

      const inputs = ingestCommit({
        sha: 'large-diff-sha',
        message: 'feat: massive file',
        author: 'dev',
        date: '2025-01-01T00:00:00Z',
        diff,
        files: ['huge.ts'],
      });

      // Should produce summary + diff chunk
      expect(inputs.length).toBe(2);
      const diffChunk = inputs.find((i) => i.metadata.filePath === 'huge.ts');
      expect(diffChunk).toBeDefined();
      expect(diffChunk!.content.length).toBeGreaterThan(50000);
    });

    it('chunker splits large content into multiple chunks', () => {
      const largeContent = 'Paragraph content. '.repeat(5000);
      const chunks = chunkText(
        { sourceId: 'large', content: largeContent, metadata: baseMetadata },
        { targetTokens: 200, maxTokens: 400, overlapTokens: 20 },
      );

      expect(chunks.length).toBeGreaterThan(10);
      // Each chunk should be within bounds
      for (const chunk of chunks) {
        expect(chunk.tokenCount).toBeLessThan(600); // Allow for overlap
      }
    });

    it('handles 100+ file commit diff', () => {
      const fileDiffs = Array.from({ length: 150 }, (_, i) =>
        [
          `diff --git a/file${i}.ts b/file${i}.ts`,
          `--- a/file${i}.ts`,
          `+++ b/file${i}.ts`,
          `+export const f${i} = ${i};`,
        ].join('\n'),
      ).join('\n');

      const inputs = ingestCommit({
        sha: 'many-files',
        message: 'chore: update all files',
        author: 'dev',
        date: '2025-01-01T00:00:00Z',
        diff: fileDiffs,
        files: Array.from({ length: 150 }, (_, i) => `file${i}.ts`),
      });

      // 1 summary + 150 file diffs
      expect(inputs.length).toBe(151);
    });
  });

  describe('large PR with many comments', () => {
    it('handles PR with 100+ review comments', () => {
      const comments = Array.from({ length: 120 }, (_, i) => ({
        author: `reviewer-${i % 5}`,
        body: `Comment ${i}: This needs review. `.repeat(10),
        createdAt: `2025-01-${String(1 + (i % 28)).padStart(2, '0')}T10:00:00Z`,
      }));

      const inputs = ingestPullRequest({
        number: 99,
        title: 'Large PR',
        body: 'Big change',
        author: 'dev',
        state: 'merged',
        createdAt: '2025-01-01T00:00:00Z',
        updatedAt: '2025-01-30T00:00:00Z',
        diff: '',
        comments,
        labels: [],
        files: [],
      });

      const commentChunk = inputs.find((i) => i.sourceId.includes('comments'));
      expect(commentChunk).toBeDefined();
      expect(commentChunk!.content.length).toBeGreaterThan(1000);
    });
  });
});

// ── Non-English Content Tests ──────────────────────────────────────

describe('Edge cases: non-English content', () => {
  it('chunks Chinese content correctly', () => {
    const content =
      '# 项目架构\n\n本系统采用微服务架构设计。\n\n## 数据层\n\n使用SQLite存储数据，支持WAL模式。\n\n## API层\n\nREST API采用OpenAPI规范。';
    const chunks = chunkText({ sourceId: 'cn-doc', content, metadata: baseMetadata });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.content).toContain('微服务');
    expect(chunks[0]!.tokenCount).toBeGreaterThan(0);
  });

  it('chunks Japanese content correctly', () => {
    const content =
      '# 認証設計\n\nJWTベースの認証システム。リフレッシュトークンのローテーション。\n\n## セキュリティ\n\nbcryptによるパスワードハッシュ化。';
    const chunks = chunkText({ sourceId: 'jp-doc', content, metadata: baseMetadata });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.content).toContain('認証');
  });

  it('chunks Korean content correctly', () => {
    const content =
      '# 프로젝트 구조\n\n마이크로서비스 아키텍처를 채택합니다.\n\n## 데이터베이스\n\nSQLite 데이터베이스를 사용합니다.';
    const chunks = chunkText({ sourceId: 'kr-doc', content, metadata: baseMetadata });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.content).toContain('프로젝트');
  });

  it('handles mixed-language content', () => {
    const content =
      '# Architecture 架构\n\nThis project uses a 微服务 (microservice) architecture.\n\nDatabase: SQLite (数据库)';
    const chunks = chunkText({ sourceId: 'mixed', content, metadata: baseMetadata });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.content).toContain('微服务');
    expect(chunks[0]!.content).toContain('microservice');
  });

  it('handles RTL content (Arabic)', () => {
    const content =
      '# هندسة المشروع\n\nيستخدم هذا النظام بنية الخدمات المصغرة.\n\n## قاعدة البيانات\n\nSQLite مع وضع WAL.';
    const chunks = chunkText({ sourceId: 'ar-doc', content, metadata: baseMetadata });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('handles emoji content', () => {
    const content =
      '# 🚀 Release Notes\n\n✅ Authentication module\n🔧 Bug fixes in API\n📦 Database migration';
    const chunks = chunkText({ sourceId: 'emoji', content, metadata: baseMetadata });

    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.content).toContain('🚀');
  });

  it('ingests non-English commit messages', () => {
    const inputs = ingestCommit({
      sha: 'fr-commit',
      message: "fonctionnalité: ajout du module d'authentification",
      author: 'développeur@example.com',
      date: '2025-01-15T10:00:00Z',
      diff: '',
      files: [],
    });

    expect(inputs.length).toBe(1);
    expect(inputs[0]!.content).toContain('authentification');
  });
});

// ── Concurrent Ingestion Tests ─────────────────────────────────────

describe('Edge cases: concurrent ingestion', () => {
  let db: Database.Database;
  let store: SQLiteVectorStore;
  let service: RAGServiceImpl;

  beforeEach(async () => {
    db = new BetterSqlite3(':memory:');
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    store = new SQLiteVectorStore(db);
    service = new RAGServiceImpl({
      embedder: createEmbedder(),
      vectorStore: store,
      minScore: 0,
    });
    await service.initialize();
  });

  afterEach(async () => {
    await service.shutdown();
    db.close();
  });

  it('handles concurrent document ingestion', async () => {
    const promises = Array.from({ length: 20 }, (_, i) =>
      service.ingestDoc({
        path: `docs/concurrent-${i}.md`,
        title: `Doc ${i}`,
        content: `Content of document ${i} with unique text about topic ${i}.`,
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      }),
    );

    const results = await Promise.all(promises);

    // All should succeed
    for (const result of results) {
      expect(result.chunksCreated).toBeGreaterThan(0);
    }

    const stats = await service.getStats();
    expect(stats.totalChunks).toBeGreaterThanOrEqual(20);
  });

  it('handles concurrent mixed-type ingestion', async () => {
    const promises = [
      service.ingestDoc({
        path: 'docs/concurrent-doc.md',
        title: 'Doc',
        content: 'Concurrent document.',
        author: null,
        updatedAt: '2025-01-15T10:00:00Z',
      }),
      service.ingestCommit({
        sha: 'concurrent-commit',
        message: 'concurrent commit',
        author: 'dev',
        date: '2025-01-15T10:00:00Z',
        diff: '',
        files: [],
      }),
      service.ingestTask({
        id: 'concurrent-task',
        title: 'Concurrent task',
        description: 'A task ingested concurrently.',
        assignee: null,
        status: 'pending',
        priority: null,
        agentIds: [],
        createdAt: '2025-01-15T09:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        tags: [],
        progressLog: [],
      }),
      service.ingestPullRequest({
        number: 100,
        title: 'Concurrent PR',
        body: 'A PR ingested concurrently.',
        author: 'dev',
        state: 'open',
        createdAt: '2025-01-15T08:00:00Z',
        updatedAt: '2025-01-15T10:00:00Z',
        diff: '',
        comments: [],
        labels: [],
        files: [],
      }),
    ];

    const results = await Promise.all(promises);
    for (const result of results) {
      expect(result.chunksCreated).toBeGreaterThan(0);
    }
  });

  it('handles concurrent search and ingestion', async () => {
    // Ingest some baseline data
    await service.ingestDoc({
      path: 'baseline.md',
      title: 'Baseline',
      content: 'Baseline document for search.',
      author: null,
      updatedAt: '2025-01-15T10:00:00Z',
    });

    // Run search and ingestion concurrently
    const searchPromise = service.search({ query: 'baseline', limit: 5 });
    const ingestPromise = service.ingestDoc({
      path: 'concurrent-new.md',
      title: 'New',
      content: 'New document ingested during search.',
      author: null,
      updatedAt: '2025-01-15T10:00:00Z',
    });

    const [searchResult, ingestResult] = await Promise.all([searchPromise, ingestPromise]);

    expect(searchResult.results).toBeDefined();
    expect(ingestResult.chunksCreated).toBeGreaterThan(0);
  });
});

// ── Boundary Condition Tests ───────────────────────────────────────

describe('Edge cases: boundary conditions', () => {
  it('estimateTokens handles extremely long text', () => {
    const longText = 'a'.repeat(1_000_000);
    const tokens = estimateTokens(longText);
    expect(tokens).toBeGreaterThan(200_000);
  });

  it('chunkText handles content with only special characters', () => {
    const chunks = chunkText({
      sourceId: 'special',
      content: '!@#$%^&*()_+-=[]{}|;\':",.<>?/~`',
      metadata: baseMetadata,
    });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
  });

  it('chunkText handles content with only code blocks', () => {
    const content = '```typescript\nconst x = 1;\nconst y = 2;\nconsole.log(x + y);\n```';
    const chunks = chunkText({ sourceId: 'code', content, metadata: baseMetadata });
    expect(chunks.length).toBeGreaterThanOrEqual(1);
    expect(chunks[0]!.content).toContain('const x = 1');
  });

  it('handles commit with extremely long SHA', () => {
    // SHA should be truncated in display
    const inputs = ingestCommit({
      sha: 'a'.repeat(100),
      message: 'test',
      author: 'dev',
      date: '2025-01-01T00:00:00Z',
      diff: '',
      files: [],
    });
    expect(inputs[0]!.content).toContain('aaaaaaaa');
    expect(inputs[0]!.content).not.toContain('a'.repeat(100));
  });

  it('handles task with very long progress log', () => {
    const inputs = ingestTask({
      id: 'long-log',
      title: 'Task with long log',
      description: 'Test task',
      assignee: null,
      status: 'done',
      priority: null,
      agentIds: [],
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      tags: [],
      progressLog: Array.from({ length: 500 }, (_, i) => `Step ${i}: completed action ${i}`),
    });

    const logChunk = inputs.find((i) => i.sourceId.includes('progress'));
    expect(logChunk).toBeDefined();
    expect(logChunk!.content).toContain('Step 0');
    expect(logChunk!.content).toContain('Step 499');
  });

  it('handles PR with very long labels', () => {
    const inputs = ingestPullRequest({
      number: 1,
      title: 'PR',
      body: 'body',
      author: 'dev',
      state: 'open',
      createdAt: '2025-01-01T00:00:00Z',
      updatedAt: '2025-01-01T00:00:00Z',
      diff: '',
      comments: [],
      labels: Array.from({ length: 50 }, (_, i) => `label-${i}`),
      files: [],
    });

    expect(inputs[0]!.metadata.tags.length).toBeGreaterThanOrEqual(50);
  });
});

// ── Token estimation edge cases ────────────────────────────────────

describe('Edge cases: token estimation', () => {
  it('handles zero-width characters', () => {
    const text = 'Hello\u200BWorld\u200B'; // Zero-width space
    expect(estimateTokens(text)).toBeGreaterThan(0);
  });

  it('handles surrogate pairs (emoji)', () => {
    const text = '🎉🚀💻🔥'; // 4 emoji
    expect(estimateTokens(text)).toBeGreaterThan(0);
  });

  it('handles tabs and mixed whitespace', () => {
    const text = 'column1\tcolumn2\tcolumn3\n\tindented\t\tmore';
    expect(estimateTokens(text)).toBeGreaterThan(0);
  });
});
