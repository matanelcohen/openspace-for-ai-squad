import type { Memory } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemoryDetailDialog } from '../memory-detail-dialog';

const makeMemory = (overrides: Partial<Memory> = {}): Memory => ({
  id: 'mem-1',
  agentId: 'leela',
  type: 'preference',
  content: 'Prefers TypeScript over JavaScript',
  sourceSession: 'session-abc-12345678',
  createdAt: '2024-06-15T10:00:00Z',
  updatedAt: '2024-06-15T10:00:00Z',
  lastRecalledAt: '2024-06-20T10:00:00Z',
  enabled: true,
  ...overrides,
});

describe('MemoryDetailDialog', () => {
  const defaultProps = {
    memory: makeMemory(),
    open: true,
    onOpenChange: vi.fn(),
    onSave: vi.fn(),
  };

  it('renders dialog with memory details when open', () => {
    render(<MemoryDetailDialog {...defaultProps} />);

    expect(screen.getByTestId('memory-detail-dialog')).toBeInTheDocument();
    expect(screen.getByText('Memory Detail')).toBeInTheDocument();
    expect(screen.getByText('preference')).toBeInTheDocument();
  });

  it('displays memory metadata', () => {
    render(<MemoryDetailDialog {...defaultProps} />);

    expect(screen.getByText('leela')).toBeInTheDocument();
    expect(screen.getByText('session-abc-')).toBeInTheDocument();
  });

  it('shows content in read-only mode initially', () => {
    render(<MemoryDetailDialog {...defaultProps} />);

    expect(screen.getByTestId('memory-content-display')).toHaveTextContent(
      'Prefers TypeScript over JavaScript',
    );
    expect(screen.queryByTestId('memory-content-textarea')).not.toBeInTheDocument();
  });

  it('shows "Never" when lastRecalledAt is null', () => {
    render(<MemoryDetailDialog {...defaultProps} memory={makeMemory({ lastRecalledAt: null })} />);

    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('switches to edit mode on edit button click', async () => {
    const user = userEvent.setup();
    render(<MemoryDetailDialog {...defaultProps} />);

    await user.click(screen.getByTestId('start-edit-button'));

    expect(screen.getByTestId('memory-content-textarea')).toBeInTheDocument();
    expect(screen.queryByTestId('memory-content-display')).not.toBeInTheDocument();
  });

  it('calls onSave with updated content', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(<MemoryDetailDialog {...defaultProps} onSave={onSave} />);

    await user.click(screen.getByTestId('start-edit-button'));
    const textarea = screen.getByTestId('memory-content-textarea');
    await user.clear(textarea);
    await user.type(textarea, 'Updated content');
    await user.click(screen.getByTestId('save-memory-button'));

    expect(onSave).toHaveBeenCalledWith('Updated content');
  });

  it('reverts content on cancel', async () => {
    const user = userEvent.setup();
    render(<MemoryDetailDialog {...defaultProps} />);

    await user.click(screen.getByTestId('start-edit-button'));
    const textarea = screen.getByTestId('memory-content-textarea');
    await user.clear(textarea);
    await user.type(textarea, 'Temporary edit');
    await user.click(screen.getByTestId('cancel-edit-button'));

    expect(screen.getByTestId('memory-content-display')).toHaveTextContent(
      'Prefers TypeScript over JavaScript',
    );
  });

  it('does not render when closed', () => {
    render(<MemoryDetailDialog {...defaultProps} open={false} />);

    expect(screen.queryByTestId('memory-detail-dialog')).not.toBeInTheDocument();
  });
});
