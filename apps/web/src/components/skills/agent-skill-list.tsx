'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { SkillConfigSchema, SkillPhase } from '@openspace/shared';
import { Eye, EyeOff, GitBranch, GripVertical, Save, Settings, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  type AgentSkillAssignment,
  useAgentSkills,
  useBulkToggleAgentSkills,
  useReorderAgentSkills,
  useSkillDetail,
  useSkills,
  useToggleAgentSkill,
  useUpdateAgentSkillConfig,
} from '@/hooks/use-skills';
import { cn } from '@/lib/utils';

import { SkillDependencyGraph } from './skill-dependency-graph';
import { SkillIcon } from './skill-icon';
import { SkillPhaseBadge } from './skill-phase-badge';

interface AgentSkillListProps {
  agentId: string;
}

export function AgentSkillList({ agentId }: AgentSkillListProps) {
  const { data: agentSkillsConfig, isLoading } = useAgentSkills(agentId);
  const { data: allSkills } = useSkills();
  const toggleMutation = useToggleAgentSkill(agentId);
  const bulkToggleMutation = useBulkToggleAgentSkills(agentId);
  const reorderMutation = useReorderAgentSkills(agentId);
  const updateConfigMutation = useUpdateAgentSkillConfig(agentId);

  const [items, setItems] = useState<AgentSkillAssignment[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDependencyGraph, setShowDependencyGraph] = useState(false);
  const [expandedSkillId, setExpandedSkillId] = useState<string | null>(null);

  useEffect(() => {
    if (agentSkillsConfig?.assignments) {
      setItems([...agentSkillsConfig.assignments].sort((a, b) => a.priority - b.priority));
    }
  }, [agentSkillsConfig?.assignments]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      setItems((prev) => {
        const oldIndex = prev.findIndex((i) => i.skillId === active.id);
        const newIndex = prev.findIndex((i) => i.skillId === over.id);
        const reordered = arrayMove(prev, oldIndex, newIndex);
        reorderMutation.mutate(reordered.map((i) => i.skillId));
        return reordered;
      });
    },
    [reorderMutation],
  );

  const handleToggle = useCallback(
    (skillId: string, enabled: boolean) => {
      toggleMutation.mutate({ skillId, mode: enabled ? 'always' : 'never' });
    },
    [toggleMutation],
  );

  const handleConfigSave = useCallback(
    (skillId: string, config: Record<string, unknown>) => {
      updateConfigMutation.mutate({ skillId, config });
    },
    [updateConfigMutation],
  );

  // ── Bulk operations ──────────────────────────────────────────────

  const toggleSelect = useCallback((skillId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(skillId)) next.delete(skillId);
      else next.add(skillId);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) =>
      prev.size === items.length ? new Set() : new Set(items.map((i) => i.skillId)),
    );
  }, [items]);

  const handleBulkEnable = useCallback(() => {
    if (selectedIds.size === 0) return;
    bulkToggleMutation.mutate({ skillIds: Array.from(selectedIds), enabled: true });
    setSelectedIds(new Set());
  }, [selectedIds, bulkToggleMutation]);

  const handleBulkDisable = useCallback(() => {
    if (selectedIds.size === 0) return;
    bulkToggleMutation.mutate({ skillIds: Array.from(selectedIds), enabled: false });
    setSelectedIds(new Set());
  }, [selectedIds, bulkToggleMutation]);

  const activeOnTask = new Set(agentSkillsConfig?.activeOnCurrentTask ?? []);

  const getSkillMeta = (skillId: string) => allSkills?.find((s) => s.id === skillId);

  // ── Dependency graph data ────────────────────────────────────────

  const assignedSkillIds = useMemo(() => items.map((i) => i.skillId), [items]);

  if (isLoading) {
    return (
      <div className="space-y-3" data-testid="agent-skill-list-loading">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (!items.length) {
    return (
      <p className="text-sm text-muted-foreground" data-testid="agent-skill-list-empty">
        No skills assigned to this agent.
      </p>
    );
  }

  const allSelected = selectedIds.size === items.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-4" data-testid="agent-skill-list">
      {/* ── Toolbar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleSelectAll}
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs transition-colors',
              allSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : someSelected
                  ? 'border-primary bg-primary/20 text-primary'
                  : 'border-input bg-background',
            )}
            aria-label={allSelected ? 'Deselect all' : 'Select all'}
            data-testid="select-all-skills"
          >
            {allSelected ? '✓' : someSelected ? '–' : ''}
          </button>
          <span className="text-sm text-muted-foreground">
            {someSelected ? `${selectedIds.size} selected` : `${items.length} skills`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {someSelected && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkEnable}
                className="h-7 gap-1 text-xs"
                data-testid="bulk-enable-skills"
              >
                <Eye className="h-3 w-3" />
                Enable
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleBulkDisable}
                className="h-7 gap-1 text-xs"
                data-testid="bulk-disable-skills"
              >
                <EyeOff className="h-3 w-3" />
                Disable
              </Button>
            </>
          )}
          <Button
            size="sm"
            variant={showDependencyGraph ? 'default' : 'outline'}
            onClick={() => setShowDependencyGraph((v) => !v)}
            className="h-7 gap-1 text-xs"
            data-testid="toggle-dependency-graph"
          >
            <GitBranch className="h-3 w-3" />
            Dependencies
          </Button>
        </div>
      </div>

      {/* ── Dependency Graph ────────────────────────────────────── */}
      {showDependencyGraph && <SkillDependencyGraph skillIds={assignedSkillIds} />}

      {/* ── Sortable List ───────────────────────────────────────── */}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((i) => i.skillId)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((assignment, idx) => {
              const meta = getSkillMeta(assignment.skillId);
              const isActiveOnTask = activeOnTask.has(assignment.skillId);

              return (
                <SortableSkillRow
                  key={assignment.skillId}
                  assignment={assignment}
                  index={idx}
                  meta={meta}
                  isActiveOnTask={isActiveOnTask}
                  isSelected={selectedIds.has(assignment.skillId)}
                  isExpanded={expandedSkillId === assignment.skillId}
                  onToggle={handleToggle}
                  onSelect={toggleSelect}
                  onExpand={(id) => setExpandedSkillId((prev) => (prev === id ? null : id))}
                  onConfigSave={handleConfigSave}
                />
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

// ── Sortable Row ──────────────────────────────────────────────────

interface SortableSkillRowProps {
  assignment: AgentSkillAssignment;
  index: number;
  meta?: {
    id?: string;
    name: string;
    description: string;
    version: string;
    icon?: string;
    phase: SkillPhase;
  };
  isActiveOnTask: boolean;
  isSelected: boolean;
  isExpanded: boolean;
  onToggle: (skillId: string, enabled: boolean) => void;
  onSelect: (skillId: string) => void;
  onExpand: (skillId: string) => void;
  onConfigSave: (skillId: string, config: Record<string, unknown>) => void;
}

function SortableSkillRow({
  assignment,
  index,
  meta,
  isActiveOnTask,
  isSelected,
  isExpanded,
  onToggle,
  onSelect,
  onExpand,
  onConfigSave,
}: SortableSkillRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: assignment.skillId,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.8 : undefined,
  };

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'transition-shadow',
        isDragging && 'shadow-lg',
        isActiveOnTask && 'ring-2 ring-green-500/40',
        !assignment.enabled && 'opacity-60',
        isSelected && 'ring-2 ring-primary/50',
      )}
      data-testid={`agent-skill-row-${assignment.skillId}`}
    >
      <CardContent className="py-0 px-0">
        <div className="flex items-center gap-3 py-3 px-4">
          {/* Select checkbox */}
          <button
            type="button"
            onClick={() => onSelect(assignment.skillId)}
            className={cn(
              'flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[10px] transition-colors',
              isSelected
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-input bg-background hover:border-primary/50',
            )}
            aria-label={`Select ${meta?.name ?? assignment.skillId}`}
            data-testid={`skill-select-${assignment.skillId}`}
          >
            {isSelected ? '✓' : ''}
          </button>

          {/* Drag handle */}
          <button
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
            aria-label="Drag to reorder"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Priority number */}
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
            {index + 1}
          </span>

          {/* Icon */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <SkillIcon icon={meta?.icon} className="h-4 w-4" />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Link
                href={`/skills/${assignment.skillId}`}
                className="text-sm font-medium hover:underline truncate"
              >
                {meta?.name ?? assignment.skillId}
              </Link>
              {meta && <SkillPhaseBadge phase={meta.phase} />}
              {isActiveOnTask && (
                <Badge className="bg-green-500/15 text-green-700 dark:text-green-400 border-0 gap-1 text-xs">
                  <Zap className="h-3 w-3" />
                  Active on task
                </Badge>
              )}
            </div>
            {meta && <p className="text-xs text-muted-foreground truncate">{meta.description}</p>}
          </div>

          {/* Config expand button */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onExpand(assignment.skillId)}
            className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
            aria-label="Edit skill config"
            data-testid={`skill-config-toggle-${assignment.skillId}`}
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Toggle */}
          <Switch
            checked={assignment.enabled}
            onCheckedChange={(checked) => onToggle(assignment.skillId, checked)}
            aria-label={`Toggle ${meta?.name ?? assignment.skillId}`}
            data-testid={`skill-toggle-${assignment.skillId}`}
          />
        </div>

        {/* ── Inline Config Editor ──────────────────────────────── */}
        {isExpanded && (
          <InlineSkillConfigEditor
            skillId={assignment.skillId}
            currentConfig={assignment.config ?? {}}
            onSave={onConfigSave}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ── Inline Config Editor ──────────────────────────────────────────

interface InlineSkillConfigEditorProps {
  skillId: string;
  currentConfig: Record<string, unknown>;
  onSave: (skillId: string, config: Record<string, unknown>) => void;
}

function InlineSkillConfigEditor({ skillId, currentConfig, onSave }: InlineSkillConfigEditorProps) {
  const { data: detail } = useSkillDetail(skillId);
  const configSchema = detail?.manifest.config ?? [];
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>({ ...currentConfig });
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setLocalConfig({ ...currentConfig });
    setIsDirty(false);
  }, [currentConfig]);

  const updateField = (key: string, value: unknown) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    onSave(skillId, localConfig);
    setIsDirty(false);
  };

  if (configSchema.length === 0) {
    return (
      <div className="border-t px-4 py-3 bg-muted/30" data-testid={`skill-config-panel-${skillId}`}>
        <p className="text-xs text-muted-foreground italic">
          This skill has no configurable parameters.
        </p>
      </div>
    );
  }

  return (
    <div
      className="border-t px-4 py-3 bg-muted/30 space-y-3"
      data-testid={`skill-config-panel-${skillId}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Configuration
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={handleSave}
          disabled={!isDirty}
          className="h-7 gap-1 text-xs"
          data-testid={`skill-config-save-${skillId}`}
        >
          <Save className="h-3 w-3" />
          Save
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {configSchema.map((field) => (
          <ConfigField
            key={field.key}
            schema={field}
            value={localConfig[field.key] ?? field.default}
            onChange={(value) => updateField(field.key, value)}
          />
        ))}
      </div>
    </div>
  );
}

// ── Config Field Renderer ─────────────────────────────────────────

interface ConfigFieldProps {
  schema: SkillConfigSchema;
  value: unknown;
  onChange: (value: unknown) => void;
}

function ConfigField({ schema, value, onChange }: ConfigFieldProps) {
  if (schema.enum && schema.enum.length > 0) {
    return (
      <label className="space-y-1">
        <span className="text-xs font-medium">{schema.label}</span>
        <select
          value={String(value ?? '')}
          onChange={(e) =>
            onChange(schema.type === 'number' ? Number(e.target.value) : e.target.value)
          }
          className="flex h-8 w-full rounded-md border border-input bg-background px-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid={`config-field-${schema.key}`}
        >
          {schema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
        <p className="text-[11px] text-muted-foreground">{schema.description}</p>
      </label>
    );
  }

  if (schema.type === 'boolean') {
    return (
      <label className="flex items-center justify-between gap-2 py-1">
        <div className="space-y-0.5">
          <span className="text-xs font-medium">{schema.label}</span>
          <p className="text-[11px] text-muted-foreground">{schema.description}</p>
        </div>
        <Switch
          checked={Boolean(value)}
          onCheckedChange={(checked) => onChange(checked)}
          data-testid={`config-field-${schema.key}`}
        />
      </label>
    );
  }

  if (schema.type === 'number') {
    return (
      <label className="space-y-1">
        <span className="text-xs font-medium">{schema.label}</span>
        <Input
          type="number"
          value={value != null ? String(value) : ''}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
          min={schema.validation?.min}
          max={schema.validation?.max}
          className="h-8 text-sm"
          data-testid={`config-field-${schema.key}`}
        />
        <p className="text-[11px] text-muted-foreground">{schema.description}</p>
      </label>
    );
  }

  // Default: string input
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium">{schema.label}</span>
      <Input
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        pattern={schema.validation?.pattern}
        className="h-8 text-sm"
        data-testid={`config-field-${schema.key}`}
      />
      <p className="text-[11px] text-muted-foreground">{schema.description}</p>
    </label>
  );
}
