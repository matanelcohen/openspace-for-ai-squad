/**
 * Agents API — P1-4
 *
 * GET    /api/agents              — List all agents with status, role, current task.
 * GET    /api/agents/status       — Real-time agent work status (active tasks + queues).
 * GET    /api/agents/:id          — Agent detail with charter, history, expertise.
 * GET    /api/agents/:id/charter  — Raw charter markdown for an agent.
 * PUT    /api/agents/:id/charter  — Update the charter markdown for an agent.
 * GET    /api/agents/:id/skills   — Per-agent skills (role-matched + overrides).
 * PATCH  /api/agents/:id/skills   — Toggle a skill override for an agent.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';
import { getSkillsForRole, loadSkillsFromDirectory } from '../services/seed-skills.js';
import { getTask } from '../services/squad-writer/task-writer.js';

/** Resolve the .squad dir from the active workspace, falling back to cwd. */
function getSquadDir(app: { workspaceService?: { getActive?: () => { squadDir: string } | null } }): string {
  const active = app.workspaceService?.getActive?.();
  if (active?.squadDir) return active.squadDir;
  return resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
}

// ── Skill override persistence helpers ────────────────────────────

/** Override mode: 'always' = force-inject, 'never' = exclude, absent = auto-match */
type SkillOverrideMode = 'always' | 'never';
type OverrideMap = Record<string, Record<string, SkillOverrideMode>>;

function getOverridesPath(squadDir: string): string {
  return join(squadDir, '.cache', 'agent-skill-overrides.json');
}

function readOverrides(squadDir: string): OverrideMap {
  const path = getOverridesPath(squadDir);
  if (!existsSync(path)) return {};
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8')) as Record<string, Record<string, unknown>>;
    // Migrate old boolean format to new mode format
    const migrated: OverrideMap = {};
    for (const [agentId, skills] of Object.entries(raw)) {
      migrated[agentId] = {};
      for (const [skillId, val] of Object.entries(skills)) {
        if (val === 'always' || val === 'never') {
          migrated[agentId][skillId] = val;
        } else if (val === true) {
          migrated[agentId][skillId] = 'always';
        } else if (val === false) {
          migrated[agentId][skillId] = 'never';
        }
      }
    }
    return migrated;
  } catch {
    return {};
  }
}

function writeOverrides(squadDir: string, overrides: OverrideMap): void {
  const path = getOverridesPath(squadDir);
  const cacheDir = join(squadDir, '.cache');
  if (!existsSync(cacheDir)) mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path, JSON.stringify(overrides, null, 2), 'utf-8');
}

/** Load all skills from workspace directories. */
function loadAllWorkspaceSkills(squadDir: string): ReturnType<typeof loadSkillsFromDirectory> {
  const projectDir = resolve(squadDir, '..');
  const dirs = [
    join(squadDir, 'skills'),
    join(projectDir, '.copilot', 'skills'),
    join(squadDir, 'templates', 'skills'),
  ];
  const all: ReturnType<typeof loadSkillsFromDirectory> = [];
  const seen = new Set<string>();
  for (const dir of dirs) {
    for (const skill of loadSkillsFromDirectory(dir)) {
      if (!seen.has(skill.id)) {
        seen.add(skill.id);
        all.push(skill);
      }
    }
  }
  return all;
}

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
    const squadDir = getSquadDir(app);
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

  app.get<{ Params: { id: string } }>('/agents/:id', async (request, reply) => {
    const { id } = request.params;
    const agent = await app.squadParser.getAgent(id);

    if (!agent) {
      return reply.status(404).send({ error: `Agent not found: ${id}` });
    }

    return reply.send(agent);
  });

  // GET /api/agents/:id/charter — raw charter markdown
  app.get<{ Params: { id: string } }>('/agents/:id/charter', async (request, reply) => {
    const { id } = request.params;
    const agent = await app.squadParser.getAgent(id);

    if (!agent) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Agent not found: ${id}`);
    }

    const squadDir = getSquadDir(app);
    const charterPath = join(squadDir, 'agents', id, 'charter.md');

    if (!existsSync(charterPath)) {
      return reply.status(404).send({ agentId: id, charter: null, error: 'Charter file not found' });
    }

    const charter = readFileSync(charterPath, 'utf-8');
    return reply.send({ agentId: id, charter });
  });

  // PUT /api/agents/:id/charter — update charter markdown
  app.put<{ Params: { id: string }; Body: { charter: string } }>(
    '/agents/:id/charter',
    async (request, reply) => {
      const { id } = request.params;
      const { charter } = request.body ?? {};

      if (typeof charter !== 'string') {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Missing required field: charter (string)',
        );
      }

      const agent = await app.squadParser.getAgent(id);
      if (!agent) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Agent not found: ${id}`);
      }

      const squadDir = getSquadDir(app);
      const agentDir = join(squadDir, 'agents', id);

      if (!existsSync(agentDir)) {
        mkdirSync(agentDir, { recursive: true });
      }

      const charterPath = join(agentDir, 'charter.md');
      writeFileSync(charterPath, charter, 'utf-8');

      return reply.send({ agentId: id, charter, success: true });
    },
  );

  // GET /api/agents/:id/skills — per-agent skills with override modes
  app.get<{ Params: { id: string } }>('/agents/:id/skills', async (request, reply) => {
    const { id } = request.params;
    const agent = await app.squadParser.getAgent(id);

    if (!agent) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Agent not found: ${id}`);
    }

    const squadDir = getSquadDir(app);
    const allSkills = loadAllWorkspaceSkills(squadDir);

    const overrides = readOverrides(squadDir);
    const agentOverrides = overrides[id] ?? {};

    // Build skill list with 3-state mode: auto | always | never
    const skills = allSkills.map((skill) => {
      const override = agentOverrides[skill.id] as 'always' | 'never' | undefined;
      const mode: 'auto' | 'always' | 'never' = override ?? 'auto';

      return {
        id: skill.id,
        name: skill.frontmatter.name,
        description: skill.frontmatter.description,
        domain: skill.frontmatter.domain ?? '',
        tags: skill.frontmatter.tags,
        mode,
      };
    });

    return reply.send({
      agentId: id,
      role: agent.role,
      skills,
    });
  });

  // PATCH /api/agents/:id/skills — set skill mode for an agent (auto | always | never)
  app.patch<{ Params: { id: string }; Body: { skillId: string; mode: 'auto' | 'always' | 'never' } }>(
    '/agents/:id/skills',
    async (request, reply) => {
      const { id } = request.params;
      const { skillId, mode } = request.body ?? {};

      if (!skillId || !['auto', 'always', 'never'].includes(mode)) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Required: skillId (string) and mode ("auto" | "always" | "never")',
        );
      }

      const agent = await app.squadParser.getAgent(id);
      if (!agent) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Agent not found: ${id}`);
      }

      const squadDir = getSquadDir(app);
      const allSkills = loadAllWorkspaceSkills(squadDir);
      const skill = allSkills.find((s) => s.id === skillId);

      if (!skill) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
      }

      const overrides = readOverrides(squadDir);
      if (!overrides[id]) overrides[id] = {};

      if (mode === 'auto') {
        // Remove override — back to auto-matching
        delete overrides[id][skillId];
        if (Object.keys(overrides[id]).length === 0) delete overrides[id];
      } else {
        overrides[id][skillId] = mode;
      }

      writeOverrides(squadDir, overrides);

      return reply.send({ success: true, agentId: id, skillId, mode });
    },
  );
};

export default agentsRoute;
