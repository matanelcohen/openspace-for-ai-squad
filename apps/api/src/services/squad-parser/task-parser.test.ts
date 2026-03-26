import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach,beforeEach, describe, expect, it } from 'vitest';

import { parseAllTasks, parseTaskFile } from './task-parser.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'task-parser-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

function writeTask(filename: string, content: string) {
  return fs.writeFile(path.join(tmpDir, filename), content, 'utf-8');
}

const VALID_TASK = `---
id: task-001
title: Build auth endpoint
status: in-progress
priority: P1
assignee: bender
assigneeType: agent
labels: [backend, auth]
created: 2026-03-23T21:00:00Z
updated: 2026-03-23T21:30:00Z
sortIndex: 0
---

## Description

Build the authentication endpoint.
`;

// ---------------------------------------------------------------------------
// parseTaskFile
// ---------------------------------------------------------------------------

describe('parseTaskFile', () => {
  it('parses a valid task file', () => {
    const result = parseTaskFile(VALID_TASK, 'task-001.md');

    expect(result.task).toEqual({
      id: 'task-001',
      title: 'Build auth endpoint',
      description: '## Description\n\nBuild the authentication endpoint.',
      status: 'in-progress',
      priority: 'P1',
      assignee: 'bender',
      assigneeType: 'agent',
      labels: ['backend', 'auth'],
      createdAt: '2026-03-23T21:00:00.000Z',
      updatedAt: '2026-03-23T21:30:00.000Z',
      sortIndex: 0,
    });
    expect(result.filePath).toBe('task-001.md');
  });

  it('defaults status to backlog when missing', () => {
    const content = `---
id: task-x
title: No status
---

Some description.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.status).toBe('backlog');
  });

  it('defaults priority to P2 when missing', () => {
    const content = `---
id: task-x
title: No priority
---

Some description.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.priority).toBe('P2');
  });

  it('defaults assignee to null when "null"', () => {
    const content = `---
id: task-x
title: Null assignee
assignee: "null"
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.assignee).toBeNull();
  });

  it('defaults assignee to null when missing', () => {
    const content = `---
id: task-x
title: Missing assignee
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.assignee).toBeNull();
  });

  it('defaults assigneeType to agent when missing', () => {
    const content = `---
id: task-x
title: No assigneeType
assignee: someone
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.assigneeType).toBe('agent');
  });

  it('accepts assigneeType member', () => {
    const content = `---
id: task-x
title: Member task
assignee: alice
assigneeType: member
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.assigneeType).toBe('member');
  });

  it('defaults assigneeType to agent for invalid value', () => {
    const content = `---
id: task-x
title: Bad assigneeType
assigneeType: robot
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.assigneeType).toBe('agent');
  });

  it('handles empty labels', () => {
    const content = `---
id: task-x
title: No labels
labels: []
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.labels).toEqual([]);
  });

  it('handles missing labels field', () => {
    const content = `---
id: task-x
title: Missing labels
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.labels).toEqual([]);
  });

  it('throws on missing id', () => {
    const content = `---
title: No ID
---

Body.
`;
    expect(() => parseTaskFile(content, 'bad.md')).toThrow('Missing required field "id"');
  });

  it('throws on missing title', () => {
    const content = `---
id: task-x
---

Body.
`;
    expect(() => parseTaskFile(content, 'bad.md')).toThrow('Missing required field "title"');
  });

  it('throws on empty frontmatter', () => {
    const content = `No frontmatter at all`;
    expect(() => parseTaskFile(content, 'bad.md')).toThrow('Missing required field "id"');
  });

  it('handles invalid status gracefully (defaults to backlog)', () => {
    const content = `---
id: task-x
title: Bad status
status: invalid-status
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.status).toBe('backlog');
  });

  it('handles invalid priority gracefully (defaults to P2)', () => {
    const content = `---
id: task-x
title: Bad priority
priority: URGENT
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.priority).toBe('P2');
  });

  it('handles invalid date gracefully (defaults to current time)', () => {
    const before = new Date().toISOString();
    const content = `---
id: task-x
title: Bad date
created: not-a-date
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.createdAt >= before).toBe(true);
  });

  it('defaults sortIndex to 0 when missing', () => {
    const content = `---
id: task-x
title: No sortIndex
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.sortIndex).toBe(0);
  });

  it('trims whitespace from id and title', () => {
    const content = `---
id: "  task-x  "
title: "  Padded title  "
---

Body.
`;
    const { task } = parseTaskFile(content, 'test.md');
    expect(task.id).toBe('task-x');
    expect(task.title).toBe('Padded title');
  });
});

// ---------------------------------------------------------------------------
// parseAllTasks
// ---------------------------------------------------------------------------

describe('parseAllTasks', () => {
  it('parses all .md files in a directory', async () => {
    await writeTask('task-001.md', VALID_TASK);
    await writeTask(
      'task-002.md',
      `---
id: task-002
title: Another task
assigneeType: member
sortIndex: 1
---

Description.
`,
    );

    const { tasks, errors } = await parseAllTasks(tmpDir);
    expect(tasks).toHaveLength(2);
    expect(errors).toHaveLength(0);
    expect(tasks[0]!.task.id).toBe('task-001');
    expect(tasks[1]!.task.id).toBe('task-002');
  });

  it('returns empty for non-existent directory', async () => {
    const { tasks, errors } = await parseAllTasks('/nonexistent/path');
    expect(tasks).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('returns empty for empty directory', async () => {
    const { tasks, errors } = await parseAllTasks(tmpDir);
    expect(tasks).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });

  it('ignores non-.md files', async () => {
    await writeTask('task-001.md', VALID_TASK);
    await fs.writeFile(path.join(tmpDir, 'readme.txt'), 'not a task', 'utf-8');
    await fs.writeFile(path.join(tmpDir, 'config.json'), '{}', 'utf-8');

    const { tasks } = await parseAllTasks(tmpDir);
    expect(tasks).toHaveLength(1);
  });

  it('collects errors for malformed files without stopping', async () => {
    await writeTask('task-001.md', VALID_TASK);
    await writeTask(
      'task-bad.md',
      `---
title: No ID field
---

Missing id.
`,
    );

    const { tasks, errors } = await parseAllTasks(tmpDir);
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.task.id).toBe('task-001');
    expect(errors).toHaveLength(1);
    expect(errors[0]!.error).toContain('Missing required field "id"');
  });

  it('sorts tasks by sortIndex', async () => {
    await writeTask(
      'a-second.md',
      `---
id: second
title: Second
sortIndex: 5
---

B.
`,
    );
    await writeTask(
      'b-first.md',
      `---
id: first
title: First
sortIndex: 1
---

A.
`,
    );

    const { tasks } = await parseAllTasks(tmpDir);
    expect(tasks[0]!.task.id).toBe('first');
    expect(tasks[1]!.task.id).toBe('second');
  });
});
