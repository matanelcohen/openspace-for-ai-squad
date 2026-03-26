'use client';

import { Plus, Trash2 } from 'lucide-react';

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

const CONFIG_TYPES = [
  { value: 'string', label: 'String' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'string[]', label: 'String Array' },
] as const;

interface WizardStepConfigProps {
  state: WizardFormState;
  dispatch: React.Dispatch<FormAction>;
  getFieldError: (field: string) => string | undefined;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive" role="alert">{message}</p>;
}

export function WizardStepConfig({ state, dispatch, getFieldError }: WizardStepConfigProps) {
  const addConfig = () => {
    dispatch({
      type: 'ADD_CONFIG',
      config: {
        key: '',
        label: '',
        type: 'string',
        description: '',
      },
    });
  };

  return (
    <div className="space-y-5" data-testid="wizard-step-config">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium mb-1">Configuration Schema</h3>
          <p className="text-xs text-muted-foreground">
            Define user-configurable parameters with defaults and validation.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addConfig} data-testid="add-config-btn">
          <Plus className="h-4 w-4 mr-1" />
          Add Parameter
        </Button>
      </div>

      {/* Config list */}
      <div className="space-y-3">
        {state.config.map((cfg, index) => (
          <div
            key={index}
            className="rounded-lg border bg-card p-4 space-y-3"
            data-testid={`config-entry-${index}`}
          >
            <div className="flex items-center justify-between">
              <code className="text-sm font-mono font-semibold">
                {cfg.key || `Parameter ${index + 1}`}
              </code>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => dispatch({ type: 'REMOVE_CONFIG', index })}
                aria-label={`Remove config ${index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Key *</label>
                <Input
                  placeholder="review.strictness"
                  value={cfg.key}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_CONFIG',
                      index,
                      config: { ...cfg, key: e.target.value },
                    })
                  }
                  className="h-8 text-xs font-mono"
                />
                <FieldError message={getFieldError(`config[${index}].key`)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Label *</label>
                <Input
                  placeholder="Review Strictness"
                  value={cfg.label}
                  onChange={(e) =>
                    dispatch({
                      type: 'UPDATE_CONFIG',
                      index,
                      config: { ...cfg, label: e.target.value },
                    })
                  }
                  className="h-8 text-xs"
                />
                <FieldError message={getFieldError(`config[${index}].label`)} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Type</label>
                <Select
                  value={cfg.type}
                  onValueChange={(v) =>
                    dispatch({
                      type: 'UPDATE_CONFIG',
                      index,
                      config: { ...cfg, type: v as 'string' | 'number' | 'boolean' | 'string[]' },
                    })
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONFIG_TYPES.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium">Description</label>
              <Textarea
                placeholder="How strict the code review should be..."
                value={cfg.description}
                onChange={(e) =>
                  dispatch({
                    type: 'UPDATE_CONFIG',
                    index,
                    config: { ...cfg, description: e.target.value },
                  })
                }
                rows={2}
                className="text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-medium">Default Value</label>
                <Input
                  placeholder={cfg.type === 'number' ? '0' : cfg.type === 'boolean' ? 'true' : 'default'}
                  value={cfg.default != null ? String(cfg.default) : ''}
                  onChange={(e) => {
                    let val: unknown = e.target.value;
                    if (cfg.type === 'number') val = Number(e.target.value) || 0;
                    if (cfg.type === 'boolean') val = e.target.value === 'true';
                    dispatch({
                      type: 'UPDATE_CONFIG',
                      index,
                      config: { ...cfg, default: val || undefined },
                    });
                  }}
                  className="h-8 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium">Allowed Values (comma-separated)</label>
                <Input
                  placeholder="low, medium, high"
                  value={cfg.enum ? cfg.enum.join(', ') : ''}
                  onChange={(e) => {
                    const vals = e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean);
                    dispatch({
                      type: 'UPDATE_CONFIG',
                      index,
                      config: { ...cfg, enum: vals.length > 0 ? vals : undefined },
                    });
                  }}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {state.config.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground border rounded-lg border-dashed">
          No configuration parameters yet. Config is optional — add parameters to make the skill customizable.
        </div>
      )}
    </div>
  );
}
