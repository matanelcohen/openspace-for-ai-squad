'use client';

import type { PromptRole } from '@openspace/shared';
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
import { Textarea } from '@/components/ui/textarea';
import type { WizardFormState } from '@/hooks/use-skill-manifest-form';

import type { FormAction } from './wizard-types';

const PROMPT_ROLES: { value: PromptRole; label: string; description: string }[] = [
  { value: 'system', label: 'System', description: 'Injected as system context' },
  { value: 'planning', label: 'Planning', description: 'Used during task decomposition' },
  { value: 'execution', label: 'Execution', description: 'Used during task execution' },
  { value: 'review', label: 'Review', description: 'Used during output validation' },
  { value: 'error', label: 'Error', description: 'Used for error handling' },
  { value: 'handoff', label: 'Handoff', description: 'Used when delegating to others' },
];

interface WizardStepPromptsProps {
  state: WizardFormState;
  dispatch: React.Dispatch<FormAction>;
  getFieldError: (field: string) => string | undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive" role="alert">{message}</p>;
}

export function WizardStepPrompts({ state, dispatch, getFieldError }: WizardStepPromptsProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(
    state.prompts.length > 0 ? 0 : null,
  );

  const addPrompt = () => {
    const idx = state.prompts.length;
    dispatch({
      type: 'ADD_PROMPT',
      prompt: {
        id: '',
        name: '',
        role: 'system',
        content: '',
      },
    });
    setExpandedIndex(idx);
  };

  const promptsError = getFieldError('prompts');

  return (
    <div className="space-y-5" data-testid="wizard-step-prompts">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium mb-1">Prompt Templates</h3>
          <p className="text-xs text-muted-foreground">
            Define prompt templates with {'{{variable}}'} interpolation for dynamic content.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addPrompt} data-testid="add-prompt-btn">
          <Plus className="h-4 w-4 mr-1" />
          Add Prompt
        </Button>
      </div>

      {promptsError && state.prompts.length === 0 && <FieldError message={promptsError} />}

      {/* Prompt list */}
      <div className="space-y-3">
        {state.prompts.map((prompt, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card overflow-hidden"
            data-testid={`prompt-entry-${index}`}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50"
              onClick={() => setExpandedIndex(expandedIndex === index ? null : index)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setExpandedIndex(expandedIndex === index ? null : index);
                }
              }}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm font-medium truncate">
                  {prompt.name || `Prompt ${index + 1}`}
                </span>
                {prompt.role && (
                  <span className="text-xs rounded-full bg-secondary px-2 py-0.5">
                    {prompt.role}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: 'REMOVE_PROMPT', index });
                    if (expandedIndex === index) setExpandedIndex(null);
                  }}
                  aria-label={`Remove prompt ${index + 1}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Expanded content */}
            {expandedIndex === index && (
              <div className="border-t px-4 py-4 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Template ID *</label>
                    <Input
                      placeholder="system-prompt"
                      value={prompt.id}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_PROMPT',
                          index,
                          prompt: { ...prompt, id: e.target.value },
                        })
                      }
                      className="h-8 text-xs"
                    />
                    <FieldError message={getFieldError(`prompts[${index}].id`)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Name *</label>
                    <Input
                      placeholder="System Prompt"
                      value={prompt.name}
                      onChange={(e) =>
                        dispatch({
                          type: 'UPDATE_PROMPT',
                          index,
                          prompt: { ...prompt, name: e.target.value },
                        })
                      }
                      className="h-8 text-xs"
                    />
                    <FieldError message={getFieldError(`prompts[${index}].name`)} />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium">Role</label>
                    <Select
                      value={prompt.role}
                      onValueChange={(v) =>
                        dispatch({
                          type: 'UPDATE_PROMPT',
                          index,
                          prompt: { ...prompt, role: v as PromptRole },
                        })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PROMPT_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            <span>{r.label}</span>
                            <span className="ml-1 text-muted-foreground">— {r.description}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Content *</label>
                  <Textarea
                    placeholder={'You are a {{agent.role}} reviewing code.\n\n{{#if hasTests}}Run tests first.{{/if}}'}
                    value={prompt.content}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_PROMPT',
                        index,
                        prompt: { ...prompt, content: e.target.value },
                      })
                    }
                    rows={6}
                    className="font-mono text-xs"
                  />
                  <FieldError message={getFieldError(`prompts[${index}].content`)} />
                  <p className="text-xs text-muted-foreground">
                    Use {'{{variable}}'} for interpolation, {'{{#if cond}}...{{/if}}'} for conditionals
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium">Max Tokens</label>
                  <Input
                    type="number"
                    placeholder="4096"
                    value={prompt.maxTokens ?? ''}
                    onChange={(e) =>
                      dispatch({
                        type: 'UPDATE_PROMPT',
                        index,
                        prompt: {
                          ...prompt,
                          maxTokens: e.target.value ? parseInt(e.target.value, 10) : undefined,
                        },
                      })
                    }
                    className="h-8 text-xs w-32"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {state.prompts.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
          No prompt templates yet. Add a prompt to define how this skill communicates with agents.
        </div>
      )}
    </div>
  );
}
