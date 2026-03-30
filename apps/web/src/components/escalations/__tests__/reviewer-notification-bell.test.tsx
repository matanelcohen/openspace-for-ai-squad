import type { EscalationItem } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-escalations');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock('../sla-countdown', () => ({
  SlaCountdown: ({ timeoutAt }: { timeoutAt: string }) => (
    <span data-testid="sla-countdown">{timeoutAt}</span>
  ),
}));

import { useEscalations, usePendingEscalationCount } from '@/hooks/use-escalations';

const mockedUseEscalations = vi.mocked(useEscalations);
const mockedUsePendingCount = vi.mocked(usePendingEscalationCount);

// Import after mocks
import { ReviewerNotificationBell } from '../reviewer-notification-bell';

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
      proposedAction: 'Deploy service-x to production',
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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ReviewerNotificationBell', () => {
  it('renders the bell button', () => {
    mockedUsePendingCount.mockReturnValue(0);
    mockedUseEscalations.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useEscalations>);

    render(<ReviewerNotificationBell />, { wrapper });
    expect(screen.getByTestId('reviewer-notification-bell')).toBeInTheDocument();
  });

  it('shows pending count badge when > 0', () => {
    mockedUsePendingCount.mockReturnValue(3);
    mockedUseEscalations.mockReturnValue({
      data: [
        makeEscalation({ id: 'esc-1' }),
        makeEscalation({ id: 'esc-2' }),
        makeEscalation({ id: 'esc-3' }),
      ],
    } as unknown as ReturnType<typeof useEscalations>);

    render(<ReviewerNotificationBell />, { wrapper });
    expect(screen.getByTestId('escalation-pending-count')).toHaveTextContent('3');
  });

  it('does not show count badge when 0', () => {
    mockedUsePendingCount.mockReturnValue(0);
    mockedUseEscalations.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useEscalations>);

    render(<ReviewerNotificationBell />, { wrapper });
    expect(screen.queryByTestId('escalation-pending-count')).not.toBeInTheDocument();
  });

  it('has accessible label', () => {
    mockedUsePendingCount.mockReturnValue(0);
    mockedUseEscalations.mockReturnValue({
      data: [],
    } as unknown as ReturnType<typeof useEscalations>);

    render(<ReviewerNotificationBell />, { wrapper });
    expect(screen.getByLabelText('Escalation notifications')).toBeInTheDocument();
  });
});
