/**
 * Cron API — scheduled job management
 *
 * GET    /api/cron          — list all scheduled jobs
 * POST   /api/cron/:id/run  — manually trigger a job
 * PATCH  /api/cron/:id      — enable/disable a job
 */

import type { FastifyPluginAsync } from 'fastify';

import type { CronService } from '../services/cron/index.js';

const cronRoute: FastifyPluginAsync = async (app) => {
  // GET /api/cron — list all scheduled jobs
  app.get('/cron', async (_request, reply) => {
    const jobs = app.cronService.listJobs();
    return reply.send({ jobs });
  });

  // POST /api/cron/:id/run — manually trigger a job
  app.post<{ Params: { id: string } }>('/cron/:id/run', async (request, reply) => {
    const { id } = request.params;

    const job = app.cronService.getJob(id);
    if (!job) {
      return reply.status(404).send({ error: `Job "${id}" not found` });
    }

    const execution = await app.cronService.triggerJob(id);
    return reply.send({ execution });
  });

  // PATCH /api/cron/:id — enable/disable a job
  app.patch<{
    Params: { id: string };
    Body: { enabled: boolean };
  }>('/cron/:id', async (request, reply) => {
    const { id } = request.params;
    const body = request.body as { enabled?: boolean } | undefined;

    if (!body || typeof body.enabled !== 'boolean') {
      return reply.status(400).send({ error: 'Field "enabled" (boolean) is required' });
    }

    const job = app.cronService.setJobEnabled(id, body.enabled);
    if (!job) {
      return reply.status(404).send({ error: `Job "${id}" not found` });
    }

    return reply.send({ job });
  });

  // GET /api/cron/executions — execution history
  app.get<{ Querystring: { limit?: string } }>('/cron/executions', async (request, reply) => {
    const limit = Math.min(Math.max(Number(request.query.limit) || 50, 1), 200);
    const executions = app.cronService.getExecutions(limit);
    return reply.send({ executions });
  });
};

export default cronRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    cronService: CronService;
  }
}
