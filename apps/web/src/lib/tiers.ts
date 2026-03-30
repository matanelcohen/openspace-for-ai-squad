/**
 * Response tier utility for client-side tier display.
 * Mirrors the logic in apps/api/src/services/routing/tiers.ts.
 */

import type { ResponseTier } from '@matanelcohen/openspace-shared';

export type { ResponseTier };

export interface TierInfo {
  tier: ResponseTier;
  label: string;
  color: string;
}

const FULL_TIER_KEYWORDS = [
  'refactor',
  'redesign',
  'architecture',
  'migration',
  'overhaul',
  'full-stack',
  'cross-cutting',
  'all agents',
  'entire',
];

const STANDARD_TIER_KEYWORDS = [
  'feature',
  'implement',
  'build',
  'create',
  'integrate',
  'add',
  'update',
  'change',
  'modify',
];

const LIGHTWEIGHT_KEYWORDS = [
  'fix',
  'patch',
  'tweak',
  'adjust',
  'rename',
  'typo',
  'lint',
  'format',
  'style',
];

const TIER_INFO: Record<ResponseTier, { label: string; color: string }> = {
  direct: {
    label: 'Direct',
    color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  },
  lightweight: {
    label: 'Lightweight',
    color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  },
  standard: {
    label: 'Standard',
    color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  },
  full: {
    label: 'Full Squad',
    color: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  },
};

export function selectTier(task: {
  title: string;
  description?: string;
  priority?: string;
}): TierInfo {
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();
  let tier: ResponseTier = 'standard';

  if (task.priority === 'P0') tier = 'full';
  else if (FULL_TIER_KEYWORDS.some((kw) => text.includes(kw))) tier = 'full';
  else if (STANDARD_TIER_KEYWORDS.some((kw) => text.includes(kw))) tier = 'standard';
  else if (LIGHTWEIGHT_KEYWORDS.some((kw) => text.includes(kw))) tier = 'lightweight';

  return { tier, ...TIER_INFO[tier] };
}
