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
import { GripVertical, Zap } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  type AgentSkillAssignment,
  useAgentSkills,
  useReorderAgentSkills,
  useSkills,
  useToggleAgentSkill,
} from '@/hooks/use-skills';

import { SkillIcon } from './skill-icon';
import { SkillPhaseBadge } from './skill-phase-badge';

interface AgentSkillListProps {
  agentId: string;
}

export function AgentSkillList({ agentId }: AgentSkillListProps) {
  const { data: agentSkillsConfig, isLoading } = useAgentSkills(agentId);
  const { data: allSkills } = useSkills();
  const toggleMutation = useToggleAgentSkill(agentId);
  const reorderMutation = useReorderAgentSkills(agentId);

  const [items, setItems] = useState<AgentSkillAssignment[]>([]);

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
      toggleMutation.mutate({ skillId, enabled });
    },
    [toggleMutation],
  );

  const activeOnTask = new Set(agentSkillsConfig?.activeOnCurrentTask ?? []);

  const getSkillMeta = (skillId: string) =>
    allSkills?.find((s) => s.id === skillId);

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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map((i) => i.skillId)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2" data-testid="agent-skill-list">
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
                onToggle={handleToggle}
              />
            );
          })}
        </div>
      </SortableContext>
    </DndContext>
  );
}

// ── Sortable Row ──────────────────────────────────────────────────

interface SortableSkillRowProps {
  assignment: AgentSkillAssignment;
  index: number;
  meta?: { name: string; description: string; version: string; icon?: string; phase: import('@openspace/shared').SkillPhase };
  isActiveOnTask: boolean;
  onToggle: (skillId: string, enabled: boolean) => void;
}

function SortableSkillRow({ assignment, index, meta, isActiveOnTask, onToggle }: SortableSkillRowProps) {
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
      className={`transition-shadow ${isDragging ? 'shadow-lg' : ''} ${
        isActiveOnTask ? 'ring-2 ring-green-500/40' : ''
      } ${!assignment.enabled ? 'opacity-60' : ''}`}
      data-testid={`agent-skill-row-${assignment.skillId}`}
    >
      <CardContent className="flex items-center gap-3 py-3 px-4">
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
          {meta && (
            <p className="text-xs text-muted-foreground truncate">{meta.description}</p>
          )}
        </div>

        {/* Toggle */}
        <Switch
          checked={assignment.enabled}
          onCheckedChange={(checked) => onToggle(assignment.skillId, checked)}
          aria-label={`Toggle ${meta?.name ?? assignment.skillId}`}
          data-testid={`skill-toggle-${assignment.skillId}`}
        />
      </CardContent>
    </Card>
  );
}
