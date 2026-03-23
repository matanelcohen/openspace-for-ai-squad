import type { Agent, SquadOverview } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentGrid } from '@/components/dashboard/agent-grid';
import { SummaryStats } from '@/components/dashboard/summary-stats';

// Mock the hooks
vi.mock('@/hooks/use-agents');
vi.mock('@/hooks/use-squad');

import { useAgents } from '@/hooks/use-agents';
import { useSquad } from '@/hooks/use-squad';

const mockedUseAgents = vi.mocked(useAgents);
const mockedUseSquad = vi.mocked(useSquad);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const mockAgents: Agent[] = [
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    status: 'active',
    currentTask: 'Sprint planning',
    expertise: ['Architecture'],
    voiceProfile: { agentId: 'leela', displayName: 'Leela', voiceId: 'v1', personality: 'Confident' },
  },
  {
    id: 'bender',
    name: 'Bender',
    role: 'Backend',
    status: 'idle',
    currentTask: null,
    expertise: ['API', 'Database'],
    voiceProfile: { agentId: 'bender', displayName: 'Bender', voiceId: 'v2', personality: 'Blunt' },
  },
];

const mockSquadOverview: SquadOverview = {
  config: {
    id: 'default',
    name: 'openspace.ai',
    description: 'AI squad',
    squadDir: '/tmp/.squad',
    agents: mockAgents,
  },
  agents: mockAgents,
  recentTasks: [],
  taskCounts: {
    byStatus: {
      backlog: 3,
      'in-progress': 2,
      'in-review': 1,
      done: 5,
      blocked: 0,
    },
    total: 11,
  },
  recentDecisions: [
    {
      id: 'd1',
      title: 'Use Fastify',
      author: 'Leela',
      date: '2026-03-23',
      rationale: 'Performance',
      status: 'active',
      affectedFiles: [],
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgentGrid', () => {
  it('shows loading skeletons while fetching', () => {
    mockedUseAgents.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useAgents>);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('agent-card-skeleton')).toHaveLength(4);
  });

  it('shows error message on failure', () => {
    mockedUseAgents.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network error'),
    } as ReturnType<typeof useAgents>);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid-error')).toBeInTheDocument();
    expect(screen.getByText(/Network error/)).toBeInTheDocument();
  });

  it('shows empty state when no agents', () => {
    mockedUseAgents.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useAgents>);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid-empty')).toBeInTheDocument();
  });

  it('renders agent cards when data is loaded', () => {
    mockedUseAgents.mockReturnValue({
      data: mockAgents,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useAgents>);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid')).toBeInTheDocument();
    expect(screen.getByText('Leela')).toBeInTheDocument();
    expect(screen.getByText('Bender')).toBeInTheDocument();
  });
});

describe('SummaryStats', () => {
  it('shows loading skeletons while fetching', () => {
    mockedUseSquad.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('stat-card-skeleton')).toHaveLength(4);
  });

  it('shows error message on failure', () => {
    mockedUseSquad.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Server error'),
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats-error')).toBeInTheDocument();
  });

  it('renders stat cards with correct values', () => {
    mockedUseSquad.mockReturnValue({
      data: mockSquadOverview,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Decisions')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });
});
