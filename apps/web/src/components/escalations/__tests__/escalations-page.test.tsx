import type { EscalationItem } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-escalations');
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

import {
  useBulkApproveEscalations,
  useBulkRejectEscalations,
} from '@/hooks/use-escalation-actions';
import { useEscalations } from '@/hooks/use-escalations';

const mockedUseEscalations = vi.mocked(useEscalations);
const mockedUseBulkApprove = vi.mocked(useBulkApproveEscalations);
const mockedUseBulkReject = vi.mocked(useBulkRejectEscalations);

// Import page after mocks
import EscalationsPage from '../../../../app/escalations/page';

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
    auditTrail: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseBulkApprove.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useBulkApproveEscalations>);
  mockedUseBulkReject.mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useBulkRejectEscalations>);
});

describe('EscalationsPage', () => {
  it('shows loading skeletons', () => {
    mockedUseEscalations.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as unknown as ReturnType<typeof useEscalations>);

    render(<EscalationsPage />, { wrapper });
    expect(screen.getByRole('heading', { name: 'Escalations' })).toBeInTheDocument();
    // Skeletons render as animate-pulse divs
    expect(document.querySelectorAll('.animate-pulse').length).toBeGreaterThanOrEqual(1);
  });

  it('shows error state', () => {
    mockedUseEscalations.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Failed'),
    } as unknown as ReturnType<typeof useEscalations>);

    render(<EscalationsPage />, { wrapper });
    expect(screen.getByText(/Failed to load escalations/)).toBeInTheDocument();
  });

  it('renders table when data loads', () => {
    mockedUseEscalations.mockReturnValue({
      data: [makeEscalation({ id: 'esc-1' })],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEscalations>);

    render(<EscalationsPage />, { wrapper });
    expect(screen.getByTestId('escalation-row-esc-1')).toBeInTheDocument();
  });

  it('shows page title and description', () => {
    mockedUseEscalations.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useEscalations>);

    render(<EscalationsPage />, { wrapper });
    expect(screen.getByRole('heading', { name: 'Escalations' })).toBeInTheDocument();
    expect(screen.getByText(/human-in-the-loop/)).toBeInTheDocument();
  });
});
