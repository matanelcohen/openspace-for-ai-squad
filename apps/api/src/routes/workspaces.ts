import type { FastifyPluginAsync } from 'fastify';

import type { WorkspaceService } from '../services/workspace/index.js';
import type { ChatService } from '../services/chat/index.js';
import type { AgentRegistry } from '../services/agent-registry.js';

interface InitSquadBody {
  teamName: string;
  description?: string;
  stack?: string;
  agents: Array<{ name: string; role: string }>;
}

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

      // Re-sync team members from new workspace (clears old + re-inserts)
      const { syncTeamMembers } = await import('../services/db/seed-team.js');
      syncTeamMembers(app.db, newSquadDir);

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

      // Scope traces to this workspace
      if (app.traceService && typeof app.traceService.setWorkspaceId === 'function') {
        app.traceService.setWorkspaceId(workspace.id);
      }

      // Scope chat messages to this workspace
      if (app.chatService && typeof app.chatService.setWorkspaceId === 'function') {
        app.chatService.setWorkspaceId(workspace.id);
      }

      // Refresh chat agent list from newly loaded registry
      if (app.chatService && app.agentRegistry && typeof app.chatService.setAgentRegistry === 'function') {
        app.chatService.setAgentRegistry(app.agentRegistry);
      }

      app.log.info(`Switched to workspace: ${workspace.name} (${newSquadDir})`);
    } catch (err) {
      app.log.warn(`Workspace switch partial: ${(err as Error).message}`);
    }

    return reply.send(workspace);
  });

  /** Check if a squad is initialized in this workspace. */
  app.get<{ Params: { id: string } }>('/workspaces/:id/status', async (request, reply) => {
    const workspace = app.workspaceService.get(request.params.id);
    if (!workspace) {
      return reply.status(404).send({ error: 'Workspace not found' });
    }

    const { existsSync } = await import('node:fs');
    const { join } = await import('node:path');

    const squadDir = workspace.squadDir;
    const teamMdExists = existsSync(join(squadDir, 'team.md'));
    const agentsDir = join(squadDir, 'agents');
    let agentCount = 0;

    if (existsSync(agentsDir)) {
      const { readdirSync } = await import('node:fs');
      try {
        agentCount = readdirSync(agentsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).length;
      } catch {
        // ignore
      }
    }

    return reply.send({
      initialized: existsSync(squadDir) && teamMdExists,
      hasTeam: teamMdExists,
      agentCount,
    });
  });

  /** Initialize a squad in a workspace — uses @bradygaster/squad-sdk. */
  app.post<{ Params: { id: string }; Body: InitSquadBody }>(
    '/workspaces/:id/init',
    async (request, reply) => {
      const workspace = app.workspaceService.get(request.params.id);
      if (!workspace) {
        return reply.status(404).send({ error: 'Workspace not found' });
      }

      const { teamName, description, stack, agents } = request.body ?? {};
      if (!teamName || !agents || agents.length === 0) {
        return reply.status(400).send({ error: 'teamName and at least one agent are required' });
      }

      const { existsSync, mkdirSync, writeFileSync } = await import('node:fs');
      const { join } = await import('node:path');

      try {
        // Use Squad SDK to ensure .squad/ directory
        const { ensureSquadPath, onboardAgent } = await import('@bradygaster/squad-sdk');
        const squadDir = ensureSquadPath(workspace.projectDir);

        // Create subdirectories
        for (const subdir of ['tasks', 'sessions', 'decisions/inbox']) {
          const dirPath = join(squadDir, subdir);
          if (!existsSync(dirPath)) mkdirSync(dirPath, { recursive: true });
        }

        // Create config
        writeFileSync(
          join(squadDir, 'config.json'),
          JSON.stringify({ version: 1, defaultModel: 'claude-opus-4.6' }, null, 2),
          'utf-8',
        );

        // Create team.md
        const stackLine = stack ? `\n**Tech Stack:** ${stack}\n` : '';
        const descLine = description ? `\n> ${description}\n` : '';
        const memberRows = agents
          .map((a) => {
            const slug = a.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            return `| ${a.name} | ${a.role} | .squad/agents/${slug}/charter.md | 🟢 Active |`;
          })
          .join('\n');

        writeFileSync(
          join(squadDir, 'team.md'),
          `# ${teamName}\n${descLine}${stackLine}\n## Members\n\n| Name | Role | Charter | Status |\n| ---- | ---- | ------- | ------ |\n${memberRows}\n\n## Project Context\n\nInitialized via openspace.ai with @bradygaster/squad-sdk.\n`,
          'utf-8',
        );

        // Onboard each agent via Squad SDK
        const skills = stack ? stack.split(',').map((s) => s.trim()) : [];
        for (const agent of agents) {
          try {
            await onboardAgent({
              teamRoot: squadDir,
              agentName: agent.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
              role: agent.role.toLowerCase(),
              displayName: `${agent.name} — ${agent.role}`,
              projectContext: description ?? teamName,
            });
          } catch {
            // Fallback: create charter manually if SDK onboard fails
            const { generateCharter } = await import('../services/squad-file-writer.js');
            const slug = agent.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const agentDir = join(squadDir, 'agents', slug);
            if (!existsSync(agentDir)) mkdirSync(agentDir, { recursive: true });
            writeFileSync(join(agentDir, 'charter.md'), generateCharter(agent.name, agent.role, skills), 'utf-8');
          }
        }

        // Re-sync DB
        const { syncTeamMembers } = await import('../services/db/seed-team.js');
        syncTeamMembers(app.db, squadDir);
        if (app.agentRegistry) app.agentRegistry.loadFromDatabase();
        if (app.squadParser && typeof app.squadParser.setSquadDir === 'function') {
          app.squadParser.setSquadDir(squadDir);
        }

        app.log.info(`Squad initialized via SDK for workspace: ${workspace.name}`);
      } catch (err) {
        app.log.error(`Squad init failed: ${(err as Error).message}`);
        return reply.status(500).send({ error: `Initialization failed: ${(err as Error).message}` });
      }

      const updatedWorkspace = app.workspaceService.update(workspace.id, {});
      return reply.status(201).send(updatedWorkspace ?? workspace);
    },
  );

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
    chatService: ChatService;
    agentRegistry: AgentRegistry;
    db: import('better-sqlite3').Database;
    squadParser: { setSquadDir?: (dir: string) => void };
  }
}
