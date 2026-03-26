import type { Agent, ChatChannel, ChatMessage } from '@openspace/shared';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { ChannelMessageView } from '@/components/chat/channel-message-view';

// ── Mocks ───────────────────────────────────────────────────────────

const mockMessages: { data: ChatMessage[]; isLoading: boolean; isError: boolean } = {
  data: [],
  isLoading: false,
  isError: false,
};

const mockSendMutate = vi.fn();
const mockSendMessage = {
  mutate: mockSendMutate,
  mutateAsync: vi.fn(),
  isPending: false,
  isError: false,
};

vi.mock('@/hooks/use-channels', () => ({
  useChannelMessages: () => ({
    data: mockMessages.data,
    isLoading: mockMessages.isLoading,
    isError: mockMessages.isError,
  }),
  useSendChannelMessage: () => mockSendMessage,
}));

// ── Polyfills ───────────────────────────────────────────────────────

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  if (typeof window.PointerEvent === 'undefined') {
    class PointerEvent extends MouseEvent {
      readonly pointerId: number;
      constructor(type: string, init?: PointerEventInit & { pointerId?: number }) {
        super(type, init);
        this.pointerId = init?.pointerId ?? 0;
      }
    }
    (window as unknown as Record<string, unknown>).PointerEvent = PointerEvent;
  }
});

afterEach(() => {
  cleanup();
  mockMessages.data = [];
  mockMessages.isLoading = false;
  mockMessages.isError = false;
  mockSendMessage.isPending = false;
  mockSendMessage.isError = false;
  mockSendMutate.mockClear();
});

// ── Fixtures ────────────────────────────────────────────────────────

const channel: ChatChannel = {
  id: 'frontend',
  name: 'Frontend',
  description: 'Frontend team channel',
  memberAgentIds: ['fry', 'leela'],
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const agents: Agent[] = [
  {
    id: 'fry',
    name: 'Fry',
    role: 'Frontend',
    status: 'active',
    currentTask: null,
    expertise: ['react'],
    voiceProfile: { agentId: 'fry', displayName: 'Fry', voiceId: 'v1', personality: 'enthusiastic' },
  },
  {
    id: 'leela',
    name: 'Leela',
    role: 'Lead',
    status: 'active',
    currentTask: null,
    expertise: ['leadership'],
    voiceProfile: { agentId: 'leela', displayName: 'Leela', voiceId: 'v2', personality: 'decisive' },
  },
];

const sampleMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'fry',
    recipient: 'channel:frontend',
    content: 'Hello everyone!',
    timestamp: '2024-01-01T12:00:00Z',
    threadId: null,
  },
  {
    id: 'msg-2',
    sender: 'leela',
    recipient: 'channel:frontend',
    content: 'Hey Fry!',
    timestamp: '2024-01-01T12:01:00Z',
    threadId: null,
  },
];

// ── Tests ───────────────────────────────────────────────────────────

describe('ChannelMessageView', () => {
  // ── Basic rendering ────────────────────────────────────────────

  describe('basic rendering', () => {
    it('renders the view container', () => {
      render(<ChannelMessageView channel={channel} agents={agents} />);
      expect(screen.getByTestId('channel-message-view')).toBeInTheDocument();
    });

    it('renders the channel header', () => {
      render(<ChannelMessageView channel={channel} agents={agents} />);
      expect(screen.getByTestId('channel-header')).toBeInTheDocument();
      expect(screen.getByTestId('channel-header-name')).toHaveTextContent('Frontend');
    });

    it('renders the message input', () => {
      render(<ChannelMessageView channel={channel} agents={agents} />);
      expect(screen.getByTestId('message-input')).toBeInTheDocument();
    });
  });

  // ── Loading state ──────────────────────────────────────────────

  describe('loading state', () => {
    it('shows loading skeleton while messages are loading', () => {
      mockMessages.isLoading = true;
      render(<ChannelMessageView channel={channel} />);
      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
    });
  });

  // ── Error state ────────────────────────────────────────────────

  describe('error state', () => {
    it('shows error banner when message fetch fails', () => {
      mockMessages.isError = true;
      render(<ChannelMessageView channel={channel} />);
      expect(screen.getByTestId('channel-message-error')).toBeInTheDocument();
    });

    it('shows send error banner when sending fails', () => {
      mockSendMessage.isError = true;
      render(<ChannelMessageView channel={channel} />);
      expect(screen.getByTestId('channel-send-error')).toBeInTheDocument();
    });
  });

  // ── Empty state ────────────────────────────────────────────────

  describe('empty state', () => {
    it('shows empty state when no messages and not loading', () => {
      render(<ChannelMessageView channel={channel} />);
      expect(screen.getByTestId('channel-empty-state')).toBeInTheDocument();
    });

    it('includes channel name in empty state description', () => {
      render(<ChannelMessageView channel={channel} />);
      expect(screen.getByText(/Start the conversation in #Frontend/)).toBeInTheDocument();
    });
  });

  // ── Messages ───────────────────────────────────────────────────

  describe('messages', () => {
    it('renders messages when available', () => {
      mockMessages.data = sampleMessages;
      render(<ChannelMessageView channel={channel} agents={agents} />);
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
    });
  });

  // ── Sending messages ───────────────────────────────────────────

  describe('sending messages', () => {
    it('calls sendMessage.mutate when a message is sent', () => {
      render(<ChannelMessageView channel={channel} currentUserId="user1" />);
      const textarea = screen.getByTestId('message-textarea');
      fireEvent.change(textarea, { target: { value: 'Hello!' } });
      fireEvent.click(screen.getByTestId('send-button'));
      expect(mockSendMutate).toHaveBeenCalledWith({
        sender: 'user1',
        content: 'Hello!',
      });
    });

    it('uses default user ID when currentUserId is not provided', () => {
      render(<ChannelMessageView channel={channel} />);
      const textarea = screen.getByTestId('message-textarea');
      fireEvent.change(textarea, { target: { value: 'Test message' } });
      fireEvent.click(screen.getByTestId('send-button'));
      expect(mockSendMutate).toHaveBeenCalledWith({
        sender: 'user',
        content: 'Test message',
      });
    });
  });

  // ── Header actions passthrough ─────────────────────────────────

  describe('header integration', () => {
    it('passes onBack to header', () => {
      const onBack = vi.fn();
      render(<ChannelMessageView channel={channel} onBack={onBack} />);
      expect(screen.getByTestId('channel-header-back')).toBeInTheDocument();
      fireEvent.click(screen.getByTestId('channel-header-back'));
      expect(onBack).toHaveBeenCalledOnce();
    });

    it('passes onEditChannel to header', () => {
      const onEdit = vi.fn();
      render(<ChannelMessageView channel={channel} onEditChannel={onEdit} />);
      expect(screen.getByTestId('channel-header-settings')).toBeInTheDocument();
    });

    it('renders custom header actions', () => {
      render(
        <ChannelMessageView
          channel={channel}
          headerActions={<button data-testid="voice-btn">Voice</button>}
        />,
      );
      expect(screen.getByTestId('voice-btn')).toBeInTheDocument();
    });
  });

  // ── className ──────────────────────────────────────────────────

  describe('className prop', () => {
    it('applies custom className to root element', () => {
      render(<ChannelMessageView channel={channel} className="my-class" />);
      const root = screen.getByTestId('channel-message-view');
      expect(root.className).toContain('my-class');
    });
  });
});
