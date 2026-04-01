'use client';

import { useCallback, useEffect, useState } from 'react';

import type { TaskPriority, TaskStatus } from '@matanelcohen/openspace-shared';
import {
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUSES,
} from '@matanelcohen/openspace-shared';
import { Save, Search, X } from 'lucide-react';

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
import { useAgents } from '@/hooks/use-agents';

export interface TaskFilters {
  status: TaskStatus | 'all';
  assignee: string | 'all';
  priority: TaskPriority | 'all';
  search: string;
}

interface FilterPreset {
  name: string;
  filters: { status: string; priority: string; assignee: string; search: string };
}

const PRESETS_KEY = 'openspace-filter-presets';

const loadPresets = (): FilterPreset[] => {
  try {
    return JSON.parse(localStorage.getItem(PRESETS_KEY) ?? '[]');
  } catch {
    return [];
  }
};

const savePresetsToStorage = (presets: FilterPreset[]) =>
  localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));

interface TaskFiltersToolbarProps {
  filters: TaskFilters;
  onFiltersChange: (filters: TaskFilters) => void;
}

export function TaskFiltersToolbar({ filters, onFiltersChange }: TaskFiltersToolbarProps) {
  const { data: agents } = useAgents();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [presetName, setPresetName] = useState('');

  useEffect(() => {
    setPresets(loadPresets());
  }, []);

  const persistPresets = useCallback((next: FilterPreset[]) => {
    setPresets(next);
    savePresetsToStorage(next);
  }, []);

  const handleSavePreset = () => {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    const preset: FilterPreset = {
      name: trimmed,
      filters: {
        status: filters.status,
        priority: filters.priority,
        assignee: filters.assignee,
        search: filters.search,
      },
    };
    persistPresets([...presets, preset]);
    setPresetName('');
    setIsSaving(false);
  };

  const applyPreset = (preset: FilterPreset) => {
    onFiltersChange({
      status: preset.filters.status as TaskStatus | 'all',
      priority: preset.filters.priority as TaskPriority | 'all',
      assignee: preset.filters.assignee,
      search: preset.filters.search,
    });
  };

  const deletePreset = (index: number) => {
    persistPresets(presets.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-2" data-testid="task-filters-toolbar">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            value={filters.search}
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            className="w-56 pl-9"
            data-testid="filter-search"
          />
        </div>

        <Select
          value={filters.status}
          onValueChange={(val) =>
            onFiltersChange({ ...filters, status: val as TaskStatus | 'all' })
          }
        >
          <SelectTrigger className="w-40" data-testid="filter-status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {TASK_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.assignee}
          onValueChange={(val) => onFiltersChange({ ...filters, assignee: val })}
        >
          <SelectTrigger className="w-40" data-testid="filter-assignee">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Assignees</SelectItem>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {agents?.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={filters.priority}
          onValueChange={(val) =>
            onFiltersChange({ ...filters, priority: val as TaskPriority | 'all' })
          }
        >
          <SelectTrigger className="w-40" data-testid="filter-priority">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p} — {TASK_PRIORITY_LABELS[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {isSaving ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              placeholder="Preset name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSavePreset();
                if (e.key === 'Escape') setIsSaving(false);
              }}
              className="h-9 w-40"
              data-testid="preset-name-input"
            />
            <Button size="sm" onClick={handleSavePreset} data-testid="preset-confirm-save">
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setIsSaving(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSaving(true)}
            data-testid="preset-save-button"
          >
            <Save className="mr-1 h-4 w-4" />
            Save Filter
          </Button>
        )}
      </div>

      {presets.length > 0 && (
        <div className="flex flex-wrap items-center gap-2" data-testid="preset-pills">
          <span className="text-xs text-muted-foreground">Presets:</span>
          {presets.map((preset, index) => (
            <Badge
              key={`${preset.name}-${index}`}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1"
              onClick={() => applyPreset(preset)}
              data-testid={`preset-pill-${index}`}
            >
              {preset.name}
              <button
                type="button"
                className="ml-1 rounded-full p-0.5 hover:bg-muted"
                onClick={(e) => {
                  e.stopPropagation();
                  deletePreset(index);
                }}
                data-testid={`preset-delete-${index}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
