/**
 * Squad Config Loader — loads typed configuration from squad.config.ts.
 *
 * Priority:
 * 1. Try dynamic import of squad.config.ts from the project root
 * 2. Fall back to building config from .squad/ files + .env
 * 3. Return typed SquadSDKConfig
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { AgentDefinition, SquadSDKConfig, TeamDefinition } from '@openspace/shared';

export interface LoadConfigOptions {
  /** Working directory to search for squad.config.ts (defaults to cwd). */
  rootDir?: string;
  /** .squad/ directory for fallback config loading. */
  squadDir?: string;
}

/** Cached config to avoid re-importing on every call. */
let cachedConfig: SquadSDKConfig | null = null;

/**
 * Load the squad configuration, trying squad.config.ts first,
 * then falling back to .squad/ files + env vars.
 */
export async function loadSquadConfig(
  opts: LoadConfigOptions = {},
): Promise<SquadSDKConfig | null> {
  if (cachedConfig) return cachedConfig;

  const rootDir = opts.rootDir ?? process.cwd();

  // Try loading squad.config.ts via dynamic import
  const config = await tryLoadConfigFile(rootDir);
  if (config) {
    cachedConfig = config;
    console.log('[Config] Loaded squad.config.ts');
    return config;
  }

  // Fall back to building config from .squad/ directory
  const squadDir = opts.squadDir ?? resolve(rootDir, process.env.SQUAD_DIR ?? '.squad');
  const fallback = buildConfigFromSquadDir(squadDir);
  if (fallback) {
    cachedConfig = fallback;
    console.log('[Config] Built config from .squad/ files');
    return fallback;
  }

  console.log('[Config] No squad.config.ts or .squad/ config found — using defaults');
  return null;
}

/** Reset cached config (useful for testing). */
export function resetConfigCache(): void {
  cachedConfig = null;
}

/**
 * Try to dynamically import squad.config.ts from the given directory.
 * Looks for both .ts and compiled .js variants.
 */
async function tryLoadConfigFile(rootDir: string): Promise<SquadSDKConfig | null> {
  // Candidate paths in priority order
  const candidates = [
    join(rootDir, 'squad.config.ts'),
    join(rootDir, 'squad.config.js'),
    join(rootDir, 'squad.config.mjs'),
  ];

  for (const configPath of candidates) {
    if (!existsSync(configPath)) continue;

    try {
      const fileUrl = pathToFileURL(configPath).href;
      const mod = await import(fileUrl);
      const config = mod.default ?? mod;

      if (config && typeof config === 'object' && 'team' in config && 'agents' in config) {
        return config as SquadSDKConfig;
      }
    } catch (err) {
      console.warn(`[Config] Failed to import ${configPath}:`, err);
    }
  }

  return null;
}

/**
 * Build a SquadSDKConfig from .squad/ directory files.
 * This is the fallback when no squad.config.ts exists.
 */
function buildConfigFromSquadDir(squadDir: string): SquadSDKConfig | null {
  if (!existsSync(squadDir)) return null;

  const agents: AgentDefinition[] = [];
  const team: TeamDefinition = {
    name: 'squad',
    members: [],
  };

  // Try reading config.json for model settings
  const configPath = join(squadDir, 'config.json');
  let defaultModel = process.env.OPENSPACE_MODEL ?? 'claude-opus-4.6';

  if (existsSync(configPath)) {
    try {
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as Record<string, unknown>;
      if (typeof raw.defaultModel === 'string') {
        defaultModel = raw.defaultModel;
      }
    } catch {
      /* ignore parse errors */
    }
  }

  // Scan agents/ subdirectories for agent definitions
  const agentsDir = join(squadDir, 'agents');
  if (existsSync(agentsDir)) {
    const dirs = readdirSync(agentsDir, { withFileTypes: true }).filter((d) => d.isDirectory());
    for (const dir of dirs) {
      const charterPath = join(agentsDir, dir.name, 'charter.md');
      let role = 'Agent';
      if (existsSync(charterPath)) {
        const charter = readFileSync(charterPath, 'utf-8');
        const roleMatch = charter.match(/##\s*Identity[\s\S]*?Role:\s*(.+)/i);
        if (roleMatch) role = roleMatch[1].trim();
      }
      agents.push({ name: dir.name, role, model: defaultModel });
      team.members.push(`@${dir.name}`);
    }
  }

  if (agents.length === 0) return null;

  return {
    team,
    agents,
    models: { default: defaultModel },
  };
}
