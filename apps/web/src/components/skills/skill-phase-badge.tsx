'use client';

import type { SkillPhase } from '@openspace/shared';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const phaseConfig: Record<SkillPhase, { label: string; className: string }> = {
  discovered: {
    label: 'Discovered',
    className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  },
  validated: {
    label: 'Validated',
    className: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  },
  loaded: {
    label: 'Loaded',
    className: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  active: {
    label: 'Active',
    className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  },
  deactivated: {
    label: 'Inactive',
    className: 'bg-gray-100 text-gray-600 dark:bg-gray-800/30 dark:text-gray-400',
  },
  error: {
    label: 'Error',
    className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  },
};

interface SkillPhaseBadgeProps {
  phase: SkillPhase;
  className?: string;
}

export function SkillPhaseBadge({ phase, className }: SkillPhaseBadgeProps) {
  const config = phaseConfig[phase];
  return (
    <Badge
      variant="outline"
      className={cn('border-0 font-medium', config.className, className)}
      data-testid={`skill-phase-${phase}`}
    >
      {config.label}
    </Badge>
  );
}
