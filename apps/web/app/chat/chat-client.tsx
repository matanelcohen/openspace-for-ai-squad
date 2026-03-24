'use client';

import { CHAT_TEAM_RECIPIENT } from '@openspace/shared';
import { AlertCircle, ArrowLeft, Mic } from 'lucide-react';
import { useState } from 'react';

import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { MessageInput } from '@/components/chat/message-input';
import { MessageList } from '@/components/chat/message-list';
import { Button } from '@/components/ui/button';
import { VoiceRoom } from '@/components/voice/voice-room';
import { useAgents } from '@/hooks/use-agents';
import { useChatMessages, useSendMessage, useTypingIndicator } from '@/hooks/use-chat';
import { useVoiceSession } from '@/hooks/use-voice-session';

export function ChatClient() {
  const [selectedChannel, setSelectedChannel] = useState<string>(CHAT_TEAM_RECIPIENT);
  const [showMessages, setShowMessages] = useState(false);
  const [showVoiceRoom, setShowVoiceRoom] = useState(false);
  const { data: agents = [] } = useAgents();
  const { data: messages = [], isLoading, error: fetchError } = useChatMessages(selectedChannel);
  const sendMessage = useSendMessage();
  const typingAgents = useTypingIndicator();
  const voice = useVoiceSession();

  const channelLabel =
    selectedChannel === CHAT_TEAM_RECIPIENT
      ? 'Team'
      : (agents.find((a) => a.id === selectedChannel)?.name ?? selectedChannel);

  const handleSend = (content: string) => {
    sendMessage.mutate({
      sender: 'user',
      recipient: selectedChannel,
      content,
    });
  };

  const handleSelectChannel = (channel: string) => {
    setSelectedChannel(channel);
    setShowMessages(true);
  };

  const toggleVoiceRoom = () => {
    if (!showVoiceRoom) {
      // Start session + recording from the user click (gesture required for mic)
      if (!voice.session) {
        const agentIds = agents.map((a) => a.id).filter((id) => !['scribe', 'ralph'].includes(id));
        voice.startSession(agentIds.length > 0 ? agentIds : ['leela', 'fry', 'bender', 'zoidberg']);
      }
      voice.startRecording();
    } else {
      voice.stopRecording();
    }
    setShowVoiceRoom((prev) => !prev);
  };

  const closeVoiceRoom = () => {
    setShowVoiceRoom(false);
  };

  return (
    <div className="flex flex-1 overflow-hidden" data-testid="chat-client">
      {/* Sidebar — hidden on mobile when messages panel is shown */}
      <div className={`w-full flex-shrink-0 lg:block lg:w-64 ${showMessages ? 'hidden' : 'block'}`}>
        <ChatSidebar
          agents={agents}
          selectedChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
        />
      </div>

      {/* Main chat area — hidden on mobile when sidebar is shown */}
      <div className={`flex flex-1 flex-col ${showMessages ? 'flex' : 'hidden lg:flex'}`}>
        {/* Channel header */}
        <div className="border-b px-4 py-3 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setShowMessages(false)}
            aria-label="Back to channels"
            data-testid="chat-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h2 className="flex-1 text-sm font-semibold">{channelLabel}</h2>
          <Button
            variant={showVoiceRoom ? 'default' : 'outline'}
            size="sm"
            onClick={toggleVoiceRoom}
            className="gap-1.5"
            data-testid="voice-toggle"
          >
            <Mic className="h-3.5 w-3.5" />
            {showVoiceRoom ? 'Close Voice' : 'Voice Room'}
          </Button>
        </div>

        {/* Error banners */}
        {fetchError && (
          <div
            className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            data-testid="chat-fetch-error"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Failed to load messages. Check that the API server is running.</span>
          </div>
        )}
        {sendMessage.isError && (
          <div
            className="mx-4 mt-2 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            data-testid="chat-send-error"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span>Failed to send message. Please try again.</span>
          </div>
        )}

        {/* Voice room panel */}
        {showVoiceRoom && (
          <div className="border-b">
            <VoiceRoom voice={voice} onClose={closeVoiceRoom} />
          </div>
        )}

        {/* Messages */}
        <MessageList messages={messages} isLoading={isLoading} typingAgents={typingAgents} />

        {/* Input with mic button */}
        <MessageInput
          onSend={handleSend}
          disabled={sendMessage.isPending}
          onVoiceRecord={voice.recordAndTranscribe}
          isRecording={voice.isRecording}
        />
      </div>
    </div>
  );
}
