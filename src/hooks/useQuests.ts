/**
 * BioForge Quests Domain Hook — gauntlet unlocks + mini-quest state
 * (extracted from App.tsx 2026-10-15 under the push-size trigger:
 * App had hit the whole-file push ceiling, and this block is a
 * clean seam — pure derivation from the pouch plus one latch
 * effect, with all of its inputs passed in).
 *
 * The gauntlet is the early game's progression spine: it starts
 * able to harvest only, and each other tool is a module crafted at
 * the forge (game/quests.ts holds the chain). Unlocks are DERIVED
 * from the pouch — owning a module item is the unlock — with one
 * exception handled by the caller: `grandfathered` worlds (created
 * before the module system existed, plus co-op guests) keep the
 * full tool set they earned under the old rules.
 */

import { useEffect } from 'react';
import type {
  GameNotification,
  ItemId,
  QuestProgressState,
  ToolType,
} from '../types/game';
import {
  QUESTS,
  deriveUnlockedTools,
  questView,
  trackedQuest,
  type QuestProgressView,
} from '../game/quests';

export interface UseQuestsArgs {
  inventory: Record<ItemId, number>;
  grandfathered: boolean;
  questProgress: QuestProgressState | undefined;
  setQuestProgress: (progress: QuestProgressState) => void;
  postNotification: (
    title: string,
    message: string,
    type: GameNotification['type'],
    iconColor: string,
  ) => void;
  hasStarted: boolean;
}

export interface UseQuestsResult {
  unlockedTools: ToolType[];
  questViews: QuestProgressView[];
  trackedView: QuestProgressView | null;
  showQuestHud: boolean;
  updateQuestProgress: (patch: Partial<QuestProgressState>) => void;
}

export function useQuests({
  inventory,
  grandfathered,
  questProgress,
  setQuestProgress,
  postNotification,
  hasStarted,
}: UseQuestsArgs): UseQuestsResult {
  const unlockedTools = deriveUnlockedTools(inventory, grandfathered);
  const questViews = QUESTS.map((def) => questView(def, inventory, unlockedTools));
  const trackedView = trackedQuest(
    questProgress?.completedIds ?? [],
    questProgress?.trackedId ?? null,
    questViews,
  );
  const showQuestHud = questProgress?.showHud ?? false;

  // Quest-progress writes, with silent adoption for veterans: the
  // first time a pre-quest save touches the system, everything its
  // (grandfathered) progress already satisfies is marked complete —
  // no toast parade for a chain finished under the old rules.
  const updateQuestProgress = (patch: Partial<QuestProgressState>): void => {
    if (questProgress) {
      setQuestProgress({ ...questProgress, ...patch });
      return;
    }
    setQuestProgress({
      completedIds: questViews.filter((v) => v.complete).map((v) => v.def.id),
      trackedId: null,
      showHud: false,
      ...patch,
    });
  };

  // Latch quest completions the moment they're earned: gather
  // objectives un-meet when the items get spent, so completion is
  // recorded, not re-derived forever. Veterans (no questProgress)
  // never latch — their adoption above seeds completions silently.
  const latchQuestKey = questProgress
    ? questViews
        .filter((v) => v.complete && !questProgress.completedIds.includes(v.def.id))
        .map((v) => v.def.id)
        .join(',')
    : '';
  useEffect(() => {
    if (!hasStarted || !latchQuestKey || !questProgress) return;
    const doneIds = latchQuestKey.split(',');
    setQuestProgress({
      ...questProgress,
      completedIds: [...questProgress.completedIds, ...doneIds],
    });
    doneIds.forEach((id) => {
      const def = QUESTS.find((q) => q.id === id);
      if (def) {
        postNotification(
          'Mini-Quest Complete',
          `${def.title} — nicely done. Press Q for the quest list and what comes next.`,
          'discover',
          '#34d399',
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latchQuestKey, hasStarted]);

  return { unlockedTools, questViews, trackedView, showQuestHud, updateQuestProgress };
}
