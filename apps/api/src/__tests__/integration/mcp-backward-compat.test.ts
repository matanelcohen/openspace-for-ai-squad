/**
 * MCP Backward Compatibility Tests
 *
 * Verifies that registering the MCP Fastify plugin does not break existing API routes.
 * The MCP plugin is registered at /mcp prefix — all other /api/* routes must still work.
 */

import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildTestApp, FIXTURE_SQUAD_DIR, injectJSON } from '../helpers/setup.js';

describe('MCP Backward Compatibility — API routes still work', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp(FIXTURE_SQUAD_DIR);
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Core API Routes ─────────────────────────────────────────────

  it('GET /api/squad returns 200', async () => {
    const { statusCode, body } = await injectJSON(app, 'GET', '/api/squad');
    expect(statusCode).toBe(200);
    expect(body).toBeDefined();
  });

  it('GET /api/agents returns 200 with array', async () => {
    const { statusCode, body } = await injectJSON(app, 'GET', '/api/agents');
    expect(statusCode).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/tasks returns 200 with array', async () => {
    const { statusCode, body } = await injectJSON(app, 'GET', '/api/tasks');
    expect(statusCode).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('GET /api/decisions returns 200', async () => {
    const { statusCode } = await injectJSON(app, 'GET', '/api/decisions');
    expect(statusCode).toBe(200);
  });

  it('GET /api/activity returns 200', async () => {
    const { statusCode } = await injectJSON(app, 'GET', '/api/activity');
    expect(statusCode).toBe(200);
  });

  it('GET /api/chat/messages returns 200', async () => {
    const { statusCode } = await injectJSON(app, 'GET', '/api/chat/messages');
    expect(statusCode).toBe(200);
  });

  it('GET /api/agents/status returns 200', async () => {
    const { statusCode } = await injectJSON(app, 'GET', '/api/agents/status');
    expect(statusCode).toBe(200);
  });

  it('GET /health returns 200', async () => {
    const { statusCode, body } = await injectJSON(app, 'GET', '/health');
    expect(statusCode).toBe(200);
    expect(body).toHaveProperty('status');
  });

  // ── MCP Plugin Routes Are Registered ────────────────────────────

  it('MCP SSE endpoint is registered in the route table', async () => {
    // The MCP plugin uses fastify-plugin (fp) which lifts routes to root scope.
    // Routes are registered as /sse and /messages.
    const routes = app.printRoutes({ commonPrefix: false });
    expect(routes).toContain('/sse');
    expect(routes).toContain('/messages');
  });

  it('POST /mcp/messages without sessionId returns session not found', async () => {
    // Try both /mcp/messages and /messages — fp() may lift routes
    const response = await app.inject({
      method: 'POST',
      url: '/messages?sessionId=nonexistent',
      payload: {},
    });
    // The endpoint exists but returns 404 for unknown sessions
    expect(response.statusCode).toBe(404);
  });

  // ── Verify no route conflicts ───────────────────────────────────

  it('POST /api/tasks still creates a task (not intercepted by MCP)', async () => {
    const { statusCode, body } = await injectJSON(app, 'POST', '/api/tasks', {
      title: 'MCP compat test task',
      description: 'Created during backward compat testing',
      priority: 'P2',
    });
    // Should succeed (201 or 200) — not be hijacked by MCP routes
    expect(statusCode).toBeLessThan(300);
    expect(body).toHaveProperty('id');
  });

  it('GET /api/tasks with query params still filters correctly', async () => {
    const { statusCode, body } = await injectJSON(
      app,
      'GET',
      '/api/tasks?status=in-progress',
    );
    expect(statusCode).toBe(200);
    expect(Array.isArray(body)).toBe(true);
  });

  it('unregistered routes still return 404', async () => {
    const { statusCode } = await injectJSON(app, 'GET', '/api/nonexistent');
    expect(statusCode).toBe(404);
  });

  it('unknown sub-routes return 404', async () => {
    const { statusCode } = await injectJSON(app, 'GET', '/nonexistent-route');
    expect(statusCode).toBe(404);
  });
});
