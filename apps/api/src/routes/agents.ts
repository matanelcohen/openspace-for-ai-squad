/**
 * Agents API — P1-4
 *
 * GET /api/agents         — List all agents with status, role, current task.
 * GET /api/agents/status  — Real-time agent work status (active tasks + queues).
 * GET /api/agents/:id     — Agent detail with charter, history, expertise.
 */

import { resolve } from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { getTask } from '../services/squad-writer/task-writer.js';

const agentsRoute: FastifyPluginAsync = async (app) => {
  app.get('/agents', async (_request, reply) => {
    const agents = await app.squadParser.getAgents();
    return reply.send(agents);
  });

  app.get('/agents/status', async (_request, reply) => {
    const worker = app.agentWorker;
    if (!worker) {
      return reply.send({ agents: {} });
    }

    const status = worker.getStatus();
    const queuedIds = worker.getQueuedTaskIds();
    const squadDir = resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
    const tasksDir = resolve(squadDir, 'tasks');

    const agents: Record<
      string,
      {
        activeTask: { id: string; title: string; status: string; startedAt: string } | null;
        queueLength: number;
        queuedTasks: { id: string; title: string }[];
      }
    > = {};

    for (const [agentId, info] of Object.entries(status)) {
      let activeTask: (typeof agents)[string]['activeTask'] = null;
      if (info.activeTask) {
        try {
          const task = await getTask(tasksDir, info.activeTask);
          activeTask = {
            id: task.id,
            title: task.title,
            status: task.status,
            startedAt: task.updatedAt ?? task.createdAt ?? new Date().toISOString(),
          };
        } catch {
          activeTask = {
            id: info.activeTask,
            title: info.activeTask,
            status: 'in-progress',
            startedAt: new Date().toISOString(),
          };
        }
      }

      const queuedTasks: { id: string; title: string }[] = [];
      for (const taskId of queuedIds[agentId] ?? []) {
        try {
          const task = await getTask(tasksDir, taskId);
          queuedTasks.push({ id: task.id, title: task.title });
        } catch {
          queuedTasks.push({ id: taskId, title: taskId });
        }
      }

      agents[agentId] = {
        activeTask,
        queueLength: info.queueLength,
        queuedTasks,
      };
    }

    return reply.send({ agents });
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
