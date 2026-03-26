import type { Memory } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { MemoryList } from '../memory-list';

vi.mock('../memory-card', () => ({
  MemoryCard: ({ memory }: { memory: Memory }) => (
    <div data-testid={`memory-card-${memory.id}`}>{memory.content}</div>
  ),
}));

const makeMemory = (overrides: Partial<Memory> = {}): Memory => ({
  id: '1',
  agentId: 'leela',
  type: 'preference',
  content: 'Prefers TypeScript',
  sourceSession: 'session-abc-123',
  createdAt: '2024-01-01T10:00:00Z',
  updatedAt: '2024-01-01T10:00:00Z',
  lastRecalledAt: null,
  enabled: true,
  ...overrides,
});

describe('MemoryList', () => {
  const noop = vi.fn();

  it('renders empty state when no memories', () => {
    render(<MemoryList memories={[]} onUpdate={noop} onDelete={noop} />);

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText(/no memories found/i)).toBeInTheDocument();
  });

  it('renders memory cards', () => {
    const memories = [
      makeMemory({ id: '1' }),
      makeMemory({ id: '2', content: 'Uses Zustand' }),
      makeMemory({ id: '3', content: 'Prefers dark mode' }),
    ];

    render(<MemoryList memories={memories} onUpdate={noop} onDelete={noop} />);

    expect(screen.getByTestId('memory-list')).toBeInTheDocument();
    expect(screen.getByTestId('memory-card-1')).toBeInTheDocument();
    expect(screen.getByTestId('memory-card-2')).toBeInTheDocument();
    expect(screen.getByTestId('memory-card-3')).toBeInTheDocument();
  });

  it('sorts memories by date, newest first', () => {
    const memories = [
      makeMemory({ id: '1', createdAt: '2024-01-01T10:00:00Z' }),
      makeMemory({ id: '2', createdAt: '2024-01-03T10:00:00Z' }),
      makeMemory({ id: '3', createdAt: '2024-01-02T10:00:00Z' }),
    ];

    render(<MemoryList memories={memories} onUpdate={noop} onDelete={noop} />);

    const cards = screen.getAllByTestId(/memory-card-/);
    expect(cards[0]).toHaveAttribute('data-testid', 'memory-card-2');
    expect(cards[1]).toHaveAttribute('data-testid', 'memory-card-3');
    expect(cards[2]).toHaveAttribute('data-testid', 'memory-card-1');
  });

  it('shows count of memories', () => {
    const memories = [makeMemory({ id: '1' }), makeMemory({ id: '2' })];

    render(<MemoryList memories={memories} onUpdate={noop} onDelete={noop} />);

    expect(screen.getByText('2 memories')).toBeInTheDocument();
  });

  it('shows singular "memory" for single item', () => {
    render(<MemoryList memories={[makeMemory()]} onUpdate={noop} onDelete={noop} />);

    expect(screen.getByText('1 memory')).toBeInTheDocument();
  });
});
