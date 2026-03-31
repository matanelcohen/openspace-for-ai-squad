import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  formStateToManifest,
  INITIAL_STATE,
  manifestToFormState,
  useSkillManifestForm,
  validateManifest,
  validateStep,
} from '../use-skill-manifest-form';

describe('INITIAL_STATE', () => {
  it('has expected defaults', () => {
    expect(INITIAL_STATE.id).toBe('');
    expect(INITIAL_STATE.version).toBe('0.1.0');
    expect(INITIAL_STATE.icon).toBe('code');
    expect(INITIAL_STATE.tools).toEqual([]);
    expect(INITIAL_STATE.tags).toEqual([]);
  });
});

describe('validateManifest', () => {
  it('returns errors for empty state', () => {
    const errors = validateManifest(INITIAL_STATE);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'id')).toBe(true);
    expect(errors.some((e) => e.field === 'name')).toBe(true);
    expect(errors.some((e) => e.field === 'description')).toBe(true);
    expect(errors.some((e) => e.field === 'tools')).toBe(true);
    expect(errors.some((e) => e.field === 'triggers')).toBe(true);
    expect(errors.some((e) => e.field === 'prompts')).toBe(true);
  });

  it('validates kebab-case ID', () => {
    const state = { ...INITIAL_STATE, id: 'Not Kebab' };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'id' && e.message.includes('kebab-case'))).toBe(true);
  });

  it('accepts valid kebab-case ID', () => {
    const state = { ...INITIAL_STATE, id: 'my-skill' };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'id' && e.message.includes('kebab-case'))).toBe(false);
  });

  it('validates semver version', () => {
    const state = { ...INITIAL_STATE, version: 'bad' };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'version' && e.message.includes('semver'))).toBe(true);
  });

  it('accepts valid semver', () => {
    const state = { ...INITIAL_STATE, version: '1.2.3' };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field === 'version' && e.message.includes('semver'))).toBe(false);
  });

  it('validates tool IDs', () => {
    const state = {
      ...INITIAL_STATE,
      tools: [{ toolId: '', description: 'desc', parameters: {} }] as any,
    };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field.startsWith('tools[') && e.message.includes('Tool ID'))).toBe(
      true,
    );
  });

  it('validates prompt fields', () => {
    const state = {
      ...INITIAL_STATE,
      prompts: [{ id: '', name: '', content: '' }] as any,
    };
    const errors = validateManifest(state);
    expect(errors.some((e) => e.field.includes('prompts[0].id'))).toBe(true);
    expect(errors.some((e) => e.field.includes('prompts[0].name'))).toBe(true);
    expect(errors.some((e) => e.field.includes('prompts[0].content'))).toBe(true);
  });

  it('returns no errors for valid full state', () => {
    const valid = {
      ...INITIAL_STATE,
      id: 'my-skill',
      name: 'My Skill',
      version: '1.0.0',
      description: 'A test skill',
      tools: [{ toolId: 'grep', description: 'search', parameters: {} }] as any,
      triggers: [{ event: 'push' }] as any,
      prompts: [{ id: 'p1', name: 'Prompt 1', content: 'Hello' }] as any,
    };
    expect(validateManifest(valid)).toEqual([]);
  });
});

describe('validateStep', () => {
  it('returns only step 0 errors for step 0', () => {
    const errors = validateStep(INITIAL_STATE, 0);
    for (const e of errors) {
      expect(['id', 'name', 'version', 'description']).toContain(e.field);
    }
  });

  it('returns only tool errors for step 1', () => {
    const errors = validateStep(INITIAL_STATE, 1);
    for (const e of errors) {
      expect(e.field.startsWith('tools')).toBe(true);
    }
  });
});

describe('formStateToManifest', () => {
  it('produces minimal manifest from initial state', () => {
    const manifest = formStateToManifest(INITIAL_STATE);
    expect(manifest.manifestVersion).toBe(1);
    expect(manifest.id).toBe('');
    expect(manifest.tools).toEqual([]);
  });

  it('includes optional fields when present', () => {
    const state = {
      ...INITIAL_STATE,
      id: 'test',
      author: 'Fry',
      tags: ['frontend'],
      homepage: 'https://example.com',
    };
    const manifest = formStateToManifest(state);
    expect(manifest.author).toBe('Fry');
    expect(manifest.tags).toEqual(['frontend']);
    expect(manifest.homepage).toBe('https://example.com');
  });
});

