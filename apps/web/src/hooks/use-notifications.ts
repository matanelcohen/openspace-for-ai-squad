'use client';

import { useCallback, useEffect, useState } from 'react';

import { useWsEvent } from '@/components/providers/websocket-provider';
import type { WsEnvelope } from '@/hooks/use-websocket';
import type { Notification } from '@/lib/notifications';
import {
  createNotificationFromEvent,
  getStoredNotifications,
  storeNotifications,
} from '@/lib/notifications';

const MAX_NOTIFICATIONS = 50;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setNotifications(getStoredNotifications());
  }, []);

  const addNotification = useCallback((notification: Notification) => {
    setNotifications((prev) => {
      const updated = [notification, ...prev].slice(0, MAX_NOTIFICATIONS);
      storeNotifications(updated);
      return updated;
    });
  }, []);

  // Wire WebSocket events to notifications
  const handleEvent = useCallback(
    (envelope: WsEnvelope) => {
      const notification = createNotificationFromEvent(
        envelope.type,
        envelope.payload as Record<string, unknown>,
      );
      if (notification) addNotification(notification);
    },
    [addNotification],
  );

  useWsEvent('task:updated', handleEvent);
  useWsEvent('task:created', handleEvent);
  useWsEvent('activity:new', handleEvent);
  useWsEvent('agent:status', handleEvent);

  const markAsRead = useCallback(
    (id: string) => {
      setNotifications((prev) => {
        const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
        storeNotifications(updated);
        return updated;
      });
    },
    [],
  );

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      storeNotifications(updated);
      return updated;
    });
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    storeNotifications([]);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return {
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
  };
}
