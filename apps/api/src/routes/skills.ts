/**
 * Skills API routes
 *
 * GET    /api/skills                  — List all registered skills
 * POST   /api/skills                  — Create a new skill (SKILL.md format)
 * GET    /api/skills/health           — Health status for all skills
 * GET    /api/skills/:id              — Skill detail
 * PUT    /api/skills/:id              — Update skill manifest
 * DELETE /api/skills/:id              — Unregister (unload) a skill
 * GET    /api/skills/:id/agents       — List agents using a skill
 * GET    /api/skills/:id/health       — Health status for a single skill
 * POST   /api/skills/:id/recover      — Manually recover a failed/disabled skill
 * POST   /api/agents/:id/skills       — Attach (activate) a skill for an agent
 * DELETE /api/agents/:id/skills/:skillId — Detach (deactivate) a skill for an agent
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { SkillManifest } from '@openspace/shared';
import type { FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';
import type { SkillRegistryImpl } from '../services/skill-registry/index.js';

// ── Icon map (skill-id → emoji) ───────────────────────────────────

const SKILL_ICONS: Record<string, string> = {
  'file-operations': '📁',
  'bash-execution': '💻',
  'code-review': '🔍',
  'web-search': '🌐',
  'test-runner': '🧪',
  'git-operations': '🔀',
  'database-query': '🗄️',
  'task-delegation': '📋',
};

// ── Helpers ───────────────────────────────────────────────────────

function getSquadDir(): string {
  return resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
}

// Serialise a registry entry for the API response (Sets aren't JSON-friendly)
function serialiseEntry(entry: ReturnType<SkillRegistryImpl['get']>) {
  if (!entry) return null;
  const manifest = entry.manifest as Record<string, unknown>;
  return {
    id: entry.manifest.id,
    name: entry.manifest.name,
    version: entry.manifest.version,
    description: entry.manifest.description,
    author: entry.manifest.author ?? null,
    tags: entry.manifest.tags ?? [],
    icon: entry.manifest.icon ?? null,
    phase: entry.phase,
    activeAgents: [...entry.activeAgents],
    lastTransition: entry.lastTransition,
    error: entry.error ?? null,
    tools: entry.manifest.tools ?? [],
    triggers: entry.manifest.triggers ?? [],
    prompts: (entry.manifest.prompts ?? []).map(
      (p: { id: string; name: string; role: string }) => ({
        id: p.id,
        name: p.name,
        role: p.role,
      }),
    ),
    dependencies: entry.manifest.dependencies ?? [],
    config: entry.manifest.config ?? [],
    permissions: entry.manifest.permissions ?? [],
    agentMatch: manifest.agentMatch ?? null,
    requires: manifest.requires ?? null,
    instructions: manifest.instructions ?? null,
  };
}

/** Type guard for SKILL.md-compatible payload */
interface SkillMdPayload {
  name: string;
  description: string;
  tags?: string[];
  agentMatch?: { roles: string[] };
  requires?: { bins?: string[]; env?: string[] };
  instructions?: string;
}

function isSkillMdPayload(body: unknown): body is SkillMdPayload {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return typeof b.name === 'string' && typeof b.description === 'string';
}

/** Type guard: does the body look like a minimal SkillManifest? */
function isManifestLike(body: unknown): body is SkillManifest {
  if (!body || typeof body !== 'object') return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.id === 'string' &&
    typeof b.name === 'string' &&
    typeof b.version === 'string' &&
    typeof b.description === 'string'
  );
}

/** Generate SKILL.md content from the payload */
function generateSkillMd(payload: SkillMdPayload): string {
  const lines: string[] = ['---'];
  lines.push(`name: ${payload.name}`);
  lines.push(`description: ${payload.description}`);
  lines.push(`tags: [${(payload.tags ?? []).join(', ')}]`);
  lines.push('agentMatch:');
  lines.push(`  roles: [${(payload.agentMatch?.roles ?? ['*']).map((r) => `"${r}"`).join(', ')}]`);
  lines.push('requires:');
  lines.push(`  bins: [${(payload.requires?.bins ?? []).join(', ')}]`);
  lines.push(`  env: [${(payload.requires?.env ?? []).join(', ')}]`);
  lines.push('---');
  lines.push('');
  if (payload.instructions) {
    lines.push(payload.instructions);
  }
  return lines.join('\n');
}

