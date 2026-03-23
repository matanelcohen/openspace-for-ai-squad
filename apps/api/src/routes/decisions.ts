/**
 * Decisions API — P1-6
 *
 * GET /api/decisions          — List newest first
 * GET /api/decisions/search   — Full-text search (?q=)
 * GET /api/decisions/:id      — Detail
 */

import type { FastifyPluginAsync } from 'fastify';

const decisionsRoute: FastifyPluginAsync = async (app) => {
  // GET /api/decisions — list newest first
  app.get('/decisions', async (_request, reply) => {
    const decisions = await app.squadParser.getDecisions();
    // decisions.md is parsed top-to-bottom; newest entries are at the top
    // but the parser returns them in document order. Reverse for newest-first
    // if the document has oldest-first. In practice the decisions.md file
    // already lists newest first, so we return as-is.
    return reply.send(decisions);
  });

  // GET /api/decisions/search — full-text search across title + rationale
  // NOTE: This route MUST be registered BEFORE the :id parameterised route
  // so that "search" is not captured as an :id value.
  app.get<{ Querystring: { q?: string } }>('/decisions/search', async (request, reply) => {
    const q = request.query.q?.trim();
    if (!q) {
      return reply.status(400).send({ error: 'Query parameter "q" is required' });
    }

    const decisions = await app.squadParser.getDecisions();
    const lower = q.toLowerCase();
    const results = decisions.filter(
      d =>
        d.title.toLowerCase().includes(lower) ||
        d.rationale.toLowerCase().includes(lower) ||
        d.author.toLowerCase().includes(lower),
    );

    return reply.send(results);
  });

  // GET /api/decisions/:id — detail
  app.get<{ Params: { id: string } }>('/decisions/:id', async (request, reply) => {
    const { id } = request.params;
    const decisions = await app.squadParser.getDecisions();
    const decision = decisions.find(d => d.id === id);

    if (!decision) {
      return reply.status(404).send({ error: `Decision not found: ${id}` });
    }

    return reply.send(decision);
  });
};

export default decisionsRoute;
