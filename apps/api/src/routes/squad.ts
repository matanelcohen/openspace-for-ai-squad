/**
 * Squad overview API — P1-7
 *
 * GET /api/squad — Composite summary for the dashboard.
 */

import type { FastifyPluginAsync } from 'fastify';

const squadRoute: FastifyPluginAsync = async (app) => {
  app.get('/squad', async (_request, reply) => {
    const overview = await app.squadParser.getSquadOverview();
    return reply.send(overview);
  });
};

export default squadRoute;
