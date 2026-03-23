import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { NotificationBell } from '@/components/notifications/notification-bell';
import type { Notification } from '@/lib/notifications';

// Polyfills required for Radix UI in jsdom
beforeAll(() => {
  window.PointerEvent = class PointerEvent extends MouseEvent {
    readonly pointerId: number;
    readonly pointerType: string;
    constructor(type: string, props: PointerEventInit = {}) {
      super(type, props);
      this.pointerId = props.pointerId ?? 0;
      this.pointerType = props.pointerType ?? '';
    }
  } as unknown as typeof PointerEvent;

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

function makeNotification(overrides: Partial<Notification> = {}): Notification {
  return {
    id: 'n-1',
    type: 'task_failure',
    title: 'Task Failed',
    description: 'Build process failed',
    agentId: 'agent-1',
    timestamp: new Date().toISOString(),
    read: false,
    relatedEntityId: 'task-1',
    ...overrides,
  };
}

function setStoredNotifications(notifications: Notification[]) {
  localStorage.setItem('openspace:notifications', JSON.stringify(notifications));
}

function clickBell() {
  const button = screen.getByRole('button', { name: 'Notifications' });
  fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
}

describe('NotificationBell', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders bell button', () => {
    render(<NotificationBell />);
    expect(screen.getByRole('button', { name: 'Notifications' })).toBeInTheDocument();
  });

  it('shows unread count badge when there are unread notifications', () => {
    setStoredNotifications([
      makeNotification({ id: 'n-1', read: false }),
      makeNotification({ id: 'n-2', read: false }),
      makeNotification({ id: 'n-3', read: true }),
    ]);

    render(<NotificationBell />);
    const badge = screen.getByTestId('unread-count');
    expect(badge).toHaveTextContent('2');
  });

  it('does not show unread count badge when all notifications are read', () => {
    setStoredNotifications([makeNotification({ id: 'n-1', read: true })]);

    render(<NotificationBell />);
    expect(screen.queryByTestId('unread-count')).not.toBeInTheDocument();
  });

  it('opens dropdown when bell is clicked', () => {
    setStoredNotifications([makeNotification()]);

    render(<NotificationBell />);
    clickBell();

    expect(screen.getByText('Notifications')).toBeInTheDocument();
  });

  it('displays notifications with title and description', () => {
    setStoredNotifications([
      makeNotification({
        id: 'n-1',
        title: 'Task Failed',
        description: 'Build process failed',
      }),
    ]);

    render(<NotificationBell />);
    clickBell();

    expect(screen.getByText('Task Failed')).toBeInTheDocument();
    expect(screen.getByText('Build process failed')).toBeInTheDocument();
  });

  it('displays relative timestamp', () => {
    setStoredNotifications([
      makeNotification({
        id: 'n-1',
        timestamp: new Date().toISOString(),
      }),
    ]);

    render(<NotificationBell />);
    clickBell();

    expect(screen.getByText('just now')).toBeInTheDocument();
  });

  it('shows unread dot for unread notifications', () => {
    setStoredNotifications([makeNotification({ id: 'n-1', read: false })]);

    render(<NotificationBell />);
    clickBell();

    expect(screen.getByTestId('unread-dot-n-1')).toBeInTheDocument();
  });

  it('marks notification as read when clicked', () => {
    setStoredNotifications([makeNotification({ id: 'n-1', read: false })]);

    render(<NotificationBell />);
    clickBell();
    fireEvent.click(screen.getByTestId('notification-n-1'));

    const stored = JSON.parse(localStorage.getItem('openspace:notifications')!);
    expect(stored[0].read).toBe(true);
  });

  it('marks all as read when button is clicked', () => {
    setStoredNotifications([
      makeNotification({ id: 'n-1', read: false }),
      makeNotification({ id: 'n-2', read: false }),
    ]);

    render(<NotificationBell />);
    clickBell();
    fireEvent.click(screen.getByTestId('mark-all-read'));

    const stored = JSON.parse(localStorage.getItem('openspace:notifications')!) as Notification[];
    expect(stored.every((n) => n.read)).toBe(true);
  });

  it('clears all notifications when clear all is clicked', () => {
    setStoredNotifications([makeNotification({ id: 'n-1' })]);

    render(<NotificationBell />);
    clickBell();
    fireEvent.click(screen.getByTestId('clear-all'));

    const stored = JSON.parse(localStorage.getItem('openspace:notifications')!);
    expect(stored).toEqual([]);
  });

  it('shows empty state when there are no notifications', () => {
    render(<NotificationBell />);
    clickBell();

    expect(screen.getByText('No notifications')).toBeInTheDocument();
  });

  it('persists notifications to localStorage', () => {
    setStoredNotifications([makeNotification({ id: 'n-1' })]);

    render(<NotificationBell />);

    const stored = JSON.parse(localStorage.getItem('openspace:notifications')!);
    expect(stored).toHaveLength(1);
    expect(stored[0].id).toBe('n-1');
  });

  it('renders different icons for different notification types', () => {
    setStoredNotifications([
      makeNotification({ id: 'n-1', type: 'task_failure', title: 'Task Failed' }),
      makeNotification({ id: 'n-2', type: 'task_blocked', title: 'Task Blocked' }),
      makeNotification({ id: 'n-3', type: 'decision_added', title: 'Decision Added' }),
      makeNotification({ id: 'n-4', type: 'agent_failed', title: 'Agent Failed' }),
    ]);

    render(<NotificationBell />);
    clickBell();

    expect(screen.getByText('Task Failed')).toBeInTheDocument();
    expect(screen.getByText('Task Blocked')).toBeInTheDocument();
    expect(screen.getByText('Decision Added')).toBeInTheDocument();
    expect(screen.getByText('Agent Failed')).toBeInTheDocument();
  });
});
