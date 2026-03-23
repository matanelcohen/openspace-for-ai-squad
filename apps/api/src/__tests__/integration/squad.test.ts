/**
 * Integration tests — GET /api/squad (overview endpoint)
 *
 * Tests the squad overview endpoint that aggregates data from
 * agents, tasks, and decisions into a composite dashboard summary.
 */

import type { SquadOverview } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  expectJSON,
  FIXTURE_SQUAD_DIR,
  getEmptySquadDir,
  injectJSON,
} from '../helpers/setup.js';

describe('Squad Overview API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp(FIXTURE_SQUAD_DIR);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/squad', () => {
    it('returns 200 with a squad overview', async () => {
      const { statusCode, body, headers } = await injectJSON<SquadOverview>(
        app,
        'GET',
        '/api/squad',
      );

      expect(statusCode).toBe(200);
      expectJSON(headers);
      expect(body).toHaveProperty('config');
      expect(body).toHaveProperty('agents');
      expect(body).toHaveProperty('taskCounts');
      expect(body).toHaveProperty('recentDecisions');
    });

    it('config contains squad metadata', async () => {
      const { body } = await injectJSON<SquadOverview>(
        app,
        'GET',
        '/api/squad',
      );

      expect(body.config).toHaveProperty('squadDir');
      expect(body.config).toHaveProperty('agents');
      expect(body.config.id).toBe('default');
    });

    it('includes all 4 agents', async () => {
      const { body } = await injectJSON<SquadOverview>(
        app,
        'GET',
        '/api/squad',
      );

      expect(body.agents).toHaveLength(4);
      const ids = body.agents.map((a) => a.id);
      expect(ids).toContain('leela');
      expect(ids).toContain('fry');
      expect(ids).toContain('bender');
      expect(ids).toContain('zoidberg');
    });

    it('includes task counts with correct totals', async () => {
      const { body } = await injectJSON<SquadOverview>(
        app,
        'GET',
        '/api/squad',
      );

      expect(body.taskCounts).toHaveProperty('byStatus');
      expect(body.taskCounts).toHaveProperty('total');
      expect(typeof body.taskCounts.total).toBe('number');

      // With the task fixtures, we expect 5 total
      expect(body.taskCounts.total).toBe(5);
    });

    it('breaks down task counts by status', async () => {
      const { body } = await injectJSON<SquadOverview>(
        app,
        'GET',
        '/api/squad',
      );

      const byStatus = body.taskCounts.byStatus;
      expect(byStatus).toHaveProperty('backlog');
      expect(byStatus).toHaveProperty('in-progress');
      expect(byStatus).toHaveProperty('in-review');
      expect(byStatus).toHaveProperty('done');
      expect(byStatus).toHaveProperty('blocked');

      // From our fixtures:
      // task-fixture-001: in-progress, 002: backlog, 003: in-review, 004: done, 005: blocked
      expect(byStatus['in-progress']).toBe(1);
      expect(byStatus['backlog']).toBe(1);
      expect(byStatus['in-review']).toBe(1);
      expect(byStatus['done']).toBe(1);
      expect(byStatus['blocked']).toBe(1);
    });

    it('includes recent decisions', async () => {
      const { body } = await injectJSON<SquadOverview>(
        app,
        'GET',
        '/api/squad',
      );

      expect(body.recentDecisions.length).toBeGreaterThan(0);
      expect(body.recentDecisions.length).toBeLessThanOrEqual(10);
    });

    it('includes recent tasks', async () => {
      const { body } = await injectJSON<SquadOverview>(
        app,
        'GET',
        '/api/squad',
      );

      expect(body.recentTasks).toBeDefined();
      expect(Array.isArray(body.recentTasks)).toBe(true);
    });
  });

  describe('GET /api/squad — empty directory', () => {
    let emptyApp: FastifyInstance;

    beforeEach(async () => {
      const emptyDir = await getEmptySquadDir();
      emptyApp = await buildTestApp(emptyDir);
    });

    afterEach(async () => {
      await emptyApp.close();
    });

    it('returns 200 with empty aggregations', async () => {
      const { statusCode, body } = await injectJSON<SquadOverview>(
        emptyApp,
        'GET',
        '/api/squad',
      );

      expect(statusCode).toBe(200);
      expect(body.agents).toEqual([]);
      expect(body.recentDecisions).toEqual([]);
      expect(body.taskCounts.total).toBe(0);
    });
  });
});
