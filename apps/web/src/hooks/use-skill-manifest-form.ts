'use client';

import type {
  SkillConfigSchema,
  SkillManifest,
  SkillPermission,
  SkillPromptTemplate,
  SkillToolDeclaration,
  SkillTrigger,
} from '@matanelcohen/openspace-shared';
import { useCallback, useMemo, useReducer } from 'react';

// ── Form State ───────────────────────────────────────────────────

export interface WizardFormState {
  // Step 1: Basics
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon: string;
  tags: string[];
  license: string;
  homepage: string;

  // Step 2: Tools
  tools: SkillToolDeclaration[];

  // Step 3: Triggers
  triggers: SkillTrigger[];

  // Step 4: Prompts
  prompts: SkillPromptTemplate[];

  // Step 5: Config
  config: SkillConfigSchema[];

  // Advanced
  permissions: SkillPermission[];
  entryPoint: string;
  priority: number;
}

export interface ValidationError {
  field: string;
  message: string;
}

export const INITIAL_STATE: WizardFormState = {
  id: '',
  name: '',
  version: '0.1.0',
  description: '',
  author: '',
  icon: 'code',
  tags: [],
  license: 'MIT',
  homepage: '',
  tools: [],
  triggers: [],
  prompts: [],
  config: [],
  permissions: [],
  entryPoint: '',
  priority: 0,
};

// ── Actions ──────────────────────────────────────────────────────

type FormAction =
  | { type: 'SET_FIELD'; field: keyof WizardFormState; value: unknown }
  | { type: 'ADD_TOOL'; tool: SkillToolDeclaration }
  | { type: 'REMOVE_TOOL'; index: number }
  | { type: 'UPDATE_TOOL'; index: number; tool: SkillToolDeclaration }
  | { type: 'ADD_TRIGGER'; trigger: SkillTrigger }
  | { type: 'REMOVE_TRIGGER'; index: number }
  | { type: 'UPDATE_TRIGGER'; index: number; trigger: SkillTrigger }
  | { type: 'ADD_PROMPT'; prompt: SkillPromptTemplate }
  | { type: 'REMOVE_PROMPT'; index: number }
  | { type: 'UPDATE_PROMPT'; index: number; prompt: SkillPromptTemplate }
  | { type: 'ADD_CONFIG'; config: SkillConfigSchema }
  | { type: 'REMOVE_CONFIG'; index: number }
  | { type: 'UPDATE_CONFIG'; index: number; config: SkillConfigSchema }
  | { type: 'LOAD_FROM_JSON'; state: WizardFormState }
  | { type: 'RESET' };

function formReducer(state: WizardFormState, action: FormAction): WizardFormState {
  switch (action.type) {
    case 'SET_FIELD':
      return { ...state, [action.field]: action.value };

    case 'ADD_TOOL':
      return { ...state, tools: [...state.tools, action.tool] };
    case 'REMOVE_TOOL':
      return { ...state, tools: state.tools.filter((_, i) => i !== action.index) };
    case 'UPDATE_TOOL':
      return {
        ...state,
        tools: state.tools.map((t, i) => (i === action.index ? action.tool : t)),
      };

    case 'ADD_TRIGGER':
      return { ...state, triggers: [...state.triggers, action.trigger] };
    case 'REMOVE_TRIGGER':
      return { ...state, triggers: state.triggers.filter((_, i) => i !== action.index) };
    case 'UPDATE_TRIGGER':
      return {
        ...state,
        triggers: state.triggers.map((t, i) => (i === action.index ? action.trigger : t)),
      };

    case 'ADD_PROMPT':
      return { ...state, prompts: [...state.prompts, action.prompt] };
    case 'REMOVE_PROMPT':
      return { ...state, prompts: state.prompts.filter((_, i) => i !== action.index) };
    case 'UPDATE_PROMPT':
      return {
        ...state,
        prompts: state.prompts.map((p, i) => (i === action.index ? action.prompt : p)),
      };

    case 'ADD_CONFIG':
      return { ...state, config: [...state.config, action.config] };
    case 'REMOVE_CONFIG':
      return { ...state, config: state.config.filter((_, i) => i !== action.index) };
    case 'UPDATE_CONFIG':
      return {
        ...state,
        config: state.config.map((c, i) => (i === action.index ? action.config : c)),
      };

    case 'LOAD_FROM_JSON':
      return action.state;

    case 'RESET':
      return INITIAL_STATE;

    default:
      return state;
  }
}

// ── Validation ───────────────────────────────────────────────────

const KEBAB_CASE_RE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(-[\w.]+)?$/;

