'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';

// ── Types ───────────────────────────────────────────────────────────

export interface ActivityEvent {
  id: string;
  timestamp: string;
  agentId: string;
  agentName: string;
  type: 'task_start' | 'task_complete' | 'tool_use' | 'chat_message' | 'thinking';
  message: string;
}

// ── Emoji helpers ───────────────────────────────────────────────────

const TYPE_EMOJI: Record<ActivityEvent['type'], string> = {
  task_start: '🎯',
  task_complete: '✅',
  tool_use: '🔧',
  chat_message: '💬',
  thinking: '🧠',
};

export function getActivityEmoji(type: ActivityEvent['type']): string {
  return TYPE_EMOJI[type] ?? '📌';
}

// ── Event extractors ────────────────────────────────────────────────

function extractFromTaskEvent(envelope: WsEnvelope, eventType: 'task_start' | 'task_complete'): ActivityEvent | null {
  const p = envelope.payload;
  const agentId = (p.assignee as string) || 'unknown';
  const agentName = (p.assigneeName as string) || agentId;
  const title = (p.title as string) || 'Untitled task';
  const status = p.status as string | undefined;

  // For task:updated, only emit for relevant status transitions
  if (envelope.type === 'task:updated') {
    if (eventType === 'task_start' && status !== 'in-progress') return null;
    if (eventType === 'task_complete' && status !== 'done') return null;
  }

  const verb = eventType === 'task_start' ? 'started' : 'completed';
  return {
    id: `${envelope.type}-${(p.id as string) || Date.now()}-${Date.now()}`,
    timestamp: envelope.timestamp,
    agentId,
    agentName,
    type: eventType,
    message: `${agentName} ${verb}: ${title}`,
  };
}

function extractFromChatMessage(envelope: WsEnvelope): ActivityEvent | null {
  const p = envelope.payload;
  const sender = (p.sender as string) || 'unknown';
  const content = (p.content as string) || '';
  const recipient = (p.recipient as string) || '';

  // Determine channel display name
  const channelDisplay = recipient.startsWith('channel:')
    ? `#${recipient.replace('channel:', '')}`
    : `to ${recipient}`;

  const preview = content.length > 60 ? content.slice(0, 57) + '...' : content;
  return {
    id: `chat-${(p.id as string) || Date.now()}-${Date.now()}`,
    timestamp: envelope.timestamp,
    agentId: sender,
    agentName: sender,
    type: 'chat_message',
    message: `${sender} in ${channelDisplay}: ${preview}`,
  };
}

function extractFromAgentStatus(envelope: WsEnvelope): ActivityEvent | null {
  const p = envelope.payload;
  const agentId = (p.agentId as string) || (p.id as string) || 'unknown';
  const agentName = (p.name as string) || agentId;
  const status = (p.status as string) || '';
  const currentTask = (p.currentTask as string) || '';
  const tool = (p.tool as string) || '';

  if (status === 'active' && tool) {
    return {
      id: `agent-tool-${agentId}-${Date.now()}`,
      timestamp: envelope.timestamp,
      agentId,
      agentName,
      type: 'tool_use',
      message: `${agentName} using ${tool}${currentTask ? `: ${currentTask}` : ''}`,
    };
  }

  if (status === 'active') {
    return {
      id: `agent-active-${agentId}-${Date.now()}`,
      timestamp: envelope.timestamp,
      agentId,
      agentName,
      type: 'thinking',
      message: `${agentName} is working${currentTask ? ` on: ${currentTask}` : ''}`,
    };
  }

  return null;
}

// ── Hook ────────────────────────────────────────────────────────────

export function useActivityFeed(maxEvents = 50): ActivityEvent[] {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const seenIds = useRef(new Set<string>());

  const addEvent = useCallback(
    (event: ActivityEvent | null) => {
      if (!event) return;
      if (seenIds.current.has(event.id)) return;
      seenIds.current.add(event.id);

      setEvents((prev) => {
        const next = [...prev, event];
        if (next.length > maxEvents) {
          // Remove oldest entries and their IDs from the dedup set
          const removed = next.splice(0, next.length - maxEvents);
          for (const r of removed) {
            seenIds.current.delete(r.id);
          }
        }
        return next;
      });
    },
    [maxEvents],
  );

  // Subscribe to task events
  useWsEvent('task:updated', useCallback((env: WsEnvelope) => {
    const status = env.payload.status as string | undefined;
    if (status === 'in-progress') addEvent(extractFromTaskEvent(env, 'task_start'));
    if (status === 'done') addEvent(extractFromTaskEvent(env, 'task_complete'));
  }, [addEvent]));

  useWsEvent('task:created', useCallback((env: WsEnvelope) => {
    addEvent(extractFromTaskEvent(env, 'task_start'));
  }, [addEvent]));

  // Subscribe to chat messages
  useWsEvent('chat:message', useCallback((env: WsEnvelope) => {
    addEvent(extractFromChatMessage(env));
  }, [addEvent]));

  // Subscribe to agent status changes
  useWsEvent('agent:status', useCallback((env: WsEnvelope) => {
    addEvent(extractFromAgentStatus(env));
  }, [addEvent]));

  useWsEvent('agent:working', useCallback((env: WsEnvelope) => {
    const p = env.payload;
    const agentId = (p.agentId as string) || (p.id as string) || 'unknown';
    const agentName = (p.name as string) || agentId;
    const tool = (p.tool as string) || '';
    const task = (p.currentTask as string) || (p.task as string) || '';

    addEvent({
      id: `agent-working-${agentId}-${Date.now()}`,
      timestamp: env.timestamp,
      agentId,
      agentName,
      type: tool ? 'tool_use' : 'thinking',
      message: tool
        ? `${agentName} using ${tool}${task ? `: ${task}` : ''}`
        : `${agentName} is working${task ? ` on: ${task}` : ''}`,
    });
  }, [addEvent]));

  // Clean up dedup set on unmount
  useEffect(() => {
    return () => {
      seenIds.current.clear();
    };
  }, []);

  return events;
}
