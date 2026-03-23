'use client';

import { useEffect, useRef } from 'react';

import type { ChatMessage } from '@openspace/shared';

import { AgentAvatar } from '@/components/agent-avatar';
import { Skeleton } from '@/components/ui/skeleton';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function MessageList({ messages, isLoading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof bottomRef.current?.scrollIntoView === 'function') {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4 overflow-y-auto p-4" data-testid="message-list-loading">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div
        className="flex flex-1 items-center justify-center text-muted-foreground"
        data-testid="message-list-empty"
      >
        No messages yet. Start the conversation!
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4" data-testid="message-list">
      {messages.map((msg) => (
        <div key={msg.id} className="mb-4 flex items-start gap-3" data-testid={`message-${msg.id}`}>
          <AgentAvatar agentId={msg.sender} name={msg.sender} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-semibold">{msg.sender}</span>
              <span className="text-xs text-muted-foreground">{formatTimestamp(msg.timestamp)}</span>
            </div>
            <div className="mt-1 whitespace-pre-wrap text-sm">{msg.content}</div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
