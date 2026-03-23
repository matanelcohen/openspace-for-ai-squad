import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach,beforeEach, describe, expect, it } from 'vitest';

import { parseAllTasks } from '../squad-parser/task-parser.js';
import {
  createTask,
  deleteTask,
  generateTaskId,
  getTask,
  reorderTasks,
  updateTask,
} from './task-writer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tasksDir: string;

beforeEach(async () => {
  tasksDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-writer-'));
});

afterEach(async () => {
  await fs.rm(tasksDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// generateTaskId
// ---------------------------------------------------------------------------

describe('generateTaskId', () => {
  it('produces ids matching task-{8chars}', () => {
    const id = generateTaskId();
    expect(id).toMatch(/^task-[A-Za-z0-9_-]{8}$/);
  });

  it('generates unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => generateTaskId()));
    expect(ids.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// createTask
// ---------------------------------------------------------------------------

describe('createTask', () => {
  it('creates a task file with correct content', async () => {
    const task = await createTask(tasksDir, {
      title: 'Test task',
      description: '## Details\n\nSome description.',
      status: 'in-progress',
      priority: 'P1',
      assignee: 'bender',
      labels: ['backend'],
    });

    expect(task.id).toMatch(/^task-/);
    expect(task.title).toBe('Test task');
    expect(task.status).toBe('in-progress');
    expect(task.priority).toBe('P1');
    expect(task.assignee).toBe('bender');
    expect(task.labels).toEqual(['backend']);
    expect(task.sortIndex).toBe(0);

    // File should exist
    const filePath = path.join(tasksDir, `${task.id}.md`);
    const content = await fs.readFile(filePath, 'utf-8');
    expect(content).toContain(task.id);
    expect(content).toContain('Test task');
  });

  it('applies defaults for optional fields', async () => {
    const task = await createTask(tasksDir, { title: 'Minimal task' });

    expect(task.status).toBe('backlog');
    expect(task.priority).toBe('P2');
    expect(task.assignee).toBeNull();
    expect(task.labels).toEqual([]);
    expect(task.description).toBe('');
  });

  it('increments sortIndex for subsequent tasks', async () => {
    const t1 = await createTask(tasksDir, { title: 'First' });
    const t2 = await createTask(tasksDir, { title: 'Second' });
    const t3 = await createTask(tasksDir, { title: 'Third' });

    expect(t1.sortIndex).toBe(0);
    expect(t2.sortIndex).toBe(1);
    expect(t3.sortIndex).toBe(2);
  });

  it('creates the directory if it does not exist', async () => {
    const deepDir = path.join(tasksDir, 'nested', 'deep');
    const task = await createTask(deepDir, { title: 'Deep task' });

    const filePath = path.join(deepDir, `${task.id}.md`);
    const stat = await fs.stat(filePath);
    expect(stat.isFile()).toBe(true);
  });

  it('round-trips through the parser', async () => {
    const task = await createTask(tasksDir, {
      title: 'Round-trip test',
      description: 'This should survive serialization.',
      status: 'in-review',
      priority: 'P0',
      assignee: 'leela',
      labels: ['critical', 'test'],
    });

    const { tasks } = await parseAllTasks(tasksDir);
    expect(tasks).toHaveLength(1);
    const parsed = tasks[0]!.task;

    expect(parsed.id).toBe(task.id);
    expect(parsed.title).toBe(task.title);
    expect(parsed.status).toBe(task.status);
    expect(parsed.priority).toBe(task.priority);
    expect(parsed.assignee).toBe(task.assignee);
    expect(parsed.labels).toEqual(task.labels);
    expect(parsed.description).toContain('This should survive serialization.');
  });
});

// ---------------------------------------------------------------------------
// getTask
// ---------------------------------------------------------------------------

describe('getTask', () => {
  it('reads a task by id', async () => {
    const created = await createTask(tasksDir, { title: 'Readable' });
    const fetched = await getTask(tasksDir, created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.title).toBe('Readable');
  });

  it('throws for non-existent task', async () => {
    await expect(getTask(tasksDir, 'nonexistent')).rejects.toThrow('Task not found');
  });
});

// ---------------------------------------------------------------------------
// updateTask
// ---------------------------------------------------------------------------

describe('updateTask', () => {
  it('updates specified fields and bumps updatedAt', async () => {
    const created = await createTask(tasksDir, {
      title: 'Original',
      status: 'backlog',
    });

    const updated = await updateTask(tasksDir, created.id, {
      title: 'Updated title',
      status: 'in-progress',
    });

    expect(updated.id).toBe(created.id);
    expect(updated.title).toBe('Updated title');
    expect(updated.status).toBe('in-progress');
    expect(updated.createdAt).toBe(created.createdAt);
    expect(updated.updatedAt > created.updatedAt).toBe(true);
  });

  it('preserves fields not included in updates', async () => {
    const created = await createTask(tasksDir, {
      title: 'Keep labels',
      labels: ['important'],
      assignee: 'fry',
    });

    const updated = await updateTask(tasksDir, created.id, { status: 'done' });
    expect(updated.labels).toEqual(['important']);
    expect(updated.assignee).toBe('fry');
    expect(updated.title).toBe('Keep labels');
  });

  it('cannot change id or createdAt', async () => {
    const created = await createTask(tasksDir, { title: 'Immutable' });

    const updated = await updateTask(tasksDir, created.id, {
      // These are typed out of UpdateTaskInput, but test defensive behavior
      ...({ id: 'hacked-id', createdAt: '1999-01-01T00:00:00Z' } as Record<string, unknown>),
      title: 'Still safe',
    } as never);

    expect(updated.id).toBe(created.id);
    expect(updated.createdAt).toBe(created.createdAt);
  });

  it('throws for non-existent task', async () => {
    await expect(updateTask(tasksDir, 'nonexistent', { title: 'Nope' })).rejects.toThrow(
      'Task not found',
    );
  });

  it('persists changes to disk', async () => {
    const created = await createTask(tasksDir, { title: 'Persist test' });
    await updateTask(tasksDir, created.id, { title: 'Persisted' });

    const reread = await getTask(tasksDir, created.id);
    expect(reread.title).toBe('Persisted');
  });
});

// ---------------------------------------------------------------------------
// deleteTask
// ---------------------------------------------------------------------------

describe('deleteTask', () => {
  it('removes the task file', async () => {
    const created = await createTask(tasksDir, { title: 'Delete me' });
    await deleteTask(tasksDir, created.id);

    await expect(getTask(tasksDir, created.id)).rejects.toThrow('Task not found');
  });

  it('throws for non-existent task', async () => {
    await expect(deleteTask(tasksDir, 'ghost')).rejects.toThrow('Task not found');
  });

  it('does not affect other tasks', async () => {
    const t1 = await createTask(tasksDir, { title: 'Keep' });
    const t2 = await createTask(tasksDir, { title: 'Remove' });

    await deleteTask(tasksDir, t2.id);

    const { tasks } = await parseAllTasks(tasksDir);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.task.id).toBe(t1.id);
  });
});

// ---------------------------------------------------------------------------
// reorderTasks
// ---------------------------------------------------------------------------

describe('reorderTasks', () => {
  it('updates sortIndex for all specified tasks', async () => {
    const t1 = await createTask(tasksDir, { title: 'A' });
    const t2 = await createTask(tasksDir, { title: 'B' });
    const t3 = await createTask(tasksDir, { title: 'C' });

    // Reverse order
    const reordered = await reorderTasks(tasksDir, [t3.id, t2.id, t1.id]);

    expect(reordered[0]!.sortIndex).toBe(0);
    expect(reordered[0]!.id).toBe(t3.id);
    expect(reordered[1]!.sortIndex).toBe(1);
    expect(reordered[1]!.id).toBe(t2.id);
    expect(reordered[2]!.sortIndex).toBe(2);
    expect(reordered[2]!.id).toBe(t1.id);
  });

  it('persists new sortIndex to disk', async () => {
    const t1 = await createTask(tasksDir, { title: 'First' });
    const t2 = await createTask(tasksDir, { title: 'Second' });

    await reorderTasks(tasksDir, [t2.id, t1.id]);

    const { tasks } = await parseAllTasks(tasksDir);
    expect(tasks[0]!.task.id).toBe(t2.id);
    expect(tasks[0]!.task.sortIndex).toBe(0);
    expect(tasks[1]!.task.id).toBe(t1.id);
    expect(tasks[1]!.task.sortIndex).toBe(1);
  });

  it('throws if a task in the list does not exist', async () => {
    const t1 = await createTask(tasksDir, { title: 'Exists' });

    await expect(reorderTasks(tasksDir, [t1.id, 'nonexistent'])).rejects.toThrow(
      'Task not found during reorder',
    );
  });

  it('handles empty array', async () => {
    const result = await reorderTasks(tasksDir, []);
    expect(result).toEqual([]);
  });
});
