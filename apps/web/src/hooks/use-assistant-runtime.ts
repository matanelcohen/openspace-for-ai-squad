'use client';

import {
  type AppendMessage,
  type ExternalStoreAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
  WebSpeechDictationAdapter,
} from '@assistant-ui/react';
import type { ChatMessage } from '@openspace/shared';
import { useCallback, useMemo, useRef } from 'react';

import { useChatMessages, useSendMessage, useTypingIndicator } from '@/hooks/use-chat';

function toThreadMessage(msg: ChatMessage): ThreadMessageLike {
  const isUser = msg.sender === 'user';
  return {
    id: msg.id,
    role: isUser ? 'user' : 'assistant',
    content: [{ type: 'text' as const, text: msg.content }],
    createdAt: new Date(msg.timestamp),
    ...(!isUser && {
      metadata: { custom: { agentId: msg.sender } },
    }),
  };
}

const SUGGESTIONS: readonly { prompt: string }[] = [
  { prompt: "What's the team working on?" },
  { prompt: 'Hey Fry, build me a landing page' },
  { prompt: 'Team standup!' },
  { prompt: 'Create a new task' },
];

export function useAssistantRuntime(channel: string) {
  const { data: messages = [] } = useChatMessages(channel);
  const typingAgents = useTypingIndicator();
  const { mutateAsync: sendMessage } = useSendMessage();

  const channelRef = useRef(channel);
  channelRef.current = channel;

  const threadMessages = useMemo(
    () =>
      [...messages]
        .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
        .map(toThreadMessage),
    [messages],
  );

  const dictationAdapter = useMemo(
    () =>
      typeof window !== 'undefined' && WebSpeechDictationAdapter.isSupported()
        ? new WebSpeechDictationAdapter()
        : undefined,
    [],
  );

  const handleNew = useCallback(
    async (message: AppendMessage) => {
      const text = message.content
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('\n');

      await sendMessage({
        sender: 'user',
        recipient: channelRef.current,
        content: text,
      });
    },
    [sendMessage],
  );

  // Reload = resend the last user message to get a fresh response
  const handleReload = useCallback(
    async (parentId: string | null) => {
      if (!parentId) return;
      const parentMsg = messages.find((m) => m.id === parentId);
      if (!parentMsg) return;

      // Find the user message that triggered this response
      const idx = messages.indexOf(parentMsg);
      let userMsg: ChatMessage | undefined;
      for (let i = idx; i >= 0; i--) {
        if (messages[i]?.sender === 'user') {
          userMsg = messages[i];
          break;
        }
      }

      if (userMsg) {
        await sendMessage({
          sender: 'user',
          recipient: channelRef.current,
          content: userMsg.content,
        });
      }
    },
    [messages, sendMessage],
  );

  // Build typing indicator messages — only for agents relevant to this channel
  const typingMessages: ThreadMessageLike[] = useMemo(() => {
    if (typingAgents.size === 0) return [];
    return Array.from(typingAgents.entries())
      .filter(([agentId]) => {
        // Team channel: show all typing agents
        if (channel === 'team') return true;
        // DM channel: only show the agent you're chatting with
        return agentId === channel;
      })
      .map(([agentId, agentName]) => ({
        id: `typing-${agentId}`,
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: `${agentName} is thinking...` }],
        createdAt: new Date(),
        metadata: { custom: { agentId } },
      }));
  }, [typingAgents, channel]);

  const allMessages = useMemo(
    () => [...threadMessages, ...typingMessages],
    [threadMessages, typingMessages],
  );

  const adapter: ExternalStoreAdapter<ThreadMessageLike> = useMemo(
    () => ({
      isRunning: typingMessages.length > 0,
      messages: allMessages,
      convertMessage: (msg: ThreadMessageLike) => msg,
      suggestions: SUGGESTIONS,
      adapters: dictationAdapter ? { dictation: dictationAdapter } : undefined,
      onNew: handleNew,
      onReload: handleReload,
    }),
    [typingAgents.size, allMessages, handleNew, handleReload, dictationAdapter],
  );

  return useExternalStoreRuntime(adapter);
}
