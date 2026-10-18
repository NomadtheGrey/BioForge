/**
 * useHudLayout — the player's HUD arrangement (Adam, 2026-10-16).
 *
 * Adam's HUD pass asked for three things that all live here:
 *   1. Every HUD panel can be DRAGGED to a new spot with the mouse.
 *   2. Every HUD panel can be CLOSED with its little ✕.
 *   3. Anything closed comes back from the HUD Options screen (the
 *      OPTIONS button on the pause / Resume overlay), which lists
 *      every panel with an on/off switch.
 *
 * The arrangement is a DISPLAY preference. It began per-device
 * (localStorage only), and it still mirrors there — but since
 * 2026-10-18 it ALSO rides the game save (Adam's pin: 'include
 * UI positions in the save'), so each WORLD remembers its own
 * arrangement and loading the world applies it. The hook is
 * owned by App (hoisted) for exactly that reason: useSaveSession
 * reads the state at save time and calls hydrate() at load when
 * the record carries one; a record without one leaves the
 * device arrangement standing. Positions are stored as OFFSETS
 * from each panel's default anchor, so a layout survives
 * resolution changes and the periodic default-layout
 * improvements below. (When saves optionally move to a DB
 * later, the layout travels inside the payload for free —
 * that is the pin's forward half.)
 */

import { useCallback, useEffect, useState } from 'react';

/** Every HUD element the player can move, hide, and restore. */
export type HudPanelId =
  | 'vitals'
  | 'radar'
  | 'zone'
  | 'session'
  | 'tracker'
  | 'controls'
  | 'notifications'
  | 'quicknav'
  | 'hotbar'
  | 'reticle'
;

export interface HudPanelMeta {
  id: HudPanelId;
  /** The name shown in the HUD Options list. */
  label: string;
  /** One plain line under the name in the Options list. */
  blurb: string;
  /** Reticle is toggle-only: it sits at true screen center and has
   *  no corner grip / ✕ of its own (an ✕ dead-center would cover
   *  the aim point it exists to mark). */
  toggleOnly?: boolean;
}

/**
 * The Options screen's table of contents. This list is the standing
 * registry of HUD elements — when a new panel ships, it joins this
 * list and instantly gains drag / hide / restore behavior through
 * HudPanel + this hook.
 */
export const HUD_PANELS: HudPanelMeta[] = [
  { id: 'vitals', label: 'Bio-Suit Vitals', blurb: 'Health, stamina, and synthesizer energy bars (top-left).' },
  { id: 'radar', label: 'Radar / Minimap', blurb: 'The tactical minimap under the vitals card. Appears only while the Prismatic Field Radar is installed in your helmet.' },
  { id: 'zone', label: 'Zone Name & Sol-Cycle', blurb: 'Current country, biome, and the day / night toggle (top-center).' },
  { id: 'session', label: 'Session Bar', blurb: 'Save, P2P Co-Op, sound, map, full screen, quests, and the guide (top-right).' },
  { id: 'tracker', label: 'Mini-Quest Tracker', blurb: 'The little quest card that follows your tracked mini-quest.' },
  { id: 'controls', label: 'Controls Card', blurb: 'The glanceable everyday-keys card (left side).' },
  { id: 'notifications', label: 'Notifications', blurb: 'Toast messages that slide in at the top-right.' },
  { id: 'quicknav', label: 'Quick Nav', blurb: 'Bio-Forge · Pouch · Codex buttons (bottom bar, left).' },
  { id: 'hotbar', label: 'Tool Hotbar & Left Hand', blurb: 'The 1–7 tool slots and the Left Hand instrument slot (bottom bar, right).' },
  { id: 'reticle', label: 'Center Reticle', blurb: 'The aiming marker at true screen center.', toggleOnly: true },
  // (No 'system' row: the stream panel retired 2026-10-18 —
  // system word rides the co-op chat now. A stored layout
  // carrying the old id just holds a dead key, harmless.)
];

export interface HudOffset {
  x: number;
  y: number;
}

export interface HudLayoutState {
  hidden: Partial<Record<HudPanelId, boolean>>;
  offsets: Partial<Record<HudPanelId, HudOffset>>;
}

const STORAGE_KEY = 'bioforge.hudLayout.v1';

const EMPTY_LAYOUT: HudLayoutState = { hidden: {}, offsets: {} };

/** One offset, proven safe: both components finite numbers.
 *  Anything else — a missing component, a string, NaN, Infinity —
 *  is not an offset at all. (The PR #56 black-screen, second
 *  mechanism: a malformed offset produced a NaN transform, the
 *  panel's rect never moved, and the reachability heal recomputed
 *  the same nudge forever.) */
const isUsableOffset = (v: unknown): v is HudOffset => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Partial<HudOffset>;
  return (
    typeof o.x === 'number' && Number.isFinite(o.x) &&
    typeof o.y === 'number' && Number.isFinite(o.y)
  );
};

