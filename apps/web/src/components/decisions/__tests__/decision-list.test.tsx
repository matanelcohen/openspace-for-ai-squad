import type { Decision } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { DecisionList } from '../decision-list';

vi.mock('../decision-card', () => ({
  DecisionCard: ({ decision }: { decision: Decision }) => (
    <div data-testid={`decision-card-${decision.id}`}>{decision.title}</div>
  ),
}));

describe('DecisionList', () => {
  const mockDecisions: Decision[] = [
    {
      id: '1',
      title: 'Decision 1',
      author: 'leela',
      date: '2024-01-01T10:00:00Z',
      rationale: 'Rationale 1',
      status: 'active',
      affectedFiles: [],
    },
    {
      id: '2',
      title: 'Decision 2',
      author: 'bender',
      date: '2024-01-02T10:00:00Z',
      rationale: 'Rationale 2',
      status: 'superseded',
      affectedFiles: [],
    },
    {
      id: '3',
      title: 'Decision 3',
      author: 'fry',
      date: '2024-01-03T10:00:00Z',
      rationale: 'Rationale 3',
      status: 'reversed',
      affectedFiles: [],
    },
  ];

  it('renders empty state when no decisions', () => {
    render(<DecisionList decisions={[]} />);
    
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no decisions found/i)).toBeInTheDocument();
  });

  it('renders decision cards', () => {
    render(<DecisionList decisions={mockDecisions} />);
    
    expect(screen.getByTestId('decision-list')).toBeInTheDocument();
    expect(screen.getByTestId('decision-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('decision-card-2')).toBeInTheDocument();
    expect(screen.getByTestId('decision-card-3')).toBeInTheDocument();
  });

  it('sorts decisions by date, newest first', () => {
    render(<DecisionList decisions={mockDecisions} />);
    
    const cards = screen.getAllByTestId(/decision-card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'decision-card-3'); // Jan 3
    expect(cards[1]).toHaveAttribute('data-testid', 'decision-card-2'); // Jan 2
    expect(cards[2]).toHaveAttribute('data-testid', 'decision-card-1'); // Jan 1
  });

  it('handles single decision', () => {
    render(<DecisionList decisions={[mockDecisions[0]]} />);
    
    expect(screen.getByTestId('decision-list')).toBeInTheDocument();
    expect(screen.getByTestId('decision-card-1')).toBeInTheDocument();
  });
});
