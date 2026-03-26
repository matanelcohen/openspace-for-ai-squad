import type { Memory } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemoryCard } from '../memory-card';

vi.mock('../memory-detail-dialog', () => ({
  MemoryDetailDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="memory-detail-dialog">Detail</div> : null,
}));

vi.mock('../delete-memory-dialog', () => ({
  DeleteMemoryDialog: ({
    open,
    onConfirm,
  }: {
    open: boolean;
    onConfirm: () => void;
  }) =>
    open ? (
      <div data-testid="delete-memory-dialog">
        <button data-testid="confirm-delete-button" onClick={onConfirm}>
          Delete
        </button>
      </div>
    ) : null,
}));

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

describe('MemoryCard', () => {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();

  it('renders memory content and metadata', () => {
    render(<MemoryCard memory={makeMemory()} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByTestId('memory-card')).toBeInTheDocument();
    expect(screen.getByText('Prefers TypeScript over JavaScript')).toBeInTheDocument();
    expect(screen.getByTestId('memory-type-badge')).toHaveTextContent('preference');
    expect(screen.getByText('leela')).toBeInTheDocument();
  });

  it('shows last recalled date when available', () => {
    render(<MemoryCard memory={makeMemory()} onUpdate={onUpdate} onDelete={onDelete} />);

    expect(screen.getByText(/last used/i)).toBeInTheDocument();
  });

  it('does not show last recalled when null', () => {
    render(
      <MemoryCard
        memory={makeMemory({ lastRecalledAt: null })}
        onUpdate={onUpdate}
        onDelete={onDelete}
      />,
    );

    expect(screen.queryByText(/last used/i)).not.toBeInTheDocument();
  });

  it('opens detail dialog on edit click', async () => {
    const user = userEvent.setup();
    render(<MemoryCard memory={makeMemory()} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByTestId('edit-memory-button'));

    expect(screen.getByTestId('memory-detail-dialog')).toBeInTheDocument();
  });

  it('opens delete dialog on delete click', async () => {
    const user = userEvent.setup();
    render(<MemoryCard memory={makeMemory()} onUpdate={onUpdate} onDelete={onDelete} />);

    await user.click(screen.getByTestId('delete-memory-button'));

    expect(screen.getByTestId('delete-memory-dialog')).toBeInTheDocument();
  });

  it('renders correct type badge variants', () => {
    const { rerender } = render(
      <MemoryCard memory={makeMemory({ type: 'pattern' })} onUpdate={onUpdate} onDelete={onDelete} />,
    );
    expect(screen.getByTestId('memory-type-badge')).toHaveTextContent('pattern');

    rerender(
      <MemoryCard memory={makeMemory({ type: 'decision' })} onUpdate={onUpdate} onDelete={onDelete} />,
    );
    expect(screen.getByTestId('memory-type-badge')).toHaveTextContent('decision');
  });
});
