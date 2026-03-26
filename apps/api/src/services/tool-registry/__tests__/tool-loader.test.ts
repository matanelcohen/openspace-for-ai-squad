import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { ToolLoader } from '../tool-loader.js';

const VALID_TOOL = {
  id: 'test-tool',
  name: 'Test Tool',
  description: 'A test tool',
  version: '1.0.0',
  category: 'custom',
  parameters: [],
};

const INVALID_TOOL = {
  id: 'INVALID',
  name: '',
  description: '',
  version: 'bad',
  category: 'nope',
  parameters: [],
};

describe('ToolLoader', () => {
  const loader = new ToolLoader();
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'tool-loader-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  describe('loadFromFile — JSON', () => {
    it('loads valid tools from a JSON file', async () => {
      const file = join(tmpDir, 'tools.json');
      await writeFile(file, JSON.stringify({ tools: [VALID_TOOL] }));

      const result = await loader.loadFromFile(file);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]!.id).toBe('test-tool');
      expect(result.errors).toHaveLength(0);
    });

    it('reports errors for invalid tools in JSON', async () => {
      const file = join(tmpDir, 'tools.json');
      await writeFile(file, JSON.stringify({ tools: [VALID_TOOL, INVALID_TOOL] }));

      const result = await loader.loadFromFile(file);
      expect(result.tools).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]!.index).toBe(1);
    });
  });

  describe('loadFromFile — YAML', () => {
    it('loads valid tools from a YAML file', async () => {
      const file = join(tmpDir, 'tools.yaml');
      const yaml = `tools:\n  - id: test-tool\n    name: Test Tool\n    description: A test tool\n    version: "1.0.0"\n    category: custom\n    parameters: []\n`;
      await writeFile(file, yaml);

      const result = await loader.loadFromFile(file);
      expect(result.tools).toHaveLength(1);
      expect(result.tools[0]!.id).toBe('test-tool');
    });

    it('also accepts .yml extension', async () => {
      const file = join(tmpDir, 'tools.yml');
      const yaml = `tools:\n  - id: test-tool\n    name: Test Tool\n    description: A test tool\n    version: "1.0.0"\n    category: custom\n    parameters: []\n`;
      await writeFile(file, yaml);

      const result = await loader.loadFromFile(file);
      expect(result.tools).toHaveLength(1);
    });
  });

  describe('loadFromFile — errors', () => {
    it('throws on unsupported file format', async () => {
      const file = join(tmpDir, 'tools.toml');
      await writeFile(file, 'hello');

      await expect(loader.loadFromFile(file)).rejects.toThrow('Unsupported config file format');
    });

    it('throws on missing file', async () => {
      await expect(loader.loadFromFile(join(tmpDir, 'nope.json'))).rejects.toThrow();
    });

    it('throws when config has no tools array', async () => {
      const file = join(tmpDir, 'bad.json');
      await writeFile(file, JSON.stringify({ notTools: [] }));

      await expect(loader.loadFromFile(file)).rejects.toThrow('Config must be an object with a "tools" array');
    });

    it('throws when config is not an object', async () => {
      const file = join(tmpDir, 'bad.json');
      await writeFile(file, JSON.stringify([1, 2, 3]));

      await expect(loader.loadFromFile(file)).rejects.toThrow();
    });
  });

  describe('loadFromObject', () => {
    it('loads tools from a plain object', () => {
      const result = loader.loadFromObject({ tools: [VALID_TOOL] });
      expect(result.tools).toHaveLength(1);
      expect(result.errors).toHaveLength(0);
    });

    it('reports invalid tools', () => {
      const result = loader.loadFromObject({ tools: [INVALID_TOOL] });
      expect(result.tools).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('handles mixed valid and invalid', () => {
      const result = loader.loadFromObject({ tools: [VALID_TOOL, INVALID_TOOL, VALID_TOOL] });
      // Two valid tools with same id — loader doesn't deduplicate, that's registry's job
      expect(result.tools).toHaveLength(2);
      expect(result.errors).toHaveLength(1);
    });
  });
});
