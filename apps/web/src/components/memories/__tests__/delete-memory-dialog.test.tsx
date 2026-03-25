import type { Memory } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { DeleteMemoryDialog } from '../delete-memory-dialog';

const makeMemory = (overrides: Partial<Memory> = {}): Memory => ({
  id: 'mem-1',
  agentId: 'leela',
  type: 'preference',
  content: 'Prefers TypeScript over JavaScript',
  sourceSession: 'session-abc-12345678',
  createdAt: '2024-06-15T10:00:00Z',
  updatedAt: '2024-06-15T10:00:00Z',
  lastRecalledAt: null,
  enabled: true,
  ...overrides,
});

describe('DeleteMemoryDialog', () => {
  const defaultProps = {
    memory: makeMemory(),
    open: true,
    onOpenChange: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('renders dialog with title and description when open', () => {
    render(<DeleteMemoryDialog {...defaultProps} />);

    expect(screen.getByTestId('delete-memory-dialog')).toBeInTheDocument();
    expect(screen.getByText('Delete Memory')).toBeInTheDocument();
    expect(screen.getByText(/cannot be undone/i)).toBeInTheDocument();
  });

  it('shows memory content preview', () => {
    render(<DeleteMemoryDialog {...defaultProps} />);

    expect(screen.getByText('Prefers TypeScript over JavaScript')).toBeInTheDocument();
  });

  it('truncates long content with ellipsis', () => {
    const longContent = 'A'.repeat(150);
    render(<DeleteMemoryDialog {...defaultProps} memory={makeMemory({ content: longContent })} />);

    expect(screen.getByText(`${'A'.repeat(120)}…`)).toBeInTheDocument();
  });

  it('calls onConfirm when delete button is clicked', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();

    render(<DeleteMemoryDialog {...defaultProps} onConfirm={onConfirm} />);

    await user.click(screen.getByTestId('confirm-delete-button'));

    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('has a cancel button', () => {
    render(<DeleteMemoryDialog {...defaultProps} />);

    expect(screen.getByTestId('cancel-delete-button')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<DeleteMemoryDialog {...defaultProps} open={false} />);

    expect(screen.queryByTestId('delete-memory-dialog')).not.toBeInTheDocument();
  });
});
