import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// Fixture setup
// ---------------------------------------------------------------------------

let tmpDir: string;
let app: FastifyInstance;

const DECISIONS_MD = `# Squad Decisions

## Active Decisions

### 2026-03-23T20:42:00Z: PRD created for openspace.ai
**By:** Leela (Lead)
**What:** Created the v1 Product Requirements Document.
**Why:** The team needed a shared source of truth for scope.
**Impact:** All agents should read \`docs/prd.md\` before starting.

### 2026-03-23T20:50:00Z: Execution plan created from PRD
**By:** Leela (Lead)
**What:** Created the execution plan with 43 work items.
**Why:** The PRD needed to be decomposed into executable work.
**Impact:** Phase 0 can begin immediately.

### 2026-03-23T20:57:00Z: Monorepo decision resolved
**By:** Matanel Cohen
**What:** D1 resolved in favor of monorepo structure.
**Why:** User accepted recommendation for shared types and single CI.

## Superseded Decisions

### 2026-03-20T10:00:00Z: Separate repos considered
**By:** Bender
**What:** Initially proposed separate repos for frontend and backend.
**Why:** Simpler initial setup.
`;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'decisions-test-'));

  await fs.writeFile(path.join(tmpDir, 'decisions.md'), DECISIONS_MD, 'utf-8');
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
// GET /api/decisions
// ---------------------------------------------------------------------------

describe('GET /api/decisions', () => {
  it('returns 200 with a list of decisions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions' });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBe(4);
  });

  it('includes active and superseded decisions', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions' });
    const decisions = res.json();

    const statuses = decisions.map((d: { status: string }) => d.status);
    expect(statuses).toContain('active');
    expect(statuses).toContain('superseded');
  });

  it('each decision has required fields', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions' });
    const decisions = res.json();

    for (const d of decisions) {
      expect(d).toHaveProperty('id');
      expect(d).toHaveProperty('title');
      expect(d).toHaveProperty('author');
      expect(d).toHaveProperty('date');
      expect(d).toHaveProperty('status');
    }
  });

  it('returns empty array when decisions.md is missing', async () => {
    await fs.unlink(path.join(tmpDir, 'decisions.md'));

    const res = await app.inject({ method: 'GET', url: '/api/decisions' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// GET /api/decisions/:id
// ---------------------------------------------------------------------------

describe('GET /api/decisions/:id', () => {
  it('returns a decision by ID', async () => {
    // Get all decisions to find a valid ID
    const listRes = await app.inject({ method: 'GET', url: '/api/decisions' });
    const decisions = listRes.json();
    const firstId = decisions[0].id;

    const res = await app.inject({ method: 'GET', url: `/api/decisions/${firstId}` });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(firstId);
  });

  it('returns 404 for non-existent decision', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions/nonexistent-id' });

    expect(res.statusCode).toBe(404);
    expect(res.json().error).toContain('nonexistent-id');
  });
});

// ---------------------------------------------------------------------------
// GET /api/decisions/search
// ---------------------------------------------------------------------------

describe('GET /api/decisions/search', () => {
  it('returns decisions matching search query in title', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions/search?q=PRD' });

    expect(res.statusCode).toBe(200);
    const results = res.json();
    expect(results.length).toBeGreaterThan(0);
    const titles = results.map((d: { title: string }) => d.title.toLowerCase());
    expect(titles.some((t: string) => t.includes('prd'))).toBe(true);
  });

  it('returns decisions matching search query in rationale', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/decisions/search?q=shared%20types',
    });

    expect(res.statusCode).toBe(200);
    const results = res.json();
    expect(results.length).toBeGreaterThan(0);
  });

  it('returns decisions matching by author', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions/search?q=Bender' });

    expect(res.statusCode).toBe(200);
    const results = res.json();
    expect(results.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions/search?q=prd' });

    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThan(0);
  });

  it('returns empty array when no matches found', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/decisions/search?q=zzzzzznonexistent',
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns 400 when q parameter is missing', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions/search' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('q');
  });

  it('returns 400 when q parameter is empty', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/decisions/search?q=' });

    expect(res.statusCode).toBe(400);
    expect(res.json().error).toContain('q');
  });
});
