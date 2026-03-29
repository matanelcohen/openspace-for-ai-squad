'use client';

import type { Agent, ChatChannel } from '@openspace/shared';
import { Hash, MessageSquare } from 'lucide-react';
import { useCallback } from 'react';

import { ChannelHeader } from '@/components/chat/channel-header';
import { MessageInput } from '@/components/chat/message-input';
import { MessageList } from '@/components/chat/message-list';
import { TaskSuggestion } from '@/components/chat/task-suggestion';
import { EmptyState } from '@/components/ui/empty-state';
import { useChannelMessages, useSendChannelMessage } from '@/hooks/use-channels';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

export interface ChannelMessageViewProps {
  /** The channel to display messages for. */
  channel: ChatChannel;
  /** Available agents — used to resolve sender names and member avatars. */
  agents?: Agent[];
  /** The current user's ID (used as the message sender). */
  currentUserId?: string;
  /** Called when the back button is pressed (mobile). */
  onBack?: () => void;
  /** Called to open the channel edit dialog. */
  onEditChannel?: () => void;
  /** Called to open the channel delete dialog. */
  onDeleteChannel?: () => void;
  /** Extra class names on the root element. */
  className?: string;
  /** Slot for extra header actions (e.g., voice room toggle). */
  headerActions?: React.ReactNode;
}

// ── Component ───────────────────────────────────────────────────────

export function ChannelMessageView({
  channel,
  agents = [],
  currentUserId = 'user',
  onBack,
  onEditChannel,
  onDeleteChannel,
  className,
  headerActions,
}: ChannelMessageViewProps) {
  const {
    data: messages = [],
    isLoading: messagesLoading,
    isError: messagesError,
  } = useChannelMessages(channel.id);

  const sendMessage = useSendChannelMessage(channel.id);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage.mutate({ sender: currentUserId, content });
    },
    [sendMessage, currentUserId],
  );

  return (
    <div
      className={cn('flex h-full flex-col', className)}
      data-testid="channel-message-view"
    >
      {/* Channel header */}
      <ChannelHeader
        channel={channel}
        agents={agents}
        onBack={onBack}
        onEdit={onEditChannel}
        onDelete={onDeleteChannel}
        actions={headerActions}
      />

      {/* Error banner */}
      {messagesError && (
        <div
          className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          data-testid="channel-message-error"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span>Failed to load messages. Check that the API server is running.</span>
        </div>
      )}

      {/* Send error banner */}
      {sendMessage.isError && (
        <div
          className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400"
          data-testid="channel-send-error"
        >
          <svg
            className="h-4 w-4 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 8v4m0 4h.01" />
          </svg>
          <span>Failed to send message. Please try again.</span>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 min-h-0">
        {!messagesLoading && !messagesError && messages.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <EmptyState
              icon={MessageSquare}
              title="No messages yet"
              description={`Start the conversation in #${channel.name}`}
              data-testid="channel-empty-state"
            />
          </div>
        ) : (
          <MessageList
            messages={messages}
            isLoading={messagesLoading}
          />
        )}
      </div>

      {/* Task suggestion card */}
      <TaskSuggestion />

      {/* Message input */}
      <MessageInput
        onSend={handleSend}
        disabled={sendMessage.isPending}
      />
    </div>
  );
}
