import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildApp } from '../app.js';

// ── Fixture Setup ────────────────────────────────────────────────

let tmpDir: string;
let app: FastifyInstance;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'memories-test-'));

  // Minimum squad structure
  await fs.writeFile(path.join(tmpDir, 'team.md'), '# Team\n\n## Members\n\n| Name | Role |\n|------|------|\n', 'utf-8');
  await fs.writeFile(path.join(tmpDir, 'config.json'), JSON.stringify({ version: '1.0.0' }), 'utf-8');
  await fs.mkdir(path.join(tmpDir, 'tasks'), { recursive: true });

  // Agent with history.md
  await fs.mkdir(path.join(tmpDir, 'agents', 'bender'), { recursive: true });
  await fs.writeFile(
    path.join(tmpDir, 'agents', 'bender', 'charter.md'),
    '# Bender\n\n## Identity\n\n**Expertise:** Backend\n',
    'utf-8',
  );
  await fs.writeFile(
    path.join(tmpDir, 'agents', 'bender', 'history.md'),
    '# Project Context\n\n## Learnings\n\n- Uses Fastify for API layer\n- Tests use vitest with in-memory SQLite\n',
    'utf-8',
  );

  app = await buildApp({ logger: false, squadDir: tmpDir });
  await app.ready();
}, 30_000);

afterEach(async () => {
  await app?.close();
  await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
});

// ── Tests ────────────────────────────────────────────────────────

