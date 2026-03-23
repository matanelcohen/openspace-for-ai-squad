import type { VoiceMessage } from '@openspace/shared';
import { useEffect, useRef } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface VoiceTranscriptProps {
  messages: VoiceMessage[];
  className?: string;
}

const agentColors = {
  leela: 'text-purple-600',
  bender: 'text-orange-600',
  fry: 'text-blue-600',
  zoidberg: 'text-green-600',
} as const;

export function VoiceTranscript({ messages, className }: VoiceTranscriptProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <ScrollArea className={cn('h-full', className)} data-testid="voice-transcript">
      <div ref={scrollRef} className="space-y-4 p-4">
        {messages.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            No messages yet. Start speaking or typing to begin the conversation.
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className="flex gap-3 items-start"
              data-testid="transcript-message"
              data-message-id={message.id}
            >
              {message.role === 'agent' && message.agentId ? (
                <AgentAvatar agentId={message.agentId} size="sm" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                  <span className="text-xs font-medium">You</span>
                </div>
              )}
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'text-sm font-medium',
                      message.role === 'agent' && message.agentId
                        ? agentColors[message.agentId as keyof typeof agentColors] || 'text-foreground'
                        : 'text-foreground'
                    )}
                  >
                    {message.role === 'agent' && message.agentId
                      ? message.agentId.charAt(0).toUpperCase() + message.agentId.slice(1)
                      : 'You'}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </span>
                  {message.durationMs && (
                    <span className="text-xs text-muted-foreground">
                      ({(message.durationMs / 1000).toFixed(1)}s)
                    </span>
                  )}
                </div>
                <p className="text-sm text-foreground">{message.content}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </ScrollArea>
  );
}
