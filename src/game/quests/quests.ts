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

import type { ItemId, ToolType, CraftingRecipe, QuestSignals } from '../../types/game';
import { ITEMS, RECIPES, getRecipeTier, HELMET_GEAR_ITEM_IDS, BOOTS_GEAR_ITEM_IDS } from '../items/constants';
import { WEAPON_ITEM_IDS, anyWeaponOwned } from '../creatures/weapons';
import { FINALE_ROADS, type FinaleFamilyId } from './finale';

/** Every tool the hotbar can hold, in hotbar order. */
export const ALL_TOOLS: ToolType[] = [
  'harvest_glove',
  'bio_scanner',
  'planter_trowel',
  'solvent_sprayer',
  'taming_lure',
  'builder',
  // The seventh slot (Adam, 2026-10-16): the striker, unlocked by
  // owning any of the six grown weapons (game/creatures/weapons.ts).
  'striker',
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
  striker: 'Striker',
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
    // The striker is not a module: it unlocks when ANY grown
    // weapon is owned (it has six possible keys, not one).
    if (tool === 'striker') return anyWeaponOwned(inventory);
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
   * Synthesis. The quest list groups by CHAPTER (Adam: "a list of
   * the same tier mini quests" — the field was renamed from tier to
   * questChapter 2026-10-16; "tier" belongs to crafting). */
  questChapter: 1 | 2 | 3;
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
  // ------------------------------------------------------------------
  // ASK THE WORLD line fields (Adam, 2026-10-16 — the named,
  // swappable quest line; registry: quest-lines.md). The craft
  // chain above uses none of these; a line quest carries an empty
  // gather list and completes on a GOAL STATE instead.
  // ------------------------------------------------------------------
  /** Which named quest line this quest belongs to. Absent = the
   * gauntlet craft chain. */
  line?: string;
  /** The "For those who wander" wink shown in the line's tab —
   * flavor, never a lane or a lock. */
  flavor?: string;
  /** When set, this quest stays SEALED (presentation only, the
   * useQuests chapter rule's sibling) until the named quest
   * completes — the finale waits on What Happened Here. */
  sealedUntil?: string;
  /** When set, the quest completes when this goal state holds in
   * the player's QuestSignals (types/game.ts), evaluated by
   * goalMet() below. */
  completeWhen?: QuestGoal;
  /** Items granted to the pouch the moment the quest latches
   * complete (via the grant callback useQuests receives). */
  rewardItems?: { itemId: ItemId; count: number }[];
  /** One line shown with the completion notice, naming the
   * reward when the reward is not an item — a bond, a page, a
   * state of the world. */
  rewardNote?: string;
}

/**
 * Goal states for line quests (Ask the World v1): each kind reads
 * one field of QuestSignals. New kinds join here as their signal
 * writers land; the latch machinery in useQuests is generic.
 */
export type QuestGoal =
  | { kind: 'ruinEnter' }
  | { kind: 'glyphRuins'; count: number }
  | { kind: 'heart' }
  | { kind: 'zoneHybrid' }
  | { kind: 'zoneTier3' }
  | { kind: 'families'; count: number }
  | { kind: 'dogBond' }
  | { kind: 'vatHatch' }
  | { kind: 'madeMet'; count: number }
  // V2 kinds (2026-10-16): the deferred set's signals, plus the
  // one goal that reads the POUCH instead of the signals record.
  | { kind: 'homeStone' }
  | { kind: 'itemCount'; itemId: ItemId; count: number }
  | { kind: 'tunnel' }
  | { kind: 'homeOrganism' }
  | { kind: 'gardenHarvest' }
  | { kind: 'hum' }
  | { kind: 'walkBack' }
  // The social set (2026-10-16): a witnessed MOMENT — the goal
  // is met when the field-notes book has stamped this note id
  // (App mirrors the witnessed list into the signals). todo/done
  // ride the goal because each species' moment reads differently.
  | { kind: 'witness'; noteId: string; todo: string; done: string }
  // The Departure (D1, 2026-10-17): the finale's single goal —
  // the act itself, latched by whichever family's set-piece
  // carries the player through (finale.ts holds the sort).
  | { kind: 'departure' };

/** Is this goal state true right now? Signal goals read the
 * QuestSignals record; the itemCount goal reads the pouch
 * (questView passes it through — a held set is a held set). */
export function goalMet(
  goal: QuestGoal,
  signals: QuestSignals | undefined,
  inventory?: Record<ItemId, number>,
): boolean {
  const s = signals ?? {};
  switch (goal.kind) {
    case 'ruinEnter': return (s.ruins?.length ?? 0) >= 1;
    case 'glyphRuins': return (s.glyphRuins?.length ?? 0) >= goal.count;
    case 'heart': return s.heart === true;
    case 'zoneHybrid': return s.hybrid === true;
    case 'zoneTier3': return s.tier3 === true;
    case 'families': return (s.families?.length ?? 0) >= goal.count;
    case 'dogBond': return s.dogBonded === true;
    case 'vatHatch': return s.hatched === true;
    case 'madeMet': return (s.madeMet?.length ?? 0) >= goal.count;
    case 'homeStone': return s.homeStone === true;
    case 'itemCount': return (inventory?.[goal.itemId] ?? 0) >= goal.count;
    case 'tunnel': return s.tunnel === true;
    case 'homeOrganism': return s.homeOrganism === true;
    case 'gardenHarvest': return s.gardenHarvest === true;
    case 'hum': return s.hum === true;
    case 'walkBack': return s.walkBack === true;
    case 'witness': return (s.witnessed ?? []).includes(goal.noteId);
    case 'departure': return s.departed === true;
  }
}

