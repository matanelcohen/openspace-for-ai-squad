import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

import { SkillDetailDependencies } from '../skill-detail-dependencies';

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
  prompts: [],
  triggers: [],
};

function makeSkill(overrides: Partial<SkillDetail['manifest']> = {}): SkillDetail {
  return {
    manifest: { ...baseManifest, ...overrides },
    phase: 'active',
  } as unknown as SkillDetail;
}

// ── Tests ────────────────────────────────────────────────────────

describe('SkillDetailDependencies', () => {
  it('renders the container with testid', () => {
    render(<SkillDetailDependencies skill={makeSkill()} />);
    expect(screen.getByTestId('skill-detail-deps')).toBeInTheDocument();
  });

  it('shows "0 dependencies" when no deps', () => {
    render(<SkillDetailDependencies skill={makeSkill({ dependencies: [] })} />);
    expect(screen.getByText('0 dependencies')).toBeInTheDocument();
  });

  it('shows empty message when no deps', () => {
    render(<SkillDetailDependencies skill={makeSkill({ dependencies: [] })} />);
    expect(screen.getByText('This skill has no dependencies on other skills.')).toBeInTheDocument();
  });

  it('shows singular "dependency" for exactly 1 dep', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert' }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('1 dependency')).toBeInTheDocument();
  });

  it('shows plural "dependencies" for multiple deps', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert' }, { skillId: 'linter' }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('2 dependencies')).toBeInTheDocument();
  });

  it('renders dependency skill IDs', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert' }, { skillId: 'linter' }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('git-expert')).toBeInTheDocument();
    expect(screen.getByText('linter')).toBeInTheDocument();
  });

  it('shows resolved version with check icon', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert' }],
      resolvedDependencies: { 'git-expert': '1.3.0' },
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('v1.3.0')).toBeInTheDocument();
  });

  it('shows "Unresolved" for deps without resolved version', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert' }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
  });

  it('shows optional badge for optional deps', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'linter', optional: true }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('optional')).toBeInTheDocument();
  });

  it('does not show optional badge for required deps', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert', optional: false }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.queryByText('optional')).not.toBeInTheDocument();
  });

  it('renders version range when specified', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert', versionRange: '>=1.0.0 <2.0.0' }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('Required: >=1.0.0 <2.0.0')).toBeInTheDocument();
  });

  it('does not render version range when not specified', () => {
    const skill = makeSkill({
      dependencies: [{ skillId: 'git-expert' }],
      resolvedDependencies: {},
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.queryByText(/Required:/)).not.toBeInTheDocument();
  });

  it('renders source path card when sourcePath is provided', () => {
    const skill = makeSkill({
      dependencies: [],
      sourcePath: '/skills/code-review',
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('Source Path')).toBeInTheDocument();
    expect(screen.getByText('/skills/code-review')).toBeInTheDocument();
  });

  it('does not render source path card when sourcePath is absent', () => {
    const skill = makeSkill({ dependencies: [] });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.queryByText('Source Path')).not.toBeInTheDocument();
  });

  it('renders mixed resolved and unresolved deps correctly', () => {
    const skill = makeSkill({
      dependencies: [
        { skillId: 'git-expert', versionRange: '^1.0.0' },
        { skillId: 'linter', optional: true },
        { skillId: 'formatter' },
      ],
      resolvedDependencies: { 'git-expert': '1.3.0', formatter: '2.0.1' },
    });
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('3 dependencies')).toBeInTheDocument();
    expect(screen.getByText('v1.3.0')).toBeInTheDocument();
    expect(screen.getByText('v2.0.1')).toBeInTheDocument();
    expect(screen.getByText('Unresolved')).toBeInTheDocument();
    expect(screen.getByText('optional')).toBeInTheDocument();
    expect(screen.getByText('Required: ^1.0.0')).toBeInTheDocument();
  });

  it('handles undefined dependencies gracefully', () => {
    const skill = makeSkill({});
    render(<SkillDetailDependencies skill={skill} />);
    expect(screen.getByText('0 dependencies')).toBeInTheDocument();
  });
});
