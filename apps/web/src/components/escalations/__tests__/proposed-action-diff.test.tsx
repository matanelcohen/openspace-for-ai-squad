import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProposedActionDiff } from '../proposed-action-diff';

describe('ProposedActionDiff', () => {
  const defaultProps = {
    proposedAction: 'deploy service-x to production',
    reasoning: 'All tests passing. Confidence 0.95.',
  };

  it('renders the proposed action', () => {
    render(<ProposedActionDiff {...defaultProps} />);
    expect(screen.getByText(defaultProps.proposedAction)).toBeInTheDocument();
  });

  it('renders the agent reasoning', () => {
    render(<ProposedActionDiff {...defaultProps} />);
    expect(screen.getByText(defaultProps.reasoning)).toBeInTheDocument();
  });

  it('has the data-testid', () => {
    render(<ProposedActionDiff {...defaultProps} />);
    expect(screen.getByTestId('proposed-action-diff')).toBeInTheDocument();
  });

  it('renders section headings', () => {
    render(<ProposedActionDiff {...defaultProps} />);
    expect(screen.getByText('Proposed Action')).toBeInTheDocument();
    expect(screen.getByText('Agent Reasoning')).toBeInTheDocument();
  });

  it('renders proposed action in preformatted block', () => {
    render(<ProposedActionDiff {...defaultProps} />);
    const pre = screen.getByTestId('proposed-action-diff').querySelector('pre');
    expect(pre).toBeTruthy();
    expect(pre!.textContent).toBe(defaultProps.proposedAction);
  });
});
