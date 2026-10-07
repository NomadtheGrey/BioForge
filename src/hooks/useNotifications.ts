/**
 * BioForge Notification Toast Domain Hook
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback } from 'react';
import { GameNotification } from '../types/game';

export interface UseNotificationsResult {
  notifications: GameNotification[];
  postNotification: (
    title: string,
    message: string,
    type?: GameNotification['type'],
    iconColor?: string
  ) => void;
  clearNotification: (id: string) => void;
}

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<GameNotification[]>([]);

  const clearNotification = useCallback((id: string): void => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const postNotification = useCallback(
    (
      title: string,
      message: string,
      type: GameNotification['type'] = 'system',
      iconColor = '#38bdf8'
    ): void => {
      const notif: GameNotification = {
        id: 'notif_' + Math.random().toString(36).substring(2, 9),
        title,
        message,
        type,
        iconColor,
        time: Date.now(),
      };

      setNotifications((prev) => [notif, ...prev.slice(0, 4)]);

      setTimeout(() => {
        clearNotification(notif.id);
      }, 4500);
    },
    [clearNotification]
  );

  return {
    notifications,
    postNotification,
    clearNotification,
  };
}