describe('Memories API', () => {
  // ── GET /api/memories ─────────────────────────────────────────

  describe('GET /api/memories', () => {
    it('returns an array (possibly empty)', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/memories' });
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.json())).toBe(true);
    });

    it('filters by agentId query param', async () => {
      // Create a memory first
      await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: { agentId: 'bender', type: 'decision', content: 'Test memory', sourceSession: 'test' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/memories?agentId=bender',
      });
      expect(res.statusCode).toBe(200);
      const memories = res.json() as Array<{ agentId: string }>;
      expect(memories.length).toBeGreaterThanOrEqual(1);
      expect(memories.every((m) => m.agentId === 'bender')).toBe(true);
    });

    it('filters by type query param', async () => {
      await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: { agentId: 'bender', type: 'decision', content: 'A decision', sourceSession: 'test' },
      });
      await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: { agentId: 'bender', type: 'pattern', content: 'A pattern', sourceSession: 'test' },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/memories?agentId=bender&type=decision',
      });
      expect(res.statusCode).toBe(200);
      const memories = res.json() as Array<{ type: string }>;
      expect(memories.every((m) => m.type === 'decision')).toBe(true);
    });
  });

  // ── POST /api/memories ────────────────────────────────────────

  describe('POST /api/memories', () => {
    it('creates a new memory and returns 201', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'decision',
          content: 'Chose SQLite for storage',
          sourceSession: 'test-session',
        },
      });

      expect(res.statusCode).toBe(201);
      const memory = res.json() as { id: string; content: string; agentId: string; type: string };
      expect(memory.id).toBeDefined();
      expect(memory.content).toBe('Chose SQLite for storage');
      expect(memory.agentId).toBe('bender');
      expect(memory.type).toBe('decision');
    });

    it('rejects missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: { agentId: 'bender' }, // missing type and content
      });
      expect(res.statusCode).toBe(400);
    });

    it('rejects invalid memory type', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'invalid_type',
          content: 'Test',
          sourceSession: 'test',
        },
      });
      expect(res.statusCode).toBe(400);
    });

    it('deduplicates identical content (boosts strength)', async () => {
      const payload = {
        agentId: 'bender',
        type: 'pattern',
        content: 'Exact same content',
        sourceSession: 'test',
      };

      const res1 = await app.inject({ method: 'POST', url: '/api/memories', payload });
      const res2 = await app.inject({ method: 'POST', url: '/api/memories', payload });

      const mem1 = res1.json() as { id: string };
      const mem2 = res2.json() as { id: string };
      expect(mem1.id).toBe(mem2.id); // Same memory, boosted
    });
  });

  // ── POST /api/memories/search ─────────────────────────────────

  describe('POST /api/memories/search', () => {
    it('searches memories by query', async () => {
      // Seed a memory
      await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'decision',
          content: 'We use TypeScript strict mode for all projects',
          sourceSession: 'test',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/memories/search',
        payload: { query: 'TypeScript', agentId: 'bender' },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json() as { results: Array<{ memory: { content: string } }> };
      expect(body.results).toBeDefined();
    });

    it('rejects missing query', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/memories/search',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /api/memories/consolidate ────────────────────────────

  describe('POST /api/memories/consolidate', () => {
    it('consolidates all agents', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/memories/consolidate',
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty('agents');
    });

    it('consolidates a specific agent', async () => {
      // Create a memory so 'bender' exists
      await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'pattern',
          content: 'A test pattern memory',
          sourceSession: 'test',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/memories/consolidate',
        payload: { agentId: 'bender' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { agents: Record<string, { remaining: number }> };
      expect(body.agents).toHaveProperty('bender');
    });
  });

  // ── GET /api/memories/settings ────────────────────────────────

  describe('GET /api/memories/settings', () => {
    it('returns settings with stats', async () => {
      // Ensure clean state — reset to defaults
      await app.inject({
        method: 'PATCH',
        url: '/api/memories/settings',
        payload: { globalEnabled: true },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/memories/settings',
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { globalEnabled: boolean; agentSettings: Record<string, boolean> };
      expect(body.globalEnabled).toBe(true);
      expect(body.agentSettings).toBeDefined();
    });
  });

  // ── PATCH /api/memories/settings ──────────────────────────────

  describe('PATCH /api/memories/settings', () => {
    it('updates global enabled setting', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/memories/settings',
        payload: { globalEnabled: false },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { globalEnabled: boolean };
      expect(body.globalEnabled).toBe(false);
    });

    it('updates per-agent settings', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/memories/settings',
        payload: { agentSettings: { bender: false, fry: true } },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { agentSettings: Record<string, boolean> };
      expect(body.agentSettings.bender).toBe(false);
      expect(body.agentSettings.fry).toBe(true);
    });

    it('persists settings across requests', async () => {
      await app.inject({
        method: 'PATCH',
        url: '/api/memories/settings',
        payload: { globalEnabled: false, agentSettings: { bender: false } },
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/memories/settings',
      });
      const body = res.json() as { globalEnabled: boolean; agentSettings: Record<string, boolean> };
      expect(body.globalEnabled).toBe(false);
      expect(body.agentSettings.bender).toBe(false);
    });
  });

  // ── PATCH /api/memories/:id ───────────────────────────────────

  describe('PATCH /api/memories/:id', () => {
    it('updates memory content', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'decision',
          content: 'Original content',
          sourceSession: 'test',
        },
      });
      const { id } = createRes.json() as { id: string };

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/memories/${id}`,
        payload: { content: 'Updated content' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect((updateRes.json() as { content: string }).content).toBe('Updated content');
    });

    it('updates memory type', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'pattern',
          content: 'Test content',
          sourceSession: 'test',
        },
      });
      const { id } = createRes.json() as { id: string };

      const updateRes = await app.inject({
        method: 'PATCH',
        url: `/api/memories/${id}`,
        payload: { type: 'decision' },
      });
      expect(updateRes.statusCode).toBe(200);
      expect((updateRes.json() as { type: string }).type).toBe('decision');
    });

    it('returns 404 for non-existent memory', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/memories/non-existent-id',
        payload: { content: 'Updated' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('returns 400 when no fields provided', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/memories/some-id',
        payload: {},
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── DELETE /api/memories/:id ──────────────────────────────────

  describe('DELETE /api/memories/:id', () => {
    it('deletes a memory', async () => {
      const createRes = await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'decision',
          content: 'To be deleted',
          sourceSession: 'test',
        },
      });
      const { id } = createRes.json() as { id: string };

      const deleteRes = await app.inject({
        method: 'DELETE',
        url: `/api/memories/${id}`,
      });
      expect(deleteRes.statusCode).toBe(200);
      expect(deleteRes.json()).toEqual({ success: true });
    });

    it('returns 404 for non-existent memory', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/memories/non-existent-id',
      });
      expect(res.statusCode).toBe(404);
    });
  });

  // ── POST /api/memories/sync ───────────────────────────────────

  describe('POST /api/memories/sync', () => {
    it('syncs history.md files', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/memories/sync',
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { synced: number; skipped: number };
      expect(body).toHaveProperty('synced');
      expect(body).toHaveProperty('skipped');
    });

    it('writes back memories when writeback=true', async () => {
      // Create a unique memory via API
      await app.inject({
        method: 'POST',
        url: '/api/memories',
        payload: {
          agentId: 'bender',
          type: 'decision',
          content: 'New memory from API that should be written back',
          sourceSession: 'test',
        },
      });

      const res = await app.inject({
        method: 'POST',
        url: '/api/memories/sync',
        payload: { writeback: true },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { written: number };
      expect(body).toHaveProperty('written');
    });
  });
});
