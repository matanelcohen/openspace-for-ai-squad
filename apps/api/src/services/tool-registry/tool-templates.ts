/**
 * Pre-built templates for common custom tool patterns.
 *
 * Each template provides a scaffold that users can customize
 * for their specific use case.
 */

import type {
  CliCommandExecution,
  CustomToolDescriptor,
  CustomToolExecution,
  FileProcessorExecution,
  RestApiExecution,
  ToolParameter,
  ToolTemplate,
} from './types.js';

// ── Built-in templates ─────────────────────────────────────────

export const REST_API_TEMPLATE: ToolTemplate = {
  id: 'rest-api-wrapper',
  name: 'REST API Wrapper',
  description: 'Wraps an HTTP endpoint as a tool. Supports all HTTP methods, custom headers, and body templates.',
  mode: 'rest-api',
  defaultExecution: {
    mode: 'rest-api',
    url: 'https://api.example.com/endpoint',
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  } satisfies RestApiExecution,
  defaultParameters: [
    { name: 'url', type: 'string', description: 'Request URL (overrides default)', required: false },
    { name: 'body', type: 'object', description: 'Request body', required: false },
  ],
};

export const CLI_COMMAND_TEMPLATE: ToolTemplate = {
  id: 'cli-command-wrapper',
  name: 'CLI Command Wrapper',
  description: 'Wraps a shell command as a tool. Supports argument templating, env vars, and output parsing.',
  mode: 'cli-command',
  defaultExecution: {
    mode: 'cli-command',
    command: 'echo',
    args: ['{{input}}'],
    parseOutput: 'text',
  } satisfies CliCommandExecution,
  defaultParameters: [
    { name: 'input', type: 'string', description: 'Input to pass to the command', required: true },
  ],
};

export const FILE_PROCESSOR_TEMPLATE: ToolTemplate = {
  id: 'file-processor',
  name: 'File Processor',
  description: 'Reads, writes, transforms, or globs files. Supports inline JS transforms.',
  mode: 'file-processor',
  defaultExecution: {
    mode: 'file-processor',
    operation: 'read',
  } satisfies FileProcessorExecution,
  defaultParameters: [
    { name: 'path', type: 'string', description: 'File path to process', required: true },
  ],
};

// ── Template registry ──────────────────────────────────────────

const TEMPLATES = new Map<string, ToolTemplate>([
  [REST_API_TEMPLATE.id, REST_API_TEMPLATE],
  [CLI_COMMAND_TEMPLATE.id, CLI_COMMAND_TEMPLATE],
  [FILE_PROCESSOR_TEMPLATE.id, FILE_PROCESSOR_TEMPLATE],
]);

/** Get all available templates. */
export function getTemplates(): ToolTemplate[] {
  return [...TEMPLATES.values()];
}

/** Get a template by id. */
export function getTemplate(id: string): ToolTemplate | undefined {
  return TEMPLATES.get(id);
}

/**
 * Generate a CustomToolDescriptor from a template.
 *
 * Merges user-provided overrides with the template defaults.
 */
export function generateFromTemplate(
  templateId: string,
  overrides: {
    id: string;
    name: string;
    description: string;
    version?: string;
    execution?: Partial<CustomToolExecution>;
    parameters?: ToolParameter[];
  },
): CustomToolDescriptor {
  const template = TEMPLATES.get(templateId);
  if (!template) {
    throw new Error(`Unknown template: "${templateId}". Available: ${[...TEMPLATES.keys()].join(', ')}`);
  }

  const execution: CustomToolExecution = {
    ...template.defaultExecution,
    ...(overrides.execution ?? {}),
  } as CustomToolExecution;

  return {
    id: overrides.id,
    name: overrides.name,
    description: overrides.description,
    version: overrides.version ?? '1.0.0',
    category: 'custom',
    parameters: overrides.parameters ?? template.defaultParameters,
    execution,
    templateId,
  };
}
