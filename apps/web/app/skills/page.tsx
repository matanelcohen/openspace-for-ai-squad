'use client';

import type { GalleryCategory, SkillPhase } from '@matanelcohen/openspace-shared';
import { RefreshCw, Search, Store } from 'lucide-react';
import { useMemo, useState } from 'react';

import { GalleryCategoryNav } from '@/components/skills/gallery-category-nav';
import { GalleryFeaturedSection } from '@/components/skills/gallery-featured-section';
import { GallerySkillGrid } from '@/components/skills/gallery-skill-grid';
import { SkillFiltersToolbar } from '@/components/skills/skill-filters-toolbar';
import { SkillFormDialog } from '@/components/skills/skill-form-dialog';
import { SkillGrid } from '@/components/skills/skill-grid';
import { SkillImportDialog } from '@/components/skills/skill-import-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  type GallerySearchFilters,
  useGalleryCategories,
  useGallerySkills,
  useRefreshGallery,
} from '@/hooks/use-skill-gallery';
import { useAllSkillTags, useSkills } from '@/hooks/use-skills';

export default function SkillStorePage() {
  // ── My Skills state ─────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [selectedPhase, setSelectedPhase] = useState('');

  const filters = {
    search: search || undefined,
    tag: selectedTag && selectedTag !== 'all' ? selectedTag : undefined,
    phase: (selectedPhase && selectedPhase !== 'all' ? selectedPhase : undefined) as
      | SkillPhase
      | undefined,
  };

  const { data: skills, isLoading } = useSkills(filters);
  const allTags = useAllSkillTags();

  // ── Gallery state ───────────────────────────────────────────────
  const [gallerySearch, setGallerySearch] = useState('');
  const [galleryCategory, setGalleryCategory] = useState<GalleryCategory | undefined>();

  const galleryFilters: GallerySearchFilters = {
    query: gallerySearch || undefined,
    category: galleryCategory,
  };

  const { data: galleryData, isLoading: galleryLoading } = useGallerySkills(galleryFilters);
  const { data: categories } = useGalleryCategories();
  const refreshGallery = useRefreshGallery();

  // Cross-reference installed skill IDs
  const { data: installedSkills } = useSkills();
  const installedIds = useMemo(
    () => new Set(installedSkills?.map((s) => s.id) ?? []),
    [installedSkills],
  );

  const showFeatured = !gallerySearch && !galleryCategory;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold tracking-tight">
            <Store className="h-8 w-8" />
            Skill Store
          </h1>
          <p className="text-muted-foreground">
            Browse, discover, and manage skills for your AI agents.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SkillImportDialog />
          <SkillFormDialog />
        </div>
      </div>

      <Tabs defaultValue="my-skills">
        <TabsList>
          <TabsTrigger value="my-skills">My Skills</TabsTrigger>
          <TabsTrigger value="gallery">Gallery</TabsTrigger>
        </TabsList>

        <TabsContent value="my-skills" className="space-y-6">
          <SkillFiltersToolbar
            search={search}
            onSearchChange={setSearch}
            selectedTag={selectedTag}
            onTagChange={setSelectedTag}
            selectedPhase={selectedPhase}
            onPhaseChange={setSelectedPhase}
            availableTags={allTags}
            resultCount={skills?.length}
          />
          <SkillGrid skills={skills} isLoading={isLoading} />
        </TabsContent>

        <TabsContent value="gallery" className="space-y-6">
          {/* Search + Refresh */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search gallery skills..."
                value={gallerySearch}
                onChange={(e) => setGallerySearch(e.target.value)}
                className="pl-9"
                data-testid="gallery-search-input"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refreshGallery.mutate()}
              disabled={refreshGallery.isPending}
              data-testid="gallery-refresh-btn"
            >
              <RefreshCw
                className={`mr-1 h-4 w-4 ${refreshGallery.isPending ? 'animate-spin' : ''}`}
              />
              Refresh
            </Button>
          </div>

          {/* Category nav */}
          {categories && categories.length > 0 && (
            <GalleryCategoryNav
              categories={categories}
              selected={galleryCategory}
              onSelect={setGalleryCategory}
            />
          )}

          {/* Featured section (only when no filters) */}
          {showFeatured && <GalleryFeaturedSection installedIds={installedIds} />}

          {/* Gallery grid */}
          <GallerySkillGrid
            skills={galleryData?.skills}
            isLoading={galleryLoading}
            installedIds={installedIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
