'use client';

import { AssistantRuntimeProvider } from '@assistant-ui/react';
import type { ChatChannel } from '@openspace/shared';
import { CHAT_CHANNEL_PREFIX, CHAT_TEAM_RECIPIENT } from '@openspace/shared';
import { AlertCircle, Mic, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { Thread } from '@/components/assistant-ui/thread';
import { ChannelDialog } from '@/components/chat/channel-dialog';
import { ChannelHeader } from '@/components/chat/channel-header';
import { ChannelSettingsPanel } from '@/components/chat/channel-settings-panel';
import { ChatSidebar } from '@/components/chat/chat-sidebar';
import { DeleteChannelDialog } from '@/components/chat/delete-channel-dialog';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { VoiceRoom } from '@/components/voice/voice-room';
import { useAgents } from '@/hooks/use-agents';
import { useAssistantRuntime } from '@/hooks/use-assistant-runtime';
import {
  useChannels,
  useCreateChannel,
  useDeleteChannel,
  useUpdateChannel,
} from '@/hooks/use-channels';
import { useChatMessages, useClearChat, useSendMessage, useTypingIndicator, useUnreadCounts } from '@/hooks/use-chat';
import { useVoiceSession } from '@/hooks/use-voice-session';

export function ChatClient() {
  const [selectedChannel, setSelectedChannel] = useState<string>(CHAT_TEAM_RECIPIENT);
  const [showMessages, setShowMessages] = useState(false);
  const [showVoiceRoom, setShowVoiceRoom] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);

  // Channel management state
  const [channelDialogOpen, setChannelDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<ChatChannel | null>(null);
  const [deletingChannel, setDeletingChannel] = useState<ChatChannel | null>(null);
  const [showSettingsPanel, setShowSettingsPanel] = useState(false);

  const { data: agents = [] } = useAgents();
  const { data: channels = [] } = useChannels();
  const { error: fetchError } = useChatMessages(selectedChannel);
  const sendMessage = useSendMessage();
  const clearChat = useClearChat();
  const typingAgents = useTypingIndicator();
  const { unread, clearUnread } = useUnreadCounts(selectedChannel);
  const runtime = useAssistantRuntime(selectedChannel, typingAgents);
  const voice = useVoiceSession();

  const createChannel = useCreateChannel();
  const updateChannel = useUpdateChannel();
  const deleteChannel = useDeleteChannel();

  // Resolve the active custom channel (if any) for ChannelHeader
  const activeCustomChannel = selectedChannel.startsWith(CHAT_CHANNEL_PREFIX)
    ? (channels.find((c) => `${CHAT_CHANNEL_PREFIX}${c.id}` === selectedChannel) ?? null)
    : null;

  const channelLabel =
    selectedChannel === CHAT_TEAM_RECIPIENT
      ? 'Team'
      : (agents.find((a) => a.id === selectedChannel)?.name ??
        activeCustomChannel?.name ??
        selectedChannel);

  const handleSelectChannel = (channel: string) => {
    setSelectedChannel(channel);
    setShowMessages(true);
    clearUnread(channel);
  };

  const toggleVoiceRoom = () => {
    if (!showVoiceRoom) {
      if (!voice.session) {
        const agentIds = agents.map((a) => a.id).filter((id) => !['scribe', 'ralph'].includes(id));
        voice.startSession(agentIds.length > 0 ? agentIds : ['leela', 'fry', 'bender', 'zoidberg']);
      }
    } else {
      voice.stopListening();
    }
    setShowVoiceRoom((prev) => !prev);
  };

  const closeVoiceRoom = () => {
    setShowVoiceRoom(false);
  };

  // Channel CRUD handlers
  const handleCreateChannel = () => {
    setEditingChannel(null);
    setChannelDialogOpen(true);
  };

  const handleEditChannel = (channel: ChatChannel) => {
    setEditingChannel(channel);
    setChannelDialogOpen(true);
  };

  const handleDeleteChannel = (channel: ChatChannel) => {
    setDeletingChannel(channel);
  };

  const handleSaveChannel = (data: {
    name: string;
    description: string;
    memberAgentIds: string[];
  }) => {
    if (editingChannel) {
      updateChannel.mutate(
        { id: editingChannel.id, ...data },
        { onSuccess: () => setChannelDialogOpen(false) },
      );
    } else {
      createChannel.mutate(data, {
        onSuccess: (created) => {
          setChannelDialogOpen(false);
          setSelectedChannel(`channel:${created.id}`);
          setShowMessages(true);
        },
      });
    }
  };

  const handleConfirmDelete = () => {
    if (!deletingChannel) return;
    deleteChannel.mutate(deletingChannel.id, {
      onSuccess: () => {
        // If we're viewing the deleted channel, switch to team
        if (selectedChannel === `channel:${deletingChannel.id}`) {
          setSelectedChannel(CHAT_TEAM_RECIPIENT);
        }
        setDeletingChannel(null);
        setShowSettingsPanel(false);
      },
    });
  };

  const handleSettingsSave = (data: {
    name: string;
    description: string;
    memberAgentIds: string[];
  }) => {
    if (!activeCustomChannel) return;
    updateChannel.mutate(
      { id: activeCustomChannel.id, ...data },
      { onSuccess: () => setShowSettingsPanel(false) },
    );
  };

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <div className="flex flex-1 overflow-hidden" data-testid="chat-client">
        {/* Sidebar — hidden on mobile when messages panel is shown */}
        <div
          className={`w-full flex-shrink-0 lg:block lg:w-64 ${showMessages ? 'hidden' : 'block'}`}
        >
          <ChatSidebar
            agents={agents}
            selectedChannel={selectedChannel}
            onSelectChannel={handleSelectChannel}
            onClearChat={(channel) => clearChat.mutate(channel)}
            onClearAllChats={() => clearChat.mutate(undefined)}
            isClearingChat={clearChat.isPending}
            typingAgents={typingAgents}
            unreadCounts={unread}
            channels={channels}
            onCreateChannel={handleCreateChannel}
            onEditChannel={handleEditChannel}
            onDeleteChannel={handleDeleteChannel}
          />
        </div>

        {/* Main chat area — hidden on mobile when sidebar is shown */}
        <div className={`flex min-w-0 flex-1 ${showMessages ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex flex-1 flex-col min-w-0">
            {/* Channel header — use ChannelHeader for custom channels, simple bar otherwise */}
            {activeCustomChannel ? (
              <ChannelHeader
                channel={activeCustomChannel}
                agents={agents}
                onBack={() => setShowMessages(false)}
                onEdit={() => handleEditChannel(activeCustomChannel)}
                onDelete={() => handleDeleteChannel(activeCustomChannel)}
                onToggleSettings={() => setShowSettingsPanel((prev) => !prev)}
                settingsOpen={showSettingsPanel}
                actions={
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowClearDialog(true)}
                      className="gap-1.5 text-muted-foreground hover:text-destructive"
                      data-testid="clear-chat-btn"
                      title="Clear chat"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Clear</span>
                    </Button>
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
                  </>
                }
              />
            ) : (
              <div className="border-b px-4 py-3 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  onClick={() => setShowMessages(false)}
                  aria-label="Back to channels"
                  data-testid="chat-back-btn"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </Button>
                <h2 className="flex-1 text-sm font-semibold">{channelLabel}</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowClearDialog(true)}
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                  data-testid="clear-chat-btn"
                  title="Clear chat"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Clear</span>
                </Button>
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
            )}

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

            {/* Thread — full assistant-ui styled chat */}
            <div className="flex-1 min-h-0">
              <Thread />
            </div>
          </div>

          {/* Channel settings panel */}
          {showSettingsPanel && activeCustomChannel && (
            <ChannelSettingsPanel
              channel={activeCustomChannel}
              agents={agents}
              onSave={handleSettingsSave}
              onDelete={() => handleDeleteChannel(activeCustomChannel)}
              onClose={() => setShowSettingsPanel(false)}
              isSaving={updateChannel.isPending}
            />
          )}
        </div>
      </div>

      {/* Clear chat confirmation dialog */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Clear chat</DialogTitle>
            <DialogDescription>
              This will permanently delete all messages in <strong>{channelLabel}</strong>. This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearDialog(false)}
              data-testid="clear-chat-cancel"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={clearChat.isPending}
              onClick={() => {
                clearChat.mutate(selectedChannel, {
                  onSuccess: () => setShowClearDialog(false),
                });
              }}
              data-testid="clear-chat-confirm"
            >
              {clearChat.isPending ? 'Clearing…' : 'Clear messages'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Channel create/edit dialog */}
      <ChannelDialog
        open={channelDialogOpen}
        onOpenChange={setChannelDialogOpen}
        channel={editingChannel}
        agents={agents}
        onSave={handleSaveChannel}
        isSaving={createChannel.isPending || updateChannel.isPending}
      />

      {/* Channel delete confirmation */}
      <DeleteChannelDialog
        open={!!deletingChannel}
        onOpenChange={(open) => !open && setDeletingChannel(null)}
        channel={deletingChannel}
        onConfirm={handleConfirmDelete}
        isDeleting={deleteChannel.isPending}
      />
    </AssistantRuntimeProvider>
  );
}
