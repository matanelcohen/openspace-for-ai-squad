/**
 * Activity Feed API — P3-3
 *
 * GET /api/activity — paginated history of agent activity events
 */

import type { FastifyPluginAsync } from 'fastify';

const activityRoute: FastifyPluginAsync = async (app) => {
  // GET /api/activity — paginated history
  app.get<{
    Querystring: { limit?: string; offset?: string };
  }>('/activity', async (request, reply) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(request.query.offset) || 0, 0);

    const result = app.activityFeed.getHistory(limit, offset);

    return reply.send({
      events: result.events,
      total: result.total,
      limit,
      offset,
    });
  });
};

export default activityRoute;

// ── Fastify type augmentation ────────────────────────────────────

import type { ActivityFeed } from '../services/activity/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    activityFeed: ActivityFeed;
  }
}
