import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { WizardFormState } from '@/hooks/use-skill-manifest-form';
import { INITIAL_STATE } from '@/hooks/use-skill-manifest-form';

import { SkillCardPreview } from '../skill-card-preview';

function makeState(overrides: Partial<WizardFormState> = {}): WizardFormState {
  return { ...INITIAL_STATE, ...overrides };
}

describe('SkillCardPreview', () => {
  it('renders with default placeholder text', () => {
    render(<SkillCardPreview state={makeState()} />);
    expect(screen.getByTestId('skill-card-preview')).toBeInTheDocument();
    expect(screen.getByText('Skill Name')).toBeInTheDocument();
    expect(screen.getByText('Skill description will appear here...')).toBeInTheDocument();
    expect(screen.getByText('v0.1.0')).toBeInTheDocument();
  });

  it('shows custom name and description', () => {
    render(
      <SkillCardPreview
        state={makeState({ name: 'My Tool', description: 'Does cool things', version: '2.0.0' })}
      />,
    );
    expect(screen.getByText('My Tool')).toBeInTheDocument();
    expect(screen.getByText('Does cool things')).toBeInTheDocument();
    expect(screen.getByText('v2.0.0')).toBeInTheDocument();
  });

  it('renders tags (first 3) with overflow badge', () => {
    const tags = ['alpha', 'beta', 'gamma', 'delta', 'epsilon'];
    render(<SkillCardPreview state={makeState({ tags })} />);
    expect(screen.getByText('alpha')).toBeInTheDocument();
    expect(screen.getByText('beta')).toBeInTheDocument();
    expect(screen.getByText('gamma')).toBeInTheDocument();
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('shows "No tags" when tags array is empty', () => {
    render(<SkillCardPreview state={makeState({ tags: [] })} />);
    expect(screen.getByText('No tags')).toBeInTheDocument();
  });

  it('shows Draft badge', () => {
    render(<SkillCardPreview state={makeState()} />);
    expect(screen.getByText('Draft')).toBeInTheDocument();
  });

  it('renders manifest summary with correct counts', () => {
    render(
      <SkillCardPreview
        state={makeState({
          id: 'my-skill',
          tools: [{ toolId: 'grep', description: 'search', parameters: {} }] as any,
          triggers: [{ event: 'push' }] as any,
          prompts: [{ id: 'p1', name: 'p1', content: 'hello' }] as any,
          config: [{ key: 'k', label: 'K', type: 'string' }] as any,
          author: 'Fry',
        })}
      />,
    );
    expect(screen.getByText('my-skill')).toBeInTheDocument();
    expect(screen.getByText('1 declared')).toBeInTheDocument();
    expect(screen.getByText('1 rules')).toBeInTheDocument();
    expect(screen.getByText('1 templates')).toBeInTheDocument();
    expect(screen.getByText('1 parameters')).toBeInTheDocument();
    expect(screen.getByText('Fry')).toBeInTheDocument();
  });

  it('hides author row when not set', () => {
    render(<SkillCardPreview state={makeState({ author: '' })} />);
    expect(screen.queryByText('Author')).not.toBeInTheDocument();
  });

  it('shows placeholder ID when empty', () => {
    render(<SkillCardPreview state={makeState({ id: '' })} />);
    expect(screen.getByText('—')).toBeInTheDocument();
  });
});
