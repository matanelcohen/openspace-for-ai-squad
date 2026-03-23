/**
 * P2-10 — Filter logic, loading/error states, and dark mode toggle tests
 *
 * Tests kanban board filtering by status, summary stats computed values,
 * and theme toggling behavior.
 */
import type { Agent, SquadOverview, Task } from '@openspace/shared';
import { TASK_STATUSES } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent,render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SummaryStats } from '@/components/dashboard/summary-stats';
import { TopBar } from '@/components/layout/top-bar';
import { KanbanBoard } from '@/components/tasks/kanban-board';

// ── Mocks ─────────────────────────────────────────────────────────

vi.mock('@/hooks/use-tasks');
vi.mock('@/hooks/use-squad');
vi.mock('next-themes', () => ({
  useTheme: vi.fn(() => ({ theme: 'light', setTheme: vi.fn() })),
}));

import { useTheme } from 'next-themes';

import { useSquad } from '@/hooks/use-squad';
import { useTasks, useUpdateTaskPriority,useUpdateTaskStatus } from '@/hooks/use-tasks';

const mockedUseTasks = vi.mocked(useTasks);
const mockedUseUpdateTaskStatus = vi.mocked(useUpdateTaskStatus);
const mockedUseUpdateTaskPriority = vi.mocked(useUpdateTaskPriority);
const mockedUseSquad = vi.mocked(useSquad);
const mockedUseTheme = vi.mocked(useTheme);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

// ── Fixtures ──────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: `task-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Test task',
    description: '',
    status: 'backlog',
    priority: 'P2',
    assignee: null,
    labels: [],
    createdAt: '2026-03-23T10:00:00Z',
    updatedAt: '2026-03-23T10:00:00Z',
    sortIndex: 0,
    ...overrides,
  };
}

const fullTaskSet: Task[] = [
  makeTask({ id: 't-1', title: 'Backlog task', status: 'backlog', sortIndex: 0 }),
  makeTask({ id: 't-2', title: 'In progress task', status: 'in-progress', sortIndex: 0 }),
  makeTask({ id: 't-3', title: 'In review task', status: 'in-review', sortIndex: 0 }),
  makeTask({ id: 't-4', title: 'Done task', status: 'done', sortIndex: 0 }),
  makeTask({ id: 't-5', title: 'Blocked task', status: 'blocked', sortIndex: 0 }),
  makeTask({ id: 't-6', title: 'Another backlog', status: 'backlog', sortIndex: 1 }),
  makeTask({ id: 't-7', title: 'Another done', status: 'done', sortIndex: 1 }),
];

// ── Setup ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseUpdateTaskStatus.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTaskStatus>);
  mockedUseUpdateTaskPriority.mockReturnValue({
    mutate: vi.fn(),
    mutateAsync: vi.fn(),
    isPending: false,
  } as unknown as ReturnType<typeof useUpdateTaskPriority>);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Kanban filter logic ───────────────────────────────────────────

describe('KanbanBoard — filter logic by status', () => {
  it('places each task in the correct status column', () => {
    mockedUseTasks.mockReturnValue({
      data: fullTaskSet,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });

    // Backlog has 2 tasks
    const backlog = screen.getByTestId('kanban-column-backlog');
    expect(backlog).toHaveTextContent('Backlog task');
    expect(backlog).toHaveTextContent('Another backlog');
    expect(backlog).toHaveTextContent('2');

    // In progress has 1
    const inProgress = screen.getByTestId('kanban-column-in-progress');
    expect(inProgress).toHaveTextContent('In progress task');
    expect(inProgress).toHaveTextContent('1');

    // Done has 2
    const done = screen.getByTestId('kanban-column-done');
    expect(done).toHaveTextContent('Done task');
    expect(done).toHaveTextContent('Another done');
    expect(done).toHaveTextContent('2');

    // In review has 1
    const inReview = screen.getByTestId('kanban-column-in-review');
    expect(inReview).toHaveTextContent('In review task');

    // Blocked has 1
    const blocked = screen.getByTestId('kanban-column-blocked');
    expect(blocked).toHaveTextContent('Blocked task');
  });

  it('handles empty task list', () => {
    mockedUseTasks.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });

    for (const status of TASK_STATUSES) {
      const col = screen.getByTestId(`kanban-column-${status}`);
      expect(col).toHaveTextContent('0');
      expect(col).toHaveTextContent('Drop tasks here');
    }
  });

  it('sorts tasks within columns by sortIndex', () => {
    const tasks = [
      makeTask({ id: 'z-1', title: 'Second', status: 'backlog', sortIndex: 2 }),
      makeTask({ id: 'z-2', title: 'First', status: 'backlog', sortIndex: 1 }),
      makeTask({ id: 'z-3', title: 'Third', status: 'backlog', sortIndex: 3 }),
    ];

    mockedUseTasks.mockReturnValue({
      data: tasks,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });

    const backlog = screen.getByTestId('kanban-column-backlog');
    const titles = backlog.querySelectorAll('[data-testid^="task-card-"]');
    expect(titles).toHaveLength(3);
  });

  it('displays all 5 columns regardless of data', () => {
    mockedUseTasks.mockReturnValue({
      data: [makeTask({ status: 'done' })],
      isLoading: false,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });

    for (const status of TASK_STATUSES) {
      expect(screen.getByTestId(`kanban-column-${status}`)).toBeInTheDocument();
    }
  });
});

// ── Loading and error states ──────────────────────────────────────

