import { afterEach, describe, expect, it, vi } from 'vitest';

import { calculateCost, DEFAULT_PRICE_TABLE, findPriceEntry } from '../cost-calculator.js';
import type { ModelPriceTable } from '../types.js';

describe('Cost Calculator — edge cases', () => {
  describe('zero tokens', () => {
    it('returns 0 cost for zero prompt and completion tokens', () => {
      const cost = calculateCost('gpt-4o', 0, 0);
      expect(cost).toBe(0);
    });

    it('returns cost only from completion when prompt is 0', () => {
      const cost = calculateCost('gpt-4o', 0, 1000);
      const entry = findPriceEntry('gpt-4o', DEFAULT_PRICE_TABLE)!;
      expect(cost).toBe(entry.completionPricePer1k);
    });

    it('returns cost only from prompt when completion is 0', () => {
      const cost = calculateCost('gpt-4o', 1000, 0);
      const entry = findPriceEntry('gpt-4o', DEFAULT_PRICE_TABLE)!;
      expect(cost).toBe(entry.promptPricePer1k);
    });
  });

  describe('very large token counts', () => {
    it('computes correct cost for 1M tokens', () => {
      const cost = calculateCost('gpt-4o', 1_000_000, 1_000_000);
      const entry = findPriceEntry('gpt-4o', DEFAULT_PRICE_TABLE)!;
      const expected =
        (1_000_000 / 1000) * entry.promptPricePer1k +
        (1_000_000 / 1000) * entry.completionPricePer1k;
      expect(cost).toBe(Math.round(expected * 1e8) / 1e8);
    });

    it('handles 100M tokens without overflow', () => {
      const cost = calculateCost('gpt-3.5-turbo', 100_000_000, 100_000_000);
      expect(cost).toBeDefined();
      expect(cost).toBeGreaterThan(0);
      expect(Number.isFinite(cost)).toBe(true);
    });
  });

  describe('unknown model', () => {
    it('returns undefined for completely unknown model', () => {
      const cost = calculateCost('llama-3-70b', 100, 100);
      expect(cost).toBeUndefined();
    });

    it('findPriceEntry returns undefined for unknown model', () => {
      expect(findPriceEntry('mistral-large', DEFAULT_PRICE_TABLE)).toBeUndefined();
    });
  });

  describe('prefix matching', () => {
    it('matches versioned model names to base model', () => {
      const entry = findPriceEntry('gpt-4o-2024-08-06', DEFAULT_PRICE_TABLE);
      expect(entry).toBeDefined();
      expect(entry!.model).toBe('gpt-4o');
    });

    it('matches gpt-4-turbo-preview to gpt-4-turbo', () => {
      const entry = findPriceEntry('gpt-4-turbo-preview', DEFAULT_PRICE_TABLE);
      expect(entry).toBeDefined();
      expect(entry!.model).toBe('gpt-4-turbo');
    });

    it('longest prefix wins: gpt-4o-mini-2024 matches gpt-4o-mini not gpt-4o', () => {
      const entry = findPriceEntry('gpt-4o-mini-2024-07-18', DEFAULT_PRICE_TABLE);
      expect(entry).toBeDefined();
      expect(entry!.model).toBe('gpt-4o-mini');
    });

    it('claude-3-sonnet-20240229 matches claude-3-sonnet', () => {
      const entry = findPriceEntry('claude-3-sonnet-20240229', DEFAULT_PRICE_TABLE);
      expect(entry).toBeDefined();
      expect(entry!.model).toBe('claude-3-sonnet');
    });
  });

  describe('custom price table', () => {
    const customTable: ModelPriceTable = [
      { model: 'custom-model', promptPricePer1k: 0.1, completionPricePer1k: 0.2 },
      { model: 'free-model', promptPricePer1k: 0, completionPricePer1k: 0 },
    ];

    it('uses custom table for cost calculation', () => {
      const cost = calculateCost('custom-model', 2000, 1000, customTable);
      // (2000/1000)*0.1 + (1000/1000)*0.2 = 0.2 + 0.2 = 0.4
      expect(cost).toBe(0.4);
    });

    it('returns 0 for free model', () => {
      const cost = calculateCost('free-model', 10000, 5000, customTable);
      expect(cost).toBe(0);
    });

    it('returns undefined if model not in custom table', () => {
      const cost = calculateCost('gpt-4o', 100, 100, customTable);
      expect(cost).toBeUndefined();
    });
  });

  describe('floating-point precision', () => {
    it('avoids floating-point noise via 8-decimal rounding', () => {
      // 0.1 + 0.2 would be 0.30000000000000004 without rounding
      const table: ModelPriceTable = [
        { model: 'precise-model', promptPricePer1k: 0.1, completionPricePer1k: 0.2 },
      ];
      const cost = calculateCost('precise-model', 1000, 1000, table);
      // Should be exactly 0.3, not 0.30000000000000004
      expect(cost).toBe(0.3);
    });

    it('handles very small costs accurately', () => {
      // gpt-4o-mini: prompt=0.00015, completion=0.0006
      const cost = calculateCost('gpt-4o-mini', 1, 1);
      // (1/1000)*0.00015 + (1/1000)*0.0006 = 0.00000015 + 0.0000006 = 0.00000075
      expect(cost).toBe(0.00000075);
    });
  });

  describe('DEFAULT_PRICE_TABLE integrity', () => {
    it('contains entries for all major models', () => {
      const expectedModels = [
        'gpt-4o',
        'gpt-4o-mini',
        'gpt-4-turbo',
        'gpt-4',
        'gpt-3.5-turbo',
        'claude-3-opus',
        'claude-3-sonnet',
        'claude-3-haiku',
      ];
      for (const model of expectedModels) {
        expect(findPriceEntry(model, DEFAULT_PRICE_TABLE)).toBeDefined();
      }
    });

    it('all prices are non-negative', () => {
      for (const entry of DEFAULT_PRICE_TABLE) {
        expect(entry.promptPricePer1k).toBeGreaterThanOrEqual(0);
        expect(entry.completionPricePer1k).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
