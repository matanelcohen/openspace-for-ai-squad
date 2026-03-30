import type { EscalationItem } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-escalation-actions');
vi.mock('../sla-countdown', () => ({
  SlaCountdown: ({ timeoutAt }: { timeoutAt: string }) => (
    <span data-testid="sla-countdown">{timeoutAt}</span>
  ),
}));

import {
  useApproveEscalation,
  useClaimEscalation,
  useRejectEscalation,
  useRequestChangesEscalation,
} from '@/hooks/use-escalation-actions';

const mockedUseClaim = vi.mocked(useClaimEscalation);
const mockedUseApprove = vi.mocked(useApproveEscalation);
const mockedUseReject = vi.mocked(useRejectEscalation);
const mockedUseRequestChanges = vi.mocked(useRequestChangesEscalation);

// Import after mocks
import { EscalationDetailPanel } from '../escalation-detail-panel';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

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
    auditTrail: [
      {
        id: 'a1',
        escalationId: 'esc-1',
        action: 'created',
        actor: 'system',
        timestamp: '2026-03-29T10:00:00Z',
      },
    ],
    ...overrides,
  };
}

const claimMutate = vi.fn();
const approveMutate = vi.fn();
const rejectMutate = vi.fn();
const requestChangesMutate = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseClaim.mockReturnValue({
    mutate: claimMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useClaimEscalation>);
  mockedUseApprove.mockReturnValue({
    mutate: approveMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useApproveEscalation>);
  mockedUseReject.mockReturnValue({
    mutate: rejectMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useRejectEscalation>);
  mockedUseRequestChanges.mockReturnValue({
    mutate: requestChangesMutate,
    isPending: false,
  } as unknown as ReturnType<typeof useRequestChangesEscalation>);
});

describe('EscalationDetailPanel', () => {
  it('renders the panel container', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('escalation-detail-panel')).toBeInTheDocument();
  });

  it('shows the escalation ID', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByText('esc-1')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('escalation-status-badge')).toBeInTheDocument();
  });

  it('shows priority indicator', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('priority-indicator')).toBeInTheDocument();
  });

  it('shows confidence badge', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('confidence-badge')).toBeInTheDocument();
  });

  it('shows SLA countdown for pending escalation', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('sla-countdown')).toBeInTheDocument();
  });

  it('does not show SLA for resolved escalation', () => {
    render(<EscalationDetailPanel escalation={makeEscalation({ status: 'approved' })} />, {
      wrapper,
    });
    expect(screen.queryByTestId('sla-countdown')).not.toBeInTheDocument();
  });

  it('shows agent context card', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByText('Agent Context')).toBeInTheDocument();
    expect(screen.getByText('fry')).toBeInTheDocument();
    expect(screen.getByText('wf-1')).toBeInTheDocument();
    expect(screen.getByText('node-1')).toBeInTheDocument();
  });

  it('shows proposed action diff', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('proposed-action-diff')).toBeInTheDocument();
    expect(screen.getByText('Deploy service-x')).toBeInTheDocument();
  });

  it('shows audit trail', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('audit-trail-timeline')).toBeInTheDocument();
  });

  it('shows claim button for pending status', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    expect(screen.getByTestId('claim-btn')).toBeInTheDocument();
  });

  it('does not show claim button for claimed status', () => {
    render(
      <EscalationDetailPanel
        escalation={makeEscalation({ status: 'claimed', claimedBy: 'reviewer-1' })}
      />,
      { wrapper },
    );
    expect(screen.queryByTestId('claim-btn')).not.toBeInTheDocument();
  });

  it('calls claim mutation on claim click', async () => {
    const user = userEvent.setup();
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });

    await user.click(screen.getByTestId('claim-btn'));
    expect(claimMutate).toHaveBeenCalledWith('esc-1');
  });

  it('shows review action buttons for actionable escalations', () => {
    render(<EscalationDetailPanel escalation={makeEscalation({ status: 'claimed' })} />, {
      wrapper,
    });
    expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
    expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    expect(screen.getByTestId('request-changes-btn')).toBeInTheDocument();
  });

  it('does not show action buttons for resolved escalation', () => {
    render(<EscalationDetailPanel escalation={makeEscalation({ status: 'approved' })} />, {
      wrapper,
    });
    expect(screen.queryByTestId('approve-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('reject-btn')).not.toBeInTheDocument();
    expect(screen.queryByTestId('request-changes-btn')).not.toBeInTheDocument();
  });

  it('calls approve with comment', async () => {
    const user = userEvent.setup();
    render(<EscalationDetailPanel escalation={makeEscalation({ status: 'claimed' })} />, {
      wrapper,
    });

    await user.type(screen.getByTestId('review-comment'), 'LGTM');
    await user.click(screen.getByTestId('approve-btn'));

    expect(approveMutate).toHaveBeenCalledWith({ id: 'esc-1', comment: 'LGTM' });
  });

  it('calls reject with comment', async () => {
    const user = userEvent.setup();
    render(<EscalationDetailPanel escalation={makeEscalation({ status: 'claimed' })} />, {
      wrapper,
    });

    await user.type(screen.getByTestId('review-comment'), 'Not safe');
    await user.click(screen.getByTestId('reject-btn'));

    expect(rejectMutate).toHaveBeenCalledWith({ id: 'esc-1', comment: 'Not safe' });
  });

  it('calls request changes with comment', async () => {
    const user = userEvent.setup();
    render(<EscalationDetailPanel escalation={makeEscalation({ status: 'claimed' })} />, {
      wrapper,
    });

    await user.type(screen.getByTestId('review-comment'), 'Add tests');
    await user.click(screen.getByTestId('request-changes-btn'));

    expect(requestChangesMutate).toHaveBeenCalledWith({ id: 'esc-1', comment: 'Add tests' });
  });

  it('shows review comment when present', () => {
    render(
      <EscalationDetailPanel
        escalation={makeEscalation({ status: 'approved', reviewComment: 'Great work' })}
      />,
      { wrapper },
    );
    expect(screen.getByText('Great work')).toBeInTheDocument();
  });

  it('shows claimedBy when present', () => {
    render(
      <EscalationDetailPanel
        escalation={makeEscalation({
          status: 'claimed',
          claimedBy: 'reviewer-1',
          claimedAt: '2026-03-29T10:05:00Z',
        })}
      />,
      { wrapper },
    );
    expect(screen.getByText('reviewer-1')).toBeInTheDocument();
  });

  it('has back-to-queue link', () => {
    render(<EscalationDetailPanel escalation={makeEscalation()} />, { wrapper });
    const link = screen.getByText('Back to Queue').closest('a');
    expect(link).toHaveAttribute('href', '/escalations');
  });

  it('disables buttons when mutation is pending', () => {
    mockedUseApprove.mockReturnValue({
      mutate: approveMutate,
      isPending: true,
    } as unknown as ReturnType<typeof useApproveEscalation>);

    render(<EscalationDetailPanel escalation={makeEscalation({ status: 'claimed' })} />, {
      wrapper,
    });

    expect(screen.getByTestId('approve-btn')).toBeDisabled();
    expect(screen.getByTestId('reject-btn')).toBeDisabled();
    expect(screen.getByTestId('request-changes-btn')).toBeDisabled();
  });
});
