'use client';

import type { ChatChannel } from '@matanelcohen/openspace-shared';
import { ChevronDown, Hash, Plus } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useChannels } from '@/hooks/use-channels';
import { cn } from '@/lib/utils';

// ── Types ───────────────────────────────────────────────────────────

/** A named group of channels rendered as a collapsible section. */
export interface ChannelCategory {
  /** Unique key for this category. */
  id: string;
  /** Display label for the section header. */
  label: string;
  /** Channel IDs that belong to this category. */
  channelIds: string[];
}

export interface ChannelSidebarProps {
  /**
   * Optional category configuration. When provided, channels are grouped
   * into collapsible sections. Channels not covered by any category are
   * placed in an "Other" section. When omitted, all channels render under
   * a single "Channels" heading.
   */
  categories?: ChannelCategory[];
  /** Map of channel ID → unread message count. */
  unreadCounts?: Record<string, number>;
  /**
   * Override active channel detection. When omitted, the component reads
   * the `channel` search param from the current URL.
   */
  activeChannelId?: string;
  /** Fired when a channel is clicked (in addition to Link navigation). */
  onChannelSelect?: (channelId: string) => void;
  /** Show a "+" button and fire this callback to create a channel. */
  onCreateChannel?: () => void;
  /** Extra class names on the root element. */
  className?: string;
}

// ── Helpers ─────────────────────────────────────────────────────────

interface ResolvedSection {
  id: string;
  label: string;
  channels: ChatChannel[];
}

function resolveCategories(
  channels: ChatChannel[],
  categories?: ChannelCategory[],
): ResolvedSection[] {
  if (!categories || categories.length === 0) {
    return [{ id: '_all', label: 'Channels', channels }];
  }

  const assigned = new Set<string>();
  const sections: ResolvedSection[] = categories.map((cat) => {
    const matched = cat.channelIds
      .map((cid) => channels.find((ch) => ch.id === cid))
      .filter((ch): ch is ChatChannel => !!ch);
    matched.forEach((ch) => assigned.add(ch.id));
    return { id: cat.id, label: cat.label, channels: matched };
  });

  const uncategorised = channels.filter((ch) => !assigned.has(ch.id));
  if (uncategorised.length > 0) {
    sections.push({ id: '_other', label: 'Other', channels: uncategorised });
  }

  return sections.filter((s) => s.channels.length > 0);
}

// ── Component ───────────────────────────────────────────────────────

export function ChannelSidebar({
  categories,
  unreadCounts = {},
  activeChannelId,
  onChannelSelect,
  onCreateChannel,
  className,
}: ChannelSidebarProps) {
  const { data: channels = [], isLoading, isError } = useChannels();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Determine active channel: explicit prop > URL search param
  const active = activeChannelId ?? searchParams.get('channel') ?? undefined;

  const sections = resolveCategories(channels, categories);

  // Total unread across all channels
  const totalUnread = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);

  return (
    <aside
      className={cn('flex h-full flex-col border-r bg-sidebar text-sidebar-foreground', className)}
      data-testid="channel-sidebar"
    >
      {/* Header */}
      <div className="flex h-12 items-center justify-between border-b px-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Channels</h2>
          {totalUnread > 0 && (
            <Badge variant="default" className="h-5 min-w-5 justify-center px-1.5" data-testid="total-unread-badge">
              {totalUnread}
            </Badge>
          )}
        </div>
        {onCreateChannel && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onCreateChannel}
            aria-label="Create channel"
            data-testid="channel-sidebar-create-btn"
          >
            <Plus className="h-4 w-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {/* Scrollable channel list */}
      <ScrollArea className="flex-1" data-testid="channel-sidebar-scroll">
        <nav className="p-2" role="navigation" aria-label="Channel list">
          {isLoading && (
            <div className="space-y-2 p-2" data-testid="channel-sidebar-loading">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-9 animate-pulse rounded-md bg-muted" />
              ))}
            </div>
          )}

          {isError && (
            <p className="px-2 py-4 text-center text-sm text-destructive" data-testid="channel-sidebar-error">
              Failed to load channels
            </p>
          )}

          {!isLoading && !isError && channels.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-muted-foreground" data-testid="channel-sidebar-empty">
              No channels yet
            </p>
          )}

          {!isLoading &&
            !isError &&
            sections.map((section) => (
              <ChannelSection
                key={section.id}
                section={section}
                activeChannelId={active}
                unreadCounts={unreadCounts}
                pathname={pathname}
                onChannelSelect={onChannelSelect}
              />
            ))}
        </nav>
      </ScrollArea>
    </aside>
  );
}

// ── Section (collapsible) ───────────────────────────────────────────

interface ChannelSectionProps {
  section: ResolvedSection;
  activeChannelId?: string;
  unreadCounts: Record<string, number>;
  pathname: string;
  onChannelSelect?: (channelId: string) => void;
}

function ChannelSection({
  section,
  activeChannelId,
  unreadCounts,
  pathname,
  onChannelSelect,
}: ChannelSectionProps) {
  const sectionUnread = section.channels.reduce(
    (sum, ch) => sum + (unreadCounts[ch.id] ?? 0),
    0,
  );

  const [open, setOpen] = useState(true);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mb-1" data-testid={`channel-section-${section.id}`}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="flex w-full items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:bg-accent/50"
          data-testid={`channel-section-trigger-${section.id}`}
        >
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 transition-transform',
              !open && '-rotate-90',
            )}
          />
          <span className="flex-1 text-left">{section.label}</span>
          {sectionUnread > 0 && (
            <Badge
              variant="secondary"
              className="h-4 min-w-4 justify-center px-1 text-[10px]"
              data-testid={`section-unread-${section.id}`}
            >
              {sectionUnread}
            </Badge>
          )}
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-0.5 space-y-0.5">
          {section.channels.map((channel) => (
            <ChannelItem
              key={channel.id}
              channel={channel}
              isActive={activeChannelId === channel.id}
              unreadCount={unreadCounts[channel.id] ?? 0}
              pathname={pathname}
              onSelect={onChannelSelect}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Single channel item ─────────────────────────────────────────────

interface ChannelItemProps {
  channel: ChatChannel;
  isActive: boolean;
  unreadCount: number;
  pathname: string;
  onSelect?: (channelId: string) => void;
}

function ChannelItem({ channel, isActive, unreadCount, pathname, onSelect }: ChannelItemProps) {
  const href = `${pathname}?channel=${encodeURIComponent(channel.id)}`;

  return (
    <Button
      variant="ghost"
      size="sm"
      asChild
      className={cn(
        'w-full justify-start gap-2 px-2 font-normal',
        isActive && 'bg-accent text-accent-foreground',
        unreadCount > 0 && !isActive && 'font-medium',
      )}
      data-testid={`channel-item-${channel.id}`}
    >
      <Link
        href={href}
        onClick={() => onSelect?.(channel.id)}
        aria-current={isActive ? 'page' : undefined}
      >
        <Hash className="h-4 w-4 shrink-0 text-muted-foreground" />
        <span className="flex-1 truncate">{channel.name}</span>
        {unreadCount > 0 && (
          <Badge
            variant="default"
            className="ml-auto h-5 min-w-5 justify-center px-1.5"
            data-testid={`channel-unread-${channel.id}`}
          >
            {unreadCount}
          </Badge>
        )}
      </Link>
    </Button>
  );
}
