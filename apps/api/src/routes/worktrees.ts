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

  // Delete ALL worktrees
  app.delete('/api/worktrees', async (_req, reply) => {
    const wts = (app as any).worktreeService;
    if (!wts) return reply.code(503).send({ error: 'WorktreeService not available' });

    // First: destroy tracked worktrees via git
    const all = wts.list();
    let destroyed = 0;
    for (const wt of all) {
      try {
        await wts.destroy(wt.taskId);
        destroyed++;
      } catch { /* best effort */ }
    }

    // Second: nuke the .git-worktrees directory to catch any untracked leftovers
    const { execSync } = await import('node:child_process');
    const { resolve } = await import('node:path');
    const { rmSync, existsSync } = await import('node:fs');
    const projectDir = resolve(app.squadParser.getTasksDir(), '..', '..');
    
    try {
      // Prune stale git worktree entries
      execSync('git worktree prune', { cwd: projectDir, timeout: 10_000 });
    } catch { /* best effort */ }

    const worktreeDir = resolve(projectDir, '.git-worktrees');
    if (existsSync(worktreeDir)) {
      try {
        // Remove contents but keep the directory
        const { readdirSync } = await import('node:fs');
        for (const entry of readdirSync(worktreeDir)) {
          rmSync(resolve(worktreeDir, entry), { recursive: true, force: true });
        }
      } catch { /* best effort */ }
    }

    return { destroyed, total: all.length, dirCleaned: true };
  });
};

export default worktreesRoute;
