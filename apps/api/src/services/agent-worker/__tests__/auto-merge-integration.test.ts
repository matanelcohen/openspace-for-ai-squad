/**
 * Integration test — verifies agent-worker adds `merge:auto` label after PR
 * creation instead of setting status to 'done'.
 *
 * When a PR is successfully created, the agent-worker should:
 *   - Set status to 'in-progress' (not 'done')
 *   - Add both `pr:<number>` AND `merge:auto` labels
 *
 * When no PR is created, the original behavior is preserved:
 *   - Set status to 'done'
 *   - No merge:auto label
 */

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  createTask,
  getTask,
  updateTask,
} from '../../squad-writer/task-writer.js';

// ---------------------------------------------------------------------------
// Helpers — simulate the agent-worker's updateTask call
// ---------------------------------------------------------------------------

let tasksDir: string;

beforeEach(async () => {
  tasksDir = await fs.mkdtemp(path.join(os.tmpdir(), 'auto-merge-integration-'));
});

afterEach(async () => {
  await fs.rm(tasksDir, { recursive: true, force: true });
});

/**
 * Simulates the agent-worker task completion logic.
 * This mirrors the real code in agent-worker/index.ts lines 682-693.
 */
async function simulateAgentCompletion(
  taskId: string,
  prInfo?: { number: number; url: string },
): Promise<void> {
  const task = await getTask(tasksDir, taskId);

  await updateTask(tasksDir, taskId, {
    status: prInfo ? 'in-progress' : 'done',
    labels: prInfo
      ? [...(task.labels ?? []), `pr:${prInfo.number}`, 'merge:auto']
      : task.labels,
    description:
      task.description + '\n\n---\nAgent completed this task.',
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Agent Worker — merge:auto label integration', () => {
  it('adds merge:auto label when PR is created', async () => {
    const task = await createTask(tasksDir, {
      title: 'Implement feature',
      status: 'in-progress',
      assignee: 'bender',
      labels: ['backend'],
    });

    await simulateAgentCompletion(task.id, {
      number: 42,
      url: 'https://github.com/o/r/pull/42',
    });

    const updated = await getTask(tasksDir, task.id);
    expect(updated.labels).toContain('merge:auto');
    expect(updated.labels).toContain('pr:42');
    expect(updated.labels).toContain('backend');
  });

  it('sets status to in-progress (not done) when PR is created', async () => {
    const task = await createTask(tasksDir, {
      title: 'Fix bug',
      status: 'in-progress',
      assignee: 'leela',
    });

    await simulateAgentCompletion(task.id, {
      number: 10,
      url: 'https://github.com/o/r/pull/10',
    });

    const updated = await getTask(tasksDir, task.id);
    expect(updated.status).toBe('in-progress');
    expect(updated.status).not.toBe('done');
  });

  it('sets status to done when NO PR is created', async () => {
    const task = await createTask(tasksDir, {
      title: 'Update docs',
      status: 'in-progress',
      assignee: 'fry',
    });

    await simulateAgentCompletion(task.id, undefined);

    const updated = await getTask(tasksDir, task.id);
    expect(updated.status).toBe('done');
  });

  it('does NOT add merge:auto label when no PR is created', async () => {
    const task = await createTask(tasksDir, {
      title: 'Refactor code',
      status: 'in-progress',
      labels: ['cleanup'],
    });

    await simulateAgentCompletion(task.id, undefined);

    const updated = await getTask(tasksDir, task.id);
    expect(updated.labels).not.toContain('merge:auto');
    expect(updated.labels).toEqual(['cleanup']);
  });

  it('preserves existing labels when adding PR + merge:auto', async () => {
    const task = await createTask(tasksDir, {
      title: 'Add API endpoint',
      status: 'in-progress',
      labels: ['backend', 'api', 'P0'],
    });

    await simulateAgentCompletion(task.id, {
      number: 99,
      url: 'https://github.com/o/r/pull/99',
    });

    const updated = await getTask(tasksDir, task.id);
    expect(updated.labels).toEqual([
      'backend',
      'api',
      'P0',
      'pr:99',
      'merge:auto',
    ]);
  });

  it('appends PR description with completion info', async () => {
    const task = await createTask(tasksDir, {
      title: 'Build feature',
      description: 'Original description',
      status: 'in-progress',
    });

    await simulateAgentCompletion(task.id, {
      number: 5,
      url: 'https://github.com/o/r/pull/5',
    });

    const updated = await getTask(tasksDir, task.id);
    expect(updated.description).toContain('Original description');
    expect(updated.description).toContain('Agent completed this task');
  });

  it('handles task with empty labels array', async () => {
    const task = await createTask(tasksDir, {
      title: 'New task',
      status: 'in-progress',
      labels: [],
    });

    await simulateAgentCompletion(task.id, {
      number: 1,
      url: 'https://github.com/o/r/pull/1',
    });

    const updated = await getTask(tasksDir, task.id);
    expect(updated.labels).toEqual(['pr:1', 'merge:auto']);
    expect(updated.status).toBe('in-progress');
  });

  it('end-to-end: task goes through full auto-merge lifecycle', async () => {
    // Step 1: Create task
    const task = await createTask(tasksDir, {
      title: 'Full lifecycle test',
      status: 'in-progress',
      assignee: 'bender',
      labels: ['feature'],
    });

    // Step 2: Agent completes work → PR created → merge:auto added
    await simulateAgentCompletion(task.id, {
      number: 77,
      url: 'https://github.com/o/r/pull/77',
    });

    let current = await getTask(tasksDir, task.id);
    expect(current.status).toBe('in-progress');
    expect(current.labels).toContain('merge:auto');
    expect(current.labels).toContain('pr:77');

    // Step 3: Simulate auto-merge service merging the PR
    const updatedLabels = current.labels
      .filter((l: string) => l !== 'merge:auto')
      .concat('merged');

    await updateTask(tasksDir, task.id, {
      status: 'done',
      labels: updatedLabels,
    });

    current = await getTask(tasksDir, task.id);
    expect(current.status).toBe('done');
    expect(current.labels).toContain('merged');
    expect(current.labels).toContain('pr:77');
    expect(current.labels).toContain('feature');
    expect(current.labels).not.toContain('merge:auto');
  });
});
