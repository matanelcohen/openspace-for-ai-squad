'use client';

import { useCallback, useEffect, useState } from 'react';

import type { Notification } from '@/lib/notifications';
import { getStoredNotifications, storeNotifications } from '@/lib/notifications';

const MAX_NOTIFICATIONS = 50;

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    setNotifications(getStoredNotifications());
  }, []);

  const persist = useCallback((updated: Notification[]) => {
    const sliced = updated.slice(0, MAX_NOTIFICATIONS);
    setNotifications(sliced);
    storeNotifications(sliced);
  }, []);

  const addNotification = useCallback(
    (notification: Notification) => {
      setNotifications((prev) => {
        const updated = [notification, ...prev].slice(0, MAX_NOTIFICATIONS);
        storeNotifications(updated);
        return updated;
      });
    },
    [],
  );

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
    persist([]);
  }, [persist]);

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
