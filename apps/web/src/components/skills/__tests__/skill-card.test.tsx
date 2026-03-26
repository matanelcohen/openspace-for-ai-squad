import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { SkillSummary } from '@/hooks/use-skills';

import { SkillCard } from '../skill-card';

// Mock next/link to render a plain anchor
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const mockSkill: SkillSummary = {
  id: 'code-review',
  name: 'Code Review',
  version: '1.2.0',
  description: 'Automatically reviews code changes and provides feedback.',
  author: 'openspace-team',
  icon: 'code',
  tags: ['code', 'review', 'quality'],
  phase: 'active',
  activeAgentCount: 3,
};

describe('SkillCard', () => {
  it('renders skill name', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('Code Review')).toBeInTheDocument();
  });

  it('renders skill description', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(
      screen.getByText('Automatically reviews code changes and provides feedback.'),
    ).toBeInTheDocument();
  });

  it('renders skill version', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('v1.2.0')).toBeInTheDocument();
  });

  it('renders phase badge', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByTestId('skill-phase-active')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders tags', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('code')).toBeInTheDocument();
    expect(screen.getByText('review')).toBeInTheDocument();
    expect(screen.getByText('quality')).toBeInTheDocument();
  });

  it('shows +N badge when more than 3 tags', () => {
    const skillWithManyTags: SkillSummary = {
      ...mockSkill,
      tags: ['code', 'review', 'quality', 'automation', 'ci'],
    };
    render(<SkillCard skill={skillWithManyTags} />);
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('renders active agent count when > 0', () => {
    render(<SkillCard skill={mockSkill} />);
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('does not render agent count when 0', () => {
    const skillNoAgents: SkillSummary = { ...mockSkill, activeAgentCount: 0 };
    render(<SkillCard skill={skillNoAgents} />);
    expect(screen.queryByTitle('Active agents')).not.toBeInTheDocument();
  });

  it('links to skill detail page', () => {
    render(<SkillCard skill={mockSkill} />);
    const link = screen.getByTestId('skill-card-code-review');
    expect(link).toHaveAttribute('href', '/skills/code-review');
  });

  it('renders icon container', () => {
    const { container } = render(<SkillCard skill={mockSkill} />);
    const iconContainer = container.querySelector('.bg-primary\\/10');
    expect(iconContainer).toBeInTheDocument();
  });

  it('handles skill with no tags', () => {
    const skillNoTags: SkillSummary = { ...mockSkill, tags: undefined };
    render(<SkillCard skill={skillNoTags} />);
    expect(screen.getByText('Code Review')).toBeInTheDocument();
  });
});
