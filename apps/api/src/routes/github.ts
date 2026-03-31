/**
 * GitHub API routes — issues, branches, and PRs via the `gh` CLI.
 *
 * GET  /api/github/issues       — List open issues
 * POST /api/github/issues/sync  — Sync issues → tasks
 * POST /api/github/branch       — Create branch for a task
 * POST /api/github/pr           — Create PR from task
 * GET  /api/github/prs          — List PRs
 */

import { resolve } from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { GitHubService } from '../services/github/index.js';
import {
  createTask,
  type CreateTaskInput,
  getTask,
} from '../services/squad-writer/task-writer.js';

const githubRoute: FastifyPluginAsync = async (app) => {
  const projectDir = () => resolve(app.squadParser.getTasksDir(), '..', '..');
  const gh = () => new GitHubService(projectDir());
  const tasksDir = () => app.squadParser.getTasksDir();

  // GET /api/github/issues
  app.get('/github/issues', async (_request, reply) => {
    try {
      const issues = await gh().listIssues('open');
      return reply.send(issues);
    } catch (err) {
      return reply
        .status(500)
        .send({ error: `Failed to list issues: ${(err as Error).message}` });
    }
  });

  // POST /api/github/issues/sync — create a task for each issue that doesn't have one
  app.post('/github/issues/sync', async (_request, reply) => {
    try {
      const issues = await gh().listIssues('open');
      const existingTasks = await app.squadParser.getTasks();

      // Match by label `github-issue:N`
      const linkedIssueNumbers = new Set(
        existingTasks.flatMap((t) =>
          t.labels
            .filter((l) => l.startsWith('github-issue:'))
            .map((l) => Number(l.split(':')[1])),
        ),
      );

      const created: Array<{ issueNumber: number; taskId: string }> = [];

      for (const issue of issues) {
        if (linkedIssueNumbers.has(issue.number)) continue;

        const input: CreateTaskInput = {
          title: issue.title,
          description: issue.body || '',
          assignee: null,
          priority: 'P2',
          labels: [`github-issue:${issue.number}`],
        };
        const task = await createTask(tasksDir(), input);
        created.push({ issueNumber: issue.number, taskId: task.id });
      }

      return reply.send({ synced: created.length, created });
    } catch (err) {
      return reply
        .status(500)
        .send({ error: `Failed to sync issues: ${(err as Error).message}` });
    }
  });

  // POST /api/github/branch — create a branch for a task
  app.post<{
    Body: { taskId: string; branchName?: string };
  }>('/github/branch', async (request, reply) => {
    const { taskId, branchName } = request.body ?? {};
    if (!taskId) {
      return reply.status(400).send({ error: 'taskId is required' });
    }

    const name = branchName ?? `agent/${taskId}`;

    try {
      await gh().createBranch(name);
      return reply.send({ branch: name });
    } catch (err) {
      return reply
        .status(500)
        .send({ error: `Failed to create branch: ${(err as Error).message}` });
    }
  });

  // POST /api/github/pr — create a PR from a task
  app.post<{
    Body: { taskId: string; head: string; base?: string };
  }>('/github/pr', async (request, reply) => {
    const { taskId, head, base } = request.body ?? {};
    if (!taskId || !head) {
      return reply.status(400).send({ error: 'taskId and head are required' });
    }

    try {
      const task = await getTask(tasksDir(), taskId);
      const pr = await gh().createPR({
        title: `${task.title} (${taskId})`,
        body: `**Task:** ${taskId}\n**Agent:** ${task.assignee ?? 'unassigned'}\n**Priority:** ${task.priority}`,
        head,
        base,
      });
      return reply.send(pr);
    } catch (err) {
      return reply
        .status(500)
        .send({ error: `Failed to create PR: ${(err as Error).message}` });
    }
  });

  // GET /api/github/prs
  app.get('/github/prs', async (_request, reply) => {
    try {
      const prs = await gh().listPRs('open');
      return reply.send(prs);
    } catch (err) {
      return reply
        .status(500)
        .send({ error: `Failed to list PRs: ${(err as Error).message}` });
    }
  });
};

export default githubRoute;
