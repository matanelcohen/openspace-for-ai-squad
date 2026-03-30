import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/use-escalation-actions');

import {
  useBulkApproveEscalations,
  useBulkRejectEscalations,
} from '@/hooks/use-escalation-actions';

const mockedUseBulkApprove = vi.mocked(useBulkApproveEscalations);
const mockedUseBulkReject = vi.mocked(useBulkRejectEscalations);

// Import after mocks
import { BulkActionToolbar } from '../bulk-action-toolbar';

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const bulkApproveMutateAsync = vi.fn().mockResolvedValue(undefined);
const bulkRejectMutateAsync = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseBulkApprove.mockReturnValue({
    mutateAsync: bulkApproveMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useBulkApproveEscalations>);
  mockedUseBulkReject.mockReturnValue({
    mutateAsync: bulkRejectMutateAsync,
    isPending: false,
  } as unknown as ReturnType<typeof useBulkRejectEscalations>);
});

describe('BulkActionToolbar', () => {
  it('renders nothing when no items selected', () => {
    render(<BulkActionToolbar selectedIds={new Set()} onClearSelection={vi.fn()} />, { wrapper });
    expect(screen.queryByTestId('bulk-action-toolbar')).not.toBeInTheDocument();
  });

  it('renders toolbar when items are selected', () => {
    render(
      <BulkActionToolbar selectedIds={new Set(['esc-1', 'esc-2'])} onClearSelection={vi.fn()} />,
      { wrapper },
    );
    expect(screen.getByTestId('bulk-action-toolbar')).toBeInTheDocument();
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('shows singular "1 selected"', () => {
    render(<BulkActionToolbar selectedIds={new Set(['esc-1'])} onClearSelection={vi.fn()} />, {
      wrapper,
    });
    expect(screen.getByText('1 selected')).toBeInTheDocument();
  });

  it('has approve all button', () => {
    render(<BulkActionToolbar selectedIds={new Set(['esc-1'])} onClearSelection={vi.fn()} />, {
      wrapper,
    });
    expect(screen.getByTestId('bulk-approve-btn')).toBeInTheDocument();
  });

  it('has reject all button', () => {
    render(<BulkActionToolbar selectedIds={new Set(['esc-1'])} onClearSelection={vi.fn()} />, {
      wrapper,
    });
    expect(screen.getByTestId('bulk-reject-btn')).toBeInTheDocument();
  });

  it('calls onClearSelection when Clear button clicked', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    render(<BulkActionToolbar selectedIds={new Set(['esc-1'])} onClearSelection={onClear} />, {
      wrapper,
    });

    await user.click(screen.getByTestId('clear-selection-btn'));
    expect(onClear).toHaveBeenCalled();
  });

  it('opens confirmation dialog when approve all clicked', async () => {
    const user = userEvent.setup();

    render(
      <BulkActionToolbar selectedIds={new Set(['esc-1', 'esc-2'])} onClearSelection={vi.fn()} />,
      { wrapper },
    );

    await user.click(screen.getByTestId('bulk-approve-btn'));
    expect(screen.getByText(/Bulk Approve 2 Escalations/)).toBeInTheDocument();
  });

  it('opens confirmation dialog when reject all clicked', async () => {
    const user = userEvent.setup();

    render(<BulkActionToolbar selectedIds={new Set(['esc-1'])} onClearSelection={vi.fn()} />, {
      wrapper,
    });

    await user.click(screen.getByTestId('bulk-reject-btn'));
    expect(screen.getByText(/Bulk Reject 1 Escalation$/)).toBeInTheDocument();
  });

  it('shows comment textarea in confirmation dialog', async () => {
    const user = userEvent.setup();

    render(<BulkActionToolbar selectedIds={new Set(['esc-1'])} onClearSelection={vi.fn()} />, {
      wrapper,
    });

    await user.click(screen.getByTestId('bulk-approve-btn'));
    expect(screen.getByTestId('bulk-comment')).toBeInTheDocument();
  });

  it('calls bulk approve with ids and comment', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    render(
      <BulkActionToolbar selectedIds={new Set(['esc-1', 'esc-2'])} onClearSelection={onClear} />,
      { wrapper },
    );

    await user.click(screen.getByTestId('bulk-approve-btn'));
    await user.type(screen.getByTestId('bulk-comment'), 'All good');
    await user.click(screen.getByTestId('bulk-confirm-btn'));

    expect(bulkApproveMutateAsync).toHaveBeenCalledWith({
      ids: expect.arrayContaining(['esc-1', 'esc-2']),
      comment: 'All good',
    });
    expect(onClear).toHaveBeenCalled();
  });

  it('calls bulk reject with ids and comment', async () => {
    const onClear = vi.fn();
    const user = userEvent.setup();

    render(<BulkActionToolbar selectedIds={new Set(['esc-1'])} onClearSelection={onClear} />, {
      wrapper,
    });

    await user.click(screen.getByTestId('bulk-reject-btn'));
    await user.type(screen.getByTestId('bulk-comment'), 'Not safe');
    await user.click(screen.getByTestId('bulk-confirm-btn'));

    expect(bulkRejectMutateAsync).toHaveBeenCalledWith({
      ids: ['esc-1'],
      comment: 'Not safe',
    });
    expect(onClear).toHaveBeenCalled();
  });
});
