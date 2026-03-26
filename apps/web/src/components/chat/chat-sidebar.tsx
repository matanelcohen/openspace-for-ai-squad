'use client';

import type { Agent, ChatChannel } from '@openspace/shared';
import { Hash, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { AgentAvatar } from '@/components/agent-avatar';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ClearTarget = 'current' | 'all';

interface ChatSidebarProps {
  agents: Agent[];
  selectedChannel: string;
  onSelectChannel: (channel: string) => void;
  onClearChat?: (channel: string) => void;
  onClearAllChats?: () => void;
  isClearingChat?: boolean;
  /** Which agents are currently typing */
  typingAgents?: Map<string, string>;
  /** Custom channels */
  channels?: ChatChannel[];
  onCreateChannel?: () => void;
  onEditChannel?: (channel: ChatChannel) => void;
  onDeleteChannel?: (channel: ChatChannel) => void;
}

export function ChatSidebar({
  agents,
  selectedChannel,
  onSelectChannel,
  onClearChat,
  onClearAllChats,
  isClearingChat,
  typingAgents,
  channels = [],
  onCreateChannel,
  onEditChannel,
  onDeleteChannel,
}: ChatSidebarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState<ClearTarget>('current');

  const channelLabel =
    selectedChannel === 'team'
      ? 'Team'
      : (agents.find((a) => a.id === selectedChannel)?.name ??
        channels.find((c) => `channel:${c.id}` === selectedChannel)?.name ??
        selectedChannel);

  const handleClearRequest = (target: ClearTarget) => {
    setClearTarget(target);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (clearTarget === 'all') {
      onClearAllChats?.();
    } else {
      onClearChat?.(selectedChannel);
    }
    setConfirmOpen(false);
  };

  return (
    <div className="flex h-full flex-col border-r" data-testid="chat-sidebar">
      <div className="flex items-center justify-between border-b p-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Channels</h2>

        {(onClearChat || onClearAllChats) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Clear chat options"
                data-testid="clear-chat-trigger"
                disabled={isClearingChat}
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onClearChat && (
                <DropdownMenuItem
                  onClick={() => handleClearRequest('current')}
                  data-testid="clear-current-chat"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear &ldquo;{channelLabel}&rdquo; chat
                </DropdownMenuItem>
              )}
              {onClearChat && onClearAllChats && <DropdownMenuSeparator />}
              {onClearAllChats && (
                <DropdownMenuItem
                  onClick={() => handleClearRequest('all')}
                  className="text-destructive focus:text-destructive"
                  data-testid="clear-all-chats"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear all chats
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent data-testid="clear-chat-dialog">
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                {clearTarget === 'all'
                  ? 'This will permanently delete all messages in every chat.'
                  : `This will permanently delete all messages in the "${channelLabel}" chat.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="clear-chat-cancel">Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleConfirm}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                data-testid="clear-chat-confirm"
              >
                {isClearingChat ? 'Clearing…' : 'Clear'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Team channel */}
        <button
          type="button"
          className={cn(
            'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent',
            selectedChannel === 'team' && 'bg-accent',
          )}
          onClick={() => onSelectChannel('team')}
          data-testid="channel-team"
          aria-selected={selectedChannel === 'team'}
        >
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-sm">
            👥
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">Team</div>
            {typingAgents && typingAgents.size > 0 ? (
              <div className="flex items-center gap-1 text-xs text-primary">
                <span>{Array.from(typingAgents.values()).join(', ')}</span>
                <span className="inline-flex gap-0.5">
                  <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                  <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                </span>
              </div>
            ) : (
              <div className="truncate text-xs text-muted-foreground">All agents</div>
            )}
          </div>
        </button>

        {/* Custom channels section */}
        {(channels.length > 0 || onCreateChannel) && (
          <div className="mt-1">
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Channels
              </span>
              {onCreateChannel && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5"
                  onClick={onCreateChannel}
                  aria-label="Create channel"
                  data-testid="create-channel-btn"
                >
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
            {channels.map((channel) => {
              const channelKey = `channel:${channel.id}`;
              const isActive = selectedChannel === channelKey;
              return (
                <div
                  key={channel.id}
                  className={cn(
                    'group flex w-full items-center gap-2 px-3 py-2 transition-colors hover:bg-accent',
                    isActive && 'bg-accent',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => onSelectChannel(channelKey)}
                    data-testid={`channel-custom-${channel.id}`}
                    aria-selected={isActive}
                  >
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm text-muted-foreground">
                      <Hash className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{channel.name}</div>
                      {channel.description && (
                        <div className="truncate text-xs text-muted-foreground">
                          {channel.description}
                        </div>
                      )}
                    </div>
                  </button>
                  {(onEditChannel || onDeleteChannel) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
                          aria-label={`Channel ${channel.name} options`}
                          data-testid={`channel-menu-${channel.id}`}
                        >
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {onEditChannel && (
                          <DropdownMenuItem
                            onClick={() => onEditChannel(channel)}
                            data-testid={`edit-channel-${channel.id}`}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit channel
                          </DropdownMenuItem>
                        )}
                        {onEditChannel && onDeleteChannel && <DropdownMenuSeparator />}
                        {onDeleteChannel && (
                          <DropdownMenuItem
                            onClick={() => onDeleteChannel(channel)}
                            className="text-destructive focus:text-destructive"
                            data-testid={`delete-channel-${channel.id}`}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete channel
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Agent DM section */}
        <div className="mt-1">
          <div className="px-3 py-1.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Direct Messages
            </span>
          </div>
          {agents.map((agent) => (
            <button
              type="button"
              key={agent.id}
              className={cn(
                'flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent',
                selectedChannel === agent.id && 'bg-accent',
              )}
              onClick={() => onSelectChannel(agent.id)}
              data-testid={`channel-${agent.id}`}
              aria-selected={selectedChannel === agent.id}
            >
              <div className="relative">
                <AgentAvatar agentId={agent.id} name={agent.name} size="sm" />
                <span
                  className={cn(
                    'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background',
                    agent.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40',
                  )}
                  data-testid={`status-${agent.id}`}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{agent.name}</div>
                {typingAgents?.has(agent.id) ? (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    <span>typing</span>
                    <span className="inline-flex gap-0.5">
                      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:0ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:150ms]" />
                      <span className="h-1 w-1 animate-bounce rounded-full bg-primary [animation-delay:300ms]" />
                    </span>
                  </div>
                ) : (
                  <div className="truncate text-xs text-muted-foreground">{agent.role}</div>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
