/**
 * Integration test: create-channel flow end-to-end with mocked API.
 *
 * Verifies the full flow:
 *   1. Render ChannelDialog in create mode
 *   2. Fill form (name, description, members)
 *   3. Submit → optimistic cache update
 *   4. API resolves → cache settled
 *
 * Also covers the error/rollback scenario.
 */
import type { Agent, ChatChannel } from '@openspace/shared';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { ChannelDialog } from '@/components/chat/channel-dialog';
import { channelKeys, useCreateChannel } from '@/hooks/use-channels';

// ── Mock WebSocket provider ─────────────────────────────────────────
vi.mock('@/components/providers/websocket-provider', () => ({
  useWsEvent: vi.fn(),
}));

// ── Fetch mock ──────────────────────────────────────────────────────
const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  });
}

// ── Polyfills ───────────────────────────────────────────────────────
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
  window.HTMLElement.prototype.releasePointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();

  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

// ── Setup ───────────────────────────────────────────────────────────
let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const agents: Agent[] = [
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    status: 'active',
    currentTask: null,
    expertise: [],
    voiceProfile: { agentId: 'leela', displayName: 'Leela', voiceId: 'leela-v1', personality: '' },
  },
  {
    id: 'fry',
    name: 'Fry',
    role: 'Frontend',
    status: 'active',
    currentTask: null,
    expertise: [],
    voiceProfile: { agentId: 'fry', displayName: 'Fry', voiceId: 'fry-v1', personality: '' },
  },
];

const existingChannels: ChatChannel[] = [
  {
    id: 'ch-general',
    name: 'General',
    description: 'General discussion',
    memberAgentIds: ['leela', 'fry'],
    createdAt: '2026-03-20T10:00:00Z',
    updatedAt: '2026-03-20T10:00:00Z',
  },
];

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  });
  fetchMock.mockReset();
});

afterEach(() => {
  cleanup();
  queryClient.clear();
});

// ── Harness component ───────────────────────────────────────────────

/**
 * Combines ChannelDialog with useCreateChannel to simulate the full
 * create-channel flow as a user would experience it.
 */
function CreateChannelHarness({ agents: agentList }: { agents: Agent[] }) {
  const [open, setOpen] = useState(true);
  const createChannel = useCreateChannel();

  const handleSave = (data: { name: string; description: string; memberAgentIds: string[] }) => {
    createChannel.mutate(data);
    setOpen(false);
  };

  return (
    <div>
      <ChannelDialog
        open={open}
        onOpenChange={setOpen}
        agents={agentList}
        onSave={handleSave}
        isSaving={createChannel.isPending}
      />
      <div data-testid="mutation-status">
        {createChannel.isPending
          ? 'pending'
          : createChannel.isSuccess
            ? 'success'
            : createChannel.isError
              ? 'error'
              : 'idle'}
      </div>
    </div>
  );
}

// ── Tests ───────────────────────────────────────────────────────────

