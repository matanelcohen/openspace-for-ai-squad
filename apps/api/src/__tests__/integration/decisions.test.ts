/**
 * Integration tests — Decisions API
 *
 * Tests GET /api/decisions and GET /api/decisions/:id.
 * Also tests search/filter functionality.
 */

import type { Decision } from '@openspace/shared';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  buildTestApp,
  expectJSON,
  FIXTURE_SQUAD_DIR,
  injectJSON,
} from '../helpers/setup.js';

describe('Decisions API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp(FIXTURE_SQUAD_DIR);
  });

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/decisions
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/decisions', () => {
    it('returns 200 with an array of decisions', async () => {
      const { statusCode, body, headers } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );

      expect(statusCode).toBe(200);
      expectJSON(headers);
      expect(Array.isArray(body)).toBe(true);
    });

    it('returns all 3 fixture decisions', async () => {
      const { body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );

      expect(body).toHaveLength(3);
    });

    it('each decision has required fields', async () => {
      const { body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );

      for (const decision of body) {
        expect(decision).toHaveProperty('id');
        expect(decision).toHaveProperty('title');
        expect(decision).toHaveProperty('author');
        expect(decision).toHaveProperty('date');
        expect(decision).toHaveProperty('status');
        expect(typeof decision.id).toBe('string');
        expect(typeof decision.title).toBe('string');
      }
    });

    it('returns decisions with correct data', async () => {
      const { body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );

      const prd = body.find((d) => d.title.includes('PRD created'));
      expect(prd).toBeDefined();
      expect(prd!.author).toContain('Leela');
      expect(prd!.status).toBe('active');
    });

    it('returns affected files when present', async () => {
      const { body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );

      const prd = body.find((d) => d.title.includes('PRD'));
      expect(prd).toBeDefined();
      expect(prd!.affectedFiles).toContain('docs/prd.md');
    });

    it('all fixture decisions have active status', async () => {
      const { body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );

      for (const decision of body) {
        expect(decision.status).toBe('active');
      }
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/decisions/:id
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/decisions/:id', () => {
    it('returns 200 with a single decision', async () => {
      // First, get all decisions to find a valid ID
      const { body: all } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );
      const firstId = all[0]!.id;

      const { statusCode, body } = await injectJSON<Decision>(
        app,
        'GET',
        `/api/decisions/${firstId}`,
      );

      expect(statusCode).toBe(200);
      expect(body.id).toBe(firstId);
    });

    it('returns full decision detail including rationale', async () => {
      const { body: all } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions',
      );
      const firstId = all[0]!.id;

      const { body } = await injectJSON<Decision>(
        app,
        'GET',
        `/api/decisions/${firstId}`,
      );

      expect(body.rationale).toBeDefined();
      expect(typeof body.rationale).toBe('string');
    });

    it('returns 404 for non-existent decision', async () => {
      const { statusCode } = await injectJSON(
        app,
        'GET',
        '/api/decisions/nonexistent-decision-id',
      );

      expect(statusCode).toBe(404);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // GET /api/decisions/search?q=...
  // ─────────────────────────────────────────────────────────────

  describe('GET /api/decisions/search?q=...', () => {
    it('filters decisions by search term in title', async () => {
      const { statusCode, body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions/search?q=PRD',
      );

      expect(statusCode).toBe(200);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(body.every((d) => d.title.toLowerCase().includes('prd'))).toBe(true);
    });

    it('returns empty array when search finds no matches', async () => {
      const { statusCode, body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions/search?q=xyznonexistent',
      );

      expect(statusCode).toBe(200);
      expect(body).toHaveLength(0);
    });

    it('search is case-insensitive', async () => {
      const { body: upper } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions/search?q=MONOREPO',
      );
      const { body: lower } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions/search?q=monorepo',
      );

      expect(upper.length).toBe(lower.length);
      expect(upper.length).toBeGreaterThanOrEqual(1);
    });

    it('searches across title, rationale, and author', async () => {
      const { body } = await injectJSON<Decision[]>(
        app,
        'GET',
        '/api/decisions/search?q=Bender',
      );

      expect(body.length).toBeGreaterThanOrEqual(1);
    });

    it('returns 400 when q is missing', async () => {
      const { statusCode } = await injectJSON(
        app,
        'GET',
        '/api/decisions/search',
      );

      expect(statusCode).toBe(400);
    });
  });
});
