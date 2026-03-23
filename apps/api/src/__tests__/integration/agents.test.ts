/**
 * Integration tests — GET /api/agents and GET /api/agents/:id
 *
 * Tests the agents endpoints against the fixture .squad/ directory.
 * These tests define the API contract — routes may not exist yet (TDD).
 */

import type { Agent, AgentDetail } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  expectJSON,
  FIXTURE_SQUAD_DIR,
  injectJSON,
} from '../helpers/setup.js';

describe('Agents API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp(FIXTURE_SQUAD_DIR);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/agents
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/agents', () => {
    it('returns 200 with an array of agents', async () => {
      const { statusCode, body, headers } = await injectJSON<Agent[]>(
        app,
        'GET',
        '/api/agents',
      );

      expect(statusCode).toBe(200);
      expectJSON(headers);
      expect(Array.isArray(body)).toBe(true);
    });

    it('returns all 4 fixture agents', async () => {
      const { body } = await injectJSON<Agent[]>(app, 'GET', '/api/agents');

      expect(body).toHaveLength(4);
      const ids = body.map((a) => a.id);
      expect(ids).toContain('leela');
      expect(ids).toContain('fry');
      expect(ids).toContain('bender');
      expect(ids).toContain('zoidberg');
    });

    it('each agent has required fields', async () => {
      const { body } = await injectJSON<Agent[]>(app, 'GET', '/api/agents');

      for (const agent of body) {
        expect(agent).toHaveProperty('id');
        expect(agent).toHaveProperty('name');
        expect(agent).toHaveProperty('role');
        expect(agent).toHaveProperty('status');
        expect(typeof agent.id).toBe('string');
        expect(typeof agent.name).toBe('string');
        expect(typeof agent.role).toBe('string');
      }
    });

    it('agents have correct roles', async () => {
      const { body } = await injectJSON<Agent[]>(app, 'GET', '/api/agents');

      const byId = Object.fromEntries(body.map((a) => [a.id, a]));
      expect(byId['leela']!.role).toBe('Lead');
      expect(byId['fry']!.role).toBe('Frontend Dev');
      expect(byId['bender']!.role).toBe('Backend Dev');
      expect(byId['zoidberg']!.role).toBe('Tester');
    });

    it('agents have active status from fixture', async () => {
      const { body } = await injectJSON<Agent[]>(app, 'GET', '/api/agents');

      for (const agent of body) {
        expect(agent.status).toBe('active');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/agents/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/agents/:id', () => {
    it('returns 200 with agent detail for existing agent', async () => {
      const { statusCode, body, headers } = await injectJSON<AgentDetail>(
        app,
        'GET',
        '/api/agents/leela',
      );

      expect(statusCode).toBe(200);
      expectJSON(headers);
      expect(body.id).toBe('leela');
      expect(body.name).toBe('Leela');
    });

    it('returns charter data for agents with charter files', async () => {
      const { body } = await injectJSON<AgentDetail>(
        app,
        'GET',
        '/api/agents/bender',
      );

      expect(body.charterPath).toBe('agents/bender/charter.md');
      expect(body.identity).toBeDefined();
      expect(body.identity.expertise).toContain('API design');
      expect(body.boundaries).toBeDefined();
      expect(body.boundaries.handles).toContain('REST endpoints');
    });

    it('returns learnings from history.md', async () => {
      const { body } = await injectJSON<AgentDetail>(
        app,
        'GET',
        '/api/agents/leela',
      );

      expect(body.learnings).toBeDefined();
      expect(Array.isArray(body.learnings)).toBe(true);
      expect(body.learnings.length).toBeGreaterThan(0);
    });

    it('returns 404 for non-existent agent', async () => {
      const { statusCode } = await injectJSON(
        app,
        'GET',
        '/api/agents/professor-farnsworth',
      );

      expect(statusCode).toBe(404);
    });

    it('handles agents without charter gracefully', async () => {
      // Fry and Zoidberg don't have charter files in the fixture
      const { statusCode, body } = await injectJSON<AgentDetail>(
        app,
        'GET',
        '/api/agents/fry',
      );

      expect(statusCode).toBe(200);
      expect(body.id).toBe('fry');
      expect(body.charterPath).toBeNull();
      expect(body.learnings).toEqual([]);
    });
  });
});
