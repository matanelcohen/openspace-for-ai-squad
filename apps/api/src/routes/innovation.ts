import type { FastifyPluginAsync } from 'fastify';

const innovationRoute: FastifyPluginAsync = async (app) => {
  app.post('/innovation/start', async (_req, reply) => {
    const svc = (app as any).innovationService;
    if (!svc) return reply.code(503).send({ error: 'Innovation service not available' });
    await svc.start();
    return { started: true };
  });

  app.post('/innovation/stop', async (_req, reply) => {
    const svc = (app as any).innovationService;
    if (!svc) return reply.code(503).send({ error: 'Innovation service not available' });
    svc.stop();
    return { stopped: true };
  });

  app.get('/innovation/status', async (_req, reply) => {
    const svc = (app as any).innovationService;
    if (!svc) return reply.code(503).send({ error: 'Innovation service not available' });
    return svc.getStatus();
  });

  app.post('/innovation/scan', async (_req, reply) => {
    const svc = (app as any).innovationService;
    if (!svc) return reply.code(503).send({ error: 'Innovation service not available' });
    const suggestions = await svc.scan();
    return { suggestions };
  });
};

export default innovationRoute;
