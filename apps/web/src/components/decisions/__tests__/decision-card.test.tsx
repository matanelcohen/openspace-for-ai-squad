import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DecisionCard } from '../decision-card';
import type { Decision } from '@openspace/shared';

vi.mock('@/components/agent-avatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid={`agent-avatar-${agentId}`}>Avatar</div>
  ),
}));

describe('DecisionCard', () => {
  const mockDecision: Decision = {
    id: 'decision-1',
    title: 'Use TypeScript for frontend',
    author: 'leela',
    date: '2024-01-01T10:00:00Z',
    rationale: 'TypeScript provides better type safety and developer experience.',
    status: 'active',
    affectedFiles: ['src/index.ts', 'src/types.ts'],
  };

  it('renders decision card', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByTestId('decision-card')).toBeInTheDocument();
    expect(screen.getByText('Use TypeScript for frontend')).toBeInTheDocument();
  });

  it('displays author avatar and name', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByTestId('agent-avatar-leela')).toBeInTheDocument();
    expect(screen.getByText('leela')).toBeInTheDocument();
  });

  it('displays formatted date', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByText(/1\/1\/2024/)).toBeInTheDocument();
  });

  it('displays status badge', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByTestId('decision-status-badge')).toBeInTheDocument();
  });

  it('starts collapsed', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.queryByTestId('expanded-content')).not.toBeInTheDocument();
  });

  it('expands when expand button clicked', async () => {
    const user = userEvent.setup();
    render(<DecisionCard decision={mockDecision} />);
    
    await user.click(screen.getByTestId('expand-button'));
    
    expect(screen.getByTestId('expanded-content')).toBeInTheDocument();
    expect(screen.getByText('Rationale')).toBeInTheDocument();
    expect(screen.getByText(mockDecision.rationale)).toBeInTheDocument();
  });

  it('displays affected files when expanded', async () => {
    const user = userEvent.setup();
    render(<DecisionCard decision={mockDecision} />);
    
    await user.click(screen.getByTestId('expand-button'));
    
    expect(screen.getByText('Affected Files')).toBeInTheDocument();
    expect(screen.getByText('src/index.ts')).toBeInTheDocument();
    expect(screen.getByText('src/types.ts')).toBeInTheDocument();
  });

  it('collapses when expand button clicked again', async () => {
    const user = userEvent.setup();
    render(<DecisionCard decision={mockDecision} />);
    
    await user.click(screen.getByTestId('expand-button'));
    expect(screen.getByTestId('expanded-content')).toBeInTheDocument();
    
    await user.click(screen.getByTestId('expand-button'));
    expect(screen.queryByTestId('expanded-content')).not.toBeInTheDocument();
  });

  it('sets decision id attribute', () => {
    render(<DecisionCard decision={mockDecision} />);
    
    expect(screen.getByTestId('decision-card')).toHaveAttribute('data-decision-id', 'decision-1');
  });
});
