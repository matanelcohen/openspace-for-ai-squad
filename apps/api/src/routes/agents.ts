/**
 * Agents API — P1-4
 *
 * GET /api/agents      — List all agents with status, role, current task.
 * GET /api/agents/:id  — Agent detail with charter, history, expertise.
 */

import type { FastifyPluginAsync } from 'fastify';

const agentsRoute: FastifyPluginAsync = async (app) => {
  app.get('/agents', async (_request, reply) => {
    const agents = await app.squadParser.getAgents();
    return reply.send(agents);
  });

  app.get<{ Params: { id: string } }>(
    '/agents/:id',
    async (request, reply) => {
      const { id } = request.params;
      const agent = await app.squadParser.getAgent(id);

      if (!agent) {
        return reply.status(404).send({ error: `Agent not found: ${id}` });
      }

      return reply.send(agent);
    },
  );
};

export default agentsRoute;
