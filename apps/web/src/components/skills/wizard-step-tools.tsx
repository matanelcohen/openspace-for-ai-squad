'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import type { WizardFormState } from '@/hooks/use-skill-manifest-form';

import type { FormAction } from './wizard-types';

interface WizardStepToolsProps {
  state: WizardFormState;
  dispatch: React.Dispatch<FormAction>;
  getFieldError: (field: string) => string | undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive" role="alert">{message}</p>;
}

export function WizardStepTools({ state, dispatch, getFieldError }: WizardStepToolsProps) {
  const [newToolId, setNewToolId] = useState('');

  const addTool = () => {
    if (!newToolId.trim()) return;
    dispatch({
      type: 'ADD_TOOL',
      tool: { toolId: newToolId.trim(), optional: false, reason: '' },
    });
    setNewToolId('');
  };

  const toolsError = getFieldError('tools');

  return (
    <div className="space-y-5" data-testid="wizard-step-tools">
      <div>
        <h3 className="text-sm font-medium mb-1">Tool Declarations</h3>
        <p className="text-xs text-muted-foreground">
          Declare the tools this skill requires. The registry validates availability at load time.
        </p>
      </div>

      {/* Add tool input */}
      <div className="flex gap-2">
        <Input
          placeholder='Tool ID (e.g. "git:commit", "file:read")'
          value={newToolId}
          onChange={(e) => setNewToolId(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addTool();
            }
          }}
          data-testid="new-tool-input"
        />
        <Button type="button" variant="outline" size="sm" onClick={addTool} data-testid="add-tool-btn">
          <Plus className="h-4 w-4 mr-1" />
          Add
        </Button>
      </div>

      {toolsError && state.tools.length === 0 && <FieldError message={toolsError} />}

      {/* Tool list */}
      <div className="space-y-3">
        {state.tools.map((tool, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-4 space-y-3"
            data-testid={`tool-entry-${index}`}
          >
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono font-semibold">{tool.toolId}</code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => dispatch({ type: 'REMOVE_TOOL', index })}
                aria-label={`Remove ${tool.toolId}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Version Range</label>
                <Input
                  placeholder="^1.0.0"
                  value={tool.versionRange ?? ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_TOOL',
                      index,
                      tool: { ...tool, versionRange: e.target.value || undefined },
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">Reason</label>
                <Input
                  placeholder="Why this tool is needed"
                  value={tool.reason ?? ''}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_TOOL',
                      index,
                      tool: { ...tool, reason: e.target.value || undefined },
                    })
                  }
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={tool.optional ?? false}
                onCheckedChange={(checked) =>
                  dispatch({
                    type: 'UPDATE_TOOL',
                    index,
                    tool: { ...tool, optional: checked },
                  })
                }
              />
              <label className="text-xs text-muted-foreground">Optional (skill can function without it)</label>
            </div>

            <FieldError message={getFieldError(`tools[${index}].toolId`)} />
          </div>
        ))}
      </div>

      {state.tools.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
          No tools declared yet. Add a tool ID above to get started.
        </div>
      )}
    </div>
  );
}
