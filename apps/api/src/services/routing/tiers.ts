/**
 * Response Tiers — control how many agents and which model tier
 * are used for a given task based on its complexity.
 */

import type { ResponseTier } from '@matanelcohen/openspace-shared';

export type { ResponseTier };

export interface TierDefinition {
  maxAgents: number;
  parallel: boolean;
  defaultModel: string;
  description: string;
}

export const TIERS: Record<ResponseTier, TierDefinition> = {
  direct: {
    maxAgents: 1,
    parallel: false,
    defaultModel: 'fast',
    description: 'Single agent, quick response',
  },
  lightweight: {
    maxAgents: 1,
    parallel: false,
    defaultModel: 'standard',
    description: 'Single agent with tools',
  },
  standard: {
    maxAgents: 2,
    parallel: true,
    defaultModel: 'standard',
    description: 'Multi-agent coordination',
  },
  full: {
    maxAgents: 4,
    parallel: true,
    defaultModel: 'premium',
    description: 'Full squad mobilization',
  },
};

// Keywords that suggest higher complexity / more agents
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

/**
 * Select an appropriate response tier based on task metadata.
 * Uses simple keyword matching on title and description.
 */
export function selectTier(task: {
  title: string;
  description?: string;
  priority?: string;
}): ResponseTier {
  const text = `${task.title} ${task.description ?? ''}`.toLowerCase();

  // P0 tasks always get full squad attention
  if (task.priority === 'P0') return 'full';

  if (FULL_TIER_KEYWORDS.some((kw) => text.includes(kw))) return 'full';
  if (STANDARD_TIER_KEYWORDS.some((kw) => text.includes(kw))) return 'standard';
  if (LIGHTWEIGHT_KEYWORDS.some((kw) => text.includes(kw))) return 'lightweight';

  // Default to standard for anything else
  return 'standard';
}

/** Get the tier definition for a given tier name. */
export function getTierDefinition(tier: ResponseTier): TierDefinition {
  return TIERS[tier];
}
