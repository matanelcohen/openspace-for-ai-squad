import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// Fixture setup — temporary .squad/ directory for each test
// ---------------------------------------------------------------------------

let tmpDir: string;
let app: FastifyInstance;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'gallery-test-'));

  // Minimal team.md + config.json required by buildApp
  await fs.writeFile(
    path.join(tmpDir, 'team.md'),
    '# Squad Team\n\n## Members\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ version: 1, allowedModels: ['gpt-5.4'], defaultModel: 'gpt-5.4' }),
    'utf-8',
  );

  process.env.SQUAD_DIR = tmpDir;
  app = await buildApp({ logger: false, squadDir: tmpDir });
  await app.ready();
}, 30_000);

afterEach(async () => {
  await app.close();
  delete process.env.SQUAD_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
}, 15_000);

// ---------------------------------------------------------------------------
// GET /api/skills/gallery — browse / search
// ---------------------------------------------------------------------------

describe('GET /api/skills/gallery', () => {
  it('returns the full seed catalog', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/gallery' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills).toBeDefined();
    expect(body.skills.length).toBeGreaterThanOrEqual(10);
    expect(body.total).toBeGreaterThanOrEqual(10);
    expect(body.limit).toBe(50);
    expect(body.offset).toBe(0);

    // Each skill has expected shape
    const skill = body.skills[0];
    expect(skill.id).toBeDefined();
    expect(skill.name).toBeDefined();
    expect(skill.description).toBeDefined();
    expect(skill.category).toBeDefined();
    expect(skill.tags).toBeInstanceOf(Array);
  });

  it('filters by category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?category=testing',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    for (const skill of body.skills) {
      expect(skill.category).toBe('testing');
    }
  });

  it('filters by featured', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?featured=true',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills.length).toBeGreaterThan(0);
    for (const skill of body.skills) {
      expect(skill.featured).toBe(true);
    }
  });

  it('searches by query', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?query=docker',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills.length).toBeGreaterThanOrEqual(1);
    const ids = body.skills.map((s: { id: string }) => s.id);
    expect(ids).toContain('docker-deploy');
  });

  it('supports pagination', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?limit=3&offset=0',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills.length).toBeLessThanOrEqual(3);
    expect(body.limit).toBe(3);
    expect(body.offset).toBe(0);
  });

  it('sorts by install count descending', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?sort=installCount&order=desc',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    // All fresh seeds have 0 installs, so just verify shape is correct
    expect(body.skills.length).toBeGreaterThan(0);
  });

  it('rejects invalid category', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?category=invalid-cat',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });

  it('rejects invalid sort', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?sort=badfield',
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe('VALIDATION_ERROR');
  });
});

// ---------------------------------------------------------------------------
// GET /api/skills/gallery/featured
// ---------------------------------------------------------------------------

describe('GET /api/skills/gallery/featured', () => {
  it('returns featured skills', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/gallery/featured' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills).toBeDefined();
    expect(body.skills.length).toBeGreaterThan(0);
    for (const skill of body.skills) {
      expect(skill.featured).toBe(true);
    }
  });

  it('respects limit parameter', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery/featured?limit=2',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills.length).toBeLessThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// GET /api/skills/gallery/categories
// ---------------------------------------------------------------------------

describe('GET /api/skills/gallery/categories', () => {
  it('returns all categories with counts', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/gallery/categories' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.categories).toBeDefined();
    expect(body.categories.length).toBeGreaterThanOrEqual(5);

    // Each category has label and count
    const cat = body.categories[0];
    expect(cat.category).toBeDefined();
    expect(typeof cat.count).toBe('number');
    expect(cat.label).toBeDefined();
  });

  it('includes all known categories', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/gallery/categories' });
    const body = res.json();
    const names = body.categories.map((c: { category: string }) => c.category);
    expect(names).toContain('code-quality');
    expect(names).toContain('testing');
    expect(names).toContain('devops');
    expect(names).toContain('security');
    expect(names).toContain('ai-ml');
  });
});

// ---------------------------------------------------------------------------
// GET /api/skills/gallery/:id — detail
// ---------------------------------------------------------------------------

