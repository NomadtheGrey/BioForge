// ====================================================================
// kitLock — the Playtest Kit's lock + the broadcast composer's
// sending arm (System Messages slice 4, Adam's rulings
// 2026-10-18; design record: ReadMeFiles/SYSTEM_MESSAGES.md).
//
// THE LOCK IS A COURTESY SCREEN, and says so: it keeps a
// curious hand (a shared machine, a library PC) out of the
// debug kit. It is NOT a security boundary — its fingerprint
// ships in a public bundle and a determined reader could
// brute a short code. The REAL door is the feed Worker's:
// publishing checks a secret that lives only in the Worker's
// configuration and Adam's head, rotatable in the dashboard
// in seconds. No publish secret ever appears in this file,
// this repo, or any chat.
//
// What ships here is a FINGERPRINT: an iterated FNV-1a hash
// of the dev code (the iteration is deliberate — it makes
// dictionary-grinding a short code meaningfully slower for
// zero cost to the one person typing it). The code itself
// appears NOWHERE in the game. Adam supplies the code; the
// dev lane relays it; the fingerprint constant below is
// the whole swap. (Adam's code was relayed and swapped in
// on 2026-10-18 — the placeholder that preceded it never
// shipped to players.)
//
// UNLOCK IS SESSION-ONLY by default. "Remember this device"
// (Adam's option, his control) stores a flag in localStorage
// — a convenience, documented as such: the flag is exactly
// the public fingerprint, so remembering proves nothing to
// anyone; it simply skips the prompt on Adam's own machines.
// The composer's publish code is NEVER stored: it is typed
// (or carried from this session's unlock) on every send.
// ====================================================================

import { SYSTEM_FEED_URL } from '../game/systemFeed';

const HASH_ROUNDS = 1000;
const HASH_SALT = 'bioforge-kit:';

/** Iterated FNV-1a over the salted code, as hex. */
export function kitCodeFingerprint(code: string): string {
  let h = 0x811c9dc5;
  const input = HASH_SALT + code;
  for (let round = 0; round < HASH_ROUNDS; round++) {
    for (let i = 0; i < input.length; i++) {
      h ^= input.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    // Stir the round counter in so rounds can't collapse.
    h ^= round + 1;
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

/**
 * THE fingerprint that ships. Replaced with the fingerprint
 * of Adam's real dev code when the dev lane relays it —
 * computed by kitCodeFingerprint, pasted here, nothing else
 * changes.
 */
export const KIT_CODE_FINGERPRINT = '029f96a5';

export function kitUnlocks(code: string): boolean {
  return code.length > 0 && kitCodeFingerprint(code) === KIT_CODE_FINGERPRINT;
}

// ----------------------------------------------------------------
// Remember-this-device: a localStorage flag, nothing more.
// ----------------------------------------------------------------
export const KIT_REMEMBER_KEY = 'bioforge.kitUnlock.v1';

export function loadKitRemembered(storage: { getItem(k: string): string | null }): boolean {
  try {
    return storage.getItem(KIT_REMEMBER_KEY) === KIT_CODE_FINGERPRINT;
  } catch {
    return false;
  }
}

export function saveKitRemembered(
  storage: { setItem(k: string, v: string): void; removeItem(k: string): void },
  on: boolean
): void {
  try {
    if (on) storage.setItem(KIT_REMEMBER_KEY, KIT_CODE_FINGERPRINT);
    else storage.removeItem(KIT_REMEMBER_KEY);
  } catch {
    // Private modes degrade to session-only. Fine.
  }
}

// ----------------------------------------------------------------
// The composer's sending arm. The publish code travels in
// the request and is checked by the WORKER against its
// secret — this side only shapes the envelope and reports
// the verdict honestly.
// ----------------------------------------------------------------
export interface BroadcastDraft {
  title: string;
  body: string;
  priority: 'panel' | 'notice';
}

export function buildPublishBody(code: string, draft: BroadcastDraft): Record<string, string> {
  return {
    code,
    title: draft.title.trim(),
    body: draft.body.trim(),
    priority: draft.priority,
  };
}

export type PublishResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function publishBroadcast(code: string, draft: BroadcastDraft): Promise<PublishResult> {
  try {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 6000);
    const res = await fetch(`${SYSTEM_FEED_URL}publish`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(buildPublishBody(code, draft)),
      signal: ctl.signal,
    });
    clearTimeout(timer);
    const doc = (await res.json().catch(() => null)) as { ok?: boolean; id?: string; error?: string } | null;
    if (res.ok && doc?.ok) return { ok: true, id: doc.id ?? '' };
    return { ok: false, error: doc?.error ?? `The feed answered ${res.status}.` };
  } catch {
    return { ok: false, error: 'The feed could not be reached.' };
  }
}
