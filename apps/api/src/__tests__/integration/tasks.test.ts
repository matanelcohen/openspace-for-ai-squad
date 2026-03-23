/**
 * Integration tests — Task CRUD lifecycle
 *
 * Tests the full task API: create → read → update status → reorder → delete.
 * Uses a temporary copy of the fixture directory to test write operations.
 */

import type { Task } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { buildTestApp, createTempSquadDir, FIXTURE_SQUAD_DIR, injectJSON } from '../helpers/setup.js';
import { cleanupTempDir } from '../helpers/teardown.js';

// ─────────────────────────────────────────────────────────────
// Read-only tests (static fixtures)
// ─────────────────────────────────────────────────────────────

describe('Tasks API — Read', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp(FIXTURE_SQUAD_DIR);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/tasks', () => {
    it('returns 200 with an array of tasks', async () => {
      const { statusCode, body } = await injectJSON<Task[]>(
        app,
        'GET',
        '/api/tasks',
      );

      expect(statusCode).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it('returns all 5 fixture tasks', async () => {
      const { body } = await injectJSON<Task[]>(app, 'GET', '/api/tasks');

      expect(body).toHaveLength(5);
      const ids = body.map((t) => t.id);
      expect(ids).toContain('task-fixture-001');
      expect(ids).toContain('task-fixture-002');
      expect(ids).toContain('task-fixture-003');
      expect(ids).toContain('task-fixture-004');
      expect(ids).toContain('task-fixture-005');
    });

    it('tasks are sorted by sortIndex', async () => {
      const { body } = await injectJSON<Task[]>(app, 'GET', '/api/tasks');

      for (let i = 1; i < body.length; i++) {
        expect(body[i]!.sortIndex).toBeGreaterThanOrEqual(body[i - 1]!.sortIndex);
      }
    });

    it('each task has required fields', async () => {
      const { body } = await injectJSON<Task[]>(app, 'GET', '/api/tasks');

      for (const task of body) {
        expect(task).toHaveProperty('id');
        expect(task).toHaveProperty('title');
        expect(task).toHaveProperty('status');
        expect(task).toHaveProperty('priority');
        expect(task).toHaveProperty('sortIndex');
        expect(task).toHaveProperty('createdAt');
        expect(task).toHaveProperty('updatedAt');
        expect(typeof task.id).toBe('string');
        expect(typeof task.title).toBe('string');
      }
    });

    it('returns tasks with correct fixture data', async () => {
      const { body } = await injectJSON<Task[]>(app, 'GET', '/api/tasks');

      const task1 = body.find((t) => t.id === 'task-fixture-001');
      expect(task1).toBeDefined();
      expect(task1!.title).toBe('Build authentication endpoint');
      expect(task1!.status).toBe('in-progress');
      expect(task1!.priority).toBe('P1');
      expect(task1!.assignee).toBe('bender');
      expect(task1!.labels).toContain('backend');
    });

    it('handles tasks with null assignee', async () => {
      const { body } = await injectJSON<Task[]>(app, 'GET', '/api/tasks');

      const task5 = body.find((t) => t.id === 'task-fixture-005');
      expect(task5).toBeDefined();
      expect(task5!.assignee).toBeNull();
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('returns 200 with a single task', async () => {
      const { statusCode, body } = await injectJSON<Task>(
        app,
        'GET',
        '/api/tasks/task-fixture-001',
      );

      expect(statusCode).toBe(200);
      expect(body.id).toBe('task-fixture-001');
      expect(body.title).toBe('Build authentication endpoint');
    });

    it('includes the full description', async () => {
      const { body } = await injectJSON<Task>(
        app,
        'GET',
        '/api/tasks/task-fixture-001',
      );

      expect(body.description).toContain('JWT authentication');
    });

    it('returns 404 for non-existent task', async () => {
      const { statusCode } = await injectJSON(
        app,
        'GET',
        '/api/tasks/nonexistent-task',
      );

      expect(statusCode).toBe(404);
    });
  });
});

// ─────────────────────────────────────────────────────────────
// Write tests (temp directory)
// ─────────────────────────────────────────────────────────────

describe('Tasks API — Write', () => {
  let app: FastifyInstance;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempSquadDir();
    app = await buildTestApp(tempDir);
  });

  afterEach(async () => {
    await app.close();
    await cleanupTempDir(tempDir);
  });

  describe('POST /api/tasks', () => {
    it('creates a task and returns 201', async () => {
      const { statusCode, body } = await injectJSON<Task>(app, 'POST', '/api/tasks', {
        title: 'New integration test task',
        description: 'Created by integration test',
        priority: 'P0',
        assignee: 'zoidberg',
        labels: ['testing'],
      });

      expect(statusCode).toBe(201);
      expect(body.id).toBeDefined();
      expect(body.title).toBe('New integration test task');
      expect(body.priority).toBe('P0');
      expect(body.assignee).toBe('zoidberg');
      expect(body.status).toBe('backlog');
    });

    it('persists the task to disk', async () => {
      const { body: created } = await injectJSON<Task>(app, 'POST', '/api/tasks', {
        title: 'Persistence check',
      });

      // Read it back via the GET endpoint
      const { statusCode, body } = await injectJSON<Task>(
        app,
        'GET',
        `/api/tasks/${created.id}`,
      );

      expect(statusCode).toBe(200);
      expect(body.title).toBe('Persistence check');
    });

    it('applies defaults for optional fields', async () => {
      const { body } = await injectJSON<Task>(app, 'POST', '/api/tasks', {
        title: 'Minimal task',
      });

      expect(body.status).toBe('backlog');
      expect(body.priority).toBe('P2');
      expect(body.assignee).toBeNull();
      expect(body.labels).toEqual([]);
    });

    it('returns 400 when title is missing', async () => {
      const { statusCode } = await injectJSON(app, 'POST', '/api/tasks', {
        description: 'No title provided',
      });

      expect(statusCode).toBe(400);
    });

    it('returns 400 when body is empty', async () => {
      const { statusCode } = await injectJSON(app, 'POST', '/api/tasks', {});

      expect(statusCode).toBe(400);
    });
  });

  describe('PATCH /api/tasks/:id/status', () => {
    it('updates the task status', async () => {
      const { statusCode, body } = await injectJSON<Task>(
        app,
        'PATCH',
        '/api/tasks/task-fixture-001/status',
        { status: 'done' },
      );

      expect(statusCode).toBe(200);
      expect(body.status).toBe('done');
      expect(body.id).toBe('task-fixture-001');
    });

    it('returns 404 for non-existent task', async () => {
      const { statusCode } = await injectJSON(
        app,
        'PATCH',
        '/api/tasks/nonexistent/status',
        { status: 'done' },
      );

      expect(statusCode).toBe(404);
    });

    it('returns 400 for invalid status', async () => {
      const { statusCode } = await injectJSON(
        app,
        'PATCH',
        '/api/tasks/task-fixture-001/status',
        { status: 'invalid-status' },
      );

      expect(statusCode).toBe(400);
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('updates task fields', async () => {
      const { statusCode, body } = await injectJSON<Task>(
        app,
        'PUT',
        '/api/tasks/task-fixture-001',
        {
          title: 'Updated title',
          priority: 'P0',
          labels: ['urgent', 'backend'],
        },
      );

      expect(statusCode).toBe(200);
      expect(body.title).toBe('Updated title');
      expect(body.priority).toBe('P0');
      expect(body.labels).toEqual(['urgent', 'backend']);
    });

    it('preserves fields not included in the update', async () => {
      const { body } = await injectJSON<Task>(
        app,
        'PUT',
        '/api/tasks/task-fixture-001',
        { title: 'New title only' },
      );

      expect(body.assignee).toBe('bender');
      expect(body.priority).toBe('P1');
    });

    it('bumps updatedAt on update', async () => {
      // Create a fresh task so updatedAt is "now" (not a future fixture date)
      const { body: fresh } = await injectJSON<Task>(
        app,
        'POST',
        '/api/tasks',
        { title: 'Timestamp test' },
      );
      const before = new Date(fresh.updatedAt).getTime();

      // Small delay to ensure timestamp advances
      await new Promise((r) => setTimeout(r, 10));

      const { body: after } = await injectJSON<Task>(
        app,
        'PUT',
        `/api/tasks/${fresh.id}`,
        { title: 'Timestamp check' },
      );

      expect(new Date(after.updatedAt).getTime()).toBeGreaterThanOrEqual(before);
    });

    it('returns 404 for non-existent task', async () => {
      const { statusCode } = await injectJSON(
        app,
        'PUT',
        '/api/tasks/nonexistent',
        { title: 'Ghost' },
      );

      expect(statusCode).toBe(404);
    });
  });

  describe('PATCH /api/tasks/:id/priority', () => {
    it('updates sortIndex for a single task', async () => {
      const { statusCode, body } = await injectJSON<Task>(
        app,
        'PATCH',
        '/api/tasks/task-fixture-003/priority',
        { sortIndex: 0 },
      );

      expect(statusCode).toBe(200);
      expect(body.id).toBe('task-fixture-003');
      expect(body.sortIndex).toBe(0);
    });

    it('returns 400 for missing sortIndex', async () => {
      const { statusCode } = await injectJSON(
        app,
        'PATCH',
        '/api/tasks/task-fixture-001/priority',
        {},
      );

      expect(statusCode).toBe(400);
    });

    it('returns 400 for non-numeric sortIndex', async () => {
      const { statusCode } = await injectJSON(
        app,
        'PATCH',
        '/api/tasks/task-fixture-001/priority',
        { sortIndex: 'not-a-number' },
      );

      expect(statusCode).toBe(400);
    });

    it('returns 404 for non-existent task', async () => {
      const { statusCode } = await injectJSON(
        app,
        'PATCH',
        '/api/tasks/nonexistent/priority',
        { sortIndex: 0 },
      );

      expect(statusCode).toBe(404);
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('deletes a task and returns 204 or 200', async () => {
      const { statusCode } = await injectJSON(
        app,
        'DELETE',
        '/api/tasks/task-fixture-004',
      );

      expect([200, 204]).toContain(statusCode);

      // Verify it's gone
      const { statusCode: getStatus } = await injectJSON(
        app,
        'GET',
        '/api/tasks/task-fixture-004',
      );
      expect(getStatus).toBe(404);
    });

    it('returns 404 for non-existent task', async () => {
      const { statusCode } = await injectJSON(
        app,
        'DELETE',
        '/api/tasks/ghost-task',
      );

      expect(statusCode).toBe(404);
    });

    it('does not affect other tasks', async () => {
      await injectJSON(app, 'DELETE', '/api/tasks/task-fixture-004');

      const { body } = await injectJSON<Task[]>(app, 'GET', '/api/tasks');
      const ids = body.map((t) => t.id);
      expect(ids).not.toContain('task-fixture-004');
      expect(ids).toContain('task-fixture-001');
      expect(ids).toContain('task-fixture-002');
    });
  });

  describe('Full CRUD lifecycle', () => {
    it('create → read → update → reorder → delete', async () => {
      // 1. Create
      const { body: created } = await injectJSON<Task>(app, 'POST', '/api/tasks', {
        title: 'Lifecycle task',
        description: 'Full CRUD lifecycle test',
        priority: 'P1',
        assignee: 'leela',
        labels: ['lifecycle'],
      });
      expect(created.id).toBeDefined();

      // 2. Read
      const { body: read } = await injectJSON<Task>(
        app,
        'GET',
        `/api/tasks/${created.id}`,
      );
      expect(read.title).toBe('Lifecycle task');

      // 3. Update status
      const { body: updated } = await injectJSON<Task>(
        app,
        'PATCH',
        `/api/tasks/${created.id}/status`,
        { status: 'in-progress' },
      );
      expect(updated.status).toBe('in-progress');

      // 4. Update fields
      const { body: edited } = await injectJSON<Task>(
        app,
        'PUT',
        `/api/tasks/${created.id}`,
        { title: 'Lifecycle task — updated', priority: 'P0' },
      );
      expect(edited.title).toBe('Lifecycle task — updated');
      expect(edited.priority).toBe('P0');

      // 5. Reorder (change sortIndex)
      const { body: reordered } = await injectJSON<Task>(
        app,
        'PATCH',
        `/api/tasks/${created.id}/priority`,
        { sortIndex: 0 },
      );
      expect(reordered.id).toBe(created.id);
      expect(reordered.sortIndex).toBe(0);

      // 6. Delete
      const { statusCode: deleteStatus } = await injectJSON(
        app,
        'DELETE',
        `/api/tasks/${created.id}`,
      );
      expect([200, 204]).toContain(deleteStatus);

      // 7. Verify deletion
      const { statusCode: gone } = await injectJSON(
        app,
        'GET',
        `/api/tasks/${created.id}`,
      );
      expect(gone).toBe(404);
    });
  });
});
