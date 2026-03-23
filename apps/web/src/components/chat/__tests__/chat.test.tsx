import type { Agent, ChatMessage } from '@openspace/shared';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { MessageInput } from '@/components/chat/message-input';
import { MessageList } from '@/components/chat/message-list';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockAgents: Agent[] = [
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
    id: 'bender',
    name: 'Bender',
    role: 'Backend',
    status: 'idle',
    currentTask: null,
    expertise: [],
    voiceProfile: {
      agentId: 'bender',
      displayName: 'Bender',
      voiceId: 'bender-v1',
      personality: '',
    },
  },
];

const mockMessages: ChatMessage[] = [
  {
    id: 'msg-1',
    sender: 'leela',
    recipient: 'team',
    content: 'Hello team!',
    timestamp: '2024-01-15T10:00:00Z',
    threadId: null,
  },
  {
    id: 'msg-2',
    sender: 'bender',
    recipient: 'team',
    content: 'Hey there!',
    timestamp: '2024-01-15T10:01:00Z',
    threadId: null,
  },
];

// ---------------------------------------------------------------------------
// ChatSidebar
// ---------------------------------------------------------------------------

describe('ChatSidebar', () => {
  it('renders team channel', () => {
    render(
      <ChatSidebar agents={mockAgents} selectedChannel="team" onSelectChannel={vi.fn()} />,
    );
    expect(screen.getByText('Team')).toBeInTheDocument();
    expect(screen.getByTestId('channel-team')).toBeInTheDocument();
  });

  it('renders agent list with names and roles', () => {
    render(
      <ChatSidebar agents={mockAgents} selectedChannel="team" onSelectChannel={vi.fn()} />,
    );
    expect(screen.getByText('Leela')).toBeInTheDocument();
    expect(screen.getByText('Lead')).toBeInTheDocument();
    expect(screen.getByText('Bender')).toBeInTheDocument();
    expect(screen.getByText('Backend')).toBeInTheDocument();
  });

  it('calls onSelectChannel when an agent is clicked', () => {
    const onSelect = vi.fn();
    render(
      <ChatSidebar agents={mockAgents} selectedChannel="team" onSelectChannel={onSelect} />,
    );
    fireEvent.click(screen.getByTestId('channel-leela'));
    expect(onSelect).toHaveBeenCalledWith('leela');
  });

  it('calls onSelectChannel when team channel is clicked', () => {
    const onSelect = vi.fn();
    render(
      <ChatSidebar agents={mockAgents} selectedChannel="leela" onSelectChannel={onSelect} />,
    );
    fireEvent.click(screen.getByTestId('channel-team'));
    expect(onSelect).toHaveBeenCalledWith('team');
  });

  it('highlights selected channel', () => {
    render(
      <ChatSidebar agents={mockAgents} selectedChannel="leela" onSelectChannel={vi.fn()} />,
    );
    const leelaChannel = screen.getByTestId('channel-leela');
    expect(leelaChannel.className).toContain('bg-accent');
  });
});

// ---------------------------------------------------------------------------
// MessageList
// ---------------------------------------------------------------------------

describe('MessageList', () => {
  it('renders messages with sender info', () => {
    render(<MessageList messages={mockMessages} />);
    expect(screen.getByText('leela')).toBeInTheDocument();
    expect(screen.getByText('Hello team!')).toBeInTheDocument();
    expect(screen.getByText('bender')).toBeInTheDocument();
    expect(screen.getByText('Hey there!')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<MessageList messages={[]} />);
    expect(screen.getByTestId('message-list-empty')).toBeInTheDocument();
    expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
  });

  it('shows loading skeleton', () => {
    render(<MessageList messages={[]} isLoading />);
    expect(screen.getByTestId('message-list-loading')).toBeInTheDocument();
  });

  it('renders each message with a testid', () => {
    render(<MessageList messages={mockMessages} />);
    expect(screen.getByTestId('message-msg-1')).toBeInTheDocument();
    expect(screen.getByTestId('message-msg-2')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
// MessageInput
// ---------------------------------------------------------------------------

describe('MessageInput', () => {
  it('renders textarea and send button', () => {
    render(<MessageInput onSend={vi.fn()} />);
    expect(screen.getByTestId('message-textarea')).toBeInTheDocument();
    expect(screen.getByTestId('send-button')).toBeInTheDocument();
  });

  it('calls onSend with trimmed content on button click', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: '  Hello world  ' } });
    fireEvent.click(screen.getByTestId('send-button'));
    expect(onSend).toHaveBeenCalledWith('Hello world');
  });

  it('sends on Enter key press', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalledWith('Hello');
  });

  it('does not send on Shift+Enter', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    const textarea = screen.getByTestId('message-textarea');
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();
  });

  it('disables textarea and button when disabled prop is true', () => {
    render(<MessageInput onSend={vi.fn()} disabled />);
    expect(screen.getByTestId('message-textarea')).toBeDisabled();
    expect(screen.getByTestId('send-button')).toBeDisabled();
  });

  it('does not send empty messages', () => {
    const onSend = vi.fn();
    render(<MessageInput onSend={onSend} />);
    fireEvent.click(screen.getByTestId('send-button'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('clears input after sending', () => {
    render(<MessageInput onSend={vi.fn()} />);
    const textarea = screen.getByTestId('message-textarea') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Hello' } });
    fireEvent.click(screen.getByTestId('send-button'));
    expect(textarea.value).toBe('');
  });

  it('shows typing indicator when isTyping is true', () => {
    render(<MessageInput onSend={vi.fn()} isTyping />);
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument();
    expect(screen.getByText('typing...')).toBeInTheDocument();
  });

  it('hides typing indicator when isTyping is false', () => {
    render(<MessageInput onSend={vi.fn()} isTyping={false} />);
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument();
  });
});
