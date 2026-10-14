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
import { FLORA_MATURE_SECONDS, FERTILIZER_DURATION_SECONDS } from './useWorldEntities';
import { GROUND_LAYER_TYPES, isEdgePanel, occupancyConflict, placementFor } from '../game/placement';

// A new plant must be at least this far (meters) from every existing one —
// anything closer is a stack of seedlings on one spot, not a garden.
const MIN_PLANT_SPACING = 1.0;

// Taming odds per lure attempt, by species. The bait is eaten either way —
// a failed attempt is a snack, not a refund. Docile species rarely refuse;
// the stalker is a predator and tames on its own terms.
const TAME_CHANCE_SOFT_PUFF = 0.8;
const TAME_CHANCE_BURROW_MOUSE = 0.6;
const TAME_CHANCE_CHITIN_STALKER = 0.25;

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
  addFlora: (flora: FloraEntity) => void;
  addStructure: (structure: StructureEntity) => void;
  removeStructure: (structureId: string) => void;
  removeFlora: (floraId: string) => void;
  /** Player facing snapped to 90° steps — placed structures inherit it. */
  getPlacementRotation: () => number;
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
  selectedFertilizerId,
  inventory,
  structuresList,
  floraList,
  addInventoryItem,
  deductInventoryItem,
  hasItem,
  resetFloraHarvest,
  applyFloraFertilizer,
  addFlora,
  addStructure,
  removeStructure,
  removeFlora,
  getPlacementRotation,
  tameFauna,
  setFaunaCommand,
  setCodexList,
  postNotification,
  onOpenBioForgeModal,
  triggerHarvestFx,
  triggerSolventFx,
}: UseToolInteractionsParams) {
  // What a harvest-ready plant gives up, per species — ONE table shared by
  // the harvest glove (which leaves the plant standing to regrow) and the
  // solvent sprayer (which dissolves it outright), so the two can never
  // drift apart. The fertilizedYield flag (Yield Fertilizer) fattens the
  // main yield; some species also drop a bonus extra.
  const computeHarvestYields = (
    flora: FloraEntity
  ): { item: ItemId; count: number; extras: [ItemId, number][] } => {
    switch (flora.species) {
      case 'lantern_fern':
        return { item: 'soft_fiber', count: flora.fertilizedYield ? 5 : 2, extras: [['dew_essence', 1]] };
      case 'sap_weaver':
        return { item: 'resin_sap', count: flora.fertilizedYield ? 6 : 3, extras: [] };
      case 'petal_mill':
        return { item: 'vibrant_petal', count: flora.fertilizedYield ? 6 : 3, extras: [['sweet_nectar', 2]] };
      case 'snap_trap':
        return { item: 'carapace_scale', count: 1, extras: [] };
      case 'bell_bloom':
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

      soundEngine.playHarvest();
      triggerHarvestFx(flora.x, flora.z);

      const { item: yieldItem, count: yieldCount, extras } = computeHarvestYields(flora);
      extras.forEach(([extraId, extraCount]) => addInventoryItem(extraId, extraCount));
      addInventoryItem(yieldItem, yieldCount);
      // Trimmings: every harvest yields a little compost — the renewable source
      addInventoryItem('basic_compost', 1);
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
        // The trowel applies the LOADED fertilizer (selectedFertilizerId —
        // cycled with the mouse wheel / ↑ ↓, or picked in the Inventory).
        // It never silently swaps to the other kind: if the loaded one is
        // missing from the pouch, say so and name the way out.
        const loadedId = selectedFertilizerId;
        const loadedType: 'growth' | 'yield' = loadedId === 'yield_fertilizer' ? 'yield' : 'growth';

        if (hasItem(loadedId, 1)) {
          deductInventoryItem(loadedId, 1);
          soundEngine.playFertilize();
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
        fertilizerTimer: 0,
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
    [selectedSeedId, selectedFertilizerId, hasItem, deductInventoryItem, applyFloraFertilizer, addFlora, postNotification, floraList]
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

      const seedId = `seed_${flora.species}` as ItemId;
      const rawName = flora.species.replace(/_/g, ' ');
      const speciesName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

      if (flora.harvestReady) {
        const { item, count, extras } = computeHarvestYields(flora);
        addInventoryItem(item, count);
        extras.forEach(([extraId, extraCount]) => addInventoryItem(extraId, extraCount));
        // Trimmings, same as a glove harvest.
        addInventoryItem('basic_compost', 1);
        if (ITEMS[seedId]) addInventoryItem(seedId, 1);
        postNotification(
          'Plant Dissolved',
          `${speciesName} reclaimed: ${count}x ${ITEMS[item]?.name || item}, trimmings, and its seed.`,
          'craft',
          '#38bdf8'
        );
      } else {
        if (ITEMS[seedId]) addInventoryItem(seedId, 1);
        postNotification(
          'Plant Dissolved',
          `Unripe ${speciesName} returned to seed form — nothing to harvest yet, but your seed is back.`,
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

        // The roll: the nectar is gone either way. On a failure the
        // critter enjoys the snack and stays wild — bring more bait.
        const tameChance = fauna.species === 'soft_puff' ? TAME_CHANCE_SOFT_PUFF : TAME_CHANCE_BURROW_MOUSE;
        if (Math.random() > tameChance) {
          postNotification(
            'It Darted Away',
            `The ${fauna.species === 'soft_puff' ? 'Soft-Puff' : 'Burrow Mouse'} took the nectar and slipped off, still wild.`,
            'alert',
            '#fbbf24'
          );
          return;
        }

        soundEngine.playTameCritter();
        tameFauna(fauna.id, fauna.species === 'soft_puff' ? 'Luminescent Puff' : 'Burrow Scout', 'following');

        postNotification(
          'Companion Domesticated!',
          `${fauna.species === 'soft_puff' ? 'Soft-Puff' : 'Burrow Mouse'} tamed! It follows you${fauna.species === 'soft_puff' ? ' and excretes high-grade Bio-Pellets' : ''}. Lure it again to order it to stay or guard.`,
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
        if (Math.random() > TAME_CHANCE_CHITIN_STALKER) {
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

      // Where the piece goes: cell pieces at the cell's center, wall/door
      // PANELS on the cell edge nearest the aim (game/placement.ts) — and
      // occupancy to match: one panel per edge; cell pieces keep the
      // one-ground-layer + one-upright-per-cell rule.
      const rotation = getPlacementRotation();
      const spot = placementFor(selectedStructureType, worldX, worldZ, rotation);
      const conflict = occupancyConflict(selectedStructureType, spot, structuresList);
      if (conflict) {
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
      };

      addStructure(newStruct);
      postNotification('Living Composite Placed', `Grown ${ITEMS[selectedStructureType]?.name}. Fully recyclable via Solvent Sprayer [4].`, 'craft', '#a855f7');
      multiplayerManager.broadcastEntityUpsert('structure', newStruct);
    },
    [selectedStructureType, hasItem, deductInventoryItem, addStructure, postNotification, structuresList, getPlacementRotation]
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
      if (activeTool === 'solvent_sprayer') {
        handleSolventFlora(flora);
        return;
      }
    },
    [activeTool, handleHarvestFlora, handleScanTarget, handlePlanterAction, handleSolventFlora]
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
  [activeTool, handleSolventSprayer, handleScanTarget, onOpenBioForgeModal, handleGroundClick, handlePlanterAction, selectedSeedId, postNotification]
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
