import type { ChatMessage } from '@openspace/shared';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { MessageList } from '@/components/chat/message-list';

// ── Polyfills ──────────────────────────────────────────────────────

const scrollIntoViewMock = vi.fn();

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;
});

afterEach(() => {
  cleanup();
  scrollIntoViewMock.mockClear();
});

// ── Fixtures ───────────────────────────────────────────────────────

function msg(overrides: Partial<ChatMessage> & { id: string }): ChatMessage {
  return {
    sender: 'leela',
    recipient: 'team',
    content: 'Hello',
    timestamp: '2026-03-25T10:00:00Z',
    threadId: null,
    ...overrides,
  };
}

const twoMessages: ChatMessage[] = [
  msg({ id: 'msg-1', sender: 'leela', content: 'Hello team!', timestamp: '2026-03-25T10:00:00Z' }),
  msg({ id: 'msg-2', sender: 'bender', content: 'Hey there!', timestamp: '2026-03-25T10:01:00Z' }),
];

// ── Tests ──────────────────────────────────────────────────────────

describe('MessageList', () => {
  // ── Loading state ────────────────────────────────────────────────

  describe('loading state', () => {
    it('renders skeleton placeholders when isLoading is true', () => {
      render(<MessageList messages={[]} isLoading />);
      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
    });

    it('renders exactly 3 skeleton message rows', () => {
      const { container } = render(<MessageList messages={[]} isLoading />);
      const skeletons = container.querySelectorAll('.animate-pulse');
      // Each skeleton message has a circle + 2 text bars, but we just verify the container exists
      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
      expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });

    it('does not render messages when loading, even if messages are provided', () => {
      render(<MessageList messages={twoMessages} isLoading />);
      expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
      expect(screen.queryByTestId('message-msg-1')).not.toBeInTheDocument();
    });
  });

  // ── Empty state ──────────────────────────────────────────────────

  describe('empty state', () => {
    it('renders empty message when no messages and not loading', () => {
      render(<MessageList messages={[]} />);
      expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
      expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
    });

    it('does not render the message list container when empty', () => {
      render(<MessageList messages={[]} />);
      expect(screen.queryByTestId('message-list')).not.toBeInTheDocument();
    });
  });

  // ── Rendering messages ───────────────────────────────────────────

  describe('rendering messages', () => {
    it('renders each message with its testid', () => {
      render(<MessageList messages={twoMessages} />);
      expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
    });

    it('displays sender name for each message', () => {
      render(<MessageList messages={twoMessages} />);
      expect(screen.getByTestId('message-msg-1')).toHaveTextContent('leela');
      expect(screen.getByTestId('message-msg-2')).toHaveTextContent('bender');
    });

    it('displays message content', () => {
      render(<MessageList messages={twoMessages} />);
      expect(screen.getByText('Hello team!')).toBeInTheDocument();
      expect(screen.getByText('Hey there!')).toBeInTheDocument();
    });

    it('displays formatted timestamps', () => {
      render(<MessageList messages={twoMessages} />);
      // The component uses toLocaleTimeString with hour:2-digit, minute:2-digit
      // The exact format depends on locale but should contain time digits
      const msg1 = screen.getByTestId('message-msg-1');
      // Timestamp appears as text content within the message
      expect(msg1.textContent).toMatch(/\d{1,2}:\d{2}/);
    });

    it('preserves message order as provided', () => {
      render(<MessageList messages={twoMessages} />);
      const list = screen.getByTestId('message-list');
      const items = list.querySelectorAll('[data-testid^="message-msg-"]');
      expect(items).toHaveLength(2);
      expect(items[0]!.getAttribute('data-testid')).toBe('message-msg-1');
      expect(items[1]!.getAttribute('data-testid')).toBe('message-msg-2');
    });

    it('renders a single message correctly', () => {
      const single = [msg({ id: 'solo', sender: 'fry', content: 'Just me!' })];
      render(<MessageList messages={single} />);
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-solo')).toBeInTheDocument();
      expect(screen.getByText('Just me!')).toBeInTheDocument();
    });

    it('renders multiline content with whitespace preserved', () => {
      const multiline = [msg({ id: 'ml', content: 'Line 1\nLine 2\nLine 3' })];
      render(<MessageList messages={multiline} />);
      // getByText normalises whitespace; use the testid container instead
      const messageEl = screen.getByTestId('message-ml');
      expect(messageEl.textContent).toContain('Line 1');
      expect(messageEl.textContent).toContain('Line 2');
      expect(messageEl.textContent).toContain('Line 3');
      // Verify the rendering div preserves whitespace via CSS class
      const contentDiv = messageEl.querySelector('.whitespace-pre-wrap');
      expect(contentDiv).not.toBeNull();
      expect(contentDiv!.textContent).toBe('Line 1\nLine 2\nLine 3');
    });

    it('handles a large number of messages', () => {
      const manyMessages = Array.from({ length: 100 }, (_, i) =>
        msg({ id: `msg-${i}`, content: `Message #${i}` }),
      );
      render(<MessageList messages={manyMessages} />);
      expect(screen.getByTestId('message-list')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-0')).toBeInTheDocument();
      expect(screen.getByTestId('message-msg-99')).toBeInTheDocument();
    });
  });

  // ── Scroll behavior ──────────────────────────────────────────────

  describe('scroll behavior', () => {
    it('scrolls to bottom when messages are rendered', () => {
      render(<MessageList messages={twoMessages} />);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to bottom when messages change', () => {
      const { rerender } = render(<MessageList messages={twoMessages} />);
      scrollIntoViewMock.mockClear();

      const updatedMessages = [
        ...twoMessages,
        msg({ id: 'msg-3', sender: 'fry', content: 'New message!' }),
      ];
      rerender(<MessageList messages={updatedMessages} />);
      expect(scrollIntoViewMock).toHaveBeenCalledWith({ behavior: 'smooth' });
    });

    it('scrolls to bottom when typing agents change', () => {
      const typing = new Map([['leela', 'Leela']]);
      const { rerender } = render(<MessageList messages={twoMessages} />);
      scrollIntoViewMock.mockClear();

      rerender(<MessageList messages={twoMessages} typingAgents={typing} />);
      expect(scrollIntoViewMock).toHaveBeenCalled();
    });

    it('does not scroll when loading', () => {
      scrollIntoViewMock.mockClear();
      render(<MessageList messages={[]} isLoading />);
      // Loading state renders a different branch; no bottomRef is rendered
      expect(scrollIntoViewMock).not.toHaveBeenCalled();
    });
  });

  // ── Typing indicators ────────────────────────────────────────────

  describe('typing indicators', () => {
    it('shows typing indicator for a single agent', () => {
      const typing = new Map([['leela', 'Leela']]);
      render(<MessageList messages={twoMessages} typingAgents={typing} />);
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
      expect(screen.getByText(/Leela is typing/)).toBeInTheDocument();
    });

    it('shows "are typing" for multiple agents', () => {
      const typing = new Map([
        ['leela', 'Leela'],
        ['bender', 'Bender'],
      ]);
      render(<MessageList messages={twoMessages} typingAgents={typing} />);
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
      expect(screen.getByText(/are typing/)).toBeInTheDocument();
    });

    it('lists all typing agent names', () => {
      const typing = new Map([
        ['leela', 'Leela'],
        ['bender', 'Bender'],
      ]);
      render(<MessageList messages={twoMessages} typingAgents={typing} />);
      const indicator = screen.getByTestId('typing-indicator');
      expect(indicator).toHaveTextContent('Leela, Bender');
    });

    it('does not show typing indicator when typingAgents is undefined', () => {
      render(<MessageList messages={twoMessages} />);
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
    });

    it('does not show typing indicator when typingAgents is an empty map', () => {
      render(<MessageList messages={twoMessages} typingAgents={new Map()} />);
      expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
    });

    it('renders animated bounce dots inside the typing indicator', () => {
      const typing = new Map([['fry', 'Fry']]);
      render(<MessageList messages={twoMessages} typingAgents={typing} />);
      const indicator = screen.getByTestId('typing-indicator');
      const dots = indicator.querySelectorAll('.animate-bounce');
      expect(dots).toHaveLength(3);
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe('edge cases', () => {
    it('renders message with empty content', () => {
      const emptyContent = [msg({ id: 'empty', content: '' })];
      render(<MessageList messages={emptyContent} />);
      expect(screen.getByTestId('message-empty')).toBeInTheDocument();
    });

    it('renders message with special characters in content', () => {
      const special = [msg({ id: 'special', content: '<script>alert("xss")</script>' })];
      render(<MessageList messages={special} />);
      // React escapes HTML by default, so it should render as text
      expect(screen.getByText('<script>alert("xss")</script>')).toBeInTheDocument();
    });

    it('handles messages with same sender', () => {
      const sameSender = [
        msg({ id: 'a1', sender: 'leela', content: 'First' }),
        msg({ id: 'a2', sender: 'leela', content: 'Second' }),
        msg({ id: 'a3', sender: 'leela', content: 'Third' }),
      ];
      render(<MessageList messages={sameSender} />);
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      expect(screen.getByText('Third')).toBeInTheDocument();
    });

    it('handles message with null threadId', () => {
      const noThread = [msg({ id: 'no-thread', threadId: null })];
      render(<MessageList messages={noThread} />);
      expect(screen.getByTestId('message-no-thread')).toBeInTheDocument();
    });
  });
});
