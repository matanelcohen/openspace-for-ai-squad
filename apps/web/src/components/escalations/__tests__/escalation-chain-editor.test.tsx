import type { EscalationChain } from '@matanelcohen/openspace-shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EscalationChainEditor } from '../escalation-chain-editor';

const defaultChains: EscalationChain[] = [
  {
    id: 'chain-1',
    name: 'Default Chain',
    levels: [
      { level: 1, name: 'L1 Reviewer', reviewerIds: ['alice', 'bob'], timeoutMs: 30 * 60_000 },
      { level: 2, name: 'L2 Senior', reviewerIds: ['carol'], timeoutMs: 60 * 60_000 },
    ],
  },
];

describe('EscalationChainEditor', () => {
  it('renders the card with title', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    expect(screen.getByText('Escalation Chains')).toBeInTheDocument();
  });

  it('renders all chains', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    expect(screen.getByTestId('chain-0')).toBeInTheDocument();
  });

  it('displays chain name', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    const nameInput = screen.getByTestId('chain-name-0') as HTMLInputElement;
    expect(nameInput.value).toBe('Default Chain');
  });

  it('shows level count', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    expect(screen.getByText('2 levels')).toBeInTheDocument();
  });

  it('shows empty state when no chains', () => {
    render(<EscalationChainEditor chains={[]} onSave={vi.fn()} />);
    expect(screen.getByTestId('no-chains')).toBeInTheDocument();
    expect(screen.getByText(/No escalation chains configured/)).toBeInTheDocument();
  });

  it('adds a new chain', () => {
    render(<EscalationChainEditor chains={[]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-chain-btn'));
    expect(screen.getByTestId('chain-0')).toBeInTheDocument();
  });

  it('removes a chain', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('remove-chain-0'));
    expect(screen.queryByTestId('chain-0')).not.toBeInTheDocument();
  });

  it('expands chain to show levels', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    expect(screen.queryByTestId('chain-levels-0')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    expect(screen.getByTestId('chain-levels-0')).toBeInTheDocument();
    expect(screen.getByTestId('level-0-0')).toBeInTheDocument();
    expect(screen.getByTestId('level-0-1')).toBeInTheDocument();
  });

  it('shows level names when expanded', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));

    const name0 = screen.getByTestId('level-name-0-0') as HTMLInputElement;
    const name1 = screen.getByTestId('level-name-0-1') as HTMLInputElement;
    expect(name0.value).toBe('L1 Reviewer');
    expect(name1.value).toBe('L2 Senior');
  });

  it('shows reviewer IDs when expanded', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));

    const reviewers0 = screen.getByTestId('level-reviewers-0-0') as HTMLInputElement;
    expect(reviewers0.value).toBe('alice, bob');
  });

  it('shows timeout in minutes when expanded', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));

    const timeout0 = screen.getByTestId('level-timeout-0-0') as HTMLInputElement;
    expect(timeout0.value).toBe('30');
  });

  it('adds a level to a chain', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    fireEvent.click(screen.getByTestId('add-level-0'));
    expect(screen.getByTestId('level-0-2')).toBeInTheDocument();
  });

  it('removes a level from a chain', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    expect(screen.getByTestId('level-0-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('remove-level-0-1'));
    expect(screen.queryByTestId('level-0-1')).not.toBeInTheDocument();
  });

  it('disables remove when only one level', () => {
    const singleLevel: EscalationChain[] = [
      {
        id: 'chain-1',
        name: 'Single',
        levels: [{ level: 1, name: 'L1', reviewerIds: [], timeoutMs: 30 * 60_000 }],
      },
    ];
    render(<EscalationChainEditor chains={singleLevel} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    expect(screen.getByTestId('remove-level-0-0')).toBeDisabled();
  });

  it('enables save button when dirty and valid', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    const saveBtn = screen.getByTestId('save-chains-btn');
    expect(saveBtn).toBeDisabled();

    // Expand and modify an existing chain (which already has a valid name)
    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    fireEvent.click(screen.getByTestId('add-level-0'));
    expect(saveBtn).not.toBeDisabled();
  });

  it('calls onSave with cleaned chains', () => {
    const onSave = vi.fn();
    render(<EscalationChainEditor chains={defaultChains} onSave={onSave} />);
    // Make dirty
    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    fireEvent.click(screen.getByTestId('add-level-0'));
    fireEvent.click(screen.getByTestId('save-chains-btn'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved).toHaveLength(1);
    expect(saved[0].levels).toHaveLength(3);
    expect(saved[0]).not.toHaveProperty('_key');
  });

  it('shows reset button when dirty', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    expect(screen.queryByTestId('reset-chains-btn')).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId('add-chain-btn'));
    expect(screen.getByTestId('reset-chains-btn')).toBeInTheDocument();
  });

  it('resets to original on reset click', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-chain-btn'));
    expect(screen.getByTestId('chain-1')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('reset-chains-btn'));
    expect(screen.queryByTestId('chain-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('chain-0')).toBeInTheDocument();
  });

  it('disables save when isSaving', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} isSaving />);
    fireEvent.click(screen.getByTestId('add-chain-btn'));
    expect(screen.getByTestId('save-chains-btn')).toBeDisabled();
  });

  it('shows "Saving…" when isSaving', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} isSaving />);
    expect(screen.getByTestId('save-chains-btn')).toHaveTextContent('Saving…');
  });

  it('has correct data-testid on card', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    expect(screen.getByTestId('escalation-chain-editor')).toBeInTheDocument();
  });

  it('auto-expands newly added chains', () => {
    render(<EscalationChainEditor chains={[]} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('add-chain-btn'));
    expect(screen.getByTestId('chain-levels-0')).toBeInTheDocument();
  });

  it('collapses chain on toggle', () => {
    render(<EscalationChainEditor chains={defaultChains} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    expect(screen.getByTestId('chain-levels-0')).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    expect(screen.queryByTestId('chain-levels-0')).not.toBeInTheDocument();
  });

  it('re-numbers levels after removal', () => {
    const chain: EscalationChain[] = [
      {
        id: 'chain-1',
        name: 'Test',
        levels: [
          { level: 1, name: 'L1', reviewerIds: [], timeoutMs: 30 * 60_000 },
          { level: 2, name: 'L2', reviewerIds: [], timeoutMs: 30 * 60_000 },
          { level: 3, name: 'L3', reviewerIds: [], timeoutMs: 30 * 60_000 },
        ],
      },
    ];
    render(<EscalationChainEditor chains={chain} onSave={vi.fn()} />);
    fireEvent.click(screen.getByTestId('toggle-chain-0'));
    fireEvent.click(screen.getByTestId('remove-level-0-1')); // Remove L2

    // Should now only have 2 levels: level-0-0 and level-0-1
    expect(screen.getByTestId('level-0-0')).toBeInTheDocument();
    expect(screen.getByTestId('level-0-1')).toBeInTheDocument();
    expect(screen.queryByTestId('level-0-2')).not.toBeInTheDocument();
  });
});
