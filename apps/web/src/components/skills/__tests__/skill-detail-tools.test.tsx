import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

import { SkillDetailTools } from '../skill-detail-tools';

// ── Fixtures ─────────────────────────────────────────────────────

const baseManifest = {
  manifestVersion: 1,
  id: 'code-review',
  name: 'Code Review',
  version: '1.0.0',
  description: 'Reviews code.',
  author: 'openspace',
  tags: [],
  prompts: [],
  triggers: [],
};

function makeSkill(overrides: Partial<SkillDetail['manifest']> = {}): SkillDetail {
  return {
    manifest: { ...baseManifest, tools: [], ...overrides },
    phase: 'active',
  } as unknown as SkillDetail;
}

// ── Tests ────────────────────────────────────────────────────────

describe('SkillDetailTools', () => {
  it('renders the container with testid', () => {
    render(<SkillDetailTools skill={makeSkill()} />);
    expect(screen.getByTestId('skill-detail-tools')).toBeInTheDocument();
  });

  it('shows "0 tools declared" when no tools', () => {
    render(<SkillDetailTools skill={makeSkill({ tools: [] })} />);
    expect(screen.getByText('0 tools declared')).toBeInTheDocument();
  });

  it('shows empty message when no tools', () => {
    render(<SkillDetailTools skill={makeSkill({ tools: [] })} />);
    expect(
      screen.getByText('This skill does not declare any tool dependencies.'),
    ).toBeInTheDocument();
  });

  it('shows singular "tool" for exactly 1 tool', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff' }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('1 tool declared')).toBeInTheDocument();
  });

  it('shows plural "tools" for multiple tools', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff' }, { toolId: 'npm:test' }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('2 tools declared')).toBeInTheDocument();
  });

  it('renders tool IDs', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff' }, { toolId: 'npm:test' }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('git:diff')).toBeInTheDocument();
    expect(screen.getByText('npm:test')).toBeInTheDocument();
  });

  it('shows optional badge for optional tools', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'eslint:lint', optional: true }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('optional')).toBeInTheDocument();
  });

  it('does not show optional badge for required tools', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff', optional: false }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.queryByText('optional')).not.toBeInTheDocument();
  });

  it('shows "Available" when toolAvailability is true', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff' }],
      toolAvailability: { 'git:diff': true },
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('Available')).toBeInTheDocument();
  });

  it('shows "Unavailable" when toolAvailability is false', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff' }],
      toolAvailability: { 'git:diff': false },
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('does not show availability when toolAvailability is undefined', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff' }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.queryByText('Available')).not.toBeInTheDocument();
    expect(screen.queryByText('Unavailable')).not.toBeInTheDocument();
  });

  it('renders tool reason text', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff', reason: 'Used for code diffing' }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('Used for code diffing')).toBeInTheDocument();
  });

  it('renders tool version range', () => {
    const skill = makeSkill({
      tools: [{ toolId: 'git:diff', versionRange: '>=2.0.0' }],
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('Version: >=2.0.0')).toBeInTheDocument();
  });

  it('renders multiple tools with mixed attributes', () => {
    const skill = makeSkill({
      tools: [
        { toolId: 'git:diff', reason: 'Diff changes', optional: false },
        { toolId: 'eslint:lint', optional: true, versionRange: '^8.0.0' },
        { toolId: 'npm:test' },
      ],
      toolAvailability: { 'git:diff': true, 'eslint:lint': false },
    });
    render(<SkillDetailTools skill={skill} />);
    expect(screen.getByText('3 tools declared')).toBeInTheDocument();
    expect(screen.getByText('git:diff')).toBeInTheDocument();
    expect(screen.getByText('eslint:lint')).toBeInTheDocument();
    expect(screen.getByText('npm:test')).toBeInTheDocument();
    expect(screen.getByText('Diff changes')).toBeInTheDocument();
    expect(screen.getByText('optional')).toBeInTheDocument();
    expect(screen.getByText('Version: ^8.0.0')).toBeInTheDocument();
    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
});
