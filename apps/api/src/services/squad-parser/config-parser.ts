/**
 * config-parser.ts — Parses .squad/config.json into a structured config object.
 *
 * The raw config.json contains squad-level configuration (version, allowed models, etc.).
 * This parser reads it and returns a typed object, falling back to defaults on failure.
 */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/** Raw shape of .squad/config.json. */
export interface RawSquadConfig {
  version: number;
  allowedModels: string[];
  defaultModel: string;
}

/** Default config when file is missing or unparseable. */
const DEFAULT_CONFIG: RawSquadConfig = {
  version: 1,
  allowedModels: [],
  defaultModel: '',
};

/**
 * Parse .squad/config.json and return a typed config object.
 * Returns defaults if the file is missing or malformed.
 */
export async function parseConfigFile(squadDir: string): Promise<RawSquadConfig> {
  const filePath = join(squadDir, 'config.json');
  let content: string;
  try {
    content = await readFile(filePath, 'utf-8');
  } catch {
    return { ...DEFAULT_CONFIG };
  }

  return parseConfigContent(content);
}

/**
 * Parse config.json content string into RawSquadConfig.
 * Exported for testing.
 */
export function parseConfigContent(content: string): RawSquadConfig {
  try {
    const parsed = JSON.parse(content);
    return {
      version: typeof parsed.version === 'number' ? parsed.version : DEFAULT_CONFIG.version,
      allowedModels: Array.isArray(parsed.allowedModels)
        ? parsed.allowedModels.filter((m: unknown) => typeof m === 'string')
        : DEFAULT_CONFIG.allowedModels,
      defaultModel:
        typeof parsed.defaultModel === 'string'
          ? parsed.defaultModel
          : DEFAULT_CONFIG.defaultModel,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}
