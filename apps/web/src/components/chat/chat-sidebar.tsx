'use client';

import type { Agent } from '@openspace/shared';

import { AgentAvatar } from '@/components/agent-avatar';
import { cn } from '@/lib/utils';

interface ChatSidebarProps {
  agents: Agent[];
  selectedChannel: string;
  onSelectChannel: (channel: string) => void;
}

export function ChatSidebar({ agents, selectedChannel, onSelectChannel }: ChatSidebarProps) {
  return (
    <div className="flex h-full flex-col border-r" data-testid="chat-sidebar">
      <div className="border-b p-3">
        <h2 className="text-sm font-semibold text-muted-foreground">Channels</h2>
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
