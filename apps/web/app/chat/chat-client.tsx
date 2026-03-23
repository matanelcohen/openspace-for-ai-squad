'use client';

import { useState } from 'react';

import { CHAT_TEAM_RECIPIENT } from '@openspace/shared';

import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { MessageInput } from '@/components/chat/message-input';
import { MessageList } from '@/components/chat/message-list';
import { useAgents } from '@/hooks/use-agents';
import { useChatMessages, useSendMessage } from '@/hooks/use-chat';

export function ChatClient() {
  const [selectedChannel, setSelectedChannel] = useState<string>(CHAT_TEAM_RECIPIENT);
  const { data: agents = [] } = useAgents();
  const { data: messages = [], isLoading } = useChatMessages(selectedChannel);
  const sendMessage = useSendMessage();

  const channelLabel =
    selectedChannel === CHAT_TEAM_RECIPIENT
      ? 'Team'
      : agents.find((a) => a.id === selectedChannel)?.name ?? selectedChannel;

  const handleSend = (content: string) => {
    sendMessage.mutate({
      sender: 'user',
      recipient: selectedChannel,
      content,
    });
  };

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Sidebar */}
      <div className="w-64 flex-shrink-0">
        <ChatSidebar
          agents={agents}
          selectedChannel={selectedChannel}
          onSelectChannel={setSelectedChannel}
        />
      </div>

      {/* Main chat area */}
      <div className="flex flex-1 flex-col">
        {/* Channel header */}
        <div className="border-b px-4 py-3">
          <h2 className="text-sm font-semibold">{channelLabel}</h2>
        </div>

        {/* Messages */}
        <MessageList messages={messages} isLoading={isLoading} />

        {/* Input */}
        <MessageInput onSend={handleSend} disabled={sendMessage.isPending} />
      </div>
    </div>
  );
}
