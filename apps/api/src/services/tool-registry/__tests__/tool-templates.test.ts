import { describe, expect, it } from 'vitest';

import {
  CLI_COMMAND_TEMPLATE,
  FILE_PROCESSOR_TEMPLATE,
  generateFromTemplate,
  getTemplate,
  getTemplates,
  REST_API_TEMPLATE,
} from '../tool-templates.js';

describe('Tool Templates', () => {
  describe('getTemplates', () => {
    it('returns all 3 built-in templates', () => {
      const templates = getTemplates();
      expect(templates).toHaveLength(3);
      const ids = templates.map((t) => t.id);
      expect(ids).toContain('rest-api-wrapper');
      expect(ids).toContain('cli-command-wrapper');
      expect(ids).toContain('file-processor');
    });

    it('returns a fresh array each time', () => {
      const a = getTemplates();
      const b = getTemplates();
      expect(a).not.toBe(b);
      expect(a).toEqual(b);
    });
  });

  describe('getTemplate', () => {
    it('returns the REST API template by id', () => {
      const t = getTemplate('rest-api-wrapper');
      expect(t).toBeDefined();
      expect(t!.name).toBe('REST API Wrapper');
      expect(t!.mode).toBe('rest-api');
    });

    it('returns the CLI command template by id', () => {
      const t = getTemplate('cli-command-wrapper');
      expect(t).toBeDefined();
      expect(t!.name).toBe('CLI Command Wrapper');
      expect(t!.mode).toBe('cli-command');
    });

    it('returns the file processor template by id', () => {
      const t = getTemplate('file-processor');
      expect(t).toBeDefined();
      expect(t!.name).toBe('File Processor');
      expect(t!.mode).toBe('file-processor');
    });

    it('returns undefined for unknown template', () => {
      expect(getTemplate('nonexistent')).toBeUndefined();
    });
  });

  describe('template constants', () => {
    it('REST_API_TEMPLATE has correct structure', () => {
      expect(REST_API_TEMPLATE.id).toBe('rest-api-wrapper');
      expect(REST_API_TEMPLATE.defaultExecution.mode).toBe('rest-api');
      expect(REST_API_TEMPLATE.defaultParameters.length).toBeGreaterThan(0);
    });

    it('CLI_COMMAND_TEMPLATE has correct structure', () => {
      expect(CLI_COMMAND_TEMPLATE.id).toBe('cli-command-wrapper');
      expect(CLI_COMMAND_TEMPLATE.defaultExecution.mode).toBe('cli-command');
      expect(CLI_COMMAND_TEMPLATE.defaultParameters.some((p) => p.required)).toBe(true);
    });

    it('FILE_PROCESSOR_TEMPLATE has correct structure', () => {
      expect(FILE_PROCESSOR_TEMPLATE.id).toBe('file-processor');
      expect(FILE_PROCESSOR_TEMPLATE.defaultExecution.mode).toBe('file-processor');
    });
  });

  describe('generateFromTemplate', () => {
    it('generates a descriptor from REST API template', () => {
      const desc = generateFromTemplate('rest-api-wrapper', {
        id: 'my-api-tool',
        name: 'My API Tool',
        description: 'Calls my API',
      });

      expect(desc.id).toBe('my-api-tool');
      expect(desc.name).toBe('My API Tool');
      expect(desc.description).toBe('Calls my API');
      expect(desc.version).toBe('1.0.0');
      expect(desc.category).toBe('custom');
      expect(desc.templateId).toBe('rest-api-wrapper');
      expect(desc.execution.mode).toBe('rest-api');
    });

    it('uses default parameters from template when not overridden', () => {
      const desc = generateFromTemplate('cli-command-wrapper', {
        id: 'my-cli-tool',
        name: 'My CLI Tool',
        description: 'Runs a command',
      });

      expect(desc.parameters).toEqual(CLI_COMMAND_TEMPLATE.defaultParameters);
    });

    it('allows overriding parameters', () => {
      const customParams = [
        { name: 'custom', type: 'string' as const, description: 'Custom param', required: true },
      ];
      const desc = generateFromTemplate('cli-command-wrapper', {
        id: 'my-cli-tool',
        name: 'My CLI Tool',
        description: 'Runs a command',
        parameters: customParams,
      });

      expect(desc.parameters).toEqual(customParams);
    });

    it('allows overriding version', () => {
      const desc = generateFromTemplate('rest-api-wrapper', {
        id: 'my-api-tool',
        name: 'My API',
        description: 'desc',
        version: '2.5.0',
      });
      expect(desc.version).toBe('2.5.0');
    });

    it('merges execution overrides with template defaults', () => {
      const desc = generateFromTemplate('rest-api-wrapper', {
        id: 'my-api-tool',
        name: 'My API',
        description: 'desc',
        execution: { url: 'https://custom.com/api' } as never,
      });

      expect(desc.execution.mode).toBe('rest-api');
      expect((desc.execution as { url: string }).url).toBe('https://custom.com/api');
    });

    it('throws for unknown template id', () => {
      expect(() =>
        generateFromTemplate('nonexistent', {
          id: 'tool-aa',
          name: 'Tool',
          description: 'desc',
        }),
      ).toThrow('Unknown template: "nonexistent"');
    });

    it('includes available template names in error message', () => {
      try {
        generateFromTemplate('bad-id', {
          id: 'tool-aa',
          name: 'Tool',
          description: 'desc',
        });
      } catch (e) {
        expect((e as Error).message).toContain('rest-api-wrapper');
        expect((e as Error).message).toContain('cli-command-wrapper');
        expect((e as Error).message).toContain('file-processor');
      }
    });

    it('generates from file-processor template', () => {
      const desc = generateFromTemplate('file-processor', {
        id: 'my-file-tool',
        name: 'File Tool',
        description: 'Processes files',
      });

      expect(desc.execution.mode).toBe('file-processor');
      expect(desc.templateId).toBe('file-processor');
    });
  });
});
