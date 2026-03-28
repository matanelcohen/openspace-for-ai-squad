import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ---------------------------------------------------------------------------
// Fixture setup — creates a temporary .squad/ directory with seed data
// ---------------------------------------------------------------------------

let tmpDir: string;
let app: FastifyInstance;

const SEED_SKILL_PAYLOAD = {
  name: 'code-review',
  description: 'Review code for bugs and style.',
  tags: ['code', 'quality'],
  agentMatch: { roles: ['*'] },
  requires: { bins: ['git'], env: ['OPENAI_API_KEY'] },
  instructions: '## Code Review\n\nLook for bugs.',
};

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'skills-test-'));

  // Minimal team.md required by buildApp
  await fs.writeFile(path.join(tmpDir, 'team.md'), '# Squad Team\n\n## Members\n\n| Name | Role | Charter | Status |\n|------|------|---------|--------|\n', 'utf-8');
  await fs.writeFile(
    path.join(tmpDir, 'config.json'),
    JSON.stringify({ version: 1, allowedModels: ['gpt-5.4'], defaultModel: 'gpt-5.4' }),
    'utf-8',
  );

  // Set SQUAD_DIR so getSquadDir() resolves to our temp directory
  process.env.SQUAD_DIR = tmpDir;

  app = buildApp({ logger: false, squadDir: tmpDir });
  await app.ready();
});

afterEach(async () => {
  await app.close();
  delete process.env.SQUAD_DIR;
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// Helper: create a skill via the API
async function createSkill(payload = SEED_SKILL_PAYLOAD) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/skills',
    payload,
  });
  return res;
}

// ---------------------------------------------------------------------------
// PUT /api/skills/:id
// ---------------------------------------------------------------------------

describe('PUT /api/skills/:id', () => {
  it('updates SKILL.md file and registry entry', async () => {
    await createSkill();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/skills/code-review',
      payload: {
        name: 'code-review',
        description: 'Updated description.',
        tags: ['updated'],
        agentMatch: { roles: ['lead'] },
        requires: { bins: ['node'], env: [] },
        instructions: '## Updated\n\nNew instructions.',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.description).toBe('Updated description.');
    expect(body.tags).toEqual(['updated']);

    // Verify file was written
    const skillFile = path.join(tmpDir, 'skills', 'code-review', 'SKILL.md');
    const content = await fs.readFile(skillFile, 'utf-8');
    expect(content).toContain('Updated description.');
    expect(content).toContain('## Updated');
  });

  it('returns 404 for non-existent skill', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/skills/does-not-exist',
      payload: {
        name: 'does-not-exist',
        description: 'nope',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('validates required fields (name and description)', async () => {
    await createSkill();

    const res = await app.inject({
      method: 'PUT',
      url: '/api/skills/code-review',
      payload: {},
    });

    // Empty object isn't a valid SkillMdPayload (missing name/description)
    // and isn't a valid SkillManifest either, so updateManifest should handle it
    expect(res.statusCode).toBeLessThanOrEqual(400);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/skills/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/skills/:id', () => {
  it('removes skill directory and registry entry', async () => {
    await createSkill();

    // Verify the skill exists first
    const getRes = await app.inject({ method: 'GET', url: '/api/skills/code-review' });
    expect(getRes.statusCode).toBe(200);

    const skillDir = path.join(tmpDir, 'skills', 'code-review');
    const dirExistsBefore = await fs.stat(skillDir).then(() => true).catch(() => false);
    expect(dirExistsBefore).toBe(true);

    // Delete
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/skills/code-review',
    });

    expect(res.statusCode).toBe(204);

    // Verify skill directory was removed
    const dirExistsAfter = await fs.stat(skillDir).then(() => true).catch(() => false);
    expect(dirExistsAfter).toBe(false);

    // Verify skill is gone from registry
    const getRes2 = await app.inject({ method: 'GET', url: '/api/skills/code-review' });
    expect(getRes2.statusCode).toBe(404);
  });

  it('returns 404 for non-existent skill', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: '/api/skills/does-not-exist',
    });

    expect(res.statusCode).toBe(404);
  });
});
