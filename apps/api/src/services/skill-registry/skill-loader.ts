/**
 * Skill Manifest Loader — parse, validate, and resolve skill manifests.
 *
 * Supports JSON and YAML manifest files (skill.json / skill.yaml).
 * Uses Ajv for schema validation against the architecture spec.
 */

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type {
  ResolvedSkillManifest,
  SkillDependency,
  SkillManifest,
  SkillValidationError,
  SkillValidationResult,
  SkillValidationWarning,
} from '@openspace/shared';
import Ajv from 'ajv';
import YAML from 'yaml';

// ── Manifest JSON Schema ─────────────────────────────────────────

const MANIFEST_SCHEMA = {
  type: 'object',
  required: [
    'manifestVersion',
    'id',
    'name',
    'version',
    'description',
    'tools',
    'prompts',
    'triggers',
  ],
  properties: {
    manifestVersion: { const: 1 },
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{2,63}$' },
    name: { type: 'string', minLength: 1 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+' },
    description: { type: 'string', minLength: 1 },
    author: { type: 'string' },
    license: { type: 'string' },
    homepage: { type: 'string' },
    tags: {
      type: 'array',
      items: { type: 'string' },
    },
    icon: { type: 'string' },
    tools: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['toolId'],
        properties: {
          toolId: { type: 'string' },
          optional: { type: 'boolean' },
          versionRange: { type: 'string' },
          reason: { type: 'string' },
        },
      },
    },
    prompts: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['id', 'name', 'role', 'content'],
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          role: {
            type: 'string',
            enum: ['system', 'planning', 'execution', 'review', 'error', 'handoff'],
          },
          content: { type: 'string' },
          variables: {
            type: 'array',
            items: {
              type: 'object',
              required: ['name', 'description'],
              properties: {
                name: { type: 'string' },
                type: { type: 'string' },
                description: { type: 'string' },
                default: {},
                required: { type: 'boolean' },
              },
            },
          },
          maxTokens: { type: 'number' },
        },
      },
    },
    triggers: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['type'],
        properties: {
          type: { type: 'string', enum: ['task-type', 'label', 'pattern', 'file', 'composite'] },
        },
      },
    },
    dependencies: {
      type: 'array',
      items: {
        type: 'object',
        required: ['skillId'],
        properties: {
          skillId: { type: 'string' },
          versionRange: { type: 'string' },
          optional: { type: 'boolean' },
        },
      },
    },
    config: {
      type: 'array',
      items: {
        type: 'object',
        required: ['key', 'type'],
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          type: { type: 'string', enum: ['string', 'number', 'boolean', 'string[]'] },
          description: { type: 'string' },
          default: {},
          enum: { type: 'array' },
          validation: { type: 'object' },
        },
      },
    },
    entryPoint: { type: 'string' },
    permissions: {
      type: 'array',
      items: {
        type: 'string',
        pattern: '^[a-z]+:[a-z][a-z-]*$',
      },
    },
  },
  additionalProperties: false,
} as const;

const ajv = new Ajv({ allErrors: true, verbose: true });
const validateManifest = ajv.compile(MANIFEST_SCHEMA);

// ── Manifest Discovery ───────────────────────────────────────────

const MANIFEST_FILENAMES = ['skill.json', 'skill.yaml', 'skill.yml', 'manifest.json'];

export interface DiscoveredManifest {
  manifest: SkillManifest;
  sourcePath: string;
}

/**
 * Scan directories for skill manifest files.
 * Returns parsed manifests with their source paths.
 */
export function discoverManifests(directories: string[]): DiscoveredManifest[] {
  const results: DiscoveredManifest[] = [];

  for (const dir of directories) {
    if (!existsSync(dir)) continue;

    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      continue;
    }

    for (const entry of entries) {
      const entryPath = join(dir, entry);
      try {
        if (!statSync(entryPath).isDirectory()) continue;
      } catch {
        continue;
      }

      for (const filename of MANIFEST_FILENAMES) {
        const manifestPath = join(entryPath, filename);
        if (!existsSync(manifestPath)) continue;

        try {
          const raw = readFileSync(manifestPath, 'utf-8');
          const manifest =
            filename.endsWith('.yaml') || filename.endsWith('.yml')
              ? (YAML.parse(raw) as SkillManifest)
              : (JSON.parse(raw) as SkillManifest);

          results.push({ manifest, sourcePath: resolve(manifestPath) });
        } catch {
          // Parse errors are caught during validation phase
          results.push({
            manifest: { id: entry } as SkillManifest,
            sourcePath: resolve(manifestPath),
          });
        }
        break; // only take the first manifest file found per directory
      }
    }
  }

  return results;
}

