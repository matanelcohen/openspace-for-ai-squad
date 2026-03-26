'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WizardFormState } from '@/hooks/use-skill-manifest-form';

import type { FormAction } from './wizard-types';

type TriggerType = 'task-type' | 'label' | 'pattern' | 'file';

const TRIGGER_TYPE_LABELS: Record<TriggerType, string> = {
  'task-type': 'Task Type',
  label: 'Labels',
  pattern: 'Pattern',
  file: 'File Globs',
};

const TRIGGER_TYPE_DESCRIPTIONS: Record<TriggerType, string> = {
  'task-type': 'Match by task type (e.g. "bug-fix", "feature", "refactor")',
  label: 'Match when specific labels are present on the task',
  pattern: 'Match by regex pattern against task title or description',
  file: 'Match when task involves specific file patterns',
};

interface WizardStepTriggersProps {
  state: WizardFormState;
  dispatch: React.Dispatch<FormAction>;
  getFieldError: (field: string) => string | undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive" role="alert">{message}</p>;
}

function TagInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [input, setInput] = useState('');

  const addValue = () => {
    const trimmed = input.trim();
    if (trimmed && !values.includes(trimmed)) {
      onChange([...values, trimmed]);
    }
    setInput('');
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addValue();
            }
          }}
          className="h-8 text-xs"
        />
        <Button type="button" variant="outline" size="sm" className="h-8" onClick={addValue}>
          Add
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {values.map((val) => (
            <span
              key={val}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium"
            >
              {val}
              <button
                type="button"
                className="text-muted-foreground hover:text-destructive"
                onClick={() => onChange(values.filter((v) => v !== val))}
                aria-label={`Remove ${val}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function WizardStepTriggers({ state, dispatch, getFieldError }: WizardStepTriggersProps) {
  const [newType, setNewType] = useState<TriggerType>('task-type');

  const addTrigger = () => {
    switch (newType) {
      case 'task-type':
        dispatch({ type: 'ADD_TRIGGER', trigger: { type: 'task-type', taskTypes: [] } });
        break;
      case 'label':
        dispatch({ type: 'ADD_TRIGGER', trigger: { type: 'label', labels: [] } });
        break;
      case 'pattern':
        dispatch({ type: 'ADD_TRIGGER', trigger: { type: 'pattern' } });
        break;
      case 'file':
        dispatch({ type: 'ADD_TRIGGER', trigger: { type: 'file', globs: [] } });
        break;
    }
  };

  const triggersError = getFieldError('triggers');

  return (
    <div className="space-y-5" data-testid="wizard-step-triggers">
      <div>
        <h3 className="text-sm font-medium mb-1">Trigger Rules</h3>
        <p className="text-xs text-muted-foreground">
          Define when this skill should be activated. Multiple triggers use OR semantics.
        </p>
      </div>

      {/* Add trigger */}
      <div className="flex gap-2">
        <Select value={newType} onValueChange={(v) => setNewType(v as TriggerType)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(TRIGGER_TYPE_LABELS) as [TriggerType, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="button" variant="outline" size="sm" onClick={addTrigger} data-testid="add-trigger-btn">
          <Plus className="h-4 w-4 mr-1" />
          Add Trigger
        </Button>
      </div>

      {triggersError && state.triggers.length === 0 && <FieldError message={triggersError} />}

      {/* Trigger list */}
      <div className="space-y-3">
        {state.triggers.map((trigger, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-4 space-y-3"
            data-testid={`trigger-entry-${index}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium">
                  {TRIGGER_TYPE_LABELS[trigger.type as TriggerType] ?? trigger.type}
                </span>
                <p className="text-xs text-muted-foreground">
                  {TRIGGER_TYPE_DESCRIPTIONS[trigger.type as TriggerType]}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => dispatch({ type: 'REMOVE_TRIGGER', index })}
                aria-label="Remove trigger"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            {trigger.type === 'task-type' && (
              <TagInput
                values={trigger.taskTypes}
                onChange={(taskTypes) =>
                  dispatch({ type: 'UPDATE_TRIGGER', index, trigger: { ...trigger, taskTypes } })
                }
                placeholder='Task type (e.g. "bug-fix")'
              />
            )}

            {trigger.type === 'label' && (
              <TagInput
                values={trigger.labels}
                onChange={(labels) =>
                  dispatch({ type: 'UPDATE_TRIGGER', index, trigger: { ...trigger, labels } })
                }
                placeholder='Label (e.g. "security")'
              />
            )}

            {trigger.type === 'pattern' && (
              <div className="space-y-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Title Pattern (regex)</label>
                  <Input
                    placeholder="review|audit|check"
                    value={trigger.titlePattern ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_TRIGGER',
                        index,
                        trigger: { ...trigger, titlePattern: e.target.value || undefined },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Description Pattern (regex)</label>
                  <Input
                    placeholder="security|vulnerability|CVE"
                    value={trigger.descriptionPattern ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_TRIGGER',
                        index,
                        trigger: { ...trigger, descriptionPattern: e.target.value || undefined },
                      })
                    }
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </div>
            )}

            {trigger.type === 'file' && (
              <TagInput
                values={trigger.globs}
                onChange={(globs) =>
                  dispatch({ type: 'UPDATE_TRIGGER', index, trigger: { ...trigger, globs } })
                }
                placeholder='Glob pattern (e.g. "src/**/*.ts")'
              />
            )}
          </div>
        ))}
      </div>

      {state.triggers.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
          No triggers defined yet. Add a trigger rule to specify when this skill activates.
        </div>
      )}
    </div>
  );
}
