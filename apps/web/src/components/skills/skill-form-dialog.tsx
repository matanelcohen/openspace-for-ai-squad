'use client';

import { Plus, X } from 'lucide-react';
import { useCallback, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { useCreateSkill, useUpdateSkill } from '@/hooks/use-skills';
import type { SkillDetail } from '@/hooks/use-skills';
import { cn } from '@/lib/utils';

// ── Types ────────────────────────────────────────────────────────

interface SkillFormData {
  name: string;
  description: string;
  tags: string[];
  roles: string[];
  bins: string[];
  env: string[];
  instructions: string;
}

interface FieldErrors {
  name?: string;
  description?: string;
  instructions?: string;
}

const AVAILABLE_ROLES = [
  { value: '*', label: 'All (*)' },
  { value: 'none', label: 'None (manual only)' },
  { value: 'lead', label: 'Lead' },
  { value: 'frontend-dev', label: 'Frontend Dev' },
  { value: 'backend-dev', label: 'Backend Dev' },
  { value: 'tester', label: 'Tester' },
] as const;

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

function toKebabCase(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+/, '');
}

function validate(data: SkillFormData): FieldErrors {
  const errors: FieldErrors = {};
  const name = data.name.trim();
  if (!name) {
    errors.name = 'Name is required';
  } else if (!KEBAB_CASE_RE.test(name)) {
    errors.name = 'Name must be kebab-case (e.g. "code-review")';
  }
  if (!data.description.trim()) {
    errors.description = 'Description is required';
  }
  if (!data.instructions.trim()) {
    errors.instructions = 'Instructions are required';
  }
  return errors;
}

// ── Component ────────────────────────────────────────────────────

interface SkillFormDialogProps {
  trigger?: React.ReactNode;
  onCreated?: (skillId: string) => void;
  skill?: SkillDetail;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function SkillFormDialog({
  trigger,
  onCreated,
  skill,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
}: SkillFormDialogProps) {
  const isEditMode = !!skill;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = controlledOnOpenChange ?? setInternalOpen;
  const [submitted, setSubmitted] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [binInput, setBinInput] = useState('');
  const [envInput, setEnvInput] = useState('');

  const initialForm: SkillFormData = skill
    ? {
        name: skill.manifest.id,
        description: skill.manifest.description,
        tags: skill.manifest.tags ?? [],
        roles: (skill.manifest as unknown as Record<string, unknown>).agentMatch
          ? ((skill.manifest as unknown as Record<string, unknown>).agentMatch as { roles: string[] }).roles
          : ['*'],
        bins: (skill.manifest as unknown as Record<string, unknown>).requires
          ? ((skill.manifest as unknown as Record<string, unknown>).requires as { bins?: string[] }).bins ?? []
          : [],
        env: (skill.manifest as unknown as Record<string, unknown>).requires
          ? ((skill.manifest as unknown as Record<string, unknown>).requires as { env?: string[] }).env ?? []
          : [],
        instructions:
          ((skill.manifest as unknown as Record<string, unknown>).instructions as string) ?? '',
      }
    : {
        name: '',
        description: '',
        tags: [],
        roles: ['*'],
        bins: [],
        env: [],
        instructions: '',
      };

  const [form, setForm] = useState<SkillFormData>(initialForm);

  const createSkill = useCreateSkill();
  const updateSkill = useUpdateSkill();
  const activeMutation = isEditMode ? updateSkill : createSkill;
  const errors = submitted ? validate(form) : {};
  const hasErrors = Object.keys(errors).length > 0;

  const updateField = useCallback(
    <K extends keyof SkillFormData>(field: K, value: SkillFormData[K]) => {
      setForm((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleNameChange = useCallback(
    (raw: string) => {
      updateField('name', toKebabCase(raw));
    },
    [updateField],
  );

  // ── Chip helpers ──────────────────────────────────────────────

  const addChip = useCallback((field: 'tags' | 'bins' | 'env', value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setForm((prev) => {
      if (prev[field].includes(trimmed)) return prev;
      return { ...prev, [field]: [...prev[field], trimmed] };
    });
  }, []);

  const removeChip = useCallback((field: 'tags' | 'bins' | 'env', value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((v) => v !== value),
    }));
  }, []);

  const handleChipKeyDown = useCallback(
    (
      field: 'tags' | 'bins' | 'env',
      inputValue: string,
      setInput: (v: string) => void,
      e: React.KeyboardEvent,
    ) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        // Support comma-separated values
        const values = inputValue
          .split(',')
          .map((v) => v.trim())
          .filter(Boolean);
        for (const v of values) addChip(field, v);
        setInput('');
      }
    },
    [addChip],
  );