/** The live progress line a goal-state quest shows in place of
 * gather checkmarks — where you stand, in plain words. */
export function goalProgressText(
  goal: QuestGoal,
  signals: QuestSignals | undefined,
  inventory?: Record<ItemId, number>,
): string {
  const s = signals ?? {};
  switch (goal.kind) {
    case 'ruinEnter': return (s.ruins?.length ?? 0) >= 1 ? 'You have stood inside a house of the Precursors' : 'Cross the threshold of any ruin';
    case 'glyphRuins': return `Glyph stones read — ${Math.min(s.glyphRuins?.length ?? 0, goal.count)} of ${goal.count} ruins`;
    case 'heart': return s.heart ? 'You have stood at a heart' : 'Reach the deepest room of a ruin';
    case 'zoneHybrid': return s.hybrid ? 'You have stood where two lands meet' : 'Stand in blended country — a hybrid zone';
    case 'zoneTier3': return s.tier3 ? 'You have stood in the wild country' : 'Reach a wild-country family — storm, living, or precursor';
    case 'families': return `Countries stood in — ${Math.min(s.families?.length ?? 0, goal.count)} of ${goal.count}`;
    case 'dogBond': return s.dogBonded ? 'The dog has decided' : 'Win the hearth dog’s decision';
    case 'vatHatch': return s.hatched ? 'Something has woken in the vat' : 'Hatch a creature in the Culture Vat';
    case 'madeMet': return `Made things met — ${Math.min(s.madeMet?.length ?? 0, goal.count)} of ${goal.count}`;
    case 'homeStone': return s.homeStone ? 'The doorstep stone has spoken' : 'Read the carved stone at the spawn remnant';
    case 'itemCount': return `Fate Fragments kept — ${Math.min(inventory?.[goal.itemId] ?? 0, goal.count)} of ${goal.count}`;
    case 'tunnel': return s.tunnel ? 'The tunnel has carried you' : 'Cross through your own BioTunnel';
    case 'homeOrganism': return s.homeOrganism ? 'Your home is a living thing' : 'A heart set down, a hearth grown, a companion in residence';
    case 'gardenHarvest': return s.gardenHarvest ? 'The old soil has answered' : 'Plant in a Precursor Garden and harvest what grows';
    case 'hum': return s.hum ? 'The homestead hums' : 'Hearth, vat, and stores, all running at once';
    case 'walkBack': return s.walkBack ? 'You stood there again' : 'Return on foot to the place the land took you';
    case 'witness': return (s.witnessed ?? []).includes(goal.noteId) ? goal.done : goal.todo;
    case 'departure': {
      if (s.departed) return 'You have gone through — and the way stands open behind you';
      const road = s.finaleFamily ? FINALE_ROADS[s.finaleFamily as FinaleFamilyId] : undefined;
      return road ? road.todo : 'The way out is the one your world’s people took';
    }
  }
}

/**
 * THE CHAIN, in unlock order. Gather lists mirror the module
 * recipes in constants.ts EXACTLY (a test in the gen-lab harness
 * keeps them from drifting apart).
 */
