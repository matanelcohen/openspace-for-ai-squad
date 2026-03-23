import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { Task } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let tasksDir: string;
let app: FastifyInstance;

function writeTaskFile(id: string, fields: Record<string, unknown> = {}) {
  const fm = {
    id,
    title: fields.title ?? `Task ${id}`,
    status: fields.status ?? 'backlog',
    priority: fields.priority ?? 'P2',
    assignee: fields.assignee ?? 'null',
    labels: fields.labels ?? [],
    created: fields.created ?? '2026-03-23T21:00:00Z',
    updated: fields.updated ?? '2026-03-23T21:30:00Z',
    sortIndex: fields.sortIndex ?? 0,
  };
  const body = (fields.description as string) ?? '';
  const content = `---\n${Object.entries(fm).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n')}\n---\n\n${body}\n`;
  return fs.writeFile(path.join(tasksDir, `${id}.md`), content, 'utf-8');
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'tasks-test-'));
  tasksDir = path.join(tmpDir, 'tasks');
  await fs.mkdir(tasksDir, { recursive: true });

  // Minimal team.md so SquadParser doesn't fail
  await fs.writeFile(path.join(tmpDir, 'team.md'), '# Squad\n\n## Members\n', 'utf-8');
  await fs.writeFile(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ version: 1, allowedModels: [], defaultModel: '' }),
    'utf-8',
  );

  app = buildApp({ logger: false, squadDir: tmpDir });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// GET /api/tasks
// ---------------------------------------------------------------------------

describe('GET /api/tasks', () => {
  it('returns 200 with an empty list when no tasks exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns all tasks', async () => {
    await writeTaskFile('task-001', { title: 'First', sortIndex: 0 });
    await writeTaskFile('task-002', { title: 'Second', sortIndex: 1 });

    const res = await app.inject({ method: 'GET', url: '/api/tasks' });
    expect(res.statusCode).toBe(200);

    const tasks = res.json();
    expect(tasks).toHaveLength(2);
  });

  it('filters by status', async () => {
    await writeTaskFile('task-a', { status: 'in-progress', sortIndex: 0 });
    await writeTaskFile('task-b', { status: 'backlog', sortIndex: 1 });

    const res = await app.inject({ method: 'GET', url: '/api/tasks?status=in-progress' });
    const tasks = res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('in-progress');
  });

  it('filters by assignee', async () => {
    await writeTaskFile('task-a', { assignee: 'bender', sortIndex: 0 });
    await writeTaskFile('task-b', { assignee: 'fry', sortIndex: 1 });

    const res = await app.inject({ method: 'GET', url: '/api/tasks?assignee=bender' });
    const tasks = res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].assignee).toBe('bender');
  });

  it('filters by priority', async () => {
    await writeTaskFile('task-a', { priority: 'P0', sortIndex: 0 });
    await writeTaskFile('task-b', { priority: 'P2', sortIndex: 1 });

    const res = await app.inject({ method: 'GET', url: '/api/tasks?priority=P0' });
    const tasks = res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].priority).toBe('P0');
  });

  it('returns 400 for invalid status filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks?status=invalid' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid status');
  });

  it('returns 400 for invalid priority filter', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks?priority=URGENT' });
    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid priority');
  });

  it('combines multiple filters', async () => {
    await writeTaskFile('task-a', { status: 'in-progress', assignee: 'bender', sortIndex: 0 });
    await writeTaskFile('task-b', { status: 'in-progress', assignee: 'fry', sortIndex: 1 });
    await writeTaskFile('task-c', { status: 'backlog', assignee: 'bender', sortIndex: 2 });

    const res = await app.inject({
      method: 'GET',
      url: '/api/tasks?status=in-progress&assignee=bender',
    });
    const tasks = res.json();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].id).toBe('task-a');
  });
});

// ---------------------------------------------------------------------------
// GET /api/tasks/:id
// ---------------------------------------------------------------------------

