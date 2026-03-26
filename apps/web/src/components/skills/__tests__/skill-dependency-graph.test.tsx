import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// Mock @xyflow/react since it requires a browser environment
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ children, ...props }: Record<string, unknown>) => (
    <div data-testid="react-flow" {...props}>{children as React.ReactNode}</div>
  ),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  Background: () => <div data-testid="react-flow-bg" />,
  BackgroundVariant: { Dots: 'dots' },
  MarkerType: { ArrowClosed: 'arrowclosed' },
  useNodesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
  useEdgesState: (initial: unknown[]) => [initial, vi.fn(), vi.fn()],
}));

vi.mock('@/hooks/use-skills', () => ({
  useSkills: () => ({
    data: [
      { id: 'code-review', name: 'Code Review' },
      { id: 'git-expert', name: 'Git Expert' },
      { id: 'linter', name: 'Linter' },
    ],
  }),
  useSkillDetail: (id: string) => ({
    data: id === 'code-review'
      ? {
          manifest: {
            dependencies: [
              { skillId: 'git-expert', versionRange: '^1.0.0' },
              { skillId: 'linter', optional: true },
            ],
            resolvedDependencies: { 'git-expert': '1.3.0' },
          },
        }
      : { manifest: { dependencies: [], resolvedDependencies: {} } },
  }),
}));

import { SkillDependencyGraph } from '../skill-dependency-graph';

describe('SkillDependencyGraph', () => {
  it('renders the graph card', () => {
    render(<SkillDependencyGraph skillIds={['code-review']} />);
    expect(screen.getByTestId('skill-dependency-graph')).toBeInTheDocument();
  });

  it('renders the card title', () => {
    render(<SkillDependencyGraph skillIds={['code-review']} />);
    expect(screen.getByText('Skill Dependency Graph')).toBeInTheDocument();
  });

  it('renders the ReactFlow component', () => {
    render(<SkillDependencyGraph skillIds={['code-review']} />);
    expect(screen.getByTestId('react-flow')).toBeInTheDocument();
  });

  it('renders the legend', () => {
    render(<SkillDependencyGraph skillIds={['code-review']} />);
    expect(screen.getByText('Resolved dep')).toBeInTheDocument();
    expect(screen.getByText('Unresolved dep')).toBeInTheDocument();
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('External')).toBeInTheDocument();
  });

  it('renders with multiple skill IDs', () => {
    render(<SkillDependencyGraph skillIds={['code-review', 'git-expert']} />);
    expect(screen.getByTestId('skill-dependency-graph')).toBeInTheDocument();
  });

  it('renders with empty skill IDs', () => {
    render(<SkillDependencyGraph skillIds={[]} />);
    expect(screen.getByTestId('skill-dependency-graph')).toBeInTheDocument();
  });
});
