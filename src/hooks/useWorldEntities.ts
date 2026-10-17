/**
 * BioForge World Entities & Ecosystem Simulation Domain Hook
 * Manages flora, fauna, living structures, and dropped byproduct items
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FloraEntity,
  FaunaEntity,
  FaunaSpecies,
  StructureEntity,
  DroppedItemEntity,
} from '../types/game';
import { multiplayerManager } from '../game/multiplayer';
import { speciesDef } from '../game/creatures/species';
import { sampleItemId, SAMPLE_SHED_SECONDS_TAMED, SAMPLE_SHED_SECONDS_WILD } from '../game/structures/vat';
import type { ItemId } from '../types/game';
import type { WorldSnapshot } from '../game/saveSystem';
import type { AsksEventInput } from '../game/quests/asksBackState';


// Base time for a plant to go from planted to harvest-ready. Slowed
// from 90 to 120 (2026-10-13) so a garden is a project, not a pause.
export const FLORA_MATURE_SECONDS = 120;
// Growth fertilizer is a BOOST WITH A DURATION, not an instant mature:
// while a plant's fertilizerTimer runs, it grows at FERTILIZED_GROWTH_MULT.
export const FERTILIZER_DURATION_SECONDS = 30;
export const FERTILIZED_GROWTH_MULT = 2.5;
// Rich soil: a plant rooted on a cultivation mound's cell grows faster,
// permanently — the mound's whole reason to exist. Stacks with fertilizer.
export const MOUND_GROWTH_MULT = 1.5;
export const FOLLOW_OFFSET = 2.5;
export const WANDER_CHANCE = 0.015;
export const WANDER_RADIUS = 12;
// Restless wandering: a creature standing AT its target re-rolls with this
// much higher chance — short pauses, long roams. The old single slow rate
// is why wild stalkers stood like statues ~70% of the time.
export const WANDER_CHANCE_RESTLESS = 0.08;
// The stalker's original aggro range, kept as the historical
// constant. Since slice 5 the sim reads each hunter's range from
// the species table (the stalker's table entry carries this same
// 8); this export remains for anything that still cites it.
export const AGGRO_RANGE = 8;
// Guard-stalker patrol: waypoints are picked on a ring this wide (meters)
// around the anchor; arriving this close picks the next point.
export const PATROL_RADIUS = 5;
export const PATROL_ARRIVAL_DISTANCE = 0.6;
// Guard-collectors (soft-puffs, burrow mice) fetch drops within this
// radius of themselves and "pick up" on reaching this distance.
export const COLLECT_SEARCH_RADIUS = 12;
export const COLLECT_REACH = 0.8;

const FAUNA_SYNC_INTERVAL = 0.5;

const INITIAL_FLORA: FloraEntity[] = [
  // Violet Cradle Flora
  {
    id: 'flora_1',
    species: 'lantern_fern',
    x: -12,
    z: -14,
    rotation: 0.3,
    scale: 1,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: false,
    swayOffset: 0,
  },
  {
    id: 'flora_2',
    species: 'bell_bloom',
    x: -18,
    z: -8,
    rotation: 1.2,
    scale: 1.1,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: false,
    swayOffset: 1,
  },
  // Turquoise Glade Flora
  {
    id: 'flora_3',
    species: 'bell_bloom',
    x: 16,
    z: -18,
    rotation: 0.7,
    scale: 1.2,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: false,
    swayOffset: 2,
  },
  {
    id: 'flora_4',
    species: 'lantern_fern',
    x: 22,
    z: -12,
    rotation: 2.1,
    scale: 1,
    growthStage: 2,
    growthProgress: 0.7,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: false,
    harvestTimer: 54,
    isHazardous: false,
    swayOffset: 3,
  },
  // Amber Thicket Flora
  {
    id: 'flora_5',
    species: 'sap_weaver',
    x: -15,
    z: 16,
    rotation: 0.5,
    scale: 1.3,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: false,
    swayOffset: 0.5,
  },
  {
    id: 'flora_6',
    species: 'petal_mill',
    x: -24,
    z: 20,
    rotation: 1.8,
    scale: 1.1,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: false,
    swayOffset: 1.5,
  },
  // Prismatic Verge Flora
  {
    id: 'flora_7',
    species: 'snap_trap',
    x: 18,
    z: 18,
    rotation: 0.9,
    scale: 1.2,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: true,
    swayOffset: 0,
  },
  {
    id: 'flora_8',
    species: 'petal_mill',
    x: 26,
    z: 22,
    rotation: 2.4,
    scale: 1,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: false,
    swayOffset: 2.5,
  },
];

const INITIAL_FAUNA: FaunaEntity[] = [
  {
    id: 'fauna_1',
    species: 'soft_puff',
    x: -8,
    z: -10,
    y: 0,
    rotation: 0,
    state: 'wandering',
    isTamed: false,
    targetX: -8,
    targetZ: -10,
    speed: 1.8,
    health: 40,
    maxHealth: 40,
    byproductTimer: 0,
    animTime: 0,
  },
  {
    id: 'fauna_2',
    species: 'soft_puff',
    x: 12,
    z: -14,
    y: 0,
    rotation: 1.5,
    state: 'wandering',
    isTamed: false,
    targetX: 12,
    targetZ: -14,
    speed: 1.6,
    health: 40,
    maxHealth: 40,
    byproductTimer: 0,
    animTime: 1,
  },
  {
    id: 'fauna_3',
    species: 'chitin_stalker',
    x: 20,
    z: 14,
    y: 0,
    rotation: 2.8,
    state: 'wandering',
    isTamed: false,
    targetX: 20,
    targetZ: 14,
    speed: 2.4,
    health: 120,
    maxHealth: 120,
    byproductTimer: 0,
    animTime: 0,
  },
  {
    // Burrow mice existed on paper only (codex + tame rules) until now —
    // nothing ever spawned one. Two join the starting world; their model
    // is the engine's plain amber critter until they earn a custom one.
    id: 'fauna_4',
    species: 'burrow_mouse',
    x: -16,
    z: 6,
    y: 0,
    rotation: 0.8,
    state: 'wandering',
    isTamed: false,
    targetX: -16,
    targetZ: 6,
    speed: 2.0,
    health: 30,
    maxHealth: 30,
    byproductTimer: 0,
    animTime: 0,
  },
  {
    id: 'fauna_5',
    species: 'burrow_mouse',
    x: -4,
    z: 18,
    y: 0,
    rotation: 2.1,
    state: 'wandering',
    isTamed: false,
    targetX: -4,
    targetZ: 18,
    speed: 1.7,
    health: 30,
    maxHealth: 30,
    byproductTimer: 0,
    animTime: 2,
  },
];

export const INITIAL_STRUCTURES: StructureEntity[] = [
  {
    // The heart cell of the homestead pad is the Heart Tile
    // (Adam, 2026-10-16): the default respawn point, there from the
    // world's first morning. Everywhere else a root floor serves.
    id: 'struct_start_heart_tile',
    type: 'heart_tile',
    gridX: 0,
    gridZ: 0,
    worldX: 0,
    worldZ: 0,
    rotation: 0,
    health: 100,
    maxHealth: 100,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_floor_2',
    type: 'root_tile_floor',
    gridX: 1,
    gridZ: 0,
    worldX: 2,
    worldZ: 0,
    rotation: 0,
    health: 100,
    maxHealth: 100,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_floor_3',
    type: 'root_tile_floor',
    gridX: 0,
    gridZ: 1,
    worldX: 0,
    worldZ: 2,
    rotation: 0,
    health: 100,
    maxHealth: 100,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_floor_4',
    type: 'root_tile_floor',
    gridX: 1,
    gridZ: 1,
    worldX: 2,
    worldZ: 2,
    rotation: 0,
    health: 100,
    maxHealth: 100,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_wall_1',
    type: 'chitin_glass_wall',
    gridX: 0,
    gridZ: 0,
    worldX: 0,
    worldZ: -1,
    rotation: 0,
    health: 150,
    maxHealth: 150,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_door',
    type: 'iris_slit_door',
    gridX: 1,
    gridZ: 0,
    worldX: 2,
    worldZ: -1,
    rotation: 0,
    health: 120,
    maxHealth: 120,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_forge',
    type: 'bio_forge_station',
    gridX: 2,
    gridZ: 2,
    worldX: 4,
    worldZ: 4,
    rotation: 0,
    health: 250,
    maxHealth: 250,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_mound',
    type: 'cultivation_mound',
    gridX: -2,
    gridZ: 0,
    worldX: -4,
    worldZ: 0,
    rotation: 0,
    health: 80,
    maxHealth: 80,
    doorOpenProgress: 0,
  },
];

export interface UseWorldEntitiesResult {
  floraList: FloraEntity[];
  faunaList: FaunaEntity[];
  structuresList: StructureEntity[];
  droppedItems: DroppedItemEntity[];
  addFlora: (flora: FloraEntity) => void;
  upsertFlora: (flora: FloraEntity) => void;
  removeFlora: (floraId: string) => void;
  resetFloraHarvest: (floraId: string, regrowthDuration: number) => void;
  applyFloraFertilizer: (floraId: string, type: 'growth' | 'yield') => void;
  addStructure: (structure: StructureEntity) => void;
  upsertStructure: (structure: StructureEntity) => void;
  removeStructure: (structureId: string) => void;
  tameFauna: (faunaId: string, customName: string, state: FaunaEntity['state']) => void;
  hearthFeed: (faunaId: string) => number;
  loadHeartbearer: (faunaId: string, item: ItemId) => number;
  setFaunaCommand: (faunaId: string, cmd: 'follow' | 'stay' | 'guard') => void;
  releaseFauna: (faunaId: string, settleName?: string) => void;
  applyDissolve: (faunaId: string) => void;
  /** One close-striker hit: damage + flinch, sim-gated (weapons). */
  strikeFauna: (faunaId: string, damage: number, flinchSeconds: number) => void;
  /** One ranged shot: resolves on the sim clock after its travel. */
  fireProjectile: (shot: { targetId: string; aimX: number; aimZ: number; damage: number; burstRadius?: number; travelSeconds: number }) => void;
  upsertFauna: (fauna: FaunaEntity) => void;
  removeFauna: (faunaId: string) => void;
  spawnDroppedItem: (itemId: DroppedItemEntity['itemId'], count: number, x: number, z: number) => void;
  upsertDroppedItem: (item: DroppedItemEntity) => void;
  removeDroppedItem: (itemId: string) => void;
  replaceWorld: (world: WorldSnapshot) => void;

  updateTick: (
    dt: number,
    playerX: number,
    playerZ: number,
    onPickupItem: (item: DroppedItemEntity) => void,
    onCritterExcrete?: (species: string) => void,
    /** Danger system (slice 5): fired when a wild hunter's bite
     *  lands. The caller (the game loop) owns player health and
     *  applies the house damage pattern. */
    onFaunaAttack?: (species: FaunaSpecies, damage: number) => void,
    /** True on Normal/Hostile worlds: hunters chase and bite.
     *  False (Peaceful): the alert theater only, no teeth. */
    attacksArmed?: boolean
  ) => void;
}

