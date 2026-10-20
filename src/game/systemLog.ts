// ====================================================================
// THE SYSTEM LOG — a device-kept ARCHIVE of what the system
// feed has shown this player (Adam's ruling, 2026-10-20:
// "News, builds, etc. needs to be cumulative, not lost.").
//
// WHY THIS EXISTS: the feed document itself is a noticeboard,
// not a record — it carries at most 20 broadcasts, and an old
// one falls off the moment the operator publishes past it.
// The NewsModal can only ever show what the feed carries
// RIGHT NOW. This module is the memory the feed lacks: every
// time the game accepts a feed document, the hook folds it in
// here (mergeSystemFeed), and what was folded in STAYS — on
// this device, in localStorage, beside the feed's seen-state.
// Expired broadcasts are KEPT: surviving its expiry is the
// archive's whole purpose. Expiry governs the noticeboard;
// the archive remembers.
//
// Like the error log, this transmits nothing and rides no
// save: it is a fact about this screen's history, not about
// the world. And like everything on the feed path, it must
// never throw into the game — a broken archive degrades to
// an empty one, never to a crash.
// ====================================================================

import type { SystemFeed } from './systemFeed';

/** Where the archive lives on the device. Versioned in the
 *  key, as the other device stores are. */
export const SYSTEM_LOG_KEY = 'bioforge.systemLog.v1';

/** The archive's depth: the newest 50 entries (broadcasts
 *  and build stamps together) are kept. Deep enough to hold
 *  months of the operator's rare broadcasts; small enough
 *  to stay a glance, not a library. */
export const SYSTEM_LOG_CAP = 50;

/**
 * One remembered thing. A broadcast is kept whole — the
 * archive shows the words the player was sent, not a
 * pointer back to a feed that has since dropped them.
 * A build entry is just the stamp: the build's own notes
 * travel inside that build, so the archive only needs to
 * remember THAT it arrived (and when this device first
 * saw it). `firstSeenAt` (wall clock, Date.now()) is the
 * archive's ordering: when THIS device first met the thing.
 */
export type SystemLogEntry =
  | {
      kind: 'broadcast';
      id: string;
      date: string;
      title: string;
      body: string;
      priority: 'panel' | 'notice';
      firstSeenAt: number;
    }
  | { kind: 'build'; stamp: string; firstSeenAt: number };

/** The minimal storage shape (the systemFeed seen-state
 *  pattern), so the lab check can drive this with a stub. */
export interface SystemLogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function deviceStorage(): SystemLogStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

/**
 * Read the archive, newest first (the order merge keeps it
 * in). Defensive by contract: poisoned JSON, a non-array,
 * malformed entries — all degrade to the entries that DO
 * parse, or [] if none do. Never throws.
 */
export function readSystemLog(storage: SystemLogStorage | null = deviceStorage()): SystemLogEntry[] {
  try {
    if (!storage) return [];
    const raw = storage.getItem(SYSTEM_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: SystemLogEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      if (typeof e.firstSeenAt !== 'number') continue;
      if (e.kind === 'build') {
        if (typeof e.stamp !== 'string') continue;
        entries.push({ kind: 'build', stamp: e.stamp, firstSeenAt: e.firstSeenAt });
      } else if (e.kind === 'broadcast') {
        if (typeof e.id !== 'string' || typeof e.title !== 'string' || typeof e.body !== 'string') continue;
        entries.push({
          kind: 'broadcast',
          id: e.id,
          date: typeof e.date === 'string' ? e.date : '',
          title: e.title,
          body: e.body,
          priority: e.priority === 'notice' ? 'notice' : 'panel',
          firstSeenAt: e.firstSeenAt,
        });
      }
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Fold one ACCEPTED feed document into the archive. The
 * hook calls this every time a fetch parses successfully —
 * initial pull, poll, and refocus all funnel through it —
 * so "accepted" is the only gate; this function itself is
 * fire-and-forget and NEVER throws.
 *
 * The merge rules:
 * - Every broadcast whose id is unseen is added, stamped
 *   firstSeenAt = now. An already-seen id keeps its ORIGINAL
 *   firstSeenAt — the archive remembers when you FIRST met
 *   it — while its words may refresh in place (the operator
 *   fixing a typo should not resurrect it as new).
 * - Expired broadcasts are merged exactly like live ones:
 *   the archive does not consult `expires` at all (see the
 *   header — surviving expiry is the point).
 * - A non-empty feed.latestBuild with no matching build
 *   entry adds one. An empty stamp adds nothing (there was
 *   a time before the first stamp, and it is not a build).
 * - Afterwards the archive is sorted newest-first and
 *   trimmed to SYSTEM_LOG_CAP.
 *
 * Ordering detail: this merge's NEW entries are placed ahead
 * of the stored ones before the sort, and Array.sort is
 * stable — so entries sharing a firstSeenAt (same-millisecond
 * merges) still order newest-arrival first, and broadcasts
 * keep their feed order within a single document.
 */
export function mergeSystemFeed(feed: SystemFeed): void {
  try {
    const storage = deviceStorage();
    if (!storage) return;
    const now = Date.now();
    const existing = readSystemLog(storage);
    const fresh: SystemLogEntry[] = [];

    if (feed.latestBuild && !existing.some((e) => e.kind === 'build' && e.stamp === feed.latestBuild)) {
      fresh.push({ kind: 'build', stamp: feed.latestBuild, firstSeenAt: now });
    }
    for (const b of feed.broadcasts) {
      const kept = existing.find((e) => e.kind === 'broadcast' && e.id === b.id);
      if (kept && kept.kind === 'broadcast') {
        // Refresh the words in place; firstSeenAt stays the
        // original — mutate the stored copy, not the order.
        kept.date = b.date;
        kept.title = b.title;
        kept.body = b.body;
        kept.priority = b.priority;
      } else if (!fresh.some((e) => e.kind === 'broadcast' && e.id === b.id)) {
        fresh.push({
          kind: 'broadcast',
          id: b.id,
          date: b.date,
          title: b.title,
          body: b.body,
          priority: b.priority,
          firstSeenAt: now,
        });
      }
    }

    const merged = [...fresh, ...existing].sort((a, b) => b.firstSeenAt - a.firstSeenAt);
    storage.setItem(SYSTEM_LOG_KEY, JSON.stringify(merged.slice(0, SYSTEM_LOG_CAP)));
  } catch {
    // Swallowed: the feed path never blocks on its archive.
  }
}
