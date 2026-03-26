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
  horizontalListSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

interface SkillsEditorProps {
  skills: string[];
  onSkillsChange: (skills: string[]) => void;
  editable?: boolean;
  className?: string;
}

export function SkillsEditor({
  skills,
  onSkillsChange,
  editable = true,
  className,
}: SkillsEditorProps) {
  const [newSkill, setNewSkill] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleAdd = () => {
    const trimmed = newSkill.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onSkillsChange([...skills, trimmed]);
    }
    setNewSkill('');
    setIsAdding(false);
  };

  const handleRemove = (skill: string) => {
    onSkillsChange(skills.filter((s) => s !== skill));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAdd();
    } else if (e.key === 'Escape') {
      setNewSkill('');
      setIsAdding(false);
    }
  };

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;

      const oldIndex = skills.indexOf(active.id as string);
      const newIndex = skills.indexOf(over.id as string);
      if (oldIndex !== -1 && newIndex !== -1) {
        onSkillsChange(arrayMove(skills, oldIndex, newIndex));
      }
    },
    [skills, onSkillsChange],
  );

  return (
    <div className={cn('space-y-2', className)} data-testid="skills-editor">
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={skills} strategy={horizontalListSortingStrategy}>
          <div className="flex flex-wrap gap-1.5">
            {skills.map((skill) => (
              <SortableSkillBadge
                key={skill}
                skill={skill}
                editable={editable}
                onRemove={handleRemove}
              />
            ))}
            {skills.length === 0 && !editable && (
              <span className="text-sm text-muted-foreground">No skills listed</span>
            )}
          </div>
        </SortableContext>
      </DndContext>

      {editable && (
        <div>
          {isAdding ? (
            <div className="flex items-center gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={() => {
                  if (!newSkill.trim()) setIsAdding(false);
                }}
                placeholder="Type a skill…"
                className="h-8 w-48 text-sm"
                autoFocus
                data-testid="skill-input"
              />
              <Button size="sm" variant="outline" onClick={handleAdd} className="h-8">
                Add
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(true)}
              className="h-7 gap-1 text-xs text-muted-foreground"
              data-testid="add-skill-button"
            >
              <Plus className="h-3 w-3" />
              Add Skill
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sortable Skill Badge ──────────────────────────────────────────

interface SortableSkillBadgeProps {
  skill: string;
  editable: boolean;
  onRemove: (skill: string) => void;
}

function SortableSkillBadge({ skill, editable, onRemove }: SortableSkillBadgeProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: skill,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.7 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style} className="inline-flex">
      <Badge
        variant="secondary"
        className={cn('text-xs select-none', editable && 'pr-1 gap-1', isDragging && 'shadow-md')}
      >
        {editable && (
          <button
            type="button"
            className="cursor-grab touch-none text-muted-foreground hover:text-foreground -ml-0.5"
            aria-label={`Drag to reorder ${skill}`}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}
        {skill}
        {editable && (
          <button
            type="button"
            onClick={() => onRemove(skill)}
            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
            aria-label={`Remove ${skill}`}
            data-testid={`remove-skill-${skill}`}
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </Badge>
    </div>
  );
}
