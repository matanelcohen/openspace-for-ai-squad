/**
 * Fastify routes for the A2A (Agent-to-Agent) protocol.
 *
 * - GET  /.well-known/agent-card.json  — serves agent cards
 * - POST /a2a/:agentId                 — JSON-RPC endpoint per agent
 */

import { JsonRpcTransportHandler } from '@a2a-js/sdk/server';
import type { FastifyPluginAsync } from 'fastify';

import type { A2AService } from '../services/a2a/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    a2aService?: A2AService;
  }
}

const a2aRoute: FastifyPluginAsync = async (app) => {
  // ── Well-known agent card endpoint ────────────────────────────────
  app.get('/.well-known/agent-card.json', async (_request, reply) => {
    const service = app.a2aService;
    if (!service) {
      return reply.status(503).send({ error: 'A2A service not initialized' });
    }
    return reply.send(service.agentCards);
  });

  // ── JSON-RPC endpoint per agent ───────────────────────────────────
  app.post<{ Params: { agentId: string } }>('/a2a/:agentId', async (request, reply) => {
    const service = app.a2aService;
    if (!service) {
      return reply.status(503).send({ error: 'A2A service not initialized' });
    }

    const { agentId } = request.params;
    const handler = service.handlers.get(agentId);
    if (!handler) {
      return reply.status(404).send({
        jsonrpc: '2.0',
        error: { code: -32601, message: `Agent not found: ${agentId}` },
        id: (request.body as Record<string, unknown>)?.id ?? null,
      });
    }

    const transport = new JsonRpcTransportHandler(handler);
    const result = await transport.handle(request.body);

    // Streaming responses arrive as an AsyncGenerator
    if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      for await (const event of result as AsyncGenerator) {
        reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
      }
      reply.raw.end();
      return;
    }

    return reply.send(result);
  });
};

export default a2aRoute;