export function validateManifest(state: WizardFormState): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!state.id.trim()) {
    errors.push({ field: 'id', message: 'Skill ID is required' });
  } else if (!KEBAB_CASE_RE.test(state.id)) {
    errors.push({ field: 'id', message: 'ID must be kebab-case (e.g. "code-review")' });
  }

  if (!state.name.trim()) {
    errors.push({ field: 'name', message: 'Skill name is required' });
  }

  if (!state.version.trim()) {
    errors.push({ field: 'version', message: 'Version is required' });
  } else if (!SEMVER_RE.test(state.version)) {
    errors.push({ field: 'version', message: 'Version must be semver (e.g. "1.0.0")' });
  }

  if (!state.description.trim()) {
    errors.push({ field: 'description', message: 'Description is required' });
  }

  if (state.tools.length === 0) {
    errors.push({ field: 'tools', message: 'At least one tool declaration is required' });
  }

  state.tools.forEach((tool, i) => {
    if (!tool.toolId.trim()) {
      errors.push({ field: `tools[${i}].toolId`, message: `Tool ${i + 1}: Tool ID is required` });
    }
  });

  if (state.triggers.length === 0) {
    errors.push({ field: 'triggers', message: 'At least one trigger is required' });
  }

  if (state.prompts.length === 0) {
    errors.push({ field: 'prompts', message: 'At least one prompt template is required' });
  }

  state.prompts.forEach((prompt, i) => {
    if (!prompt.id.trim()) {
      errors.push({ field: `prompts[${i}].id`, message: `Prompt ${i + 1}: ID is required` });
    }
    if (!prompt.name.trim()) {
      errors.push({ field: `prompts[${i}].name`, message: `Prompt ${i + 1}: Name is required` });
    }
    if (!prompt.content.trim()) {
      errors.push({
        field: `prompts[${i}].content`,
        message: `Prompt ${i + 1}: Content is required`,
      });
    }
  });

  state.config.forEach((cfg, i) => {
    if (!cfg.key.trim()) {
      errors.push({ field: `config[${i}].key`, message: `Config ${i + 1}: Key is required` });
    }
    if (!cfg.label.trim()) {
      errors.push({ field: `config[${i}].label`, message: `Config ${i + 1}: Label is required` });
    }
  });

  return errors;
}

export function validateStep(state: WizardFormState, step: number): ValidationError[] {
  const all = validateManifest(state);
  const stepFieldPrefixes: Record<number, string[]> = {
    0: ['id', 'name', 'version', 'description'],
    1: ['tools'],
    2: ['triggers'],
    3: ['prompts'],
    4: ['config'],
  };
  const prefixes = stepFieldPrefixes[step] ?? [];
  return all.filter((e) => prefixes.some((p) => e.field === p || e.field.startsWith(`${p}[`)));
}

// ── Manifest Serialization ───────────────────────────────────────

export function formStateToManifest(state: WizardFormState): SkillManifest {
  const manifest: SkillManifest = {
    manifestVersion: 1,
    id: state.id,
    name: state.name,
    version: state.version,
    description: state.description,
    tools: state.tools,
    prompts: state.prompts,
    triggers: state.triggers,
  };

  if (state.author) manifest.author = state.author;
  if (state.license) manifest.license = state.license;
  if (state.homepage) manifest.homepage = state.homepage;
  if (state.tags.length > 0) manifest.tags = state.tags as SkillManifest['tags'];
  if (state.icon) manifest.icon = state.icon;
  if (state.config.length > 0) manifest.config = state.config;
  if (state.permissions.length > 0) manifest.permissions = state.permissions;
  if (state.entryPoint) manifest.entryPoint = state.entryPoint;
  if (state.priority !== 0) (manifest as unknown as Record<string, unknown>).priority = state.priority;

  return manifest;
}

export function manifestToFormState(manifest: SkillManifest): WizardFormState {
  return {
    id: manifest.id ?? '',
    name: manifest.name ?? '',
    version: manifest.version ?? '0.1.0',
    description: manifest.description ?? '',
    author: manifest.author ?? '',
    icon: manifest.icon ?? 'code',
    tags: (manifest.tags as string[] | undefined) ?? [],
    license: manifest.license ?? '',
    homepage: manifest.homepage ?? '',
    tools: manifest.tools ?? [],
    triggers: manifest.triggers ?? [],
    prompts: manifest.prompts ?? [],
    config: manifest.config ?? [],
    permissions: manifest.permissions ?? [],
    entryPoint: manifest.entryPoint ?? '',
    priority: (manifest as unknown as Record<string, unknown>).priority as number ?? 0,
  };
}

// ── Hook ─────────────────────────────────────────────────────────

export function useSkillManifestForm(initial?: Partial<WizardFormState>) {
  const [state, dispatch] = useReducer(
    formReducer,
    initial ? { ...INITIAL_STATE, ...initial } : INITIAL_STATE,
  );

  const setField = useCallback(
    <K extends keyof WizardFormState>(field: K, value: WizardFormState[K]) => {
      dispatch({ type: 'SET_FIELD', field, value });
    },
    [],
  );

  const errors = useMemo(() => validateManifest(state), [state]);
  const manifest = useMemo(() => formStateToManifest(state), [state]);
  const manifestJson = useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);

  const getStepErrors = useCallback((step: number) => validateStep(state, step), [state]);

  const hasFieldError = useCallback(
    (field: string) => errors.some((e) => e.field === field || e.field.startsWith(`${field}[`)),
    [errors],
  );

  const getFieldError = useCallback(
    (field: string) => errors.find((e) => e.field === field)?.message,
    [errors],
  );

  const loadFromJson = useCallback((json: string): ValidationError[] => {
    try {
      const parsed = JSON.parse(json) as SkillManifest;
      const newState = manifestToFormState(parsed);
      dispatch({ type: 'LOAD_FROM_JSON', state: newState });
      return validateManifest(newState);
    } catch {
      return [{ field: '_json', message: 'Invalid JSON syntax' }];
    }
  }, []);

  const reset = useCallback(() => dispatch({ type: 'RESET' }), []);

  return {
    state,
    dispatch,
    setField,
    errors,
    manifest,
    manifestJson,
    getStepErrors,
    hasFieldError,
    getFieldError,
    loadFromJson,
    reset,
    isValid: errors.length === 0,
  };
}
