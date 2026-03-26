import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

import { SkillDetailPrompts } from '../skill-detail-prompts';

// ── Fixtures ─────────────────────────────────────────────────────

const baseManifest = {
  manifestVersion: 1,
  id: 'code-review',
  name: 'Code Review',
  version: '1.0.0',
  description: 'Reviews code.',
  author: 'openspace',
  tags: [],
  tools: [],
  triggers: [],
};

function makeSkill(overrides: Partial<SkillDetail['manifest']> = {}): SkillDetail {
  return {
    manifest: { ...baseManifest, prompts: [], ...overrides },
    phase: 'active',
  } as unknown as SkillDetail;
}

// ── Tests ────────────────────────────────────────────────────────

describe('SkillDetailPrompts', () => {
  it('renders the container with testid', () => {
    render(<SkillDetailPrompts skill={makeSkill()} />);
    expect(screen.getByTestId('skill-detail-prompts')).toBeInTheDocument();
  });

  it('shows "0 prompt templates" when no prompts', () => {
    render(<SkillDetailPrompts skill={makeSkill({ prompts: [] })} />);
    expect(screen.getByText('0 prompt templates')).toBeInTheDocument();
  });

  it('shows empty message when no prompts', () => {
    render(<SkillDetailPrompts skill={makeSkill({ prompts: [] })} />);
    expect(
      screen.getByText('This skill does not define any prompt templates.'),
    ).toBeInTheDocument();
  });

  it('shows singular "template" for exactly 1 prompt', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'System Prompt', role: 'system', content: 'You are helpful.' }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('1 prompt template')).toBeInTheDocument();
  });

  it('shows plural "templates" for multiple prompts', () => {
    const skill = makeSkill({
      prompts: [
        { id: 'p1', name: 'System', role: 'system', content: 'System prompt.' },
        { id: 'p2', name: 'Planning', role: 'planning', content: 'Plan prompt.' },
      ],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('2 prompt templates')).toBeInTheDocument();
  });

  it('renders prompt names', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'Review Instructions', role: 'system', content: 'test' }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('Review Instructions')).toBeInTheDocument();
  });

  it('renders prompt role badges', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'Test', role: 'system', content: 'test' }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('system')).toBeInTheDocument();
  });

  it('renders prompt content in pre block', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'Test', role: 'system', content: 'You are a code reviewer.' }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('You are a code reviewer.')).toBeInTheDocument();
  });

  it('renders maxTokens when present', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'Test', role: 'system', content: 'test', maxTokens: 4096 }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('max 4096 tokens')).toBeInTheDocument();
  });

  it('does not render maxTokens when absent', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'Test', role: 'system', content: 'test' }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.queryByText(/max.*tokens/)).not.toBeInTheDocument();
  });

  it('renders variables when present', () => {
    const skill = makeSkill({
      prompts: [
        {
          id: 'p1',
          name: 'Test',
          role: 'system',
          content: 'Review {{file}} for {{language}}',
          variables: [
            { name: 'file', required: true },
            { name: 'language', required: false },
          ],
        },
      ],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('Variables:')).toBeInTheDocument();
    // Variables are wrapped in {{ }}, check the badge elements
    const badges = screen.getAllByText(/file/);
    expect(badges.length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/language/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows required indicator (*) for required variables', () => {
    const skill = makeSkill({
      prompts: [
        {
          id: 'p1',
          name: 'Test',
          role: 'system',
          content: 'test',
          variables: [{ name: 'required_var', required: true }],
        },
      ],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('*')).toBeInTheDocument();
  });

  it('does not show variables section when no variables', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'Test', role: 'system', content: 'test' }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.queryByText('Variables:')).not.toBeInTheDocument();
  });

  it('renders all known role badge colors', () => {
    const roles = ['system', 'planning', 'execution', 'review', 'error', 'handoff'];
    const skill = makeSkill({
      prompts: roles.map((role, i) => ({
        id: `p${i}`,
        name: `${role} prompt`,
        role,
        content: `content for ${role}`,
      })),
    });
    render(<SkillDetailPrompts skill={skill} />);
    for (const role of roles) {
      expect(screen.getByText(role)).toBeInTheDocument();
    }
  });

  it('renders prompts with unknown roles gracefully', () => {
    const skill = makeSkill({
      prompts: [{ id: 'p1', name: 'Custom', role: 'custom-role', content: 'test' }],
    });
    render(<SkillDetailPrompts skill={skill} />);
    expect(screen.getByText('custom-role')).toBeInTheDocument();
  });
});
