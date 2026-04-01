/**
 * Auto Pilot API routes.
 *
 * POST /api/autopilot/start   — start autonomous scanning
 * POST /api/autopilot/stop    — stop Auto Pilot
 * GET  /api/autopilot/status   — current status + stats
 * POST /api/autopilot/scan    — trigger one manual scan
 */

import type { FastifyPluginAsync } from 'fastify';

const autopilotRoute: FastifyPluginAsync = async (app) => {
  // POST /api/autopilot/start
  app.post<{
    Body: { scanIntervalMs?: number; maxTasksPerScan?: number };
  }>('/autopilot/start', async (request, reply) => {
    const autopilot = app.autopilotService;
    if (!autopilot) {
      return reply.status(503).send({ error: 'Auto Pilot service not available' });
    }

    try {
      await autopilot.start(request.body);
      return reply.send(autopilot.getStatus());
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  // POST /api/autopilot/stop
  app.post('/autopilot/stop', async (_request, reply) => {
    const autopilot = app.autopilotService;
    if (!autopilot) {
      return reply.status(503).send({ error: 'Auto Pilot service not available' });
    }

    autopilot.stop();
    return reply.send(autopilot.getStatus());
  });

  // GET /api/autopilot/status
  app.get('/autopilot/status', async (_request, reply) => {
    const autopilot = app.autopilotService;
    if (!autopilot) {
      return reply.status(503).send({ error: 'Auto Pilot service not available' });
    }

    return reply.send(autopilot.getStatus());
  });

  // POST /api/autopilot/scan
  app.post('/autopilot/scan', async (_request, reply) => {
    const autopilot = app.autopilotService;
    if (!autopilot) {
      return reply.status(503).send({ error: 'Auto Pilot service not available' });
    }

    if (!app.agentWorker) {
      return reply.status(503).send({ error: 'Agent worker not available' });
    }

    try {
      const result = await autopilot.scan();
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
};

export default autopilotRoute;
