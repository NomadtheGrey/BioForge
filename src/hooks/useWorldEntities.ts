/**
 * BioForge World Entities & Ecosystem Simulation Domain Hook
 * Manages flora, fauna, living structures, and dropped byproduct items
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback, useRef } from 'react';
import {
  FloraEntity,
  FaunaEntity,
  StructureEntity,
  DroppedItemEntity,
} from '../types/game';
import { multiplayerManager } from '../game/multiplayer';
import type { WorldSnapshot } from '../game/saveSystem';


export const FLORA_MATURE_SECONDS = 90;
export const FLORA_MATURE_SECONDS_FERTILIZED = 25;
export const FERTILIZED_GROWTH_MULT = 2.5;
export const FOLLOW_OFFSET = 2.5;
export const WANDER_CHANCE = 0.015;
export const WANDER_RADIUS = 12;

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
            growthStage: Math.min(5, f.growthStage + 1),
            harvestReady: true,
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
      setFaunaList((prevFauna) =>
        prevFauna.map((fauna) => {
          let { x, z, state, isTamed, targetX, targetZ, byproductTimer, command } = fauna;

          if (isTamed && command) {
            // Pet commands drive tamed companions; state reflects current activity.
            // Peaceful mode: guard holds its anchor — hostile engagement hooks in later.
            if (command === 'follow') {
              targetX = playerX + Math.sin(fauna.id.length) * FOLLOW_OFFSET;
              targetZ = playerZ + Math.cos(fauna.id.length) * FOLLOW_OFFSET;
              state = 'following';
            } else if (command === 'stay') {
              state = 'idle';
            } else {
              state = 'patrolling';
            }
          } else {
            if (isTamed && state === 'following') {
              targetX = playerX + Math.sin(fauna.id.length) * FOLLOW_OFFSET;
              targetZ = playerZ + Math.cos(fauna.id.length) * FOLLOW_OFFSET;
            }
            if ((!isTamed || state !== 'following') && Math.random() < WANDER_CHANCE) {
              targetX = x + (Math.random() - 0.5) * WANDER_RADIUS;
              targetZ = z + (Math.random() - 0.5) * WANDER_RADIUS;
            }
          }

          const distToTarget = Math.hypot(targetX - x, targetZ - z);
          let newRot = fauna.rotation;
          if (distToTarget > 0.4) {
            const moveSpeed = isTamed ? fauna.speed * 1.2 : fauna.speed;
            x += ((targetX - x) / distToTarget) * moveSpeed * dt;
            z += ((targetZ - z) / distToTarget) * moveSpeed * dt;
            newRot = Math.atan2(targetX - x, targetZ - z);
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
      }

      // 2. Flora Growth & Replenish Tick (host authority)
      if (simulateWorld) {
      setFloraList((prevFlora) =>
        prevFlora.map((flora) => {
          if (flora.harvestReady) return flora;

          const maxTimer = flora.fertilizedGrowth ? FLORA_MATURE_SECONDS_FERTILIZED : FLORA_MATURE_SECONDS;
          const growthMult = flora.fertilizedGrowth ? FERTILIZED_GROWTH_MULT : 1.0;
          const newTimer = Math.max(0, flora.harvestTimer - dt * growthMult);
          const isNowReady = newTimer === 0;
          const newStage = isNowReady ? 5 : Math.min(4, Math.floor((1 - newTimer / maxTimer) * 5));

          const nextFlora = {
            ...flora,
            harvestTimer: newTimer,
            harvestReady: isNowReady,
            growthStage: newStage,
          };
          if (nextFlora.growthStage !== flora.growthStage || nextFlora.harvestReady !== flora.harvestReady) {
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
