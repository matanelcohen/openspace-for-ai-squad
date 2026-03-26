import { describe, expect, it } from 'vitest';

import {
  calculateCost,
  DEFAULT_PRICE_TABLE,
  findPriceEntry,
} from '../cost-calculator.js';
import type { ModelPriceTable } from '../types.js';

describe('cost-calculator', () => {
  describe('findPriceEntry', () => {
    it('finds exact match', () => {
      const entry = findPriceEntry('gpt-4o', DEFAULT_PRICE_TABLE);
      expect(entry).toBeDefined();
      expect(entry!.model).toBe('gpt-4o');
    });

    it('finds prefix match for versioned model names', () => {
      const entry = findPriceEntry('gpt-4o-2024-05-13', DEFAULT_PRICE_TABLE);
      expect(entry).toBeDefined();
      expect(entry!.model).toBe('gpt-4o');
    });

    it('prefers longest prefix match', () => {
      const entry = findPriceEntry('gpt-4o-mini-2024', DEFAULT_PRICE_TABLE);
      expect(entry).toBeDefined();
      expect(entry!.model).toBe('gpt-4o-mini');
    });

    it('returns undefined for unknown models', () => {
      const entry = findPriceEntry('unknown-model', DEFAULT_PRICE_TABLE);
      expect(entry).toBeUndefined();
    });
  });

  describe('calculateCost', () => {
    it('calculates cost for gpt-4o', () => {
      // 1000 prompt tokens * $0.005/1k = $0.005
      // 500 completion tokens * $0.015/1k = $0.0075
      // Total = $0.0125
      const cost = calculateCost('gpt-4o', 1000, 500);
      expect(cost).toBe(0.0125);
    });

    it('calculates cost for zero tokens', () => {
      const cost = calculateCost('gpt-4o', 0, 0);
      expect(cost).toBe(0);
    });

    it('returns undefined for unknown model', () => {
      const cost = calculateCost('imaginary-model', 100, 100);
      expect(cost).toBeUndefined();
    });

    it('uses custom price table', () => {
      const customTable: ModelPriceTable = [
        { model: 'my-model', promptPricePer1k: 0.01, completionPricePer1k: 0.02 },
      ];
      // 2000 prompt * 0.01/1k = 0.02, 1000 completion * 0.02/1k = 0.02
      const cost = calculateCost('my-model', 2000, 1000, customTable);
      expect(cost).toBe(0.04);
    });

    it('handles claude models', () => {
      const cost = calculateCost('claude-3-sonnet', 1000, 1000);
      // 1000 * 0.003/1k + 1000 * 0.015/1k = 0.003 + 0.015 = 0.018
      expect(cost).toBe(0.018);
    });
  });
});
