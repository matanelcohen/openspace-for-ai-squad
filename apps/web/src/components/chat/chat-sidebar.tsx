'use client';

import type { Agent } from '@openspace/shared';
import { Trash2 } from 'lucide-react';
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
}

export function ChatSidebar({
  agents,
  selectedChannel,
  onSelectChannel,
  onClearChat,
  onClearAllChats,
  isClearingChat,
}: ChatSidebarProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearTarget, setClearTarget] = useState<ClearTarget>('current');

  const channelLabel =
    selectedChannel === 'team'
      ? 'Team'
      : (agents.find((a) => a.id === selectedChannel)?.name ?? selectedChannel);

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
            <div className="truncate text-xs text-muted-foreground">All agents</div>
          </div>
        </button>

        {/* Agent channels */}
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
              <div className="truncate text-xs text-muted-foreground">{agent.role}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
