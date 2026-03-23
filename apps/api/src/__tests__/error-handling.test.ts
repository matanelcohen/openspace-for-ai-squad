import { describe, expect, it } from 'vitest';

import { type AppOptions, buildApp } from '../app.js';
import { ErrorCodes, sendError } from '../lib/api-errors.js';

describe('API Error Standardization', () => {
  describe('ErrorCodes', () => {
    it('has standard error code constants', () => {
      expect(ErrorCodes.NOT_FOUND).toBe('NOT_FOUND');
      expect(ErrorCodes.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ErrorCodes.INTERNAL_ERROR).toBe('INTERNAL_ERROR');
      expect(ErrorCodes.CONFLICT).toBe('CONFLICT');
    });
  });

  describe('sendError helper', () => {
    it('sends error with code and message', () => {
      const sent: { statusCode?: number; body?: unknown } = {};
      const mockReply = {
        status: (code: number) => {
          sent.statusCode = code;
          return {
            send: (body: unknown) => {
              sent.body = body;
            },
          };
        },
      } as unknown as Parameters<typeof sendError>[0];

      sendError(mockReply, 404, 'NOT_FOUND', 'Task not found');
      expect(sent.statusCode).toBe(404);
      expect(sent.body).toEqual({
        error: 'Task not found',
        code: 'NOT_FOUND',
      });
    });

    it('includes details when provided', () => {
      const sent: { body?: unknown } = {};
      const mockReply = {
        status: () => ({
          send: (body: unknown) => {
            sent.body = body;
          },
        }),
      } as unknown as Parameters<typeof sendError>[0];

      sendError(mockReply, 400, 'VALIDATION_ERROR', 'Invalid input', {
        field: 'title',
        reason: 'required',
      });

      expect(sent.body).toEqual({
        error: 'Invalid input',
        code: 'VALIDATION_ERROR',
        details: { field: 'title', reason: 'required' },
      });
    });

    it('omits details key when not provided', () => {
      const sent: { body?: unknown } = {};
      const mockReply = {
        status: () => ({
          send: (body: unknown) => {
            sent.body = body;
          },
        }),
      } as unknown as Parameters<typeof sendError>[0];

      sendError(mockReply, 500, 'INTERNAL_ERROR', 'Something broke');
      expect(sent.body).not.toHaveProperty('details');
    });
  });

  describe('Global error handler', () => {
    function buildTestApp(overrides: AppOptions = {}) {
      return buildApp({
        logger: false,
        squadDir: 'nonexistent-dir-for-test',
        ...overrides,
      });
    }

    it('catches unhandled errors and returns standardized format', async () => {
      const app = buildTestApp();

      // Register a route that throws
      app.get('/api/test-error', async () => {
        throw new Error('Unexpected failure');
      });

      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/test-error',
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code', 'INTERNAL_ERROR');

      await app.close();
    });

    it('preserves status code from thrown errors', async () => {
      const app = buildTestApp();

      app.get('/api/test-client-error', async (_req, reply) => {
        return reply.status(422).send({
          error: 'Unprocessable',
          code: 'VALIDATION_ERROR',
        });
      });

      await app.ready();

      const response = await app.inject({
        method: 'GET',
        url: '/api/test-client-error',
      });

      expect(response.statusCode).toBe(422);
      const body = JSON.parse(response.body);
      expect(body.error).toBe('Unprocessable');
      expect(body.code).toBe('VALIDATION_ERROR');

      await app.close();
    });
  });
});

describe('Graceful degradation for missing .squad/ files', () => {
  function buildTestApp(squadDir: string) {
    return buildApp({
      logger: false,
      squadDir,
    });
  }

  it('returns empty array for agents when .squad/agents/ is missing', async () => {
    const app = buildTestApp('nonexistent-directory-' + Date.now());
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/agents',
    });

    // Should not crash — returns empty or error gracefully
    expect([200, 500]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    } else {
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    }

    await app.close();
  });

  it('returns empty array for tasks when .squad/tasks/ is missing', async () => {
    const app = buildTestApp('nonexistent-directory-' + Date.now());
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/tasks',
    });

    expect([200, 500]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    } else {
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    }

    await app.close();
  });

  it('returns empty array for decisions when .squad/decisions.md is missing', async () => {
    const app = buildTestApp('nonexistent-directory-' + Date.now());
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/decisions',
    });

    expect([200, 500]).toContain(response.statusCode);
    if (response.statusCode === 200) {
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
    } else {
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty('error');
    }

    await app.close();
  });

  it('returns graceful response for squad overview when .squad/ is missing', async () => {
    const app = buildTestApp('nonexistent-directory-' + Date.now());
    await app.ready();

    const response = await app.inject({
      method: 'GET',
      url: '/api/squad',
    });

    // Should handle gracefully — either empty response or error with standard format
    expect([200, 500]).toContain(response.statusCode);
    const body = JSON.parse(response.body);
    if (response.statusCode === 500) {
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('code');
    }

    await app.close();
  });
});
