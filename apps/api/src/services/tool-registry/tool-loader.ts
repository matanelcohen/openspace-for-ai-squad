/**
 * Dynamic tool loading from YAML and JSON config files.
 */

import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';

import { parse as parseYaml } from 'yaml';

import { ToolValidator } from './tool-validator.js';
import type { ToolConfigFile, ToolDescriptor } from './types.js';

export class ToolLoader {
  private readonly validator = new ToolValidator();

  /**
   * Load tool descriptors from a YAML or JSON file.
   * Returns validated descriptors and any validation errors.
   */
  async loadFromFile(filePath: string): Promise<{
    tools: ToolDescriptor[];
    errors: Array<{ index: number; error: string }>;
  }> {
    const raw = await readFile(filePath, 'utf-8');
    const ext = extname(filePath).toLowerCase();

    let parsed: unknown;
    if (ext === '.yaml' || ext === '.yml') {
      parsed = parseYaml(raw);
    } else if (ext === '.json') {
      parsed = JSON.parse(raw);
    } else {
      throw new Error(`Unsupported config file format: ${ext} (use .yaml, .yml, or .json)`);
    }

    return this.validateConfig(parsed);
  }

  /**
   * Load tool descriptors from a raw object (already parsed).
   */
  loadFromObject(data: unknown): {
    tools: ToolDescriptor[];
    errors: Array<{ index: number; error: string }>;
  } {
    return this.validateConfig(data);
  }

  // ── Private ─────────────────────────────────────────────────────

  private validateConfig(data: unknown): {
    tools: ToolDescriptor[];
    errors: Array<{ index: number; error: string }>;
  } {
    if (!data || typeof data !== 'object' || !('tools' in data) || !Array.isArray((data as ToolConfigFile).tools)) {
      throw new Error('Config must be an object with a "tools" array');
    }

    const config = data as ToolConfigFile;
    const validTools: ToolDescriptor[] = [];
    const errors: Array<{ index: number; error: string }> = [];

    for (let i = 0; i < config.tools.length; i++) {
      const result = this.validator.validateToolDescriptor(config.tools[i]);
      if (result.valid) {
        validTools.push(config.tools[i]!);
      } else {
        errors.push({
          index: i,
          error: result.errors?.message ?? 'Unknown validation error',
        });
      }
    }

    return { tools: validTools, errors };
  }
}
