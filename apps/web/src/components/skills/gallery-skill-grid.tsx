'use client';

import { Sparkles } from 'lucide-react';

import { EmptyState } from '@/components/ui/empty-state';
import { SkeletonCard } from '@/components/ui/skeleton-card';
import type { GallerySkillItem } from '@/hooks/use-skill-gallery';

import { GallerySkillCard } from './gallery-skill-card';

interface GallerySkillGridProps {
  skills?: GallerySkillItem[];
  isLoading: boolean;
  installedIds?: Set<string>;
}

export function GallerySkillGrid({ skills, isLoading, installedIds }: GallerySkillGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="gallery-grid-loading">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    );
  }

  if (!skills?.length) {
    return (
      <EmptyState
        icon={Sparkles}
        title="No gallery skills found"
        description="No skills match your current filters. Try adjusting your search or browse all categories."
        data-testid="gallery-grid-empty"
      />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" data-testid="gallery-grid">
      {skills.map((skill) => (
        <GallerySkillCard key={skill.id} skill={skill} isInstalled={installedIds?.has(skill.id)} />
      ))}
    </div>
  );
}
