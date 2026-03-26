import type { ModelPriceEntry, ModelPriceTable } from './types.js';

/** Default price table — common models as of early 2025. */
export const DEFAULT_PRICE_TABLE: ModelPriceTable = [
  { model: 'gpt-4o', promptPricePer1k: 0.005, completionPricePer1k: 0.015 },
  { model: 'gpt-4o-mini', promptPricePer1k: 0.00015, completionPricePer1k: 0.0006 },
  { model: 'gpt-4-turbo', promptPricePer1k: 0.01, completionPricePer1k: 0.03 },
  { model: 'gpt-4', promptPricePer1k: 0.03, completionPricePer1k: 0.06 },
  { model: 'gpt-3.5-turbo', promptPricePer1k: 0.0005, completionPricePer1k: 0.0015 },
  {
    model: 'claude-3-opus',
    promptPricePer1k: 0.015,
    completionPricePer1k: 0.075,
  },
  {
    model: 'claude-3-sonnet',
    promptPricePer1k: 0.003,
    completionPricePer1k: 0.015,
  },
  {
    model: 'claude-3-haiku',
    promptPricePer1k: 0.00025,
    completionPricePer1k: 0.00125,
  },
] as const;

/**
 * Look up a model's price entry. Supports exact match and prefix match
 * (e.g., "gpt-4o-2024-05-13" matches "gpt-4o").
 */
export function findPriceEntry(
  model: string,
  priceTable: ModelPriceTable,
): ModelPriceEntry | undefined {
  // Exact match first
  const exact = priceTable.find((e) => e.model === model);
  if (exact) return exact;

  // Prefix match (longest prefix wins)
  let best: ModelPriceEntry | undefined;
  for (const entry of priceTable) {
    if (model.startsWith(entry.model)) {
      if (!best || entry.model.length > best.model.length) {
        best = entry;
      }
    }
  }
  return best;
}

/**
 * Calculate cost in USD for a given model and token counts.
 * Returns undefined if the model is not in the price table.
 */
export function calculateCost(
  model: string,
  promptTokens: number,
  completionTokens: number,
  priceTable: ModelPriceTable = DEFAULT_PRICE_TABLE,
): number | undefined {
  const entry = findPriceEntry(model, priceTable);
  if (!entry) return undefined;

  const promptCost = (promptTokens / 1000) * entry.promptPricePer1k;
  const completionCost = (completionTokens / 1000) * entry.completionPricePer1k;

  // Round to 8 decimal places to avoid floating-point noise
  return Math.round((promptCost + completionCost) * 1e8) / 1e8;
}
