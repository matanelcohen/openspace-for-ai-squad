import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

import { SkillDetailInstructions } from '../skill-detail-instructions';

function makeSkill(instructions?: string): SkillDetail {
  return {
    phase: 'loaded' as any,
    manifest: {
      manifestVersion: 1,
      id: 'my-skill',
      name: 'My Skill',
      version: '1.0.0',
      description: 'Test',
      tools: [],
      prompts: [],
      triggers: [],
      ...(instructions !== undefined ? { instructions } : {}),
    } as any,
  };
}

describe('SkillDetailInstructions', () => {
  it('renders the section heading', () => {
    render(<SkillDetailInstructions skill={makeSkill('Do this thing.')} />);
    expect(screen.getByTestId('skill-detail-instructions')).toBeInTheDocument();
    expect(screen.getByText('Skill Instructions')).toBeInTheDocument();
  });

  it('shows instructions text in a pre block', () => {
    render(<SkillDetailInstructions skill={makeSkill('Step 1: Install deps\nStep 2: Run')} />);
    const pre = screen.getByText(/Step 1: Install deps/);
    expect(pre).toBeInTheDocument();
    expect(pre.tagName).toBe('PRE');
  });

  it('shows placeholder when no instructions', () => {
    render(<SkillDetailInstructions skill={makeSkill()} />);
    expect(screen.getByText('No instructions defined for this skill.')).toBeInTheDocument();
  });

  it('shows placeholder for empty string instructions', () => {
    render(<SkillDetailInstructions skill={makeSkill(undefined)} />);
    expect(screen.getByText('No instructions defined for this skill.')).toBeInTheDocument();
  });
});
