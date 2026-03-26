import type { Agent } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { MemoryToggle } from '../memory-toggle';

const makeAgent = (id: string, name: string, role: string): Agent => ({
  id,
  name,
  role,
  status: 'idle',
  currentTask: null,
  expertise: [],
  voiceProfile: { voiceId: 'default', speed: 1, pitch: 1 },
});

describe('MemoryToggle', () => {
  const agents = [
    makeAgent('leela', 'Leela', 'Lead'),
    makeAgent('bender', 'Bender', 'Backend'),
    makeAgent('fry', 'Fry', 'Frontend'),
  ];

  const defaultProps = {
    globalEnabled: true,
    agentEnabled: {},
    agents,
    onToggleGlobal: vi.fn(),
    onToggleAgent: vi.fn(),
  };

  it('renders memory toggle card', () => {
    render(<MemoryToggle {...defaultProps} />);

    expect(screen.getByTestId('memory-toggle')).toBeInTheDocument();
    expect(screen.getByText('Memory Settings')).toBeInTheDocument();
  });

  it('shows global toggle in enabled state', () => {
    render(<MemoryToggle {...defaultProps} />);

    const toggle = screen.getByTestId('global-memory-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'true');
  });

  it('shows global toggle in disabled state', () => {
    render(<MemoryToggle {...defaultProps} globalEnabled={false} />);

    const toggle = screen.getByTestId('global-memory-toggle');
    expect(toggle).toHaveAttribute('aria-checked', 'false');
  });

  it('calls onToggleGlobal when global toggle clicked', async () => {
    const onToggleGlobal = vi.fn();
    const user = userEvent.setup();

    render(<MemoryToggle {...defaultProps} onToggleGlobal={onToggleGlobal} />);

    await user.click(screen.getByTestId('global-memory-toggle'));

    expect(onToggleGlobal).toHaveBeenCalledWith(false);
  });

  it('shows per-agent toggles when globally enabled', () => {
    render(<MemoryToggle {...defaultProps} />);

    expect(screen.getByTestId('agent-toggle-leela')).toBeInTheDocument();
    expect(screen.getByTestId('agent-toggle-bender')).toBeInTheDocument();
    expect(screen.getByTestId('agent-toggle-fry')).toBeInTheDocument();
  });

  it('hides per-agent toggles when globally disabled', () => {
    render(<MemoryToggle {...defaultProps} globalEnabled={false} />);

    expect(screen.queryByTestId('agent-toggle-leela')).not.toBeInTheDocument();
  });

  it('calls onToggleAgent when agent toggle clicked', async () => {
    const onToggleAgent = vi.fn();
    const user = userEvent.setup();

    render(<MemoryToggle {...defaultProps} onToggleAgent={onToggleAgent} />);

    await user.click(screen.getByTestId('agent-memory-toggle-leela'));

    expect(onToggleAgent).toHaveBeenCalledWith('leela', false);
  });

  it('shows enabled description when global is on', () => {
    render(<MemoryToggle {...defaultProps} />);

    expect(
      screen.getByText(/memory is enabled/i),
    ).toBeInTheDocument();
  });

  it('shows disabled description when global is off', () => {
    render(<MemoryToggle {...defaultProps} globalEnabled={false} />);

    expect(
      screen.getByText(/memory is disabled globally/i),
    ).toBeInTheDocument();
  });
});
