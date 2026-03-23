/**
 * Tasks API — P1-5
 *
 * GET    /api/tasks              — List with filters: ?status=, ?assignee=, ?priority=
 * GET    /api/tasks/:id          — Task detail
 * POST   /api/tasks              — Create task
 * PUT    /api/tasks/:id          — Full update
 * PATCH  /api/tasks/:id/status   — Status change only
 * PATCH  /api/tasks/:id/priority — Reorder (update sortIndex)
 * DELETE /api/tasks/:id          — Delete task
 */

import type { TaskPriority, TaskStatus } from '@openspace/shared';
import { TASK_PRIORITIES, TASK_STATUSES } from '@openspace/shared';
import type { FastifyPluginAsync } from 'fastify';

import {
  createTask,
  type CreateTaskInput,
  deleteTask,
  getTask,
  updateTask,
  type UpdateTaskInput,
} from '../services/squad-writer/task-writer.js';

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

function isValidStatus(v: unknown): v is TaskStatus {
  return typeof v === 'string' && (TASK_STATUSES as readonly string[]).includes(v);
}

function isValidPriority(v: unknown): v is TaskPriority {
  return typeof v === 'string' && (TASK_PRIORITIES as readonly string[]).includes(v);
}

interface TasksQuerystring {
  status?: string;
  assignee?: string;
  priority?: string;
}

// ---------------------------------------------------------------------------
// Route plugin
// ---------------------------------------------------------------------------

const tasksRoute: FastifyPluginAsync = async (app) => {
  const tasksDir = () => app.squadParser.getTasksDir();

  // GET /api/tasks — list with optional filters
  app.get<{ Querystring: TasksQuerystring }>('/tasks', async (request, reply) => {
    let tasks = await app.squadParser.getTasks();
    const { status, assignee, priority } = request.query;

    if (status) {
      if (!isValidStatus(status)) {
        return reply.status(400).send({ error: `Invalid status filter: ${status}` });
      }
      tasks = tasks.filter(t => t.status === status);
    }
    if (assignee) {
      tasks = tasks.filter(t => t.assignee === assignee);
    }
    if (priority) {
      if (!isValidPriority(priority)) {
        return reply.status(400).send({ error: `Invalid priority filter: ${priority}` });
      }
      tasks = tasks.filter(t => t.priority === priority);
    }

    return reply.send(tasks);
  });

  // GET /api/tasks/:id — detail
  app.get<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    try {
      const task = await getTask(tasksDir(), request.params.id);
      return reply.send(task);
    } catch {
      return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
    }
  });

  // POST /api/tasks — create
  app.post<{ Body: CreateTaskInput }>('/tasks', async (request, reply) => {
    const body = request.body;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return reply.status(400).send({ error: 'Field "title" is required and must be a non-empty string' });
    }
    if (body.status !== undefined && !isValidStatus(body.status)) {
      return reply.status(400).send({ error: `Invalid status: ${body.status}` });
    }
    if (body.priority !== undefined && !isValidPriority(body.priority)) {
      return reply.status(400).send({ error: `Invalid priority: ${body.priority}` });
    }

    const task = await createTask(tasksDir(), body);
    return reply.status(201).send(task);
  });

  // PUT /api/tasks/:id — full update
  app.put<{ Params: { id: string }; Body: UpdateTaskInput }>(
    '/tasks/:id',
    async (request, reply) => {
      const body = request.body;
      if (!body || typeof body !== 'object') {
        return reply.status(400).send({ error: 'Request body is required' });
      }
      if (body.status !== undefined && !isValidStatus(body.status)) {
        return reply.status(400).send({ error: `Invalid status: ${body.status}` });
      }
      if (body.priority !== undefined && !isValidPriority(body.priority)) {
        return reply.status(400).send({ error: `Invalid priority: ${body.priority}` });
      }

      try {
        const task = await updateTask(tasksDir(), request.params.id, body);
        return reply.send(task);
      } catch {
        return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
      }
    },
  );

  // PATCH /api/tasks/:id/status — status change only
  app.patch<{ Params: { id: string }; Body: { status: TaskStatus } }>(
    '/tasks/:id/status',
    async (request, reply) => {
      const { status } = request.body ?? {};
      if (!isValidStatus(status)) {
        return reply.status(400).send({ error: `Invalid or missing status: ${status}` });
      }

      try {
        const task = await updateTask(tasksDir(), request.params.id, { status });
        return reply.send(task);
      } catch {
        return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
      }
    },
  );

  // PATCH /api/tasks/:id/priority — reorder (update sortIndex)
  app.patch<{ Params: { id: string }; Body: { sortIndex: number } }>(
    '/tasks/:id/priority',
    async (request, reply) => {
      const { sortIndex } = request.body ?? {};
      if (typeof sortIndex !== 'number' || !Number.isFinite(sortIndex)) {
        return reply.status(400).send({ error: 'Field "sortIndex" is required and must be a number' });
      }

      try {
        const task = await updateTask(tasksDir(), request.params.id, { sortIndex });
        return reply.send(task);
      } catch {
        return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
      }
    },
  );

  // DELETE /api/tasks/:id
  app.delete<{ Params: { id: string } }>('/tasks/:id', async (request, reply) => {
    try {
      await deleteTask(tasksDir(), request.params.id);
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
    }
  });
};

export default tasksRoute;
