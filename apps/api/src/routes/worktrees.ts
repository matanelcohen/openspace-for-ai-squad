/**
 * Worktree API routes — manage git worktree sandboxes for agent tasks.
 */

import type { FastifyPluginAsync } from 'fastify';

const worktreesRoute: FastifyPluginAsync = async (app) => {
  // List all active worktrees
  app.get('/api/worktrees', async (_req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });
    return wts.list();
  });

  // Get worktree info for a task
  app.get<{ Params: { taskId: string } }>('/api/worktrees/:taskId', async (req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });

    const info = wts.get(req.params.taskId);
    if (!info) return reply.code(404).send({ error: 'No worktree found for this task' });
    return info;
  });

  // Create a worktree for a task
  app.post<{
    Params: { taskId: string };
    Body: { baseBranch?: string; parentTaskId?: string };
  }>('/api/worktrees/:taskId', async (req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });

    try {
      const info = await wts.create(req.params.taskId, {
        baseBranch: req.body?.baseBranch,
        parentTaskId: req.body?.parentTaskId,
      });
      return reply.code(201).send(info);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });

  // Commit changes in a worktree
  app.post<{
    Params: { taskId: string };
    Body: { message: string };
  }>('/api/worktrees/:taskId/commit', async (req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });

    try {
      const sha = await wts.commit(req.params.taskId, req.body.message);
      return { sha, committed: !!sha };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });

  // Get diff for a worktree
  app.get<{ Params: { taskId: string } }>('/api/worktrees/:taskId/diff', async (req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });

    try {
      const diff = await wts.diff(req.params.taskId);
      return { diff };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });

  // Create PR from a worktree
  app.post<{
    Params: { taskId: string };
    Body: { title: string; body: string; baseBranch?: string };
  }>('/api/worktrees/:taskId/pr', async (req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });

    try {
      const pr = await wts.createPR(req.params.taskId, {
        title: req.body.title,
        body: req.body.body,
        baseBranch: req.body?.baseBranch,
      });
      return reply.code(201).send(pr);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });

  // Destroy a worktree
  app.delete<{ Params: { taskId: string } }>('/api/worktrees/:taskId', async (req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });

    try {
      await wts.destroy(req.params.taskId);
      return { destroyed: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return reply.code(400).send({ error: message });
    }
  });
};

export default worktreesRoute;
