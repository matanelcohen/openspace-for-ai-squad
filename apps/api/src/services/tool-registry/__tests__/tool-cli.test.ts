import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  addCommand,
  addFromTemplateCommand,
  executeCliCommand,
  initCommand,
  inspectCommand,
  listCommand,
  removeCommand,
  templatesCommand,
} from '../cli/tool-cli.js';
import { CustomToolManager } from '../custom-tool-manager.js';
import { ToolRegistry } from '../tool-registry.js';
import type { CustomToolDescriptor } from '../types.js';

// ── Helpers ────────────────────────────────────────────────────────

function makeCustomTool(overrides: Partial<CustomToolDescriptor> = {}): CustomToolDescriptor {
  return {
    id: 'cli-test-tool',
    name: 'CLI Test Tool',
    description: 'A tool for CLI testing',
    version: '1.0.0',
    category: 'custom',
    parameters: [{ name: 'input', type: 'string', description: 'Input value', required: true }],
    execution: {
      mode: 'cli-command',
      command: 'echo',
      args: ['{{input}}'],
      parseOutput: 'text',
    },
    ...overrides,
  };
}

// ── Tests ──────────────────────────────────────────────────────────

describe('Tool CLI', () => {
  let tmpDir: string;
  let manager: CustomToolManager;
  let registry: ToolRegistry;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cli-test-'));
    registry = new ToolRegistry();
    manager = new CustomToolManager({
      configPath: join(tmpDir, 'tools.config.yaml'),
      watchEnabled: false,
    });
    await manager.start(registry);
  });

  afterEach(async () => {
    await manager.stop();
    await registry.shutdown();
    await rm(tmpDir, { recursive: true, force: true });
  });

  // ── Individual commands ──────────────────────────────────────────

  describe('initCommand', () => {
    it('creates a new config file', async () => {
      const result = await initCommand(manager);
      expect(result.success).toBe(true);
      expect(result.message).toContain('Created');
    });

    it('fails when config already exists', async () => {
      await initCommand(manager); // first creates it
      const result = await initCommand(manager); // second should fail
      expect(result.success).toBe(false);
      expect(result.message).toContain('already exists');
    });
  });

  describe('listCommand', () => {
    it('returns empty list message when no tools', () => {
      const result = listCommand(manager);
      expect(result.success).toBe(true);
      expect(result.message).toContain('No custom tools');
      expect(result.data).toEqual([]);
    });

    it('lists registered tools', async () => {
      await manager.addTool(makeCustomTool({ id: 'tool-aa' }));
      await manager.addTool(makeCustomTool({ id: 'tool-bb' }));

      const result = listCommand(manager);
      expect(result.success).toBe(true);
      expect(result.message).toContain('tool-aa');
      expect(result.message).toContain('tool-bb');
      expect(result.message).toContain('2');
      expect((result.data as unknown[]).length).toBe(2);
    });
  });

  describe('addCommand', () => {
    it('adds a valid tool', async () => {
      const result = await addCommand(manager, makeCustomTool());
      expect(result.success).toBe(true);
      expect(result.message).toContain('Added tool');
    });

    it('fails for invalid tool descriptor', async () => {
      const result = await addCommand(manager, makeCustomTool({ id: 'INVALID' }));
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed to add');
    });
  });

  describe('addFromTemplateCommand', () => {
    it('adds a tool from template', async () => {
      const result = await addFromTemplateCommand(manager, 'cli-command-wrapper', {
        id: 'from-template',
        name: 'From Template',
        description: 'Created from template',
      });
      expect(result.success).toBe(true);
      expect(result.message).toContain('from-template');
      expect(result.message).toContain('cli-command-wrapper');
      expect(result.data).toBeDefined();
    });

    it('fails for unknown template', async () => {
      const result = await addFromTemplateCommand(manager, 'nonexistent', {
        id: 'tool-aa',
        name: 'Tool',
        description: 'desc',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Failed');
    });
  });

  describe('removeCommand', () => {
    it('removes an existing tool', async () => {
      await manager.addTool(makeCustomTool());
      const result = await removeCommand(manager, 'cli-test-tool');
      expect(result.success).toBe(true);
      expect(result.message).toContain('Removed');
    });

    it('fails for nonexistent tool', async () => {
      const result = await removeCommand(manager, 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  describe('templatesCommand', () => {
    it('lists available templates', () => {
      const result = templatesCommand(manager);
      expect(result.success).toBe(true);
      expect(result.message).toContain('rest-api-wrapper');
      expect(result.message).toContain('cli-command-wrapper');
      expect(result.message).toContain('file-processor');
      expect((result.data as unknown[]).length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('inspectCommand', () => {
    it('shows tool details', async () => {
      await manager.addTool(makeCustomTool());
      const result = inspectCommand(manager, 'cli-test-tool');

      expect(result.success).toBe(true);
      expect(result.message).toContain('CLI Test Tool');
      expect(result.message).toContain('cli-command');
      expect(result.message).toContain('1.0.0');
      expect(result.data).toBeDefined();
    });

    it('shows template info when tool has templateId', async () => {
      await manager.addToolFromTemplate('rest-api-wrapper', {
        id: 'api-from-tmpl',
        name: 'API Tool',
        description: 'From template',
      });
      const result = inspectCommand(manager, 'api-from-tmpl');
      expect(result.message).toContain('rest-api-wrapper');
    });

    it('shows parameter details', async () => {
      await manager.addTool(makeCustomTool());
      const result = inspectCommand(manager, 'cli-test-tool');
      expect(result.message).toContain('input');
      expect(result.message).toContain('required');
    });

    it('fails for nonexistent tool', () => {
      const result = inspectCommand(manager, 'nonexistent');
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  // ── CLI Router (executeCliCommand) ───────────────────────────────

  describe('executeCliCommand — router', () => {
    it('routes init command', async () => {
      const result = await executeCliCommand(manager, { command: 'init' });
      expect(result.success).toBe(true);
    });

    it('routes list command', async () => {
      const result = await executeCliCommand(manager, { command: 'list' });
      expect(result.success).toBe(true);
    });

    it('routes add command with descriptor', async () => {
      const result = await executeCliCommand(manager, {
        command: 'add',
        descriptor: makeCustomTool(),
      });
      expect(result.success).toBe(true);
    });

    it('fails add command without descriptor', async () => {
      const result = await executeCliCommand(manager, { command: 'add' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing tool descriptor');
    });

    it('routes add-from-template command', async () => {
      const result = await executeCliCommand(manager, {
        command: 'add-from-template',
        templateId: 'cli-command-wrapper',
        overrides: {
          id: 'new-cli-tool',
          name: 'New CLI',
          description: 'desc',
        },
      });
      expect(result.success).toBe(true);
    });

    it('fails add-from-template without templateId', async () => {
      const result = await executeCliCommand(manager, {
        command: 'add-from-template',
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing templateId');
    });

    it('routes remove command', async () => {
      await manager.addTool(makeCustomTool());
      const result = await executeCliCommand(manager, {
        command: 'remove',
        toolId: 'cli-test-tool',
      });
      expect(result.success).toBe(true);
    });

    it('fails remove command without toolId', async () => {
      const result = await executeCliCommand(manager, { command: 'remove' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing toolId');
    });

    it('routes templates command', async () => {
      const result = await executeCliCommand(manager, { command: 'templates' });
      expect(result.success).toBe(true);
    });

    it('routes inspect command', async () => {
      await manager.addTool(makeCustomTool());
      const result = await executeCliCommand(manager, {
        command: 'inspect',
        toolId: 'cli-test-tool',
      });
      expect(result.success).toBe(true);
    });

    it('fails inspect command without toolId', async () => {
      const result = await executeCliCommand(manager, { command: 'inspect' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Missing toolId');
    });

    it('handles unknown command', async () => {
      const result = await executeCliCommand(manager, {
        command: 'unknown' as never,
      });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Unknown command');
    });
  });
});
