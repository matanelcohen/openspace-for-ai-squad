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

// ── Skill override persistence helpers ────────────────────────────

type OverrideMap = Record<string, Record<string, boolean>>;

function getOverridesPath(squadDir: string): string {
  return join(squadDir, '.cache', 'agent-skill-overrides.json');
}

function readOverrides(squadDir: string): OverrideMap {
  const path = getOverridesPath(squadDir);
  if (!existsSync(path)) return {};
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as OverrideMap;
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

    const squadDir = resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
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

      const squadDir = resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
      const agentDir = join(squadDir, 'agents', id);

      if (!existsSync(agentDir)) {
        mkdirSync(agentDir, { recursive: true });
      }

      const charterPath = join(agentDir, 'charter.md');
      writeFileSync(charterPath, charter, 'utf-8');

      return reply.send({ agentId: id, charter, success: true });
    },
  );

  // GET /api/agents/:id/skills — per-agent skills (role-matched + overrides)
  app.get<{ Params: { id: string } }>('/agents/:id/skills', async (request, reply) => {
    const { id } = request.params;
    const agent = await app.squadParser.getAgent(id);

    if (!agent) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Agent not found: ${id}`);
    }

    const squadDir = resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
    const skillsDir = join(squadDir, 'skills');
    const allSkills = loadSkillsFromDirectory(skillsDir);
    const roleMatched = getSkillsForRole(allSkills, agent.role);
    const roleMatchedIds = new Set(roleMatched.map((s) => s.id));

    const overrides = readOverrides(squadDir);
    const agentOverrides = overrides[id] ?? {};

    // Build merged skill list: start with all skills, mark enabled/source
    const skills = allSkills.map((skill) => {
      const matchedByRole = roleMatchedIds.has(skill.id);
      const hasOverride = skill.id in agentOverrides;
      const enabled = hasOverride ? agentOverrides[skill.id] : matchedByRole;
      const source: 'role-match' | 'manual' = hasOverride ? 'manual' : 'role-match';

      return {
        id: skill.id,
        name: skill.frontmatter.name,
        description: skill.frontmatter.description,
        tags: skill.frontmatter.tags,
        enabled,
        source,
        matchedByRole,
      };
    });

    return reply.send({
      agentId: id,
      role: agent.role,
      skills,
    });
  });

  // PATCH /api/agents/:id/skills — toggle a skill for an agent
  app.patch<{ Params: { id: string }; Body: { skillId: string; enabled: boolean } }>(
    '/agents/:id/skills',
    async (request, reply) => {
      const { id } = request.params;
      const { skillId, enabled } = request.body ?? {};

      if (!skillId || typeof enabled !== 'boolean') {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Missing required fields: skillId (string) and enabled (boolean)',
        );
      }

      const agent = await app.squadParser.getAgent(id);
      if (!agent) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Agent not found: ${id}`);
      }

      const squadDir = resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
      const skillsDir = join(squadDir, 'skills');
      const allSkills = loadSkillsFromDirectory(skillsDir);
      const skill = allSkills.find((s) => s.id === skillId);

      if (!skill) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
      }

      // Check if this is just the role-match default — if so, remove override
      const roleMatched = getSkillsForRole(allSkills, agent.role);
      const isRoleMatch = roleMatched.some((s) => s.id === skillId);

      const overrides = readOverrides(squadDir);
      if (!overrides[id]) overrides[id] = {};

      if (enabled === isRoleMatch) {
        // Override matches default — remove it
        delete overrides[id][skillId];
        if (Object.keys(overrides[id]).length === 0) delete overrides[id];
      } else {
        overrides[id][skillId] = enabled;
      }

      writeOverrides(squadDir, overrides);

      return reply.send({ success: true, agentId: id, skillId, enabled });
    },
  );
};

export default agentsRoute;
