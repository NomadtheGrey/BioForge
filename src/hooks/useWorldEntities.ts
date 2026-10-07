/**
 * BioForge World Entities & Ecosystem Simulation Domain Hook
 * Manages flora, fauna, living structures, and dropped byproduct items
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback } from 'react';
import {
  FloraEntity,
  FaunaEntity,
  StructureEntity,
  DroppedItemEntity,
} from '../types/game';

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
    harvestTimer: 10,
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
    gridX: 0,
    gridZ: 0,
    worldX: 0,
    worldZ: 0,
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
  resetFloraHarvest: (floraId: string, regrowthDuration: number) => void;
  applyFloraFertilizer: (floraId: string, type: 'growth' | 'yield') => void;
  addStructure: (structure: StructureEntity) => void;
  removeStructure: (structureId: string) => void;
  tameFauna: (faunaId: string, customName: string, state: FaunaEntity['state']) => void;
  spawnDroppedItem: (itemId: DroppedItemEntity['itemId'], count: number, x: number, z: number) => void;
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
            growthStage: Math.min(3, f.growthStage + 1),
            harvestReady: true,
          };
        }
        return { ...f, fertilizedYield: true };
      })
    );
  }, []);

  const addStructure = useCallback((structure: StructureEntity): void => {
    setStructuresList((prev) => [...prev, structure]);
  }, []);

  const removeStructure = useCallback((structureId: string): void => {
    setStructuresList((prev) => prev.filter((s) => s.id !== structureId));
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
            }
          : fn
      )
    );
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
  }, []);

  const updateTick = useCallback(
    (
      dt: number,
      playerX: number,
      playerZ: number,
      onPickupItem: (item: DroppedItemEntity) => void,
      onCritterExcrete?: (species: string) => void
    ): void => {
      // 1. Fauna Behavioral AI Tick
      setFaunaList((prevFauna) =>
        prevFauna.map((fauna) => {
          let { x, z, state, isTamed, targetX, targetZ, byproductTimer } = fauna;

          if (isTamed && state === 'following') {
            targetX = playerX + Math.sin(fauna.id.length) * 2.5;
            targetZ = playerZ + Math.cos(fauna.id.length) * 2.5;
          }
          if ((!isTamed || state !== 'following') && Math.random() < 0.015) {
            targetX = x + (Math.random() - 0.5) * 12;
            targetZ = z + (Math.random() - 0.5) * 12;
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

          return {
            ...fauna,
            x,
            z,
            rotation: newRot,
            targetX,
            targetZ,
            byproductTimer,
            animTime: fauna.animTime + dt,
          };
        })
      );

      // 2. Flora Growth & Replenish Tick
      setFloraList((prevFlora) =>
        prevFlora.map((flora) => {
          if (flora.harvestReady) return flora;

          const growthMult = flora.fertilizedGrowth ? 2.5 : 1.0;
          const newTimer = Math.max(0, flora.harvestTimer - dt * growthMult);
          const isNowReady = newTimer === 0;
          const newStage = isNowReady ? 3 : Math.min(2, Math.floor((1 - newTimer / 18) * 3));

          return {
            ...flora,
            harvestTimer: newTimer,
            harvestReady: isNowReady,
            growthStage: newStage,
          };
        })
      );

      // 3. Dropped Item Magnetism & Pickup (Zero else)
      setDroppedItems((prevDrops) => {
        const remaining: DroppedItemEntity[] = [];
        prevDrops.forEach((item) => {
          const distToPlayer = Math.hypot(playerX - item.x, playerZ - item.z);
          if (distToPlayer < 2.0) {
            onPickupItem(item);
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
    resetFloraHarvest,
    applyFloraFertilizer,
    addStructure,
    removeStructure,
    tameFauna,
    spawnDroppedItem,
    updateTick,
  };
}
