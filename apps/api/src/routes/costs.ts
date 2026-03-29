/**
 * Costs API — surfaces cost analytics derived from trace data.
 *
 * GET /api/costs                    — Full cost summary
 * GET /api/costs?period=today       — Today only
 * GET /api/costs?period=week        — Last 7 days
 * GET /api/costs?period=month       — Last 30 days
 * GET /api/costs?agentId=tyrael     — Per agent
 */

import type { FastifyPluginAsync } from 'fastify';

import type { CostService } from '../services/cost/index.js';

const costsRoute: FastifyPluginAsync = async (app) => {
  app.get<{
    Querystring: { period?: string; agentId?: string };
  }>('/costs', async (request, reply) => {
    const { period, agentId } = request.query;
    const summary = app.costService.getSummary({
      period: period || undefined,
      agentId: agentId || undefined,
    });
    return reply.send(summary);
  });
};

export default costsRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    costService: CostService;
  }
}
