'use client';

import type { Agent, ChatChannel } from '@openspace/shared';
import { Hash, PanelRight, Pencil, Settings, Trash2, Users } from 'lucide-react';

import { AgentAvatar } from '@/components/agent-avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

export interface ChannelHeaderProps {
  /** The channel to display. */
  channel: ChatChannel;
  /** Available agents — used to resolve member names/avatars. */
  agents?: Agent[];
  /** Called when the user clicks the "Edit" action. */
  onEdit?: () => void;
  /** Called when the user clicks the "Delete" action. */
  onDelete?: () => void;
  /** Called when the user toggles the settings panel. */
  onToggleSettings?: () => void;
  /** Whether the settings panel is currently open. */
  settingsOpen?: boolean;
  /** Called when the back button is pressed (mobile). */
  onBack?: () => void;
  /** Extra class names on the root element. */
  className?: string;
  /** Slot for additional action buttons (e.g., voice room toggle). */
  actions?: React.ReactNode;
}

// ── Helpers ─────────────────────────────────────────────────────────

/** Max number of member avatars to show before "+N more". */
const MAX_VISIBLE_MEMBERS = 5;

function resolveMemberAgents(channel: ChatChannel, agents: Agent[]): Agent[] {
  if (!agents.length) return [];
  return channel.memberAgentIds
    .map((id) => agents.find((a) => a.id === id))
    .filter((a): a is Agent => !!a);
}

// ── Component ───────────────────────────────────────────────────────

export function ChannelHeader({
  channel,
  agents = [],
  onEdit,
  onDelete,
  onToggleSettings,
  settingsOpen,
  onBack,
  className,
  actions,
}: ChannelHeaderProps) {
  const members = resolveMemberAgents(channel, agents);
  const visibleMembers = members.slice(0, MAX_VISIBLE_MEMBERS);
  const overflowCount = Math.max(0, members.length - MAX_VISIBLE_MEMBERS);

  const hasActions = !!onEdit || !!onDelete;

  return (
    <header
      className={cn('flex items-center gap-3 border-b bg-background px-4 py-3', className)}
      data-testid="channel-header"
    >
      {/* Mobile back button */}
      {onBack && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0 lg:hidden"
          onClick={onBack}
          aria-label="Back to channels"
          data-testid="channel-header-back"
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
      )}

      {/* Channel info */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <Hash
          className="h-5 w-5 shrink-0 text-muted-foreground"
          data-testid="channel-header-hash"
        />
        <div className="min-w-0">
          <h2
            className="truncate text-sm font-semibold leading-tight"
            data-testid="channel-header-name"
          >
            {channel.name}
          </h2>
          {channel.description && (
            <p
              className="truncate text-xs text-muted-foreground"
              data-testid="channel-header-description"
            >
              {channel.description}
            </p>
          )}
        </div>
      </div>

      {/* Member avatars */}
      {members.length > 0 && (
        <TooltipProvider delayDuration={200}>
          <div className="hidden items-center gap-0.5 sm:flex" data-testid="channel-header-members">
            <div className="flex -space-x-1.5">
              {visibleMembers.map((agent) => (
                <Tooltip key={agent.id}>
                  <TooltipTrigger asChild>
                    <div data-testid={`channel-member-avatar-${agent.id}`}>
                      <AgentAvatar
                        agentId={agent.id}
                        name={agent.name}
                        size="sm"
                        className="ring-2 ring-background"
                      />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>
                      {agent.name} · {agent.role}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
            {overflowCount > 0 && (
              <Badge
                variant="secondary"
                className="ml-1 h-5 px-1.5 text-[10px]"
                data-testid="channel-header-overflow"
              >
                +{overflowCount}
              </Badge>
            )}
            <span
              className="ml-1.5 text-xs text-muted-foreground"
              data-testid="channel-header-member-count"
            >
              <Users className="mr-0.5 inline-block h-3 w-3" />
              {members.length}
            </span>
          </div>
        </TooltipProvider>
      )}

      {/* Custom actions slot */}
      {actions}

      {/* Settings panel toggle */}
      {onToggleSettings && (
        <Button
          variant={settingsOpen ? 'default' : 'ghost'}
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={onToggleSettings}
          aria-label="Toggle settings panel"
          data-testid="channel-header-toggle-settings"
        >
          <PanelRight className="h-4 w-4 text-muted-foreground" />
        </Button>
      )}

      {/* Settings dropdown */}
      {hasActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              aria-label="Channel settings"
              data-testid="channel-header-settings"
            >
              <Settings className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && (
              <DropdownMenuItem onClick={onEdit} data-testid="channel-header-edit">
                <Pencil className="mr-2 h-4 w-4" />
                Edit channel
              </DropdownMenuItem>
            )}
            {onEdit && onDelete && <DropdownMenuSeparator />}
            {onDelete && (
              <DropdownMenuItem
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
                data-testid="channel-header-delete"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete channel
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </header>
  );
}
