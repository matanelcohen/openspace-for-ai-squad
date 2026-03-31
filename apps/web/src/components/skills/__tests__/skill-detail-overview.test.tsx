import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SkillDetail } from '@/hooks/use-skills';

import { SkillDetailOverview } from '../skill-detail-overview';

function makeSkill(overrides: Partial<SkillDetail['manifest']> = {}, phase = 'loaded'): SkillDetail {
  return {
    phase: phase as any,
    manifest: {
      manifestVersion: 1,
      id: 'code-review',
      name: 'Code Review',
      version: '2.1.0',
      description: 'Automated code review skill.',
      tools: [],
      prompts: [],
      triggers: [],
      tags: ['code', 'review'],
      icon: 'search',
      ...overrides,
    } as any,
  };
}

describe('SkillDetailOverview', () => {
  it('renders skill name and description', () => {
    render(<SkillDetailOverview skill={makeSkill()} />);
    expect(screen.getByTestId('skill-detail-overview')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Automated code review skill.')).toBeInTheDocument();
  });

  it('shows version card', () => {
    render(<SkillDetailOverview skill={makeSkill()} />);
    expect(screen.getByText('v2.1.0')).toBeInTheDocument();
    expect(screen.getByText('Version')).toBeInTheDocument();
  });

  it('shows tags', () => {
    render(<SkillDetailOverview skill={makeSkill()} />);
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('review')).toBeInTheDocument();
  });

  it('does not render tags section when no tags', () => {
    render(<SkillDetailOverview skill={makeSkill({ tags: undefined })} />);
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
  });

  it('shows agent roles when agentMatch is present', () => {
    const skill = makeSkill({ agentMatch: { roles: ['developer', 'reviewer'] } } as any);
    render(<SkillDetailOverview skill={skill} />);
    expect(screen.getByText('Agent Roles')).toBeInTheDocument();
    expect(screen.getByText('developer')).toBeInTheDocument();
    expect(screen.getByText('reviewer')).toBeInTheDocument();
  });

  it('shows "All agents" for wildcard role', () => {
    const skill = makeSkill({ agentMatch: { roles: ['*'] } } as any);
    render(<SkillDetailOverview skill={skill} />);
    expect(screen.getByText('All agents')).toBeInTheDocument();
  });

  it('shows requirements when bins and env are provided', () => {
    const skill = makeSkill({
      requires: { bins: ['git', 'node'], env: ['API_KEY'] },
    } as any);
    render(<SkillDetailOverview skill={skill} />);
    expect(screen.getByText('Requirements')).toBeInTheDocument();
    expect(screen.getByText('git')).toBeInTheDocument();
    expect(screen.getByText('node')).toBeInTheDocument();
    expect(screen.getByText('API_KEY')).toBeInTheDocument();
  });

  it('hides roles card when no agentMatch', () => {
    render(<SkillDetailOverview skill={makeSkill()} />);
    expect(screen.queryByText('Agent Roles')).not.toBeInTheDocument();
  });

  it('hides requirements card when no requires', () => {
    render(<SkillDetailOverview skill={makeSkill()} />);
    expect(screen.queryByText('Requirements')).not.toBeInTheDocument();
  });
});
