/**
 * BioForge Tool Interactions Domain Hook
 * Encapsulates non-lethal harvesting, scanning, planting, solvent deconstruction, and taming
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useCallback, useRef } from 'react';
import {
  FloraEntity,
  FaunaEntity,
  StructureEntity,
  HoverTarget,
  ToolType,
  StructureType,
  ItemId,
  CodexEntry,
  GameNotification,
} from '../types/game';
import { ITEMS } from '../game/items/constants';
import { TUNNEL_MAX_MOUTHS } from '../game/world/tunnel';
import {
  noteById, noteIdsForSpecies, windowNoteIdForSpecies,
  type FieldNotesState,
} from '../game/knowledge/fieldNotesBook';
import type { AsksEventInput } from '../game/quests/asksBackState';
import { createSeededRandom, hashStringToSeed } from '../game/engine/motion';
import { ruinLoreLine } from '../game/world/ruinInterior';
import { soundEngine } from '../audio/soundEngine';
import { multiplayerManager } from '../game/multiplayer';
import { FLORA_MATURE_SECONDS, FERTILIZER_DURATION_SECONDS } from './useWorldEntities';
import { speciesDef } from '../game/creatures/species';
import { sampleItemId, vatKitFor } from '../game/structures/vat';
import { storageKitFor } from '../game/items/pouch';
import { bestWeapon } from '../game/creatures/weapons';
import type { WeaponDef } from '../game/creatures/weapons';
import { floraDef } from '../game/flora/flora';
import { GROUND_LAYER_TYPES, isEdgePanel, isLadder, occupancyConflict, placementFor } from '../game/structures/placement';
/** S6 Movable Vaults: the inert-kit gate reads the live carry state. */
import type { CarryState } from '../game/structures/movableVaults';

// A new plant must be at least this far (meters) from every existing one —
// anything closer is a stack of seedlings on one spot, not a garden.
const MIN_PLANT_SPACING = 1.0;

// Render a collection ledger ("2x Soft Fiber, 1x Dew Essence") for
// harvest/dissolve notifications, so every item that lands in the pouch
// is visible in the message — seeds and spores included.
const formatCollected = (collected: Map<ItemId, number>): string =>
  [...collected.entries()]
    .map(([id, n]) => `${n}x ${ITEMS[id]?.name || id}`)
    .join(', ');

// Ruin cache loot (P4 interior): SEEDED BY THE CACHE'S ID, so the
// host and every guest who could click it agree on what was inside —
// no sync message carries loot. Depth band fattens the table: shallow
// caches hold surface composites; deep ones hold cavern crystals and,
// sometimes, a radar subassembly the precursors left behind.
const RUIN_CACHE_POOLS: Record<'shallow' | 'mid' | 'deep', ItemId[]> = {
  shallow: ['resin_sap', 'soft_fiber', 'dew_essence', 'carapace_scale'],
  mid: ['resin_sap', 'dew_essence', 'carapace_scale', 'sunshard'],
  deep: ['carapace_scale', 'dew_essence', 'sunshard', 'violet_prism'],
};
const RUIN_SUBASSEMBLIES: ItemId[] = ['resonant_antenna_fan', 'sonar_receiver', 'chitin_housing', 'biolume_power_cell'];
const rollRuinCacheLoot = (cacheId: string, band: 'shallow' | 'mid' | 'deep'): [ItemId, number][] => {
  const rng = createSeededRandom(hashStringToSeed(`ruin-cache:${cacheId}`));
  const pool = RUIN_CACHE_POOLS[band];
  const picks = band === 'shallow' ? 2 : 3;
  const loot = new Map<ItemId, number>();
  for (let i = 0; i < picks; i++) {
    const item = pool[Math.floor(rng() * pool.length)];
    loot.set(item, (loot.get(item) ?? 0) + 1 + Math.floor(rng() * 2));
  }
  // Deep caches: one time in four, a precursor subassembly survived.
  if (band === 'deep' && rng() < 0.25) {
    const sub = RUIN_SUBASSEMBLIES[Math.floor(rng() * RUIN_SUBASSEMBLIES.length)];
    loot.set(sub, (loot.get(sub) ?? 0) + 1);
  }
  return [...loot.entries()];
};

// Taming odds per lure attempt live in the SPECIES TABLE now
// (game/creatures/species.ts — creature build phase, slice 1, 2026-10-15): the
// puff's 0.8, the mouse's 0.6, and the stalker's 0.25 moved there with
// every other species' design values, so a new species tames by
// gaining an entry, not a constant and a branch. The rule is
// unchanged: the bait is eaten either way — a failed attempt is a
// snack, not a refund.

export interface UseToolInteractionsParams {
  activeTool: ToolType;
  selectedStructureType: StructureType;
  selectedSeedId: ItemId;
  selectedFertilizerId: ItemId;
  inventory: Record<ItemId, number>;
  structuresList: StructureEntity[];
  floraList: FloraEntity[];
  addInventoryItem: (itemId: ItemId, count?: number) => void;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  hasItem: (itemId: ItemId, minCount?: number) => boolean;
  resetFloraHarvest: (floraId: string, regrowthDuration: number) => void;
  applyFloraFertilizer: (floraId: string, type: 'growth' | 'yield') => void;
  // Feeding the valley (Living, 2026-10-15): App owns the
  // satiation deadline; feeding a heartbloom pushes it forward.
  valleySatiatedUntilRef: { current: number };
  addFlora: (flora: FloraEntity) => void;
  addStructure: (structure: StructureEntity) => void;
  /** Replace a structure in place (the vat's pattern) — the
   *  banner's dye writes through here. */
  upsertStructure: (structure: StructureEntity) => void;
  removeStructure: (structureId: string) => void;
  removeFlora: (floraId: string) => void;
  /** Player facing snapped to 90° steps — placed structures inherit it. */
  getPlacementRotation: () => number;
  /** Live player position — ceiling placement reads the player's side of a wall. */
  getPlayerPosition: () => { x: number; z: number };
  /** The story the player stands on (ladder climbs read it). */
  getPlayerLevel: () => number;
  /** Move the player to another story (ladder climbs). */
  applyPlayerLevel: (level: number) => void;
  /** Step through a cave mouth into its instanced cavern (App owns the
   *  transition: entity swap, engine cavern, teleport). */
  onEnterCave: (mouth: StructureEntity) => void;
  /** Step through a cave exit back to the surface. */
  onExitCave: () => void;
  /** Step down a cave descent shaft to the next depth level. */
  onDescendCave: (descent: StructureEntity) => void;
  /** Climb a vine shaft straight from a deep cavern level to the
   *  surface (App owns the transition). */
  onVineClimb: (shaft: StructureEntity) => void;
  /** Step through a ruin landmark into its instanced interior (App
   *  owns the transition: entity swap, engine ruin, teleport). */
  onEnterRuin: (landmark: StructureEntity) => void;
  /** Step through a ruin threshold back to the surface landmark. */
  onExitRuin: () => void;
  /** Which instance the player is inside, if any — building is
   *  refused in both, planting is refused in ruins outright and
   *  restricted to glow spores in caverns. */
  instanceKind: () => 'surface' | 'cavern' | 'ruin';
  tameFauna: (faunaId: string, customName: string, state: FaunaEntity['state']) => void;
  hearthFeed: (faunaId: string) => number;
  loadHeartbearer: (faunaId: string, item: ItemId) => number;
  /** The day/night clock, read at click time (slice 40): App's
   *  cycle via its latest-state mirror — 0.25 sunrise, 0.5 noon,
   *  0.75 sunset, 0 midnight. */
  getDayNightCycle: () => number;
  setFaunaCommand: (faunaId: string, cmd: 'follow' | 'stay' | 'guard') => void;
  /** Ask App to confirm a RELEASE (Adam, 2026-10-15): the cycle's
   *  guarded fourth stop — never applied by the click itself. */
  onRequestRelease: (fauna: FaunaEntity) => void;
  /** Ask the World line signals (Adam, 2026-10-16): a glyph stone
   *  was read — the argument is the glyph structure's id, from
   *  which App derives which ruin it stands in. Optional; absent
   *  means the line simply never hears about it. */
  onGlyphRead?: (glyphStructureId: string) => void;
  /** Ask the World line signals: an artifact heart was opened. */
  onHeartReached?: () => void;
  /** Ask the World line signals: a flora harvest succeeded (the
   * yields are already in the pouch when this fires). */
  onFloraHarvest?: (flora: FloraEntity) => void;
  /** Stamp a wild creature with the solvent's emergency dissolve
   *  (Adam, 2026-10-16); gating lives with the sim (useWorldEntities). */
  applyDissolve: (faunaId: string) => void;
  /** The strikers (weapons build, Adam, 2026-10-16): a close hit
   *  lands through the sim; a ranged shot enters its projectile
   *  ledger. Gating (companions, Peaceful) lives with the sim. */
  strikeFauna: (faunaId: string, damage: number, flinchSeconds: number) => void;
  fireProjectile: (shot: { targetId: string; aimX: number; aimZ: number; damage: number; burstRadius?: number; travelSeconds: number }) => void;
  /** Which draw the striker slot holds — App owns it ('close' |
   *  'ranged'); the drawn weapon derives from the pouch + this. */
  strikerDrawRef: { current: 'close' | 'ranged' };
  /** Pay stamina for a strike; false when too winded. App owns
   *  stamina (the loop's ref), bridged here. */
  spendStamina: (amount: number) => boolean;
  /** The visible shot: a tracer from the player to (x, z). */
  triggerShotFx: (x: number, z: number, burst: boolean) => void;
  /** The landed close hit's burst at the struck creature. */
  triggerStrikeHitFx: (x: number, z: number) => void;
  setCodexList: React.Dispatch<React.SetStateAction<CodexEntry[]>>;
  fieldNotesState: FieldNotesState;
  unlockFieldNotes: (noteIds: string[]) => void;
  recordFieldWitness: (noteId: string) => void;
  /** The World Asks Back (2026-10-16): the event sink for saga
   *  latching — harvest/tame/feed/plant/build writers live here. */
  recordAsksEvent?: (input: AsksEventInput | AsksEventInput[]) => void;
  postNotification: (
    title: string,
    message: string,
    type?: GameNotification['type'],
    iconColor?: string
  ) => void;
  onOpenBioForgeModal: () => void;
  /** Open a storage pod's panel (App shows StorageModal). */
  onOpenStorage: (structure: StructureEntity) => void;
  onOpenVat: (structure: StructureEntity) => void;
  /** BioTunnel mouth click (Adam, 2026-10-16): App runs the
   *  transit to the other mouth (or explains a dormant one). */
  onTunnelTransit: (structure: StructureEntity) => void;
  /** Mouths in the whole known world — the pair cap's count. */
  getTunnelMouthCount: () => number;
  /** Spawn a dropped item in the world (storage spills, overflow). */
  spawnDroppedItem: (itemId: ItemId, count: number, x: number, z: number) => void;
  triggerHarvestFx: (x: number, z: number) => void;
  triggerSolventFx: (x: number, z: number) => void;
  /** The visible solvent jet, player -> target (Adam, 2026-10-16). */
  triggerSprayJetFx: (x: number, z: number) => void;
  /**
   * S6 Movable Vaults: the live carry state (null = not carrying).
   * While carrying, the whole kit is inert — the only live click is
   * the put-down click; every other tool/creature/structure attempt
   * gets the soft "hands full" response.
   */
  carryRef: { current: CarryState | null };
  /** S6: set the carried vault down at a ground spot (false = the spot refused, carry continues). */
  putDownCarryAt: (worldX: number, worldZ: number) => boolean;
  /** THE SHIELD (Adam, 2026-10-17): no striking while the shield
   *  is raised — a wall does not lash out. App bridges the wield
   *  hook's raisedRef here. */
  shieldRaisedRef?: { current: boolean };
}