describe('Create channel — integration flow', () => {
  it('creates a channel end-to-end: form → API → cache updated', async () => {
    // Pre-populate the channel cache
    queryClient.setQueryData(channelKeys.all, existingChannels);

    const createdChannel: ChatChannel = {
      id: 'ch-new-123',
      name: 'Design',
      description: 'Design team channel',
      memberAgentIds: ['leela'],
      createdAt: '2026-03-25T12:00:00Z',
      updatedAt: '2026-03-25T12:00:00Z',
    };

    // Mock API: POST /api/channels resolves with the created channel
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST' && url.includes('/api/channels')) {
        return jsonResponse(createdChannel, 201);
      }
      // GET /api/channels for invalidation refetch
      if (!opts?.method || opts.method === 'GET') {
        return jsonResponse([...existingChannels, createdChannel]);
      }
      return jsonResponse({}, 404);
    });

    render(<CreateChannelHarness agents={agents} />, { wrapper });

    // 1. Fill in the form
    fireEvent.change(screen.getByTestId('channel-name-input'), {
      target: { value: 'Design' },
    });
    fireEvent.change(screen.getByTestId('channel-description-input'), {
      target: { value: 'Design team channel' },
    });
    fireEvent.click(screen.getByTestId('member-toggle-leela'));

    // 2. Submit the form
    fireEvent.click(screen.getByTestId('channel-dialog-save'));

    // 3. Verify optimistic update — cache should have the temp channel immediately
    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
      expect(cached).toBeDefined();
      expect(cached!.length).toBeGreaterThanOrEqual(2);
      const optimistic = cached!.find((ch) => ch.name === 'Design');
      expect(optimistic).toBeDefined();
      expect(optimistic!.id).toMatch(/^temp-/);
    });

    // 4. Verify API was called with correct payload
    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCalls.length).toBe(1);
      const body = JSON.parse((postCalls[0]![1] as RequestInit).body as string);
      expect(body.name).toBe('Design');
      expect(body.description).toBe('Design team channel');
      expect(body.memberAgentIds).toEqual(['leela']);
    });

    // 5. Wait for mutation to settle
    await waitFor(() => {
      expect(screen.getByTestId('mutation-status')).toHaveTextContent('success');
    });
  });

  it('rolls back optimistic update on API failure', async () => {
    queryClient.setQueryData(channelKeys.all, existingChannels);

    // Deferred POST so the optimistic update is visible before rollback
    let rejectPost!: () => void;
    const postPromise = new Promise<{
      ok: boolean;
      status: number;
      json: () => Promise<unknown>;
      text: () => Promise<string>;
    }>((resolve) => {
      rejectPost = () =>
        resolve({
          ok: false,
          status: 500,
          json: () => Promise.resolve({ error: 'Internal Server Error' }),
          text: () => Promise.resolve('Internal Server Error'),
        });
    });

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') {
        return postPromise;
      }
      // GET refetch after settlement returns original channels only
      return jsonResponse(existingChannels);
    });

    render(<CreateChannelHarness agents={agents} />, { wrapper });

    // Fill and submit
    fireEvent.change(screen.getByTestId('channel-name-input'), {
      target: { value: 'Doomed Channel' },
    });
    fireEvent.click(screen.getByTestId('channel-dialog-save'));

    // Optimistic update should appear while the POST is in-flight
    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
      expect(cached!.some((ch) => ch.name === 'Doomed Channel')).toBe(true);
    });

    // Now let the POST fail
    rejectPost();

    // After mutation settles with error, cache should rollback
    await waitFor(() => {
      expect(screen.getByTestId('mutation-status')).toHaveTextContent('error');
    });

    // After invalidation, cache should only have original channels
    await waitFor(() => {
      const cached = queryClient.getQueryData<ChatChannel[]>(channelKeys.all);
      expect(cached).toBeDefined();
      expect(cached!.every((ch) => ch.name !== 'Doomed Channel')).toBe(true);
      expect(cached!.length).toBe(existingChannels.length);
    });
  });

  it('dialog closes after successful submission', async () => {
    queryClient.setQueryData(channelKeys.all, existingChannels);

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') {
        return jsonResponse(
          {
            id: 'ch-closed',
            name: 'Closed',
            description: '',
            memberAgentIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          201,
        );
      }
      return jsonResponse(existingChannels);
    });

    render(<CreateChannelHarness agents={agents} />, { wrapper });

    // Fill and submit
    fireEvent.change(screen.getByTestId('channel-name-input'), {
      target: { value: 'Closed' },
    });
    fireEvent.click(screen.getByTestId('channel-dialog-save'));

    // Dialog should close (the dialog content should no longer be in the DOM)
    await waitFor(() => {
      expect(screen.queryByTestId('channel-dialog')).not.toBeInTheDocument();
    });
  });

  it('sends no members when none are selected', async () => {
    queryClient.setQueryData(channelKeys.all, existingChannels);

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') {
        return jsonResponse({
          id: 'ch-nomembers',
          name: 'Solo',
          description: '',
          memberAgentIds: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      }
      return jsonResponse(existingChannels);
    });

    render(<CreateChannelHarness agents={agents} />, { wrapper });

    fireEvent.change(screen.getByTestId('channel-name-input'), {
      target: { value: 'Solo' },
    });
    fireEvent.click(screen.getByTestId('channel-dialog-save'));

    await waitFor(() => {
      const postCalls = fetchMock.mock.calls.filter(
        (call) => (call[1] as RequestInit | undefined)?.method === 'POST',
      );
      expect(postCalls.length).toBe(1);
      const body = JSON.parse((postCalls[0]![1] as RequestInit).body as string);
      expect(body.memberAgentIds).toEqual([]);
    });
  });
});