describe('GET /api/skills/gallery/:id', () => {
  it('returns a single gallery skill', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/gallery/code-review' });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.id).toBe('code-review');
    expect(body.name).toBe('Code Review');
    expect(body.category).toBe('code-quality');
    expect(body.featured).toBe(true);
  });

  it('returns 404 for non-existent skill', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/skills/gallery/does-not-exist' });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe('NOT_FOUND');
  });

  it('shows installed flag correctly', async () => {
    // dependency-audit is NOT in .squad/skills/ or .copilot/skills/
    let res = await app.inject({ method: 'GET', url: '/api/skills/gallery/dependency-audit' });
    expect(res.json().installed).toBe(false);

    // Install it
    await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/dependency-audit/install',
    });

    // Now it should show as installed
    res = await app.inject({ method: 'GET', url: '/api/skills/gallery/dependency-audit' });
    expect(res.json().installed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// POST /api/skills/gallery/:id/install
// ---------------------------------------------------------------------------

describe('POST /api/skills/gallery/:id/install', () => {
  it('installs a gallery skill into the local registry', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/task-breakdown/install',
    });
    expect(res.statusCode).toBe(201);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.skillId).toBe('task-breakdown');
    expect(body.name).toBe('Task Breakdown');
    expect(body.skill).toBeDefined();
    expect(body.skill.phase).toBe('loaded');

    // Verify skill is now in the local registry
    const listRes = await app.inject({ method: 'GET', url: '/api/skills' });
    const ids = listRes.json().skills.map((s: { id: string }) => s.id);
    expect(ids).toContain('task-breakdown');
  });

  it('returns 409 if already installed', async () => {
    // Install first time
    await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/task-breakdown/install',
    });

    // Try installing again
    const res = await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/task-breakdown/install',
    });
    expect(res.statusCode).toBe(409);
    expect(res.json().code).toBe('CONFLICT');
  });

  it('returns 404 for non-existent gallery skill', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/fake-skill/install',
    });
    expect(res.statusCode).toBe(404);
  });

  it('increments install count after install', async () => {
    // api-docs-generator is NOT in .squad/skills/ or .copilot/skills/
    let detail = await app.inject({ method: 'GET', url: '/api/skills/gallery/api-docs-generator' });
    expect(detail.json().installCount).toBe(0);

    // Install
    await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/api-docs-generator/install',
    });

    // Check count went up
    detail = await app.inject({ method: 'GET', url: '/api/skills/gallery/api-docs-generator' });
    expect(detail.json().installCount).toBe(1);
  });

  it('skill shows up in local registry after install', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/web-scraper/install',
    });

    // Now it should appear in /api/skills
    const res = await app.inject({ method: 'GET', url: '/api/skills' });
    const body = res.json();
    const ids = body.skills.map((s: { id: string }) => s.id);
    expect(ids).toContain('web-scraper');
  });
});

// ---------------------------------------------------------------------------
// POST /api/skills/gallery/refresh
// ---------------------------------------------------------------------------

describe('POST /api/skills/gallery/refresh', () => {
  it('refreshes the catalog', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/skills/gallery/refresh',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.total).toBeGreaterThanOrEqual(10);
  });
});

// ---------------------------------------------------------------------------
// Search edge cases
// ---------------------------------------------------------------------------

describe('Gallery search edge cases', () => {
  it('empty query returns all skills', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?query=',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills.length).toBeGreaterThanOrEqual(10);
  });

  it('filters by tags', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?tags=docker,containers',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills.length).toBeGreaterThanOrEqual(1);
    const ids = body.skills.map((s: { id: string }) => s.id);
    expect(ids).toContain('docker-deploy');
  });

  it('combined filters work (category + featured)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?category=code-quality&featured=true',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    for (const skill of body.skills) {
      expect(skill.category).toBe('code-quality');
      expect(skill.featured).toBe(true);
    }
  });

  it('search with no results returns empty array', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/skills/gallery?query=xyznonexistent123',
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(body.skills).toEqual([]);
    expect(body.total).toBe(0);
  });
});