describe('manifestToFormState', () => {
  it('converts manifest back to form state', () => {
    const manifest = {
      manifestVersion: 1,
      id: 'my-skill',
      name: 'My Skill',
      version: '1.0.0',
      description: 'desc',
      tools: [],
      prompts: [],
      triggers: [],
      author: 'Fry',
    };
    const state = manifestToFormState(manifest as any);
    expect(state.id).toBe('my-skill');
    expect(state.name).toBe('My Skill');
    expect(state.author).toBe('Fry');
  });

  it('handles missing optional fields', () => {
    const manifest = {
      manifestVersion: 1,
      id: 'x',
      name: 'X',
      description: 'd',
      tools: [],
      prompts: [],
      triggers: [],
    };
    const state = manifestToFormState(manifest as any);
    expect(state.author).toBe('');
    expect(state.tags).toEqual([]);
    expect(state.config).toEqual([]);
  });
});

describe('useSkillManifestForm', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    expect(result.current.state).toEqual(INITIAL_STATE);
    expect(result.current.isValid).toBe(false);
  });

  it('initializes with custom partial state', () => {
    const { result } = renderHook(() =>
      useSkillManifestForm({ name: 'Custom', id: 'custom' }),
    );
    expect(result.current.state.name).toBe('Custom');
    expect(result.current.state.id).toBe('custom');
    expect(result.current.state.version).toBe('0.1.0'); // default
  });

  it('setField updates a field', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    act(() => result.current.setField('name', 'Updated'));
    expect(result.current.state.name).toBe('Updated');
  });

  it('dispatch ADD_TOOL adds a tool', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    act(() => {
      result.current.dispatch({
        type: 'ADD_TOOL',
        tool: { toolId: 'grep', description: 'search', parameters: {} } as any,
      });
    });
    expect(result.current.state.tools).toHaveLength(1);
    expect(result.current.state.tools[0].toolId).toBe('grep');
  });

  it('dispatch REMOVE_TOOL removes by index', () => {
    const { result } = renderHook(() =>
      useSkillManifestForm({
        tools: [
          { toolId: 'a', description: '', parameters: {} },
          { toolId: 'b', description: '', parameters: {} },
        ] as any,
      }),
    );
    act(() => result.current.dispatch({ type: 'REMOVE_TOOL', index: 0 }));
    expect(result.current.state.tools).toHaveLength(1);
    expect(result.current.state.tools[0].toolId).toBe('b');
  });

  it('dispatch ADD_PROMPT adds a prompt', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    act(() => {
      result.current.dispatch({
        type: 'ADD_PROMPT',
        prompt: { id: 'p1', name: 'P1', content: 'Hello' } as any,
      });
    });
    expect(result.current.state.prompts).toHaveLength(1);
  });

  it('dispatch RESET returns to INITIAL_STATE', () => {
    const { result } = renderHook(() => useSkillManifestForm({ name: 'Custom' }));
    act(() => result.current.dispatch({ type: 'RESET' }));
    expect(result.current.state).toEqual(INITIAL_STATE);
  });

  it('loadFromJson loads valid JSON', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    const json = JSON.stringify({
      manifestVersion: 1,
      id: 'loaded',
      name: 'Loaded Skill',
      version: '2.0.0',
      description: 'From JSON',
      tools: [],
      prompts: [],
      triggers: [],
    });
    act(() => {
      const errors = result.current.loadFromJson(json);
      // There will be validation errors (empty tools, triggers, prompts)
      expect(errors.length).toBeGreaterThan(0);
    });
    expect(result.current.state.id).toBe('loaded');
    expect(result.current.state.name).toBe('Loaded Skill');
  });

  it('loadFromJson returns error for invalid JSON', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    let errors: any[];
    act(() => {
      errors = result.current.loadFromJson('not json');
    });
    expect(errors!.some((e: any) => e.field === '_json')).toBe(true);
  });

  it('hasFieldError detects errors', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    expect(result.current.hasFieldError('id')).toBe(true);
    expect(result.current.hasFieldError('nonexistent')).toBe(false);
  });

  it('getFieldError returns message', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    expect(result.current.getFieldError('id')).toBe('Skill ID is required');
  });

  it('manifestJson is valid JSON', () => {
    const { result } = renderHook(() => useSkillManifestForm());
    expect(() => JSON.parse(result.current.manifestJson)).not.toThrow();
  });

  it('isValid is true for complete state', () => {
    const { result } = renderHook(() =>
      useSkillManifestForm({
        id: 'my-skill',
        name: 'My Skill',
        version: '1.0.0',
        description: 'desc',
        tools: [{ toolId: 'grep', description: 'search', parameters: {} }] as any,
        triggers: [{ event: 'push' }] as any,
        prompts: [{ id: 'p1', name: 'P1', content: 'content' }] as any,
      }),
    );
    expect(result.current.isValid).toBe(true);
  });
});
