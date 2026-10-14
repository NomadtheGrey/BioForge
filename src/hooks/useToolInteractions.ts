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
import { GROUND_LAYER_TYPES, isEdgePanel, isLadder, occupancyConflict, placementFor } from '../game/placement';

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
  /** Climb a vine shaft straight to the surface, from any depth. */
  onVineClimb: () => void;
  /** True while the player is inside an instanced cavern — building and
   *  planting belong to the surface world and are refused underground. */
  isInCavern: () => boolean;
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
  getPlayerPosition,
  getPlayerLevel,
  applyPlayerLevel,
  onEnterCave,
  onExitCave,
  onDescendCave,
  onVineClimb,
  isInCavern,
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
        // The deep prize: fewer, rarer — one prism per harvest bare,
        // two when yield-fertilized.
        return { item: 'violet_prism', count: flora.fertilizedYield ? 2 : 1, extras: [] };
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

      setCodexList((prev) =>
        prev.map((c) =>
          c.species === flora.species
            ? { ...c, discovered: true, scannedCount: c.scannedCount + 1 }
            : c
        )
      );

      postNotification(
        'Harvest Successful',
        `Collected ${formatCollected(collected)} — gathered non-lethally; the plant stays rooted and regrows.`,
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
        return isInCavern() ? 'glow_fungus' : 'glow_spore_cluster';
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
        if (isInCavern() && speciesForSeed(selectedSeedId) !== 'glow_fungus') {
          postNotification('Barren Rock', 'The cavern floor is bare stone — only glow spores take hold here, rising as glow fungus. The cave grows its own way.', 'alert', '#fbbf24');
          return;
        }
        if (!isInCavern() && selectedSeedId === 'glow_spore') {
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
      if (isInCavern()) {
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

      // What dissolving reclaims as the plant's propagule. Most
      // species have a seed_<species> item; the spore/crystal cave
      // species reclaim their own harvest stock instead — there is
      // no seed_glow_fungus item, and minting one here would drop a
      // phantom item into the pouch.
      const seedId: ItemId =
        flora.species === 'glow_spore_cluster' || flora.species === 'glow_fungus'
          ? 'glow_spore'
          : flora.species === 'sunshard_cluster'
            ? 'sunshard'
            : flora.species === 'prism_cluster'
              ? 'violet_prism'
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
      if (isInCavern()) {
        postNotification('Unstable Ground', 'The cavern rejects construction — for now. What you build belongs on the surface.', 'alert', '#fbbf24');
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
      // PANELS on the cell edge nearest the aim (game/placement.ts) — and
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
    // The vine shaft is the third doorway of the family: the express
    // climb straight to the surface from any depth. Same rules —
    // solvent refused, scanner describes, everything else climbs.
    if (structure.type === 'vine_shaft') {
      if (activeTool === 'solvent_sprayer') {
        postNotification('Undissolvable', 'The vine is older than the cave around it — the solvent cannot take it.', 'alert', '#fbbf24');
        return;
      }
      if (activeTool === 'bio_scanner') {
        handleScanTarget({ type: 'structure', entity: structure, name: structure.type, details: '' });
        return;
      }
      onVineClimb();
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
    // other tool hears the truth — the interior isn't open yet.
    // Its stage is the next build; today the gate is a promise.
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
      } else {
        postNotification('Sealed Ruin', 'The gate stands, but the way in is not open — not yet. Whatever sleeps below this stone is a story for another delve.', 'system', '#a8a29e');
      }
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
  [activeTool, handleSolventSprayer, handleScanTarget, onOpenBioForgeModal, handleGroundClick, handlePlanterAction, selectedSeedId, selectedStructureType, handleBuilderOnPanel, handleBuilderOnBaseBlock, handleGrowCeiling, handlePlaceLadder, handleExtendLadder, handleClimbLadder, postNotification, onEnterCave, onExitCave]
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
