/**
 * Tasks API — P1-5
 *
 * GET    /api/tasks              — List with filters: ?status=, ?assignee=, ?priority=
 * GET    /api/tasks/:id          — Task detail
 * POST   /api/tasks              — Create task
 * PUT    /api/tasks/:id          — Full update
 * PATCH  /api/tasks/:id/status   — Status change only
 * PATCH  /api/tasks/:id/priority — Reorder (update sortIndex)
 * POST   /api/tasks/:id/enqueue  — Assign to agent and enqueue for execution
 * DELETE /api/tasks/:id          — Delete task
 */

import type { TaskPriority, TaskStatus } from '@matanelcohen/openspace-shared';
import { TASK_PRIORITIES, TASK_STATUSES } from '@matanelcohen/openspace-shared';
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
      tasks = tasks.filter((t) => t.status === status);
    }
    if (assignee) {
      tasks = tasks.filter((t) => t.assignee === assignee);
    }
    if (priority) {
      if (!isValidPriority(priority)) {
        return reply.status(400).send({ error: `Invalid priority filter: ${priority}` });
      }
      tasks = tasks.filter((t) => t.priority === priority);
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

  // GET /api/tasks/:id/subtasks — list subtasks of a parent task
  app.get<{ Params: { id: string } }>('/tasks/:id/subtasks', async (request, reply) => {
    const parentId = request.params.id;
    try {
      // Verify parent task exists
      await getTask(tasksDir(), parentId);
    } catch {
      return reply.status(404).send({ error: `Task not found: ${parentId}` });
    }

    const allTasks = await app.squadParser.getTasks();
    const subtasks = allTasks.filter(
      (t) => t.parent === parentId || t.labels.includes(`parent:${parentId}`),
    );
    return reply.send(subtasks);
  });

  // POST /api/tasks — create
  app.post<{ Body: CreateTaskInput }>('/tasks', async (request, reply) => {
    const body = request.body;

    if (!body || typeof body !== 'object') {
      return reply.status(400).send({ error: 'Request body is required' });
    }
    if (typeof body.title !== 'string' || body.title.trim() === '') {
      return reply
        .status(400)
        .send({ error: 'Field "title" is required and must be a non-empty string' });
    }
    if (body.status !== undefined && !isValidStatus(body.status)) {
      return reply.status(400).send({ error: `Invalid status: ${body.status}` });
    }
    if (body.priority !== undefined && !isValidPriority(body.priority)) {
      return reply.status(400).send({ error: `Invalid priority: ${body.priority}` });
    }

    const task = await createTask(tasksDir(), body);

    // Auto-route to lead agent: lead will triage (execute or delegate)
    if (!task.assignee && task.status === 'pending' && app.agentWorker) {
      const agents = app.agentWorker.getAgents?.() ?? [];
      const lead = agents.find(
        (a) =>
          a.role.toLowerCase().includes('lead') ||
          a.role.toLowerCase().includes('architect'),
      );
      if (lead) {
        const updated = await updateTask(tasksDir(), task.id, {
          assignee: lead.id,
          status: 'in-progress',
        });
        app.agentWorker.enqueue(updated);
        console.log(`[Tasks] Auto-routed "${task.title}" to lead: ${lead.name}`);
      }
    }

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

        if (task.status === 'pending' && task.assignee && app.agentWorker) {
          app.agentWorker.enqueue(task, { skipDelegation: true });
        }

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
        let task = await updateTask(tasksDir(), request.params.id, { status });

        // If moved to in-progress without an assignee, auto-assign to first idle agent
        if (status === 'in-progress' && !task.assignee && app.agentWorker) {
          const agentStatus = app.agentWorker.getStatus();
          const idleAgent = Object.entries(agentStatus).find(
            ([, info]) => !info.activeTask,
          );
          if (idleAgent) {
            task = await updateTask(tasksDir(), request.params.id, {
              assignee: idleAgent[0],
            });
          }
        }

        // If has an assignee and moving to actionable status, enqueue
        if (
          (status === 'pending' || status === 'in-progress') &&
          task.assignee &&
          app.agentWorker
        ) {
          app.agentWorker.enqueue(task, { skipDelegation: true });
        }

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
        return reply
          .status(400)
          .send({ error: 'Field "sortIndex" is required and must be a number' });
      }

      try {
        const task = await updateTask(tasksDir(), request.params.id, { sortIndex });
        return reply.send(task);
      } catch {
        return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
      }
    },
  );

  // PATCH /api/tasks/:id/approve — move pending → in-progress, enqueue for agent
  app.patch<{ Params: { id: string } }>('/tasks/:id/approve', async (request, reply) => {
    try {
      const existing = await getTask(tasksDir(), request.params.id);
      if (existing.status !== 'pending') {
        return reply.status(400).send({ error: 'Task is not pending' });
      }
      const task = await updateTask(tasksDir(), request.params.id, { status: 'in-progress' });

      // Enqueue for the assigned agent to pick up
      if (app.agentWorker && task.assignee) {
        app.agentWorker.enqueue(task, { skipDelegation: true });
      }

      return reply.send(task);
    } catch {
      return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
    }
  });

  // PATCH /api/tasks/:id/reject — delete a pending-approval task
  app.patch<{ Params: { id: string } }>('/tasks/:id/reject', async (request, reply) => {
    try {
      const existing = await getTask(tasksDir(), request.params.id);
      if (existing.status !== 'pending') {
        return reply.status(400).send({ error: 'Task is not pending' });
      }
      await deleteTask(tasksDir(), request.params.id);
      return reply.status(204).send();
    } catch {
      return reply.status(404).send({ error: `Task not found: ${request.params.id}` });
    }
  });

  // POST /api/tasks/:id/enqueue — assign to agent and enqueue for execution
  app.post<{ Params: { id: string }; Body: { agentId: string } }>(
    '/tasks/:id/enqueue',
    async (request, reply) => {
      const { agentId } = request.body ?? {};
      if (!agentId || typeof agentId !== 'string') {
        return reply.status(400).send({ error: 'Field "agentId" is required' });
      }

      try {
        const task = await updateTask(tasksDir(), request.params.id, {
          assignee: agentId,
          status: 'in-progress' as TaskStatus,
        });

        if (app.agentWorker) {
          app.agentWorker.enqueue(task, { skipDelegation: true });
        }

        return reply.send({ success: true, taskId: task.id, agentId });
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

  // GET /api/tasks/:id/prompt — full prompt context sent to the agent
  app.get<{ Params: { id: string } }>('/tasks/:id/prompt', async (request, reply) => {
    const { resolve, join } = await import('node:path');
    const { readFileSync, existsSync } = await import('node:fs');

    const squadDir = app.squadParser?.getTasksDir()
      ? resolve(app.squadParser.getTasksDir(), '..')
      : null;
    if (!squadDir) {
      return reply.status(503).send({ error: 'Squad not initialized' });
    }

    const promptPath = join(squadDir, '.cache', 'prompts', `${request.params.id}.json`);
    if (!existsSync(promptPath)) {
      return reply.status(404).send({ error: 'No prompt data found for this task. The task may not have been executed yet.' });
    }

    try {
      const data = JSON.parse(readFileSync(promptPath, 'utf-8'));
      return reply.send(data);
    } catch {
      return reply.status(500).send({ error: 'Failed to read prompt data' });
    }
  });
};

export default tasksRoute;
