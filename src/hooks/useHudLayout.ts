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
 * The arrangement is a DISPLAY preference, not world data: it is
 * per-device (Adam plays on his phone and on library PCs, and a
 * layout that suits one screen need not follow him to another), so
 * it persists in localStorage on this device only and never touches
 * the save file. Positions are stored as OFFSETS from each panel's
 * default anchor, so a layout survives resolution changes and the
 * periodic default-layout improvements below.
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
  | 'system';

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
  { id: 'system', label: 'System Messages', blurb: 'The system stream: new-build word and rare messages from the grower (bottom of the left stack). Shown by default — a channel that starts hidden announces nothing.' },
];

export interface HudOffset {
  x: number;
  y: number;
}

interface HudLayoutState {
  hidden: Partial<Record<HudPanelId, boolean>>;
  offsets: Partial<Record<HudPanelId, HudOffset>>;
}

const STORAGE_KEY = 'bioforge.hudLayout.v1';

const EMPTY_LAYOUT: HudLayoutState = { hidden: {}, offsets: {} };

/** Read the saved arrangement once, tolerating anything malformed. */
const loadLayout = (): HudLayoutState => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_LAYOUT;
    const parsed = JSON.parse(raw) as Partial<HudLayoutState>;
    return {
      hidden: parsed.hidden && typeof parsed.hidden === 'object' ? parsed.hidden : {},
      offsets: parsed.offsets && typeof parsed.offsets === 'object' ? parsed.offsets : {},
    };
  } catch {
    return EMPTY_LAYOUT;
  }
};

export interface HudLayout {
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
    setLayout((prev) => ({ ...prev, offsets: { ...prev.offsets, [id]: offset } }));
  }, []);

  const showAll = useCallback(() => {
    setLayout((prev) => ({ ...prev, hidden: {} }));
  }, []);

  const resetPositions = useCallback(() => {
    setLayout((prev) => ({ ...prev, offsets: {} }));
  }, []);

  return { isHidden, offsetOf, setHidden, setOffset, showAll, resetPositions };
};
