'use client';

import {
  MessagePrimitive,
  useMessage,
} from '@assistant-ui/react';

import { AgentAvatar } from '@/components/agent-avatar';

function formatTimestamp(date: Date | undefined): string {
  if (!date) return '';
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function AssistantMessage() {
  const message = useMessage();
  const agentId =
    (message.metadata?.custom as Record<string, unknown> | undefined)?.agentId as
      | string
      | undefined;

  return (
    <MessagePrimitive.Root className="mb-4 flex items-start gap-3">
      <AgentAvatar
        agentId={agentId ?? 'assistant'}
        name={agentId ?? 'Assistant'}
        size="sm"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">{agentId ?? 'Assistant'}</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(message.createdAt)}
          </span>
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}

export function UserMessage() {
  const message = useMessage();

  return (
    <MessagePrimitive.Root className="mb-4 flex items-start gap-3">
      <AgentAvatar agentId="user" name="You" size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold">You</span>
          <span className="text-xs text-muted-foreground">
            {formatTimestamp(message.createdAt)}
          </span>
        </div>
        <div className="mt-1 whitespace-pre-wrap text-sm">
          <MessagePrimitive.Content />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
}