export function useWorldEntities(): UseWorldEntitiesResult {
  const [floraList, setFloraList] = useState<FloraEntity[]>(INITIAL_FLORA);
  const [faunaList, setFaunaList] = useState<FaunaEntity[]>(INITIAL_FAUNA);
  const [structuresList, setStructuresList] = useState<StructureEntity[]>(INITIAL_STRUCTURES);
  const [droppedItems, setDroppedItems] = useState<DroppedItemEntity[]>([]);
  const faunaSyncTimer = useRef(0);

  // Mirror of the drop list for the fauna tick: guard-collectors hunt
  // drops while the fauna pass runs, and React state itself cannot be
  // read from inside another list's updater.
  const droppedItemsRef = useRef<DroppedItemEntity[]>([]);
  useEffect(() => {
    droppedItemsRef.current = droppedItems;
  }, [droppedItems]);

  // Same mirror trick for structures: the flora pass needs to know which
  // cells hold cultivation mounds (rich-soil growth bonus).
  const structuresRef = useRef<StructureEntity[]>([]);
  useEffect(() => {
    structuresRef.current = structuresList;
  }, [structuresList]);

  // Same mirror trick for fauna (slice 39): the Hearth Dog's
  // courtship reads the dog synchronously — counting an offering
  // cannot wait on a state updater's schedule.
  const faunaRef = useRef<FaunaEntity[]>([]);
  useEffect(() => {
    faunaRef.current = faunaList;
  }, [faunaList]);

  // Hearth Dog arrival bookkeeping (slice 39, 2026-10-16): when
  // this zone was entered (the dog arrives "one morning", not
  // the second you cross a border — ten settled seconds first),
  // when the last dog departed undecided (another may come,
  // after a while), and when the last arrival spawned (a guard
  // against re-entry while the state write is still landing).
  const hearthRef = useRef({ zoneEnteredAt: -1_000_000, lastDepartureAt: -1_000_000, lastArrivalAt: -1_000_000 });

  // Same mirror trick for flora (slice 42): the Moon Moth's
  // candle road reads the zone's Night Candles from the tick.
  const floraRef = useRef<FloraEntity[]>([]);
  useEffect(() => {
    floraRef.current = floraList;
  }, [floraList]);

  // Hollow Hermit encounter bookkeeping (slice 42, 2026-10-16):
  // seconds of qualifying stillness each hermit has been shown
  // tonight (accumulated in the tick, spent at dawn), the last
  // phase seen (dawn is a crossing, not a state), and the
  // player's last position (stillness is measured, not assumed).
  const hermitRegardRef = useRef<Map<string, number>>(new Map());
  // Cadence for the wisp/hearthpod assignment pass (slice 43).
  const wispCheckRef = useRef(0);
  // Root Otter cache clocks (slice 44): seconds since each
  // otter last banked a cache. Per-otter, unhurried, unseen —
  // dividends are not announced.
  const otterCacheRef = useRef<Map<string, number>>(new Map());
  // Boiler Crab vent-witness dwell (slice 47): seconds each
  // crab has spent in a player's close company — its steam
  // vents on a seven-second cycle (mesh-side), so seven
  // seconds near one is a witnessed venting.
  const crabDwellRef = useRef<Map<string, number>>(new Map());
  // The Lodestone Hound's stare (slice 51): per-hound encounter
  // records — stare seconds accrued, and whether the stare has
  // completed (the charge earned). Session-transient like the
  // crab's dwell map: an interrupted encounter simply re-stares.
  const stareRef = useRef<Map<string, { t: number; committed: boolean }>>(new Map());
  // The Hush Hound's pursuit clock (slice 51): continuous
  // seconds a committed hound has held its hunt — the Field
  // Note witnesses the pursuit, not the meeting.
  const hushPursuitRef = useRef<Map<string, number>>(new Map());
  // Meadowback sentinel bookkeeping (slice 49): each sentinel's
  // last bell (sim seconds — the cooldown is the sentinel's own
  // patience) and whether a hunter stood in its regard last tick
  // (the Peaceful visitor-bell is an ARRIVAL, edge-triggered,
  // not a state).
  const sentinelBellRef = useRef<Map<string, number>>(new Map());
  const sentinelWatchRef = useRef<Map<string, boolean>>(new Map());
  // The last puff-hour seen (slice 47): Puffbells puff as the
  // shared phase crosses each hour mark; the flora tick below
  // compares hour indices to catch the turn.
  const puffHourRef = useRef(-1);
  const prevPhaseRef = useRef(0.35);
  const lastPlayerPosRef = useRef<{ x: number; z: number } | null>(null);

  // Culture-vat gestation clock (2026-10-16): progress accrues in
  // the tick every frame, but the structures list is only WRITTEN
  // when a whole second has accrued — a per-frame write would
  // re-render the app at sim rate for the sake of a patience bar.
  const vatClockRef = useRef(0);

  // Solvent dissolve (Adam, 2026-10-16): the sprayer's emergency
  // harm, as damage over time — a spray buys DISSOLVE_SECONDS of
  // flight and DISSOLVE_DAMAGE_PER_SECOND of hurt, refreshed (not
  // stacked) by re-spraying. The strikers (the weapons build, same
  // day) share the arming signal: renamed combatArmedRef, it is
  // harm's master switch — mirrored from updateTick's attacksArmed
  // each tick, so on Peaceful the land is safe in both directions
  // and NO player-side harm (dissolve, strike, or shot) can land.
  const DISSOLVE_SECONDS = 4;
  const DISSOLVE_DAMAGE_PER_SECOND = 8;
  const combatArmedRef = useRef(false);

  // Provocation (slice 32, 2026-10-16 — Adam's oversize pin:
  // "they can be chill until the player messes with them"):
  // player-side harm stamps a wild creature's provokedTimer
  // with this many seconds of retaliation; further harm
  // refreshes it. Only species whose hunt spec is provokedOnly
  // (the oversize tier) read the clock — ordinary hunters keep
  // their proximity doctrine untouched.
  const PROVOKED_SECONDS = 30;

  const addFlora = useCallback((flora: FloraEntity): void => {
    setFloraList((prev) => [...prev, flora]);
  }, []);

  const resetFloraHarvest = useCallback((floraId: string, regrowthDuration: number): void => {
    setFloraList((prev) =>
      prev.map((f) =>
        f.id === floraId
          ? {
              ...f,
              harvestReady: false,
              harvestTimer: regrowthDuration,
              fertilizedYield: false,
              fertilizedGrowth: false,
              fertilizerTimer: 0,
              growthStage: 0,
            }
          : f
      )
    );
  }, []);

  const applyFloraFertilizer = useCallback((floraId: string, type: 'growth' | 'yield'): void => {
    setFloraList((prev) =>
      prev.map((f) => {
        if (f.id !== floraId) return f;
        if (type === 'growth') {
          return {
            ...f,
            fertilizedGrowth: true,
            fertilizerTimer: FERTILIZER_DURATION_SECONDS,
          };
        }
        return { ...f, fertilizedYield: true };
      })
    );
  }, []);

  const upsertFlora = useCallback((flora: FloraEntity): void => {
    setFloraList((prev) => {
      const idx = prev.findIndex((f) => f.id === flora.id);
      if (idx === -1) return [...prev, flora];
      const next = [...prev];
      next[idx] = flora;
      return next;
    });
  }, []);

  const removeFlora = useCallback((floraId: string): void => {
    setFloraList((prev) => prev.filter((f) => f.id !== floraId));
  }, []);

  const addStructure = useCallback((structure: StructureEntity): void => {
    setStructuresList((prev) => [...prev, structure]);
  }, []);

  const removeStructure = useCallback((structureId: string): void => {
    setStructuresList((prev) => prev.filter((s) => s.id !== structureId));
  }, []);

  const upsertStructure = useCallback((structure: StructureEntity): void => {
    setStructuresList((prev) => {
      const idx = prev.findIndex((s) => s.id === structure.id);
      if (idx === -1) return [...prev, structure];
      const next = [...prev];
      next[idx] = structure;
      return next;
    });
  }, []);

  const tameFauna = useCallback((faunaId: string, customName: string, state: FaunaEntity['state']): void => {
    setFaunaList((prev) =>
      prev.map((fn) =>
        fn.id === faunaId
          ? {
              ...fn,
              isTamed: true,
              state,
              customName,
              // Hunters default to guard duty at their tame spot
              // (the stalker's shipped pattern, generalized to the
              // table in slice 5); everyone else follows.
              command: speciesDef(fn.species).hunt ? 'guard' : 'follow',
              anchorX: speciesDef(fn.species).hunt ? fn.x : fn.anchorX,
              anchorZ: speciesDef(fn.species).hunt ? fn.z : fn.anchorZ,
            }
          : fn
      )
    );
  }, []);

  // One accepted offering for the Hearth Dog (slice 39): the
  // count lives on the dog, capped at the decision number, and
  // the digestion clock restarts — offerings count at most one
  // a minute. Returns the new count, read synchronously from
  // the fauna mirror so the lure can announce the decision the
  // moment the third lands. Any other creature, or a dog that
  // never arrived, counts nothing.
  const hearthFeed = useCallback((faunaId: string): number => {
    const dog = faunaRef.current.find((f) => f.id === faunaId);
    if (!dog || dog.species !== 'hearth_dog' || dog.isTamed || dog.hearthDecideTimer === undefined) return 0;
    const count = Math.min(3, (dog.hearthFeedings ?? 0) + 1);
    setFaunaList((prev) =>
      prev.map((fn) => (fn.id === faunaId ? { ...fn, hearthFeedings: count, hearthFedTimer: 0 } : fn))
    );
    return count;
  }, []);

  // The Heartbearer's load (slice 48): the lure's offering
  // hand places an edible on the bearer's back (the tool hook
  // chose and deducted it); the sim carries it from here —
  // the route below delivers. Cargo caps at four: a broad
  // back, not a freight line. Returns the load count.
  const loadHeartbearer = useCallback((faunaId: string, item: ItemId): number => {
    const bearer = faunaRef.current.find((f) => f.id === faunaId);
    if (!bearer || bearer.species !== 'heartbearer' || bearer.isTamed) return 0;
    const cargo = [...(bearer.cargoItems ?? []), item].slice(0, 4);
    setFaunaList((prev) => prev.map((fn) => (fn.id === faunaId ? { ...fn, cargoItems: cargo } : fn)));
    return cargo.length;
  }, []);

  const upsertFauna = useCallback((fauna: FaunaEntity): void => {
    setFaunaList((prev) => {
      const idx = prev.findIndex((f) => f.id === fauna.id);
      if (idx === -1) return [...prev, fauna];
      const next = [...prev];
      next[idx] = fauna;
      return next;
    });
  }, []);

  // Release (Adam, 2026-10-15): the bond is spent — the creature
  // is wild again, here, in this zone, keeping the name it was
  // granted (a released creature is a known animal, not a
  // stranger). Reached only through the confirm in the tame flow.
  // Emergency solvent (Adam, 2026-10-16): stamp a wild creature
  // with a dissolve. Companions are keyed out — your own solvent
  // never harms your own — and on Peaceful nothing is stamped at
  // all (see combatArmedRef). The damage and the flight happen
  // in the tick, below.
  const applyDissolve = useCallback((faunaId: string): void => {
    if (!combatArmedRef.current) return;
    setFaunaList((prev) =>
      prev.map((fn) =>
        fn.id === faunaId && !fn.isTamed
          ? { ...fn, dissolveTimer: DISSOLVE_SECONDS, provokedTimer: PROVOKED_SECONDS }
          : fn
      )
    );
  }, []);

  /**
   * STRIKE (Adam, 2026-10-16, the weapons build): one close-weapon
   * hit, applied immediately by useToolInteractions after its own
   * reach check. Stamps damage plus the flinch: while flinchTimer
   * runs the creature neither moves nor bites (the decrement and
   * the gates live in the tick below). Same harm gates as the
   * solvent — combat must be armed by the difficulty, and a tamed
   * creature is NEVER struck: your weapons, like your solvent,
   * cannot hurt your own. Deaths land in the shared sweep, so a
   * strike kill drops the creature's sample like any other kill.
   */
  const strikeFauna = useCallback((faunaId: string, damage: number, flinchSeconds: number): void => {
    if (!combatArmedRef.current) return;
    setFaunaList((prev) =>
      prev.map((fn) =>
        fn.id === faunaId && !fn.isTamed
          ? {
              ...fn,
              health: fn.health - damage,
              flinchTimer: Math.max(fn.flinchTimer ?? 0, flinchSeconds),
              provokedTimer: PROVOKED_SECONDS,
            }
          : fn
      )
    );
  }, []);

  /**
   * PROJECTILES (Adam, 2026-10-16): a ranged striker's shot is
   * aimed at where the target STOOD when fired. The shot ledger
   * below is processed on the sim clock inside the tick: when a
   * shot's travel time elapses it resolves against the world as it
   * is THEN — a single-target shot strikes only if its target is
   * still within 2m of the aim point (it moved, you miss), while a
   * burst shot (the Spore Puffer) strikes every wild creature
   * within its radius of the aim point, target or not. Tamed
   * creatures are spared in both modes. Shots fired while combat
   * is not armed never enter the ledger.
   */
  interface PendingShot {
    targetId: string;
    aimX: number;
    aimZ: number;
    damage: number;
    burstRadius?: number;
    arriveAt: number;
  }
  const pendingShotsRef = useRef<PendingShot[]>([]);
  const simClockRef = useRef(0);
  const fireProjectile = useCallback(
    (shot: { targetId: string; aimX: number; aimZ: number; damage: number; burstRadius?: number; travelSeconds: number }): void => {
      if (!combatArmedRef.current) return;
      pendingShotsRef.current.push({
        targetId: shot.targetId,
        aimX: shot.aimX,
        aimZ: shot.aimZ,
        damage: shot.damage,
        burstRadius: shot.burstRadius,
        arriveAt: simClockRef.current + Math.max(0.05, shot.travelSeconds),
      });
    },
    []
  );

  // THE WORLD ASKS BACK, S4: an optional settle name — a nameless
  // release takes the consequence record's deterministic name so
  // the live creature and the record can never disagree.
  const releaseFauna = useCallback((faunaId: string, settleName?: string): void => {
    setFaunaList((prev) =>
      prev.map((fn) =>
        fn.id === faunaId
          ? { ...fn, isTamed: false, tamedBy: undefined, command: undefined, anchorX: undefined, anchorZ: undefined, state: 'wandering' as const, ...(settleName ? { customName: settleName } : null) }
          : fn
      )
    );
  }, []);

  const setFaunaCommand = useCallback((faunaId: string, cmd: 'follow' | 'stay' | 'guard'): void => {
    setFaunaList((prev) =>
      prev.map((fn) =>
        fn.id === faunaId
          ? {
              ...fn,
              command: cmd,
              anchorX: cmd === 'guard' ? fn.x : fn.anchorX,
              anchorZ: cmd === 'guard' ? fn.z : fn.anchorZ,
              targetX: fn.x,
              targetZ: fn.z,
              state: cmd === 'follow' ? 'following' : cmd === 'guard' ? 'patrolling' : 'idle',
            }
          : fn
      )
    );
  }, []);

  const removeFauna = useCallback((faunaId: string): void => {
    setFaunaList((prev) => prev.filter((f) => f.id !== faunaId));
  }, []);

  const spawnDroppedItem = useCallback((itemId: DroppedItemEntity['itemId'], count: number, x: number, z: number): void => {
    const newItem: DroppedItemEntity = {
      id: 'drop_' + Math.random().toString(36).substring(2, 9),
      itemId,
      count,
      x,
      z,
      y: 0,
      bobTime: 0,
    };
    setDroppedItems((prev) => [...prev, newItem]);
    multiplayerManager.broadcastEntityUpsert('drop', newItem);
  }, []);

  const upsertDroppedItem = useCallback((item: DroppedItemEntity): void => {
    setDroppedItems((prev) => {
      const idx = prev.findIndex((d) => d.id === item.id);
      if (idx === -1) return [...prev, item];
      const next = [...prev];
      next[idx] = item;
      return next;
    });
  }, []);

  const removeDroppedItem = useCallback((itemId: string): void => {
    setDroppedItems((prev) => prev.filter((d) => d.id !== itemId));
  }, []);

  // Wholesale world replacement — used when loading a saved game and when
// applying a host's world snapshot (world_sync) as a guest. Every list
// is swapped at once so the world never appears half-old, half-new.
  const replaceWorld = useCallback((world: WorldSnapshot): void => {
    // A fresh zone entry restarts the Hearth Dog's "settled"
    // wait (slice 39): the dog arrives one morning, not the
    // second a border is crossed.
    hearthRef.current.zoneEnteredAt = simClockRef.current;
    setFloraList(world.flora);
    setFaunaList(world.fauna);
    setStructuresList(world.structures);
    setDroppedItems(world.drops);
  }, []);

  const updateTick = useCallback(
    (
      dt: number,
      playerX: number,
      playerZ: number,
      onPickupItem: (item: DroppedItemEntity) => void,
      onCritterExcrete?: (species: string) => void,
      onFaunaAttack?: (species: FaunaSpecies, damage: number) => void,
      attacksArmed?: boolean,
      dayPhase?: number,
      onFieldWitness?: (noteId: string) => void,
      onSentinelBell?: (species: FaunaSpecies, kind: 'threat' | 'visitor') => void,
      /** The World Asks Back (2026-10-16): the saga event sink —
       *  culls stamp here, in the kill sweep below. */
      onAsksEvent?: (input: AsksEventInput | AsksEventInput[]) => void
    ): void => {
      const simulateWorld = !multiplayerManager.isConnected || multiplayerManager.isHost;
      combatArmedRef.current = !!attacksArmed;
      // Field Notes witness stamps (creature slice 47,
      // 2026-10-16): App's sink is append-only and deduped, so
      // the sim fires at the witnessed moment and keeps no
      // ledger of its own — every stamp below is a condition,
      // not a bookkeeping exercise.
      const witness = (noteId: string): void => {
        onFieldWitness?.(noteId);
      };
      // The projectile ledger runs on this clock (weapons build,
      // 2026-10-16): shots resolve when their travel time elapses.
      simClockRef.current += dt;

      // The day/night phase, as the loop reports it (slice 42):
      // the scheduled lives read their hours from here — the
      // hermit's night, the moth's road, the dawn itself.
      const phaseNow = dayPhase ?? 0.35;
      const isNightNow = phaseNow >= 0.75 || phaseNow < 0.25;
      // The player's speed this tick: the hermit's encounter is
      // stillness, and stillness must be measured to be meant.
      const prevPlayerPos = lastPlayerPosRef.current;
      const playerSpeed =
        prevPlayerPos && dt > 0 ? Math.hypot(playerX - prevPlayerPos.x, playerZ - prevPlayerPos.z) / dt : 0;
      lastPlayerPosRef.current = { x: playerX, z: playerZ };
      // DAWN (slice 42): the phase crossing 0.25 is the
      // Hollow's pay-hour. A hermit shown ninety seconds of
      // true stillness in the night band — close enough to
      // matter, never close enough to touch, and slow — leaves
      // a Hollow Heart Spore at its base, the colony's trade
      // on the colony's terms. The regard then clears: the
      // next gift wants another night, which is what "rarely,
      // never farmable on a timer you can see" is made of.
      if (simulateWorld && prevPhaseRef.current < 0.25 && phaseNow >= 0.25) {
        for (const f of faunaRef.current) {
          if (f.species === 'hollow_hermit' && !f.isTamed && (hermitRegardRef.current.get(f.id) ?? 0) >= 90) {
            spawnDroppedItem('hollow_heart_spore', 1, f.x + 1.3, f.z + 0.6);
            witness('note_hollow_hermit'); // the gift, seen left (slice 47)
          }
        }
        hermitRegardRef.current.clear();
      }
      prevPhaseRef.current = phaseNow;

      // ---------------------------------------------------------------
      // THE OTTER'S BANK (slice 44, 2026-10-16): the Root Otter
      // steals small bright things into root-caches — the wet
      // branch of the crow's barter economy. The sim keeps the
      // dividend half: on a long, per-otter clock (roughly a day
      // and a half of loaded time, jittered by the otter's own
      // id so no two bank alike), a wild otter slips a cache into
      // the roots a few meters off — something bright, rolled
      // from the treasure table below. Otter Treasure is a
      // CATEGORY, not an item, exactly as designed: the table
      // decides the treasure, the otter decides the bank. (The
      // stealing half — lifting from the player's own pouch —
      // stays design-only: the sim holds no inventory, and a
      // dividend needs no theft to be believed in.)
      // ---------------------------------------------------------------
      if (simulateWorld) {
        for (const f of faunaRef.current) {
          if (f.species !== 'root_otter' || f.isTamed) continue;
          const banked = (otterCacheRef.current.get(f.id) ?? 0) + dt;
          const threshold = 900 + ((f.id.charCodeAt(f.id.length - 1) * 37) % 500);
          if (banked >= threshold) {
            otterCacheRef.current.set(f.id, 0);
            const roll = Math.random();
            const treasure: [ItemId, number] =
              roll < 0.08
                ? ['silver_scale', 1]
                : roll < 0.35
                  ? ['dew_essence', 2]
                  : roll < 0.6
                    ? ['glow_spore', 1]
                    : roll < 0.82
                      ? ['lodestone_sand', 2]
                      : ['vibrant_petal', 2];
            const ang = Math.random() * Math.PI * 2;
            const dist = 3 + Math.random() * 4;
            spawnDroppedItem(treasure[0], treasure[1], f.x + Math.cos(ang) * dist, f.z + Math.sin(ang) * dist);
            // The bank, witnessed (slice 47): a cache appearing
            // in the player's sight is the otter's named moment
            // (pickup-side can't tell a cache's drops from any
            // other — the seeing is the stamp).
            if (Math.hypot(f.x - playerX, f.z - playerZ) < 30) witness('note_root_otter');
          } else {
            otterCacheRef.current.set(f.id, banked);
          }
        }
      }

      // ---------------------------------------------------------------
      // THE HEARTH WISP TAKES UP (slice 43, 2026-10-16): the
      // design's other arrival, now that a kept hearth exists to
      // arrive AT. A wild wisp in a zone with an unclaimed
      // hearthpod drifts to it and HOLDS — anchored over the
      // warmth on a small claim (the pond-clamp fields again),
      // one wisp per good fire, defended by ignoring rivals
      // completely. If the pod is removed, the claim lapses and
      // the wisp resumes its wandering. Checked on a slow
      // cadence: hearths are not in a hurry, and neither is it.
      // The certification this creates is spent by the flora
      // tick below (the Hearth Cap fruits only where it
      // approves).
      // ---------------------------------------------------------------
      wispCheckRef.current += dt;
      if (simulateWorld && wispCheckRef.current >= 1) {
        wispCheckRef.current = 0;
        const pods = structuresRef.current.filter((s) => s.type === 'hearthpod');
        const wisps = faunaRef.current.filter((f) => f.species === 'hearth_wisp' && !f.isTamed);
        const claimedPodAt = (wx: number, wz: number, exceptId: string): boolean =>
          wisps.some((w) => w.id !== exceptId && w.anchorX !== undefined && Math.hypot(w.anchorX - wx, w.anchorZ! - wz) < 1);
        let changed = false;
        const nextWisps = new Map<string, Partial<FaunaEntity>>();
        // Pods claimed during THIS pass (faunaRef lags the
        // patches being built — two wisps must not both be
        // promised the same fire).
        const claimedThisPass: { x: number; z: number }[] = [];
        for (const w of wisps) {
          if (w.anchorX !== undefined) {
            // Holding a claim: it stands while its pod does.
            if (!pods.some((p) => Math.hypot(p.worldX - w.anchorX!, p.worldZ - w.anchorZ!) < 1)) {
              nextWisps.set(w.id, { anchorX: undefined, anchorZ: undefined, pondRadius: undefined });
              changed = true;
            }
          } else {
            const pod = pods.find(
              (p) =>
                !claimedPodAt(p.worldX, p.worldZ, w.id) &&
                !claimedThisPass.some((c) => Math.hypot(c.x - p.worldX, c.z - p.worldZ) < 1)
            );
            if (pod) {
              claimedThisPass.push({ x: pod.worldX, z: pod.worldZ });
              // The taking-up, witnessed (slice 47): a wisp
              // settling over a hearth in the player's sight.
              if (Math.hypot(playerX - pod.worldX, playerZ - pod.worldZ) < 30) witness('note_hearth_wisp');
              nextWisps.set(w.id, { anchorX: pod.worldX, anchorZ: pod.worldZ, pondRadius: 2.5, targetX: pod.worldX, targetZ: pod.worldZ });
              changed = true;
            }
          }
        }
        if (changed) {
          setFaunaList((prev) =>
            prev.map((f) => {
              const patch = nextWisps.get(f.id);
              return patch ? { ...f, ...patch } : f;
            })
          );
        }
      }

      // ---------------------------------------------------------------
      // THE HEARTH DOG ARRIVES (creature slice 39, 2026-10-16 —
      // Adam's pin: "just use the spawn tiles"). The design's law:
      // a hearth dog is not found, caught, or tamed — it ARRIVES.
      // When the zone the player is standing in holds a heart
      // tile, the player has been settled a few seconds, no dog
      // (wild, courting, or decided) is about, and the last
      // undecided departure is not fresh, the country sends one:
      // it walks in beside the player, takes up at that doorstep
      // on a perimeter it invents (the pond-clamp fields —
      // anchor + radius 7 — reused as a homestead claim), and
      // its three-day decision clock starts. The courtship
      // itself (offerings, the bond) lives in the lure's dog
      // branch; the departure runs in the death sweep below.
      // ---------------------------------------------------------------
      if (
        simulateWorld &&
        simClockRef.current - hearthRef.current.zoneEnteredAt > 10 &&
        simClockRef.current - hearthRef.current.lastDepartureAt > 600 &&
        simClockRef.current - hearthRef.current.lastArrivalAt > 30 &&
        structuresRef.current.some((s) => s.type === 'heart_tile') &&
        !faunaRef.current.some((f) => f.species === 'hearth_dog')
      ) {
        hearthRef.current.lastArrivalAt = simClockRef.current;
        const ang = Math.random() * Math.PI * 2;
        const spawnX = Math.min(98, Math.max(2, playerX + Math.cos(ang) * 3.5));
        const spawnZ = Math.min(98, Math.max(2, playerZ + Math.sin(ang) * 3.5));
        const dog: FaunaEntity = {
          id: `fauna_hearth_dog_${Math.floor(simClockRef.current)}`,
          species: 'hearth_dog',
          x: spawnX,
          z: spawnZ,
          y: 0,
          rotation: Math.random() * Math.PI * 2,
          state: 'wandering',
          isTamed: false,
          targetX: spawnX,
          targetZ: spawnZ,
          anchorX: spawnX,
          anchorZ: spawnZ,
          pondRadius: 7,
          speed: 1.8,
          health: 22,
          maxHealth: 22,
          byproductTimer: 0,
          animTime: 0,
          hearthFeedings: 0,
          hearthDecideTimer: 18000, // thirty ten-minute days to decide (Adam, 2026-10-16: '30 days is fair')
          hearthFedTimer: 999, // the first offering need not wait
          hearthAgeDays: 0, // arrives a pup — growth is the engine's read of this clock
        };
        setFaunaList((prev) => (prev.some((f) => f.species === 'hearth_dog') ? prev : [...prev, dog]));
      }

      // 1. Fauna Behavioral AI Tick (host authority — guests apply host upserts)
      if (simulateWorld) {
      faunaSyncTimer.current += dt;
      const syncFaunaNow = faunaSyncTimer.current >= FAUNA_SYNC_INTERVAL;
      if (syncFaunaNow) faunaSyncTimer.current = 0;

      // Nearest loose drop to a point — guard-collectors hunt with this.
      const nearestDrop = (px: number, pz: number): DroppedItemEntity | null => {
        let best: DroppedItemEntity | null = null;
        let bestDist = COLLECT_SEARCH_RADIUS;
        droppedItemsRef.current.forEach((d) => {
          const dist = Math.hypot(d.x - px, d.z - pz);
          if (dist < bestDist) {
            best = d;
            bestDist = dist;
          }
        });
        return best;
      };

      // Drops a collector reaches this tick land here; they are removed
      // and credited after the fauna pass (drops are separate state).
      const collectedDrops: DroppedItemEntity[] = [];
      setFaunaList((prevFauna) => {
        // Damage dealt this pass by defending followers (see the
        // defend block in the companion orders) — applied after
        // the map, when every creature's new state is known.
        const defenderDamage = new Map<string, number>();
        const mappedFauna = prevFauna.map((fauna) => {
          let { x, z, state, isTamed, targetX, targetZ, byproductTimer, command } = fauna;
          // Hunter bite cooldown (slice 5); absent on older saves.
          let sentinelFacing = false;
          let meadowBusy = false;
          let biteTimer = fauna.biteTimer ?? 0;
          let sampleTimer = fauna.sampleTimer ?? 0;
          // Solvent dissolve (Adam, 2026-10-16): fractional
          // damage accrues with the timer, so the total is the
          // rate times however much of the dissolve elapsed.
          let dissolveTimer = fauna.dissolveTimer ?? 0;
          let dissolveDamage = 0;
          // Striker flinch (Adam, 2026-10-16): the stagger clock
          // runs down here; while it is above zero the creature's
          // bites are gated off below and its movement target is
          // pinned to where it stands.
          let flinchTimer = Math.max(0, (fauna.flinchTimer ?? 0) - dt);
          // Provocation clock (slice 32): runs down here; being
          // dissolved is being messed with, so an active dissolve
          // holds the clock at full — a provokedOnly creature
          // flees while the dissolve runs (the flight block below
          // overrides its hunt) and answers when it ends.
          let provokedTimer = Math.max(0, (fauna.provokedTimer ?? 0) - dt);
          // Behavior phase clock (slice 38): cycles for species
          // whose table entry names one (the dive cycle today).
          const diveSpec = speciesDef(fauna.species).dive;
          let phaseTimer = fauna.phaseTimer ?? 0;
          if (diveSpec) {
            const prevPhaseTimer = phaseTimer;
            phaseTimer = (phaseTimer + dt) % diveSpec.cycleSeconds;
            // The dive, completed (slice 47 witness): the cycle
            // crossing from underwater time back into air is a
            // finished dive, witnessed by anyone standing near.
            if (
              prevPhaseTimer < diveSpec.waterSeconds &&
              phaseTimer >= diveSpec.waterSeconds &&
              Math.hypot(fauna.x - playerX, fauna.z - playerZ) < 25
            ) {
              witness('note_plunge_duck');
            }
          }
          // Hearth Dog courtship clocks (slice 39): an arrived,
          // undecided dog counts down its thirty days of
          // loaded-zone time, and digests between offerings.
          let hearthDecideTimer = fauna.hearthDecideTimer;
          let hearthFedTimer = fauna.hearthFedTimer;
          if (fauna.species === 'hearth_dog' && !isTamed && hearthDecideTimer !== undefined) {
            hearthDecideTimer = Math.max(0, hearthDecideTimer - dt);
            hearthFedTimer = (hearthFedTimer ?? 0) + dt;
          }
          // Growth (Adam, 2026-10-16): the dog ages in game days
          // (600 s each — the planet's rotation), courted or bonded
          // alike: a pup at arrival, full-grown by day ten. A dog
          // from before this clock existed starts full-grown if he
          // is already yours, a pup if he is still deciding.
          let hearthAgeDays = fauna.hearthAgeDays;
          if (fauna.species === 'hearth_dog') {
            hearthAgeDays = (hearthAgeDays ?? (isTamed ? 10 : 0)) + dt / 600;
          }
          // The hermit's regard (slice 42): stillness shown to
          // a wild Hollow Hermit in the night band accrues —
          // near (3–8 m: near enough to matter, never close
          // enough to touch, for it seals at approach) and slow
          // (under a stroll). Dawn spends it, above.
          if (fauna.species === 'hollow_hermit' && !isTamed && isNightNow) {
            const distToPlayer = Math.hypot(fauna.x - playerX, fauna.z - playerZ);
            if (distToPlayer >= 3 && distToPlayer <= 8 && playerSpeed < 0.6) {
              hermitRegardRef.current.set(fauna.id, (hermitRegardRef.current.get(fauna.id) ?? 0) + dt);
            }
          }
          // A creature won over mid-dissolve is washed clean by
          // the bond — your solvent never harms your own, even
          // retroactively.
          if (isTamed) dissolveTimer = 0;
          if (dissolveTimer > 0) {
            const elapsed = Math.min(dt, dissolveTimer);
            dissolveTimer -= elapsed;
            dissolveDamage = DISSOLVE_DAMAGE_PER_SECOND * elapsed;
          }
          // Being dissolved is being messed with (slice 32): an
          // active dissolve holds the provocation clock at full.
          if (dissolveDamage > 0) provokedTimer = PROVOKED_SECONDS;

          // --- Companion orders (tamed, with a command set) ---
          if (isTamed && command === 'follow') {
            targetX = playerX + Math.sin(fauna.id.length) * FOLLOW_OFFSET;
            targetZ = playerZ + Math.cos(fauna.id.length) * FOLLOW_OFFSET;
            state = 'following';
          }
          if (isTamed && command === 'stay') {
            state = 'idle';
          }
          // Guard, hunters: a real patrol — waypoints on a ring around
          // the anchor post, a new one on every arrival. (The stalker's
          // pattern, generalized to every table hunter in slice 5.)
          if (isTamed && command === 'guard' && speciesDef(fauna.species).hunt) {
            state = 'patrolling';
            if (Math.hypot(targetX - x, targetZ - z) <= PATROL_ARRIVAL_DISTANCE) {
              const anchorX = fauna.anchorX ?? x;
              const anchorZ = fauna.anchorZ ?? z;
              const angle = Math.random() * Math.PI * 2;
              targetX = anchorX + Math.sin(angle) * PATROL_RADIUS;
              targetZ = anchorZ + Math.cos(angle) * PATROL_RADIUS;
            }
          }
          // Guard, the Meadowback (slice 49): SENTINEL — the
          // design's new guard flavor. It does not fetch and it
          // does not fight: it takes its post at the anchor and
          // WATCHES (the rotation below keeps its head turning
          // toward whatever it is watching), and its low
          // bell-note is the report. Armed worlds: a THREAT bell
          // when a wild hunter nearby is actively hunting,
          // re-rung while the danger persists. Peaceful: a
          // VISITOR bell, once, when a hunter enters its regard —
          // announced, not feared. The bell's patience is 45 s:
          // a bell that rings constantly warns about nothing.
          if (isTamed && command === 'guard' && fauna.species === 'meadowback') {
            const postX = fauna.anchorX ?? x;
            const postZ = fauna.anchorZ ?? z;
            if (Math.hypot(postX - x, postZ - z) > 3) {
              targetX = postX;
              targetZ = postZ;
              state = 'patrolling';
            } else {
              targetX = x;
              targetZ = z;
              state = 'patrolling';
              sentinelFacing = true;
              const hunterInRegard = prevFauna.some(
                (o) => !o.isTamed && speciesDef(o.species).hunt && Math.hypot(o.x - x, o.z - z) <= 30
              );
              const huntingNow = prevFauna.some(
                (o) => !o.isTamed && o.state === 'attacking' && speciesDef(o.species).hunt && Math.hypot(o.x - x, o.z - z) <= 30
              );
              const bellReady = simClockRef.current - (sentinelBellRef.current.get(fauna.id) ?? -1_000_000) > 45;
              const dPlayer = Math.hypot(playerX - x, playerZ - z);
              if (bellReady && attacksArmed && huntingNow) {
                onSentinelBell?.('meadowback', 'threat');
                sentinelBellRef.current.set(fauna.id, simClockRef.current);
                if (dPlayer < 40) witness('note_meadowback');
              } else if (bellReady && !attacksArmed && hunterInRegard && !sentinelWatchRef.current.get(fauna.id)) {
                onSentinelBell?.('meadowback', 'visitor');
                sentinelBellRef.current.set(fauna.id, simClockRef.current);
                if (dPlayer < 40) witness('note_meadowback');
              }
              sentinelWatchRef.current.set(fauna.id, hunterInRegard);
            }
          }
          // Guard, everyone else (soft-puffs, burrow mice): sanitation
          // duty — fetch the nearest loose drop back to the pouch. With
          // nothing to fetch, return to the anchor post and wait.
          if (isTamed && command === 'guard' && fauna.species !== 'meadowback' && !speciesDef(fauna.species).hunt) {
            const drop = nearestDrop(x, z);
            if (drop) {
              targetX = drop.x;
              targetZ = drop.z;
              state = 'wandering';
              if (Math.hypot(drop.x - x, drop.z - z) <= COLLECT_REACH) collectedDrops.push(drop);
            }
            if (!drop) {
              targetX = fauna.anchorX ?? targetX;
              targetZ = fauna.anchorZ ?? targetZ;
              state = Math.hypot(targetX - x, targetZ - z) <= 0.4 ? 'idle' : 'wandering';
            }
          }

          // DEFEND folds into FOLLOW (Adam, 2026-10-15): no
          // separate defend command — a follower that CAN hunt
          // watches for a wild hunter currently attacking its
          // person and goes for it. The bite lands in the damage
          // ledger below; the pass applies it after the map, and
          // a hunter brought down leaves its remains — a sample.
          const myHunt = isTamed && command === 'follow' ? speciesDef(fauna.species).hunt : undefined;
          if (myHunt) {
            const threat = prevFauna.find(
              (other) =>
                !other.isTamed &&
                other.state === 'attacking' &&
                speciesDef(other.species).hunt &&
                Math.hypot(other.x - playerX, other.z - playerZ) <= 12,
            );
            if (threat) {
              targetX = threat.x;
              targetZ = threat.z;
              state = 'attacking';
              if (Math.hypot(threat.x - x, threat.z - z) <= myHunt.biteRange && biteTimer <= 0) {
                defenderDamage.set(threat.id, (defenderDamage.get(threat.id) ?? 0) + myHunt.damage);
                biteTimer = myHunt.biteCooldownSeconds;
              }
            }
          }

          // --- Wild creatures ---
          const distToPlayer = Math.hypot(playerX - x, playerZ - z);
          // THE HUNT (slice 5 — the stalker's shipped pattern,
          // generalized onto the species table): a wild hunter inside
          // its aggro range NOTICES you, and noticing is the tell the
          // danger doctrine promises in every difficulty. On Peaceful
          // the hunter stops and faces you, and that regard is the
          // whole event. On armed worlds (Normal/Hostile) it commits:
          // it chases, and inside bite range it bites on its table
          // cooldown. Tamed hunters never hunt the player.
          const hunt = isTamed ? undefined : speciesDef(fauna.species).hunt;
          // Provoked-only hunts (slice 32 — the oversize tier):
          // proximity never alerts them; the provocation clock
          // does. An unprovoked giant is scenery with a pulse.
          const provoked = !hunt?.provokedOnly || provokedTimer > 0;
          // THE DISTANCE GRADIENT (slice 50): far-country hunters
          // carry spawn stamps (farAggro / farDmg on the entity;
          // absent = 1 = the table's word, which is also every
          // near-country hunter and the whole provoked tier). The
          // aggro bubble grows — and once a stamped hunter has
          // COMMITTED, it holds the hunt beyond the bubble's edge:
          // the leash grows by the same stamp, so out far things
          // don't just hit harder, they don't quit. A hunter at
          // stamp 1 deaggros exactly where it always has.
          const farAggro = fauna.farAggro ?? 1;
          const aggroEff = hunt ? hunt.aggroRange * farAggro : 0;
          const latched =
            fauna.state === 'attacking' && farAggro > 1 && distToPlayer <= aggroEff * farAggro;
          // THE LONG PURSUIT (slice 51 — the Hush Hound): its
          // leash is the valley itself. Once committed it holds
          // the hunt at any range — and the heart clearing is
          // the one sanctuary: a player standing in it is simply
          // not hunted (no commit, no latch), and the hound
          // circles outside. (The heart is read exactly where
          // the valley staff reads it: the heart flora, else
          // the heart tile.)
          const heartClear =
            fauna.species === 'hush_hound' &&
            (() => {
              const heart = floraRef.current.find((fl) => fl.species === 'valley_heart' || fl.species === 'heartbloom');
              const tile = heart ? undefined : structuresRef.current.find((st) => st.type === 'heart_tile');
              const hx = heart ? heart.x : tile ? tile.worldX : undefined;
              const hz = heart ? heart.z : tile ? tile.worldZ : undefined;
              return hx !== undefined && Math.hypot(hx - playerX, hz! - playerZ) <= 12;
            })();
          const hushLatched = fauna.species === 'hush_hound' && fauna.state === 'attacking' && !heartClear;
          const hunterAlert =
            !!hunt && provoked && !heartClear && (distToPlayer <= aggroEff || latched || hushLatched);
          biteTimer = Math.max(0, biteTimer - dt);
          // FIELD NOTES WITNESS LEDGER (slice 47): the moments
          // this pass can see, stamped as they happen (the sink
          // dedups; the sim keeps no ledger of its own).
          {
            // The bear's tenancy: the taming bargain lives in
            // another hook, but a standing tamed bear at the
            // player's side is the same fact, a breath later.
            if (fauna.species === 'rootfall_bear' && isTamed && distToPlayer < 20) witness('note_rootfall_bear');
            // The deer's answer, likewise: a standing tamed
            // deer WAS the calm courtship, completed.
            if (fauna.species === 'answer_deer' && isTamed && distToPlayer < 20) witness('note_answer_deer');
            // Drift Krill, risen: at night the mesh lifts them
            // to the surface on the swim table's nightRise — to
            // be near one in the dark is to see the rise.
            if (fauna.species === 'drift_krill' && isNightNow && distToPlayer < 16) witness('note_drift_krill');
            // The backward spirals, read: an Untended garden's
            // moth, close enough to see the winding run wrong.
            if (fauna.species === 'spiral_moth' && fauna.homeVariant === 'precursor_untended' && distToPlayer < 18) {
              witness('note_spiral_moth');
            }
            // The Boiler Crab's venting: the steam is mesh-side
            // on a seven-second cycle, so seven seconds in its
            // close company is a guaranteed witnessed vent.
            if (fauna.species === 'boiler_crab' && distToPlayer < 11) {
              const dwell = (crabDwellRef.current.get(fauna.id) ?? 0) + dt;
              if (dwell >= 7) {
                witness('note_boiler_crab');
                crabDwellRef.current.set(fauna.id, -3600);
              } else {
                crabDwellRef.current.set(fauna.id, dwell);
              }
            }
            // A great one, provoked: the provocation clock's
            // first tick on a kill-loot giant. (The bear shares
            // the provoked-only flag but not the tier — it
            // carries no killLoot, and has its own note.)
            if (hunt?.provokedOnly && speciesDef(fauna.species).killLoot && provokedTimer > 0 && (fauna.provokedTimer ?? 0) <= 0) {
              witness('note_oversize_tier');
            }
            // The pond ambush, sprung: for the two patient
            // hunters, the alert commit IS the ambush.
            if (hunterAlert && fauna.species === 'fen_lurker') witness('note_fen_lurker');
            if (hunterAlert && fauna.species === 'pool_snapper') witness('note_pool_snapper');
            // The long pursuit, witnessed (slice 51): twelve
            // continuous seconds of a Hush Hound's committed
            // hunt, in the player's company — the note is about
            // the pursuit, not the meeting. Crab-style lockout
            // after the stamp.
            if (fauna.species === 'hush_hound' && fauna.state === 'attacking' && distToPlayer < 40) {
              const pursuit = (hushPursuitRef.current.get(fauna.id) ?? 0) + dt;
              if (pursuit >= 12) {
                witness('note_hush_hound');
                hushPursuitRef.current.set(fauna.id, -3600);
              } else {
                hushPursuitRef.current.set(fauna.id, pursuit);
              }
            } else if (fauna.species === 'hush_hound' && fauna.state !== 'attacking') {
              hushPursuitRef.current.set(fauna.id, 0);
            }
          }
          // THE STARE (slice 51 — the Lodestone Hound): before
          // its first charge of an encounter, the hound stops
          // and STARES for two full seconds — feet still, head
          // locked. Break away (beyond 2.2× its aggro) and the
          // encounter resets unwitnessed; sit out the stare and
          // the charge is earned for the rest of the encounter.
          // The ringing feet announce it; the looking IS the
          // warning the danger doctrine promises.
          let stareGate = false;
          if (fauna.species === 'lodestone_hound' && hunt) {
            const rec = stareRef.current.get(fauna.id) ?? { t: 0, committed: false };
            if (!hunterAlert && distToPlayer > aggroEff * 2.2) {
              rec.t = 0;
              rec.committed = false; // encounter over — the next meeting stares again
            }
            if (hunterAlert && !rec.committed) {
              stareGate = true;
              rec.t += dt;
              if (rec.t >= 2) {
                rec.committed = true;
                stareGate = false;
                if (distToPlayer < 30) witness('note_lodestone_hound'); // the charge, earned in the player's sight
              }
            }
            stareRef.current.set(fauna.id, rec);
          }
          if (hunterAlert && hunt && !stareGate) {
            if (attacksArmed) {
              state = 'attacking';
              targetX = playerX;
              targetZ = playerZ;
              if (distToPlayer <= hunt.biteRange && biteTimer <= 0 && flinchTimer <= 0) {
                // The gradient's damage axis (slice 50): the
                // stamp scales the bite; unstamped hunters bite
                // for exactly their table damage.
                onFaunaAttack?.(fauna.species, Math.round(hunt.damage * (fauna.farDmg ?? 1)));
                biteTimer = hunt.biteCooldownSeconds;
              }
            } else {
              state = 'alert';
              targetX = x;
              targetZ = z;
            }
          } else if (stareGate && hunt) {
            // Mid-stare, the hound does the Peaceful move at
            // every difficulty: it stops and faces you. The
            // stillness is the loudest part.
            state = 'alert';
            targetX = x;
            targetZ = z;
          }
          // -------------------------------------------------------
          // THE VALLEY STAFF (creature slice 47, 2026-10-16 —
          // Adam: "wire the creatures up"): the Living family's
          // social engine, first offices. A valley's FACE is read
          // from its staff, because the deal already wrote it
          // there: a Gladhand is dealt only into Welcoming
          // country, a Taster only into Hungry — their presence
          // in this zone's company IS the variant, at animal
          // scale, and the Threshold Hound reads the same page.
          //
          // The offices are pure courtesy: no force is ever
          // applied to the player. The OUT escort is a guide
          // walking a route at your heel — that you could refuse
          // it is the design. The courtesy is the warning; the
          // walking is the sentence, carried out politely.
          // -------------------------------------------------------
          let staffEngaged = false;
          let socialState = fauna.socialState;
          let socialTimer = fauna.socialTimer ?? 0;
          let socialTravel = fauna.socialTravel ?? 0;
          const isStaffMember =
            !isTamed &&
            (fauna.species === 'gladhand' || fauna.species === 'threshold_hound' || fauna.species === 'taster');
          if (isStaffMember && distToPlayer <= 30) {
            if (fauna.species === 'taster') {
              // THE TASTING: the taster approaches to tasting
              // distance and HOLDS while the valley decides;
              // then the verdict — turn away (filed kindly) or
              // keep the visitor's pace at tasting distance for
              // a hundred paces (the whole sentence). The
              // verdict is hash-seeded per taster: the same
              // valley reads the same way all visit.
              if (!socialState) {
                socialState = 'tasting';
                socialTimer = 0;
                socialTravel = 0;
              }
              if (socialState === 'tasting') {
                staffEngaged = true;
                state = 'following';
                const awayA = Math.atan2(x - playerX, z - playerZ);
                targetX = playerX + Math.sin(awayA) * 3.5;
                targetZ = playerZ + Math.cos(awayA) * 3.5;
                if (distToPlayer <= 5.5) socialTimer += dt;
                const deliberation = 18 + ((fauna.id.charCodeAt(fauna.id.length - 1) * 29) % 14);
                if (socialTimer >= deliberation) {
                  witness('note_taster'); // the verdict, filed in the player's sight
                  const idHash = fauna.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                  socialState = idHash % 2 === 0 ? 'withdrawing' : 'shadowing';
                  socialTimer = 0;
                  socialTravel = 0;
                }
              } else if (socialState === 'shadowing') {
                staffEngaged = true;
                state = 'following';
                const awayA = Math.atan2(x - playerX, z - playerZ);
                targetX = playerX + Math.sin(awayA) * 4.5;
                targetZ = playerZ + Math.cos(awayA) * 4.5;
                socialTravel += playerSpeed * dt;
                if (socialTravel >= 100) {
                  socialState = 'withdrawing';
                  socialTimer = 0;
                }
              } else if (socialState === 'withdrawing') {
                staffEngaged = true;
                state = 'wandering';
                const awayA = Math.atan2(x - playerX, z - playerZ);
                targetX = x + Math.sin(awayA) * 10;
                targetZ = z + Math.cos(awayA) * 10;
                socialTimer += dt;
                if (socialTimer > 4 || distToPlayer > 24) {
                  socialState = undefined;
                  socialTimer = 0;
                }
              }
            } else {
              // THE ESCORTS: the Gladhand walks you IN (it
              // exists only where the valley is glad); the
              // Threshold Hound walks you IN or OUT by the
              // staff it finds itself among. A guide walks the
              // route AHEAD of its visitor — showing the paths
              // by taking them — and comes back to heel when it
              // falls behind, because an escort that loses its
              // visitor is just a dog on a walk.
              const gladStaff = faunaRef.current.some((f) => f.species === 'gladhand');
              const tasterStaff = faunaRef.current.some((f) => f.species === 'taster');
              const escortOut = fauna.species === 'threshold_hound' && tasterStaff && !gladStaff;
              // The heart point of this valley, local frame:
              // the Valley Heart / Heartbloom flora if the
              // country grew one, else a heart tile, else the
              // zone's middle.
              const heartFlora = floraRef.current.find((fl) => fl.species === 'valley_heart' || fl.species === 'heartbloom');
              const heartTile = structuresRef.current.find((st) => st.type === 'heart_tile');
              let destX = heartFlora ? heartFlora.x : heartTile ? heartTile.worldX : 50;
              let destZ = heartFlora ? heartFlora.z : heartTile ? heartTile.worldZ : 50;
              if (escortOut) {
                // OUT's destination: the valley's edge nearest
                // the visitor — the threshold they are being
                // walked to, with perfect courtesy.
                const edges = [
                  { d: playerZ, x: playerX, z: 3 },
                  { d: 100 - playerZ, x: playerX, z: 97 },
                  { d: playerX, x: 3, z: playerZ },
                  { d: 100 - playerX, x: 97, z: playerZ },
                ].sort((a, b) => a.d - b.d);
                destX = edges[0].x;
                destZ = edges[0].z;
              }
              if (!socialState) {
                socialState = escortOut ? 'escort-out' : 'escort-in';
                socialTimer = 0;
              }
              socialTimer += dt;
              const destDist = Math.hypot(playerX - destX, playerZ - destZ);
              if (destDist <= (escortOut ? 5 : 6.5) && socialTimer >= 5) {
                // The office completes: delivered in, or walked
                // to the threshold out. The staffer settles; the
                // escort, performed in full, is witnessed.
                witness(fauna.species === 'gladhand' ? 'note_gladhand' : 'note_threshold_hound');
                socialState = undefined;
                socialTimer = 0;
                staffEngaged = true;
                state = 'wandering';
                targetX = x;
                targetZ = z;
              } else {
                staffEngaged = true;
                state = 'following';
                // An escort sustained is also witnessed — a
                // visitor who dawdles still saw the office.
                if (socialTimer >= 3) witness(fauna.species === 'gladhand' ? 'note_gladhand' : 'note_threshold_hound');
                if (distToPlayer > 16) {
                  targetX = playerX;
                  targetZ = playerZ;
                } else {
                  const dirA = Math.atan2(destX - playerX, destZ - playerZ);
                  const lead = Math.min(7, Math.max(0, destDist - 2));
                  targetX = playerX + Math.sin(dirA) * lead;
                  targetZ = playerZ + Math.cos(dirA) * lead;
                }
              }
            }
          } else if (isStaffMember && socialState) {
            // The visitor walked away: the office lapses, and
            // the valley will offer it again to whoever returns.
            socialState = undefined;
            socialTimer = 0;
            socialTravel = 0;
          }

          // -------------------------------------------------------
          // THE MIRROR (creature slice 48, 2026-10-16): the
          // Answer Deer mirrors the visitor it is with. Calm
          // company accrues CALM REGARD on the deer itself —
          // the courtship the lure reads (45 s of it, gathered
          // over days, persisted with the fauna). Hurry is
          // mirrored back as flight; stillness, as stillness.
          // In Hungry country (a Taster on the roster) the herd
          // mirrors NOTHING — tuned to an appetite that isn't
          // yours — and the correct reading is the design's:
          // believe them, and keep your distance, as they keep
          // theirs.
          // -------------------------------------------------------
          let calmRegard = fauna.calmRegard ?? 0;
          let deerBusy = false;
          let deerStilling = false;
          if (fauna.species === 'answer_deer' && !isTamed) {
            const hungryCountry = faunaRef.current.some((f) => f.species === 'taster');
            if (hungryCountry) {
              calmRegard = Math.max(0, calmRegard - dt * 4);
              if (socialState === 'startled') {
                socialState = undefined;
                socialTimer = 0;
              }
              if (distToPlayer < 14) {
                deerBusy = true;
                state = 'wandering';
                const awayA = Math.atan2(x - playerX, z - playerZ);
                targetX = playerX + Math.sin(awayA) * 17;
                targetZ = playerZ + Math.cos(awayA) * 17;
              }
            } else if (socialState === 'startled') {
              deerBusy = true;
              state = 'wandering';
              socialTimer += dt;
              calmRegard = Math.max(0, calmRegard - dt * 10);
              const awayA = Math.atan2(x - playerX, z - playerZ);
              targetX = x + Math.sin(awayA) * 8;
              targetZ = z + Math.cos(awayA) * 8;
              if (socialTimer >= 2.5) {
                socialState = undefined;
                socialTimer = 0;
              }
            } else if (distToPlayer <= 22) {
              if (playerSpeed > 3.2) {
                socialState = 'startled';
                socialTimer = 0;
                deerBusy = true;
                state = 'wandering';
                const awayA = Math.atan2(x - playerX, z - playerZ);
                targetX = x + Math.sin(awayA) * 8;
                targetZ = z + Math.cos(awayA) * 8;
              } else if (playerSpeed < 0.15) {
                // Stillness, answered with stillness: the deer
                // holds, and faces you (the rotation below).
                deerBusy = true;
                deerStilling = true;
                state = 'idle';
                targetX = x;
                targetZ = z;
                if (distToPlayer >= 3.5) calmRegard = Math.min(150, calmRegard + dt);
              } else if (playerSpeed < 0.6) {
                // Calm company: the deer grazes a loose ring
                // around its visitor, in no hurry at all.
                deerBusy = true;
                state = 'wandering';
                const awayA = Math.atan2(x - playerX, z - playerZ);
                targetX = playerX + Math.sin(awayA) * 7;
                targetZ = playerZ + Math.cos(awayA) * 7;
                if (distToPlayer >= 3.5) calmRegard = Math.min(150, calmRegard + dt);
              } else {
                calmRegard = Math.max(0, calmRegard - dt * 2);
              }
            }
          }

          // -------------------------------------------------------
          // THE ROAD (creature slice 48): the Heartbearer walks
          // its supply line — the valley's heart to the valley's
          // edge and back, in all weathers, resting a breath at
          // each end. Anything edible on its back (the lure's
          // offering hand loads it) is DELIVERED at the heart:
          // the load is consumed by the country, the delivery
          // is witnessed, and a fed heart answers with its own
          // sap — the bloom, doubled, made honest at item
          // scale. Its outer post is remembered on the bearer:
          // the route is ITS road, kept the way it keeps it.
          // -------------------------------------------------------
          let routeX = fauna.routeX;
          let routeZ = fauna.routeZ;
          let cargoItems = fauna.cargoItems;
          let bearerBusy = false;
          let hawkBusy = false;
          if (fauna.species === 'heartbearer' && !isTamed) {
            bearerBusy = true;
            const heartFlora = floraRef.current.find((fl) => fl.species === 'valley_heart' || fl.species === 'heartbloom');
            const heartTile = structuresRef.current.find((st) => st.type === 'heart_tile');
            const hx = heartFlora ? heartFlora.x : heartTile ? heartTile.worldX : 50;
            const hz = heartFlora ? heartFlora.z : heartTile ? heartTile.worldZ : 50;
            if (routeX === undefined || routeZ === undefined) {
              const edges = [
                { d: z, x, z: 4 },
                { d: 100 - z, x, z: 96 },
                { d: x, x: 4, z },
                { d: 100 - x, x: 96, z },
              ].sort((a, b) => a.d - b.d);
              routeX = edges[0].x;
              routeZ = edges[0].z;
            }
            if (!socialState) socialState = 'to-heart';
            if (socialState === 'resting') {
              state = 'idle';
              targetX = x;
              targetZ = z;
              socialTimer += dt;
              if (socialTimer >= 6) {
                socialTimer = 0;
                socialState = socialTravel === 1 ? 'to-edge' : 'to-heart';
              }
            } else {
              const tx = socialState === 'to-heart' ? hx : routeX;
              const tz = socialState === 'to-heart' ? hz : routeZ;
              state = 'wandering';
              targetX = tx;
              targetZ = tz;
              if (Math.hypot(tx - x, tz - z) <= 2.5) {
                if (socialState === 'to-heart') {
                  if ((cargoItems ?? []).length > 0) {
                    cargoItems = [];
                    spawnDroppedItem('heart_sap', 1, hx + 1.2, hz + 0.8);
                    if (distToPlayer < 30) witness('note_heartbearer');
                  }
                  socialTravel = 1;
                } else {
                  socialTravel = 0;
                }
                socialState = 'resting';
                socialTimer = 0;
              }
            }
          }

          // THE SENTINEL ROTATION (slice 49): a wild meadowback
          // herd keeps one head up. The rotation is the herd's
          // own clock — four minutes a watch, members in id
          // order — and the sentinel stands its watch where it
          // stands (the rotation below turns its head on a slow
          // scan). The others graze. It has never once hurried,
          // and neither has its relief.
          if (fauna.species === 'meadowback' && !isTamed) {
            const herd = faunaRef.current
              .filter((f) => f.species === 'meadowback' && !f.isTamed)
              .sort((a, b) => a.id.localeCompare(b.id));
            if (herd.length > 1 && herd[Math.floor(simClockRef.current / 240) % herd.length].id === fauna.id) {
              meadowBusy = true;
              sentinelFacing = true;
              state = 'idle';
              targetX = x;
              targetZ = z;
            }
          }

          // -------------------------------------------------------
          // THE FALL HAWK (creature slice 51, 2026-10-17): the
          // Skyfall Basin's aerial hunt — the roster's first
          // predator whose whole hunt is bespoke (its table row
          // carries NO hunt block; the generic engine never sees
          // it). Three movements, run on the social-state slots:
          // CIRCLE over its anchor (routeX/routeZ remember the
          // post; the flight row draws the altitude), STOOP on a
          // player caught in the open, CLIMB a full eight
          // seconds before it may stoop again. The tells are the
          // shadow and the whistle; the counter is COVER —
          // canopy-scale flora or any structure within reach
          // breaks the stoop mid-fall, because a hawk that
          // cannot see a clean fall aborts it. On Peaceful the
          // stoop still comes (theater, per the doctrine) but
          // the talons never land (the shared armed gate).
          // -------------------------------------------------------
          if (fauna.species === 'fall_hawk' && !isTamed) {
            hawkBusy = true;
            if (routeX === undefined || routeZ === undefined) {
              routeX = x;
              routeZ = z;
            }
            const underCover =
              structuresRef.current.some((st) => Math.hypot(st.worldX - playerX, st.worldZ - playerZ) <= 4.5) ||
              floraRef.current.some((fl) => fl.scale >= 1.5 && Math.hypot(fl.x - playerX, fl.z - playerZ) <= 4);
            if (!socialState) {
              socialState = 'circling';
              socialTimer = 0;
            }
            if (socialState === 'circling') {
              // A slow wheel over the post: the target walks a
              // 10 m circle on the social clock, advanced by the
              // id hash so no two hawks wheel in step.
              const idPhase = fauna.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 6;
              const ang = socialTimer * 0.45 + idPhase;
              state = 'wandering';
              targetX = routeX + Math.cos(ang) * 10;
              targetZ = routeZ + Math.sin(ang) * 10;
              socialTimer += dt;
              if (distToPlayer <= 16 && !underCover) {
                socialState = 'stooping';
                socialTimer = 0;
                if (distToPlayer < 30) witness('note_fall_hawk'); // the stoop, committed in the player's sight
              }
            } else if (socialState === 'stooping') {
              state = 'attacking';
              targetX = playerX;
              targetZ = playerZ;
              socialTimer += dt;
              if (underCover || socialTimer > 3.5) {
                // Aborted by cover, or the fall went long and
                // missed its moment: climb out either way.
                socialState = 'climbing';
                socialTimer = 0;
              } else if (distToPlayer <= 2.6) {
                if (attacksArmed) onFaunaAttack?.(fauna.species, 26);
                socialState = 'climbing';
                socialTimer = 0;
              }
            } else if (socialState === 'climbing') {
              // Eight seconds of climbing, away from the player
              // — the safe window the design promises.
              state = 'wandering';
              const awayA = Math.atan2(x - playerX, z - playerZ);
              targetX = x + Math.sin(awayA) * 12;
              targetZ = z + Math.cos(awayA) * 12;
              socialTimer += dt;
              if (socialTimer >= 8) {
                socialState = 'circling';
                socialTimer = 0;
              }
            }
          }

          if (!isTamed && !hunterAlert && !staffEngaged && !deerBusy && !bearerBusy && !meadowBusy && !hawkBusy) {
            state = 'wandering';
            // Restless wandering: standing at the target re-rolls fast
            // (short pauses, long roams); en route the re-roll stays rare
            // so a walk actually finishes.
            const atTarget = Math.hypot(targetX - x, targetZ - z) <= 0.4;
            const wanderChance = atTarget ? WANDER_CHANCE_RESTLESS : WANDER_CHANCE;
            if (Math.random() < wanderChance) {
              targetX = x + (Math.random() - 0.5) * WANDER_RADIUS;
              targetZ = z + (Math.random() - 0.5) * WANDER_RADIUS;
              // THE BLINK (slice 38, 2026-10-16): the Blink Hare
              // does not walk to its new target — it is simply
              // THERE, most of the time. The fastest ground
              // citizen keeps its speed for the chases it cannot
              // blink out of; its locomotion is the vanish.
              if (fauna.species === 'blink_hare' && Math.random() < 0.65) {
                x = targetX;
                z = targetZ;
                // The vanish, witnessed (slice 47).
                if (Math.hypot(playerX - x, playerZ - z) < 30) witness('note_blink_hare');
              }
              // THE CANDLE ROAD (slice 42, 2026-10-16): the Moon
              // Moth is the Night Candle's pollinator — the
              // candle lays a scent-road and the moth flies it
              // like a river. On night re-rolls, a moth with a
              // candle in range mostly makes for it instead of
              // wandering: the flora and the fauna are one
              // document in the field, as the design insists.
              if (fauna.species === 'moon_moth' && isNightNow && Math.random() < 0.6) {
                let candle: FloraEntity | null = null;
                let candleDist = 35;
                for (const fl of floraRef.current) {
                  if (fl.species !== 'night_candle') continue;
                  const d = Math.hypot(fl.x - x, fl.z - z);
                  if (d < candleDist) {
                    candleDist = d;
                    candle = fl;
                  }
                }
                if (candle) {
                  targetX = candle.x + (Math.random() - 0.5) * 4;
                  targetZ = candle.z + (Math.random() - 0.5) * 4;
                  // The course change, witnessed (slice 47): a
                  // moth turning for a candle, in the dark, near
                  // enough to see the road being flown.
                  if (distToPlayer < 30) witness('note_moon_moth');
                }
              }
            }
          }

          // Dissolve flight (Adam, 2026-10-16): a wild creature
          // under a dissolve breaks off and RUNS — the target is
          // set away from the player, overriding hunt and wander
          // alike while the dissolve lasts. That flight is the
          // emergency the sprayer buys: seconds, not safety.
          // When the timer dies, so does the flight.
          if (!isTamed && dissolveTimer > 0) {
            const away = Math.atan2(x - playerX, z - playerZ);
            targetX = x + Math.sin(away) * 14;
            targetZ = z + Math.cos(away) * 14;
            state = 'wandering';
          }

          // --- Legacy companions (tamed before commands existed) ---
          if (isTamed && !command && state === 'following') {
            targetX = playerX + Math.sin(fauna.id.length) * FOLLOW_OFFSET;
            targetZ = playerZ + Math.cos(fauna.id.length) * FOLLOW_OFFSET;
          }

          // Flinch hold: a staggered creature stays where it
          // stands — its movement target becomes its own feet.
          if (flinchTimer > 0) {
            targetX = x;
            targetZ = z;
          }

          // Pond bounds (pond build, 2026-10-16): a pond species'
          // world IS its pond — wander, dissolve-flight and chase
          // targets all clamp to the disc it spawned in (anchor +
          // radius stamped at generation). A pond hunter at the
          // disc's edge can still bite whatever wades in after it.
          if (!isTamed && fauna.anchorX !== undefined && fauna.anchorZ !== undefined && fauna.pondRadius) {
            const pdx = targetX - fauna.anchorX;
            const pdz = targetZ - fauna.anchorZ;
            const pd = Math.hypot(pdx, pdz);
            const maxD = fauna.pondRadius * 0.95;
            if (pd > maxD && pd > 0) {
              targetX = fauna.anchorX + (pdx / pd) * maxD;
              targetZ = fauna.anchorZ + (pdz / pd) * maxD;
            }
          }
          const distToTarget = Math.hypot(targetX - x, targetZ - z);
          let newRot = fauna.rotation;
          if (distToTarget > 0.4) {
            // A chasing hunter spends its burst (slice 5): the
            // ambusher's whole speed budget, at once, as designed.
            const moveSpeed =
              state === 'attacking' && fauna.species === 'fall_hawk'
                ? fauna.speed * 2.6 // THE STOOP (slice 51): a fall, aimed — the hawk's whole speed budget in one dive
                : state === 'attacking'
                  ? fauna.speed * 1.35
                  : isTamed
                  ? fauna.speed * 1.2
                  : staffEngaged && distToPlayer > 10
                    ? fauna.speed * 1.7 // staff hurry back to heel — the hound does not tire, the usher does not lose you
                    : fauna.speed;
            // The Hollow Hermit's schedule (slice 42): by day it
            // is scenery — a husk that does not walk while the
            // light is up, exactly as designed. It walks only in
            // the night band, very slowly, preferably unobserved.
            const hermitHoldsByDay =
              fauna.species === 'hollow_hermit' && phaseNow >= 0.25 && phaseNow < 0.75;
            if (!hermitHoldsByDay) {
              x += ((targetX - x) / distToTarget) * moveSpeed * dt;
              z += ((targetZ - z) / distToTarget) * moveSpeed * dt;
            }
            newRot = Math.atan2(targetX - x, targetZ - z);
          }

          // An alert stalker watches the intruder, not its path.
          // A stilling Answer Deer does the same, in peace
          // (slice 48): the mirror holds your gaze.
          if (state === 'alert' || deerStilling) {
            newRot = Math.atan2(playerX - x, playerZ - z);
          }
          // A sentinel's head (slice 49): face the nearest wild
          // hunter in regard; with nothing to watch, sweep —
          // slowly, the way a hill turns.
          if (sentinelFacing) {
            const watched = prevFauna
              .filter((o) => o.id !== fauna.id && !o.isTamed && speciesDef(o.species).hunt)
              .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0];
            if (watched && Math.hypot(watched.x - x, watched.z - z) <= 40) {
              newRot = Math.atan2(watched.x - x, watched.z - z);
            } else {
              newRot = (fauna.animTime * 0.25) % (Math.PI * 2);
            }
          }

          byproductTimer += dt;

          // Byproduct sheds — TABLE-DRIVEN (creature build phase,
          // slice 1, 2026-10-15): item, interval, and the tamed-only
          // rule all live in the species table (game/creatures/species.ts), so
          // a new species sheds by gaining an entry, not a branch
          // here. The two shipped patterns are preserved in the data:
          // tamed-only producers (soft-puff pellets, stalker scales)
          // and WILD shedders whose supply chains must never require
          // harming or taming the species (Adam, 2026-10-14: the
          // glider's vanes are a non-lethal byproduct; the moth's
          // dew and the pale hare's fur follow the same ruling).
          // Sample sheds (creature renewal, 2026-10-16): besides
          // its byproduct, every creature sheds a SAMPLE of
          // itself on a long clock — tamed ones on the kind
          // interval, the wild far more rarely, leaving traces
          // where they wander. Adam's ruling: samples come from
          // LIVING things or the dead; the living come first,
          // and a guardian's kill (above) is the dead's door.
          sampleTimer += dt;
          const sampleThreshold = isTamed ? SAMPLE_SHED_SECONDS_TAMED : SAMPLE_SHED_SECONDS_WILD;
          if (sampleTimer >= sampleThreshold) {
            sampleTimer = 0;
            spawnDroppedItem(sampleItemId(fauna.species), 1, x, z);
          }

          const shed = speciesDef(fauna.species).byproduct;
          if (shed && byproductTimer > shed.seconds && (!shed.tamedOnly || isTamed)) {
            byproductTimer = 0;
            spawnDroppedItem(shed.item, 1, x, z);
            onCritterExcrete?.(fauna.species);
            // The compost, witnessed (slice 47): the beetle's
            // finished work appearing at the burrow mouth in
            // the player's sight (pickup-side, fertilizer is
            // fertilizer from anywhere — the making is the
            // moment this note names).
            if (fauna.species === 'mulch_beetle' && distToPlayer < 25) witness('note_mulch_beetle');
          }

          const nextFauna = {
            ...fauna,
            x,
            z,
            state,
            rotation: newRot,
            targetX,
            targetZ,
            byproductTimer,
            biteTimer,
            sampleTimer,
            dissolveTimer,
            flinchTimer,
            provokedTimer,
            phaseTimer,
            hearthDecideTimer,
            hearthFedTimer,
            hearthAgeDays,
            socialState,
            socialTimer,
            socialTravel,
            calmRegard,
            cargoItems,
            routeX,
            routeZ,
            health: fauna.health - dissolveDamage,
            animTime: fauna.animTime + dt,
          };
          if (syncFaunaNow) multiplayerManager.broadcastEntityUpsert('fauna', nextFauna);
          return nextFauna;
        });
        // Projectile arrivals (weapons build, 2026-10-16): shots
        // whose travel time elapsed this tick resolve against the
        // mapped positions — a single-target shot strikes only if
        // its target is still within 2m of the aim point (it
        // moved, the shot misses); a burst shot strikes every wild
        // creature within its radius of the aim point. Tamed
        // creatures are spared. Damage folds into the death sweep
        // below with the guardians' ledger.
        const shotDamage = new Map<string, number>();
        if (pendingShotsRef.current.length > 0) {
          const due = pendingShotsRef.current.filter((s) => simClockRef.current >= s.arriveAt);
          if (due.length > 0) {
            pendingShotsRef.current = pendingShotsRef.current.filter((s) => simClockRef.current < s.arriveAt);
            for (const f of mappedFauna) {
              if (f.isTamed) continue;
              for (const s of due) {
                const dAim = Math.hypot(f.x - s.aimX, f.z - s.aimZ);
                const struck = s.burstRadius !== undefined ? dAim <= s.burstRadius : f.id === s.targetId && dAim <= 2.0;
                if (struck) shotDamage.set(f.id, (shotDamage.get(f.id) ?? 0) + s.damage);
              }
            }
          }
        }
        // An undecided Hearth Dog whose three days ran out
        // departs in this same sweep (slice 39): no remains, no
        // sample — it was never yours to lose. It leaves the way
        // it came, and the country may send another, later.
        const isDeparting = (f: FaunaEntity): boolean =>
          f.species === 'hearth_dog' &&
          !f.isTamed &&
          f.hearthDecideTimer !== undefined &&
          f.hearthDecideTimer <= 0 &&
          (f.hearthFeedings ?? 0) < 3;
        if (defenderDamage.size === 0 && shotDamage.size === 0 && !mappedFauna.some((f) => f.health <= 0) && !mappedFauna.some(isDeparting)) return mappedFauna;
        // Deaths leave remains where they fell — and remains are
        // a SAMPLE, the dead's half of Adam's sample ruling. The
        // killers that reach this sweep: a guardian's bites (the
        // ledger above), a solvent dissolve that finished its
        // work (health already subtracted in the map), a striker's
        // close hit (likewise), and a striker's shot on arrival.
        return mappedFauna.flatMap((f) => {
          if (isDeparting(f)) {
            hearthRef.current.lastDepartureAt = simClockRef.current;
            return [];
          }
          const dmg = (defenderDamage.get(f.id) ?? 0) + (shotDamage.get(f.id) ?? 0);
          const health = f.health - dmg;
          if (health > 0) {
            // Harmed and standing (slice 32): the blow is
            // remembered — a guardian's bite or a landed shot
            // provokes exactly like a strike does.
            return [dmg ? { ...f, health, provokedTimer: PROVOKED_SECONDS } : f];
          }
          spawnDroppedItem(sampleItemId(f.species), 1, f.x, f.z);
          // The World Asks Back (2026-10-16): the cull event for
          // saga latching — stamped where the kill is known real,
          // beside the sample the sweep drops.
          onAsksEvent?.({ kind: 'cull', species: f.species });
          // Kill loot (slice 32 — Adam's oversize pin: "if
          // killed, they should provide good loot"): the
          // species table's killLoot drops where the creature
          // fell, beside the sample, fanned so a pile of giant
          // spoils doesn't stack into a single tile.
          const killLoot = speciesDef(f.species).killLoot;
          if (killLoot) {
            killLoot.forEach(([item, count], i) => {
              spawnDroppedItem(item, count, f.x + ((i % 3) - 1) * 0.7, f.z + (Math.floor(i / 3) - 0.5) * 0.7);
            });
          }
          return [];
        });
      });

      // Guard-collectors deliver: remove what they fetched and credit it
      // through the normal pickup path — the same result as the player
      // walking over the drop, because the pet did the walking.
      if (collectedDrops.length > 0) {
        const collectedIds = new Set(collectedDrops.map((d) => d.id));
        setDroppedItems((prev) => prev.filter((d) => !collectedIds.has(d.id)));
        collectedDrops.forEach((d) => {
          onPickupItem(d);
          multiplayerManager.broadcastEntityRemove('drop', d.id);
        });
      }

        // 1b. Culture Vat Gestations (Adam, 2026-10-15): a vat's
        // culture works in loaded-zone time — this zone's structures
        // are the loaded ones by construction — and progress rides
        // the structure record into the world snapshot, so a
        // gestation survives saving, travel, and sleep. Written at
        // most once a second (see vatClockRef).
        vatClockRef.current += dt;
        if (vatClockRef.current >= 1) {
          const wholeSeconds = Math.floor(vatClockRef.current);
          vatClockRef.current -= wholeSeconds;
          const vats = structuresRef.current;
          if (vats.some((st) => st.type === 'culture_vat' && st.vat?.gestating && st.vat.gestating.progress < st.vat.gestating.total)) {
            setStructuresList((prev) =>
              prev.map((st) => {
                if (st.type !== 'culture_vat' || !st.vat?.gestating) return st;
                const g = st.vat.gestating;
                if (g.progress >= g.total) return st;
                return { ...st, vat: { ...st.vat, gestating: { ...g, progress: Math.min(g.total, g.progress + wholeSeconds) } } };
              }),
            );
          }
        }

      }

      // 2. Flora Growth & Replenish Tick (host authority)
      if (simulateWorld) {
      // Cells with rich soil, computed once per tick from the mirror.
      const moundCells = new Set(
        structuresRef.current
          .filter((s) => s.type === 'cultivation_mound')
          .map((s) => `${s.gridX},${s.gridZ}`)
      );
      // Certified hearths, computed once per tick (slice 43):
      // a hearthpod a Hearth Wisp currently keeps (anchored
      // within its claim of the pod). The Hearth Cap fruits
      // only in such a hearth's ash — the wisp certifies the
      // fire, the fungus seconds the motion.
      const certifiedHearths = structuresRef.current
        .filter((s) => s.type === 'hearthpod')
        .filter((pod) =>
          faunaRef.current.some(
            (f) =>
              f.species === 'hearth_wisp' &&
              f.anchorX !== undefined &&
              Math.hypot(f.anchorX - pod.worldX, f.anchorZ! - pod.worldZ) < 3.5
          )
        )
        .map((pod) => ({ x: pod.worldX, z: pod.worldZ }));
      // The Puffbell's hour, witnessed (slice 47): the bells
      // puff as the shared phase crosses each hour mark (the
      // mesh swells and puffs on that same clock); when the
      // hour turns with a ripe bell in the player's sight, the
      // synchronization has been seen to happen.
      {
        const hourIdx = Math.floor(phaseNow * 24);
        if (hourIdx !== puffHourRef.current) {
          puffHourRef.current = hourIdx;
          const bell = floraRef.current.find(
            (fl) => fl.species === 'puffbell' && fl.growthStage >= 4 && Math.hypot(fl.x - playerX, fl.z - playerZ) < 22
          );
          if (bell) witness('note_puffbell');
        }
      }
      setFloraList((prevFlora) =>
        prevFlora.map((flora) => {
          // ---------------------------------------------------------------
          // THE SAGE, LOOSED (slice 45, 2026-10-16): the Tumble
          // Sage is the rolling mode's plant citizen — at
          // season's turn the whole plant lets go of its root
          // and becomes its own seed-head. In sim terms: a sage
          // left RIPE and unharvested for four minutes lets go —
          // it rolls downwind (a heading seeded from its own id,
          // jittered) at a plains trot for ten to eighteen
          // meters, SHEDDING a Sage Leaf every bounce or so, and
          // re-roots where it stops, young again (stage 3, its
          // clock part-run). The scatter is the economy: the
          // geode roller gathers, the sage scatters, and a
          // plains company left unharvested migrates — the
          // Wind Plains' hello, at landscape scale. (Guests in
          // co-op see the start and the re-rooting via the
          // stage/ready broadcasts; the roll itself is the
          // host's view in v1.)
          // ---------------------------------------------------------------
          if (flora.species === 'tumble_sage') {
            if ((flora.rollLeft ?? 0) > 0) {
              // The rolling, witnessed (slice 47).
              if (Math.hypot(flora.x - playerX, flora.z - playerZ) < 22) witness('note_tumble_sage');
              const step = 3.5 * dt;
              const nx = Math.min(96, Math.max(4, flora.x + (flora.rollVx ?? 0) * dt));
              const nz = Math.min(96, Math.max(4, flora.z + (flora.rollVz ?? 0) * dt));
              let shed = (flora.rollShedTimer ?? 0) - dt;
              if (shed <= 0) {
                spawnDroppedItem('sage_leaf', 1, flora.x, flora.z);
                shed = 0.55;
              }
              const left = (flora.rollLeft ?? 0) - step;
              if (left <= 0) {
                return {
                  ...flora,
                  x: nx,
                  z: nz,
                  rollVx: undefined,
                  rollVz: undefined,
                  rollLeft: 0,
                  rollShedTimer: undefined,
                  looseTimer: 0,
                  harvestReady: false,
                  growthStage: 3,
                  harvestTimer: FLORA_MATURE_SECONDS * 0.45,
                };
              }
              return { ...flora, x: nx, z: nz, rollLeft: left, rollShedTimer: shed };
            }
            if (flora.harvestReady) {
              const loose = (flora.looseTimer ?? 0) + dt;
              if (loose >= 240) {
                const seedNum = flora.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
                const ang = (seedNum % 628) / 100 + (Math.random() - 0.5) * 0.8;
                const dist = 10 + (seedNum % 9);
                const tx = Math.min(94, Math.max(6, flora.x + Math.cos(ang) * dist));
                const tz = Math.min(94, Math.max(6, flora.z + Math.sin(ang) * dist));
                const actual = Math.hypot(tx - flora.x, tz - flora.z);
                if (actual < 3) return { ...flora, looseTimer: 0 }; // boxed in — wait for another season
                spawnDroppedItem('sage_leaf', 1, flora.x, flora.z);
                return {
                  ...flora,
                  looseTimer: 0,
                  harvestReady: false,
                  rollVx: ((tx - flora.x) / actual) * 3.5,
                  rollVz: ((tz - flora.z) / actual) * 3.5,
                  rollLeft: actual,
                  rollShedTimer: 0.55,
                };
              }
              return { ...flora, looseTimer: loose };
            }
          }

          if (flora.harvestReady) return flora;

          // The fertilizer clock runs down in real time; the boost lives
          // exactly as long as the timer does.
          const fertilizerTimer = Math.max(0, (flora.fertilizerTimer ?? 0) - dt);
          const fertilizerActive = fertilizerTimer > 0;

          // Speed sources stack: fertilizer boost x rich-soil mound.
          let growthMult = fertilizerActive ? FERTILIZED_GROWTH_MULT : 1.0;
          const cellX = Math.round(flora.x / 2);
          const cellZ = Math.round(flora.z / 2);
          if (moundCells.has(`${cellX},${cellZ}`)) growthMult *= MOUND_GROWTH_MULT;

          let newTimer = Math.max(0, flora.harvestTimer - dt * growthMult);
          // The certification gate (slice 43): an uncertified
          // Hearth Cap's countdown holds at the stage-3 line —
          // the fungus is present, but it will not fruit in an
          // unreviewed hearth's ash. Near a wisp-kept hearthpod
          // (within 7 m) the review has happened and growth runs.
          if (
            flora.species === 'hearth_cap' &&
            !certifiedHearths.some((h) => Math.hypot(h.x - flora.x, h.z - flora.z) <= 7)
          ) {
            newTimer = Math.max(newTimer, FLORA_MATURE_SECONDS * 0.2 + 0.01);
          }
          const isNowReady = newTimer === 0;
          // The fruiting, witnessed (slice 47): a Hearth Cap
          // crossing into readiness did so at a certified
          // hearth — the gate above guarantees it — and if the
          // player is standing in that hearth's light, the
          // certification has been seen to bear fruit.
          if (
            isNowReady &&
            !flora.harvestReady &&
            flora.species === 'hearth_cap' &&
            Math.hypot(flora.x - playerX, flora.z - playerZ) < 25
          ) {
            witness('note_hearth_cap');
          }
          // Stage is always read against the BASE mature time, so the
          // readout never jumps when a boost starts or wears off.
          const newStage = isNowReady ? 5 : Math.min(4, Math.floor((1 - newTimer / FLORA_MATURE_SECONDS) * 5));

          const nextFlora = {
            ...flora,
            harvestTimer: newTimer,
            harvestReady: isNowReady,
            growthStage: newStage,
            fertilizerTimer,
            fertilizedGrowth: fertilizerActive,
          };
          if (nextFlora.growthStage !== flora.growthStage || nextFlora.harvestReady !== flora.harvestReady || nextFlora.fertilizedGrowth !== flora.fertilizedGrowth) {
            multiplayerManager.broadcastEntityUpsert('flora', nextFlora);
          }
          return nextFlora;
        })
      );
      }

      // 3. Dropped Item Magnetism & Pickup (Zero else)
      setDroppedItems((prevDrops) => {
        const remaining: DroppedItemEntity[] = [];
        prevDrops.forEach((item) => {
          const distToPlayer = Math.hypot(playerX - item.x, playerZ - item.z);
          if (distToPlayer < 2.0) {
            onPickupItem(item);
            multiplayerManager.broadcastEntityRemove('drop', item.id);
            return;
          }

          let nx = item.x;
          let nz = item.z;
          if (distToPlayer < 5.0) {
            nx += ((playerX - item.x) / distToPlayer) * 3.5 * dt;
            nz += ((playerZ - item.z) / distToPlayer) * 3.5 * dt;
          }
          remaining.push({
            ...item,
            x: nx,
            z: nz,
            bobTime: item.bobTime + dt,
          });
        });
        return remaining;
      });
    },
    [spawnDroppedItem]
  );

  return {
    floraList,
    faunaList,
    structuresList,
    droppedItems,
    addFlora,
    upsertFlora,
    removeFlora,
    resetFloraHarvest,
    applyFloraFertilizer,
    addStructure,
    upsertStructure,
    removeStructure,
    tameFauna,
    hearthFeed,
    loadHeartbearer,
    setFaunaCommand,
    releaseFauna,
    applyDissolve,
    strikeFauna,
    fireProjectile,
    upsertFauna,
    removeFauna,
    spawnDroppedItem,
    upsertDroppedItem,
    removeDroppedItem,
    replaceWorld,
    updateTick,
  };
}
