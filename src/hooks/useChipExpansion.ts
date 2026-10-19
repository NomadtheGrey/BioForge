/**
 * useChipExpansion — the phone HUD's resting state (Adam's
 * brainstorm pick, 2026-10-18: "try the chips").
 *
 * On a phone, every panel open at once IS the problem — the
 * furniture out-bulks the world. So on touch screens the big
 * information panels (vitals, zone, tracker) REST as chips:
 * one-line summaries a thumb can read at a glance. Tapping a
 * chip opens its full card; tapping the card's collapse button
 * (or another chip) folds it back. The state is an ACCORDION —
 * at most one card open at a time, because two open cards is
 * the crowd all over again.
 *
 * The state itself is deliberately tiny and pure (a reducer +
 * two pure readers) so the lab can prove its transitions
 * without rendering anything: expand, switch, fold, rest.
 * It is NOT persisted — a fresh session starts rested, every
 * panel a chip, the world clear. Desktop never chips: the
 * form reader answers 'card' whenever touch mode is off, so
 * the mouse game is pixel-untouched.
 */

import { useCallback, useReducer } from 'react';
import type { HudPanelId } from './useHudLayout';
import type { QuestProgressView } from '../game/quests/quests';
import type { SagaTrackView } from '../components/QuestTracker';

/** The panels that rest as chips on touch. The hotbar and
 *  quicknav are the player's HANDS — always full. The session
 *  bar is already icon-sized. The radar is a map; small is its
 *  nature. These three are the text-heavy crowd. */
export type ChippablePanelId = Extract<HudPanelId, 'vitals' | 'zone' | 'tracker'>;

export type ChipState = ChippablePanelId | null;

export type ChipAction =
  | { type: 'toggle'; id: ChippablePanelId }
  | { type: 'collapse' };

/** The accordion, in one function: toggling the open panel
 *  folds it; toggling a rested one opens it (and folds whatever
 *  was open); collapse folds unconditionally. */
export const chipReducer = (state: ChipState, action: ChipAction): ChipState => {
  switch (action.type) {
    case 'toggle':
      return state === action.id ? null : action.id;
    case 'collapse':
      return null;
  }
};

/** How a panel should render right now: on touch, a chip
 *  unless it is the expanded one; off touch, always the card. */
export const panelForm = (
  touchMode: boolean,
  expanded: ChipState,
  id: ChippablePanelId,
): 'chip' | 'card' =>
  !touchMode || expanded === id ? 'card' : 'chip';

/**
 * The tracker's chip text — what the one line must say.
 * A quest chip names the quest and its NEXT piece of work:
 * the first unfinished gather ("Ribbon Fiber 4/6"); when the
 * gathering is done, the craft that ends the quest; for line
 * quests, their live goal line. A saga chip names the saga
 * and carries its progress line. `nameOf` resolves item names
 * so this stays pure (the HUD passes the ITEMS lookup).
 */
export const trackerChipText = (
  view: QuestProgressView | null,
  saga: SagaTrackView | null | undefined,
  nameOf: (itemId: string) => string,
): { title: string; line: string } | null => {
  if (saga) {
    return { title: saga.title, line: saga.progress };
  }
  if (!view) return null;
  const { def, gather, completion, progressText } = view;
  const next = gather.find((g) => !g.done);
  if (next) {
    return { title: def.title, line: `${nameOf(next.itemId)} ${next.have}/${next.count}` };
  }
  if (progressText) {
    return { title: def.title, line: progressText };
  }
  if (completion) {
    return { title: def.title, line: completion.done ? `${completion.label} ✓` : completion.label };
  }
  return { title: def.title, line: 'Complete' };
};

export interface ChipExpansion {
  expanded: ChipState;
  toggle: (id: ChippablePanelId) => void;
  collapse: () => void;
  form: (touchMode: boolean, id: ChippablePanelId) => 'chip' | 'card';
}

export const useChipExpansion = (): ChipExpansion => {
  const [expanded, dispatch] = useReducer(chipReducer, null);
  const toggle = useCallback((id: ChippablePanelId) => dispatch({ type: 'toggle', id }), []);
  const collapse = useCallback(() => dispatch({ type: 'collapse' }), []);
  const form = useCallback(
    (touchMode: boolean, id: ChippablePanelId) => panelForm(touchMode, expanded, id),
    [expanded],
  );
  return { expanded, toggle, collapse, form };
};
