/**
 * JSON Schemas for tool descriptor validation (Ajv-compatible).
 */

import type { ToolDescriptor } from './types.js';

/**
 * We use a plain object schema here because ToolDescriptor contains
 * unions and optional fields that don't map cleanly to JSONSchemaType.
 */
export const toolParameterSchema = {
  type: 'object',
  required: ['name', 'type', 'description'],
  properties: {
    name: { type: 'string', minLength: 1 },
    type: { type: 'string', enum: ['string', 'number', 'boolean', 'object', 'array'] },
    description: { type: 'string', minLength: 1 },
    required: { type: 'boolean', nullable: true },
    default: {},
    enum: { type: 'array', nullable: true },
    items: {
      type: 'object',
      nullable: true,
      properties: { type: { type: 'string' } },
    },
    properties: { type: 'object', nullable: true },
  },
  additionalProperties: false,
} as const;

export const toolDescriptorSchema = {
  type: 'object',
  required: ['id', 'name', 'description', 'version', 'category', 'parameters'],
  properties: {
    id: { type: 'string', pattern: '^[a-z][a-z0-9-]{1,62}[a-z0-9]$' },
    name: { type: 'string', minLength: 1, maxLength: 128 },
    description: { type: 'string', minLength: 1, maxLength: 1024 },
    version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
    category: { type: 'string', enum: ['git', 'file', 'search', 'api', 'custom'] },
    parameters: { type: 'array', items: toolParameterSchema },
    timeout: { type: 'number', minimum: 100, maximum: 300_000, nullable: true },
    retries: { type: 'integer', minimum: 0, maximum: 5, nullable: true },
    metadata: { type: 'object', nullable: true },
    // CustomToolDescriptor extensions — optional so base ToolDescriptor still works
    execution: { type: 'object', nullable: true },
    templateId: { type: 'string', nullable: true },
  },
  additionalProperties: false,
} as const;

/** Build a JSON Schema for validating tool input params at runtime. */
export function buildInputSchema(descriptor: ToolDescriptor): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of descriptor.parameters) {
    const prop: Record<string, unknown> = { type: param.type };
    if (param.enum) prop.enum = param.enum;
    if (param.items) prop.items = param.items;
    if (param.properties) prop.properties = param.properties;
    properties[param.name] = prop;
    if (param.required) required.push(param.name);
  }

  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  };
}
