'use client';

import type { SkillPhase } from '@openspace/shared';
import { Search, X } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface SkillFiltersToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  selectedTag: string;
  onTagChange: (value: string) => void;
  selectedPhase: string;
  onPhaseChange: (value: string) => void;
  availableTags: string[];
  resultCount?: number;
}

const phases: { value: SkillPhase | ''; label: string }[] = [
  { value: '', label: 'All Phases' },
  { value: 'active', label: 'Active' },
  { value: 'loaded', label: 'Loaded' },
  { value: 'validated', label: 'Validated' },
  { value: 'discovered', label: 'Discovered' },
  { value: 'deactivated', label: 'Inactive' },
  { value: 'error', label: 'Error' },
];

export function SkillFiltersToolbar({
  search,
  onSearchChange,
  selectedTag,
  onTagChange,
  selectedPhase,
  onPhaseChange,
  availableTags,
  resultCount,
}: SkillFiltersToolbarProps) {
  const hasFilters = search || selectedTag || selectedPhase;

  return (
    <div className="space-y-3" data-testid="skill-filters">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search skills..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9"
            data-testid="skill-search-input"
          />
        </div>
        <div className="flex gap-2">
          <Select value={selectedTag} onValueChange={onTagChange}>
            <SelectTrigger className="w-[160px]" data-testid="skill-tag-filter">
              <SelectValue placeholder="All Tags" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tags</SelectItem>
              {availableTags.map((tag) => (
                <SelectItem key={tag} value={tag}>
                  {tag}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={selectedPhase} onValueChange={onPhaseChange}>
            <SelectTrigger className="w-[160px]" data-testid="skill-phase-filter">
              <SelectValue placeholder="All Phases" />
            </SelectTrigger>
            <SelectContent>
              {phases.map((p) => (
                <SelectItem key={p.value || 'all'} value={p.value || 'all'}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {hasFilters && (
        <div className="flex items-center gap-2">
          {resultCount !== undefined && (
            <span className="text-sm text-muted-foreground">
              {resultCount} skill{resultCount !== 1 ? 's' : ''} found
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSearchChange('');
              onTagChange('');
              onPhaseChange('');
            }}
            data-testid="skill-clear-filters"
          >
            <X className="mr-1 h-3 w-3" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  );
}
