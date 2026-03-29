/**
 * @openspace/skills-core
 *
 * Reference skill implementations: git-expert, test-runner, code-reviewer.
 * Each skill is a self-contained directory with manifest.json, tools/, and prompts/.
 */

import { existsSync,readdirSync, readFileSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { fileURLToPath } from 'node:url';

import type { SkillManifest } from '@openspace/shared/src/types/skill.js';
import type { Tool } from '@openspace/shared/src/types/tool.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Skill IDs ────────────────────────────────────────────────────

export const SKILL_IDS = ['git-expert', 'test-runner', 'code-reviewer'] as const;
export type CoreSkillId = (typeof SKILL_IDS)[number];

// ── Loaders ──────────────────────────────────────────────────────

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, 'utf-8')) as T;
}

/**
 * Load a skill manifest by ID.
 */
export function loadManifest(skillId: CoreSkillId): SkillManifest {
  const manifestPath = join(__dirname, skillId, 'manifest.json');
  return readJson<SkillManifest>(manifestPath);
}

/**
 * Load all tool definitions for a skill.
 */
export function loadTools(skillId: CoreSkillId): Tool[] {
  const toolsDir = join(__dirname, skillId, 'tools');
  if (!existsSync(toolsDir)) return [];
  return readdirSync(toolsDir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => readJson<Tool>(join(toolsDir, f)));
}

/**
 * Load a prompt template file by skill and prompt filename.
 */
export function loadPrompt(skillId: CoreSkillId, promptFile: string): string {
  const promptPath = join(__dirname, skillId, 'prompts', promptFile);
  return readFileSync(promptPath, 'utf-8');
}

/**
 * Load all prompt template files for a skill.
 * Returns a map of filename → content.
 */
export function loadPrompts(skillId: CoreSkillId): Record<string, string> {
  const promptsDir = join(__dirname, skillId, 'prompts');
  if (!existsSync(promptsDir)) return {};
  const result: Record<string, string> = {};
  for (const f of readdirSync(promptsDir).filter((f) => f.endsWith('.md'))) {
    result[f] = readFileSync(join(promptsDir, f), 'utf-8');
  }
  return result;
}

/**
 * Load all core skill manifests.
 */
export function loadAllManifests(): SkillManifest[] {
  return SKILL_IDS.map(loadManifest);
}

/**
 * Get the filesystem path to a skill's directory.
 */
export function getSkillPath(skillId: CoreSkillId): string {
  return join(__dirname, skillId);
}
