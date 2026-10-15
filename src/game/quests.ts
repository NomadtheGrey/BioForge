/**
 * BioForge Mini-Quests — the tutorial that is just the game, taught
 * in the order the game deepens (Adam, 2026-10-15).
 *
 * Adam's form decision: "little mini quests that reflect what the
 * player will be doing anyways — harvest lantern fern, those
 * mushrooms, etc. — in order of complexity, tier." So the quest
 * chain IS the gauntlet ladder: the gauntlet starts able to harvest
 * only, and each quest walks the player to the next simple craft
 * that grafts a new function onto it. The final tier-1 quest hands
 * over the taming lure; the tier-2 quest is FIELD SYNTHESIS (the
 * Synthesizer Graft) — crafting away from the Bio-Forge.
 *
 * How progress works (deliberately simple, no event bus):
 * - A quest's GATHER objectives read the pouch live — the tracker
 *   HUD shows a checkmark per ingredient as it lands in the pouch,
 *   exactly the display Adam asked for.
 * - A module quest completes the moment its tool unlocks (the
 *   craft consumed the ingredients, so the gather checks would
 *   un-light; the UNLOCK is the stable truth the quest latches).
 * - The pure gather quest (First Harvest) completes the moment its
 *   counts are all met, and App LATCHES it into
 *   PlayerState.questProgress.completedIds so spending the items
 *   afterwards can't un-complete it.
 *
 * Unlocks are derived, never stored: a tool is unlocked when the
 * player owns its module item (modules are equipment — crafted,
 * kept, never spent), the harvest glove is always unlocked, and
 * worlds created before the module system existed are grandfathered
 * to the full tool set (nobody gets demoted; see App).
 */

import type { ItemId, ToolType } from '../types/game';
import { RECIPES, getRecipeTier, HELMET_GEAR_ITEM_IDS, BOOTS_GEAR_ITEM_IDS } from './constants';

/** Every tool the hotbar can hold, in hotbar order. */
export const ALL_TOOLS: ToolType[] = [
  'harvest_glove',
  'bio_scanner',
  'planter_trowel',
  'solvent_sprayer',
  'taming_lure',
  'builder',
];

/**
 * Tool → the gauntlet module item that unlocks it. The harvest
 * glove is the bare gauntlet's one gift and has no module.
 */
export const MODULE_FOR_TOOL: Partial<Record<ToolType, ItemId>> = {
  bio_scanner: 'gauntlet_scanner_module',
  planter_trowel: 'gauntlet_planter_module',
  builder: 'gauntlet_builder_module',
  solvent_sprayer: 'gauntlet_solvent_module',
  taming_lure: 'gauntlet_lure_module',
};

/** Human tool names for locked-tool messaging. */
export const TOOL_NAMES: Record<ToolType, string> = {
  harvest_glove: 'Harvest Glove',
  bio_scanner: 'Bio-Scanner',
  planter_trowel: 'Planter Trowel',
  solvent_sprayer: 'Solvent Sprayer',
  taming_lure: 'Taming Lure',
  builder: 'Bio-Builder',
};

/**
 * The unlocked tool set, derived from the pouch: the harvest glove
 * always; each other tool when its module item is owned; and the
 * full set when `grandfathered` (a world created before modules
 * existed — its player earned the tools under the old rules).
 */
export function deriveUnlockedTools(
  inventory: Record<ItemId, number>,
  grandfathered: boolean,
): ToolType[] {
  if (grandfathered) return [...ALL_TOOLS];
  return ALL_TOOLS.filter((tool) => {
    const moduleId = MODULE_FOR_TOOL[tool];
    return moduleId === undefined || (inventory[moduleId] ?? 0) > 0;
  });
}

/** One gather objective: hold `count` of an item in the pouch. */
export interface QuestGatherObjective {
  itemId: ItemId;
  count: number;
}

export interface QuestDef {
  id: string;
  /** The gauntlet ladder's bands: 1 = the basic modules, 2 = Field
   * Synthesis. The quest list groups by tier (Adam: "a list of the
   * same tier mini quests"). */
  tier: 1 | 2;
  title: string;
  /** One warm line of direction — a hint, not a lecture. */
  blurb: string;
  /** Ingredients to gather; shown with live checkmarks. */
  gather: QuestGatherObjective[];
  /** When set, the quest completes as this tool unlocks (the
   * module craft). When absent, it completes when every gather
   * objective is met (latched by App). */
  unlockTool?: ToolType;
  /** When set, the quest completes when this ITEM is owned (the
   * pouch upgrade, the storage pod, the Graft). Gather lists still
   * mirror the item's recipe, so the checkmarks lead the way. */
  completeItem?: ItemId;
}

