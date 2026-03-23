import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { SquadOverview } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let app: FastifyInstance;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'squad-test-'));

  // team.md with 2 agents
  await fs.writeFile(
    path.join(tmpDir, 'team.md'),
    `# Squad Team

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Leela | Lead | agents/leela/charter.md | ✅ Active |
| Bender | Backend | agents/bender/charter.md | 💤 Idle |
`,
    'utf-8',
  );

  // config.json
  await fs.writeFile(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ version: 1, allowedModels: ['gpt-5.4'], defaultModel: 'gpt-5.4' }),
    'utf-8',
  );

  // decisions.md with 2 decisions
  await fs.writeFile(
    path.join(tmpDir, 'decisions.md'),
    `# Decisions

## Active Decisions

### 2026-03-23T20:42:00Z: First decision
**By:** Leela
**What:** Something was decided.
**Why:** Because reasons.

### 2026-03-23T20:50:00Z: Second decision
**By:** Bender
**What:** Another decision.
**Why:** More reasons.
`,
    'utf-8',
  );

  // tasks directory with 3 tasks
  const tasksDir = path.join(tmpDir, 'tasks');
  await fs.mkdir(tasksDir, { recursive: true });

  await fs.writeFile(
    path.join(tasksDir, 'task-001.md'),
    `---
id: "task-001"
title: "Backlog task"
status: "backlog"
priority: "P2"
assignee: "null"
labels: []
created: "2026-03-23T21:00:00Z"
updated: "2026-03-23T21:00:00Z"
sortIndex: 0
---

A backlog task.
`,
    'utf-8',
  );

  await fs.writeFile(
    path.join(tasksDir, 'task-002.md'),
    `---
id: "task-002"
title: "In progress task"
status: "in-progress"
priority: "P1"
assignee: "bender"
labels: []
created: "2026-03-23T21:00:00Z"
updated: "2026-03-23T21:00:00Z"
sortIndex: 1
---

An in-progress task.
`,
    'utf-8',
  );

  await fs.writeFile(
    path.join(tasksDir, 'task-003.md'),
    `---
id: "task-003"
title: "Done task"
status: "done"
priority: "P3"
assignee: "leela"
labels: []
created: "2026-03-23T21:00:00Z"
updated: "2026-03-23T21:00:00Z"
sortIndex: 2
---

A done task.
`,
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
// GET /api/squad
// ---------------------------------------------------------------------------

describe('GET /api/squad', () => {
  it('returns 200 with a composite squad overview', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/squad' });

    expect(res.statusCode).toBe(200);
    const body: SquadOverview = res.json();

    expect(body.config).toBeDefined();
    expect(body.agents).toBeDefined();
    expect(body.taskCounts).toBeDefined();
    expect(body.recentDecisions).toBeDefined();
    expect(body.recentTasks).toBeDefined();
  });

  it('returns correct agent count', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/squad' });
    const body: SquadOverview = res.json();

    expect(body.agents).toHaveLength(2);
  });

  it('returns correct task counts by status', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/squad' });
    const body: SquadOverview = res.json();

    expect(body.taskCounts.total).toBe(3);
    expect(body.taskCounts.byStatus['backlog']).toBe(1);
    expect(body.taskCounts.byStatus['in-progress']).toBe(1);
    expect(body.taskCounts.byStatus['done']).toBe(1);
    expect(body.taskCounts.byStatus['in-review']).toBe(0);
    expect(body.taskCounts.byStatus['blocked']).toBe(0);
  });

  it('includes recent decisions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/squad' });
    const body: SquadOverview = res.json();

    expect(body.recentDecisions.length).toBe(2);
  });

  it('includes recent tasks', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/squad' });
    const body: SquadOverview = res.json();

    expect(body.recentTasks.length).toBe(3);
  });

  it('returns valid config with squad directory', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/squad' });
    const body: SquadOverview = res.json();

    expect(body.config.squadDir).toBe(tmpDir);
    expect(body.config.agents).toHaveLength(2);
  });

  it('handles empty squad gracefully', async () => {
    // Remove everything
    await fs.unlink(path.join(tmpDir, 'team.md'));
    await fs.unlink(path.join(tmpDir, 'decisions.md'));
    await fs.rm(path.join(tmpDir, 'tasks'), { recursive: true, force: true });

    const res = await app.inject({ method: 'GET', url: '/api/squad' });
    expect(res.statusCode).toBe(200);

    const body: SquadOverview = res.json();
    expect(body.agents).toEqual([]);
    expect(body.taskCounts.total).toBe(0);
    expect(body.recentDecisions).toEqual([]);
  });
});
