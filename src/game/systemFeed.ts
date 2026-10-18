// ====================================================================
// THE SYSTEM FEED — the game's reader for the operator→player
// channel (Adam's design, 2026-10-18; build record in
// ReadMeFiles/SYSTEM_MESSAGES.md).
//
// The feed is a tiny JSON document served from Cloudflare KV
// by a separate minimal Worker (the bioforge-feed repo) —
// OUTSIDE the game build, so editing it never needs a game
// deploy. This module is the contract + the pure logic: the
// shape, the defensive parse, the seen-state, the expiry
// rule, and the stale-build lines. The hook (useSystemFeed)
// owns the fetching and the stream.
//
// THE GAME NEVER BLOCKS ON THE FEED. Fetch failure — offline,
// not yet deployed, a garbled document — is silence, and
// play proceeds. Nothing here throws across the boundary.
//
// Seen-state is per-device localStorage, never in the save:
// what you have read is a fact about your screen, not your
// world.
// ====================================================================

import { BUILD_ID } from './buildNotes';

/** Where the feed lives. One constant; portal builds can
 *  point it at their own mirror without touching the logic. */
export const SYSTEM_FEED_URL = 'https://bioforge-feed.nomadthegrey71.workers.dev/';

/** What an update asks of a player still on the old build. */
export type FeedAction = 'none' | 'refresh' | 'refresh-required' | 'new-game';

export interface FeedBroadcast {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  body: string;
  priority: 'panel' | 'notice';
  expires?: string; // YYYY-MM-DD, last day shown
}

export interface SystemFeed {
  latestBuild: string; // a BUILD_ID stamp, or '' before the first stamp
  action: FeedAction;
  broadcasts: FeedBroadcast[];
}

// ----------------------------------------------------------------
// The stale-build lines, one per action level. Player voice;
// review surface like all copy. 'none' has no line by design:
// the stamp moves quietly and only the NEW build speaks (its
// own greeting, from its baked notes).
// ----------------------------------------------------------------
export const STALE_BUILD_LINES: Record<Exclude<FeedAction, 'none'>, string> = {
  refresh:
    'A new build is live — refresh when you reach a good stopping point. Your world saves as always.',
  'refresh-required':
    'A new build is live, and this one matters — please refresh soon. The old build and the new world may not agree until you do.',
  'new-game':
    'A new build is live — and it asks for a fresh world. Your atlas keeps the old ones safe; start a new game when you are ready.',
};

/**
 * The stale-build verdict: when the feed's stamp is NEWER
 * than the running build's, the running build is old news —
 * return the line its action level speaks, else null.
 * Stamps are ISO minutes ('YYYY-MM-DDTHH:MMZ'): lexicographic
 * order IS chronological order, so a string compare is the
 * whole clock. A 'dev' build never calls itself stale.
 */
export function staleBuildLine(feed: SystemFeed, myBuildId: string = BUILD_ID): string | null {
  if (myBuildId === 'dev') return null;
  if (!feed.latestBuild || feed.latestBuild <= myBuildId) return null;
  if (feed.action === 'none') return null;
  return STALE_BUILD_LINES[feed.action];
}

// ----------------------------------------------------------------
// Defensive parse. The feed is operator-written JSON; a typo
// there must degrade to silence here, never to a crash or a
// nonsense line on a player's screen.
// ----------------------------------------------------------------
const ACTIONS: FeedAction[] = ['none', 'refresh', 'refresh-required', 'new-game'];

export function parseSystemFeed(raw: unknown): SystemFeed | null {
  if (!raw || typeof raw !== 'object') return null;
  const doc = raw as Record<string, unknown>;
  const latestBuild = typeof doc.latestBuild === 'string' ? doc.latestBuild : '';
  const action = ACTIONS.includes(doc.action as FeedAction) ? (doc.action as FeedAction) : 'none';
  const broadcasts: FeedBroadcast[] = [];
  if (Array.isArray(doc.broadcasts)) {
    for (const entry of doc.broadcasts) {
      if (!entry || typeof entry !== 'object') continue;
      const b = entry as Record<string, unknown>;
      if (typeof b.id !== 'string' || typeof b.title !== 'string' || typeof b.body !== 'string') continue;
      broadcasts.push({
        id: b.id,
        date: typeof b.date === 'string' ? b.date : '',
        title: b.title,
        body: b.body,
        priority: b.priority === 'notice' ? 'notice' : 'panel',
        expires: typeof b.expires === 'string' ? b.expires : undefined,
      });
    }
  }
  return { latestBuild, action, broadcasts };
}

/** Fetch + parse, silent on any failure. A short timeout:
 *  a hung feed must never hang a poll cycle. */
export async function fetchSystemFeed(url: string = SYSTEM_FEED_URL): Promise<SystemFeed | null> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(url, { signal: ctl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return parseSystemFeed(await res.json());
  } catch {
    return null;
  }
}

/** Broadcasts still alive on `today` (YYYY-MM-DD): an
 *  expiring broadcast shows THROUGH its expiry day. */
export function activeBroadcasts(feed: SystemFeed, today: string): FeedBroadcast[] {
  return feed.broadcasts.filter((b) => !b.expires || b.expires >= today);
}

// ----------------------------------------------------------------
// Seen-state — per-device, localStorage, never the save.
// ----------------------------------------------------------------
export interface SeenState {
  lastSeenBuild: string;
  seenBroadcasts: string[];
}

export const SEEN_KEY = 'bioforge.systemFeed.v1';
export const EMPTY_SEEN: SeenState = { lastSeenBuild: '', seenBroadcasts: [] };

/** Minimal storage shape, so the lab check can drive it. */
export interface SeenStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadSeen(storage: SeenStorage): SeenState {
  try {
    const raw = storage.getItem(SEEN_KEY);
    if (!raw) return { ...EMPTY_SEEN };
    const parsed = JSON.parse(raw) as Partial<SeenState>;
    return {
      lastSeenBuild: typeof parsed.lastSeenBuild === 'string' ? parsed.lastSeenBuild : '',
      seenBroadcasts: Array.isArray(parsed.seenBroadcasts)
        ? parsed.seenBroadcasts.filter((x): x is string => typeof x === 'string')
        : [],
    };
  } catch {
    return { ...EMPTY_SEEN };
  }
}

export function saveSeen(storage: SeenStorage, seen: SeenState): void {
  try {
    storage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    // Private modes and full disks degrade to "unread again
    // next time" — an annoyance, never a break.
  }
}

/** How much news stands unread: the build greeting counts
 *  once until seen; each unseen live broadcast counts once. */
export function unreadCount(feed: SystemFeed | null, seen: SeenState, today: string): number {
  let n = seen.lastSeenBuild === BUILD_ID ? 0 : 1;
  if (feed) {
    for (const b of activeBroadcasts(feed, today)) {
      if (!seen.seenBroadcasts.includes(b.id)) n += 1;
    }
  }
  return n;
}
