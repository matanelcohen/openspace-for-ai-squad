const STORAGE_KEY = 'openspace:notifications';

export interface Notification {
  id: string;
  type: 'task_failure' | 'task_blocked' | 'agent_failed' | 'decision_added';
  title: string;
  description: string;
  agentId: string | null;
  timestamp: string;
  read: boolean;
  relatedEntityId: string | null;
}

export function getStoredNotifications(): Notification[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

export function storeNotifications(notifications: Notification[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications));
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function createNotificationFromEvent(
  type: string,
  payload: Record<string, unknown>,
): Notification | null {
  const timestamp = new Date().toISOString();

  if (type === 'task:updated' && payload.status === 'blocked') {
    return {
      id: generateId(),
      type: 'task_blocked',
      title: 'Task Blocked',
      description: (payload.title as string) || 'A task has been blocked',
      agentId: (payload.agentId as string) ?? null,
      timestamp,
      read: false,
      relatedEntityId: (payload.id as string) ?? null,
    };
  }

  if (type === 'activity:new' && payload.type === 'failed') {
    return {
      id: generateId(),
      type: 'task_failure',
      title: 'Task Failed',
      description: (payload.description as string) || 'A task has failed',
      agentId: (payload.agentId as string) ?? null,
      timestamp,
      read: false,
      relatedEntityId: (payload.relatedEntityId as string) ?? null,
    };
  }

  if (type === 'activity:new' && payload.type === 'decision') {
    return {
      id: generateId(),
      type: 'decision_added',
      title: 'Decision Added',
      description: (payload.description as string) || 'A new decision has been made',
      agentId: (payload.agentId as string) ?? null,
      timestamp,
      read: false,
      relatedEntityId: (payload.relatedEntityId as string) ?? null,
    };
  }

  if (type === 'agent:status' && payload.status === 'failed') {
    return {
      id: generateId(),
      type: 'agent_failed',
      title: 'Agent Failed',
      description: (payload.name as string)
        ? `Agent "${payload.name}" has failed`
        : 'An agent has failed',
      agentId: (payload.agentId as string) ?? (payload.id as string) ?? null,
      timestamp,
      read: false,
      relatedEntityId: null,
    };
  }

  return null;
}
