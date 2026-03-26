'use client';

import type { WorkflowNodeType } from '@openspace/shared';
import {
  CheckCircle2,
  Circle,
  CircleDot,
  GitBranch,
  GripVertical,
  Hand,
  Layers,
  Play,
  Split,
  Square,
} from 'lucide-react';
import type { DragEvent } from 'react';

import { cn } from '@/lib/utils';

// ── Palette Item Definition ──────────────────────────────────────

interface PaletteItem {
  type: WorkflowNodeType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

const paletteItems: PaletteItem[] = [
  { type: 'start', label: 'Start', description: 'Entry point', icon: Play },
  { type: 'task', label: 'Task', description: 'Execute a step', icon: CircleDot },
  { type: 'hitl_gate', label: 'HITL Gate', description: 'Human approval', icon: Hand },
  { type: 'condition', label: 'Condition', description: 'Branch logic', icon: GitBranch },
  { type: 'parallel_split', label: 'Split', description: 'Parallel fork', icon: Split },
  { type: 'parallel_join', label: 'Join', description: 'Parallel merge', icon: CheckCircle2 },
  { type: 'sub_workflow', label: 'Sub-workflow', description: 'Nested pipeline', icon: Layers },
  { type: 'end', label: 'End', description: 'Completion point', icon: Square },
];

const nodeTypeIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  start: Play,
  end: Square,
  task: CircleDot,
  hitl_gate: Hand,
  condition: GitBranch,
  parallel_split: Split,
  parallel_join: CheckCircle2,
  sub_workflow: Layers,
};

// ── Component ────────────────────────────────────────────────────

interface ComposerNodePaletteProps {
  className?: string;
}

export function ComposerNodePalette({ className }: ComposerNodePaletteProps) {
  const onDragStart = (event: DragEvent, nodeType: WorkflowNodeType, label: string) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.setData('application/reactflow-label', label);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className={cn('space-y-2', className)} data-testid="composer-palette">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Node Types
      </h3>
      <div className="space-y-1">
        {paletteItems.map((item) => {
          const Icon = nodeTypeIcons[item.type] ?? Circle;
          return (
            <div
              key={item.type}
              draggable
              onDragStart={(e) => onDragStart(e, item.type, item.label)}
              className={cn(
                'flex cursor-grab items-center gap-2.5 rounded-md border bg-card px-3 py-2',
                'transition-colors hover:border-primary/30 hover:bg-accent',
                'active:cursor-grabbing',
              )}
              data-testid={`palette-item-${item.type}`}
            >
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
              <div
                className={cn(
                  'flex h-7 w-7 shrink-0 items-center justify-center rounded-md',
                  'bg-muted text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
