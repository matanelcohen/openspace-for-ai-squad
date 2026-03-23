'use client';

import type { Task, TaskPriority } from '@openspace/shared';
import { TASK_PRIORITIES, TASK_PRIORITY_LABELS } from '@openspace/shared';
import { X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { useAgents } from '@/hooks/use-agents';
import { type CreateTaskInput, useCreateTask, useUpdateTask } from '@/hooks/use-tasks';

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task?: Task | null;
}

interface FormErrors {
  title?: string;
}

export function TaskFormDialog({ open, onOpenChange, task }: TaskFormDialogProps) {
  const isEdit = !!task;
  const { data: agents } = useAgents();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignee, setAssignee] = useState<string>('unassigned');
  const [priority, setPriority] = useState<TaskPriority>('P2');
  const [labels, setLabels] = useState<string[]>([]);
  const [labelInput, setLabelInput] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [descTab, setDescTab] = useState<string>('write');

  // Reset form when dialog opens or task changes
  useEffect(() => {
    if (open) {
      if (task) {
        setTitle(task.title);
        setDescription(task.description);
        setAssignee(task.assignee ?? 'unassigned');
        setPriority(task.priority);
        setLabels([...task.labels]);
      } else {
        setTitle('');
        setDescription('');
        setAssignee('unassigned');
        setPriority('P2');
        setLabels([]);
      }
      setLabelInput('');
      setErrors({});
      setDescTab('write');
    }
  }, [open, task]);

  const validate = useCallback((): boolean => {
    const errs: FormErrors = {};
    if (!title.trim()) errs.title = 'Title is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }, [title]);

  function addLabel() {
    const trimmed = labelInput.trim();
    if (trimmed && !labels.includes(trimmed)) {
      setLabels([...labels, trimmed]);
    }
    setLabelInput('');
  }

  function removeLabel(label: string) {
    setLabels(labels.filter((l) => l !== label));
  }

  function handleLabelKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addLabel();
    }
    if (e.key === 'Backspace' && !labelInput && labels.length > 0) {
      setLabels(labels.slice(0, -1));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const payload: CreateTaskInput = {
      title: title.trim(),
      description,
      assignee: assignee === 'unassigned' ? null : assignee,
      priority,
      labels,
    };

    if (isEdit && task) {
      updateTask.mutate(
        { taskId: task.id, ...payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createTask.mutate(payload, {
        onSuccess: () => onOpenChange(false),
      });
    }
  }

  const isPending = createTask.isPending || updateTask.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg" data-testid="task-form-dialog">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEdit ? 'Edit Task' : 'Create Task'}</DialogTitle>
            <DialogDescription>
              {isEdit ? 'Update the task details below.' : 'Fill in the details to create a new task.'}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-4">
            {/* Title */}
            <div className="space-y-1">
              <label htmlFor="task-title" className="text-sm font-medium">
                Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="task-title"
                placeholder="Task title"
                value={title}
                onChange={(e) => { setTitle(e.target.value); setErrors({}); }}
                aria-invalid={!!errors.title}
                data-testid="task-title-input"
              />
              {errors.title && (
                <p className="text-xs text-destructive" data-testid="title-error">{errors.title}</p>
              )}
            </div>

            {/* Description with markdown preview */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Description</label>
              <Tabs value={descTab} onValueChange={setDescTab}>
                <TabsList className="h-8">
                  <TabsTrigger value="write" className="text-xs">Write</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="write" className="mt-2">
                  <Textarea
                    placeholder="Describe the task (supports markdown)..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={5}
                    data-testid="task-description-input"
                  />
                </TabsContent>
                <TabsContent value="preview" className="mt-2">
                  <div
                    className="min-h-[120px] rounded-md border p-3 prose prose-sm dark:prose-invert max-w-none"
                    data-testid="description-preview"
                  >
                    {description ? (
                      <Markdown remarkPlugins={[remarkGfm]}>{description}</Markdown>
                    ) : (
                      <p className="text-muted-foreground">Nothing to preview.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>

            {/* Assignee */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Assignee</label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger data-testid="task-assignee-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {agents?.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name} ({a.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger data-testid="task-priority-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{p} — {TASK_PRIORITY_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Labels */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Labels</label>
              <div className="flex flex-wrap items-center gap-1 rounded-md border p-2">
                {labels.map((l) => (
                  <Badge key={l} variant="secondary" className="gap-1 pr-1">
                    {l}
                    <button
                      type="button"
                      onClick={() => removeLabel(l)}
                      className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                      aria-label={`Remove ${l}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
                <Input
                  value={labelInput}
                  onChange={(e) => setLabelInput(e.target.value)}
                  onKeyDown={handleLabelKeyDown}
                  onBlur={addLabel}
                  placeholder={labels.length === 0 ? 'Add labels...' : ''}
                  className="h-7 min-w-[80px] flex-1 border-0 px-1 shadow-none focus-visible:ring-0"
                  data-testid="label-input"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-6">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} data-testid="task-submit-btn">
              {isPending ? 'Saving...' : isEdit ? 'Update Task' : 'Create Task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
