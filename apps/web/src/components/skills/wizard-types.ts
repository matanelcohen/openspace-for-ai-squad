import type {
  SkillConfigSchema,
  SkillPromptTemplate,
  SkillToolDeclaration,
  SkillTrigger,
} from '@matanelcohen/openspace-shared';

import type { WizardFormState } from '@/hooks/use-skill-manifest-form';

export type FormAction =
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