/**
 * Validate an arrangement arriving from ANY source — localStorage
 * or a save record written by another build on another machine.
 * Good entries pass through untouched; BAD OFFSET ENTRIES ARE
 * REPAIRED BY DROPPING THEM, so the panel falls back to its
 * default anchor instead of carrying a poisoned position. The
 * shape alone is never trusted — values are proven, entry by
 * entry.
 */
export const sanitizeHudLayout = (raw: unknown): HudLayoutState => {
  if (!raw || typeof raw !== 'object') return EMPTY_LAYOUT;
  const parsed = raw as Partial<HudLayoutState>;
  const offsets: Partial<Record<HudPanelId, HudOffset>> = {};
  if (parsed.offsets && typeof parsed.offsets === 'object') {
    for (const [id, off] of Object.entries(parsed.offsets)) {
      if (isUsableOffset(off)) {
        offsets[id as HudPanelId] = { x: off.x, y: off.y };
      }
    }
  }
  return {
    hidden: parsed.hidden && typeof parsed.hidden === 'object' ? parsed.hidden : {},
    offsets,
  };
};

/** Read the saved arrangement once, tolerating anything malformed. */
const loadLayout = (): HudLayoutState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_LAYOUT;
    return sanitizeHudLayout(JSON.parse(raw));
  } catch {
    return EMPTY_LAYOUT;
  }
};

export interface HudLayout {
  /** The raw arrangement — what the save record carries. */
  state: HudLayoutState;
  /** Replace the arrangement wholesale (world load: the save's
   *  layout becomes the standing one). Persists like any change. */
  hydrate: (next: HudLayoutState) => void;
  isHidden: (id: HudPanelId) => boolean;
  offsetOf: (id: HudPanelId) => HudOffset;
  /** Show or hide one panel (the Options switches and the ✕). */
  setHidden: (id: HudPanelId, hidden: boolean) => void;
  /** Record a drag's resting offset (called live while dragging). */
  setOffset: (id: HudPanelId, offset: HudOffset) => void;
  /** Options screen: bring every panel back at once. */
  showAll: () => void;
  /** Options screen: forget every drag offset; panels go home. */
  resetPositions: () => void;
}

export const useHudLayout = (): HudLayout => {
  const [layout, setLayout] = useState<HudLayoutState>(loadLayout);

  const hydrate = useCallback((next: HudLayoutState) => {
    // Trust nothing about the source: a record from another
    // build on another machine could carry anything, so every
    // arriving arrangement passes the same validator the
    // localStorage loader uses — bad offsets are dropped
    // (repaired to the panel's default anchor), never carried.
    setLayout(sanitizeHudLayout(next));
  }, []);

  // Persist on every change. Drags fire this often, but the payload
  // is a few hundred bytes — cheaper than the bookkeeping of a
  // separate "save on drag end" path, and it means a crash mid-drag
  // still keeps the panel where the player left it.
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch {
      // Private-mode / quota failures just mean the arrangement is
      // session-only; the game must never break over a preference.
    }
  }, [layout]);

  const isHidden = useCallback(
    (id: HudPanelId) => layout.hidden[id] === true,
    [layout.hidden],
  );

  const offsetOf = useCallback(
    (id: HudPanelId) => layout.offsets[id] ?? { x: 0, y: 0 },
    [layout.offsets],
  );

  const setHidden = useCallback((id: HudPanelId, hidden: boolean) => {
    setLayout((prev) => ({ ...prev, hidden: { ...prev.hidden, [id]: hidden } }));
  }, []);

  const setOffset = useCallback((id: HudPanelId, offset: HudOffset) => {
    // THE EQUALITY BAIL (PR #56 commission): a write with the
    // values already standing returns the SAME state object, so
    // nothing re-renders and no effect refires. Without it, a
    // caller recomputing the same instruction every render (a
    // measure-and-nudge effect above all) feeds itself forever —
    // fresh object, fresh render, same instruction, forever.
    // Non-finite values are refused outright: a NaN offset can
    // never be a resting place.
    if (!Number.isFinite(offset.x) || !Number.isFinite(offset.y)) return;
    setLayout((prev) => {
      const cur = prev.offsets[id];
      if (cur && cur.x === offset.x && cur.y === offset.y) return prev;
      return { ...prev, offsets: { ...prev.offsets, [id]: offset } };
    });
  }, []);

  const showAll = useCallback(() => {
    setLayout((prev) => ({ ...prev, hidden: {} }));
  }, []);

  const resetPositions = useCallback(() => {
    setLayout((prev) => ({ ...prev, offsets: {} }));
  }, []);

  return { state: layout, hydrate, isHidden, offsetOf, setHidden, setOffset, showAll, resetPositions };
};