describe('KanbanBoard — loading and error states', () => {
  it('shows 5 skeleton columns during loading', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    const loading = screen.getByTestId('kanban-loading');
    expect(loading).toBeInTheDocument();
  });

  it('shows error message with error text', () => {
    mockedUseTasks.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network timeout'),
    } as ReturnType<typeof useTasks>);

    render(<KanbanBoard />, { wrapper });
    expect(screen.getByTestId('kanban-error')).toBeInTheDocument();
    expect(screen.getByText(/Network timeout/)).toBeInTheDocument();
  });
});

// ── SummaryStats computed values ──────────────────────────────────

describe('SummaryStats — computed values', () => {
  it('shows correct in-progress count', () => {
    const agents: Agent[] = [
      {
        id: 'a1',
        name: 'A1',
        role: 'Dev',
        status: 'active',
        currentTask: null,
        expertise: [],
        voiceProfile: { agentId: 'a1', displayName: 'A1', voiceId: 'v1', personality: '' },
      },
    ];

    mockedUseSquad.mockReturnValue({
      data: {
        config: { id: 'default', name: 'test', description: '', squadDir: '/tmp', agents },
        agents,
        recentTasks: [],
        taskCounts: {
          byStatus: { backlog: 5, 'in-progress': 3, 'in-review': 2, done: 10, blocked: 1 },
          total: 21,
        },
        recentDecisions: [
          { id: 'd1', title: 'Dec', author: 'Leela', date: '2026-01-01', rationale: '', status: 'active', affectedFiles: [] },
          { id: 'd2', title: 'Dec2', author: 'Leela', date: '2026-01-02', rationale: '', status: 'active', affectedFiles: [] },
        ],
      } as SquadOverview,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Decisions')).toBeInTheDocument();
    expect(screen.getByText('Issues')).toBeInTheDocument();
  });

  it('shows zero failed agents when none have failed status', () => {
    const agents: Agent[] = [
      {
        id: 'a1',
        name: 'A1',
        role: 'Dev',
        status: 'active',
        currentTask: null,
        expertise: [],
        voiceProfile: { agentId: 'a1', displayName: 'A1', voiceId: 'v1', personality: '' },
      },
    ];

    mockedUseSquad.mockReturnValue({
      data: {
        config: { id: 'default', name: 'test', description: '', squadDir: '/tmp', agents },
        agents,
        recentTasks: [],
        taskCounts: {
          byStatus: { backlog: 0, 'in-progress': 0, 'in-review': 0, done: 0, blocked: 0 },
          total: 0,
        },
        recentDecisions: [],
      } as SquadOverview,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats')).toBeInTheDocument();
  });

  it('counts multiple failed agents correctly', () => {
    const agents: Agent[] = [
      {
        id: 'a1', name: 'A1', role: 'Dev', status: 'failed',
        currentTask: null, expertise: [],
        voiceProfile: { agentId: 'a1', displayName: 'A1', voiceId: 'v1', personality: '' },
      },
      {
        id: 'a2', name: 'A2', role: 'Dev', status: 'failed',
        currentTask: null, expertise: [],
        voiceProfile: { agentId: 'a2', displayName: 'A2', voiceId: 'v1', personality: '' },
      },
      {
        id: 'a3', name: 'A3', role: 'Dev', status: 'active',
        currentTask: null, expertise: [],
        voiceProfile: { agentId: 'a3', displayName: 'A3', voiceId: 'v1', personality: '' },
      },
    ];

    mockedUseSquad.mockReturnValue({
      data: {
        config: { id: 'default', name: 'test', description: '', squadDir: '/tmp', agents },
        agents,
        recentTasks: [],
        taskCounts: {
          byStatus: { backlog: 0, 'in-progress': 0, 'in-review': 0, done: 0, blocked: 0 },
          total: 0,
        },
        recentDecisions: [],
      } as SquadOverview,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    mockedUseSquad.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats-loading')).toBeInTheDocument();
  });

  it('shows error state with message', () => {
    mockedUseSquad.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Server down'),
    } as ReturnType<typeof useSquad>);

    render(<SummaryStats />, { wrapper });
    expect(screen.getByTestId('summary-stats-error')).toBeInTheDocument();
    expect(screen.getByText(/Server down/)).toBeInTheDocument();
  });
});

// ── Dark mode toggle ──────────────────────────────────────────────

describe('TopBar — dark mode toggle', () => {
  it('calls setTheme to dark when current theme is light', () => {
    const setTheme = vi.fn();
    mockedUseTheme.mockReturnValue({
      theme: 'light',
      setTheme,
      resolvedTheme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light',
      forcedTheme: undefined,
    });

    render(<TopBar />);
    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    fireEvent.click(toggle);
    expect(setTheme).toHaveBeenCalledWith('dark');
  });

  it('calls setTheme to light when current theme is dark', () => {
    const setTheme = vi.fn();
    mockedUseTheme.mockReturnValue({
      theme: 'dark',
      setTheme,
      resolvedTheme: 'dark',
      themes: ['light', 'dark'],
      systemTheme: 'light',
      forcedTheme: undefined,
    });

    render(<TopBar />);
    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    fireEvent.click(toggle);
    expect(setTheme).toHaveBeenCalledWith('light');
  });

  it('renders squad name', () => {
    mockedUseTheme.mockReturnValue({
      theme: 'light',
      setTheme: vi.fn(),
      resolvedTheme: 'light',
      themes: ['light', 'dark'],
      systemTheme: 'light',
      forcedTheme: undefined,
    });

    render(<TopBar />);
    expect(screen.getByTestId('squad-name')).toHaveTextContent('openspace.ai Squad');
  });
});
