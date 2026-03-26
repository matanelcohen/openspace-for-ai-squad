'use client';

import { AlertTriangle, Ban, Bell, BotOff, Lightbulb, MessageSquare, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useNotifications } from '@/hooks/use-notifications';
import type { Notification } from '@/lib/notifications';

const MAX_DISPLAYED = 10;

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'task_failure':
      return <AlertTriangle className="h-4 w-4 text-destructive" />;
    case 'task_blocked':
      return <Ban className="h-4 w-4 text-yellow-500" />;
    case 'agent_failed':
      return <BotOff className="h-4 w-4 text-destructive" />;
    case 'decision_added':
      return <Lightbulb className="h-4 w-4 text-blue-500" />;
    case 'chat_message':
      return <MessageSquare className="h-4 w-4 text-green-500" />;
  }
}

function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll } = useNotifications();

  const displayed = notifications.slice(0, MAX_DISPLAYED);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Notifications" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
              data-testid="unread-count"
            >
              {unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between px-2 py-1.5">
          <DropdownMenuLabel className="p-0">Notifications</DropdownMenuLabel>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto px-2 py-1 text-xs"
              onClick={markAllAsRead}
              data-testid="mark-all-read"
            >
              Mark all as read
            </Button>
          )}
        </div>
        <DropdownMenuSeparator />
        {displayed.length === 0 ? (
          <div className="px-2 py-6 text-center text-sm text-muted-foreground">
            No notifications
          </div>
        ) : (
          <>
            {displayed.map((notification) => (
              <DropdownMenuItem
                key={notification.id}
                className="flex items-start gap-3 px-3 py-2"
                onClick={() => markAsRead(notification.id)}
                data-testid={`notification-${notification.id}`}
              >
                <span className="mt-0.5 shrink-0">{getNotificationIcon(notification.type)}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{notification.title}</span>
                    {!notification.read && (
                      <span
                        className="h-2 w-2 shrink-0 rounded-full bg-blue-500"
                        data-testid={`unread-dot-${notification.id}`}
                      />
                    )}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {notification.description}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(notification.timestamp)}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </>
        )}
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center gap-2 text-sm text-muted-foreground"
              onClick={clearAll}
              data-testid="clear-all"
            >
              <Trash2 className="h-3 w-3" />
              Clear all
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
