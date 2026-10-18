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
 *
 * QUIET WINDOWS (Adam's play pass, later the same day): keyed
 * coalescing alone still clogged — during a harvest spree the
 * pickup and pouch-full toasts kept refreshing each other's
 * timers and never died. Two changes: a keyed refresh now
 * updates the WORDS ONLY and lets the original timer run, and
 * when a keyed toast dies (expiry or dismissal) its key goes
 * QUIET for a few seconds — posts in the window are dropped.
 * A keyed toast's screen life is now one TTL per window, not
 * however long the spree lasts.
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
// System word (Adam, 2026-10-18: 'a brief system message at the
// bottom left disappeared way too quickly'): posts keyed
// 'system:<lineId>' are the OPERATOR's voice — build notices and
// broadcasts. They are rare, they are longer than a pickup line,
// and if the moment is missed the moment is the only place they
// announce themselves (the text itself also lives on in the chat
// log and the NEWS archive). So they keep the screen for a full
// read instead of a gameplay toast's glance.
const SYSTEM_WORD_TTL_MS = 12000;
// How long a key stays quiet after its toast dies. Long
// enough for the stack to visibly clear during a spree,
// short enough that a genuinely new event is never old news.
const KEYED_QUIET_MS = 6000;

export function useNotifications(): UseNotificationsResult {
  const [notifications, setNotifications] = useState<GameNotification[]>([]);
  // Expiry timers by toast id, so a replacement can reset its
  // own clock (and a cleared toast leaves no zombie timer).
  const timersRef = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  // Which key each live toast wears (by id), and until when
  // each key is quiet. The quiet map is what turns 'the toast
  // died' into 'and it stays told for a few seconds'.
  const keyByIdRef = useRef(new Map<string, string>());
  const quietUntilRef = useRef(new Map<string, number>());

  const clearNotification = useCallback((id: string): void => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    // A keyed toast leaving — however it leaves — starts its
    // key's quiet window.
    const key = keyByIdRef.current.get(id);
    if (key) {
      keyByIdRef.current.delete(id);
      quietUntilRef.current.set(key, Date.now() + KEYED_QUIET_MS);
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
        // In the key's quiet window the post is dropped whole:
        // the player was told, the toast died on schedule, and
        // the spree does not get to resurrect it instantly.
        if (key && Date.now() < (quietUntilRef.current.get(key) ?? 0)) {
          return prev;
        }
        // A keyed post whose key is already live replaces that
        // toast in place: same id (the slot and its position
        // hold), fresh words — but the ORIGINAL timer keeps
        // running. Refreshing the words must not refresh the
        // death clock, or a spree pins the toast forever.
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
        if (existing) {
          return prev.map((n) => (n.id === existing.id ? notif : n));
        }
        if (key) keyByIdRef.current.set(notif.id, key);
        timersRef.current.set(
          notif.id,
          setTimeout(
            () => clearNotification(notif.id),
            key?.startsWith('system:') ? SYSTEM_WORD_TTL_MS : TOAST_TTL_MS
          )
        );
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
