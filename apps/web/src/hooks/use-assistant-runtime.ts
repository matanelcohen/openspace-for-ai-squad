'use client';

import {
  type AppendMessage,
  type ExternalStoreAdapter,
  type ThreadMessageLike,
  useExternalStoreRuntime,
  WebSpeechDictationAdapter,
} from '@assistant-ui/react';
import type { ChatMessage } from '@openspace/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useChatMessages, useTypingIndicator } from '@/hooks/use-chat';

const getApiBaseUrl = () =>
  process.env.NEXT_PUBLIC_API_URL ??
  (typeof window !== 'undefined'
    ? `${window.location.protocol}//${window.location.hostname}:3001`
    : 'http://localhost:3001');

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
  const queryClient = useQueryClient();

  const [streamState, setStreamState] = useState<{
    isRunning: boolean;
    messages: ThreadMessageLike[];
  }>({ isRunning: false, messages: [] });

  const abortRef = useRef<AbortController | null>(null);
  const channelRef = useRef(channel);
  channelRef.current = channel;

  // Abort any in-flight stream when channel changes or component unmounts
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, [channel]);

  const threadMessages = useMemo(() => messages.map(toThreadMessage), [messages]);

  // Combine persisted messages with in-flight streaming messages
  const allMessages = useMemo(
    () => [...threadMessages, ...streamState.messages],
    [threadMessages, streamState.messages],
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

      const ch = channelRef.current;

      // Optimistically add the user message to the query cache
      const optimistic: ChatMessage = {
        id: `optimistic-${Date.now()}`,
        sender: 'user',
        recipient: ch,
        content: text,
        timestamp: new Date().toISOString(),
        threadId: null,
      };
      queryClient.setQueryData<ChatMessage[]>(['chat', ch], (old = []) => [...old, optimistic]);

      const controller = new AbortController();
      abortRef.current = controller;
      setStreamState({ isRunning: true, messages: [] });

      try {
        const apiBase = getApiBaseUrl();
        const url = `${apiBase}/api/chat/stream?recipient=${encodeURIComponent(ch)}&content=${encodeURIComponent(text)}`;
        const response = await fetch(url, { signal: controller.signal });

        if (!response.ok || !response.body) {
          throw new Error(`Stream failed: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        const agentContents = new Map<string, string>();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const dataLine = part.split('\n').find((l) => l.startsWith('data: '));
            if (!dataLine) continue;

            try {
              const data = JSON.parse(dataLine.slice(6)) as {
                agentId: string;
                chunk: string;
                done: boolean;
                fullContent?: string;
              };

              if (!data.done) {
                const current = agentContents.get(data.agentId) ?? '';
                agentContents.set(data.agentId, current + data.chunk);
              } else {
                agentContents.delete(data.agentId);
              }

              const streamMsgs: ThreadMessageLike[] = Array.from(agentContents.entries()).map(
                ([agentId, content]) => ({
                  id: `streaming-${agentId}`,
                  role: 'assistant' as const,
                  content: [{ type: 'text' as const, text: content }],
                  createdAt: new Date(),
                  metadata: { custom: { agentId } },
                }),
              );

              setStreamState({ isRunning: true, messages: streamMsgs });
            } catch {
              // Skip malformed SSE data
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[Chat] Stream error:', err);
        }
      } finally {
        setStreamState({ isRunning: false, messages: [] });
        abortRef.current = null;
        // Refetch to pick up final persisted messages
        queryClient.invalidateQueries({ queryKey: ['chat', ch] });
      }
    },
    [queryClient],
  );

  const handleCancel = useCallback(async () => {
    abortRef.current?.abort();
  }, []);

  const adapter: ExternalStoreAdapter<ThreadMessageLike> = useMemo(
    () => ({
      isRunning: streamState.isRunning || typingAgents.size > 0,
      messages: allMessages,
      convertMessage: (msg: ThreadMessageLike) => msg,
      suggestions: SUGGESTIONS,
      adapters: dictationAdapter ? { dictation: dictationAdapter } : undefined,
      onNew: handleNew,
      onCancel: handleCancel,
    }),
    [
      streamState.isRunning,
      allMessages,
      typingAgents.size,
      handleNew,
      handleCancel,
      dictationAdapter,
    ],
  );

  return useExternalStoreRuntime(adapter);
}
