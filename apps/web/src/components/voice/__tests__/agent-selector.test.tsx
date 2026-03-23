import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AgentSelector } from '../agent-selector';

describe('AgentSelector', () => {
  const availableAgents = ['leela', 'bender', 'fry'];

  it('renders agent selector', () => {
    render(
      <AgentSelector
        availableAgents={availableAgents}
        selectedAgent={null}
        onSelectAgent={vi.fn()}
      />
    );
    
    expect(screen.getByTestId('agent-selector')).toBeInTheDocument();
  });

  it('shows Team (All) when no agent selected', () => {
    render(
      <AgentSelector
        availableAgents={availableAgents}
        selectedAgent={null}
        onSelectAgent={vi.fn()}
      />
    );
    
    expect(screen.getByRole('combobox')).toHaveTextContent('Team (All)');
  });

  it('shows selected agent name', () => {
    render(
      <AgentSelector
        availableAgents={availableAgents}
        selectedAgent="leela"
        onSelectAgent={vi.fn()}
      />
    );
    
    expect(screen.getByRole('combobox')).toHaveTextContent('Leela');
  });

  it('can be disabled', () => {
    render(
      <AgentSelector
        availableAgents={availableAgents}
        selectedAgent={null}
        onSelectAgent={vi.fn()}
        disabled={true}
      />
    );
    
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('calls onSelectAgent with agent id', async () => {
    const user = userEvent.setup();
    const onSelectAgent = vi.fn();
    
    render(
      <AgentSelector
        availableAgents={availableAgents}
        selectedAgent={null}
        onSelectAgent={onSelectAgent}
      />
    );
    
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByTestId('agent-option-leela'));
    
    expect(onSelectAgent).toHaveBeenCalledWith('leela');
  });

  it('calls onSelectAgent with null for team option', async () => {
    const user = userEvent.setup();
    const onSelectAgent = vi.fn();
    
    render(
      <AgentSelector
        availableAgents={availableAgents}
        selectedAgent="leela"
        onSelectAgent={onSelectAgent}
      />
    );
    
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByTestId('agent-option-team'));
    
    expect(onSelectAgent).toHaveBeenCalledWith(null);
  });
});
