/**
 * Loading + Empty state tests for all major feature areas.
 * Verifies that dashboard, task board, chat, activity, and decisions
 * handle loading, error, and empty states correctly.
 */
import type { Agent, ChatMessage, SquadOverview } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock hooks
vi.mock('@/hooks/use-agents');
vi.mock('@/hooks/use-squad');
vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-chat');
vi.mock('@/components/providers/websocket-provider', () => ({
  useWsEvent: vi.fn(),
  useWsConnection: vi.fn(() => ({ isConnected: true })),
  useWsSend: vi.fn(() => vi.fn()),
}));

import { useAgents } from '@/hooks/use-agents';
import { useSquad } from '@/hooks/use-squad';
import { useTasks } from '@/hooks/use-tasks';

const mockedUseAgents = vi.mocked(useAgents);
const mockedUseSquad = vi.mocked(useSquad);
const mockedUseTasks = vi.mocked(useTasks);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mock return partials
type AnyMockReturn = any;

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ─────────────────────────────────────────────────
// Dashboard — AgentGrid
// ─────────────────────────────────────────────────
import { AgentGrid } from '@/components/dashboard/agent-grid';

describe('AgentGrid — Loading + Empty + Error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton loading state', () => {
    mockedUseAgents.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as AnyMockReturn);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('agent-card-skeleton')).toHaveLength(4);
  });

  it('shows error state with message', () => {
    mockedUseAgents.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Connection refused'),
    } as AnyMockReturn);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid-error')).toBeInTheDocument();
    expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
  });

  it('shows empty state when no agents', () => {
    mockedUseAgents.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as AnyMockReturn);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid-empty')).toBeInTheDocument();
    expect(screen.getByText(/No agents found/)).toBeInTheDocument();
  });

  it('renders agent cards when data is available', () => {
    const agents: Agent[] = [
      {
        id: 'leela',
        name: 'Leela',
        role: 'Lead',
        status: 'active',
        currentTask: 'Planning',
        expertise: ['Architecture'],
        voiceProfile: {
          agentId: 'leela',
          displayName: 'Leela',
          voiceId: 'v1',
          personality: 'Confident',
        },
      },
    ];

    mockedUseAgents.mockReturnValue({
      data: agents,
      isLoading: false,
      error: null,
    } as AnyMockReturn);

    render(<AgentGrid />, { wrapper });
    expect(screen.getByTestId('agent-grid')).toBeInTheDocument();
    expect(screen.getByTestId('agent-card-leela')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────
// Dashboard — SummaryStats
// ─────────────────────────────────────────────────
import { SummaryStats } from '@/components/dashboard/summary-stats';

describe('SummaryStats — Loading + Error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton loading state (4 stat cards)', () => {
    mockedUseSquad.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as AnyMockReturn);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats-loading')).toBeInTheDocument();
    expect(screen.getAllByTestId('stat-card-skeleton')).toHaveLength(4);
  });

  it('shows error state', () => {
    mockedUseSquad.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('API timeout'),
    } as AnyMockReturn);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats-error')).toBeInTheDocument();
    expect(screen.getByText(/API timeout/)).toBeInTheDocument();
  });

  it('renders stat cards with data', () => {
    const overview: SquadOverview = {
      config: { id: 'test', name: 'Test Squad', description: '', squadDir: '/tmp' },
      agents: [],
      recentDecisions: [],
      taskCounts: {
        total: 5,
        byStatus: { backlog: 2, 'in-progress': 1, 'in-review': 1, done: 1, blocked: 0 },
        byPriority: { P0: 0, P1: 1, P2: 2, P3: 1, P4: 1 },
      },
    };

    mockedUseSquad.mockReturnValue({
      data: overview,
      isLoading: false,
      error: null,
    } as AnyMockReturn);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────
// Task Board — KanbanBoard
// ─────────────────────────────────────────────────
import { KanbanBoard } from '@/components/tasks/kanban-board';

vi.mock('@/hooks/use-tasks', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    useTasks: vi.fn(),
    useUpdateTaskStatus: vi.fn(() => ({ mutate: vi.fn() })),
    useUpdateTaskPriority: vi.fn(() => ({ mutate: vi.fn() })),
  };
});

describe('KanbanBoard — Loading + Error states', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows skeleton loading state (5 columns)', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as AnyMockReturn);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-loading')).toBeInTheDocument();
  });

  it('shows error state when API fails', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Server unavailable'),
    } as AnyMockReturn);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-error')).toBeInTheDocument();
    expect(screen.getByText(/Server unavailable/)).toBeInTheDocument();
  });

  it('renders empty columns when no tasks', () => {
    mockedUseTasks.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as AnyMockReturn);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-board')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-backlog')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-in-progress')).toBeInTheDocument();
    expect(screen.getByTestId('kanban-column-done')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────
// Chat — MessageList
// ─────────────────────────────────────────────────
import { MessageList } from '@/components/chat/message-list';

describe('MessageList — Loading + Empty states', () => {
  it('shows skeleton loading state', () => {
    render(<MessageList messages={[]} isLoading={true} />);
    expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<MessageList messages={[]} isLoading={false} />);
    expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
    expect(screen.getByText(/No messages yet/)).toBeInTheDocument();
  });

  it('renders messages when available', () => {
    const messages: ChatMessage[] = [
      {
        id: 'msg-1',
        sender: 'leela',
        recipient: 'team',
        content: 'Hello team!',
        timestamp: '2026-03-24T00:00:00Z',
      },
    ];

    render(<MessageList messages={messages} isLoading={false} />);
    expect(screen.getByTestId('message-list')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.getByText('Hello team!')).toBeInTheDocument();
  });
});

// ─────────────────────────────────────────────────
// Activity Feed
// ─────────────────────────────────────────────────
import { ActivityFeed } from '@/components/activity/activity-feed';

describe('ActivityFeed — Loading + Empty states', () => {
  it('shows skeleton loading state', async () => {
    const neverResolve = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: () => new Promise(() => {}),
        },
      },
    });

    render(
      <QueryClientProvider client={neverResolve}>
        <ActivityFeed />
      </QueryClientProvider>,
    );

    expect(screen.getAllByTestId('activity-skeleton').length).toBeGreaterThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────
// MessageInput
// ─────────────────────────────────────────────────
import { MessageInput } from '@/components/chat/message-input';

describe('MessageInput — Disabled + Loading states', () => {
  it('disables input and button when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} disabled={true} />);
    expect(screen.getByTestId('message-textarea')).toBeDisabled();
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('shows typing indicator when isTyping is true', () => {
    render(<MessageInput onSend={vi.fn()} isTyping={true} />);
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByText('typing...')).toBeInTheDocument();
  });
});
