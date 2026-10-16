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
import { speciesDef } from '../game/species';
import { sampleItemId, SAMPLE_SHED_SECONDS_TAMED, SAMPLE_SHED_SECONDS_WILD } from '../game/vat';
import type { WorldSnapshot } from '../game/saveSystem';


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
  setFaunaCommand: (faunaId: string, cmd: 'follow' | 'stay' | 'guard') => void;
  releaseFauna: (faunaId: string) => void;
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

  const releaseFauna = useCallback((faunaId: string): void => {
    setFaunaList((prev) =>
      prev.map((fn) =>
        fn.id === faunaId
          ? { ...fn, isTamed: false, tamedBy: undefined, command: undefined, anchorX: undefined, anchorZ: undefined, state: 'wandering' as const }
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
      attacksArmed?: boolean
    ): void => {
      const simulateWorld = !multiplayerManager.isConnected || multiplayerManager.isHost;
      combatArmedRef.current = !!attacksArmed;
      // The projectile ledger runs on this clock (weapons build,
      // 2026-10-16): shots resolve when their travel time elapses.
      simClockRef.current += dt;

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
          if (diveSpec) phaseTimer = (phaseTimer + dt) % diveSpec.cycleSeconds;
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
          // Guard, everyone else (soft-puffs, burrow mice): sanitation
          // duty — fetch the nearest loose drop back to the pouch. With
          // nothing to fetch, return to the anchor post and wait.
          if (isTamed && command === 'guard' && !speciesDef(fauna.species).hunt) {
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
          const hunterAlert = !!hunt && provoked && distToPlayer <= hunt.aggroRange;
          biteTimer = Math.max(0, biteTimer - dt);
          if (hunterAlert && hunt) {
            if (attacksArmed) {
              state = 'attacking';
              targetX = playerX;
              targetZ = playerZ;
              if (distToPlayer <= hunt.biteRange && biteTimer <= 0 && flinchTimer <= 0) {
                onFaunaAttack?.(fauna.species, hunt.damage);
                biteTimer = hunt.biteCooldownSeconds;
              }
            } else {
              state = 'alert';
              targetX = x;
              targetZ = z;
            }
          }
          if (!isTamed && !hunterAlert) {
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
            const moveSpeed = state === 'attacking' ? fauna.speed * 1.35 : isTamed ? fauna.speed * 1.2 : fauna.speed;
            x += ((targetX - x) / distToTarget) * moveSpeed * dt;
            z += ((targetZ - z) / distToTarget) * moveSpeed * dt;
            newRot = Math.atan2(targetX - x, targetZ - z);
          }

          // An alert stalker watches the intruder, not its path.
          if (state === 'alert') {
            newRot = Math.atan2(playerX - x, playerZ - z);
          }

          byproductTimer += dt;

          // Byproduct sheds — TABLE-DRIVEN (creature build phase,
          // slice 1, 2026-10-15): item, interval, and the tamed-only
          // rule all live in the species table (game/species.ts), so
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
        if (defenderDamage.size === 0 && shotDamage.size === 0 && !mappedFauna.some((f) => f.health <= 0)) return mappedFauna;
        // Deaths leave remains where they fell — and remains are
        // a SAMPLE, the dead's half of Adam's sample ruling. The
        // killers that reach this sweep: a guardian's bites (the
        // ledger above), a solvent dissolve that finished its
        // work (health already subtracted in the map), a striker's
        // close hit (likewise), and a striker's shot on arrival.
        return mappedFauna.flatMap((f) => {
          const dmg = (defenderDamage.get(f.id) ?? 0) + (shotDamage.get(f.id) ?? 0);
          const health = f.health - dmg;
          if (health > 0) {
            // Harmed and standing (slice 32): the blow is
            // remembered — a guardian's bite or a landed shot
            // provokes exactly like a strike does.
            return [dmg ? { ...f, health, provokedTimer: PROVOKED_SECONDS } : f];
          }
          spawnDroppedItem(sampleItemId(f.species), 1, f.x, f.z);
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
      setFloraList((prevFlora) =>
        prevFlora.map((flora) => {
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

          const newTimer = Math.max(0, flora.harvestTimer - dt * growthMult);
          const isNowReady = newTimer === 0;
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
