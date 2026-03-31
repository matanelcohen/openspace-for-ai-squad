'use client';

import { Star } from 'lucide-react';

import { SkeletonCard } from '@/components/ui/skeleton-card';
import { useGalleryFeatured } from '@/hooks/use-skill-gallery';

import { GallerySkillCard } from './gallery-skill-card';

interface GalleryFeaturedSectionProps {
  installedIds?: Set<string>;
}

export function GalleryFeaturedSection({ installedIds }: GalleryFeaturedSectionProps) {
  const { data, isLoading } = useGalleryFeatured(6);
  const skills = data?.skills;

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="gallery-featured-loading">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-yellow-500" />
          <h2 className="text-lg font-semibold">Featured</h2>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="w-[320px] shrink-0">
              <SkeletonCard lines={2} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!skills?.length) return null;

  return (
    <div className="space-y-3" data-testid="gallery-featured-section">
      <div className="flex items-center gap-2">
        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
        <h2 className="text-lg font-semibold">Featured</h2>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2">
        {skills.map((skill) => (
          <div key={skill.id} className="w-[320px] shrink-0">
            <GallerySkillCard skill={skill} isInstalled={installedIds?.has(skill.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
