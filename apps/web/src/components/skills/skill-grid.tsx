'use client';

import { Puzzle } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import type { SkillSummary } from '@/hooks/use-skills';

import { SkillCard } from './skill-card';

interface SkillGridProps {
  skills?: SkillSummary[];
  isLoading: boolean;
}

export function SkillGrid({ skills, isLoading }: SkillGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="skill-grid-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    );
  }

  if (!skills?.length) {
    return (
      <EmptyState
        icon={Puzzle}
        title="No skills found"
        description="No skills match your current filters. Try adjusting your search or browse all available skills."
        data-testid="skill-grid-empty"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="skill-grid">
      {skills.map((skill) => (
        <SkillCard key={skill.id} skill={skill} />
      ))}
    </div>
  );
}
