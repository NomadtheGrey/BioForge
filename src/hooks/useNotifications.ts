/**
 * BioForge Notification Toast Domain Hook
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 8 (Modular Separation), 9 (Strict Type Safety)
 *
 * KEYED COALESCING (Adam's play pass, 2026-10-17): the stack
 * holds five toasts and a new post evicts the oldest instantly —
 * so a spree of 'Item Collected' posts could push a taming
 * result out of existence before its 4.5 seconds were read. A
 * post may now carry a KEY: when a live toast already wears
 * that key, the post replaces it in place (fresh words, fresh
 * timer) instead of taking a new slot. The two spammy posters
 * (pickups, pouch-full) are keyed; everything else posts as
 * before.
 */

import { useState, useCallback, useRef } from 'react';
import { GameNotification } from '../types/game';

export interface UseNotificationsResult {
  notifications: GameNotification[];
  postNotification: (
    title: string,
    message: string,
    type?: GameNotification['type'],
    iconColor?: string,
    key?: string
  ) => void;
  clearNotification: (id: string) => void;
}

const TOAST_TTL_MS = 4500;

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  // Expiry timers by toast id, so a replacement can reset its
  // own clock (and a cleared toast leaves no zombie timer).
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const clearNotification = useCallback((id: string): void => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const postNotification = useCallback(
    (
      title: string,
      message: string,
      type: GameNotification['type'] = 'system',
      iconColor = '#38bdf8',
      key?: string
    ): void => {
      setNotifications((prev) => {
        // A keyed post whose key is already live replaces that
        // toast in place: same id (the slot and its position
        // hold), fresh words, and the timer resets below.
        const existing = key ? prev.find((n) => n.key === key) : undefined;
        const notif: GameNotification = {
          id: existing?.id ?? 'notif_' + Math.random().toString(36).substring(2, 9),
          title,
          message,
          type,
          iconColor,
          time: Date.now(),
          key,
        };
        const oldTimer = timersRef.current.get(notif.id);
        if (oldTimer) clearTimeout(oldTimer);
        timersRef.current.set(
          notif.id,
          setTimeout(() => clearNotification(notif.id), TOAST_TTL_MS)
        );
        if (existing) {
          return prev.map((n) => (n.id === existing.id ? notif : n));
        }
        return [notif, ...prev.slice(0, 4)];
      });
    },
    [clearNotification]
  );

  return {
    notifications,
    postNotification,
    clearNotification,
  };
}