  // ── Roles ─────────────────────────────────────────────────────

  const toggleRole = useCallback((role: string) => {
    setForm((prev) => {
      if (role === '*') {
        return { ...prev, roles: ['*'] };
      }
      if (role === 'none') {
        return { ...prev, roles: [] };
      }
      const without = prev.roles.filter((r) => r !== '*' && r !== role);
      const has = prev.roles.includes(role);
      const next = has ? without : [...without, role];
      return { ...prev, roles: next.length === 0 ? [] : next };
    });
  }, []);

  // ── Reset & Submit ──────────────────────────────────────────────

  const resetForm = useCallback(() => {
    setForm(initialForm);
    setSubmitted(false);
    setTagInput('');
    setBinInput('');
    setEnvInput('');
  }, [initialForm]);

  const handleSubmit = useCallback(async () => {
    setSubmitted(true);
    const validationErrors = validate(form);
    if (Object.keys(validationErrors).length > 0) return;

    const payload = {
      name: form.name,
      description: form.description,
      tags: form.tags,
      agentMatch: { roles: form.roles },
      requires: { bins: form.bins, env: form.env },
      instructions: form.instructions,
    };

    try {
      if (isEditMode) {
        await updateSkill.mutateAsync({ id: skill.manifest.id, ...payload });
        setOpen(false);
        onCreated?.(skill.manifest.id);
      } else {
        const result = await createSkill.mutateAsync(payload);
        setOpen(false);
        resetForm();
        onCreated?.(result.id ?? result.name);
      }
    } catch {
      // Error is handled by react-query
    }
  }, [form, isEditMode, skill, createSkill, updateSkill, onCreated, resetForm, setOpen]);