/**
 * THE CHAIN, in unlock order. Gather lists mirror the module
 * recipes in constants.ts EXACTLY (a test in the gen-lab harness
 * keeps them from drifting apart).
 */
export const QUESTS: QuestDef[] = [
  {
    id: 'q_first_harvest',
    tier: 1,
    title: 'First Harvest',
    blurb:
      'Your gauntlet wakes knowing one trick: harvest. Work the glowing lantern ferns — everything you need grows at the homestead.',
    gather: [
      { itemId: 'soft_fiber', count: 3 },
      { itemId: 'dew_essence', count: 2 },
    ],
  },
  {
    // The carrying ladder joins the quests (Adam, 2026-10-15):
    // pockets hold 10 of a thing; a woven pouch makes it 25.
    id: 'q_pouch',
    tier: 1,
    title: 'Room to Breathe',
    blurb:
      'Your pockets hold 10 of anything, and the meadow is generous. Weave a Woven Pouch at the Bio-Forge — every stack you carry grows to 25.',
    gather: [
      { itemId: 'soft_fiber', count: 6 },
      { itemId: 'dew_essence', count: 2 },
    ],
    completeItem: 'woven_pouch',
  },
  {
    id: 'q_scanner',
    tier: 1,
    title: 'Eyes Open',
    blurb:
      'Gather the parts and craft a Scanner Module at the Bio-Forge. Knowing what a thing IS comes before using it.',
    gather: [
      { itemId: 'dew_essence', count: 2 },
      { itemId: 'carapace_scale', count: 1 },
    ],
    unlockTool: 'bio_scanner',
  },
  {
    id: 'q_planter',
    tier: 1,
    title: 'Sow the Future',
    blurb:
      'Compost comes from mature harvests — every grown plant you pick leaves some behind. Craft the Planter Module and start gardening.',
    gather: [
      { itemId: 'soft_fiber', count: 2 },
      { itemId: 'basic_compost', count: 1 },
    ],
    unlockTool: 'planter_trowel',
  },
  {
    id: 'q_builder',
    tier: 1,
    title: 'Raise the Walls',
    blurb:
      'Resin from the sap-weaver binds living wood. Craft the Builder Module and the homestead can grow.',
    gather: [
      { itemId: 'resin_sap', count: 3 },
      { itemId: 'soft_fiber', count: 2 },
    ],
    unlockTool: 'builder',
  },
  {
    // The storage line joins the quests (Adam, 2026-10-15): a home
    // needs a place for things. Sits after the Builder quest
    // because a pod is only useful once you can place it.
    id: 'q_storage',
    tier: 1,
    title: 'A Place for Things',
    blurb:
      'Grow a Storage Pod at the Bio-Forge and place it with the Bio-Builder: a home for the surplus. Click the pod to open it — growth kits make it a Hutch, then a Vault.',
    gather: [
      { itemId: 'resin_sap', count: 4 },
      { itemId: 'soft_fiber', count: 4 },
      { itemId: 'carapace_scale', count: 2 },
    ],
    completeItem: 'storage_pod',
  },
  {
    id: 'q_solvent',
    tier: 1,
    title: 'Nothing Wasted',
    blurb:
      'Craft the Solvent Module. From here on, nothing you build is a mistake — it all dissolves back into your pouch.',
    gather: [
      { itemId: 'dew_essence', count: 2 },
      { itemId: 'resin_sap', count: 1 },
    ],
    unlockTool: 'solvent_sprayer',
  },
  {
    id: 'q_lure',
    tier: 1,
    title: 'Make a Friend',
    blurb:
      'The last basic module: a lure woven sweet. Craft it, and the wildlife stops being scenery.',
    gather: [
      { itemId: 'soft_fiber', count: 2 },
      { itemId: 'dew_essence', count: 2 },
    ],
    unlockTool: 'taming_lure',
  },
  {
    id: 'q_field_synthesis',
    tier: 2,
    title: 'The Forge in Your Hand',
    blurb:
      'Tier 2: graft a miniature bio-forge onto your gauntlet and synthesize tier 1–2 recipes anywhere — Field Synthesis. The homestead stops being a leash.',
    gather: [
      { itemId: 'carapace_scale', count: 3 },
      { itemId: 'resin_sap', count: 3 },
      { itemId: 'dew_essence', count: 2 },
    ],
    // Not a tool unlock — completes when the GRAFT item is owned.
    completeItem: 'gauntlet_synthesizer_upgrade',
  },
];

/** Kept for the gen-lab harness's parity checks. */
export const FIELD_SYNTHESIS_QUEST_ID = 'q_field_synthesis';
export const FIELD_SYNTHESIS_ITEM_ID: ItemId = 'gauntlet_synthesizer_upgrade';

