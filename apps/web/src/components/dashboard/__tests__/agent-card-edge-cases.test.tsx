/**
 * P2-10 — Comprehensive agent card tests: all statuses, edge cases
 */
import type { Agent } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AgentCard } from '@/components/dashboard/agent-card';

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'test-agent',
    name: 'Test Agent',
    role: 'Developer',
    status: 'idle',
    currentTask: null,
    expertise: [],
    voiceProfile: {
      agentId: 'test-agent',
      displayName: 'Test Agent',
      voiceId: 'v1',
      personality: 'Neutral',
    },
    ...overrides,
  };
}

describe('AgentCard — all statuses', () => {
  it.each([
    ['active', 'Active'],
    ['idle', 'Idle'],
    ['spawned', 'Spawned'],
    ['failed', 'Failed'],
  ] as const)('renders status badge for %s', (status, label) => {
    render(<AgentCard agent={makeAgent({ status })} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});

describe('AgentCard — edge cases', () => {
  it('renders with very long task description', () => {
    const longTask = 'A'.repeat(500);
    render(<AgentCard agent={makeAgent({ currentTask: longTask })} />);
    expect(screen.getByText(longTask)).toBeInTheDocument();
  });

  it('renders with many expertise tags', () => {
    const tags = Array.from({ length: 20 }, (_, i) => `Skill-${i}`);
    render(<AgentCard agent={makeAgent({ expertise: tags })} />);
    tags.forEach((tag) => {
      expect(screen.getByText(tag)).toBeInTheDocument();
    });
  });

  it('renders agent with special characters in name', () => {
    render(<AgentCard agent={makeAgent({ name: 'Dr. Zoidberg 🦀' })} />);
    expect(screen.getByText('Dr. Zoidberg 🦀')).toBeInTheDocument();
  });

  it('renders agent with empty string role', () => {
    render(<AgentCard agent={makeAgent({ role: '' })} />);
    expect(screen.getByTestId('agent-card-test-agent')).toBeInTheDocument();
  });

  it('renders failed agent correctly', () => {
    render(
      <AgentCard
        agent={makeAgent({
          status: 'failed',
          currentTask: 'Crashed during build',
        })}
      />,
    );
    expect(screen.getByText('Failed')).toBeInTheDocument();
    expect(screen.getByText('Crashed during build')).toBeInTheDocument();
  });

  it('renders spawned agent without task', () => {
    render(<AgentCard agent={makeAgent({ status: 'spawned', currentTask: null })} />);
    expect(screen.getByText('Spawned')).toBeInTheDocument();
    expect(screen.queryByText('Current task')).not.toBeInTheDocument();
  });
});
