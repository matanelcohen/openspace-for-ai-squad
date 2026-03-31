/**
 * Skill Gallery API routes
 *
 * GET    /api/skills/gallery              — Browse/search the skill catalog
 * GET    /api/skills/gallery/featured     — Featured/curated skills
 * GET    /api/skills/gallery/categories   — List categories with counts
 * GET    /api/skills/gallery/:id          — Gallery skill detail
 * POST   /api/skills/gallery/:id/install  — Install a gallery skill into the local registry
 * POST   /api/skills/gallery/refresh      — Re-seed the catalog
 */

import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { GalleryCategory, GallerySortField } from '@matanelcohen/openspace-shared';
import { GALLERY_CATEGORIES } from '@matanelcohen/openspace-shared';
import type { FastifyPluginAsync } from 'fastify';

import { ErrorCodes, sendError } from '../lib/api-errors.js';
import type { SkillRegistryImpl } from '../services/skill-registry/index.js';

// ── Helpers ───────────────────────────────────────────────────────

function getSquadDir(app?: { workspaceService?: { getActive?: () => { squadDir: string } | null } }): string {
  const active = app?.workspaceService?.getActive?.();
  if (active?.squadDir) return active.squadDir;
  return resolve(process.cwd(), process.env.SQUAD_DIR ?? '.squad');
}

const SKILL_ICONS: Record<string, string> = {
  'file-operations': '📁',
  'bash-execution': '💻',
  'code-review': '🔍',
  'test-runner': '🧪',
  'git-operations': '🔀',
  'database-query': '🗄️',
  'task-delegation': '📋',
};

/** Generate SKILL.md content from gallery skill data */
function generateSkillMd(name: string, description: string, tags: string[]): string {
  const lines: string[] = ['---'];
  lines.push(`name: "${name}"`);
  lines.push(`description: "${description}"`);
  lines.push(`tags: [${tags.map((t) => `"${t}"`).join(', ')}]`);
  lines.push('agentMatch:');
  lines.push('  roles: ["*"]');
  lines.push('requires:');
  lines.push('  bins: []');
  lines.push('  env: []');
  lines.push('---');
  lines.push('');
  lines.push(`# ${name}`);
  lines.push('');
  lines.push(description);
  return lines.join('\n');
}

// ── Route Plugin ────────────────────────────────────────────────────

