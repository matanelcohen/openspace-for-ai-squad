import { beforeEach, describe, expect, it } from 'vitest';

import type { Notification } from '@/lib/notifications';
import {
  createNotificationFromEvent,
  getStoredNotifications,
  storeNotifications,
} from '@/lib/notifications';

describe('getStoredNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns empty array when localStorage is empty', () => {
    expect(getStoredNotifications()).toEqual([]);
  });

  it('reads notifications from localStorage', () => {
    const notifications: Notification[] = [
      {
        id: '1',
        type: 'task_failure',
        title: 'Task Failed',
        description: 'Something went wrong',
        agentId: 'agent-1',
        timestamp: '2024-01-01T00:00:00.000Z',
        read: false,
        relatedEntityId: null,
      },
    ];
    localStorage.setItem('openspace:notifications', JSON.stringify(notifications));
    expect(getStoredNotifications()).toEqual(notifications);
  });

  it('returns empty array for invalid JSON', () => {
    localStorage.setItem('openspace:notifications', 'not-json');
    expect(getStoredNotifications()).toEqual([]);
  });

  it('returns empty array for non-array JSON', () => {
    localStorage.setItem('openspace:notifications', '{"key": "value"}');
    expect(getStoredNotifications()).toEqual([]);
  });
});

describe('storeNotifications', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('writes notifications to localStorage', () => {
    const notifications: Notification[] = [
      {
        id: '1',
        type: 'task_blocked',
        title: 'Task Blocked',
        description: 'Blocked task',
        agentId: null,
        timestamp: '2024-01-01T00:00:00.000Z',
        read: false,
        relatedEntityId: 'task-1',
      },
    ];
    storeNotifications(notifications);
    const stored = JSON.parse(localStorage.getItem('openspace:notifications')!);
    expect(stored).toEqual(notifications);
  });

  it('writes empty array to localStorage', () => {
    storeNotifications([]);
    const stored = JSON.parse(localStorage.getItem('openspace:notifications')!);
    expect(stored).toEqual([]);
  });
});

describe('createNotificationFromEvent', () => {
  it('creates task_blocked notification for task:updated with blocked status', () => {
    const result = createNotificationFromEvent('task:updated', {
      id: 'task-1',
      title: 'My Task',
      status: 'blocked',
      agentId: 'agent-1',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('task_blocked');
    expect(result!.title).toBe('Task Blocked');
    expect(result!.description).toBe('My Task');
    expect(result!.agentId).toBe('agent-1');
    expect(result!.relatedEntityId).toBe('task-1');
    expect(result!.read).toBe(false);
  });

  it('creates task_failure notification for activity:new with failed type', () => {
    const result = createNotificationFromEvent('activity:new', {
      type: 'failed',
      description: 'Build failed',
      agentId: 'agent-2',
      relatedEntityId: 'task-2',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('task_failure');
    expect(result!.title).toBe('Task Failed');
    expect(result!.description).toBe('Build failed');
    expect(result!.agentId).toBe('agent-2');
    expect(result!.relatedEntityId).toBe('task-2');
  });

  it('creates decision_added notification for activity:new with decision type', () => {
    const result = createNotificationFromEvent('activity:new', {
      type: 'decision',
      description: 'Chose React over Vue',
      agentId: 'agent-3',
      relatedEntityId: 'decision-1',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('decision_added');
    expect(result!.title).toBe('Decision Added');
    expect(result!.description).toBe('Chose React over Vue');
  });

  it('creates agent_failed notification for agent:status with failed status', () => {
    const result = createNotificationFromEvent('agent:status', {
      id: 'agent-4',
      name: 'CodeBot',
      status: 'failed',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('agent_failed');
    expect(result!.title).toBe('Agent Failed');
    expect(result!.description).toBe('Agent "CodeBot" has failed');
    expect(result!.agentId).toBe('agent-4');
  });

  it('returns null for task:updated with non-blocked status', () => {
    const result = createNotificationFromEvent('task:updated', {
      id: 'task-1',
      status: 'completed',
    });
    expect(result).toBeNull();
  });

  it('returns null for activity:new with non-critical type', () => {
    const result = createNotificationFromEvent('activity:new', {
      type: 'started',
      description: 'Task started',
    });
    expect(result).toBeNull();
  });

  it('returns null for unhandled event types', () => {
    expect(createNotificationFromEvent('chat:message', { text: 'hello' })).toBeNull();
    expect(createNotificationFromEvent('task:created', { id: '1' })).toBeNull();
  });

  it('uses fallback descriptions when payload fields are missing', () => {
    const blocked = createNotificationFromEvent('task:updated', { status: 'blocked' });
    expect(blocked!.description).toBe('A task has been blocked');

    const failed = createNotificationFromEvent('activity:new', { type: 'failed' });
    expect(failed!.description).toBe('A task has failed');

    const agentFailed = createNotificationFromEvent('agent:status', { status: 'failed' });
    expect(agentFailed!.description).toBe('An agent has failed');
  });

  it('generates unique IDs for each notification', () => {
    const n1 = createNotificationFromEvent('task:updated', { status: 'blocked' });
    const n2 = createNotificationFromEvent('task:updated', { status: 'blocked' });
    expect(n1!.id).not.toBe(n2!.id);
  });
});
