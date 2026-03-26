import { fireEvent,render, screen } from '@testing-library/react';
import { Activity, ClipboardList, Lightbulb,MessageSquare, Mic } from 'lucide-react';
import { describe, expect, it, vi } from 'vitest';

import { EmptyState } from '@/components/ui/empty-state';

describe('EmptyState', () => {
  it('renders with icon, title, and description', () => {
    render(
      <EmptyState
        icon={ClipboardList}
        title="No tasks yet"
        description="Create your first task to get started"
      />,
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    expect(screen.getByText('Create your first task to get started')).toBeInTheDocument();
  });

  it('renders action button when actionLabel and onAction provided', () => {
    const onAction = vi.fn();

    render(
      <EmptyState
        icon={ClipboardList}
        title="No tasks yet"
        description="Create your first task"
        actionLabel="Create Task"
        onAction={onAction}
      />,
    );

    const button = screen.getByTestId('empty-state-action');
    expect(button).toHaveTextContent('Create Task');

    fireEvent.click(button);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does NOT render action button when only actionLabel is provided (no onAction)', () => {
    render(
      <EmptyState
        icon={ClipboardList}
        title="No tasks yet"
        description="Create your first task"
        actionLabel="Create Task"
      />,
    );

    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('does NOT render action button when only onAction is provided (no actionLabel)', () => {
    render(
      <EmptyState
        icon={ClipboardList}
        title="No tasks yet"
        description="Create your first task"
        onAction={() => {}}
      />,
    );

    expect(screen.queryByTestId('empty-state-action')).not.toBeInTheDocument();
  });

  it('uses custom data-testid', () => {
    render(
      <EmptyState
        icon={MessageSquare}
        title="No messages"
        description="Start chatting"
        data-testid="chat-empty"
      />,
    );

    expect(screen.getByTestId('chat-empty')).toBeInTheDocument();
  });

  it('renders different icons correctly for each feature area', () => {
    const { rerender } = render(
      <EmptyState
        icon={ClipboardList}
        title="No tasks yet"
        description="Create your first task"
        data-testid="tasks-empty"
      />,
    );
    expect(screen.getByTestId('tasks-empty')).toBeInTheDocument();

    rerender(
      <EmptyState
        icon={Lightbulb}
        title="No decisions recorded yet"
        description="Decisions will appear here as your squad discusses"
        data-testid="decisions-empty"
      />,
    );
    expect(screen.getByTestId('decisions-empty')).toBeInTheDocument();
    expect(screen.getByText('No decisions recorded yet')).toBeInTheDocument();

    rerender(
      <EmptyState
        icon={Activity}
        title="No activity to show"
        description="Activity will appear as your squad works"
        data-testid="activity-empty"
      />,
    );
    expect(screen.getByTestId('activity-empty')).toBeInTheDocument();
    expect(screen.getByText('No activity to show')).toBeInTheDocument();

    rerender(
      <EmptyState
        icon={Mic}
        title="Start a voice session"
        description="Start a voice session to talk with your squad"
        data-testid="voice-empty"
      />,
    );
    expect(screen.getByTestId('voice-empty')).toBeInTheDocument();
    expect(screen.getByText('Start a voice session to talk with your squad')).toBeInTheDocument();
  });
});