describe('GET /api/tasks/:id', () => {
  it('returns a task by ID', async () => {
    await writeTaskFile('task-001', { title: 'Get me' });

    const res = await app.inject({ method: 'GET', url: '/api/tasks/task-001' });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe('task-001');
    expect(res.json().title).toBe('Get me');
  });

  it('returns 404 for non-existent task', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/tasks/nonexistent' });
    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('nonexistent');
  });
});

// ---------------------------------------------------------------------------
// POST /api/tasks
// ---------------------------------------------------------------------------

describe('POST /api/tasks', () => {
  it('creates a new task and returns 201', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: {
        title: 'New task',
        description: 'Some description',
        status: 'in-progress',
        priority: 'P1',
        assignee: 'bender',
        labels: ['backend'],
      },
    });

    expect(res.statusCode).toBe(201);
    const task: Task = res.json();
    expect(task.id).toMatch(/^task-/);
    expect(task.title).toBe('New task');
    expect(task.status).toBe('in-progress');
    expect(task.priority).toBe('P1');
    expect(task.assignee).toBe('bender');
  });

  it('applies defaults for optional fields', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Minimal' },
    });

    expect(res.statusCode).toBe(201);
    const task: Task = res.json();
    expect(task.status).toBe('backlog');
    expect(task.priority).toBe('P2');
    expect(task.assignee).toBeNull();
  });

  it('returns 400 when title is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { description: 'No title' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('title');
  });

  it('returns 400 for invalid status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Bad status', status: 'invalid' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid status');
  });

  it('returns 400 for invalid priority', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Bad priority', priority: 'URGENT' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('Invalid priority');
  });

  it('persists task to disk', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Persisted' },
    });
    const task: Task = createRes.json();

    const getRes = await app.inject({ method: 'GET', url: `/api/tasks/${task.id}` });
    expect(getRes.statusCode).toBe(200);
    expect(getRes.json().title).toBe('Persisted');
  });
});

// ---------------------------------------------------------------------------
// PUT /api/tasks/:id
// ---------------------------------------------------------------------------

describe('PUT /api/tasks/:id', () => {
  it('updates a task and returns 200', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Original' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/tasks/${created.id}`,
      payload: { title: 'Updated', status: 'in-progress' },
    });

    expect(res.statusCode).toBe(200);
    const updated: Task = res.json();
    expect(updated.title).toBe('Updated');
    expect(updated.status).toBe('in-progress');
    expect(updated.id).toBe(created.id);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/tasks/nonexistent',
      payload: { title: 'Nope' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for invalid status in update', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Valid' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({
      method: 'PUT',
      url: `/api/tasks/${created.id}`,
      payload: { status: 'nope' },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/status
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/status', () => {
  it('updates only the status', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Status test', status: 'backlog' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${created.id}/status`,
      payload: { status: 'done' },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().status).toBe('done');
    expect(res.json().title).toBe('Status test');
  });

  it('returns 400 for invalid status', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Bad' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${created.id}/status`,
      payload: { status: 'not-real' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/ghost/status',
      payload: { status: 'done' },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/priority
// ---------------------------------------------------------------------------

describe('PATCH /api/tasks/:id/priority', () => {
  it('updates the sortIndex', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Reorder me' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${created.id}/priority`,
      payload: { sortIndex: 42 },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().sortIndex).toBe(42);
  });

  it('returns 400 when sortIndex is missing', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'No index' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${created.id}/priority`,
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when sortIndex is not a number', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'String index' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/tasks/${created.id}/priority`,
      payload: { sortIndex: 'abc' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/api/tasks/ghost/priority',
      payload: { sortIndex: 5 },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/tasks/:id', () => {
  it('deletes a task and returns 204', async () => {
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/tasks',
      payload: { title: 'Delete me' },
    });
    const created: Task = createRes.json();

    const res = await app.inject({ method: 'DELETE', url: `/api/tasks/${created.id}` });
    expect(res.statusCode).toBe(204);

    // Verify deletion
    const getRes = await app.inject({ method: 'GET', url: `/api/tasks/${created.id}` });
    expect(getRes.statusCode).toBe(404);
  });

  it('returns 404 for non-existent task', async () => {
    const res = await app.inject({ method: 'DELETE', url: '/api/tasks/nonexistent' });
    expect(res.statusCode).toBe(404);
  });
});