export function useToolInteractions({
  activeTool,
  selectedStructureType,
  selectedSeedId,
  selectedFertilizerId,
  inventory,
  structuresList,
  floraList,
  addInventoryItem,
  deductInventoryItem,
  hasItem,
  resetFloraHarvest,
  applyFloraFertilizer,
  valleySatiatedUntilRef,
  addFlora,
  addStructure,
  upsertStructure,
  removeStructure,
  removeFlora,
  getPlacementRotation,
  getPlayerPosition,
  getPlayerLevel,
  applyPlayerLevel,
  onEnterCave,
  onExitCave,
  onDescendCave,
  onVineClimb,
  onEnterRuin,
  onExitRuin,
  instanceKind,
  tameFauna,
  hearthFeed,
  loadHeartbearer,
  getDayNightCycle,
  setFaunaCommand,
  onRequestRelease,
  onGlyphRead,
  onHeartReached,
  onFloraHarvest,
  applyDissolve,
  strikeFauna,
  fireProjectile,
  strikerDrawRef,
  spendStamina,
  triggerShotFx,
  triggerStrikeHitFx,
  setCodexList,
  fieldNotesState,
  unlockFieldNotes,
  recordFieldWitness,
  recordAsksEvent,
  postNotification,
  onOpenBioForgeModal,
  onOpenStorage,
  onOpenVat,
  onTunnelTransit,
  getTunnelMouthCount,
  spawnDroppedItem,
  triggerHarvestFx,
  triggerSolventFx,
  triggerSprayJetFx,
  carryRef,
  putDownCarryAt,
  shieldRaisedRef,
}: UseToolInteractionsParams) {
  // What a harvest-ready plant gives up, per species — ONE table shared by
  // the harvest glove (which leaves the plant standing to regrow) and the
  // solvent sprayer (which dissolves it outright), so the two can never
  // drift apart. The fertilizedYield flag (Yield Fertilizer) fattens the
  // main yield; some species also drop a bonus extra.
  const computeHarvestYields = (
    flora: FloraEntity
  ): { item: ItemId; count: number; extras: [ItemId, number][] } => {
    // Flora table first (creature slice 9, 2026-10-15): species that
    // live in flora.ts carry their yields as DATA — one table, read by
    // both the glove and the solvent, so the two can never drift (the
    // rule this function was built on, extended). The switch below
    // remains the home for the census/dressing species whose yields
    // carry bespoke commentary; new species should land in the table,
    // not here.
    const tableDef = floraDef(flora.species);
    if (tableDef?.harvest) {
      const h = tableDef.harvest;
      return {
        item: h.item,
        count: flora.fertilizedYield ? h.fertilizedCount : h.count,
        extras: h.extras ?? [],
      };
    }
    switch (flora.species) {
      case 'lantern_fern':
        return { item: 'soft_fiber', count: flora.fertilizedYield ? 5 : 2, extras: [['dew_essence', 1], ['seed_lantern_fern', 1]] };
      case 'sap_weaver':
        return { item: 'resin_sap', count: flora.fertilizedYield ? 6 : 3, extras: [['seed_sap_weaver', 1]] };
      case 'petal_mill':
        return { item: 'vibrant_petal', count: flora.fertilizedYield ? 6 : 3, extras: [['sweet_nectar', 2], ['seed_petal_mill', 1]] };
      case 'snap_trap':
        return { item: 'carapace_scale', count: 1, extras: [['seed_snap_trap', 1]] };
      case 'bounce_shroom':
        // Harvesting a bounce-shroom gives its spore back (replant it
        // under another hole) plus the dew that collects on the cap.
        return { item: 'seed_bounce_shroom', count: flora.fertilizedYield ? 2 : 1, extras: [['dew_essence', 1]] };
      case 'glow_spore_cluster':
      case 'glow_fungus':
        // Spore-bearers, surface and cave: the orbs/caps are picked for
        // their spores, which hold the glow. The plant stays and regrows.
        return { item: 'glow_spore', count: flora.fertilizedYield ? 4 : 2, extras: [['dew_essence', 1]] };
      case 'sunshard_cluster':
        // A cave crystal that GROWS — so it harvests like a plant:
        // chips for the pouch, dew from the cave air condensing on it,
        // and the root crystal stays to regrow the cluster.
        return { item: 'sunshard', count: flora.fertilizedYield ? 4 : 2, extras: [['dew_essence', 1]] };
      case 'prism_cluster':
        // The deep prize — and, since 2026-10-15, the Prismatic
        // Core's home: Adam's instinct was that the radar's core
        // lives in caves, but the cluster used to drop a Violet
        // Prism (an item no recipe consumed) while the Core itself
        // dropped NOWHERE, quietly bricking the Sonar Receiver.
        // Now: one core per harvest bare, two when yield-fertilized.
        // (Violet prisms remain as ruin-cache treasure.)
        return { item: 'prismatic_core', count: flora.fertilizedYield ? 2 : 1, extras: [] };
      case 'echo_reed':
        // The radar's listening half: hollow resonant stalks, cut
        // above the root so the reed stands back up and regrows.
        return { item: 'resonant_reed', count: flora.fertilizedYield ? 4 : 2, extras: [['dew_essence', 1]] };
      case 'antenna_shroom':
        // Fungal Hollow giants (2026-10-15): the sensing kind —
        // its antennae drink the spore air and bead it as dew.
        return { item: 'glow_spore', count: flora.fertilizedYield ? 4 : 2, extras: [['dew_essence', 1]] };
      case 'visor_shroom':
        // The almost-face kind: dense, rich flesh — compost gold.
        return { item: 'basic_compost', count: flora.fertilizedYield ? 3 : 2, extras: [['glow_spore', 1]] };
      case 'shelf_shroom':
        // Bracket shelves: fibrous and tough, like growing leather.
        return { item: 'soft_fiber', count: flora.fertilizedYield ? 4 : 2, extras: [['basic_compost', 1]] };
      case 'cinder_bloom':
        // Ember Scar (2026-10-15): heat-cured resin beads in the
        // bloom's cup — the scar pays in sap for those who time it.
        return { item: 'resin_sap', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'obsidian_bloom':
        // Obsidian Garden (2026-10-15): the land's own glass —
        // shards petal-cut by heat, plus the dew the glass sweats.
        return { item: 'obsidian_shard', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'prism_reed':
        // Prism Beds (2026-10-15): salt-fused crystal blades —
        // shards plus the dew the crystal sweats at dawn.
        return { item: 'saltglass_shard', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'rime_spire':
        // Ice Fangs (2026-10-15): portable winter — nevermelt ice
        // plus the melt-dew beaded on the teeth at dawn.
        return { item: 'nevermelt_ice', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'heartroot':
        // Rootwood (2026-10-15): the premium building wood, plus
        // the fibrous bark the slabs shed.
        return { item: 'heartwood', count: flora.fertilizedYield ? 3 : 2, extras: [['soft_fiber', 1]] };
      case 'dusk_grass':
        // Living (2026-10-15): valley fiber — the purple-black
        // grass cuts to soft fiber, with dew on the blades.
        return { item: 'soft_fiber', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'heartbloom':
        // Living (2026-10-15): the heart gives its sap freely —
        // double when the valley has been fed (fertilizedYield).
        return { item: 'heart_sap', count: flora.fertilizedYield ? 2 : 1, extras: [['dew_essence', 2]] };
      case 'stormcatcher':
        // Storm (2026-10-15): the crown fuses its gathered charge
        // into fulgurite glass; dew beads on the reed after rain.
        return { item: 'fulgurite_shard', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'gravebloom':
        // Bone (2026-10-15): bone meal from the bloom, dew in the cup.
        return { item: 'bone_meal', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'precursor_bloom':
        // Precursor (2026-10-15): living thread from the petals,
        // dew beaded in the golden core — the gardens pay twice.
        return { item: 'living_thread', count: flora.fertilizedYield ? 3 : 2, extras: [['dew_essence', 1]] };
      case 'mirror_lily':
        // Mirror Marsh (2026-10-15): the pads cup the doubled light
        // and bead it as dew; a reed sometimes roots alongside.
        return { item: 'dew_essence', count: flora.fertilizedYield ? 5 : 3, extras: [['resonant_reed', 1]] };
      case 'bell_bloom':
        // Its own case since the seed ruling (2026-10-17): the
        // default's yields plus the plant's own seed.
        return { item: 'dew_essence', count: flora.fertilizedYield ? 4 : 2, extras: [['soft_fiber', 1], ['seed_bell_bloom', 1]] };
      default:
        return { item: 'dew_essence', count: flora.fertilizedYield ? 4 : 2, extras: [['soft_fiber', 1]] };
    }
  };

  // 1. Non-Lethal Flora Harvesting
  const handleHarvestFlora = useCallback(
    (flora: FloraEntity): void => {
      if (!flora.harvestReady) {
        postNotification(
          'Botanical Immature',
          'Specimen is still synthesizing nutrients. Give it time or apply Growth Fertilizer.',
          'alert',
          '#fbbf24'
        );
        return;
      }

      // Harvest windows (slice 40, 2026-10-16): a few crops keep
      // an appointment with the clock — the Meltcap holds only at
      // midnight, the Noonflower opens only at noon, and their
      // kin besides (the flora table's harvestWindow field). The
      // glove refuses outside the window with the species' own
      // closedText as the tell: what you are looking at instead
      // of a crop. The solvent is NOT gated — a propagule can be
      // reclaimed at any hour; only the crop keeps the hour.
      const windowDef = floraDef(flora.species)?.harvestWindow;
      if (windowDef) {
        const phase = getDayNightCycle();
        const dist =
          windowDef.around === 'noon' ? Math.abs(phase - 0.5) : Math.min(phase, 1 - phase);
        if (dist > 0.09) {
          postNotification('Out of Its Hour', windowDef.closedText, 'alert', '#fbbf24');
          return;
        }
      }

      soundEngine.playHarvest();
      triggerHarvestFx(flora.x, flora.z);

      // Everything collected goes through one ledger so the notification
      // can list it ALL — players should see their seeds/spores, extras
      // and trimmings land, not just the headline yield (Adam, 2026-10-14).
      const { item: yieldItem, count: yieldCount, extras } = computeHarvestYields(flora);
      const collected = new Map<ItemId, number>();
      const collect = (id: ItemId, n: number): void => {
        collected.set(id, (collected.get(id) ?? 0) + n);
        addInventoryItem(id, n);
      };
      collect(yieldItem, yieldCount);
      extras.forEach(([extraId, extraCount]) => collect(extraId, extraCount));
      // The Ask the World line hears about a successful harvest
      // (its garden quest reads the zone from App's side).
      onFloraHarvest?.(flora);
      // Trimmings: every harvest yields a little compost — the renewable source
      collect('basic_compost', 1);
      // Regrowth runs at the base rate; a fresh fertilizer application
      // is what speeds a regrowing plant up now (timed boost model).
      const regrowTimer = FLORA_MATURE_SECONDS;
      resetFloraHarvest(flora.id, regrowTimer);
      multiplayerManager.broadcastEntityUpsert('flora', {
        ...flora,
        harvestReady: false,
        harvestTimer: regrowTimer,
        fertilizedYield: false,
        growthStage: 0,
      });

      // Field Notes (dev wiring, 2026-10-16): discovering a species
      // — by harvest or by scan — opens its note in the quest log.
      // The unlock rides the same event as the codex flip below,
      // so the two records can never disagree.
      const newFloraNotes = noteIdsForSpecies(flora.species).filter(
        (id) => !fieldNotesState.unlocked.includes(id)
      );
      setCodexList((prev) =>
        prev.map((c) =>
          c.species === flora.species
            ? { ...c, discovered: true, scannedCount: c.scannedCount + 1 }
            : c
        )
      );
      if (newFloraNotes.length) {
        unlockFieldNotes(newFloraNotes);
        newFloraNotes.forEach((id) => {
          const n = noteById(id);
          if (n) postNotification('Field Note Added', n.clue, 'discover', '#a3e635');
        });
      }
      // Window witness: reaching this line means the phase gate
      // above did NOT refuse — a window crop taken inside its
      // hour is witnessed, by construction.
      if (windowDef) {
        const windowNote = windowNoteIdForSpecies(flora.species);
        if (windowNote) recordFieldWitness(windowNote);
      }
      // The World Asks Back (2026-10-16): the harvest event for
      // saga latching — counted by flora species, right where the
      // harvest is known good.
      recordAsksEvent?.({
        kind: 'harvest',
        flora: flora.species,
        count: Array.from(collected.values()).reduce((s, n) => s + n, 0),
      });

      postNotification(
        'Harvest Successful',
        `Collected ${formatCollected(collected)} — gathered non-lethally; the plant stays rooted and regrows.`,
        'harvest',
        ITEMS[yieldItem]?.color || '#2dd4bf'
      );

    },
    [addInventoryItem, resetFloraHarvest, setCodexList, postNotification, triggerHarvestFx, getDayNightCycle, recordAsksEvent]
  );

  // 2. Bio-Scanner
  const handleScanTarget = useCallback(
    (target: NonNullable<HoverTarget>): void => {
      soundEngine.playScan();

      // Guard Clause: Ground target has no genetic codex entry
      if (target.type === 'ground') {
        postNotification('Ground Scanned', 'Subterranean mycelium detected. Suitable for cultivation.', 'discover', '#06b6d4');
        return;
      }

      let speciesKey: string = '';
      let displayName: string = '';

      if (target.type === 'flora') {
        speciesKey = target.entity.species;
        displayName = target.entity.species.replace('_', ' ').toUpperCase();
      }
      if (target.type === 'fauna') {
        speciesKey = target.entity.species;
        displayName = target.entity.species.replace('_', ' ').toUpperCase();
      }
      if (target.type === 'structure') {
        speciesKey = target.entity.type;
        displayName = target.entity.type.replace(/_/g, ' ').toUpperCase();
      }

      // Field Notes: the scan is the game's discovery verb — a
      // first scan opens the species' note (and any group note it
      // belongs to) in the quest log.
      const newFaunaNotes = noteIdsForSpecies(speciesKey).filter(
        (id) => !fieldNotesState.unlocked.includes(id)
      );
      setCodexList((prev) =>
        prev.map((entry) =>
          entry.species === speciesKey
            ? { ...entry, discovered: true, scannedCount: entry.scannedCount + 1 }
            : entry
        )
      );
      if (newFaunaNotes.length) {
        unlockFieldNotes(newFaunaNotes);
        newFaunaNotes.forEach((id) => {
          const n = noteById(id);
          if (n) postNotification('Field Note Added', n.clue, 'discover', '#a3e635');
        });
      }

      postNotification(
        'Bio-Scanner Logged',
        `Discovered genetic traits for ${displayName}. Added to Codex [C].`,
        'discover',
        '#06b6d4'
      );
    },
    [setCodexList, postNotification]
  );

  // Which species a seed item grows — the planter's ONE mapping,
  // shared by the habitat guards and the planting code below, so the
  // two can never disagree about what a seed becomes.
  const speciesForSeed = (seedId: ItemId): FloraEntity['species'] => {
    switch (seedId) {
      case 'seed_sap_weaver': return 'sap_weaver';
      case 'seed_petal_mill': return 'petal_mill';
      case 'seed_snap_trap': return 'snap_trap';
      case 'seed_bell_bloom': return 'bell_bloom';
      case 'seed_bounce_shroom': return 'bounce_shroom';
      case 'glow_spore':
        // One spore stock, two forms: the cluster that rings surface
        // cave mouths, and glow fungus in the cavern dark.
        return instanceKind() === 'cavern' ? 'glow_fungus' : 'glow_spore_cluster';
      default: return 'lantern_fern';
    }
  };

  // 3. Planter Trowel & Fertilizers
  const handlePlanterAction = useCallback(
    (worldX: number, worldZ: number, targetFlora?: FloraEntity): void => {
      // Habitat rules for PLANTING (fertilizing an existing plant —
      // the targetFlora path below — is always fine):
      //  - Underground, only the cave's own spore stock takes hold by
      //    hand: glow spores, which rise as glow fungus.
      //  - On the surface, glow spores refuse domestic soil — they
      //    belong to the cavern dark (and to wild rings at cave mouths).
      if (!targetFlora) {
        if (instanceKind() === 'ruin') {
          postNotification('Barren Stone', 'The ruin floor is precursor stone — nothing takes hold here by hand. What grows in a ruin grows on its own terms.', 'alert', '#fbbf24');
          return;
        }
        if (instanceKind() === 'cavern' && speciesForSeed(selectedSeedId) !== 'glow_fungus') {
          postNotification('Barren Rock', 'The cavern floor is bare stone — only glow spores take hold here, rising as glow fungus. The cave grows its own way.', 'alert', '#fbbf24');
          return;
        }
        if (instanceKind() === 'surface' && selectedSeedId === 'glow_spore') {
          postNotification('Wrong Soil', 'Glow spores refuse domestic soil — plant them in the dark of a cavern, where they rise as glow fungus.', 'alert', '#fbbf24');
          return;
        }
      }
      // Applying Fertilizer to existing plant
      if (targetFlora) {
        // The trowel applies the LOADED fertilizer (selectedFertilizerId —
        // cycled with the mouse wheel / ↑ ↓, or picked in the Inventory).
        // It never silently swaps to the other kind: if the loaded one is
        // missing from the pouch, say so and name the way out.
        const loadedId = selectedFertilizerId;
        const loadedType: 'growth' | 'yield' = loadedId === 'yield_fertilizer' ? 'yield' : 'growth';

        if (hasItem(loadedId, 1)) {
          deductInventoryItem(loadedId, 1);
          soundEngine.playFertilize();
          // FEEDING THE VALLEY (Living, 2026-10-15): fertilizer on
          // a HEARTBLOOM is not gardening — it is a meal. The
          // valley eats, and a hungry host stops grabbing while
          // it digests (~5 minutes, session-scoped in v1). The
          // fertilizer still applies (a fed heart yields double).
          if (targetFlora.species === 'heartbloom') {
            valleySatiatedUntilRef.current = performance.now() + 300_000;
            applyFloraFertilizer(targetFlora.id, loadedType);
            multiplayerManager.broadcastEntityUpsert('flora', {
              ...targetFlora,
              ...(loadedType === 'growth'
                ? { fertilizedGrowth: true, fertilizerTimer: FERTILIZER_DURATION_SECONDS }
                : { fertilizedYield: true }),
            });
            postNotification('The Valley Eats', 'The heartbloom folds around the offering and the whole valley seems to exhale. If this host was hungry, the grabbing stops while it digests.', 'craft', '#ef4444');
            return;
          }
          applyFloraFertilizer(targetFlora.id, loadedType);
          multiplayerManager.broadcastEntityUpsert('flora', {
            ...targetFlora,
            ...(loadedType === 'growth'
              ? { fertilizedGrowth: true, fertilizerTimer: FERTILIZER_DURATION_SECONDS }
              : { fertilizedYield: true }),
          });
          if (loadedType === 'growth') {
            postNotification('Growth Fertilizer Applied', `Growth boosted for ${FERTILIZER_DURATION_SECONDS} seconds. Reapply to keep it surging.`, 'craft', '#10b981');
          } else {
            postNotification('Yield Fertilizer Applied', 'Enhanced material yield and triggered rare bio-traits.', 'craft', '#a855f7');
          }
          return;
        }

        const otherId: ItemId = loadedId === 'yield_fertilizer' ? 'growth_fertilizer' : 'yield_fertilizer';
        if (hasItem(otherId, 1)) {
          postNotification(
            'Loaded Fertilizer Missing',
            `${ITEMS[loadedId]?.name || 'The loaded fertilizer'} is in the trowel but your pouch has none — scroll the mouse wheel or press ↑ / ↓ to load ${ITEMS[otherId]?.name || 'the other fertilizer'} instead.`,
            'alert',
            '#fbbf24'
          );
          return;
        }

        postNotification('No Fertilizer in Pouch', 'Craft Growth Fertilizer (Compost + Bio-Pellets) in the Bio-Forge [B].', 'alert', '#fbbf24');
        return;
      }

      // Planting a new seed
      // Spacing guard: refuse to root a plant on top of an existing one.
      const tooClose = floraList.some(
        (f) => Math.hypot(f.x - worldX, f.z - worldZ) < MIN_PLANT_SPACING
      );
      if (tooClose) {
        postNotification('Already Growing Here', 'A plant is already rooted at this spot — give it about a meter of space.', 'alert', '#fbbf24');
        return;
      }

      if (!hasItem(selectedSeedId, 1)) {
        postNotification('No Seeds in Stock', `You need a ${ITEMS[selectedSeedId]?.name || selectedSeedId} to plant. Craft more in Bio-Forge [B].`, 'alert', '#ef4444');
        return;
      }

      deductInventoryItem(selectedSeedId, 1);
      soundEngine.playFertilize();

      const species: FloraEntity['species'] = speciesForSeed(selectedSeedId);

      const newFlora: FloraEntity = {
        id: 'flora_' + Math.random().toString(36).substring(2, 9),
        species,
        x: worldX,
        z: worldZ,
        rotation: Math.random() * Math.PI * 2,
        scale: 0.9,
        growthStage: 0,
        growthProgress: 0,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: false,
        harvestTimer: FLORA_MATURE_SECONDS,
        isHazardous: false,
        swayOffset: Math.random() * 3,
        isPlayerPlanted: true,
      };

      addFlora(newFlora);
      multiplayerManager.broadcastEntityUpsert('flora', newFlora);
      if (instanceKind() === 'cavern') {
        // Planted cave flora PERSISTS per-cave (Adam's call,
        // 2026-10-14): App captures the player's plantings on exit
        // and at save time, and merges them back on the next entry —
        // so the toast promises exactly that. (An earlier version of
        // this toast said "lives for this delve"; that was the
        // visit-only interim, superseded the same day.)
        postNotification('Cave Spore Planted', 'Glow fungus takes hold in the cavern dark. This cave will remember it — your plantings stay planted here.', 'craft', '#22d3ee');
      } else {
        postNotification('Spore Planted', `Successfully cultivated ${ITEMS[selectedSeedId]?.name}. Water with fertilizer to accelerate!`, 'craft', '#4ade80');
      }
      // The World Asks Back (2026-10-16): the planting event for
      // saga latching. Seed ids are `seed_<species>` — the prefix
      // strips to the flora the quest text names.
      if (selectedSeedId.startsWith('seed_')) {
        recordAsksEvent?.({ kind: 'plant', flora: selectedSeedId.slice(5) });
      }
    },
    [selectedSeedId, selectedFertilizerId, hasItem, deductInventoryItem, applyFloraFertilizer, addFlora, postNotification, floraList, recordAsksEvent]
  );

  // 4. Solvent Sprayer (100% Recycler)
  const handleSolventSprayer = useCallback(
    (structure: StructureEntity): void => {
      // The Heart Tile does not dissolve (Adam, 2026-10-16): it is
      // the land's own respawn point, grown by the world, not by
      // hand — the enzyme washes over it and it stays.
      if (structure.type === 'heart_tile') {
        postNotification(
          'The Land Keeps Its Heart',
          'The heart tile does not dissolve. It is where the land wakes you.',
          'system',
          '#fb7185',
        );
        return;
      }
      soundEngine.playSolventSpray();
      triggerSolventFx(structure.worldX, structure.worldZ);

      // Pickup is WHOLE (Adam, 2026-10-15, completed 2026-10-16):
      // a dissolved structure returns to the player tiers, contents
      // and all — the structure item itself, every tier kit it had
      // absorbed, and everything it was holding. Contents ride the
      // ordinary pouch gain, so what fits goes to the pouch and
      // any overflow drops at the player's feet like any other
      // gain: nothing a player stored is ever deleted by solvent.
      // A gestating vat gives its SAMPLE back too (the pod's rule,
      // narrowed to the heart): the soup is spent into the culture,
      // but the cutting itself is too precious to delete.
      const returnedKits: string[] = [];
      let returnedContents = false;

      if (structure.type === 'culture_vat' && structure.vat?.gestating) {
        addInventoryItem(sampleItemId(structure.vat.gestating.species), 1);
        returnedContents = true;
      }

      if ((structure.type === 'storage_pod' || structure.type === 'sample_rack') && structure.storage) {
        Object.entries(structure.storage.items).forEach(([itemId, count]) => {
          if ((count ?? 0) > 0) {
            addInventoryItem(itemId as ItemId, count as number);
            returnedContents = true;
          }
        });
      }

      // Tier kits absorbed by in-place upgrades come back out:
      // each tier above the base was raised by one kit, and the
      // kit-ladder helpers name them (pod: hutch, then vault;
      // vat: rich, then deep).
      if (structure.storage) {
        for (let step = 1; step < structure.storage.tier; step++) {
          const kit = storageKitFor(step);
          if (kit) {
            addInventoryItem(kit, 1);
            returnedKits.push(ITEMS[kit]?.name || kit);
          }
        }
      }
      if (structure.type === 'culture_vat' && structure.vat) {
        for (let step = 1; step < structure.vat.tier; step++) {
          const kit = vatKitFor(step);
          if (kit) {
            addInventoryItem(kit, 1);
            returnedKits.push(ITEMS[kit]?.name || kit);
          }
        }
      }

      // Return 100% of seed-nodes to inventory
      addInventoryItem(structure.type as ItemId, 1);
      removeStructure(structure.id);

      postNotification(
        'Bio-Structure Dissolved',
        `Gentle enzyme returned 100% of ${ITEMS[structure.type]?.name || structure.type} to your pouch.` +
          (returnedKits.length > 0 ? ` Tier kits back: ${returnedKits.join(', ')}.` : '') +
          (returnedContents ? ' Contents returned with it.' : ''),
        'craft',
        '#38bdf8'
      );

      multiplayerManager.broadcastEntityRemove('structure', structure.id);
    },
    [addInventoryItem, removeStructure, triggerSolventFx, postNotification, spawnDroppedItem]
  );

  // 4b. Solvent Sprayer on flora — dissolve & reclaim (Adam, 2026-10-14:
  // there must be a way to REMOVE a plant, not just harvest it forever).
  // A harvest-ready plant returns EVERYTHING a harvest would have given
  // (the shared yield table above, yield-fertilizer bonus included, plus
  // the compost trimmings) AND its seed — dissolving reclaims the whole
  // organism. An unripe plant returns just the seed: dissolving early is
  // a replant tool, not a shortcut past growing time. Either way the
  // plant is GONE — no regrowth, unlike the glove — and co-op peers are
  // told to remove it too.
  // (Re-applied 2026-10-14 after a parallel-chat whole-file push
  // overwrote the first landing — see the repo history around ae51e10.)
  const handleSolventFlora = useCallback(
    (flora: FloraEntity): void => {
      soundEngine.playSolventSpray();
      triggerSolventFx(flora.x, flora.z);

      // What dissolving reclaims as the plant's propagule. Most
      // species have a seed_<species> item; the spore/crystal cave
      // species reclaim their own harvest stock instead — there is
      // no seed_glow_fungus item, and minting one here would drop a
      // phantom item into the pouch.
      const seedId: ItemId =
        flora.species === 'glow_spore_cluster' || flora.species === 'glow_fungus'
        || flora.species === 'antenna_shroom' || flora.species === 'visor_shroom' || flora.species === 'shelf_shroom'
          ? 'glow_spore' // the fungal variant species spore-propagate too
          : flora.species === 'sunshard_cluster'
            ? 'sunshard'
            : flora.species === 'prism_cluster'
              ? 'prismatic_core'
              : flora.species === 'mirror_lily'
                ? 'dew_essence' // lilies spread by rhizome — dew is their stock
                : flora.species === 'cinder_bloom'
                  ? 'resin_sap' // no seed survives the vents; sap is the stock
                  : flora.species === 'obsidian_bloom'
                    ? 'obsidian_shard' // glass does not seed; a shard is the stock
                    : flora.species === 'prism_reed'
                      ? 'saltglass_shard' // crystal does not seed either
                      : flora.species === 'rime_spire'
                        ? 'nevermelt_ice' // ice does not seed; a carried piece is the stock
                        : flora.species === 'heartroot'
                          ? 'heartwood' // a cut heart is the stock; roots regrow from the giant, not from seed pouches
                          : flora.species === 'precursor_bloom'
                            ? 'living_thread' // grown thread is its own propagule
                            : flora.species === 'gravebloom'
                              ? 'bone_meal' // the bloom regrows from the country's stock, not a pouch
                              : flora.species === 'stormcatcher'
                                ? 'fulgurite_shard' // the storm regrows its glass
                                : flora.species === 'dusk_grass'
                                  ? 'soft_fiber' // valley grass regrows from the valley
                                  : flora.species === 'heartbloom'
                                    ? 'heart_sap' // and the heart regrows from the valley too
                    : (`seed_${flora.species}` as ItemId);
      const rawName = flora.species.replace(/_/g, ' ');
      const speciesName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      if (flora.harvestReady) {
        const { item, count, extras } = computeHarvestYields(flora);
        // One ledger, like the glove harvest: the message lists
        // everything reclaimed, seed/spore included (merged if the
        // yield IS the seed, as with bounce-shroom spores).
        const collected = new Map<ItemId, number>();
        const collect = (id: ItemId, n: number): void => {
          collected.set(id, (collected.get(id) ?? 0) + n);
          addInventoryItem(id, n);
        };
        collect(item, count);
        extras.forEach(([extraId, extraCount]) => collect(extraId, extraCount));
        collect('basic_compost', 1); // trimmings, same as a glove harvest
        if (ITEMS[seedId]) collect(seedId, 1);
        postNotification(
          'Plant Dissolved',
          `${speciesName} reclaimed: ${formatCollected(collected)}.`,
          'craft',
          '#38bdf8'
        );
      } else if (ITEMS[seedId]) {
        addInventoryItem(seedId, 1);
        postNotification(
          'Plant Dissolved',
          `Unripe ${speciesName} dissolved — nothing to harvest yet, but its ${ITEMS[seedId]?.name || 'seed'} is back in your pouch.`,
          'craft',
          '#38bdf8'
        );
      } else {
        postNotification(
          'Plant Dissolved',
          `Unripe ${speciesName} dissolved — nothing to reclaim from it yet.`,
          'craft',
          '#38bdf8'
        );
      }

      removeFlora(flora.id);
      multiplayerManager.broadcastEntityRemove('flora', flora.id);
    },
    [addInventoryItem, removeFlora, triggerSolventFx, postNotification]
  );

  // 5. Taming Lure
  // Release arming (Adam, 2026-10-15): the command cycle is
  // follow -> stay -> guard -> RELEASE? -> follow... The release
  // stop never applies on its click: it arms and raises App's
  // confirm; the NEXT lure click (confirm answered either way)
  // passes the stop and lands on follow. A fresh tame clears the
  // arm, so a re-won creature's cycle asks again like new.
  const releaseArmedRef = useRef<Set<string>>(new Set());

  const handleTameFauna = useCallback(
    (fauna: FaunaEntity): void => {
      if (fauna.isTamed) {
        // The guarded fourth stop: leaving GUARD, the cycle asks
        // about release before it may wrap to follow.
        if ((fauna.command ?? 'follow') === 'guard' && !releaseArmedRef.current.has(fauna.id)) {
          releaseArmedRef.current.add(fauna.id);
          onRequestRelease(fauna);
          return;
        }
        releaseArmedRef.current.delete(fauna.id);
        const order: Array<'follow' | 'stay' | 'guard'> = ['follow', 'stay', 'guard'];
        const next = order[(order.indexOf(fauna.command ?? 'follow') + 1) % order.length];
        const petName = fauna.customName || fauna.species.replace('_', ' ');
        const verb = next === 'follow' ? 'follow you' : next === 'stay' ? 'stay here' : 'guard this spot';
        setFaunaCommand(fauna.id, next);
        multiplayerManager.broadcastEntityUpsert('fauna', {
          ...fauna,
          command: next,
          targetX: fauna.x,
          targetZ: fauna.z,
          state: next === 'follow' ? 'following' : next === 'guard' ? 'patrolling' : 'idle',
        });
        postNotification('Pet Command', `${petName} will ${verb}.`, 'tame', '#2dd4bf');
        return;
      }

      // Species data (display name, tame odds, pet name, bait flow)
      // comes from the species table — see game/creatures/species.ts.
      const def = speciesDef(fauna.species);

      // -------------------------------------------------------------
      // THE HEARTBEARER (slice 48, 2026-10-16): not a taming —
      // a loading. The lure is the offering hand: with it, you
      // place ONE edible from your pouch on the bearer's back,
      // and the sim's road delivers it to the valley's heart.
      // The pantry is the valley's own (nectar, the heart's
      // sap, eggs and caps) — the bearer carries food, not
      // freight, and its back holds four.
      // -------------------------------------------------------------
      if (fauna.species === 'heartbearer') {
        if ((fauna.cargoItems ?? []).length >= 4) {
          postNotification('Fully Laden', 'The Heartbearer already carries all its broad back holds. It will deliver, in its own time — follow it, if you want to see the heart\'s road.', 'alert', '#fbbf24');
          return;
        }
        const EDIBLE_PANTRY: ItemId[] = ['sweet_nectar', 'heart_sap', 'sedge_egg', 'haycap', 'sun_cap', 'meltcap'];
        const offering = EDIBLE_PANTRY.find((i) => hasItem(i, 1));
        if (!offering) {
          postNotification('An Offering for the Road', 'The Heartbearer carries food to the valley\'s heart — nectar, heart sap, eggs, caps: something edible from your pouch, laid on its back, is delivered. You carry nothing it can use.', 'alert', '#fbbf24');
          return;
        }
        deductInventoryItem(offering, 1);
        const aboard = loadHeartbearer(fauna.id, offering);
        postNotification('Loaded for the Heart', `${ITEMS[offering]?.name || 'Your offering'} rides the Heartbearer\'s back now — ${aboard} aboard. It will be delivered to the valley\'s heart, and a fed heart answers.`, 'tame', '#2dd4bf');
        return;
      }

      // -------------------------------------------------------------
      // THE ANSWER DEER (slice 48): the gate before the generic
      // lure. The deer's method is the tamer's own state — the
      // sim has been collecting your calm on the deer itself
      // (calmRegard: seconds of slow company, over days). Too
      // little collected calm and the offering is refused
      // BEFORE any nectar is spent: the mirror is not fed, it
      // is met. Enough, and the ordinary roll below decides —
      // the deer's table odds, on a courtship already earned.
      // -------------------------------------------------------------
      if (fauna.species === 'answer_deer' && (fauna.calmRegard ?? 0) < 45) {
        postNotification('It Keeps What You Bring It', 'The Answer Deer mirrors the visitor it is with — and what it has been brought so far is hurry. Be near it. Be slow. Let a little calm collect, over time, and then offer, at the speed you brought it.', 'alert', '#fbbf24');
        return;
      }

      // -------------------------------------------------------------
      // THE HEARTH DOG (slice 39, 2026-10-16): the roster's one
      // REVERSED taming. This dog was never lured — it ARRIVED at
      // the heart tile (the sim walks it in), and the lure here is
      // only an offering dish. Three accepted offerings — spaced,
      // because a dog decides at its own pace (one counts per
      // minute) — and the third is the decision: it bonds as a
      // full pet, follow/stay/guard all at full fluency, having
      // watched how you live. A dog with no decide clock never
      // arrived (it was dealt wild, or grown in the vat) and the
      // whole business is refused: those keep their own counsel.
      // -------------------------------------------------------------
      if (fauna.species === 'hearth_dog') {
        if (fauna.hearthDecideTimer === undefined) {
          postNotification('It Keeps Its Own Counsel', 'This dog did not arrive — and a dog that did not arrive cannot be courted.', 'alert', '#fbbf24');
          return;
        }
        if ((fauna.hearthFedTimer ?? 999) < 60) {
          postNotification('Still Deciding', 'The dog is digesting your last offering — and your character. Give it a minute.', 'alert', '#fbbf24');
          return;
        }
        if (!hasItem('sweet_nectar', 1)) {
          postNotification('Sweet Nectar Needed', 'An offering is an offering: the dog takes Sweet Nectar like everyone, whatever it privately thinks of the menu.', 'alert', '#fbbf24');
          return;
        }
        deductInventoryItem('sweet_nectar', 1);
        const feedings = hearthFeed(fauna.id);
        // The World Asks Back (2026-10-16): the accepted offering
        // is the feed event for saga latching (dog-only for now —
        // it's the only feeder the game has; the creatures lane
        // adds stamps for others as their social beats grow).
        if (feedings > 0) recordAsksEvent?.({ kind: 'feed', species: 'hearth_dog' });
        if (feedings >= 3) {
          soundEngine.playTameCritter();
          releaseArmedRef.current.delete(fauna.id);
          tameFauna(fauna.id, def.petName, 'following');
          // The World Asks Back (2026-10-16): the tame event for saga latching.
          recordAsksEvent?.({ kind: 'tame', species: fauna.species });
          // Field Notes witness: 'The Dog Has Decided.'
          recordFieldWitness('note_hearth_dog');
          postNotification(
            'The Dog Has Decided',
            'Three offerings, honestly given — the Hearth Dog has chosen this home. Follow, stay, and guard, all at full fluency: it has been watching how you live, and it has views.',
            'tame',
            '#2dd4bf'
          );
          multiplayerManager.broadcastFaunaTame(fauna.id, multiplayerManager.playerName);
        } else if (feedings === 2) {
          // The notices name the clock (Adam, 2026-10-16): the
          // decide window is never only implied — it is stated,
          // here and on the tag over the dog himself.
          const daysLeft = Math.max(0, Math.ceil((fauna.hearthDecideTimer ?? 0) / 600));
          postNotification('Second Offering Accepted', `The dog eats, then settles a little closer to the door than last time. It has started keeping your hours. The decision comes within ${daysLeft} days, one way or the other.`, 'tame', '#2dd4bf');
        } else {
          const daysLeft = Math.max(0, Math.ceil((fauna.hearthDecideTimer ?? 0) / 600));
          postNotification('First Offering Accepted', `The dog eats, unhurried, watching you over the dish. The audition has begun — yours. He will decide within ${daysLeft} days; the ring over his head keeps the count.`, 'tame', '#2dd4bf');
        }
        return;
      }

      // -------------------------------------------------------------
      // THE ROOTFALL BEAR (slice 44, 2026-10-16): a landlord
      // negotiation, not a taming. The bear leaves Heart Sap at
      // the hollow mouth as rent (its table byproduct); the only
      // offering it entertains is that same sap, returned. The
      // roll is its table odds — 20%, over days — and the sap is
      // eaten either way: rent is rent. Tamed, it remains a den
      // animal by the table's own machinery: tameFauna puts a
      // hunter on GUARD at its tame spot, and the bear's tame
      // spot is the hollow — the strongest stay/guard in the
      // game, while its follow stays a rumor the player may
      // test with the lure's command cycle like anyone's.
      // -------------------------------------------------------------
      if (fauna.species === 'rootfall_bear') {
        if (!hasItem('heart_sap', 1)) {
          postNotification('The Landlord\u2019s Rent', 'The bear takes Heart Sap — its own, returned. It leaves the rent at the hollow mouth; gathering it quietly and offering it back is the whole negotiation.', 'alert', '#fbbf24');
          return;
        }
        deductInventoryItem('heart_sap', 1);
        if (Math.random() < (def.tameChance ?? 0)) {
          soundEngine.playTameCritter();
          releaseArmedRef.current.delete(fauna.id);
          tameFauna(fauna.id, def.petName, 'idle');
          // The World Asks Back (2026-10-16): the tame event for saga latching.
          recordAsksEvent?.({ kind: 'tame', species: fauna.species });
          postNotification(
            'Tenancy Agreed',
            'The Rootfall Bear accepts the returned rent and, with it, the arrangement: this hollow has a landlord AND a tenant now, and the guard comes with the lease.',
            'tame',
            '#2dd4bf'
          );
          multiplayerManager.broadcastFaunaTame(fauna.id, multiplayerManager.playerName);
        } else {
          postNotification('The Negotiation Continues', 'The bear eats the sap, considers the tenancy at some length, and rolls over. Nothing about the meeting was a no.', 'tame', '#fbbf24');
        }
        return;
      }

      if (fauna.species === 'soft_puff' || fauna.species === 'burrow_mouse') {
        if (!hasItem('sweet_nectar', 1)) {
          postNotification('Sweet Nectar Needed', `Harvest Sweet Nectar from Petal-Mills or craft bait in the Bio-Forge [B] to tame a ${def.name}.`, 'alert', '#fbbf24');
          return;
        }

        deductInventoryItem('sweet_nectar', 1);

        // The roll: the nectar is gone either way. On a failure the
        // critter enjoys the snack and stays wild — bring more bait.
        const tameChance = def.tameChance ?? 0;
        if (Math.random() > tameChance) {
          postNotification(
            'It Darted Away',
            `The ${def.name} took the nectar and slipped off, still wild.`,
            'alert',
            '#fbbf24'
          );
          return;
        }

        soundEngine.playTameCritter();
        releaseArmedRef.current.delete(fauna.id);
        tameFauna(fauna.id, def.petName, 'following');
          // The World Asks Back (2026-10-16): the tame event for saga latching.
          recordAsksEvent?.({ kind: 'tame', species: fauna.species });

        postNotification(
          'Companion Domesticated!',
          `${def.name} tamed! It follows you${def.byproduct?.tamedOnly ? ` and sheds ${ITEMS[def.byproduct.item]?.name || 'byproducts'}` : ''}. Lure it again to order it to stay or guard.`,
          'tame',
          '#2dd4bf'
        );

        multiplayerManager.broadcastFaunaTame(fauna.id, multiplayerManager.playerName);
        return;
      }

      if (fauna.species === 'chitin_stalker') {
        const hasCarapace = hasItem('carapace_scale', 1);
        const hasNectar2 = hasItem('sweet_nectar', 2);

        if (!hasCarapace && !hasNectar2) {
          postNotification('Predator Bait Needed', 'Offer 2x Sweet Nectar or Carapace Scales to subdue and tame this Chitin-Stalker Guardian.', 'alert', '#ef4444');
          return;
        }

        if (hasCarapace) {
          deductInventoryItem('carapace_scale', 1);
        }
        if (!hasCarapace) {
          deductInventoryItem('sweet_nectar', 2);
        }

        // The roll: a predator usually decides you are not worth it. The
        // offering is eaten either way — three failures in four is normal,
        // which is what makes a tamed stalker worth having.
        if (Math.random() > (def.tameChance ?? 0)) {
          postNotification(
            'The Stalker Backs Off',
            'It snatched the offering and melted back, still wild. Stalkers tame on their own terms — bring more bait.',
            'alert',
            '#ef4444'
          );
          return;
        }

        soundEngine.playTameCritter();
        tameFauna(fauna.id, 'Base Guardian Stalker', 'patrolling');
          // The World Asks Back (2026-10-16): the tame event for saga latching.
          recordAsksEvent?.({ kind: 'tame', species: fauna.species });

        postNotification(
          'Apex Guardian Tamed!',
          'Chitin-Stalker now patrols your outpost territory and sheds Reinforced Carapace Scales.',
          'tame',
          '#a855f7'
        );

        multiplayerManager.broadcastFaunaTame(fauna.id, multiplayerManager.playerName);
      }

      // Generic nectar flow (creature build phase, slice 1) — every
      // species whose table entry names the standard lure bait tames
      // here, with its odds, name, and pet name read from the table.
      // A species is added to the game by adding its table entry; this
      // branch never grows a per-species arm.
      if (def.bait === 'nectar') {
        if (!hasItem('sweet_nectar', 1)) {
          postNotification('Sweet Nectar Needed', `Harvest Sweet Nectar from Petal-Mills or craft bait in the Bio-Forge [B] to tame a ${def.name}.`, 'alert', '#fbbf24');
          return;
        }

        deductInventoryItem('sweet_nectar', 1);

        // The roll: the nectar is gone either way — bring more bait.
        if (Math.random() > (def.tameChance ?? 0)) {
          postNotification(
            'It Darted Away',
            `The ${def.name} took the nectar and slipped off, still wild.`,
            'alert',
            '#fbbf24'
          );
          return;
        }

        soundEngine.playTameCritter();
        releaseArmedRef.current.delete(fauna.id);
        tameFauna(fauna.id, def.petName, 'following');
          // The World Asks Back (2026-10-16): the tame event for saga latching.
          recordAsksEvent?.({ kind: 'tame', species: fauna.species });

        postNotification(
          'Companion Domesticated!',
          `${def.name} tamed! It follows you${def.byproduct?.tamedOnly ? ` and sheds ${ITEMS[def.byproduct.item]?.name || 'byproducts'}` : ''}. Lure it again to order it to stay or guard.`,
          'tame',
          '#2dd4bf'
        );

        multiplayerManager.broadcastFaunaTame(fauna.id, multiplayerManager.playerName);
        return;
      }

      // Untamable by design (the table says so): the lure is refused
      // politely instead of silently — the mirror moth is fully timid,
      // and no amount of nectar changes that.
      if (def.bait === null) {
        postNotification(
          'It Won\'t Be Lured',
          `The ${def.name} wants nothing from the lure. Some creatures are company, not companions.`,
          'alert',
          '#94a3b8'
        );
        return;
      }
    },
    [hasItem, deductInventoryItem, tameFauna, hearthFeed, loadHeartbearer, postNotification, recordAsksEvent]
  );

  // 6. Bio-Builder Placement
  // Builder on a wall/door panel — the two vertical verbs (Adam,
  // 2026-10-14): with a PANEL selected, STACK it on top of the clicked
  // panel (same edge, same facing, one story up). With a FLOOR selected,
  // lay a CEILING: a floor one story above the clicked panel, over the
  // cell on the PLAYER's side of the wall — the room you're standing in
  // is the one you mean to roof.
  const handleBuilderOnPanel = useCallback(
    (panel: StructureEntity): void => {
      if (!hasItem(selectedStructureType, 1)) {
        postNotification(
          'Insufficient Seed-Nodes',
          `No ${ITEMS[selectedStructureType]?.name || selectedStructureType} remaining in pouch. Synthesize more at Bio-Forge [B].`,
          'alert',
          '#ef4444'
        );
        return;
      }

      const level = (panel.level ?? 0) + 1;

      let spot;
      if (isEdgePanel(selectedStructureType)) {
        // Stack: same edge, one story up.
        spot = {
          gridX: panel.gridX,
          gridZ: panel.gridZ,
          worldX: panel.worldX,
          worldZ: panel.worldZ,
          level,
        };
      } else {
        // Ceiling over the player's-side cell: for an east-west panel the
        // two candidate cells are a meter north/south of the wall line;
        // for a north-south panel, a meter east/west. (Panel lines sit on
        // odd coordinates; cell centers on even ones — one step crosses.)
        const player = getPlayerPosition();
        const runsEastWest = Math.abs(Math.sin(panel.rotation)) < 0.7;
        let cx: number;
        let cz: number;
        if (runsEastWest) {
          cx = panel.worldX;
          cz = panel.worldZ + (player.z >= panel.worldZ ? 1 : -1);
        } else {
          cx = panel.worldX + (player.x >= panel.worldX ? 1 : -1);
          cz = panel.worldZ;
        }
        spot = { gridX: cx / 2, gridZ: cz / 2, worldX: cx, worldZ: cz, level };
      }

      const conflict = occupancyConflict(selectedStructureType, spot, structuresList);
      if (conflict) {
        postNotification(
          'Story Occupied',
          'Something is already built at that height there. Dissolve it with the Solvent Sprayer [4] to rebuild.',
          'alert',
          '#fbbf24'
        );
        return;
      }

      deductInventoryItem(selectedStructureType, 1);
      soundEngine.playBuildPlace();

      const newStruct: StructureEntity = {
        id: 'struct_' + Math.random().toString(36).substring(2, 9),
        type: selectedStructureType,
        gridX: spot.gridX,
        gridZ: spot.gridZ,
        worldX: spot.worldX,
        worldZ: spot.worldZ,
        rotation: isEdgePanel(selectedStructureType) ? panel.rotation : 0,
        level,
        health: 120,
        maxHealth: 120,
        doorOpenProgress: 0,
      };

      addStructure(newStruct);
      postNotification(
        isEdgePanel(selectedStructureType) ? 'Story Stacked' : 'Ceiling Laid',
        isEdgePanel(selectedStructureType)
          ? `${ITEMS[selectedStructureType]?.name} grown on top — story ${level + 1} rises.`
          : `${ITEMS[selectedStructureType]?.name} laid overhead — a ceiling below, the floor of story ${level + 1} above.`,
        'craft',
        '#a855f7'
      );
      multiplayerManager.broadcastEntityUpsert('structure', newStruct);
    },
    [selectedStructureType, hasItem, deductInventoryItem, addStructure, postNotification, structuresList, getPlayerPosition]
  );

  // Builder on a NON-PANEL structure — a forge, a post, a canopy, a
  // cave mouth — with a panel or floor selected: the clicked block is
  // the BASE (Adam, 2026-10-14: walls should build from "any other
  // base block", not just walls). A panel rings the base's cell on the
  // facing edge at the base's own story; a floor roofs the base's cell
  // one story up. Floors and mounds are NOT handled here — the flat-
  // surface routing above already treats them as ground.
  const handleBuilderOnBaseBlock = useCallback(
    (base: StructureEntity): void => {
      if (!hasItem(selectedStructureType as ItemId, 1)) {
        postNotification(
          'Insufficient Seed-Nodes',
          `No ${ITEMS[selectedStructureType as ItemId]?.name || selectedStructureType} remaining in pouch. Synthesize more at Bio-Forge [B].`,
          'alert',
          '#ef4444'
        );
        return;
      }

      const baseLevel = base.level ?? 0;
      let spot;
      let rotation = 0;
      if (isEdgePanel(selectedStructureType)) {
        rotation = getPlacementRotation();
        const p = placementFor(selectedStructureType, base.worldX, base.worldZ, rotation);
        spot = { ...p, level: baseLevel };
      } else {
        // root_tile_floor: a ceiling over the base block's own cell.
        spot = {
          gridX: base.gridX,
          gridZ: base.gridZ,
          worldX: base.gridX * 2,
          worldZ: base.gridZ * 2,
          level: baseLevel + 1,
        };
      }

      const conflict = occupancyConflict(selectedStructureType, spot, structuresList);
      if (conflict) {
        postNotification(
          'Story Occupied',
          'Something is already built at that height there. Dissolve it with the Solvent Sprayer [4] to rebuild.',
          'alert',
          '#fbbf24'
        );
        return;
      }

      deductInventoryItem(selectedStructureType as ItemId, 1);
      soundEngine.playBuildPlace();

      const newStruct: StructureEntity = {
        id: 'struct_' + Math.random().toString(36).substring(2, 9),
        type: selectedStructureType,
        gridX: spot.gridX,
        gridZ: spot.gridZ,
        worldX: spot.worldX,
        worldZ: spot.worldZ,
        rotation: isEdgePanel(selectedStructureType) ? rotation : 0,
        level: spot.level,
        health: 120,
        maxHealth: 120,
        doorOpenProgress: 0,
      };

      addStructure(newStruct);
      postNotification(
        isEdgePanel(selectedStructureType) ? 'Built on Base' : 'Ceiling Laid',
        isEdgePanel(selectedStructureType)
          ? `${ITEMS[selectedStructureType as ItemId]?.name} grown from the ${ITEMS[base.type as ItemId]?.name || base.type} — base blocks anchor building.`
          : `${ITEMS[selectedStructureType as ItemId]?.name} laid overhead — a ceiling below, the floor of story ${spot.level + 1} above.`,
        'craft',
        '#a855f7'
      );
      multiplayerManager.broadcastEntityUpsert('structure', newStruct);
    },
    [selectedStructureType, hasItem, deductInventoryItem, addStructure, postNotification, structuresList, getPlacementRotation]
  );

  const handleBuildPlacement = useCallback(
    (worldX: number, worldZ: number): void => {
      // Building belongs to the surface world in v1: pieces placed in
      // an instance would vanish when the instance closes.
      if (instanceKind() !== 'surface') {
        postNotification('Unstable Ground', instanceKind() === 'ruin'
          ? 'The ruin rejects construction — for now. What you build belongs on the surface.'
          : 'The cavern rejects construction — for now. What you build belongs on the surface.', 'alert', '#fbbf24');
        return;
      }
      if (!hasItem(selectedStructureType, 1)) {
        postNotification(
          'Insufficient Seed-Nodes',
          `No ${ITEMS[selectedStructureType]?.name || selectedStructureType} remaining in pouch. Synthesize more at Bio-Forge [B].`,
          'alert',
          '#ef4444'
        );
        return;
      }

      // Where the piece goes: cell pieces at the cell's center, wall/door
      // PANELS on the cell edge nearest the aim (game/structures/placement.ts) — and
      // occupancy to match: one panel per edge; cell pieces keep the
      // one-ground-layer + one-upright-per-cell rule.
      const rotation = getPlacementRotation();
      const spot = placementFor(selectedStructureType, worldX, worldZ, rotation);
      const conflict = occupancyConflict(selectedStructureType, spot, structuresList);
      if (conflict) {
        // A panel click that lands on an already-walled edge means
        // "build ON that base": stack the panel one story up instead of
        // refusing. This is also how you stack on an IRIS DOOR — its
        // blades open as you approach, so a click aimed at the doorway
        // passes through and hits the ground line, which resolves to
        // the door's edge and stacks onto the door itself (Adam:
        // walls should build from any base block, doors included).
        if (isEdgePanel(selectedStructureType) && isEdgePanel(conflict.type)) {
          handleBuilderOnPanel(conflict);
          return;
        }
        if (isEdgePanel(selectedStructureType)) {
          postNotification(
            'Edge Occupied',
            'A wall or door already stands on that edge. Dissolve it with the Solvent Sprayer [4] to rebuild.',
            'alert',
            '#fbbf24'
          );
        } else if (GROUND_LAYER_TYPES.includes(selectedStructureType)) {
          postNotification(
            'Tile Already Floored',
            'That tile already has a floor or a mound — one ground layer per tile.',
            'alert',
            '#fbbf24'
          );
        } else {
          postNotification(
            'Tile Occupied',
            'Something is already built on that tile. Dissolve it with the Solvent Sprayer [4] to rebuild.',
            'alert',
            '#fbbf24'
          );
        }
        return;
      }

      // The BioTunnel rule (Adam, 2026-10-16): ONE living pair.
      // A third mouth has nowhere to grow — the count spans every
      // visited zone, since the other end may stand countries away.
      if (
        selectedStructureType === 'biotunnel_mouth' &&
        getTunnelMouthCount() >= TUNNEL_MAX_MOUTHS
      ) {
        postNotification(
          'The Tunnel Is Already Whole',
          'One organism, two mouths — that is all a BioTunnel can be. Dissolve an end to move it.',
          'alert',
          '#fbbf24',
        );
        return;
      }

      deductInventoryItem(selectedStructureType, 1);
      soundEngine.playBuildPlace();

      const newStruct: StructureEntity = {
        id: 'struct_' + Math.random().toString(36).substring(2, 9),
        type: selectedStructureType,
        gridX: spot.gridX,
        gridZ: spot.gridZ,
        worldX: spot.worldX,
        worldZ: spot.worldZ,
        // Faces the way the player faces (90° steps) so walls can turn
        // corners and doors open onto the room you built them for.
        rotation,
        health: 120,
        maxHealth: 120,
        doorOpenProgress: 0,
        // A storage pod is born tier 1 and empty (Adam, 2026-10-15).
        ...(selectedStructureType === 'storage_pod' || selectedStructureType === 'sample_rack'
          ? { storage: { tier: 1, items: {} } }
          : {}),
        // A culture vat is born tier 1, resting (Adam, 2026-10-15).
        ...(selectedStructureType === 'culture_vat'
          ? { vat: { tier: 1 } }
          : {}),
        // A BioTunnel mouth is born unpaired; App's pairing sweep
        // lights it when its other half exists (game/world/tunnel.ts).
        ...(selectedStructureType === 'biotunnel_mouth'
          ? { tunnel: { paired: false } }
          : {}),
        // A banner post is born undyed (Ingredient Sinks,
        // 2026-10-17): bare cloth, dyed later by clicking it
        // with cloth in hand (handleStructureInteract).
        ...(selectedStructureType === 'banner_post'
          ? { banner: {} }
          : {}),
      };

      addStructure(newStruct);
      // The World Asks Back (2026-10-16): the build event for saga
      // latching — counted by structure type, stamped where the
      // placement is known good.
      recordAsksEvent?.({ kind: 'build', itemId: selectedStructureType });
      postNotification('Living Composite Placed', `Grown ${ITEMS[selectedStructureType]?.name}. Fully recyclable via Solvent Sprayer [4].`, 'craft', '#a855f7');
      multiplayerManager.broadcastEntityUpsert('structure', newStruct);
    },
    [selectedStructureType, hasItem, deductInventoryItem, addStructure, postNotification, structuresList, getPlacementRotation, recordAsksEvent]
  );

  // Unified Interactions Handlers (Flat, zero else)
  const handleGroundClick = useCallback(
    (worldX: number, worldZ: number): void => {
      // S6 MOVABLE VAULTS: while carrying, the whole kit is inert —
      // gauntlet tools, weapons, the lot. The ONLY live click is the
      // put-down click, routed to the carry's placement handler; a
      // refused spot (red ghost) simply keeps the carry.
      if (carryRef.current) {
        putDownCarryAt(worldX, worldZ);
        return;
      }
      if (activeTool === 'striker') {
        // Striking at open ground: a close weapon swings at the
        // air; a ranged weapon looses at the point (a burst shot
        // still bursts — wild things standing there are struck).
        const weapon = drawnWeapon();
        if (!weapon) return;
        if (weapon.kind === 'ranged') {
          const player = getPlayerPosition();
          if (Math.hypot(worldX - player.x, worldZ - player.z) > 42) return;
        }
        if (!tryStrikePace(weapon)) return;
        if (weapon.kind === 'close') soundEngine.playStrikeSwing();
        else strikerShootAt(weapon, worldX, worldZ, '');
        return;
      }
      if (activeTool === 'builder') {
        handleBuildPlacement(worldX, worldZ);
        return;
      }
      // A grown storage pod is set down BY HAND (Adam, 2026-10-15):
      // it's grown, not built, so the harvest glove — the hand every
      // player starts with — places it when it's the selected
      // blueprint, no Bio-Builder required. Everything BUILT still
      // waits for the Builder module; this is the pod's one
      // exemption, and it runs the builder's own placement path, so
      // occupancy, rotation, and the pod's born-tier-1 storage all
      // behave exactly as a builder placement would.
      if (
        activeTool === 'harvest_glove' &&
        (selectedStructureType === 'storage_pod' ||
          selectedStructureType === 'biotunnel_mouth' ||
          selectedStructureType === 'sample_rack')
      ) {
        handleBuildPlacement(worldX, worldZ);
        return;
      }
      if (activeTool === 'planter_trowel') {
        handlePlanterAction(worldX, worldZ);
        return;
      }
    },
    [activeTool, handleBuildPlacement, handlePlanterAction, selectedStructureType, fireProjectile, triggerShotFx, spendStamina, inventory, strikerDrawRef, getPlayerPosition, carryRef, putDownCarryAt]
  );

  const handleFloraInteract = useCallback(
    (flora: FloraEntity): void => {
      // S6 MOVABLE VAULTS: hands full — the carry leaves the player
      // tool-less for the haul; set the vault down first.
      if (carryRef.current) {
        postNotification('Hands Full', 'Set the carried vault down before using your tools — you are defenseless for the haul.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'harvest_glove') {
        handleHarvestFlora(flora);
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'flora', entity: flora, name: flora.species, details: '' });
        return;
      }
      if (activeTool === 'planter_trowel') {
        handlePlanterAction(flora.x, flora.z, flora);
        return;
      }
      if (activeTool === 'solvent_sprayer') {
        handleSolventFlora(flora);
        return;
      }
      if (activeTool === 'striker') {
        // A plant is not a target: the close draw swings past it,
        // the ranged draw looses at its foot — either way the
        // plant itself is unharmed (the glove does the gathering).
        const weapon = drawnWeapon();
        if (!weapon) return;
        if (!tryStrikePace(weapon)) return;
        if (weapon.kind === 'close') soundEngine.playStrikeSwing();
        else strikerShootAt(weapon, flora.x, flora.z, '');
        return;
      }
    },
    [activeTool, handleHarvestFlora, handleScanTarget, handlePlanterAction, handleSolventFlora, fireProjectile, triggerShotFx, spendStamina, inventory, strikerDrawRef, carryRef, postNotification]
  );

  /**
   * THE STRIKER (weapons build, Adam, 2026-10-16). The seventh
   * slot draws ONE owned weapon — the best of the drawn kind, the
   * other kind if the drawn kind was never grown — and a click
   * uses it in the game's click grammar: click the creature to
   * strike it, click the ground to swing or loose at that point.
   * Close strikes are reach-checked here and land through the sim
   * (damage + flinch); ranged shots enter the sim's projectile
   * ledger aimed at where the target stood. Stamina and cooldown
   * are paid on every attempt, hits and whiffs alike — but never
   * on a click at a COMPANION: the striker stays its hand before
   * any cost, the same immunity the solvent keeps.
   */
  const lastStrikeAtRef = useRef(0);
  const drawnWeapon = (): WeaponDef | undefined => {
    const draw = strikerDrawRef.current;
    return bestWeapon(inventory, draw) ?? bestWeapon(inventory, draw === 'close' ? 'ranged' : 'close');
  };
  /** Gate a strike attempt on the weapon's cooldown and the
   *  player's stamina. The pace stamp is set even when stamina
   *  fails, so a winded player hears about it once per cooldown,
   *  not once per click. */
  const tryStrikePace = (weapon: WeaponDef): boolean => {
    const now = performance.now() / 1000;
    if (now - lastStrikeAtRef.current < weapon.cooldownSeconds) return false;
    lastStrikeAtRef.current = now;
    if (!spendStamina(weapon.staminaCost)) {
      postNotification('Too Winded to Strike', 'Striking takes stamina — catch your breath.', 'alert', '#f59e0b');
      return false;
    }
    return true;
  };
  /** Loose the drawn ranged weapon at a point: the shot enters
   *  the sim's ledger with its travel time, and the tracer flies. */
  const strikerShootAt = (weapon: WeaponDef, x: number, z: number, targetId: string): void => {
    const player = getPlayerPosition();
    const dist = Math.hypot(x - player.x, z - player.z);
    fireProjectile({
      targetId,
      aimX: x,
      aimZ: z,
      damage: weapon.damage,
      burstRadius: weapon.burstRadius,
      travelSeconds: dist / (weapon.projectileSpeed ?? 16),
    });
    soundEngine.playStrikeShot();
    triggerShotFx(x, z, weapon.burstRadius !== undefined);
  };

  const handleFaunaInteract = useCallback(
    (fauna: FaunaEntity): void => {
      // S6 MOVABLE VAULTS: hands full — no lures, scans, strikes, or
      // solvent while the carry rides. Set the vault down first.
      if (carryRef.current) {
        postNotification('Hands Full', 'Set the carried vault down before using your tools — you are defenseless for the haul.', 'alert', '#fbbf24');
        return;
      }
      // THE SHIELD (Adam, 2026-10-17): a raised shield is a wall,
      // not a weapon — lower it before striking.
      if (shieldRaisedRef?.current) {
        postNotification('Shield Raised', 'Your left hand holds a wall — lower the shield before you strike.', 'alert', '#a3e635');
        return;
      }
      if (activeTool === 'taming_lure') {
        handleTameFauna(fauna);
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'fauna', entity: fauna, name: fauna.species, details: '' });
        return;
      }
      if (activeTool === 'solvent_sprayer') {
        // Emergency harm (Adam, 2026-10-16): the solvent that
        // recycles living composites also dissolves living
        // creatures — damage over time, and the creature flees
        // while it works. The sim owns the damage, the flight,
        // and the gates (companions spared, Peaceful spared);
        // this click only stamps the dissolve and plays the spray.
        applyDissolve(fauna.id);
        soundEngine.playSolventSpray();
        triggerSprayJetFx(fauna.x, fauna.z);
        return;
      }
      if (activeTool === 'striker') {
        const weapon = drawnWeapon();
        if (!weapon) return;
        // Companions are immune — the hand stays BEFORE any cost.
        if (fauna.isTamed) {
          postNotification(
            'Companion',
            `${fauna.customName || fauna.species} trusts you — your striker stays its hand. Your weapons never harm your own.`,
            'system',
            '#38bdf8',
          );
          return;
        }
        const player = getPlayerPosition();
        const dist = Math.hypot(fauna.x - player.x, fauna.z - player.z);
        if (weapon.kind === 'ranged' && dist > 42) {
          postNotification('Too Far', 'Even a grown lance has its limits — close the distance.', 'alert', '#f59e0b');
          return;
        }
        if (!tryStrikePace(weapon)) return;
        if (weapon.kind === 'close') {
          soundEngine.playStrikeSwing();
          // Reach, plus a half-meter of grace: a timely hit lands
          // just outside bite range (the table's whole point).
          if (dist <= (weapon.reach ?? 2.4) + 0.6) {
            strikeFauna(fauna.id, weapon.damage, weapon.flinchSeconds ?? 0.35);
            soundEngine.playStrikeHit();
            triggerStrikeHitFx(fauna.x, fauna.z);
          }
        } else {
          strikerShootAt(weapon, fauna.x, fauna.z, fauna.id);
        }
        return;
      }
    },
    [activeTool, handleTameFauna, handleScanTarget, applyDissolve, triggerSprayJetFx, strikeFauna, fireProjectile, triggerShotFx, triggerStrikeHitFx, spendStamina, inventory, strikerDrawRef, postNotification, getPlayerPosition, carryRef]
  );

  // Builder on a CEILING tile with a floor selected: GROW the ceiling
  // one tile in the direction the player faces. Wall-clicks can only
  // roof cells that touch a wall — the middle of a wide room touches
  // none (Adam's 3x3 question, 2026-10-14) — so ceilings extend from
  // themselves, tile by tile, toward where you're looking. Works from
  // below (aim up at the ceiling's edge, face the gap) and from above
  // once you can get up there.
  const handleGrowCeiling = useCallback(
    (tile: StructureEntity): void => {
      if (!hasItem('root_tile_floor', 1)) {
        postNotification(
          'Insufficient Seed-Nodes',
          `No ${ITEMS['root_tile_floor']?.name || 'root_tile_floor'} remaining in pouch. Synthesize more at Bio-Forge [B].`,
          'alert',
          '#ef4444'
        );
        return;
      }

      const rotation = getPlacementRotation();
      const dx = Math.round(Math.sin(rotation));
      const dz = Math.round(Math.cos(rotation));
      const level = tile.level ?? 0;
      const spot = {
        gridX: tile.gridX + dx,
        gridZ: tile.gridZ + dz,
        worldX: tile.worldX + dx * 2,
        worldZ: tile.worldZ + dz * 2,
        level,
      };

      if (occupancyConflict('root_tile_floor', spot, structuresList)) {
        postNotification(
          'Story Occupied',
          'That tile is already covered at this height.',
          'alert',
          '#fbbf24'
        );
        return;
      }

      deductInventoryItem('root_tile_floor', 1);
      soundEngine.playBuildPlace();

      const newStruct: StructureEntity = {
        id: 'struct_' + Math.random().toString(36).substring(2, 9),
        type: 'root_tile_floor',
        gridX: spot.gridX,
        gridZ: spot.gridZ,
        worldX: spot.worldX,
        worldZ: spot.worldZ,
        rotation: 0,
        level,
        health: 120,
        maxHealth: 120,
        doorOpenProgress: 0,
      };

      addStructure(newStruct);
      postNotification(
        'Ceiling Grown',
        `${ITEMS['root_tile_floor']?.name} extended overhead — story ${level + 1}'s floor grows toward your facing.`,
        'craft',
        '#a855f7'
      );
      multiplayerManager.broadcastEntityUpsert('structure', newStruct);
    },
    [hasItem, deductInventoryItem, addStructure, postNotification, structuresList, getPlacementRotation]
  );

  // ---- Vine ladders (Part 3): grow them on walls, click to climb -------
  // A ladder segment hangs on a wall's edge at one story: it carries the
  // player between that story and the one above, from EITHER side cell
  // (you climb the wall face you're standing against). Segments stack as
  // the wall grows: extending requires a wall at the next story up.

  const ladderSpotOf = (panel: StructureEntity) => ({
    gridX: panel.gridX,
    gridZ: panel.gridZ,
    worldX: panel.worldX,
    worldZ: panel.worldZ,
    level: panel.level ?? 0,
  });

  const placeLadderSegment = (spot: ReturnType<typeof ladderSpotOf>): void => {
    deductInventoryItem('vine_ladder', 1);
    soundEngine.playBuildPlace();
    const newStruct: StructureEntity = {
      id: 'struct_' + Math.random().toString(36).substring(2, 9),
      type: 'vine_ladder',
      gridX: spot.gridX,
      gridZ: spot.gridZ,
      worldX: spot.worldX,
      worldZ: spot.worldZ,
      rotation: structuresList.find(
        (s) => isEdgePanel(s.type) && s.worldX === spot.worldX && s.worldZ === spot.worldZ && (s.level ?? 0) === spot.level,
      )?.rotation ?? 0,
      level: spot.level,
      health: 120,
      maxHealth: 120,
      doorOpenProgress: 0,
    };
    addStructure(newStruct);
    multiplayerManager.broadcastEntityUpsert('structure', newStruct);
  };

  const noLaddersToast = (): void =>
    postNotification(
      'Insufficient Seed-Nodes',
      `No ${ITEMS['vine_ladder']?.name || 'vine_ladder'} remaining in pouch. Synthesize more at Bio-Forge [B].`,
      'alert',
      '#ef4444'
    );

  // Builder + ladder selected + click a WALL: grow the first segment.
  const handlePlaceLadder = useCallback(
    (panel: StructureEntity): void => {
      if (!hasItem('vine_ladder', 1)) {
        noLaddersToast();
        return;
      }
      const spot = ladderSpotOf(panel);
      if (occupancyConflict('vine_ladder', spot, structuresList)) {
        postNotification('Ladder Already Grown', 'A vine ladder already climbs this wall at this height.', 'alert', '#fbbf24');
        return;
      }
      placeLadderSegment(spot);
      postNotification('Ladder Grown', 'A vine ladder climbs this wall. Click it to climb up.', 'craft', '#84cc16');
    },
    [hasItem, postNotification, structuresList, deductInventoryItem, addStructure]
  );

  // Builder + ladder selected + click a LADDER: grow it one story up.
  const handleExtendLadder = useCallback(
    (ladder: StructureEntity): void => {
      if (!hasItem('vine_ladder', 1)) {
        noLaddersToast();
        return;
      }
      const level = (ladder.level ?? 0) + 1;
      const wallAbove = structuresList.some(
        (s) => isEdgePanel(s.type) && s.worldX === ladder.worldX && s.worldZ === ladder.worldZ && (s.level ?? 0) === level,
      );
      if (!wallAbove) {
        postNotification('Nothing to Grow Onto', 'Ladders climb walls — stack a wall above this one first.', 'alert', '#fbbf24');
        return;
      }
      const spot = { ...ladderSpotOf(ladder), level };
      if (occupancyConflict('vine_ladder', spot, structuresList)) {
        postNotification('Ladder Already Grown', 'The ladder already reaches that story here.', 'alert', '#fbbf24');
        return;
      }
      placeLadderSegment(spot);
      postNotification('Ladder Extended', `The vine ladder now reaches story ${level + 1}.`, 'craft', '#84cc16');
    },
    [hasItem, postNotification, structuresList, deductInventoryItem, addStructure]
  );

  // Any other tool + click a LADDER: climb it (up from its own story,
  // down from the story above). You must stand in a cell the ladder's
  // edge touches, and there must be footing on the far side.
  const handleClimbLadder = useCallback(
    (ladder: StructureEntity): void => {
      const player = getPlayerPosition();
      const playerLevel = getPlayerLevel();
      const cellGX = Math.round(player.x / 2);
      const cellGZ = Math.round(player.z / 2);

      // Adjacency: the player's cell center must sit exactly one meter
      // off the ladder's line, along the axis the ladder faces.
      const runsEastWest = Math.abs(Math.sin(ladder.rotation)) < 0.7;
      const adjacent = runsEastWest
        ? cellGX * 2 === ladder.worldX && Math.abs(cellGZ * 2 - ladder.worldZ) === 1
        : cellGZ * 2 === ladder.worldZ && Math.abs(cellGX * 2 - ladder.worldX) === 1;
      if (!adjacent) {
        postNotification('Too Far to Climb', 'Stand right beside the ladder, in a cell its wall touches.', 'alert', '#fbbf24');
        return;
      }

      const ladderLevel = ladder.level ?? 0;
      const hasFooting = (level: number): boolean =>
        level === 0 ||
        structuresList.some(
          (s) => s.type === 'root_tile_floor' && (s.level ?? 0) === level && s.gridX === cellGX && s.gridZ === cellGZ,
        );

      if (playerLevel === ladderLevel) {
        const target = ladderLevel + 1;
        if (!hasFooting(target)) {
          postNotification('Nothing to Stand On', 'Lay a ceiling floor above this side of the ladder first.', 'alert', '#fbbf24');
          return;
        }
        applyPlayerLevel(target);
        soundEngine.playBuildPlace();
        return;
      }
      if (playerLevel === ladderLevel + 1) {
        if (!hasFooting(ladderLevel)) {
          postNotification('Nothing to Stand On', 'There is no floor below this side of the ladder anymore.', 'alert', '#fbbf24');
          return;
        }
        applyPlayerLevel(ladderLevel);
        soundEngine.playBuildPlace();
        return;
      }
      postNotification('Out of Reach', 'This ladder does not reach the story you are standing on.', 'alert', '#fbbf24');
    },
    [getPlayerPosition, getPlayerLevel, applyPlayerLevel, structuresList, postNotification]
  );

 const handleStructureInteract = useCallback(
  (structure: StructureEntity): void => {
    // S6 MOVABLE VAULTS: hands full — no panels, portals, or tools
    // while carrying (the carried entity is out of the lists, so
    // nothing below could see it anyway). Set the vault down first.
    if (carryRef.current) {
      postNotification('Hands Full', 'Set the carried vault down before using your tools — you are defenseless for the haul.', 'alert', '#fbbf24');
      return;
    }
    // The Banner Post's dye (Ingredient Sinks, 2026-10-17): a
    // bare-hand act, any tool in hand. The first dyeable cloth
    // the player carries is spent, and the banner takes that
    // cloth's registry color — every textile in the game is a
    // dye. Re-dyeing is allowed (a new cloth over the old).
    if (structure.type === 'banner_post') {
      const DYE_CLOTHS: ItemId[] = [
        'veil_cloth', 'rib_silk', 'deck_silk', 'kite_ribbon',
        'mother_wool', 'dusk_wool', 'lambswool', 'banner_fiber',
      ];
      const dye = DYE_CLOTHS.find((id) => (inventory[id] ?? 0) > 0);
      if (!dye) {
        postNotification(
          'Bare Cloth',
          'This banner flies undyed. Carry cloth, silk, or wool and click it to give it a color.',
          'system',
          '#c2b49a'
        );
        return;
      }
      deductInventoryItem(dye, 1);
      const dyeDef = ITEMS[dye];
      upsertStructure({
        ...structure,
        banner: { tint: dye, tintColor: dyeDef?.color ?? '#b3a284' },
      });
      postNotification(
        'Banner Dyed',
        `The cloth drinks the ${dyeDef?.name ?? dye} and flies its color.`,
        'craft',
        dyeDef?.color ?? '#c2b49a'
      );
      return;
    }
    // Builder on a ceiling tile with a floor selected: grow the ceiling
    // toward your facing — checked BEFORE the flat-surface routing,
    // which would otherwise treat the tile as ground.
    if (
      activeTool === 'builder' &&
      structure.type === 'root_tile_floor' &&
      (structure.level ?? 0) > 0 &&
      selectedStructureType === 'root_tile_floor'
    ) {
      handleGrowCeiling(structure);
      return;
    }
    // Builder on flat surfaces: floors and mounds act as ground for placement
    if (activeTool === 'builder' && (structure.type === 'root_tile_floor' || structure.type === 'cultivation_mound')) {
      handleGroundClick(structure.worldX, structure.worldZ);
      return;
    }
    // Planter on flat surfaces: a mound IS soil, so any seed plants there.
    if (activeTool === 'planter_trowel' && structure.type === 'cultivation_mound') {
      handlePlanterAction(structure.worldX, structure.worldZ);
      return;
    }
    // Planter on a floor: floors are paved, and only lantern-ferns root on
    // them — they are the house-lighting plant. Other seeds get a hint
    // instead of the old silent nothing.
    if (activeTool === 'planter_trowel' && structure.type === 'root_tile_floor') {
      if (selectedSeedId !== 'seed_lantern_fern') {
        postNotification('Needs Open Soil', 'Only Lantern-Ferns root on paved floors — other seeds need unpaved ground or a cultivation mound.', 'alert', '#fbbf24');
        return;
      }
      handlePlanterAction(structure.worldX, structure.worldZ);
      return;
    }
    // Builder on a wall/door panel: stack a panel or lay a ceiling.
    if (
      activeTool === 'builder' &&
      isEdgePanel(structure.type) &&
      (isEdgePanel(selectedStructureType) || selectedStructureType === 'root_tile_floor')
    ) {
      handleBuilderOnPanel(structure);
      return;
    }
    // Builder on any OTHER structure (forge, post, canopy, turret,
    // cave mouth...) with a panel or floor selected: build from that
    // base block. Floors/mounds never reach here (flat-surface routing
    // above claims them first).
    // The cave exit is a portal, not a prop: every ordinary tool steps
    // through it (App owns the transition back to the surface anchor).
    // Solvent is refused, the scanner describes, the builder's base-
    // block case never sees it — this branch runs first on purpose.
    if (structure.type === 'cave_exit') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'The way home is part of the cave itself — the solvent cannot take it.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onExitCave();
      return;
    }
    // The descent shaft is a portal of the same family: every
    // ordinary tool steps DOWN it (App owns the level transition),
    // solvent is refused, the scanner describes. It runs before the
    // builder's base-block case for the same reason the exit does —
    // a doorway is not a building block.
    if (structure.type === 'cave_descent') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'The shaft is the cave\'s own throat — the solvent cannot take it.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onDescendCave(structure);
      return;
    }
    // The vine shaft is the third portal of the cave family: every
    // ordinary tool CLIMBS it (App owns the ride to the surface),
    // solvent is refused (the vine is alive), the scanner describes.
    if (structure.type === 'vine_shaft') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'The vine is alive, and rooted deeper than the solvent can reach.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onVineClimb(structure);
      return;
    }
    // The ruin threshold is the ruin family's cave exit: every
    // ordinary tool steps OUT through it (App owns the transition),
    // solvent is refused, the scanner describes.
    if (structure.type === 'ruin_exit') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'The threshold is part of the ruin itself — the solvent cannot take it.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onExitRuin();
      return;
    }
    if (
      activeTool === 'builder' &&
      !isEdgePanel(structure.type) &&
      structure.type !== 'vine_ladder' &&
      (isEdgePanel(selectedStructureType) || selectedStructureType === 'root_tile_floor')
    ) {
      handleBuilderOnBaseBlock(structure);
      return;
    }
    // Cave mouths are world-grown, not built: no tool edits them. The
    // solvent is refused outright, the scanner reads the link record,
    // anything else just tells you what you're looking at. (Builder
    // clicks with a panel/floor selected were claimed by the base-
    // block case above — a cave mouth IS a base block.)
    if (structure.type === 'cave_mouth') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'Ancient stone shrugs off the solvent — cave mouths are part of the world, not your building.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      // Any other tool steps through: the interior is IN (P3 wired
      // 2026-10-14) — App generates the mouth's cavern from its
      // instanceId and swaps the world for the instance.
      onEnterCave(structure);
      return;
    }
    // Ruin landmarks are world-grown too (P4 surface stage): the
    // solvent can't take them, the scanner reads them, and every
    // other tool STEPS INSIDE (P4 interior stage — App generates the
    // interior from the landmark's link record). 'Traces' landmarks
    // are surface remnants only: there is no inside to enter.
    if (structure.type === 'ruin_landmark') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'Ancient stone shrugs off the solvent — precursor ruins are part of the world, not your building.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      if (structure.ruin?.tier === 'traces') {
        postNotification('A Scattered Remnant', 'Broken shards of something far older, half-swallowed by the soil. Whatever stood here, only its teeth remain.', 'system', '#a8a29e');
        return;
      }
      onEnterRuin(structure);
      return;
    }
    // Ruin interior contents (P4): caches and the artifact heart are
    // one-shot loot — the harvest glove works their seals, then
    // they're spent (the interior regenerates pristine next entry,
    // like wild cave flora). Glyphs are read, not taken. Solvent is
    // refused on all of it; the scanner describes instead.
    if (structure.type === 'precursor_cache' || structure.type === 'artifact_heart') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'Precursor work outlasts solvent — whatever this holds, it keeps until opened properly.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      if (activeTool !== 'harvest_glove') {
        postNotification(
          structure.type === 'artifact_heart' ? 'The Artifact Heart' : 'A Sealed Cache',
          'The harvest glove works the seal — other tools would only scar it.',
          'system',
          '#a8a29e'
        );
        return;
      }
      const band = structure.ruinFeature?.band ?? 'shallow';
      const fate = structure.ruinFeature?.fate ?? 'gardeners';
      const collected = new Map<ItemId, number>();
      if (structure.type === 'artifact_heart') {
        // The deepest room's prize: precursor shards + essence, and
        // the fate's heart line — the closest thing to an ending the
        // ruins ever state outright.
        collected.set('precursor_shard', 2);
        collected.set('dew_essence', 2);
        // Ask the World (Adam, 2026-10-16): every heart also keeps
        // ONE Fate Fragment — the set piece the chapter is assembled
        // from. Hearts are one-shot (the structure is consumed
        // below), so each ruin yields exactly one, ever.
        collected.set('aw_fragment', 1);
        for (const [item, n] of collected) addInventoryItem(item, n);
        triggerHarvestFx(structure.worldX, structure.worldZ);
        removeStructure(structure.id);
        postNotification('The Heart of the Ruin', `${ruinLoreLine(fate, 'heart')} Taken: ${formatCollected(collected)}.`, 'discover', '#fb7185');
        onHeartReached?.();
      } else {
        for (const [item, n] of rollRuinCacheLoot(structure.id, band)) {
          addInventoryItem(item, n);
          collected.set(item, n);
        }
        triggerHarvestFx(structure.worldX, structure.worldZ);
        removeStructure(structure.id);
        postNotification('Cache Opened', `The seal gives with a sigh of old air. Collected ${formatCollected(collected)}.`, 'harvest', '#67e8f9');
      }
      return;
    }
    if (structure.type === 'ruin_glyph') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'The glyph has outlasted centuries and worse than solvent.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      // Reading a glyph serves the fate's lore line for its band —
      // the story is the loot. Repeatable: stones don't mind.
      const band = structure.ruinFeature?.band === 'deep' ? 'deep' : 'shallow';
      const fate = structure.ruinFeature?.fate ?? 'gardeners';
      postNotification('What the Stone Remembers', ruinLoreLine(fate, band), 'system', '#a5b4fc');
      // The Ask the World line counts DISTINCT ruins read (App
      // derives the ruin from the structure id and dedupes).
      onGlyphRead?.(structure.id);
      return;
    }
    // Vine ladders: builder grows them (on a wall, or up from a ladder);
    // every other tool CLIMBS them. Solvent and scanner keep their
    // usual meanings on a ladder, so they are handled below as normal.
    if (activeTool === 'builder' && selectedStructureType === 'vine_ladder' && isEdgePanel(structure.type)) {
      handlePlaceLadder(structure);
      return;
    }
    if (structure.type === 'vine_ladder' && activeTool !== 'solvent_sprayer' && activeTool !== 'bio_scanner') {
      if (activeTool === 'builder' && selectedStructureType === 'vine_ladder') {
        handleExtendLadder(structure);
      } else {
        handleClimbLadder(structure);
      }
      return;
    }
    // Storage pods (Adam, 2026-10-15): any tool except the builder
    // OPENS the pod's panel — solvent and scanner keep their
    // meanings (solvent dissolves WITH a spill, handled inside).
    // The builder falls through, so a pod still works as a base
    // block to build on, like any upright piece.
    if ((structure.type === 'storage_pod' || structure.type === 'sample_rack') && activeTool !== 'builder') {
      if (activeTool === 'solvent_sprayer') {
        handleSolventSprayer(structure);
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onOpenStorage(structure);
      return;
    }
    // Culture vats (Adam, 2026-10-15): the pod's exact grammar —
    // any tool except the builder opens the vat's panel; solvent
    // and scanner keep their meanings.
    if (structure.type === 'culture_vat' && activeTool !== 'builder') {
      if (activeTool === 'solvent_sprayer') {
        handleSolventSprayer(structure);
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onOpenVat(structure);
      return;
    }
    // BioTunnel mouths (Adam, 2026-10-16): the pod's grammar with
    // a journey at the end of it. Solvent dissolves (the pouch gets
    // the mouth back; the survivor goes dormant on its own), the
    // scanner reads it, the builder falls through to build on it,
    // and every other tool STEPS THROUGH — App runs the transit.
    if (structure.type === 'biotunnel_mouth' && activeTool !== 'builder') {
      if (activeTool === 'solvent_sprayer') {
        handleSolventSprayer(structure);
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onTunnelTransit(structure);
      return;
    }
    if (activeTool === 'solvent_sprayer') {
      handleSolventSprayer(structure);
      return;
    }
    if (activeTool === 'bio_scanner') {
      handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
      return;
    }
    if (structure.type === 'bio_forge_station') {
      onOpenBioForgeModal();
      return;
    }
  },
  [activeTool, handleSolventSprayer, handleScanTarget, onOpenBioForgeModal, onOpenStorage, handleGroundClick, handlePlanterAction, selectedSeedId, selectedStructureType, handleBuilderOnPanel, handleBuilderOnBaseBlock, handleGrowCeiling, handlePlaceLadder, handleExtendLadder, handleClimbLadder, postNotification, onEnterCave, onExitCave, carryRef]
);

  return {
    handleHarvestFlora,
    handleScanTarget,
    handlePlanterAction,
    handleSolventSprayer,
    handleTameFauna,
    handleBuildPlacement,
    handleGroundClick,
    handleFloraInteract,
    handleFaunaInteract,
    handleStructureInteract,
  };
}
