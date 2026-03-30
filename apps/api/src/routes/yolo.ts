/**
 * YOLO Mode API routes.
 *
 * POST /api/yolo/start   — start autonomous scanning
 * POST /api/yolo/stop    — stop YOLO mode
 * GET  /api/yolo/status   — current status + stats
 * POST /api/yolo/scan    — trigger one manual scan
 */

import type { FastifyPluginAsync } from 'fastify';

const yoloRoute: FastifyPluginAsync = async (app) => {
  // POST /api/yolo/start
  app.post<{
    Body: { scanIntervalMs?: number; maxTasksPerScan?: number };
  }>('/yolo/start', async (request, reply) => {
    const yolo = app.yoloService;
    if (!yolo) {
      return reply.status(503).send({ error: 'YOLO service not available' });
    }

    try {
      await yolo.start(request.body);
      return reply.send(yolo.getStatus());
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  // POST /api/yolo/stop
  app.post('/yolo/stop', async (_request, reply) => {
    const yolo = app.yoloService;
    if (!yolo) {
      return reply.status(503).send({ error: 'YOLO service not available' });
    }

    yolo.stop();
    return reply.send(yolo.getStatus());
  });

  // GET /api/yolo/status
  app.get('/yolo/status', async (_request, reply) => {
    const yolo = app.yoloService;
    if (!yolo) {
      return reply.status(503).send({ error: 'YOLO service not available' });
    }

    return reply.send(yolo.getStatus());
  });

  // POST /api/yolo/scan
  app.post('/yolo/scan', async (_request, reply) => {
    const yolo = app.yoloService;
    if (!yolo) {
      return reply.status(503).send({ error: 'YOLO service not available' });
    }

    if (!app.agentWorker) {
      return reply.status(503).send({ error: 'Agent worker not available' });
    }

    try {
      const result = await yolo.scan();
      return reply.send(result);
    } catch (err) {
      return reply.status(500).send({ error: (err as Error).message });
    }
  });
};

export default yoloRoute;
