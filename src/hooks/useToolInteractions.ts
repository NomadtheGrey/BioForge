/**
 * BioForge Tool Interactions Domain Hook
 * Encapsulates non-lethal harvesting, scanning, planting, solvent deconstruction, and taming
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 2 (Functional Style), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useCallback } from 'react';
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
import { ITEMS } from '../game/constants';
import { soundEngine } from '../audio/soundEngine';
import { multiplayerManager } from '../game/multiplayer';
import { FLORA_MATURE_SECONDS, FLORA_MATURE_SECONDS_FERTILIZED } from './useWorldEntities';

export interface UseToolInteractionsParams {
  activeTool: ToolType;
  selectedStructureType: StructureType;
  selectedSeedId: ItemId;
  inventory: Record<ItemId, number>;
  addInventoryItem: (itemId: ItemId, count?: number) => void;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  hasItem: (itemId: ItemId, minCount?: number) => boolean;
  resetFloraHarvest: (floraId: string, regrowthDuration: number) => void;
  applyFloraFertilizer: (floraId: string, type: 'growth' | 'yield') => void;
  addFlora: (flora: FloraEntity) => void;
  addStructure: (structure: StructureEntity) => void;
  removeStructure: (structureId: string) => void;
  tameFauna: (faunaId: string, customName: string, state: FaunaEntity['state']) => void;
  setFaunaCommand: (faunaId: string, cmd: 'follow' | 'stay' | 'guard') => void;
  setCodexList: React.Dispatch<React.SetStateAction<CodexEntry[]>>;
  postNotification: (
    title: string,
    message: string,
    type?: GameNotification['type'],
    iconColor?: string
  ) => void;
  onOpenBioForgeModal: () => void;
  triggerHarvestFx: (x: number, z: number) => void;
  triggerSolventFx: (x: number, z: number) => void;
}

export function useToolInteractions({
  activeTool,
  selectedStructureType,
  selectedSeedId,
  inventory,
  addInventoryItem,
  deductInventoryItem,
  hasItem,
  resetFloraHarvest,
  applyFloraFertilizer,
  addFlora,
  addStructure,
  removeStructure,
  tameFauna,
  setFaunaCommand,
  setCodexList,
  postNotification,
  onOpenBioForgeModal,
  triggerHarvestFx,
  triggerSolventFx,
}: UseToolInteractionsParams) {
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

      soundEngine.playHarvest();
      triggerHarvestFx(flora.x, flora.z);

      let yieldItem: ItemId = 'resin_sap';
      let yieldCount = 2;

      switch (flora.species) {
        case 'lantern_fern':
          yieldItem = 'soft_fiber';
          yieldCount = flora.fertilizedYield ? 5 : 2;
          addInventoryItem('dew_essence', 1);
          break;
        case 'sap_weaver':
          yieldItem = 'resin_sap';
          yieldCount = flora.fertilizedYield ? 6 : 3;
          break;
        case 'petal_mill':
          yieldItem = 'vibrant_petal';
          yieldCount = flora.fertilizedYield ? 6 : 3;
          addInventoryItem('sweet_nectar', 2);
          break;
        case 'snap_trap':
          yieldItem = 'carapace_scale';
          yieldCount = 1;
          break;
        case 'bell_bloom':
        default:
          yieldItem = 'dew_essence';
          yieldCount = flora.fertilizedYield ? 4 : 2;
          addInventoryItem('soft_fiber', 1);
          break;
      }

      addInventoryItem(yieldItem, yieldCount);
      // Trimmings: every harvest yields a little compost — the renewable source
      addInventoryItem('basic_compost', 1);
      const regrowTimer = flora.fertilizedGrowth ? FLORA_MATURE_SECONDS_FERTILIZED : FLORA_MATURE_SECONDS;
      resetFloraHarvest(flora.id, regrowTimer);
      multiplayerManager.broadcastEntityUpsert('flora', {
        ...flora,
        harvestReady: false,
        harvestTimer: regrowTimer,
        fertilizedYield: false,
        growthStage: 0,
      });

      setCodexList((prev) =>
        prev.map((c) =>
          c.species === flora.species
            ? { ...c, discovered: true, scannedCount: c.scannedCount + 1 }
            : c
        )
      );

      postNotification(
        'Harvest Successful',
        `Gathered ${yieldCount}x ${ITEMS[yieldItem]?.name || yieldItem} non-lethally.`,
        'harvest',
        ITEMS[yieldItem]?.color || '#2dd4bf'
      );

    },
    [addInventoryItem, resetFloraHarvest, setCodexList, postNotification, triggerHarvestFx]
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

      setCodexList((prev) =>
        prev.map((entry) =>
          entry.species === speciesKey
            ? { ...entry, discovered: true, scannedCount: entry.scannedCount + 1 }
            : entry
        )
      );

      postNotification(
        'Bio-Scanner Logged',
        `Discovered genetic traits for ${displayName}. Added to Codex [C].`,
        'discover',
        '#06b6d4'
      );
    },
    [setCodexList, postNotification]
  );

  // 3. Planter Trowel & Fertilizers
  const handlePlanterAction = useCallback(
    (worldX: number, worldZ: number, targetFlora?: FloraEntity): void => {
      // Applying Fertilizer to existing plant
      if (targetFlora) {
        if (hasItem('growth_fertilizer', 1)) {
          deductInventoryItem('growth_fertilizer', 1);
          soundEngine.playFertilize();
          applyFloraFertilizer(targetFlora.id, 'growth');
          multiplayerManager.broadcastEntityUpsert('flora', {
            ...targetFlora,
            fertilizedGrowth: true,
            growthStage: Math.min(5, targetFlora.growthStage + 1),
            harvestReady: true,
          });
          postNotification('Growth Fertilizer Applied', 'Tripled plant maturation rate! Flower is ready to harvest.', 'craft', '#10b981');
          return;
        }

        if (hasItem('yield_fertilizer', 1)) {
          deductInventoryItem('yield_fertilizer', 1);
          soundEngine.playFertilize();
          applyFloraFertilizer(targetFlora.id, 'yield');
          multiplayerManager.broadcastEntityUpsert('flora', {
            ...targetFlora,
            fertilizedYield: true,
          });
          postNotification('Yield Fertilizer Applied', 'Enhanced material yield and triggered rare bio-traits.', 'craft', '#a855f7');
          return;
        }

        postNotification('No Fertilizer in Pouch', 'Craft Growth Fertilizer (Compost + Bio-Pellets) in the Bio-Forge [B].', 'alert', '#fbbf24');
        return;
      }

      // Planting a new seed
      if (!hasItem(selectedSeedId, 1)) {
        postNotification('No Seeds in Stock', `You need a ${ITEMS[selectedSeedId]?.name || selectedSeedId} to plant. Craft more in Bio-Forge [B].`, 'alert', '#ef4444');
        return;
      }

      deductInventoryItem(selectedSeedId, 1);
      soundEngine.playFertilize();

      let species: FloraEntity['species'] = 'lantern_fern';
      if (selectedSeedId === 'seed_sap_weaver') species = 'sap_weaver';
      if (selectedSeedId === 'seed_petal_mill') species = 'petal_mill';
      if (selectedSeedId === 'seed_snap_trap') species = 'snap_trap';
      if (selectedSeedId === 'seed_bell_bloom') species = 'bell_bloom';

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
        harvestReady: false,
        harvestTimer: FLORA_MATURE_SECONDS,
        isHazardous: false,
        swayOffset: Math.random() * 3,
        isPlayerPlanted: true,
      };

      addFlora(newFlora);
      multiplayerManager.broadcastEntityUpsert('flora', newFlora);
      postNotification('Spore Planted', `Successfully cultivated ${ITEMS[selectedSeedId]?.name}. Water with fertilizer to accelerate!`, 'craft', '#4ade80');
    },
    [selectedSeedId, hasItem, deductInventoryItem, applyFloraFertilizer, addFlora, postNotification]
  );

  // 4. Solvent Sprayer (100% Recycler)
  const handleSolventSprayer = useCallback(
    (structure: StructureEntity): void => {
      soundEngine.playSolventSpray();
      triggerSolventFx(structure.worldX, structure.worldZ);

      // Return 100% of seed-nodes to inventory
      addInventoryItem(structure.type as ItemId, 1);
      removeStructure(structure.id);

      postNotification(
        'Bio-Structure Dissolved',
        `Gentle enzyme returned 100% of ${ITEMS[structure.type]?.name || structure.type} to your pouch.`,
        'craft',
        '#38bdf8'
      );

      multiplayerManager.broadcastEntityRemove('structure', structure.id);
    },
    [addInventoryItem, removeStructure, triggerSolventFx, postNotification]
  );

  // 5. Taming Lure
  const handleTameFauna = useCallback(
    (fauna: FaunaEntity): void => {
      if (fauna.isTamed) {
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

      if (fauna.species === 'soft_puff' || fauna.species === 'burrow_mouse') {
        if (!hasItem('sweet_nectar', 1)) {
          postNotification('Sweet Nectar Needed', 'Harvest Sweet Nectar from Petal-Mills or craft bait in the Bio-Forge [B] to tame Soft-Puffs.', 'alert', '#fbbf24');
          return;
        }

        deductInventoryItem('sweet_nectar', 1);
        soundEngine.playTameCritter();
        tameFauna(fauna.id, 'Luminescent Puff', 'following');

        postNotification(
          'Companion Domesticated!',
          'Soft-Puff tamed! It follows you and excretes high-grade Bio-Pellets. Lure it again to order it to stay or guard.',
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

        soundEngine.playTameCritter();
        tameFauna(fauna.id, 'Base Guardian Stalker', 'patrolling');

        postNotification(
          'Apex Guardian Tamed!',
          'Chitin-Stalker now patrols your outpost territory and sheds Reinforced Carapace Scales.',
          'tame',
          '#a855f7'
        );

        multiplayerManager.broadcastFaunaTame(fauna.id, multiplayerManager.playerName);
      }
    },
    [hasItem, deductInventoryItem, tameFauna, postNotification]
  );

  // 6. Bio-Builder Placement
  const handleBuildPlacement = useCallback(
    (worldX: number, worldZ: number): void => {
      if (!hasItem(selectedStructureType, 1)) {
        postNotification(
          'Insufficient Seed-Nodes',
          `No ${ITEMS[selectedStructureType]?.name || selectedStructureType} remaining in pouch. Synthesize more at Bio-Forge [B].`,
          'alert',
          '#ef4444'
        );
        return;
      }

      const gridX = Math.round(worldX / 2);
      const gridZ = Math.round(worldZ / 2);

      deductInventoryItem(selectedStructureType, 1);
      soundEngine.playBuildPlace();

      const newStruct: StructureEntity = {
        id: 'struct_' + Math.random().toString(36).substring(2, 9),
        type: selectedStructureType,
        gridX,
        gridZ,
        worldX: gridX * 2,
        worldZ: gridZ * 2,
        rotation: 0,
        health: 120,
        maxHealth: 120,
        doorOpenProgress: 0,
      };

      addStructure(newStruct);
      postNotification('Living Composite Placed', `Grown ${ITEMS[selectedStructureType]?.name}. Fully recyclable via Solvent Sprayer [4].`, 'craft', '#a855f7');
      multiplayerManager.broadcastEntityUpsert('structure', newStruct);
    },
    [selectedStructureType, hasItem, deductInventoryItem, addStructure, postNotification]
  );

  // Unified Interactions Handlers (Flat, zero else)
  const handleGroundClick = useCallback(
    (worldX: number, worldZ: number): void => {
      if (activeTool === 'builder') {
        handleBuildPlacement(worldX, worldZ);
        return;
      }
      if (activeTool === 'planter_trowel') {
        handlePlanterAction(worldX, worldZ);
        return;
      }
    },
    [activeTool, handleBuildPlacement, handlePlanterAction]
  );

  const handleFloraInteract = useCallback(
    (flora: FloraEntity): void => {
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
    },
    [activeTool, handleHarvestFlora, handleScanTarget, handlePlanterAction]
  );

  const handleFaunaInteract = useCallback(
    (fauna: FaunaEntity): void => {
      if (activeTool === 'taming_lure') {
        handleTameFauna(fauna);
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'fauna', entity: fauna, name: fauna.species, details: '' });
        return;
      }
    },
    [activeTool, handleTameFauna, handleScanTarget]
  );

 const handleStructureInteract = useCallback(
  (structure: StructureEntity): void => {
    // Builder on flat surfaces: floors and mounds act as ground for placement
    if (activeTool === 'builder' && (structure.type === 'root_tile_floor' || structure.type === 'cultivation_mound')) {
      handleGroundClick(structure.worldX, structure.worldZ);
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
  [activeTool, handleSolventSprayer, handleScanTarget, onOpenBioForgeModal, handleGroundClick]
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
