import type { EscalationItem } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ReviewQueueTable } from '../review-queue-table';

// Mock SlaCountdown to avoid timer complexity
vi.mock('../sla-countdown', () => ({
  SlaCountdown: ({ timeoutAt }: { timeoutAt: string }) => (
    <span data-testid="sla-countdown">{timeoutAt}</span>
  ),
}));

function makeEscalation(overrides: Partial<EscalationItem> = {}): EscalationItem {
  return {
    id: 'esc-1',
    status: 'pending',
    reason: 'low_confidence',
    priority: 'high',
    chainId: 'chain-1',
    currentLevel: 1,
    context: {
      agentId: 'fry',
      confidenceScore: 0.65,
      sourceNodeId: 'node-1',
      workflowId: 'wf-1',
      proposedAction: 'Deploy service-x',
      reasoning: 'All tests pass',
      metadata: {},
    },
    claimedBy: null,
    claimedAt: null,
    createdAt: '2026-03-29T10:00:00Z',
    updatedAt: '2026-03-29T10:00:00Z',
    timeoutAt: '2026-03-29T11:00:00Z',
    reviewComment: null,
    auditTrail: [],
    ...overrides,
  };
}

describe('ReviewQueueTable', () => {
  const defaultProps = {
    escalations: [
      makeEscalation({
        id: 'esc-1',
        priority: 'critical',
        context: { ...makeEscalation().context, agentId: 'leela', confidenceScore: 0.3 },
      }),
      makeEscalation({
        id: 'esc-2',
        priority: 'low',
        status: 'approved',
        context: { ...makeEscalation().context, agentId: 'bender', confidenceScore: 0.9 },
      }),
      makeEscalation({ id: 'esc-3', priority: 'medium', reason: 'policy_violation' }),
    ],
    selectedIds: new Set<string>(),
    onSelectionChange: vi.fn(),
  };

  it('renders the filter bar', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    expect(screen.getByTestId('escalation-filters')).toBeInTheDocument();
    expect(screen.getByTestId('escalation-search')).toBeInTheDocument();
  });

  it('renders all rows', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    expect(screen.getByTestId('escalation-row-esc-1')).toBeInTheDocument();
    expect(screen.getByTestId('escalation-row-esc-2')).toBeInTheDocument();
    expect(screen.getByTestId('escalation-row-esc-3')).toBeInTheDocument();
  });

  it('renders agent names as links', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    const link = screen.getByText('leela').closest('a');
    expect(link).toHaveAttribute('href', '/escalations/esc-1');
  });

  it('shows empty state when no escalations match', () => {
    render(
      <ReviewQueueTable escalations={[]} selectedIds={new Set()} onSelectionChange={vi.fn()} />,
    );
    expect(screen.getByText('No escalations found.')).toBeInTheDocument();
  });

  it('filters by search query', async () => {
    const user = userEvent.setup();
    render(<ReviewQueueTable {...defaultProps} />);

    await user.type(screen.getByTestId('escalation-search'), 'leela');

    expect(screen.getByTestId('escalation-row-esc-1')).toBeInTheDocument();
    expect(screen.queryByTestId('escalation-row-esc-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('escalation-row-esc-3')).not.toBeInTheDocument();
  });

  it('filters by reason text', async () => {
    const user = userEvent.setup();
    render(<ReviewQueueTable {...defaultProps} />);

    await user.type(screen.getByTestId('escalation-search'), 'policy');

    expect(screen.queryByTestId('escalation-row-esc-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('escalation-row-esc-3')).toBeInTheDocument();
  });

  it('toggles single item selection', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();

    render(<ReviewQueueTable {...defaultProps} onSelectionChange={onSelectionChange} />);

    await user.click(screen.getByLabelText('Select esc-1'));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['esc-1']));
  });

  it('toggles select all', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();

    render(<ReviewQueueTable {...defaultProps} onSelectionChange={onSelectionChange} />);

    await user.click(screen.getByTestId('select-all'));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set(['esc-1', 'esc-2', 'esc-3']));
  });

  it('deselects all when all selected', async () => {
    const onSelectionChange = vi.fn();
    const user = userEvent.setup();

    render(
      <ReviewQueueTable
        {...defaultProps}
        selectedIds={new Set(['esc-1', 'esc-2', 'esc-3'])}
        onSelectionChange={onSelectionChange}
      />,
    );

    await user.click(screen.getByTestId('select-all'));
    expect(onSelectionChange).toHaveBeenCalledWith(new Set());
  });

  it('shows SLA countdown for pending items', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    // esc-1 is pending, esc-3 is pending — should have SLA countdowns
    const countdowns = screen.getAllByTestId('sla-countdown');
    expect(countdowns.length).toBeGreaterThanOrEqual(2);
  });

  it('shows dash for non-pending items SLA column', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    // esc-2 is approved — should show dash
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('renders priority indicators', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    expect(screen.getAllByTestId('priority-indicator').length).toBe(3);
  });

  it('renders status badges', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    expect(screen.getAllByTestId('escalation-status-badge').length).toBe(3);
  });

  it('renders confidence badges', () => {
    render(<ReviewQueueTable {...defaultProps} />);
    expect(screen.getAllByTestId('confidence-badge').length).toBe(3);
  });
});