  const handleOpenChange = useCallback(
    (nextOpen: boolean) => {
      setOpen(nextOpen);
      if (!nextOpen) resetForm();
    },
    [resetForm],
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      {!trigger && !isEditMode && (
        <DialogTrigger asChild>
          <Button data-testid="create-skill-btn">
            <Plus className="h-4 w-4 mr-2" />
            Create Skill
          </Button>
        </DialogTrigger>
      )}
      <DialogContent
        className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0"
        data-testid="skill-form-dialog"
      >
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle>{isEditMode ? 'Edit Skill' : 'Create New Skill'}</DialogTitle>
          <DialogDescription>
            {isEditMode
              ? 'Update the skill definition.'
              : 'Define a skill that teaches AI agents how to use a capability.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0">
          <div className="space-y-5 p-6">
            {/* Name */}
            <div className="space-y-1.5">
              <label htmlFor="skill-name" className="text-sm font-medium">
                Name <span className="text-destructive">*</span>
              </label>
              <Input
                id="skill-name"
                placeholder="code-review"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className={cn(errors.name && 'border-destructive')}
                data-testid="skill-field-name"
                disabled={isEditMode}
              />
              <p className="text-xs text-muted-foreground">
                Kebab-case identifier (e.g. &quot;code-review&quot;, &quot;file-operations&quot;)
              </p>
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label htmlFor="skill-description" className="text-sm font-medium">
                Description <span className="text-destructive">*</span>
              </label>
              <Input
                id="skill-description"
                placeholder="Run automated code reviews with configurable strictness"
                value={form.description}
                onChange={(e) => updateField('description', e.target.value)}
                className={cn(errors.description && 'border-destructive')}
                data-testid="skill-field-description"
              />
              {errors.description && (
                <p className="text-xs text-destructive">{errors.description}</p>
              )}
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label htmlFor="skill-tags" className="text-sm font-medium">
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {form.tags.map((tag) => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeChip('tags', tag)}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                      aria-label={`Remove tag ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                id="skill-tags"
                placeholder="Type a tag and press Enter (e.g. core, code, quality)"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => handleChipKeyDown('tags', tagInput, setTagInput, e)}
                onBlur={() => {
                  if (tagInput.trim()) {
                    const values = tagInput
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean);
                    for (const v of values) addChip('tags', v);
                    setTagInput('');
                  }
                }}
                data-testid="skill-field-tags"
              />
            </div>

            {/* Agent Roles */}
            <div className="space-y-1.5">
              <span className="text-sm font-medium">Agent Roles</span>
              <p className="text-xs text-muted-foreground">Which agent roles can use this skill.</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {AVAILABLE_ROLES.map(({ value, label }) => {
                  const isActive = value === 'none'
                    ? form.roles.length === 0
                    : form.roles.includes(value);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => toggleRole(value)}
                      className={cn(
                        'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors border',
                        isActive
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-muted-foreground border-input hover:bg-muted',
                      )}
                      data-testid={`skill-role-${value}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Required Binaries */}
            <div className="space-y-1.5">
              <label htmlFor="skill-bins" className="text-sm font-medium">
                Required Binaries <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {form.bins.map((bin) => (
                  <Badge key={bin} variant="outline" className="gap-1 pr-1 font-mono text-xs">
                    {bin}
                    <button
                      type="button"
                      onClick={() => removeChip('bins', bin)}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                      aria-label={`Remove binary ${bin}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                id="skill-bins"
                placeholder="e.g. node, pnpm, git"
                value={binInput}
                onChange={(e) => setBinInput(e.target.value)}
                onKeyDown={(e) => handleChipKeyDown('bins', binInput, setBinInput, e)}
                onBlur={() => {
                  if (binInput.trim()) {
                    const values = binInput
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean);
                    for (const v of values) addChip('bins', v);
                    setBinInput('');
                  }
                }}
                data-testid="skill-field-bins"
              />
            </div>

            {/* Required Env Vars */}
            <div className="space-y-1.5">
              <label htmlFor="skill-env" className="text-sm font-medium">
                Required Env Vars <span className="text-xs text-muted-foreground">(optional)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-1.5">
                {form.env.map((envVar) => (
                  <Badge key={envVar} variant="outline" className="gap-1 pr-1 font-mono text-xs">
                    {envVar}
                    <button
                      type="button"
                      onClick={() => removeChip('env', envVar)}
                      className="rounded-full hover:bg-muted-foreground/20 p-0.5"
                      aria-label={`Remove env var ${envVar}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
              <Input
                id="skill-env"
                placeholder="e.g. OPENAI_API_KEY, DATABASE_URL"
                value={envInput}
                onChange={(e) => setEnvInput(e.target.value)}
                onKeyDown={(e) => handleChipKeyDown('env', envInput, setEnvInput, e)}
                onBlur={() => {
                  if (envInput.trim()) {
                    const values = envInput
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean);
                    for (const v of values) addChip('env', v);
                    setEnvInput('');
                  }
                }}
                data-testid="skill-field-env"
              />
            </div>

            {/* Instructions */}
            <div className="space-y-1.5">
              <label htmlFor="skill-instructions" className="text-sm font-medium">
                Instructions <span className="text-destructive">*</span>
              </label>
              <p className="text-xs text-muted-foreground">
                Markdown instructions that teach the AI how to use this skill.
              </p>
              <Textarea
                id="skill-instructions"
                placeholder={`## Code Review\n\n- Analyze diffs for bugs, security issues, and style violations\n- Provide actionable feedback with file and line references\n\n### Guidelines\n- Be constructive, not critical\n- Focus on logic errors over style preferences`}
                value={form.instructions}
                onChange={(e) => updateField('instructions', e.target.value)}
                className={cn(
                  'min-h-[200px] font-mono text-sm',
                  errors.instructions && 'border-destructive',
                )}
                data-testid="skill-field-instructions"
              />
              {errors.instructions && (
                <p className="text-xs text-destructive">{errors.instructions}</p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/20">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            data-testid="skill-form-cancel"
          >
            Cancel
          </Button>

          <div className="flex items-center gap-2">
            {submitted && hasErrors && (
              <span className="text-xs text-destructive">Please fix the errors above</span>
            )}
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={activeMutation.isPending}
              data-testid="skill-form-submit"
            >
              {activeMutation.isPending
                ? isEditMode
                  ? 'Saving...'
                  : 'Creating...'
                : isEditMode
                  ? 'Save Changes'
                  : 'Create Skill'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
