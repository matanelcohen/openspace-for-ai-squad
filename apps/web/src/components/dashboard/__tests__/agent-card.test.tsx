import type { Agent } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentCard } from '@/components/dashboard/agent-card';

const mockAgent: Agent = {
  id: 'leela',
  name: 'Leela',
  role: 'Lead',
  status: 'active',
  currentTask: 'Managing sprint planning',
  expertise: ['Architecture', 'Planning'],
  voiceProfile: {
    agentId: 'leela',
    displayName: 'Leela',
    voiceId: 'leela-v1',
    personality: 'Confident and direct',
  },
};

const idleAgent: Agent = {
  ...mockAgent,
  id: 'bender',
  name: 'Bender',
  role: 'Backend',
  status: 'idle',
  currentTask: null,
  expertise: [],
};

describe('AgentCard', () => {
  it('renders agent name and role', () => {
    render(<AgentCard agent={mockAgent} />);
    expect(screen.getByText('Leela')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
  });

  it('shows status badge', () => {
    render(<AgentCard agent={mockAgent} />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows current task when assigned', () => {
    render(<AgentCard agent={mockAgent} />);
    expect(screen.getByText('Managing sprint planning')).toBeInTheDocument();
  });

  it('does not show task section when no current task', () => {
    render(<AgentCard agent={idleAgent} />);
    expect(screen.queryByText('Current task')).not.toBeInTheDocument();
  });

  it('renders expertise tags', () => {
    render(<AgentCard agent={mockAgent} />);
    expect(screen.getByText('Architecture')).toBeInTheDocument();
    expect(screen.getByText('Planning')).toBeInTheDocument();
  });

  it('does not render expertise section when empty', () => {
    render(<AgentCard agent={idleAgent} />);
    expect(screen.queryByText('Architecture')).not.toBeInTheDocument();
  });

  it('has a testid with agent id', () => {
    render(<AgentCard agent={mockAgent} />);
    expect(screen.getByTestId('agent-card-leela')).toBeInTheDocument();
  });
});