export const QUESTS: QuestDef[] = [
  {
    id: 'q_first_harvest',
    questChapter: 1,
    title: 'First Harvest',
    blurb:
      'Your gauntlet wakes knowing one trick: harvest. Work the glowing lantern ferns — everything you need grows at the homestead — then weave the fixings into a Hand Lantern-Fern, your first light.',
    gather: [
      { itemId: 'soft_fiber', count: 3 },
      { itemId: 'dew_essence', count: 2 },
    ],
    // The pattern every quest follows (Adam, 2026-10-15): the
    // gathers serve a craft, and the craft is the quest's final
    // checkbox. The lantern is the first useful thing those
    // ingredients make (fiber 2 + dew 1 of what's gathered).
    completeItem: 'hand_lantern_fern',
  },
  {
    // The carrying ladder joins the quests (Adam, 2026-10-15):
    // pockets hold 10 of a thing; a woven pouch makes it 25.
    id: 'q_pouch',
    questChapter: 1,
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
    // The ladder's second rung gets its quest (Adam, 2026-10-15:
    // the pouch upgrades should come sooner than later — the
    // satchel's goods are all early-country, so its quest stands
    // right behind the pouch's). Gather list mirrors the recipe.
    id: 'q_satchel',
    questChapter: 1,
    title: 'Bound for More',
    blurb:
      'The Woven Pouch helped. It was not enough. Stiffen a Resin-Bound Satchel with wetland reeds — every stack you carry grows to 50.',
    gather: [
      { itemId: 'resin_sap', count: 4 },
      { itemId: 'resonant_reed', count: 4 },
      { itemId: 'soft_fiber', count: 2 },
    ],
    completeItem: 'resin_satchel',
  },
  {
    // Storage moved UP the chain (Adam, 2026-10-15 — "sooner
    // than later"): it used to wait behind the Builder quest
    // because a pod is only useful once you can place it.
    id: 'q_storage',
    questChapter: 1,
    title: 'A Place for Things',
    blurb:
      'Grow a Storage Pod at the Bio-Forge and set it down by hand — a grown pod needs no Bio-Builder. Click the pod to open it: a home for the surplus, and growth kits make it a Hutch, then a Vault.',
    gather: [
      { itemId: 'resin_sap', count: 4 },
      { itemId: 'soft_fiber', count: 4 },
      { itemId: 'carapace_scale', count: 2 },
    ],
    completeItem: 'storage_pod',
  },
  {
    id: 'q_scanner',
    questChapter: 1,
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
    questChapter: 1,
    title: 'Sow the Future',
    blurb:
      'Compost comes from mature harvests — every grown plant you pick leaves some behind. Craft the Planter Module and start gardening. The trowel does double duty: it sows your seeds and it feeds your garden — fertilizer is applied with the same tool.',
    gather: [
      { itemId: 'soft_fiber', count: 2 },
      { itemId: 'basic_compost', count: 1 },
    ],
    unlockTool: 'planter_trowel',
  },
  {
    id: 'q_builder',
    questChapter: 1,
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
    id: 'q_solvent',
    questChapter: 1,
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
    questChapter: 1,
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
    questChapter: 2,
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
  {
    // The radar thread moved EARLY (Adam, 2026-10-16): it sat at
    // #24 in chapter 3, where nobody met it until the game was
    // nearly done teaching. The radar is a HELMET upgrade with
    // tiers, and the log now says so from chapter 2 — the craft
    // is early-feasible (four tier-1 subassemblies), and the
    // pings wake when the Homestead Helm (chapter 3) is owned.
    id: 'q_radar',
    questChapter: 2,
    title: 'The Keen Eye',
    blurb:
      'Four subassemblies, one instrument. The radar rides in the Homestead Helm — grow it now, and it wakes the day the helm is yours, pinging the places worth walking for.',
    gather: [
      { itemId: 'resonant_antenna_fan', count: 1 },
      { itemId: 'sonar_receiver', count: 1 },
      { itemId: 'chitin_housing', count: 1 },
      { itemId: 'biolume_power_cell', count: 1 },
    ],
    completeItem: 'prismatic_field_radar',
  },
  {
    id: 'q_lifefinder',
    questChapter: 2,
    title: 'The Near Eye',
    blurb:
      'The Keen Eye finds places; the living are nearer and quieter. Grow the Prismatic Lifefinder onto the radar, and the minimap answers for the rare lives too.',
    gather: [
      { itemId: 'resonant_antenna_fan', count: 1 },
      { itemId: 'biolume_power_cell', count: 1 },
      { itemId: 'glow_spore', count: 2 },
      { itemId: 'dew_essence', count: 1 },
    ],
    completeItem: 'prismatic_lifefinder',
  },
  {
    // The ladder's top rung (Adam, 2026-10-15): it waits at the
    // chain's end because its heart is a prismatic core — cave
    // and ruin goods — but it HAS a quest now, so the ladder's
    // top is visible from the climb. Gather list mirrors it.
    id: 'q_rucksack',
    questChapter: 2,
    title: 'The Pack That Breathes',
    blurb:
      'Grow a symbiote pack around a prismatic heart — a Living Rucksack. Every stack you carry grows to 100, and the pack carries a little of itself.',
    gather: [
      { itemId: 'carapace_scale', count: 4 },
      { itemId: 'prismatic_core', count: 1 },
      { itemId: 'soft_fiber', count: 4 },
    ],
    completeItem: 'living_rucksack',
  },
  // ----------------------------------------------------------------
  // CHAPTER 3 — EYES & FEET (published 2026-10-15): the helmet and
  // Quicksteps lines join the chain. Adam's sequencing holds: the
  // gauntlet's story first, the platforms after. Every quest
  // follows the one pattern — gathers mirror its recipe, and the
  // craft itself is the final checkbox (completeItem). The worn
  // EFFECTS land with the platform builds; the paper is live now.
  // ----------------------------------------------------------------
  {
    id: 'q_helm',
    questChapter: 3,
    title: 'Eyes on the Land',
    blurb:
      'The gauntlet acts; the helm will know. Grow a Homestead Helm from hearthlands country — its band carries the basic radar, and every lens you ever grind mounts on it.',
    gather: [
      { itemId: 'carapace_scale', count: 2 },
      { itemId: 'soft_fiber', count: 2 },
      { itemId: 'resin_sap', count: 1 },
    ],
    completeItem: 'homestead_helm',
  },
  {
    id: 'q_trail_lens',
    questChapter: 3,
    title: 'First Words',
    blurb:
      'Grind a Trail Lens and the land starts introducing itself: the family of every country you stand in, named.',
    gather: [
      { itemId: 'sunshard', count: 1 },
      { itemId: 'resin_sap', count: 1 },
    ],
    completeItem: 'trail_lens',
  },
  {
    id: 'q_quicksteps',
    questChapter: 3,
    title: 'Take the Step',
    blurb:
      'Feet last, and not least: grow the Quicksteps — the living set every impediment growth mounts on. Sure footing first; the marsh, the water, and the fire country after.',
    gather: [
      { itemId: 'soft_fiber', count: 3 },
      { itemId: 'resin_sap', count: 2 },
      { itemId: 'dew_essence', count: 1 },
    ],
    completeItem: 'quicksteps',
  },
  {
    id: 'q_waders',
    questChapter: 3,
    title: 'Dry Feet',
    blurb:
      'The Mirror Marsh drags at every step and names its answer in its own alert: Waders. Grow a pair and wade like you mean it.',
    gather: [
      { itemId: 'dew_essence', count: 2 },
      { itemId: 'soft_fiber', count: 1 },
      { itemId: 'resin_sap', count: 1 },
    ],
    completeItem: 'waders',
  },
  {
    id: 'q_stillsteps',
    questChapter: 3,
    title: 'Walk the Water',
    blurb:
      'Stillsteps grow a tension film under the sole. Still water holds you. Walk it.',
    gather: [
      { itemId: 'dew_essence', count: 3 },
      { itemId: 'resin_sap', count: 2 },
    ],
    completeItem: 'stillsteps',
  },
  {
    id: 'q_webfoots',
    questChapter: 3,
    title: "The River's Own",
    blurb:
      'Webfoots: reed-vane webs for the swim. The water stops being an argument.',
    gather: [
      { itemId: 'resonant_reed', count: 2 },
      { itemId: 'soft_fiber', count: 2 },
      { itemId: 'resin_sap', count: 1 },
    ],
    completeItem: 'webfoots',
  },
  {
    id: 'q_ember_soles',
    questChapter: 3,
    title: 'Cross the Fire',
    blurb:
      "The Scar's ground warns you. Ember Soles — obsidian tread in heat-cured resin — answer.",
    gather: [
      { itemId: 'obsidian_shard', count: 2 },
      { itemId: 'resin_sap', count: 1 },
    ],
    completeItem: 'ember_soles',
  },
  {
    id: 'q_spore_filter',
    questChapter: 3,
    title: 'Breathe Easy',
    blurb:
      "The Hollow taxes every breath. A Spore Filter stops the tax at your face.",
    gather: [
      { itemId: 'glow_spore', count: 2 },
      { itemId: 'soft_fiber', count: 1 },
      { itemId: 'resin_sap', count: 1 },
    ],
    completeItem: 'spore_filter',
  },
  {
    id: 'q_biolume_visor',
    questChapter: 3,
    title: 'Light Below',
    blurb:
      'The deep strata are named for darkness. A Biolume Visor reads living light through all of it.',
    gather: [
      { itemId: 'sunshard', count: 2 },
      { itemId: 'glow_spore', count: 2 },
    ],
    completeItem: 'biolume_visor',
  },
  {
    id: 'q_shade_visor',
    questChapter: 3,
    title: 'Against the Glare',
    blurb:
      'The Flats run bright enough to wash the world out. A Shade Visor dims glare country to bearable.',
    gather: [
      { itemId: 'saltglass_shard', count: 1 },
      { itemId: 'resin_sap', count: 1 },
    ],
    completeItem: 'shade_visor',
  },
  {
    id: 'q_identifier',
    questChapter: 3,
    title: 'Name the Country',
    blurb:
      "Every country so far: 'Unidentified.' Grind the Identifier Lens and the land gives up its name — family, variant, and all.",
    gather: [
      { itemId: 'saltglass_shard', count: 2 },
      { itemId: 'prismatic_core', count: 1 },
    ],
    completeItem: 'identifier_lens',
  },
  {
    id: 'q_glyph_lens',
    questChapter: 3,
    title: 'Read the Stones',
    blurb:
      'The glyph stones have been holding back their deep lines. A Glyph Lens reads them first — and ruin caches glow faintly through the walls.',
    gather: [
      { itemId: 'precursor_shard', count: 2 },
      { itemId: 'saltglass_shard', count: 1 },
    ],
    completeItem: 'glyph_lens',
  },
  {
    id: 'q_charge_sight',
    questChapter: 3,
    title: 'Where the Sky Falls',
    blurb:
      'Zots warn by banner today. Charge Sight — fulgurite over a prismatic heart — paints the warned spot on the ground itself.',
    gather: [
      { itemId: 'fulgurite_shard', count: 1 },
      { itemId: 'prismatic_core', count: 1 },
    ],
    completeItem: 'charge_sight',
  },
];

// ============================================================================
// ASK THE WORLD — Potential Quest Line 1 (Adam, 2026-10-16)
// ============================================================================
// A named, swappable quest line (registry: quest-lines.md in the
// design docs). These quests are NOT the craft chain: they carry
// empty gather lists, complete on GOAL STATES (QuestSignals), and
// live in their own array so the chain's sequencing, the harness
// parity checks, and any future line never collide with them.
// Ids carry the line's prefix (q_aw_). Copy source: the developed
// cards in precursor-quests-developed.md — v1 ships the nine
// quests whose signals exist today; the Doorstep Stone (needs
// the spawn remnant) and What Happened Here (needs the fragment
// items) follow when their content lands.
// ============================================================================

/** The line's registry name — views and the Quest Log tab key on it. */
export const ASK_THE_WORLD_LINE = 'ask_the_world';

/** The "made things" for q_aw_made_things: codex species that are
 * clearly GROWN, not evolved (design-curated; extend as species
 * are filed under the Forged/cultivated kinds). */
export const MADE_SPECIES_IDS: string[] = [
  'feral_warden',
  'hearth_dog',
  'lantern_fern',
  'false_greeter',
  'second_tenant',
];

export const ASK_THE_WORLD_QUESTS: QuestDef[] = [
  {
    // M1 — the mystery's on-ramp, disguised as a walk.
    id: 'q_aw_first_door',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For those who wander',
    title: 'First Door',
    blurb:
      'The grown husks of the Precursors stand in every country, and every one of them has a door. Nobody is asking you to open one. But you could.',
    gather: [],
    completeWhen: { kind: 'ruinEnter' },
    rewardItems: [{ itemId: 'precursor_shard', count: 1 }],
    rewardNote: 'A Precursor Shard, from the first room’s dust.',
  },
  {
    // A1 — the dog arrives on its own; the quest is the decision.
    id: 'q_aw_guest_hearth',
    questChapter: 1,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'A Guest at the Hearth',
    blurb:
      'Something has been visiting your hearth. It has not decided about you yet. Feed it when it comes — three kindnesses is what a decision costs.',
    gather: [],
    completeWhen: { kind: 'dogBond' },
    rewardNote: 'The bond itself — and a dog who stays.',
  },
  {
    // E1 — stand where two lands meet.
    id: 'q_aw_two_lands',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For those who wander',
    title: 'Where Two Lands Meet',
    blurb:
      'Wild enough out, the countries stop keeping to themselves. Stand where two lands have grown into one another — the Marches, the blended country — and see a place that is two places.',
    gather: [],
    completeWhen: { kind: 'zoneHybrid' },
    rewardItems: [{ itemId: 'living_thread', count: 1 }],
    rewardNote: 'A Living Thread, found where the lands braid.',
  },
  {
    // X1 — meet the made things.
    id: 'q_aw_made_things',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the scientists',
    title: 'The Made Things',
    blurb:
      'Some of what lives here evolved. Some of it was composed — the fern that burns without flame, the dog that waits at hearths no one built for it. Meet the made things, and count them.',
    gather: [],
    completeWhen: { kind: 'madeMet', count: 5 },
    rewardNote: 'The hypothesis, written in your codex: these were grown by someone.',
  },
  {
    // A2 — the vat's thesis in one quest.
    id: 'q_aw_second_chance',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'Second Chance',
    blurb:
      'What the vat grows from a sample wakes up trusting you. Grow one creature back into the world — and then decide whether it stays at your side or goes free. Both are kindnesses.',
    gather: [],
    completeWhen: { kind: 'vatHatch' },
    rewardNote: 'A life, returned to the world by your hand.',
  },
  {
    // M3 — three ruins, one voice.
    id: 'q_aw_three_stones',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the lore-keepers',
    title: 'Three Stones, One Voice',
    blurb:
      'One ruin mutters. Three ruins, in three countries, are a voice. Read the stones in three different houses of the Precursors and listen for what repeats.',
    gather: [],
    completeWhen: { kind: 'glyphRuins', count: 3 },
    rewardItems: [{ itemId: 'precursor_shard', count: 2 }],
    rewardNote: 'Two Precursor Shards — and three lines that agree.',
  },
  {
    // M4 — the deepest room.
    id: 'q_aw_heart_house',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the lore-keepers',
    title: 'The Heart of the House',
    blurb:
      'Every house of the Precursors keeps one room deeper than the rest, and in it, the thing they could not take with them. Go down and be told.',
    gather: [],
    completeWhen: { kind: 'heart' },
    rewardItems: [{ itemId: 'precursor_shard', count: 1 }],
    rewardNote: 'The heart provides — a Precursor Shard, and its line.',
  },
  {
    // E2 — the wild country.
    id: 'q_aw_rim',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For those who wander',
    title: 'The Rim',
    blurb:
      'Past the familiar families the land turns strange: storms that rain upward, valleys that are hungry, gardens no one tends. Go and stand in the wild country, once.',
    gather: [],
    completeWhen: { kind: 'zoneTier3' },
    rewardItems: [
      { itemId: 'living_thread', count: 2 },
      { itemId: 'prismatic_core', count: 1 },
    ],
    rewardNote: 'A Cache of the Rim — Living Thread and a Prismatic Core.',
  },
  {
    // P1 — every country.
    id: 'q_aw_every_country',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the completionists',
    title: 'Every Country',
    blurb:
      'Eleven families. Eleven weathers of the land. Stand in every one of them — the meadow you know, and the ones you have only heard named.',
    gather: [],
    completeWhen: { kind: 'families', count: 11 },
    rewardItems: [{ itemId: 'prismatic_core', count: 1 }],
    rewardNote: 'A Prismatic Core, for the one who has stood everywhere.',
  },
  // ------------------------------------------------------------------
  // V2 (2026-10-16): the deferred set — the doorstep, the set's
  // completion, and the cards whose signals App can read today.
  // ------------------------------------------------------------------
  {
    // B2 — cross your own tunnel.
    id: 'q_aw_two_mouths',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the builders',
    title: 'Two Mouths, One Animal',
    blurb:
      'A BioTunnel is one creature with a mouth at each end of your life. Grow the pair, step in at home, and step out somewhere that matters.',
    gather: [],
    completeWhen: { kind: 'tunnel' },
    rewardItems: [{ itemId: 'living_thread', count: 1 }],
    rewardNote: 'A Living Thread — and a wild country that knows your name.',
  },
  {
    // S1 — home as an organism.
    id: 'q_aw_home_organism',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the homesteaders',
    title: 'Home Is an Organism',
    blurb:
      'A camp is where you sleep. A home is a living thing that knows your name: a heart set in the ground, a hearth grown, a companion in residence. Make the place that would bring you back from anywhere.',
    gather: [],
    completeWhen: { kind: 'homeOrganism' },
    rewardNote: 'The home is kept — heart, hearth, and resident together.',
  },
  {
    // G1 — the old garden's soil.
    id: 'q_aw_old_garden',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the green thumbs',
    title: 'The Old Garden',
    blurb:
      'In the Precursor Garden the old growers’ soil is still laid out in its spirals, still rich, still patient. Plant something in it. Harvest what their ground makes of your seed.',
    gather: [],
    completeWhen: { kind: 'gardenHarvest' },
    rewardItems: [{ itemId: 'living_thread', count: 2 }],
    rewardNote: 'Living Thread, twice over — the old soil still teaches.',
  },
  {
    // M2 — the stone by the door.
    id: 'q_aw_doorstep',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For those who come home',
    title: 'The Doorstep Stone',
    blurb:
      'There is a carved stone near where you first woke, in the little remnant you have walked past a hundred times. You could not read it then. The Glyph Lens says otherwise now.',
    gather: [],
    completeWhen: { kind: 'homeStone' },
    rewardItems: [{ itemId: 'precursor_shard', count: 2 }],
    rewardNote: 'Two Precursor Shards, from the cache beneath the stone.',
  },
  {
    // N1 — the humming homestead.
    id: 'q_aw_hum',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the engineers',
    title: 'The Humming Homestead',
    blurb:
      'One grown thing is a tool. A hearth lit, a vat breathing, storage holding — that is a system, and a system hums. Bring your home to the hum, once, all of it running together.',
    gather: [],
    completeWhen: { kind: 'hum' },
    rewardItems: [{ itemId: 'prismatic_core', count: 1 }],
    rewardNote: 'A Prismatic Core — the hum, made solid once.',
  },
  {
    // O2 — walk back.
    id: 'q_aw_walk_back',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the survivalists',
    title: 'Walk Back',
    blurb:
      'When the land takes you, you wake at home and your pouch is kind. The place that took you is still out there. Go back to it on foot and stand there again.',
    gather: [],
    completeWhen: { kind: 'walkBack' },
    rewardItems: [{ itemId: 'precursor_shard', count: 1 }],
    rewardNote: 'A Precursor Shard — and having stood there again.',
  },
  {
    // M6 — the assembled truth. The chapter itself is delivered
    // by App at this latch (game/quests/awChapters.ts), naming the
    // world's fate outright — the one earned exception.
    id: 'q_aw_happened',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For whoever is left',
    title: 'What Happened Here',
    blurb:
      'Five fragments. Five houses. Put what they kept in one place, and this world’s story can finally be read whole.',
    gather: [],
    completeWhen: { kind: 'itemCount', itemId: 'aw_fragment', count: 5 },
    rewardNote: 'The chapter itself — and a Listening Shell’s promise. (The Shell comes with the artifacts pass.)',
  },
  {
    // THE FINALE (D1, 2026-10-17): the chapter is the knowing;
    // this is the answering. One quest for all eleven fates —
    // the world's family (finale.ts) names the road on the
    // tracker, and each family's set-piece lands as its own
    // slice and latches the departure this goal reads. Sealed
    // until the story stands read whole: knowing first.
    id: 'q_aw_departure',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For whoever is left',
    title: 'The Departure',
    blurb:
      'Five fragments, one story — and every story in this world ends the same way: with a way out. Your world’s people found theirs. It stands open still, in the shape they left it. Grow it, and go — or stay, and let it stand. Both are answers.',
    gather: [],
    sealedUntil: 'q_aw_happened',
    completeWhen: { kind: 'departure' },
    rewardNote: 'The road itself.',
  },
  // ------------------------------------------------------------------
  // THE SOCIAL SET (2026-10-16): quests for the seven social
  // creatures, authored with the creatures lane's engine slices.
  // Each completes on a WITNESSED moment — the field-notes book's
  // stamp for that species' note — so the quest and the note can
  // never disagree about whether the moment happened.
  // ------------------------------------------------------------------
  {
    // The Gladhand: the Welcoming valley's usher.
    id: 'q_aw_walked_in',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'Walked In',
    blurb:
      'A Welcoming valley has an usher — a Gladhand, all courtesy and long fingers. Let it take your measure and walk you in properly. Some doors you should not open alone.',
    gather: [],
    completeWhen: {
      kind: 'witness',
      noteId: 'note_gladhand',
      todo: 'Be escorted into a Welcoming valley by a Gladhand',
      done: 'The Gladhand walked you in',
    },
    rewardItems: [{ itemId: 'dew_essence', count: 2 }],
    rewardNote: 'Dew Essence — a welcome, in the valley’s own currency.',
  },
  {
    // The Answer Deer: it mirrors the visitor's temperament.
    id: 'q_aw_calm_mirror',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'The Calm Mirror',
    blurb:
      'The Answer Deer shows you your own weather: rush it and it is a storm, come quiet and it comes quiet. Earn its regard the slow way — by being someone a wild thing can stand near.',
    gather: [],
    completeWhen: {
      kind: 'witness',
      noteId: 'note_answer_deer',
      todo: 'Earn an Answer Deer’s regard, calmly',
      done: 'The mirror held still — the deer regards you',
    },
    rewardItems: [{ itemId: 'living_thread', count: 1 }],
    rewardNote: 'A Living Thread — trust, spun fine.',
  },
  {
    // The Heartbearer: the feeding chain's strong back.
    id: 'q_aw_loaded_delivered',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'Loaded and Delivered',
    blurb:
      'A valley is fed at its heart, and the Heartbearer is how food travels: loaded by a friend, delivered on the hoof. Put a meal on its back and let it work — feeding a country is a team sport.',
    gather: [],
    completeWhen: {
      kind: 'witness',
      noteId: 'note_heartbearer',
      todo: 'Load a Heartbearer and see the delivery made',
      done: 'Delivered — the heart has been fed by bearer',
    },
    rewardItems: [{ itemId: 'heart_sap', count: 1 }],
    rewardNote: 'Heart Sap — the valley’s thanks, drawn from its heart.',
  },
  {
    // The Meadowback: a sentinel that answers.
    id: 'q_aw_sentinel',
    questChapter: 2,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'The Sentinel’s Call',
    blurb:
      'Set a Meadowback to watch and it watches with its whole body — and when the land stirs, it calls. Keep one on sentinel until the call comes, and learn what your home sounds like defended.',
    gather: [],
    completeWhen: {
      kind: 'witness',
      noteId: 'note_meadowback',
      todo: 'Keep a Meadowback on sentinel until it calls',
      done: 'The sentinel called — and you heard it',
    },
    rewardItems: [{ itemId: 'soft_fiber', count: 3 }],
    rewardNote: 'Soft Fiber — bedding fit for a guardian.',
  },
  {
    // The Threshold Hound: the Hungry valley's escort. (Re-worded
    // to the creatures lane's beat sheet, 2026-10-16: the stamp
    // fires on an escort SUSTAINED — in or out, the stamp cannot
    // tell them apart — so the card honors the office, not a
    // direction; the game's true verdict beat is the Taster's.)
    id: 'q_aw_verdict',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'The Hound’s Escort',
    blurb:
      'At a Hungry valley’s threshold stands its Hound, and the Hound’s office is passage: take its escort — in through the hungry country or back out of it — and walk a good stretch of the way in its keeping.',
    gather: [],
    completeWhen: {
      kind: 'witness',
      noteId: 'note_threshold_hound',
      todo: 'Be escorted by a Threshold Hound — in or out of the Hungry country',
      done: 'Escorted — the Hound walked with you',
    },
    rewardItems: [{ itemId: 'precursor_shard', count: 1 }],
    rewardNote: 'A Precursor Shard — passage, paid and receipted.',
  },
  {
    // The Taster: where it lingers, the valley is deciding.
    id: 'q_aw_tasters_report',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the animal lovers',
    title: 'The Taster’s Report',
    blurb:
      'The Taster samples visitors the way you sample weather — a lick of the truth, then the report. Earn a favorable one, or survive its shadow: both are the valley telling you what it thinks.',
    gather: [],
    completeWhen: {
      kind: 'witness',
      noteId: 'note_taster',
      todo: 'Receive the Taster’s report — favorable, or its shadow',
      done: 'Reported on — the valley has your flavor now',
    },
    rewardItems: [{ itemId: 'dew_essence', count: 2 }],
    rewardNote: 'Dew Essence — a good report, bottled.',
  },
  {
    // The Spiral Moth: the Untended garden's script.
    id: 'q_aw_reading_untended',
    questChapter: 3,
    line: ASK_THE_WORLD_LINE,
    flavor: 'For the lore-keepers',
    title: 'Reading the Untended',
    blurb:
      'In a garden nobody tends anymore, the Spiral Moths fly backward — against the sun, against sense — and the pattern is a sentence. Stand in an Untended garden and read what the moths are writing.',
    gather: [],
    completeWhen: {
      kind: 'witness',
      noteId: 'note_spiral_moth',
      todo: 'Read the Spiral Moths’ backward tell in an Untended garden',
      done: 'Read — the moths’ sentence, understood',
    },
    rewardItems: [{ itemId: 'precursor_shard', count: 1 }],
    rewardNote: 'A Precursor Shard — for the one who reads moths.',
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
  // The six strikers (Adam, 2026-10-16): grown one-time weapons —
  // same one-copy rule as the modules; a higher tier's craft
  // consumes the lower weapon, so the "already owned" block also
  // keeps retired tiers from being re-grown by accident.
  ...WEAPON_ITEM_IDS,
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
 * graph runs to depth 3 through the Tier 2 power cell. And the
 * pin governs ACCESS too (Adam, same day: "the Field Synthesizer
 * should work on that") — accessTierOf below is what the forge
 * tether reads, so a part labeled Tier 2 is field work, label and
 * lock in agreement. The Field Synthesizer needs no pin: Adam
 * calls it Tier 1, which is what the graph says.
 */
const GEAR_DISPLAY_TIER: Partial<Record<ItemId, number>> = {
  prismatic_field_radar: 2,
  // The shield line (Adam, 2026-10-17): Tier 1 is the plain wall,
  // Tier 2 buys the light, Tier 3 is the Fenback — pinned so the
  // Fenback's recipe is forge-only by the access-tier rule.
  scute_shield: 1,
  lantern_shield: 2,
  fenback_shield: 3,
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

/**
 * The tier the CRAFTING ACCESS rules use for a recipe (the forge
 * tether in BioForgeModal, RecipeFlowchart, and App's craft
 * handler): a gear part's pinned display tier when it has one,
 * else the recipe graph's depth. This is the function that makes
 * Adam's radar ruling true in mechanics, not just on the label —
 * the prismatic radar (display Tier 2) is Field Synthesizer work,
 * while an unpinned Tier 3 recipe stays at the forge.
 */
export function accessTierOf(recipe: CraftingRecipe): number {
  return gearTierOf(recipe.outputId) ?? getRecipeTier(recipe);
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
  /** The quest's final checkbox (Adam, 2026-10-15): every
   * gathering quest exists to craft something, and this line
   * says what — and whether it's been crafted. Null only for a
   * quest with no craft at its end (none in the chain today). */
  completion: { label: string; done: boolean } | null;
  /** Line quests only: the live goal-state line (goalProgressText)
   * the log and tracker show in place of gather checkmarks. */
  progressText?: string | null;
  /** Line quests only: chapter-3 line quests stay sealed until
   * Field Synthesis completes (set by useQuests, which owns the
   * completed list). Sealed is presentation — the latch still
   * records a goal met early. */
  sealed?: boolean;
}

/** Compute a quest's live view from the pouch + unlocked tools. */
export function questView(
  def: QuestDef,
  inventory: Record<ItemId, number>,
  unlockedTools: ToolType[],
  signals?: QuestSignals,
): QuestProgressView {
  const gather = def.gather.map((objective) => {
    const have = inventory[objective.itemId] ?? 0;
    return { ...objective, have, done: have >= objective.count };
  });
  let complete: boolean;
  if (def.completeWhen) {
    // Ask the World line: completion is a goal state, not a craft.
    complete = goalMet(def.completeWhen, signals, inventory);
  } else if (def.unlockTool) {
    complete = unlockedTools.includes(def.unlockTool);
  } else if (def.completeItem) {
    complete = (inventory[def.completeItem] ?? 0) > 0;
  } else {
    complete = gather.every((g) => g.done);
  }
  // The final checkbox line, worded by what the craft is: a
  // module names the tool it unlocks; an item names itself.
  let completion: QuestProgressView['completion'] = null;
  let progressText: string | null = null;
  if (def.completeWhen) {
    progressText = goalProgressText(def.completeWhen, signals, inventory);
    completion = { label: progressText, done: complete };
  } else if (def.unlockTool) {
    completion = {
      label: `Craft the module — unlock ${TOOL_NAMES[def.unlockTool]}`,
      done: complete,
    };
  } else if (def.completeItem) {
    completion = {
      label: `Craft: ${ITEMS[def.completeItem]?.name ?? def.completeItem}`,
      done: complete,
    };
  }
  return { def, gather, complete, completion, progressText };
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
  dismissedId?: string | null,
): QuestProgressView | null {
  const isDone = (v: QuestProgressView) =>
    v.complete || completedIds.includes(v.def.id);
  if (trackedId) {
    const picked = views.find((v) => v.def.id === trackedId);
    if (picked && !isDone(picked)) return picked;
  }
  const front = views.find((v) => !isDone(v)) ?? null;
  // The X on the tracker (Adam, 2026-10-15): when the chain's
  // front quest is the dismissed one, the tracker rests —
  // tracking it again from the quest log brings it back.
  if (front && dismissedId && front.def.id === dismissedId) return null;
  return front;
}
