import type { VoiceMessage } from '@openspace/shared';
import { render, screen } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { VoiceTranscript } from '../voice-transcript';

vi.mock('@/components/agent-avatar', () => ({
  AgentAvatar: ({ agentId }: { agentId: string }) => (
    <div data-testid={`agent-avatar-${agentId}`}>Avatar</div>
  ),
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    className,
    'data-testid': testId,
  }: ComponentProps<'div'> & { children: ReactNode }) => (
    <div className={className} data-testid={testId}>
      {children}
    </div>
  ),
}));

describe('VoiceTranscript', () => {
  const mockMessages: VoiceMessage[] = [
    {
      id: 'msg-1',
      sessionId: 'session-1',
      role: 'user',
      agentId: null,
      content: 'Hello, team!',
      timestamp: '2024-01-01T10:00:00Z',
      durationMs: null,
    },
    {
      id: 'msg-2',
      sessionId: 'session-1',
      role: 'agent',
      agentId: 'leela',
      content: 'Hello! How can I help?',
      timestamp: '2024-01-01T10:00:05Z',
      durationMs: 2500,
    },
  ];

  it('renders empty state when no messages', () => {
    render(<VoiceTranscript messages={[]} />);

    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('renders messages', () => {
    render(<VoiceTranscript messages={mockMessages} />);

    expect(screen.getByText('Hello, team!')).toBeInTheDocument();
    expect(screen.getByText('Hello! How can I help?')).toBeInTheDocument();
  });

  it('displays user messages correctly', () => {
    render(<VoiceTranscript messages={[mockMessages[0]]} />);

    // Use getAllByText since "You" appears multiple times (avatar and name)
    const youElements = screen.getAllByText('You');
    expect(youElements.length).toBeGreaterThan(0);
    expect(screen.queryByTestId(/agent-avatar/)).not.toBeInTheDocument();
  });

  it('displays agent messages with avatar', () => {
    render(<VoiceTranscript messages={[mockMessages[1]]} />);

    expect(screen.getByText('Leela')).toBeInTheDocument();
    expect(screen.getByTestId('agent-avatar-leela')).toBeInTheDocument();
  });

  it('displays duration when available', () => {
    render(<VoiceTranscript messages={[mockMessages[1]]} />);

    expect(screen.getByText('(2.5s)')).toBeInTheDocument();
  });

  it('sets correct data attributes on messages', () => {
    render(<VoiceTranscript messages={mockMessages} />);

    const messages = screen.getAllByTestId('transcript-message');
    expect(messages[0]).toHaveAttribute('data-message-id', 'msg-1');
    expect(messages[1]).toHaveAttribute('data-message-id', 'msg-2');
  });
});
