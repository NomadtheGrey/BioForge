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
  ASK_THE_WORLD_QUESTS,
  FIELD_SYNTHESIS_QUEST_ID,
  deriveUnlockedTools,
  questView,
  trackedQuest,
  type QuestDef,
  type QuestProgressView,
} from '../game/quests';

/** Every quest the views serve: the craft chain plus the Ask the
 * World line. The line lives in its own array in game/quests.ts;
 * the latch, tracker, and notifications below are shared
 * infrastructure no line owns (Adam's swap discipline, 2026-10-16). */
const ALL_QUEST_DEFS = [...QUESTS, ...ASK_THE_WORLD_QUESTS];

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
  /** Grants a latched line quest's reward items into the pouch
   * (App wires this to the inventory gain, so pouch caps and the
   * overflow drop apply exactly as for any other gain). Optional:
   * without it, item rewards are simply not granted. */
  grantItems?: (items: { itemId: ItemId; count: number }[]) => void;
  /** Called once per quest at the moment it latches complete
   * (App uses it for the Ask the World chapter delivery — the
   * one completion that is an event, not just a record). */
  onQuestComplete?: (def: QuestDef) => void;
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
  grantItems,
  onQuestComplete,
}: UseQuestsArgs): UseQuestsResult {
  const unlockedTools = deriveUnlockedTools(inventory, grandfathered);
  // Views derive from the pouch AND the goal-state signals; the
  // Ask the World chapter-3 quests stay SEALED (presentation only)
  // until Field Synthesis completes — the latch below still
  // records any goal met early, so a sealed quest completed ahead
  // of its chapter is simply already done when it opens.
  const synthesisDone = (questProgress?.completedIds ?? []).includes(FIELD_SYNTHESIS_QUEST_ID);
  const questViews = ALL_QUEST_DEFS.map((def) => {
    const view = questView(def, inventory, unlockedTools, questProgress?.signals);
    if (def.line && def.questChapter === 3 && !synthesisDone) {
      return { ...view, sealed: true };
    }
    return view;
  });
  const trackedView = trackedQuest(
    questProgress?.completedIds ?? [],
    questProgress?.trackedId ?? null,
    questViews,
    questProgress?.dismissedId ?? null,
  );
  // The tracker shows at first (Adam, via the HUD lane, 2026-10-16):
  // a new player's quest tracker is visible until they turn it off
  // in the quest log — the default lives here and in the adoption
  // seed below, nowhere else.
  const showQuestHud = questProgress?.showHud ?? true;

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
      showHud: true,
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
      const def = ALL_QUEST_DEFS.find((q) => q.id === id);
      if (def) {
        onQuestComplete?.(def);
        // Line quests grant their reward at the latch: items into
        // the pouch (through App's grant callback), and the note
        // rides the completion notice so the player hears what
        // the world gave back.
        if (def.rewardItems && def.rewardItems.length > 0) {
          grantItems?.(def.rewardItems);
        }
        postNotification(
          def.line ? 'Invitation Complete' : 'Mini-Quest Complete',
          def.line
            ? `${def.title} — ${def.rewardNote ?? 'nicely done.'}`
            : `${def.title} — nicely done. Press Q for the quest list and what comes next.`,
          'discover',
          '#34d399',
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latchQuestKey, hasStarted]);

  return { unlockedTools, questViews, trackedView, showQuestHud, updateQuestProgress };
}
