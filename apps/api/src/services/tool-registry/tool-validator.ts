/**
 * Tool descriptor and input validation using Ajv.
 */

import Ajv from 'ajv';

import { buildInputSchema, toolDescriptorSchema } from './schemas.js';
import type { ToolDescriptor, ToolError } from './types.js';

export class ToolValidator {
  private readonly ajv: Ajv;
  private readonly validateDescriptor;
  private readonly inputValidators = new Map<string, ReturnType<Ajv['compile']>>();

  constructor() {
    this.ajv = new Ajv({ allErrors: true, strict: false });
    this.validateDescriptor = this.ajv.compile(toolDescriptorSchema);
  }

  /** Validate a tool descriptor against the schema. */
  validateToolDescriptor(descriptor: unknown): { valid: boolean; errors?: ToolError } {
    const valid = this.validateDescriptor(descriptor);
    if (valid) return { valid: true };

    return {
      valid: false,
      errors: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid tool descriptor',
        details: this.validateDescriptor.errors,
      },
    };
  }

  /** Validate input parameters against a tool's parameter schema. */
  validateInput(
    descriptor: ToolDescriptor,
    params: Record<string, unknown>,
  ): { valid: boolean; errors?: ToolError } {
    let validate = this.inputValidators.get(descriptor.id);
    if (!validate) {
      const schema = buildInputSchema(descriptor);
      validate = this.ajv.compile(schema);
      this.inputValidators.set(descriptor.id, validate);
    }

    const valid = validate(params);
    if (valid) return { valid: true };

    return {
      valid: false,
      errors: {
        code: 'VALIDATION_ERROR',
        message: `Invalid parameters for tool "${descriptor.id}"`,
        details: validate.errors,
      },
    };
  }

  /** Clear cached input validator for a specific tool (e.g. on unregister). */
  clearCache(toolId: string): void {
    this.inputValidators.delete(toolId);
  }
}