/**
 * One-time gauntlet upgrades (Adam, 2026-10-15): the gauntlet itself
 * plus everything that grafts onto it — the five tool modules and
 * the Field Synthesizer. These are equipment a player owns
 * ONCE: owning one IS wearing it (auto-equipped; there is no equip
 * verb), its function derives from ownership, and its recipe LOCKS
 * while owned so nobody burns ingredients re-crafting a second copy
 * of a maxStack-1 upgrade. The crafting surfaces (BioForgeModal's
 * craft block, RecipeFlowchart's node status) and the pouch
 * (InventoryModal's EQUIPPED marking) all read THIS set, so the rule
 * lives in exactly one place.
 */
export const GAUNTLET_UPGRADE_ITEM_IDS: ItemId[] = [
  'field_synthesizer_gauntlet',
  ...(Object.values(MODULE_FOR_TOOL) as ItemId[]),
  FIELD_SYNTHESIS_ITEM_ID,
];

/** True when `id` is one of the one-time gauntlet upgrades above. */
export function isGauntletUpgrade(id: ItemId): boolean {
  return GAUNTLET_UPGRADE_ITEM_IDS.includes(id);
}

/** True when `id` belongs to any of the three gear platforms. */
export function isGearItem(id: ItemId): boolean {
  return (
    isGauntletUpgrade(id) ||
    HELMET_GEAR_ITEM_IDS.includes(id) ||
    BOOTS_GEAR_ITEM_IDS.includes(id)
  );
}

/**
 * Display-tier pins (Adam, 2026-10-15): an item's tier DERIVES from
 * the recipe graph (getRecipeTier — the same number the forge
 * tether enforces), so a label can never promise what a lock
 * contradicts. The one pinned exception is the prismatic radar:
 * Adam tiers the radar by its LADDER — Tier 1 is the helmet's base
 * wayfinding (the home arrow, even across zones), Tier 2 the
 * prismatic upgrade (creatures + walls) — even though its craft
 * graph runs to depth 3 through the Tier 2 power cell. The label
 * says 2; the graph still governs where it can be assembled (the
 * final assembly stays at the forge). The Field Synthesizer needs
 * no pin: Adam calls it Tier 1, which is what the graph says.
 */
const GEAR_DISPLAY_TIER: Partial<Record<ItemId, number>> = {
  prismatic_field_radar: 2,
};

/**
 * The tier a gear part SHOWS the player, or null when it has none
 * (the Living Gauntlet itself — issued at arrival, never crafted;
 * the pouch prints 'Issued' for it). Derives from the item's recipe
 * unless pinned above.
 */
export function gearTierOf(id: ItemId): number | null {
  const pinned = GEAR_DISPLAY_TIER[id];
  if (pinned !== undefined) return pinned;
  const recipe = RECIPES.find((r) => r.outputId === id);
  if (!recipe) return null;
  return getRecipeTier(recipe);
}

/** Live progress for one gather objective. */
export interface GatherProgress extends QuestGatherObjective {
  have: number;
  done: boolean;
}

export interface QuestProgressView {
  def: QuestDef;
  gather: GatherProgress[];
  /** Derived-complete right now (before any latch): module owned,
   * graft owned, or every gather objective met. */
  complete: boolean;
}

/** Compute a quest's live view from the pouch + unlocked tools. */
export function questView(
  def: QuestDef,
  inventory: Record<ItemId, number>,
  unlockedTools: ToolType[],
): QuestProgressView {
  const gather = def.gather.map((objective) => {
    const have = inventory[objective.itemId] ?? 0;
    return { ...objective, have, done: have >= objective.count };
  });
  let complete: boolean;
  if (def.unlockTool) {
    complete = unlockedTools.includes(def.unlockTool);
  } else if (def.completeItem) {
    complete = (inventory[def.completeItem] ?? 0) > 0;
  } else {
    complete = gather.every((g) => g.done);
  }
  return { def, gather, complete };
}

/**
 * The quest the tracker should show: the player's tracked pick when
 * it's still incomplete, else the first incomplete quest in chain
 * order, else null (chain finished — the tracker rests).
 */
export function trackedQuest(
  completedIds: string[],
  trackedId: string | null,
  views: QuestProgressView[],
): QuestProgressView | null {
  const isDone = (v: QuestProgressView) =>
    v.complete || completedIds.includes(v.def.id);
  if (trackedId) {
    const picked = views.find((v) => v.def.id === trackedId);
    if (picked && !isDone(picked)) return picked;
  }
  return views.find((v) => !isDone(v)) ?? null;
}
