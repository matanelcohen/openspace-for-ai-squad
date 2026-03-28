import type { FastifyPluginAsync } from 'fastify';

import type { WorkspaceService } from '../services/workspace/index.js';

const workspacesRoute: FastifyPluginAsync = async (app) => {
  /** List all workspaces. */
  app.get('/workspaces', async (_request, reply) => {
    return reply.send(app.workspaceService.list());
  });

  /** Get the currently active workspace. */
  app.get('/workspaces/active', async (_request, reply) => {
    const active = app.workspaceService.getActive();
    if (!active) {
      return reply.status(404).send({ error: 'No active workspace' });
    }
    return reply.send(active);
  });

  /** Create a new workspace. */
  app.post<{
    Body: { name: string; projectDir: string; icon?: string };
  }>('/workspaces', async (request, reply) => {
    const { name, projectDir, icon } = request.body ?? {};
    if (!name || !projectDir) {
      return reply.status(400).send({ error: 'name and projectDir are required' });
    }
    const workspace = app.workspaceService.create({ name, projectDir, icon });
    return reply.status(201).send(workspace);
  });

  /** Update workspace metadata. */
  app.put<{
    Params: { id: string };
    Body: { name?: string; icon?: string; description?: string };
  }>('/workspaces/:id', async (request, reply) => {
    const workspace = app.workspaceService.update(request.params.id, request.body ?? {});
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }
    return reply.send(workspace);
  });

  /** Delete a workspace. */
  app.delete<{ Params: { id: string } }>('/workspaces/:id', async (request, reply) => {
    const deleted = app.workspaceService.delete(request.params.id);
    if (!deleted) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }
    return reply.send({ success: true });
  });

  /** Activate a workspace — reloads services from the new .squad/ directory. */
  app.post<{ Params: { id: string } }>('/workspaces/:id/activate', async (request, reply) => {
    const workspace = app.workspaceService.setActive(request.params.id);
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    // Re-initialize services with the new workspace's .squad/ directory
    try {
      const { resolve } = await import('node:path');
      const { existsSync, mkdirSync } = await import('node:fs');
      const newSquadDir = workspace.squadDir;

      // Ensure .squad/ exists
      if (!existsSync(newSquadDir)) {
        mkdirSync(newSquadDir, { recursive: true });
      }

      // Re-point the squad parser
      if (app.squadParser && typeof app.squadParser.setSquadDir === 'function') {
        app.squadParser.setSquadDir(newSquadDir);
      }

      // Re-seed team members from new workspace
      const { seedTeamMembers } = await import('../services/db/seed-team.js');
      seedTeamMembers(app.db, newSquadDir);

      // Re-load agent registry from new DB
      if (app.agentRegistry) {
        app.agentRegistry.loadFromDatabase();
      }

      // Re-load skills from new workspace
      const { loadSkillsFromDirectory } = await import('../services/seed-skills.js');
      const skillsDir = resolve(newSquadDir, 'skills');
      if (existsSync(skillsDir)) {
        loadSkillsFromDirectory(skillsDir);
      }

      app.log.info(`Switched to workspace: ${workspace.name} (${newSquadDir})`);
    } catch (err) {
      app.log.warn(`Workspace switch partial: ${(err as Error).message}`);
    }

    return reply.send(workspace);
  });

  // GET /api/workspaces/browse — list directories for workspace picker
  app.get<{ Querystring: { path?: string } }>('/workspaces/browse', async (request, reply) => {
    const { readdirSync, statSync } = await import('node:fs');
    const { resolve, join, basename } = await import('node:path');
    const { homedir } = await import('node:os');

    const basePath = request.query.path?.trim() || homedir();
    const resolved = resolve(basePath);

    try {
      const entries = readdirSync(resolved, { withFileTypes: true });
      const dirs = entries
        .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
        .map((e) => {
          const fullPath = join(resolved, e.name);
          const hasSquad = (() => { try { statSync(join(fullPath, '.squad')); return true; } catch { return false; } })();
          const hasGit = (() => { try { statSync(join(fullPath, '.git')); return true; } catch { return false; } })();
          return { name: e.name, path: fullPath, hasSquad, hasGit };
        })
        .sort((a, b) => {
          if (a.hasSquad !== b.hasSquad) return a.hasSquad ? -1 : 1;
          if (a.hasGit !== b.hasGit) return a.hasGit ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return reply.send({
        current: resolved,
        parent: resolve(resolved, '..'),
        name: basename(resolved),
        dirs,
      });
    } catch {
      return reply.status(400).send({ error: `Cannot read directory: ${resolved}` });
    }
  });
};

export default workspacesRoute;

declare module 'fastify' {
  interface FastifyInstance {
    workspaceService: WorkspaceService;
  }
}