const skillGalleryRoute: FastifyPluginAsync = async (app) => {
  // GET /api/skills/gallery — browse/search the catalog
  app.get<{
    Querystring: {
      query?: string;
      category?: string;
      tags?: string;
      featured?: string;
      sort?: string;
      order?: string;
      limit?: string;
      offset?: string;
    };
  }>('/skills/gallery', async (request, reply) => {
    const gallery = app.skillGalleryService;
    if (!gallery) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill gallery service not available');
    }

    const qs = request.query;

    // Validate category
    let category: GalleryCategory | undefined;
    if (qs.category) {
      if (!GALLERY_CATEGORIES.includes(qs.category as GalleryCategory)) {
        return sendError(
          reply,
          400,
          ErrorCodes.VALIDATION_ERROR,
          `Invalid category: ${qs.category}. Valid: ${GALLERY_CATEGORIES.join(', ')}`,
        );
      }
      category = qs.category as GalleryCategory;
    }

    // Validate sort
    const validSorts: GallerySortField[] = ['name', 'installCount', 'addedAt', 'updatedAt'];
    const sort = (qs.sort as GallerySortField) ?? 'name';
    if (!validSorts.includes(sort)) {
      return sendError(
        reply,
        400,
        ErrorCodes.VALIDATION_ERROR,
        `Invalid sort: ${qs.sort}. Valid: ${validSorts.join(', ')}`,
      );
    }

    const result = gallery.search({
      query: qs.query,
      category,
      tags: qs.tags ? qs.tags.split(',').map((t) => t.trim()) : undefined,
      featured: qs.featured === 'true' ? true : qs.featured === 'false' ? false : undefined,
      sort,
      order: qs.order === 'desc' ? 'desc' : 'asc',
      limit: Math.min(Math.max(parseInt(qs.limit ?? '50', 10) || 50, 1), 100),
      offset: Math.max(parseInt(qs.offset ?? '0', 10) || 0, 0),
    });

    return reply.send(result);
  });

  // GET /api/skills/gallery/featured — featured/curated skills
  app.get<{ Querystring: { limit?: string } }>('/skills/gallery/featured', async (request, reply) => {
    const gallery = app.skillGalleryService;
    if (!gallery) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill gallery service not available');
    }

    const limit = Math.min(Math.max(parseInt(request.query.limit ?? '10', 10) || 10, 1), 50);
    const skills = gallery.featured(limit);
    return reply.send({ skills });
  });

  // GET /api/skills/gallery/categories — list categories with counts
  app.get('/skills/gallery/categories', async (_request, reply) => {
    const gallery = app.skillGalleryService;
    if (!gallery) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill gallery service not available');
    }

    const categories = gallery.categories();
    return reply.send({ categories });
  });

  // GET /api/skills/gallery/:id — gallery skill detail
  app.get<{ Params: { id: string } }>('/skills/gallery/:id', async (request, reply) => {
    const gallery = app.skillGalleryService;
    if (!gallery) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill gallery service not available');
    }

    const skill = gallery.get(request.params.id);
    if (!skill) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Gallery skill not found: ${request.params.id}`);
    }

    return reply.send(skill);
  });

  // POST /api/skills/gallery/:id/install — install a gallery skill locally
  app.post<{ Params: { id: string } }>('/skills/gallery/:id/install', async (request, reply) => {
    const gallery = app.skillGalleryService;
    if (!gallery) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill gallery service not available');
    }

    const registry = app.skillRegistry as SkillRegistryImpl | undefined;
    if (!registry) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill registry not available');
    }

    const gallerySkill = gallery.get(request.params.id);
    if (!gallerySkill) {
      return sendError(reply, 404, ErrorCodes.NOT_FOUND, `Gallery skill not found: ${request.params.id}`);
    }

    // Check if already installed
    if (registry.get(gallerySkill.id)) {
      return sendError(reply, 409, ErrorCodes.CONFLICT, `Skill already installed: ${gallerySkill.id}`);
    }

    // Write SKILL.md to local skills directory
    const squadDir = getSquadDir(app);
    const skillDir = join(squadDir, 'skills', gallerySkill.id);
    const skillFile = join(skillDir, 'SKILL.md');

    if (!existsSync(skillDir)) {
      mkdirSync(skillDir, { recursive: true });
    }

    writeFileSync(
      skillFile,
      generateSkillMd(gallerySkill.name, gallerySkill.description, gallerySkill.tags),
      'utf-8',
    );

    // Register into the skill registry
    const entries = (registry as unknown as { entries: Map<string, unknown> }).entries;
    entries.set(gallerySkill.id, {
      manifest: {
        manifestVersion: '1.0' as const,
        id: gallerySkill.id,
        name: gallerySkill.name,
        version: gallerySkill.version,
        description: gallerySkill.description,
        author: gallerySkill.author,
        tags: gallerySkill.tags,
        icon: gallerySkill.icon ?? SKILL_ICONS[gallerySkill.id] ?? '🔧',
        permissions: [],
        agentMatch: { roles: ['*'] },
        requires: { bins: [], env: [] },
        instructions: gallerySkill.description,
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

    // Increment install count in gallery
    gallery.incrementInstallCount(gallerySkill.id);

    const entry = registry.get(gallerySkill.id);
    return reply.status(201).send({
      success: true,
      skillId: gallerySkill.id,
      name: gallerySkill.name,
      message: `Skill "${gallerySkill.name}" installed successfully`,
      skill: entry
        ? {
            id: entry.manifest.id,
            name: entry.manifest.name,
            phase: entry.phase,
          }
        : null,
    });
  });

  // POST /api/skills/gallery/refresh — re-seed the catalog
  app.post('/skills/gallery/refresh', async (_request, reply) => {
    const gallery = app.skillGalleryService;
    if (!gallery) {
      return sendError(reply, 503, ErrorCodes.INTERNAL_ERROR, 'Skill gallery service not available');
    }

    // For now, re-seed ensures all built-in entries exist.
    // Future: fetch from remote catalog sources.
    gallery.seed();

    return reply.send({
      success: true,
      total: gallery.count(),
      message: 'Gallery catalog refreshed',
    });
  });
};

export default skillGalleryRoute;

// ── Fastify type augmentation ───────────────────────────────────

declare module 'fastify' {
  interface FastifyInstance {
    skillGalleryService?: SkillGalleryService;
    skillRegistry?: SkillRegistryImpl;
  }
}

import type { SkillGalleryService } from '../services/skill-gallery/index.js';
