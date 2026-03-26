import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

import { SkillDetailInstructions } from '../skill-detail-instructions';
import { SkillDetailOverview } from '../skill-detail-overview';

// ── Mock SkillDependencyGraph (uses @xyflow/react which needs a DOM provider) ──
vi.mock('../skill-dependency-graph', () => ({
  SkillDependencyGraph: ({ skillIds }: { skillIds: string[] }) => (
    <div data-testid="skill-dependency-graph">Graph for {skillIds.join(', ')}</div>
  ),
}));

// ── Fixtures ─────────────────────────────────────────────────────

const baseSkill: SkillDetail = {
  manifest: {
    manifestVersion: 1,
    id: 'code-review',
    name: 'Code Review',
    version: '1.2.0',
    description: 'Automated code reviews with configurable strictness.',
    author: 'openspace',
    icon: 'code',
    tags: ['code-analysis', 'testing'],
    tools: [],
    prompts: [],
    triggers: [],
    agentMatch: { roles: ['*'] },
    requires: { bins: ['git', 'node'], env: ['OPENAI_API_KEY'] },
    instructions: '## Code Review\n\nReview code for bugs and style issues.',
    sourcePath: '/skills/code-review',
  },
  phase: 'active',
  hooks: null,
  activeAgents: new Set(['agent-1']),
  lastTransition: Date.now(),
} as unknown as SkillDetail;

// ── SkillDetailOverview ──────────────────────────────────────────

describe('SkillDetailOverview', () => {
  it('renders the skill name and description', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(
      screen.getByText('Automated code reviews with configurable strictness.'),
    ).toBeInTheDocument();
  });

  it('renders the phase badge', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByTestId('skill-detail-overview')).toBeInTheDocument();
  });

  it('renders the version card', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('code-analysis')).toBeInTheDocument();
    expect(screen.getByText('testing')).toBeInTheDocument();
  });

  it('renders agent roles', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('All agents')).toBeInTheDocument();
  });

  it('renders required binaries', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('git')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
  });

  it('renders required env vars', () => {
    render(<SkillDetailOverview skill={baseSkill} />);
    expect(screen.getByText('OPENAI_API_KEY')).toBeInTheDocument();
  });
});

// ── SkillDetailInstructions ──────────────────────────────────────

describe('SkillDetailInstructions', () => {
  it('renders the instructions content', () => {
    render(<SkillDetailInstructions skill={baseSkill} />);
    expect(screen.getByTestId('skill-detail-instructions')).toBeInTheDocument();
    expect(screen.getByText(/Review code for bugs and style issues/)).toBeInTheDocument();
  });

  it('shows empty state when no instructions', () => {
    const skill = {
      ...baseSkill,
      manifest: { ...baseSkill.manifest, instructions: undefined },
    } as unknown as SkillDetail;
    render(<SkillDetailInstructions skill={skill} />);
    expect(screen.getByText('No instructions defined for this skill.')).toBeInTheDocument();
  });
});
