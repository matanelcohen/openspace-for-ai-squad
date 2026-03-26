'use client';

import { Info } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
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

const ICON_OPTIONS = [
  'code',
  'code-generation',
  'code-analysis',
  'testing',
  'deployment',
  'data-retrieval',
  'communication',
  'file-system',
  'search',
  'monitoring',
  'security',
  'documentation',
  'integration',
  'database',
  'shield',
] as const;

const TAG_OPTIONS = [
  'code-generation',
  'code-analysis',
  'testing',
  'deployment',
  'data-retrieval',
  'communication',
  'file-system',
  'search',
  'monitoring',
  'security',
  'documentation',
  'integration',
] as const;

interface WizardStepBasicsProps {
  state: WizardFormState;
  setField: <K extends keyof WizardFormState>(field: K, value: WizardFormState[K]) => void;
  getFieldError: (field: string) => string | undefined;
}

function FieldLabel({
  htmlFor,
  label,
  required,
  hint,
}: {
  htmlFor: string;
  label: string;
  required?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </label>
      {hint && (
        <span title={hint} className="text-muted-foreground">
          <Info className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-destructive" role="alert">{message}</p>;
}

export function WizardStepBasics({ state, setField, getFieldError }: WizardStepBasicsProps) {
  const toggleTag = (tag: string) => {
    const next = state.tags.includes(tag)
      ? state.tags.filter((t) => t !== tag)
      : [...state.tags, tag];
    setField('tags', next);
  };

  const handleNameChange = (name: string) => {
    setField('name', name);
    // Auto-generate ID from name if ID is empty or was auto-generated
    const autoId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    if (!state.id || state.id === autoId.slice(0, -1) || state.id === autoId) {
      setField('id', autoId);
    }
  };

  return (
    <div className="space-y-5" data-testid="wizard-step-basics">
      <div className="space-y-1.5">
        <FieldLabel htmlFor="skill-name" label="Skill Name" required hint="Human-readable display name" />
        <Input
          id="skill-name"
          placeholder="Code Review"
          value={state.name}
          onChange={(e) => handleNameChange(e.target.value)}
          aria-invalid={!!getFieldError('name')}
        />
        <FieldError message={getFieldError('name')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="skill-id" label="Skill ID" required hint="Kebab-case unique identifier" />
          <Input
            id="skill-id"
            placeholder="code-review"
            value={state.id}
            onChange={(e) => setField('id', e.target.value)}
            aria-invalid={!!getFieldError('id')}
          />
          <FieldError message={getFieldError('id')} />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="skill-version" label="Version" required hint="Semantic version (e.g. 1.0.0)" />
          <Input
            id="skill-version"
            placeholder="0.1.0"
            value={state.version}
            onChange={(e) => setField('version', e.target.value)}
            aria-invalid={!!getFieldError('version')}
          />
          <FieldError message={getFieldError('version')} />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="skill-description" label="Description" required hint="Brief description shown in UI and agent context" />
        <Textarea
          id="skill-description"
          placeholder="Performs automated code reviews with configurable strictness levels..."
          value={state.description}
          onChange={(e) => setField('description', e.target.value)}
          rows={3}
          aria-invalid={!!getFieldError('description')}
        />
        <FieldError message={getFieldError('description')} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="skill-author" label="Author" />
          <Input
            id="skill-author"
            placeholder="Team name or @handle"
            value={state.author}
            onChange={(e) => setField('author', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="skill-icon" label="Icon" hint="Icon displayed on skill card" />
          <Select value={state.icon} onValueChange={(v) => setField('icon', v)}>
            <SelectTrigger id="skill-icon">
              <SelectValue placeholder="Select icon" />
            </SelectTrigger>
            <SelectContent>
              {ICON_OPTIONS.map((icon) => (
                <SelectItem key={icon} value={icon}>
                  {icon}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <FieldLabel htmlFor="skill-license" label="License" hint="SPDX license identifier" />
          <Input
            id="skill-license"
            placeholder="MIT"
            value={state.license}
            onChange={(e) => setField('license', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <FieldLabel htmlFor="skill-homepage" label="Homepage" hint="URL to docs or repository" />
          <Input
            id="skill-homepage"
            placeholder="https://github.com/..."
            value={state.homepage}
            onChange={(e) => setField('homepage', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <FieldLabel htmlFor="skill-tags" label="Tags" hint="Capability tags for discovery and filtering" />
        <div className="flex flex-wrap gap-1.5" id="skill-tags" role="group" aria-label="Capability tags">
          {TAG_OPTIONS.map((tag) => (
            <Badge
              key={tag}
              variant={state.tags.includes(tag) ? 'default' : 'outline'}
              className="cursor-pointer select-none"
              onClick={() => toggleTag(tag)}
              role="checkbox"
              aria-checked={state.tags.includes(tag)}
              data-testid={`tag-${tag}`}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
