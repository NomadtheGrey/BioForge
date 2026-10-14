/**
 * BioForge World Entities & Ecosystem Simulation Domain Hook
 * Manages flora, fauna, living structures, and dropped byproduct items
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  FloraEntity,
  FaunaEntity,
  StructureEntity,
  DroppedItemEntity,
} from '../types/game';
import { multiplayerManager } from '../game/multiplayer';
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
// How close (meters) a wild stalker lets a player get before it stops,
// faces them, and watches. Peaceful awareness only — no attacks.
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

const INITIAL_STRUCTURES: StructureEntity[] = [
  {
    id: 'struct_start_floor_1',
    type: 'root_tile_floor',
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
    gridZ: -1,
    worldX: 0,
    worldZ: -2,
    rotation: 0,
    health: 150,
    maxHealth: 150,
    doorOpenProgress: 0,
  },
  {
    id: 'struct_start_door',
    type: 'iris_slit_door',
    gridX: 1,
    gridZ: -1,
    worldX: 2,
    worldZ: -2,
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
    onCritterExcrete?: (species: string) => void
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
              command: fn.species === 'chitin_stalker' ? 'guard' : 'follow',
              anchorX: fn.species === 'chitin_stalker' ? fn.x : fn.anchorX,
              anchorZ: fn.species === 'chitin_stalker' ? fn.z : fn.anchorZ,
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
      onCritterExcrete?: (species: string) => void
    ): void => {
      const simulateWorld = !multiplayerManager.isConnected || multiplayerManager.isHost;

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
      setFaunaList((prevFauna) =>
        prevFauna.map((fauna) => {
          let { x, z, state, isTamed, targetX, targetZ, byproductTimer, command } = fauna;

          // --- Companion orders (tamed, with a command set) ---
          if (isTamed && command === 'follow') {
            targetX = playerX + Math.sin(fauna.id.length) * FOLLOW_OFFSET;
            targetZ = playerZ + Math.cos(fauna.id.length) * FOLLOW_OFFSET;
            state = 'following';
          }
          if (isTamed && command === 'stay') {
            state = 'idle';
          }
          // Guard, stalker: a real patrol — waypoints on a ring around the
          // anchor post, a new one on every arrival. When hostiles exist
          // (Normal), engagement hooks in from this same state.
          if (isTamed && command === 'guard' && fauna.species === 'chitin_stalker') {
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
          if (isTamed && command === 'guard' && fauna.species !== 'chitin_stalker') {
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

          // --- Wild creatures ---
          const distToPlayer = Math.hypot(playerX - x, playerZ - z);
          // Stalkers are territorial: inside their aggro range they stop
          // and face the intruder. Peaceful promise kept — noticing is
          // not attacking; attacks arrive with Normal difficulty.
          const stalkerAlert =
            !isTamed && fauna.species === 'chitin_stalker' && distToPlayer <= AGGRO_RANGE;
          if (stalkerAlert) {
            state = 'alert';
            targetX = x;
            targetZ = z;
          }
          if (!isTamed && !stalkerAlert) {
            state = 'wandering';
            // Restless wandering: standing at the target re-rolls fast
            // (short pauses, long roams); en route the re-roll stays rare
            // so a walk actually finishes.
            const atTarget = Math.hypot(targetX - x, targetZ - z) <= 0.4;
            const wanderChance = atTarget ? WANDER_CHANCE_RESTLESS : WANDER_CHANCE;
            if (Math.random() < wanderChance) {
              targetX = x + (Math.random() - 0.5) * WANDER_RADIUS;
              targetZ = z + (Math.random() - 0.5) * WANDER_RADIUS;
            }
          }

          // --- Legacy companions (tamed before commands existed) ---
          if (isTamed && !command && state === 'following') {
            targetX = playerX + Math.sin(fauna.id.length) * FOLLOW_OFFSET;
            targetZ = playerZ + Math.cos(fauna.id.length) * FOLLOW_OFFSET;
          }

          const distToTarget = Math.hypot(targetX - x, targetZ - z);
          let newRot = fauna.rotation;
          if (distToTarget > 0.4) {
            const moveSpeed = isTamed ? fauna.speed * 1.2 : fauna.speed;
            x += ((targetX - x) / distToTarget) * moveSpeed * dt;
            z += ((targetZ - z) / distToTarget) * moveSpeed * dt;
            newRot = Math.atan2(targetX - x, targetZ - z);
          }

          // An alert stalker watches the intruder, not its path.
          if (state === 'alert') {
            newRot = Math.atan2(playerX - x, playerZ - z);
          }

          byproductTimer += dt;

          // Soft-Puff byproduct (Bio-Pellets)
          if (isTamed && fauna.species === 'soft_puff' && byproductTimer > 25) {
            byproductTimer = 0;
            spawnDroppedItem('bio_pellet', 1, x, z);
            onCritterExcrete?.('soft_puff');
          }

          // Chitin-Stalker byproduct (Carapace Scales)
          if (isTamed && fauna.species === 'chitin_stalker' && byproductTimer > 35) {
            byproductTimer = 0;
            spawnDroppedItem('carapace_scale', 1, x, z);
            onCritterExcrete?.('chitin_stalker');
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
            animTime: fauna.animTime + dt,
          };
          if (syncFaunaNow) multiplayerManager.broadcastEntityUpsert('fauna', nextFauna);
          return nextFauna;
        })
      );

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
    upsertFauna,
    removeFauna,
    spawnDroppedItem,
    upsertDroppedItem,
    removeDroppedItem,
    replaceWorld,
    updateTick,
  };
}
