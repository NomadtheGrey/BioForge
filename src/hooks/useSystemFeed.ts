// ====================================================================
// useSystemFeed — the system stream's engine (Adam 2026-10-18).
//
// Owns: the seen-state, the greeting this build owes a
// returning player, the feed polling (~5 min + on tab
// refocus), and the stream lines both surfaces read — the
// start screen's NEWS seat and the in-game system panel.
// The pure contract lives in game/systemFeed.ts; the baked
// identity in game/buildNotes.ts.
//
// SOFT BY DESIGN (v1): lines instruct, never force. Nothing
// here reloads a page, locks input, or touches a save.
// ====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BUILD_ID, BUILD_NOTES } from '../game/buildNotes';
import { installErrorCapture } from '../game/errorLog';
import { mergeSystemFeed } from '../game/systemLog';
import {
  activeBroadcasts,
  fetchSystemFeed,
  loadSeen,
  saveSeen,
  staleBuildLine,
  unreadCount,
  type FeedBroadcast,
  type SeenState,
  type SystemFeed,
} from '../game/systemFeed';

export interface SystemLine {
  id: string;
  kind: 'build' | 'broadcast' | 'stale';
  title?: string;
  text: string;
  /** Notice-level: also raised as a toast once (App wires it). */
  notice: boolean;
}

export interface UseSystemFeedResult {
  /** The last good feed document, or null (silence so far). */
  feed: SystemFeed | null;
  /** The stream, oldest first. Re-readable in the panel. */
  lines: SystemLine[];
  /** Unread count for the news seats' dots. */
  unread: number;
  /** The first live, unseen notice broadcast — the start
   *  screen may open the news once for it on first load. */
  firstNotice: FeedBroadcast | null;
  /** Everything currently shown becomes seen. */
  markSeen: () => void;
}

const POLL_MS = 5 * 60 * 1000;

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** The greeting lines a fresh build owes: shown when this
 *  device has not yet seen THIS build. Id'd by the stamp so
 *  a later build's greeting is a new line, never a repeat. */
function greetingLines(): SystemLine[] {
  return [
    { id: `greet:${BUILD_ID}`, kind: 'build', title: 'While you were away', text: BUILD_NOTES.title, notice: false },
    ...BUILD_NOTES.lines.map((text, i) => ({
      id: `greet:${BUILD_ID}:${i}`,
      kind: 'build' as const,
      text,
      notice: false,
    })),
  ];
}

export function useSystemFeed(opts?: { onNotice?: (line: SystemLine) => void }): UseSystemFeedResult {
  const [feed, setFeed] = useState<SystemFeed | null>(null);
  // In-memory seen starts AS LOADED, deliberately one step
  // behind the greeting's persist (below): on the greeting
  // load the unread dot still counts this build — the prompt
  // to read the notes — while the persisted stamp ensures
  // no later load re-greets or re-dots it. markSeen syncs
  // the two whenever the player reads.
  const [seen, setSeen] = useState<SeenState>(() =>
    typeof localStorage !== 'undefined' ? loadSeen(localStorage) : { lastSeenBuild: '', seenBroadcasts: [] }
  );
  const [lines, setLines] = useState<SystemLine[]>(() => {
    const initial = typeof localStorage !== 'undefined' ? loadSeen(localStorage) : { lastSeenBuild: '', seenBroadcasts: [] };
    if (initial.lastSeenBuild === BUILD_ID) return [];
    // THE GREETING FIRES ONCE PER BUILD (the dev lane's
    // watch): the moment it seeds, the build's seen-stamp is
    // persisted — the next load does not re-announce. Nothing
    // is lost by this: the NewsModal ALWAYS carries the
    // running build's notes, read or not; the stream greeting
    // is the announcement, not the archive. Broadcasts keep
    // their own seen tracking (they clear when read).
    if (typeof localStorage !== 'undefined') {
      const greeted: SeenState = { ...initial, lastSeenBuild: BUILD_ID };
      saveSeen(localStorage, greeted);
    }
    return greetingLines();
  });

  const seenRef = useRef(seen);
  seenRef.current = seen;
  const lineIdsRef = useRef<Set<string>>(new Set(lines.map((l) => l.id)));
  const noticedRef = useRef<Set<string>>(new Set());
  const onNoticeRef = useRef(opts?.onNotice);
  onNoticeRef.current = opts?.onNotice;

  // Fold a fetched feed into the stream: broadcasts as lines
  // (every live one — the stream is a record, seen-state is
  // what makes a thing unread, not whether it appears), the
  // stale-build line when this build has been superseded.
  const processFeed = useCallback((doc: SystemFeed) => {
    const today = todayISO();
    const fresh: SystemLine[] = [];
    for (const b of activeBroadcasts(doc, today)) {
      const id = `b:${b.id}`;
      if (lineIdsRef.current.has(id)) continue;
      lineIdsRef.current.add(id);
      fresh.push({ id, kind: 'broadcast', title: b.title, text: b.body, notice: b.priority === 'notice' });
    }
    const stale = staleBuildLine(doc);
    if (stale) {
      const id = `stale:${doc.latestBuild}:${doc.action}`;
      if (!lineIdsRef.current.has(id)) {
        lineIdsRef.current.add(id);
        fresh.push({ id, kind: 'stale', title: 'System', text: stale, notice: true });
      }
    }
    if (fresh.length > 0) {
      setLines((prev) => [...prev, ...fresh]);
      // Notice lines toast once per session — and only while
      // still unseen: a player who already read the news is
      // never re-toasted for it on a later poll.
      for (const line of fresh) {
        if (!line.notice || noticedRef.current.has(line.id)) continue;
        noticedRef.current.add(line.id);
        const broadcastId = line.id.startsWith('b:') ? line.id.slice(2) : null;
        if (broadcastId && seenRef.current.seenBroadcasts.includes(broadcastId)) continue;
        onNoticeRef.current?.(line);
      }
    }
  }, []);

  useEffect(() => {
    // The device's error notebook opens with the stream's
    // engine (its idempotence makes repeat mounts safe) —
    // fire-and-forget; it can never throw into the hook.
    installErrorCapture();
    let live = true;
    const pull = async () => {
      const doc = await fetchSystemFeed();
      if (live && doc) {
        // An accepted document joins the device archive
        // (broadcasts kept past expiry, build stamps noted).
        // Fire-and-forget, like the capture above.
        mergeSystemFeed(doc);
        setFeed(doc);
        processFeed(doc);
      }
    };
    void pull();
    const interval = setInterval(() => void pull(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void pull();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [processFeed]);

  const markSeen = useCallback(() => {
    const today = todayISO();
    const next: SeenState = {
      lastSeenBuild: BUILD_ID,
      seenBroadcasts: Array.from(
        new Set([
          ...seenRef.current.seenBroadcasts,
          ...(feed ? activeBroadcasts(feed, today).map((b) => b.id) : []),
        ])
      ),
    };
    seenRef.current = next;
    setSeen(next);
    if (typeof localStorage !== 'undefined') saveSeen(localStorage, next);
  }, [feed]);

  const unread = useMemo(() => unreadCount(feed, seen, todayISO()), [feed, seen]);

  const firstNotice = useMemo(() => {
    if (!feed) return null;
    return (
      activeBroadcasts(feed, todayISO()).find(
        (b) => b.priority === 'notice' && !seen.seenBroadcasts.includes(b.id)
      ) ?? null
    );
  }, [feed, seen]);

  return { feed, lines, unread, firstNotice, markSeen };
}
