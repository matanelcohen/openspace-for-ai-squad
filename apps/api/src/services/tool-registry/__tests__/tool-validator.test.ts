import { describe, expect, it } from 'vitest';

import { ToolValidator } from '../tool-validator.js';
import type { ToolDescriptor } from '../types.js';

function validDescriptor(overrides: Partial<ToolDescriptor> = {}): ToolDescriptor {
  return {
    id: 'test-tool',
    name: 'Test Tool',
    description: 'A test tool',
    version: '1.0.0',
    category: 'custom',
    parameters: [],
    ...overrides,
  };
}

describe('ToolValidator', () => {
  const validator = new ToolValidator();

  describe('validateToolDescriptor', () => {
    it('accepts a valid descriptor with no parameters', () => {
      const result = validator.validateToolDescriptor(validDescriptor());
      expect(result.valid).toBe(true);
      expect(result.errors).toBeUndefined();
    });

    it('accepts a descriptor with parameters', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({
          parameters: [
            { name: 'query', type: 'string', description: 'Search query', required: true },
            { name: 'limit', type: 'number', description: 'Max results' },
          ],
        }),
      );
      expect(result.valid).toBe(true);
    });

    it('accepts all valid categories', () => {
      for (const category of ['git', 'file', 'search', 'api', 'custom'] as const) {
        const result = validator.validateToolDescriptor(validDescriptor({ category }));
        expect(result.valid).toBe(true);
      }
    });

    it('rejects descriptor with missing id', () => {
      const { id, ...noId } = validDescriptor();
      const result = validator.validateToolDescriptor(noId);
      expect(result.valid).toBe(false);
      expect(result.errors?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects descriptor with invalid id pattern', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ id: 'UPPER' }));
      expect(result.valid).toBe(false);
    });

    it('rejects descriptor with invalid version format', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ version: 'v1' }));
      expect(result.valid).toBe(false);
    });

    it('rejects descriptor with invalid category', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({ category: 'invalid' as never }),
      );
      expect(result.valid).toBe(false);
    });

    it('rejects non-object input', () => {
      expect(validator.validateToolDescriptor(null).valid).toBe(false);
      expect(validator.validateToolDescriptor('string').valid).toBe(false);
      expect(validator.validateToolDescriptor(42).valid).toBe(false);
    });

    it('rejects descriptor with additional properties', () => {
      const desc = { ...validDescriptor(), unknownField: true };
      const result = validator.validateToolDescriptor(desc);
      expect(result.valid).toBe(false);
    });

    it('accepts optional timeout and retries within bounds', () => {
      const result = validator.validateToolDescriptor(
        validDescriptor({ timeout: 5000, retries: 3 }),
      );
      expect(result.valid).toBe(true);
    });

    it('rejects timeout below minimum', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ timeout: 10 }));
      expect(result.valid).toBe(false);
    });

    it('rejects retries above maximum', () => {
      const result = validator.validateToolDescriptor(validDescriptor({ retries: 10 }));
      expect(result.valid).toBe(false);
    });
  });

  describe('validateInput', () => {
    const descriptor = validDescriptor({
      parameters: [
        { name: 'query', type: 'string', description: 'Search query', required: true },
        { name: 'limit', type: 'number', description: 'Max results' },
      ],
    });

    it('accepts valid input with all required params', () => {
      const result = validator.validateInput(descriptor, { query: 'hello' });
      expect(result.valid).toBe(true);
    });

    it('accepts valid input with optional params', () => {
      const result = validator.validateInput(descriptor, { query: 'hello', limit: 5 });
      expect(result.valid).toBe(true);
    });

    it('rejects input missing required params', () => {
      const result = validator.validateInput(descriptor, { limit: 5 });
      expect(result.valid).toBe(false);
      expect(result.errors?.code).toBe('VALIDATION_ERROR');
    });

    it('rejects input with wrong param type', () => {
      const result = validator.validateInput(descriptor, { query: 'hello', limit: 'not a number' });
      expect(result.valid).toBe(false);
    });

    it('rejects input with additional properties', () => {
      const result = validator.validateInput(descriptor, { query: 'hello', unknown: true });
      expect(result.valid).toBe(false);
    });

    it('caches compiled validators across calls', () => {
      const r1 = validator.validateInput(descriptor, { query: 'a' });
      const r2 = validator.validateInput(descriptor, { query: 'b' });
      expect(r1.valid).toBe(true);
      expect(r2.valid).toBe(true);
    });
  });

  describe('clearCache', () => {
    it('clears cached input validator for a tool', () => {
      const descriptor = validDescriptor({
        parameters: [{ name: 'x', type: 'string', description: 'test', required: true }],
      });
      // Populate cache
      validator.validateInput(descriptor, { x: 'hello' });
      // Clear it
      validator.clearCache(descriptor.id);
      // Should still work (recompiles)
      const result = validator.validateInput(descriptor, { x: 'world' });
      expect(result.valid).toBe(true);
    });
  });
});
