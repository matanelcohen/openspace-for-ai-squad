import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import type { FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';

import { createServer } from './server.js';

/**
 * Fastify plugin that exposes the openspace MCP server over SSE.
 *
 * Register with `{ prefix: '/mcp' }` so routes resolve to:
 *   GET  /mcp/sse              — SSE stream (clients connect here)
 *   POST /mcp/messages          — JSON-RPC message ingestion
 */
const mcpPluginImpl: FastifyPluginAsync = async (app) => {
  const transports = new Map<string, SSEServerTransport>();

  const prefix = app.prefix || '/mcp';

  // ── SSE endpoint ────────────────────────────────────────────────────
  app.get('/sse', async (request, reply) => {
    // Hijack the response so Fastify doesn't try to finalise it —
    // SSEServerTransport owns the socket from here on.
    reply.hijack();

    const transport = new SSEServerTransport(`${prefix}/messages`, reply.raw);
    transports.set(transport.sessionId, transport);

    request.raw.on('close', () => {
      transports.delete(transport.sessionId);
    });

    const server = createServer();
    await server.connect(transport);

    request.log.info({ sessionId: transport.sessionId }, 'MCP SSE session started');
  });

  // ── Message endpoint ────────────────────────────────────────────────
  app.post<{ Querystring: { sessionId: string } }>('/messages', async (request, reply) => {
    const { sessionId } = request.query;
    const transport = transports.get(sessionId);
    if (!transport) {
      return reply.status(404).send({ error: 'MCP session not found' });
    }

    // Hijack — the transport writes directly to the raw response.
    reply.hijack();
    // Pass the already-parsed body so the transport doesn't re-read the stream.
    await transport.handlePostMessage(request.raw, reply.raw, request.body);
  });

  // ── Lifecycle ───────────────────────────────────────────────────────
  app.addHook('onClose', async () => {
    app.log.info(`MCP plugin shutting down — closing ${transports.size} session(s)`);
    const closeTasks = [...transports.values()].map((t) => t.close());
    await Promise.allSettled(closeTasks);
    transports.clear();
  });
};

export default fp(mcpPluginImpl, {
  name: 'openspace-mcp',
  fastify: '5.x',
});
