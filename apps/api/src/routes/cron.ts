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

  // POST /api/cron — create a new job
  app.post<{ Body: Record<string, unknown> }>('/cron', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }

    const { id, schedule, agent, action, message, channel, title, description, enabled } = body as Record<string, string | boolean | undefined>;

    if (!id || typeof id !== 'string') return reply.status(400).send({ error: '"id" is required' });
    if (!schedule || typeof schedule !== 'string') return reply.status(400).send({ error: '"schedule" is required (cron expression)' });
    if (!agent || typeof agent !== 'string') return reply.status(400).send({ error: '"agent" is required' });
    if (action !== 'chat' && action !== 'task') return reply.status(400).send({ error: '"action" must be "chat" or "task"' });

    try {
      const job = app.cronService.addJob({
        id: id as string,
        schedule: schedule as string,
        agent: agent as string,
        action: action as 'chat' | 'task',
        message: (message as string) || undefined,
        channel: (channel as string) || 'team',
        title: (title as string) || undefined,
        description: (description as string) || undefined,
        enabled: enabled !== false,
      });
      return reply.status(201).send({ job });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return reply.status(409).send({ error: msg });
    }
  });

  // DELETE /api/cron/:id — delete a job
  app.delete<{ Params: { id: string } }>('/cron/:id', async (request, reply) => {
    const deleted = app.cronService.deleteJob(request.params.id);
    if (!deleted) return reply.status(404).send({ error: `Job "${request.params.id}" not found` });
    return reply.status(204).send();
  });

  // PUT /api/cron/:id — update a job
  app.put<{ Params: { id: string }; Body: Record<string, unknown> }>('/cron/:id', async (request, reply) => {
    const body = request.body;
    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }

    const job = app.cronService.updateJob(request.params.id, body as Partial<{ schedule: string; agent: string; action: 'chat' | 'task'; message: string; channel: string; title: string; description: string; enabled: boolean }>);
    if (!job) return reply.status(404).send({ error: `Job "${request.params.id}" not found` });
    return reply.send({ job });
  });
};

export default cronRoute;

// ── Fastify type augmentation ────────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    cronService: CronService;
  }
}
