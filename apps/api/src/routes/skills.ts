/**
 * Skills API routes
 *
 * GET  /api/skills          — List all registered skills
 * GET  /api/skills/:id      — Skill detail
 * POST /api/agents/:id/skills — Attach (activate) a skill for an agent
 */

import type { FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';
import type { SkillRegistryImpl } from '../services/skill-registry/index.js';

// Serialise a registry entry for the API response (Sets aren't JSON-friendly)
function serialiseEntry(entry: ReturnType<SkillRegistryImpl['get']>) {
  if (!entry) return null;
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
    tools: entry.manifest.tools,
    triggers: entry.manifest.triggers,
    prompts: entry.manifest.prompts.map((p) => ({
      id: p.id,
      name: p.name,
      role: p.role,
    })),
    dependencies: entry.manifest.dependencies ?? [],
    config: entry.manifest.config ?? [],
    permissions: entry.manifest.permissions ?? [],
  };
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
      const ctx = await registry.activate(skillId, agentId, taskContext as any);
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
};

export default skillsRoute;
