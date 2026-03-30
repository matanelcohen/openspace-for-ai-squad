import type { EscalationItem } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-escalation-detail');
vi.mock('@/hooks/use-escalation-actions');
vi.mock('@/hooks/use-workspaces', () => ({
  useActiveWorkspace: () => ({ data: { id: 'ws-1', name: 'Test' }, isLoading: false }),
  useWorkspaceStatus: () => ({ data: { initialized: true }, isLoading: false }),
}));
vi.mock('@/components/escalations/sla-countdown', () => ({
  SlaCountdown: ({ timeoutAt }: { timeoutAt: string }) => (
    <span data-testid="sla-countdown">{timeoutAt}</span>
  ),
}));
vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'esc-1' }),
}));

import {
  useApproveEscalation,
  useClaimEscalation,
  useRejectEscalation,
  useRequestChangesEscalation,
} from '@/hooks/use-escalation-actions';
import { useEscalationDetail } from '@/hooks/use-escalation-detail';

const mockedUseDetail = vi.mocked(useEscalationDetail);
const mockedUseClaim = vi.mocked(useClaimEscalation);
const mockedUseApprove = vi.mocked(useApproveEscalation);
const mockedUseReject = vi.mocked(useRejectEscalation);
const mockedUseRequestChanges = vi.mocked(useRequestChangesEscalation);

// Import page after mocks
import EscalationDetailPage from '../../../../app/escalations/[id]/page';

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

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseClaim.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useClaimEscalation>);
  mockedUseApprove.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useApproveEscalation>);
  mockedUseReject.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useRejectEscalation>);
  mockedUseRequestChanges.mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useRequestChangesEscalation>);
});

describe('EscalationDetailPage', () => {
  it('shows loading skeletons', () => {
    mockedUseDetail.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useEscalationDetail>);

    render(<EscalationDetailPage />, { wrapper });
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state', () => {
    mockedUseDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Not found'),
    } as unknown as ReturnType<typeof useEscalationDetail>);

    render(<EscalationDetailPage />, { wrapper });
    expect(screen.getByText(/Failed to load escalation/)).toBeInTheDocument();
  });

  it('renders detail panel when data loads', () => {
    mockedUseDetail.mockReturnValue({
      data: makeEscalation(),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEscalationDetail>);

    render(<EscalationDetailPage />, { wrapper });
    expect(screen.getByTestId('escalation-detail-panel')).toBeInTheDocument();
  });

  it('passes escalation data to detail panel', () => {
    mockedUseDetail.mockReturnValue({
      data: makeEscalation({ id: 'esc-1' }),
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEscalationDetail>);

    render(<EscalationDetailPage />, { wrapper });
    expect(screen.getByText('esc-1')).toBeInTheDocument();
    expect(screen.getByText('fry')).toBeInTheDocument();
  });

  it('renders nothing when no data and not loading', () => {
    mockedUseDetail.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEscalationDetail>);

    render(<EscalationDetailPage />, { wrapper });
    expect(screen.queryByTestId('escalation-detail-panel')).not.toBeInTheDocument();
  });
});
