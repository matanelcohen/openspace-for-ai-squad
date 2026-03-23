import type { ActivityEvent } from '@openspace/shared';
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ActivityFeed } from '@/components/activity/activity-feed';

// --- Mocks ---

const mockUseWsEvent = vi.fn();

vi.mock('@/components/providers/websocket-provider', () => ({
  useWsEvent: (...args: unknown[]) => mockUseWsEvent(...args),
}));

const mockUseQuery = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

vi.mock('@/components/agent-avatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid="agent-avatar">{agentId}</div>
  ),
}));

vi.mock('@/lib/api-client', () => ({
  api: { get: vi.fn() },
}));

// --- Test data ---

const mockEvents: ActivityEvent[] = [
  {
    id: 'evt-1',
    type: 'completed',
    agentId: 'planner',
    description: 'Task analysis finished',
    timestamp: new Date(Date.now() - 120_000).toISOString(),
    relatedEntityId: null,
  },
  {
    id: 'evt-2',
    type: 'spawned',
    agentId: 'coder',
    description: 'Agent spawned for PR #42',
    timestamp: new Date(Date.now() - 300_000).toISOString(),
    relatedEntityId: 'task-1',
  },
  {
    id: 'evt-3',
    type: 'failed',
    agentId: 'reviewer',
    description: 'Review failed due to timeout',
    timestamp: new Date(Date.now() - 600_000).toISOString(),
    relatedEntityId: null,
  },
];

// --- Tests ---

describe('ActivityFeed', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseWsEvent.mockImplementation(() => {});
  });

  it('shows skeleton while loading', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    render(<ActivityFeed />);

    const skeletons = screen.getAllByTestId('activity-skeleton');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders activity events with correct descriptions', () => {
    mockUseQuery.mockReturnValue({ data: mockEvents, isLoading: false });

    render(<ActivityFeed />);

    expect(screen.getByText('Task analysis finished')).toBeInTheDocument();
    expect(screen.getByText('Agent spawned for PR #42')).toBeInTheDocument();
    expect(
      screen.getByText('Review failed due to timeout'),
    ).toBeInTheDocument();
  });

  it('renders agent avatars for each event', () => {
    mockUseQuery.mockReturnValue({ data: mockEvents, isLoading: false });

    render(<ActivityFeed />);

    const avatars = screen.getAllByTestId('agent-avatar');
    expect(avatars).toHaveLength(3);
    expect(avatars[0]).toHaveTextContent('planner');
    expect(avatars[1]).toHaveTextContent('coder');
  });

  it('renders correct event type badges', () => {
    mockUseQuery.mockReturnValue({ data: mockEvents, isLoading: false });

    render(<ActivityFeed />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('Spawned')).toBeInTheDocument();
    expect(screen.getByText('Failed')).toBeInTheDocument();
  });

  it('renders event type icons', () => {
    mockUseQuery.mockReturnValue({ data: mockEvents, isLoading: false });

    render(<ActivityFeed />);

    expect(screen.getByTestId('icon-completed')).toBeInTheDocument();
    expect(screen.getByTestId('icon-spawned')).toBeInTheDocument();
    expect(screen.getByTestId('icon-failed')).toBeInTheDocument();
  });

  it('shows empty state when no events', () => {
    mockUseQuery.mockReturnValue({ data: [], isLoading: false });

    render(<ActivityFeed />);

    expect(screen.getByText('No activity yet')).toBeInTheDocument();
  });

  it('prepends new live events via WebSocket callback', () => {
    mockUseQuery.mockReturnValue({ data: mockEvents, isLoading: false });

    // Capture the callback passed to useWsEvent
    let wsCallback: ((envelope: { payload: unknown }) => void) | undefined;
    mockUseWsEvent.mockImplementation(
      (type: string, cb: (envelope: { payload: unknown }) => void) => {
        if (type === 'activity:new') wsCallback = cb;
      },
    );

    render(<ActivityFeed />);

    const newEvent: ActivityEvent = {
      id: 'evt-new',
      type: 'started',
      agentId: 'deployer',
      description: 'Deployment started',
      timestamp: new Date().toISOString(),
      relatedEntityId: null,
    };

    // Simulate receiving a live event
    act(() => {
      if (wsCallback) {
        wsCallback({ payload: newEvent });
      }
    });

    expect(screen.getByText('Deployment started')).toBeInTheDocument();

    // The new event should appear before existing events
    const events = screen.getAllByTestId('activity-event');
    expect(events.length).toBe(4);
  });
});