const skillsRoute: FastifyPluginAsync = async (app) => {
  // GET /api/skills — list all registered skills
  app.get('/skills', async (_request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const entries = registry.list();
    const skills = entries.map(serialiseEntry).filter(Boolean);
    return reply.send({ skills });
  });

  // GET /api/skills/health — health status for all registered skills
  app.get('/skills/health', async (_request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const statuses = registry.getAllHealthStatuses();
    return reply.send({ statuses });
  });

  // POST /api/skills — create a new skill from SKILL.md-compatible payload
  app.post('/skills', async (request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const body = request.body;

    // Accept the new SKILL.md-compatible payload
    if (isSkillMdPayload(body)) {
      const payload = body as SkillMdPayload;
      const kebabRe = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
      if (!kebabRe.test(payload.name)) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Skill name must be kebab-case (e.g. "code-review")',
        );
      }

      const skillId = payload.name;

      // Check for duplicates
      if (registry.get(skillId)) {
        return sendError(reply, 409, ErrorCodes.CONFLICT, `Skill already exists: ${skillId}`);
      }

      // Write SKILL.md file
      const squadDir = getSquadDir();
      const skillDir = join(squadDir, 'skills', skillId);
      const skillFile = join(skillDir, 'SKILL.md');

      if (!existsSync(skillDir)) {
        mkdirSync(skillDir, { recursive: true });
      }
      writeFileSync(skillFile, generateSkillMd(payload), 'utf-8');

      // Pretty-print the display name from the kebab-case ID
      const displayName = skillId
        .split('-')
        .map((w) => w[0].toUpperCase() + w.slice(1))
        .join(' ');

      // Register into the skill registry
      const entries = (registry as unknown as { entries: Map<string, unknown> }).entries;
      entries.set(skillId, {
        manifest: {
          manifestVersion: '1.0' as const,
          id: skillId,
          name: displayName,
          version: '1.0.0',
          description: payload.description,
          author: 'openspace.ai',
          tags: payload.tags ?? [],
          icon: SKILL_ICONS[skillId] ?? '🔧',
          permissions: [],
          agentMatch: payload.agentMatch ?? { roles: ['*'] },
          requires: payload.requires ?? { bins: [], env: [] },
          instructions: payload.instructions ?? '',
        },
        phase: 'loaded' as const,
        hooks: null,
        activeAgents: new Set<string>(),
        lastTransition: Date.now(),
        error: null,
        sourcePath: skillFile,
        retryState: null,
        circuitBreaker: null,
      });

      const entry = registry.get(skillId);
      return reply.status(201).send(serialiseEntry(entry));
    }

    // Fallback: accept legacy SkillManifest payload
    if (!isManifestLike(body)) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        'Request body must include name and description (SKILL.md format) or id, name, version, description (legacy format)',
      );
    }

    const result = await registry.register(body as SkillManifest);
    if (!result.valid) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        result.errors.map((e: { message: string }) => e.message).join('; '),
      );
    }

    const entry = registry.get((body as SkillManifest).id);
    return reply.status(201).send(serialiseEntry(entry));
  });

  // GET /api/skills/:id — skill detail
  app.get<{ Params: { id: string } }>('/skills/:id', async (request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const entry = registry.get(request.params.id);
    if (!entry) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${request.params.id}`);
    }

    return reply.send(serialiseEntry(entry));
  });

  // PUT /api/skills/:id — update skill manifest
  app.put<{ Params: { id: string }; Body: Partial<SkillManifest> }>(
    '/skills/:id',
    async (request, reply) => {
      const registry = app.skillRegistry;
      if (!registry) {
        return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
      }

      const skillId = request.params.id;
      const entry = registry.get(skillId);
      if (!entry) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
      }

      const body = request.body;
      if (!body || typeof body !== 'object') {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          'Request body must be a JSON object',
        );
      }

      const result = await registry.updateManifest(skillId, body as Partial<SkillManifest>);
      if (!result.valid) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          result.errors.map((e: { message: string }) => e.message).join('; '),
        );
      }

      const updated = registry.get(skillId);
      return reply.send(serialiseEntry(updated));
    },
  );

  // DELETE /api/skills/:id — unregister (unload) a skill
  app.delete<{ Params: { id: string } }>('/skills/:id', async (request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const skillId = request.params.id;
    const entry = registry.get(skillId);
    if (!entry) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
    }

    try {
      await registry.unload(skillId);
      return reply.status(204).send();
    } catch (err) {
      return sendError(
        reply,
        409,
        ErrorCodes.CONFLICT,
        `Cannot unregister skill: ${(err as Error).message}`,
      );
    }
  });

  // GET /api/skills/:id/agents — list agents using a skill
  app.get<{ Params: { id: string } }>('/skills/:id/agents', async (request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const skillId = request.params.id;
    const entry = registry.get(skillId);
    if (!entry) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
    }

    return reply.send({ skillId, agents: [...entry.activeAgents] });
  });

  // GET /api/skills/:id/health — health status for a single skill
  app.get<{ Params: { id: string } }>('/skills/:id/health', async (request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const status = registry.getHealthStatus(request.params.id);
    if (!status) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${request.params.id}`);
    }

    return reply.send(status);
  });

  // POST /api/skills/:id/recover — manually recover a failed/disabled skill
  app.post<{ Params: { id: string } }>('/skills/:id/recover', async (request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const skillId = request.params.id;
    const entry = registry.get(skillId);
    if (!entry) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
    }

    const result = await registry.recover(skillId);
    if (!result.success) {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, result.error ?? 'Recovery failed');
    }

    const updated = registry.get(skillId);
    return reply.send({
      success: true,
      skill: serialiseEntry(updated),
    });
  });

  // POST /api/agents/:id/skills — attach skill to agent
  app.post<{
    Params: { id: string };
    Body: { skillId: string; taskContext?: Record<string, unknown> };
  }>('/agents/:id/skills', async (request, reply) => {
    const registry = app.skillRegistry;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const agentId = request.params.id;
    const { skillId, taskContext } = request.body ?? {};

    if (!skillId || typeof skillId !== 'string') {
      return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, 'Missing required field: skillId');
    }

    const entry = registry.get(skillId);
    if (!entry) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
    }

    try {
      await registry.activate(skillId, agentId, taskContext as Record<string, unknown> | undefined);
      return reply.status(200).send({
        success: true,
        skillId,
        agentId,
        phase: registry.get(skillId)?.phase,
      });
    } catch (err) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Failed to activate skill: ${(err as Error).message}`,
      );
    }
  });

  // DELETE /api/agents/:id/skills/:skillId — detach (deactivate) a skill for an agent
  app.delete<{ Params: { id: string; skillId: string } }>(
    '/agents/:id/skills/:skillId',
    async (request, reply) => {
      const registry = app.skillRegistry;
      if (!registry) {
        return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
      }

      const agentId = request.params.id;
      const { skillId } = request.params;

      const entry = registry.get(skillId);
      if (!entry) {
        return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Skill not found: ${skillId}`);
      }

      if (!entry.activeAgents.has(agentId)) {
        return sendError(
          reply,
          404,
          ErrorCodes.NOT_FOUND,
          `Skill "${skillId}" is not active for agent "${agentId}"`,
        );
      }

      try {
        await registry.deactivate(skillId, agentId);
        return reply.status(204).send();
      } catch (err) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          `Failed to deactivate skill: ${(err as Error).message}`,
        );
      }
    },
  );
};

export default skillsRoute;
