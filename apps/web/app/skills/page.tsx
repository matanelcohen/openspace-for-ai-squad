'use client';

import type { SkillPhase } from '@openspace/shared';
import { Store } from 'lucide-react';
import { useState } from 'react';

import { SkillCreationWizard } from '@/components/skills/skill-creation-wizard';
import { SkillFiltersToolbar } from '@/components/skills/skill-filters-toolbar';
import { SkillGrid } from '@/components/skills/skill-grid';
import { useAllSkillTags, useSkills } from '@/hooks/use-skills';

export default function SkillStorePage() {
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
        <SkillCreationWizard />
      </div>

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
    </div>
  );
}
