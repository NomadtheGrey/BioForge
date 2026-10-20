// ====================================================================
// THE ERROR LOG — a small, device-kept record of the game's
// own stumbles (Adam's ruling, 2026-10-20).
//
// WHY THIS EXISTS: BioForge has no telemetry and wants none —
// nothing in this module transmits anything, ever. When a
// player's game breaks, the only witness used to be the
// player. Now the game keeps the last 50 errors ON THE DEVICE
// (localStorage, like the system feed's seen-state — a fact
// about the screen, never about the world, so it never rides
// a save), and the player can attach them to a feedback note
// with one tap. The player stays the one who sends; this is
// a notebook, not a phone-home.
//
// THE FIRST LAW OF A LOGGER: it must never make things worse.
// Every function here swallows its own failures — storage
// full, storage blocked, poisoned JSON from an older bug,
// no storage at all. A logger that can crash the game is
// worse than no logger, so recordError NEVER throws.
// ====================================================================

import { BUILD_ID } from './buildNotes';

/** Where the log lives on the device. Versioned in the key,
 *  so a future shape change starts a fresh notebook instead
 *  of migrating a broken one. */
export const ERROR_LOG_KEY = 'bioforge.errorLog.v1';

/** The ring's size: the last 50 stumbles are kept; older
 *  ones fall off the end. Fifty is plenty to diagnose from
 *  and small enough to paste into a feedback note. */
export const ERROR_LOG_CAP = 50;

/** Per-entry trims, applied at record time: a runaway error
 *  message or a minified stack must not crowd out the other
 *  49 entries (or bloat the feedback note it rides in). */
const MESSAGE_MAX_CHARS = 500;
const STACK_MAX_CHARS = 2000;

/** How an error arrived:
 *  - 'error'     — the window 'error' listener (uncaught throw)
 *  - 'rejection' — the 'unhandledrejection' listener (a promise
 *                  failed with no catch — the classic silent one)
 *  - 'boundary'  — a React error boundary caught a render crash
 *                  (HudErrorBoundary records with this kind) */
export type ErrorLogKind = 'error' | 'rejection' | 'boundary';

export interface ErrorLogEntry {
  /** Wall-clock stamp (Date.now()) — when it happened on
   *  the player's own clock. */
  at: number;
  /** The running build's stamp (BUILD_ID) — which version
   *  stumbled. An error without its build is half a report. */
  build: string;
  kind: ErrorLogKind;
  message: string;
  stack?: string;
}

/** The minimal storage shape (the same pattern systemFeed
 *  uses for its seen-state) so the lab check can drive this
 *  module with a stub instead of a browser. */
export interface ErrorLogStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** This device's localStorage, or null where there is none
 *  (server, tests, exotic embeddings). Even READING the
 *  global can throw in sandboxed frames — hence the try. */
function deviceStorage(): ErrorLogStorage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

const KINDS: ErrorLogKind[] = ['error', 'rejection', 'boundary'];

/**
 * Read the stored entries, oldest first (storage order —
 * newest is LAST; renderers that want newest first reverse,
 * as formatErrorLog does). Defensive by contract: poisoned
 * JSON, a non-array, malformed entries — all degrade to the
 * entries that DO parse, or [] if none do. Never throws.
 */
export function readErrorLog(storage: ErrorLogStorage | null = deviceStorage()): ErrorLogEntry[] {
  try {
    if (!storage) return [];
    const raw = storage.getItem(ERROR_LOG_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries: ErrorLogEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const e = item as Record<string, unknown>;
      if (typeof e.at !== 'number' || typeof e.message !== 'string') continue;
      entries.push({
        at: e.at,
        build: typeof e.build === 'string' ? e.build : '',
        kind: KINDS.includes(e.kind as ErrorLogKind) ? (e.kind as ErrorLogKind) : 'error',
        message: e.message,
        stack: typeof e.stack === 'string' ? e.stack : undefined,
      });
    }
    return entries;
  } catch {
    return [];
  }
}

/**
 * Append one error to the ring. Trims message and stack,
 * stamps the entry with the wall clock and the running
 * build, drops the oldest entries past the cap, and writes
 * the ring back. NEVER throws — see the first law above.
 * Called from the global listeners below, and (with kind
 * 'boundary') from the HUD's error boundary.
 */
export function recordError(input: { kind: ErrorLogKind; message: string; stack?: string }): void {
  try {
    const storage = deviceStorage();
    if (!storage) return;
    const entry: ErrorLogEntry = {
      at: Date.now(),
      build: BUILD_ID,
      kind: input.kind,
      message: String(input.message ?? 'Unknown error').slice(0, MESSAGE_MAX_CHARS),
    };
    if (typeof input.stack === 'string' && input.stack.length > 0) {
      entry.stack = input.stack.slice(0, STACK_MAX_CHARS);
    }
    const entries = readErrorLog(storage);
    entries.push(entry);
    while (entries.length > ERROR_LOG_CAP) entries.shift(); // the ring: oldest falls off
    storage.setItem(ERROR_LOG_KEY, JSON.stringify(entries));
  } catch {
    // Swallowed, deliberately and completely: a full disk or
    // a blocked store costs us a log entry, never the game.
  }
}

/**
 * The log as one plain-text block, ready to be attached to
 * a feedback note (the FeedbackModal's log line rides this).
 * Newest first — the most recent stumble is the one a
 * diagnosis starts from. One block per entry: ISO time,
 * build, kind, message, and the stack when there is one.
 * Defaults to the stored log; an explicit list may be given.
 */
export function formatErrorLog(entries: ErrorLogEntry[] = readErrorLog()): string {
  const blocks: string[] = [];
  for (const e of [...entries].reverse()) {
    const head = `[${new Date(e.at).toISOString()}] build ${e.build || 'unknown'} (${e.kind})`;
    blocks.push(e.stack ? `${head}\n${e.message}\n${e.stack}` : `${head}\n${e.message}`);
  }
  return blocks.join('\n\n');
}

// ----------------------------------------------------------------
// The global listeners. Two channels catch almost everything
// a render boundary can't: an uncaught throw anywhere in the
// game loop, and a promise that rejected with nobody listening
// (the silent killer — no crash, just a feature quietly dead).
// ----------------------------------------------------------------
let captureInstalled = false;

/** A promise's rejection reason, as a message worth reading:
 *  an Error speaks for itself; anything else is described
 *  as best it can be without ever throwing while describing. */
function describeReason(reason: unknown): { message: string; stack?: string } {
  if (reason instanceof Error) return { message: reason.message, stack: reason.stack };
  if (typeof reason === 'string') return { message: reason };
  try {
    return { message: JSON.stringify(reason) ?? String(reason) };
  } catch {
    return { message: String(reason) };
  }
}

/**
 * Register the window 'error' and 'unhandledrejection'
 * listeners that feed recordError. IDEMPOTENT: calling it
 * on every mount is safe — the flag flips before anything
 * can re-enter, so a second call registers nothing. Safe
 * outside a browser (no window → no-op). Never throws.
 */
export function installErrorCapture(): void {
  if (captureInstalled) return;
  captureInstalled = true;
  try {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    window.addEventListener('error', (event: ErrorEvent) => {
      const err = event.error instanceof Error ? event.error : null;
      recordError({
        kind: 'error',
        message: event.message || err?.message || 'Unknown error',
        stack: err?.stack,
      });
    });
    window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
      const { message, stack } = describeReason(event.reason);
      recordError({ kind: 'rejection', message, stack });
    });
  } catch {
    // Same first law: if the net itself cannot be hung,
    // the game plays on without it.
  }
}
