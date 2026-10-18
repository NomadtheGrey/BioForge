// ====================================================================
// CLOUD SAVES — the game side of the mirror (Adam's design,
// 2026-10-18; spec: ~/workspace/bioforge-saves/PHASE2.md).
//
// THE LAWS (Adam's): opt-in only, forever — nothing here runs
// for a player who didn't turn it on; the LOCAL save is the
// master and the cloud a mirror — this module only ever READS
// the local record to send it up, and brings a world down only
// when the player picks it by hand at the start-screen door;
// no silent overwrites in either direction (the box parks
// displaced copies server-side; imports land as NEW local
// saves, never over an existing one).
//
// THE WORDS: the passphrase is THREE WORDS from
// game/cloudWords.ts, drawn in the player's own browser. The
// box (Worker bioforge-saves) never sees storage addressed by
// anything but the words' SHA-256 fingerprint, and its
// guess-throttle (per-address + global budgets, residents
// exempt) is what makes three words enough — the same trade
// a bank PIN makes with its lockout. The words are the ONLY
// key: there is no account and no recovery, and the UI says
// so in plain words before a player relies on them.
//
// This module is deliberately dumb: pure functions + fetch
// wrappers that NEVER throw (a dead network is a quiet
// "waiting", never an error in the player's face). The seat
// (start screen) and the mirror hook (save points) live in
// their own places and call in here.
// ====================================================================

import { CLOUD_WORDS } from './cloudWords';
import type { SavedGameRecord } from './saveSystem';

/** The box's address — a sibling Worker to the game and the
 *  feed; saves live in their own KV namespace there. */
export const CLOUD_SAVES_URL = 'https://bioforge-saves.nomadthegrey71.workers.dev';

/** Where this device remembers the player's words after
 *  opt-in (localStorage — the same trust class as the
 *  Playtest Kit's remember flag: this device, this browser,
 *  readable by the player, never sent anywhere but the box,
 *  and only ever as the request's secret header). */
export const CLOUD_WORDS_STORAGE_KEY = 'bioforge.cloudWords.v1';

/** The mirror's last successful trip up (epoch ms), kept in
 *  localStorage so the start screen's row can say "last
 *  copy up: …" as a fact rather than a promise. */
export const CLOUD_LAST_SYNC_KEY = 'bioforge.cloudLastSync.v1';

/** Stamp a successful mirror trip (called by the save
 *  funnel's mirror line; failure to stamp is harmless). */
export function noteCloudSyncSuccess(): void {
  try {
    window.localStorage.setItem(CLOUD_LAST_SYNC_KEY, String(Date.now()));
  } catch { /* the stamp is a courtesy, never a gate */ }
}

/**
 * The canonical passphrase: lowercase, single spaces,
 * exactly three list-shaped words (3–8 letters each). The
 * forgiving door — "Oak  FERN star" and "oak fern star" are
 * the same words. Returns null for anything that isn't a
 * three-word passphrase, so a typo reads as "no worlds
 * under those words" rather than an error.
 */
export function canonicalizePassphrase(input: string): string | null {
  const words = input.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length !== 3) return null;
  if (!words.every((w) => /^[a-z]{3,8}$/.test(w))) return null;
  return words.join(' ');
}

/** Draw three fresh words. (The modulo on a 32-bit draw is
 *  biased by less than one part in half a million at this
 *  list size — noted, accepted, and irrelevant beside the
 *  throttle.) */
export function generatePassphrase(): string {
  const draw = new Uint32Array(3);
  crypto.getRandomValues(draw);
  return Array.from(draw, (n) => CLOUD_WORDS[n % CLOUD_WORDS.length]).join(' ');
}

/** This device's remembered words, or null when cloud saves
 *  are off here. A stored value that no longer canonicalizes
 *  reads as off (never as a broken key). */
export function storedPassphrase(): string | null {
  try {
    const raw = window.localStorage.getItem(CLOUD_WORDS_STORAGE_KEY);
    return raw ? canonicalizePassphrase(raw) : null;
  } catch {
    return null;
  }
}

/** Remember (or forget, on null) this device's words. */
export function storePassphrase(secret: string | null): void {
  try {
    if (secret) window.localStorage.setItem(CLOUD_WORDS_STORAGE_KEY, secret);
    else window.localStorage.removeItem(CLOUD_WORDS_STORAGE_KEY);
  } catch { /* a browser that refuses storage simply stays off */ }
}

// ----------------------------------------------------------------
// The box's doors. Every wrapper resolves null/false on ANY
// failure — offline, throttled, a malformed answer — because
// the mirror must never interrupt the game it mirrors.
// ----------------------------------------------------------------

/** One world as the box's index lists it (meta only). */
export interface CloudIndexEntry {
  slot: string;
  name: string;
  seed: string | null;
  updatedAt: string;
  size: number;
}

async function cloudFetch(secret: string, path: string, init?: RequestInit): Promise<Response | null> {
  try {
    const res = await fetch(`${CLOUD_SAVES_URL}${path}`, {
      ...init,
      headers: { 'x-bioforge-secret': secret, ...(init?.headers ?? {}) },
    });
    return res;
  } catch {
    return null;
  }
}

/** The player's cloud world list; [] for words with no
 *  worlds yet; null when the box couldn't be reached. */
export async function cloudIndex(secret: string): Promise<CloudIndexEntry[] | null> {
  const res = await cloudFetch(secret, '/index');
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as { saves?: CloudIndexEntry[] };
    return Array.isArray(body.saves) ? body.saves : null;
  } catch {
    return null;
  }
}

/** The envelope the box stores, built from a local record —
 *  the record travels VERBATIM inside it (the box never
 *  re-serializes; byte-identical round-trips are its law). */
export function buildCloudEnvelope(record: SavedGameRecord): Record<string, unknown> {
  return {
    v: 1,
    slot: record.id,
    name: record.name,
    seed: record.worldSeed,
    updatedAt: new Date(record.savedAt || Date.now()).toISOString(),
    record,
  };
}

/** Send one local record up. True when the box took it. */
export async function cloudPutSave(secret: string, record: SavedGameRecord): Promise<boolean> {
  const res = await cloudFetch(secret, '/save', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(buildCloudEnvelope(record)),
  });
  return !!res && res.ok;
}

/** Bring one world down: the stored record, or null. The
 *  caller (the door) lands it as a NEW local save — this
 *  function never writes anything local itself. */
export async function cloudGetRecord(secret: string, slot: string): Promise<SavedGameRecord | null> {
  const res = await cloudFetch(secret, `/save?slot=${encodeURIComponent(slot)}`);
  if (!res || !res.ok) return null;
  try {
    const body = (await res.json()) as { record?: SavedGameRecord };
    const record = body.record;
    if (!record || typeof record.id !== 'string' || !record.world) return null;
    return record;
  } catch {
    return null;
  }
}

/** Remove one world from the cloud (the explicit-only
 *  delete; the local list's delete never reaches up here). */
export async function cloudDeleteSave(secret: string, slot: string): Promise<boolean> {
  const res = await cloudFetch(secret, `/save?slot=${encodeURIComponent(slot)}`, { method: 'DELETE' });
  return !!res && res.ok;
}
