import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { SkillSummary } from '@/hooks/use-skills';

import { SkillGrid } from '../skill-grid';

// Mock SkillCard to isolate SkillGrid tests
vi.mock('../skill-card', () => ({
  SkillCard: ({ skill }: { skill: SkillSummary }) => (
    <div data-testid={`skill-card-${skill.id}`}>{skill.name}</div>
  ),
}));

const mockSkills: SkillSummary[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    version: '1.0.0',
    description: 'Reviews code changes.',
    icon: 'code',
    tags: ['code'],
    phase: 'active',
    activeAgentCount: 2,
  },
  {
    id: 'testing',
    name: 'Testing',
    version: '2.0.0',
    description: 'Runs automated tests.',
    icon: 'testing',
    tags: ['test'],
    phase: 'loaded',
    activeAgentCount: 0,
  },
  {
    id: 'deploy',
    name: 'Deployment',
    version: '1.1.0',
    description: 'Deploys to production.',
    icon: 'deployment',
    tags: ['deploy'],
    phase: 'validated',
    activeAgentCount: 1,
  },
];

describe('SkillGrid', () => {
  it('renders loading skeleton cards when isLoading is true', () => {
    render(<SkillGrid skills={undefined} isLoading={true} />);
    expect(screen.getByTestId('skill-grid-loading')).toBeInTheDocument();
  });

  it('renders 6 skeleton cards during loading', () => {
    const { container } = render(<SkillGrid skills={undefined} isLoading={true} />);
    const skeletons = container.querySelectorAll('[data-testid="skill-grid-loading"] > *');
    expect(skeletons).toHaveLength(6);
  });

  it('renders empty state when skills array is empty', () => {
    render(<SkillGrid skills={[]} isLoading={false} />);
    expect(screen.getByText('No skills found')).toBeInTheDocument();
    expect(
      screen.getByText(
        'No skills match your current filters. Try adjusting your search or browse all available skills.',
      ),
    ).toBeInTheDocument();
  });

  it('renders empty state when skills is undefined and not loading', () => {
    render(<SkillGrid skills={undefined} isLoading={false} />);
    expect(screen.getByText('No skills found')).toBeInTheDocument();
  });

  it('renders skill cards for each skill', () => {
    render(<SkillGrid skills={mockSkills} isLoading={false} />);
    expect(screen.getByTestId('skill-grid')).toBeInTheDocument();
    expect(screen.getByText('Code Review')).toBeInTheDocument();
    expect(screen.getByText('Testing')).toBeInTheDocument();
    expect(screen.getByText('Deployment')).toBeInTheDocument();
  });

  it('renders correct number of cards', () => {
    render(<SkillGrid skills={mockSkills} isLoading={false} />);
    expect(screen.getByTestId('skill-card-code-review')).toBeInTheDocument();
    expect(screen.getByTestId('skill-card-testing')).toBeInTheDocument();
    expect(screen.getByTestId('skill-card-deploy')).toBeInTheDocument();
  });

  it('uses responsive grid layout', () => {
    render(<SkillGrid skills={mockSkills} isLoading={false} />);
    const grid = screen.getByTestId('skill-grid');
    expect(grid).toHaveClass('grid', 'gap-4', 'sm:grid-cols-2', 'lg:grid-cols-3');
  });
});
