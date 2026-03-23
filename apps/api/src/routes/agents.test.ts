import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// Fixture setup — creates a temporary .squad/ directory with test data
// ---------------------------------------------------------------------------

let tmpDir: string;
let app: FastifyInstance;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-test-'));

  // Create team.md
  await fs.writeFile(
    path.join(tmpDir, 'team.md'),
    `# Squad Team

## Members

| Name | Role | Charter | Status |
|------|------|---------|--------|
| Leela | Lead | agents/leela/charter.md | ✅ Active |
| Bender | Backend | agents/bender/charter.md | 🟢 Active |
| Fry | Frontend | agents/fry/charter.md | 💤 Idle |
`,
    'utf-8',
  );

  // Create agent directories with charter + history
  await fs.mkdir(path.join(tmpDir, 'agents', 'leela'), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'agents', 'leela', 'charter.md'),
    `# Leela — Lead Agent

## Identity

**Expertise:** Architecture, planning, code review
**Style:** Thorough, detail-oriented

## Boundaries

**I handle:** Architecture decisions, code review, planning
**I don't handle:** Direct implementation of features
**When I'm unsure:** Consult the team for consensus
`,
    'utf-8',
  );
  await fs.writeFile(
    path.join(tmpDir, 'agents', 'leela', 'history.md'),
    `# Project Context

## Learnings

- First learning entry
- Second learning entry
`,
    'utf-8',
  );

  await fs.mkdir(path.join(tmpDir, 'agents', 'bender'), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'agents', 'bender', 'charter.md'),
    `# Bender — Backend Agent

## Identity

**Expertise:** Node.js, TypeScript, databases
**Style:** Fast and pragmatic
`,
    'utf-8',
  );

  // Create config.json
  await fs.writeFile(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ version: 1, allowedModels: ['gpt-5.4'], defaultModel: 'gpt-5.4' }),
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
// GET /api/agents
// ---------------------------------------------------------------------------

describe('GET /api/agents', () => {
  it('returns 200 with a list of agents', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(3);

    const ids = body.map((a: { id: string }) => a.id);
    expect(ids).toContain('leela');
    expect(ids).toContain('bender');
    expect(ids).toContain('fry');
  });

  it('each agent has required fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents' });
    const agents = res.json();

    for (const agent of agents) {
      expect(agent).toHaveProperty('id');
      expect(agent).toHaveProperty('name');
      expect(agent).toHaveProperty('role');
      expect(agent).toHaveProperty('status');
    }
  });

  it('returns empty array when team.md is missing', async () => {
    await fs.unlink(path.join(tmpDir, 'team.md'));

    const res = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/agents/:id
// ---------------------------------------------------------------------------

describe('GET /api/agents/:id', () => {
  it('returns 200 with agent detail including charter data', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents/leela' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('leela');
    expect(body.name).toBe('Leela');
    expect(body.role).toBe('Lead');
    expect(body.identity).toBeDefined();
    expect(body.boundaries).toBeDefined();
    expect(body.learnings).toEqual(['First learning entry', 'Second learning entry']);
  });

  it('returns agent detail with charter even without history', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents/bender' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.id).toBe('bender');
    expect(body.identity.expertise).toContain('Node.js');
    expect(body.learnings).toEqual([]);
  });

  it('returns 404 for non-existent agent', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/agents/zoidberg' });

    expect(res.statusCode).toBe(404);
    const body = res.json();
    expect(body.error).toContain('zoidberg');
  });
});
