/**
 * Integration tests — Error handling
 *
 * Tests 404s, 400s, malformed requests, and edge cases across all endpoints.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, createTempSquadDir, FIXTURE_SQUAD_DIR, getEmptySquadDir, injectJSON } from '../helpers/setup.js';
import { cleanupTempDir } from '../helpers/teardown.js';

describe('Error Handling', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp(FIXTURE_SQUAD_DIR);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────
  // 404 — Not Found
  // ─────────────────────────────────────────────────────────────

  describe('404 — Not Found', () => {
    it('returns 404 for unknown routes', async () => {
      const { statusCode } = await injectJSON(app, 'GET', '/api/nonexistent');
      expect(statusCode).toBe(404);
    });

    it('returns 404 for GET /api/agents/:id with unknown agent', async () => {
      const { statusCode } = await injectJSON(app, 'GET', '/api/agents/nobody');
      expect(statusCode).toBe(404);
    });

    it('returns 404 for GET /api/tasks/:id with unknown task', async () => {
      const { statusCode } = await injectJSON(app, 'GET', '/api/tasks/task-does-not-exist');
      expect(statusCode).toBe(404);
    });

    it('returns 404 for GET /api/decisions/:id with unknown decision', async () => {
      const { statusCode } = await injectJSON(
        app,
        'GET',
        '/api/decisions/decision-does-not-exist',
      );
      expect(statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // 400 — Bad Request
  // ─────────────────────────────────────────────────────────────

  describe('400 — Bad Request', () => {
    let writeApp: FastifyInstance;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempSquadDir();
      writeApp = await buildTestApp(tempDir);
    });

    afterEach(async () => {
      await writeApp.close();
      await cleanupTempDir(tempDir);
    });

    it('POST /api/tasks without title returns 400', async () => {
      const { statusCode } = await injectJSON(writeApp, 'POST', '/api/tasks', {
        description: 'Missing title',
      });
      expect(statusCode).toBe(400);
    });

    it('POST /api/tasks with empty body returns 400', async () => {
      const { statusCode } = await injectJSON(writeApp, 'POST', '/api/tasks', {});
      expect(statusCode).toBe(400);
    });

    it('POST /api/tasks with empty title returns 400', async () => {
      const { statusCode } = await injectJSON(writeApp, 'POST', '/api/tasks', {
        title: '',
      });
      expect(statusCode).toBe(400);
    });

    it('PATCH /api/tasks/:id/status with invalid status returns 400', async () => {
      const { statusCode } = await injectJSON(
        writeApp,
        'PATCH',
        '/api/tasks/task-fixture-001/status',
        { status: 'mega-done' },
      );
      expect(statusCode).toBe(400);
    });

    it('PATCH /api/tasks/:id/priority with non-numeric sortIndex returns 400', async () => {
      const { statusCode } = await injectJSON(
        writeApp,
        'PATCH',
        '/api/tasks/task-fixture-001/priority',
        { sortIndex: 'not-a-number' },
      );
      expect(statusCode).toBe(400);
    });

    it('PATCH /api/tasks/:id/priority without sortIndex returns 400', async () => {
      const { statusCode } = await injectJSON(
        writeApp,
        'PATCH',
        '/api/tasks/task-fixture-001/priority',
        {},
      );
      expect(statusCode).toBe(400);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Malformed requests
  // ─────────────────────────────────────────────────────────────

  describe('Malformed requests', () => {
    it('handles non-JSON content type gracefully', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { 'content-type': 'text/plain' },
        body: 'this is not json',
      });

      // Fastify should return 400 or 415 for non-JSON body
      expect([400, 415]).toContain(response.statusCode);
    });

    it('handles request with invalid JSON body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/tasks',
        headers: { 'content-type': 'application/json' },
        body: '{ invalid json }',
      });

      expect([400, 415]).toContain(response.statusCode);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Empty .squad/ directory
  // ─────────────────────────────────────────────────────────────

  describe('Empty .squad/ directory', () => {
    let emptyApp: FastifyInstance;

    beforeEach(async () => {
      const emptyDir = await getEmptySquadDir();
      emptyApp = await buildTestApp(emptyDir);
    });

    afterEach(async () => {
      await emptyApp.close();
    });

    it('GET /api/agents returns empty array', async () => {
      const { statusCode, body } = await injectJSON<unknown[]>(
        emptyApp,
        'GET',
        '/api/agents',
      );
      expect(statusCode).toBe(200);
      expect(body).toEqual([]);
    });

    it('GET /api/tasks returns empty array', async () => {
      const { statusCode, body } = await injectJSON<unknown[]>(
        emptyApp,
        'GET',
        '/api/tasks',
      );
      expect(statusCode).toBe(200);
      expect(body).toEqual([]);
    });

    it('GET /api/decisions returns empty array', async () => {
      const { statusCode, body } = await injectJSON<unknown[]>(
        emptyApp,
        'GET',
        '/api/decisions',
      );
      expect(statusCode).toBe(200);
      expect(body).toEqual([]);
    });

    it('GET /api/squad returns empty overview', async () => {
      const { statusCode, body } = await injectJSON<Record<string, unknown>>(
        emptyApp,
        'GET',
        '/api/squad',
      );
      expect(statusCode).toBe(200);
      expect(body.agents).toEqual([]);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Edge cases
  // ─────────────────────────────────────────────────────────────

  describe('Edge cases', () => {
    let writeApp: FastifyInstance;
    let tempDir: string;

    beforeEach(async () => {
      tempDir = await createTempSquadDir();
      writeApp = await buildTestApp(tempDir);
    });

    afterEach(async () => {
      await writeApp.close();
      await cleanupTempDir(tempDir);
    });

    it('handles very large task descriptions', async () => {
      const largeDescription = 'x'.repeat(50_000);
      const { statusCode, body } = await injectJSON<Record<string, unknown>>(
        writeApp,
        'POST',
        '/api/tasks',
        {
          title: 'Large description task',
          description: largeDescription,
        },
      );

      expect(statusCode).toBe(201);
      expect(typeof body.id).toBe('string');
    });

    it('handles special characters in task titles', async () => {
      const { statusCode, body } = await injectJSON<Record<string, unknown>>(
        writeApp,
        'POST',
        '/api/tasks',
        {
          title: 'Fix <script>alert("xss")</script> & "quotes" \'apostrophes\'',
          description: 'Task with special characters',
        },
      );

      expect(statusCode).toBe(201);
      expect(body.title).toBe(
        'Fix <script>alert("xss")</script> & "quotes" \'apostrophes\'',
      );
    });

    it('handles unicode in task fields', async () => {
      const { statusCode, body } = await injectJSON<Record<string, unknown>>(
        writeApp,
        'POST',
        '/api/tasks',
        {
          title: '修复认证端点 🚀',
          description: 'タスクの説明 — задание',
          labels: ['日本語', 'тест'],
        },
      );

      expect(statusCode).toBe(201);
      expect(body.title).toBe('修复认证端点 🚀');
    });

    it('handles special characters in search queries', async () => {
      const { statusCode } = await injectJSON(
        writeApp,
        'GET',
        '/api/decisions?search=test%26value%3Dfoo',
      );

      // Should not crash — just return empty or valid results
      expect([200]).toContain(statusCode);
    });

    it('concurrent task writes do not corrupt data', async () => {
      // Fire multiple creates simultaneously
      const promises = Array.from({ length: 5 }, (_, i) =>
        injectJSON(writeApp, 'POST', '/api/tasks', {
          title: `Concurrent task ${i}`,
          priority: 'P1',
        }),
      );

      const results = await Promise.all(promises);

      // All should succeed
      for (const { statusCode } of results) {
        expect(statusCode).toBe(201);
      }

      // All should be readable
      const { body: tasks } = await injectJSON<Record<string, unknown>[]>(
        writeApp,
        'GET',
        '/api/tasks',
      );

      // Original 5 fixtures + 5 new ones
      expect(tasks.length).toBeGreaterThanOrEqual(10);
    });

    it('DELETE then re-create with same title works', async () => {
      // Create
      const { body: created } = await injectJSON<Record<string, unknown>>(
        writeApp,
        'POST',
        '/api/tasks',
        { title: 'Ephemeral task' },
      );

      // Delete
      await injectJSON(writeApp, 'DELETE', `/api/tasks/${created.id}`);

      // Re-create with same title
      const { statusCode, body } = await injectJSON<Record<string, unknown>>(
        writeApp,
        'POST',
        '/api/tasks',
        { title: 'Ephemeral task' },
      );

      expect(statusCode).toBe(201);
      expect(body.title).toBe('Ephemeral task');
      expect(body.id).not.toBe(created.id); // New ID
    });
  });
});