// ── Manifest Validation ──────────────────────────────────────────

/**
 * Validate a manifest against the schema.
 */
export function validateSkillManifest(
  manifest: SkillManifest,
  sourcePath: string,
  knownIds?: Set<string>,
): SkillValidationResult {
  const errors: SkillValidationError[] = [];
  const warnings: SkillValidationWarning[] = [];

  // Schema validation
  const valid = validateManifest(manifest);
  if (!valid && validateManifest.errors) {
    for (const err of validateManifest.errors) {
      errors.push({
        path: err.instancePath || '/',
        message: err.message || 'Validation error',
        code: 'SCHEMA_ERROR',
      });
    }
  }

  // ID uniqueness
  if (knownIds?.has(manifest.id)) {
    errors.push({
      path: '/id',
      message: `Duplicate skill ID: "${manifest.id}"`,
      code: 'DUPLICATE_ID',
    });
  }

  // Prompt ID uniqueness within the skill
  if (manifest.prompts) {
    const promptIds = new Set<string>();
    for (const p of manifest.prompts) {
      if (promptIds.has(p.id)) {
        errors.push({
          path: `/prompts/${p.id}`,
          message: `Duplicate prompt ID "${p.id}" within skill "${manifest.id}"`,
          code: 'DUPLICATE_PROMPT_ID',
        });
      }
      promptIds.add(p.id);
    }
  }

  // Entry point safety — no path traversal
  if (manifest.entryPoint) {
    if (manifest.entryPoint.includes('..')) {
      errors.push({
        path: '/entryPoint',
        message: 'Entry point must not contain ".." (path traversal)',
        code: 'UNSAFE_ENTRY_POINT',
      });
    }
  }

  // Warnings for missing optional but recommended fields
  if (!manifest.author) {
    warnings.push({
      path: '/author',
      message: 'No author specified',
      suggestion: 'Add an author field for attribution',
    });
  }
  if (!manifest.tags || manifest.tags.length === 0) {
    warnings.push({
      path: '/tags',
      message: 'No tags specified',
      suggestion: 'Add tags for better discoverability',
    });
  }

  return { valid: errors.length === 0, errors, warnings };
}

// ── Dependency Resolution ────────────────────────────────────────

/**
 * Check for circular dependencies in the skill graph.
 * Returns the cycle path if one is found, null otherwise.
 */
export function detectCircularDependencies(
  skillId: string,
  dependencies: Map<string, SkillDependency[]>,
  visited: Set<string> = new Set(),
  path: string[] = [],
): string[] | null {
  if (visited.has(skillId)) {
    return [...path, skillId];
  }

  visited.add(skillId);
  path.push(skillId);

  const deps = dependencies.get(skillId);
  if (deps) {
    for (const dep of deps) {
      const cycle = detectCircularDependencies(dep.skillId, dependencies, new Set(visited), [
        ...path,
      ]);
      if (cycle) return cycle;
    }
  }

  return null;
}

/**
 * Topological sort of skill IDs by dependency order.
 * Returns skills in load order (dependencies first).
 */
export function topologicalSortSkills(
  skillIds: string[],
  dependencies: Map<string, SkillDependency[]>,
): string[] {
  const sorted: string[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(id: string): void {
    if (visited.has(id)) return;
    if (visiting.has(id)) return; // cycle — already caught by detectCircularDependencies

    visiting.add(id);
    const deps = dependencies.get(id);
    if (deps) {
      for (const dep of deps) {
        if (skillIds.includes(dep.skillId)) {
          visit(dep.skillId);
        }
      }
    }
    visiting.delete(id);
    visited.add(id);
    sorted.push(id);
  }

  for (const id of skillIds) {
    visit(id);
  }

  return sorted;
}

/**
 * Resolve a manifest into a ResolvedSkillManifest.
 * Populates sourcePath, resolvedDependencies, and toolAvailability.
 */
export function resolveManifest(
  manifest: SkillManifest,
  sourcePath: string,
  loadedManifests: Map<string, SkillManifest>,
): ResolvedSkillManifest {
  const resolvedDependencies: Record<string, string> = {};

  if (manifest.dependencies) {
    for (const dep of manifest.dependencies) {
      const loaded = loadedManifests.get(dep.skillId);
      if (loaded) {
        resolvedDependencies[dep.skillId] = loaded.version;
      }
    }
  }

  // Tool availability starts as all-true; the registry can refine later
  const toolAvailability: Record<string, boolean> = {};
  for (const tool of manifest.tools) {
    toolAvailability[tool.toolId] = true;
  }

  return {
    ...manifest,
    sourcePath,
    resolvedDependencies,
    toolAvailability,
  };
}
