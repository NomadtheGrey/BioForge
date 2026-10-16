/**
 * useVat — the Culture Vat's behaviors (Adam, 2026-10-15 design;
 * built 2026-10-16), extracted from App.tsx in the useStorage
 * shape. The RULES live in game/vat.ts (bands, soups, gestation
 * lengths, kits); this hook only moves items, writes the vat's
 * record back via upsertStructure, and — at hatch — writes a new
 * creature into the world via upsertFauna. Gestation TIME itself
 * advances in the world tick (useWorldEntities), host-side like
 * every other living process.
 */

import { useCallback } from 'react';
import type { FaunaEntity, FaunaSpecies, GameNotification, ItemId, StructureEntity } from '../types/game';
import type { BiomeId } from '../game/biomes';
import { ITEMS } from '../game/constants';
import { speciesDef } from '../game/species';
import { vatKitFor, vatPlanFor } from '../game/vat';
import { soundEngine } from '../audio/soundEngine';

interface UseVatParams {
  getInventory: () => Record<ItemId, number>;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  upsertStructure: (structure: StructureEntity) => void;
  upsertFauna: (fauna: FaunaEntity) => void;
  /** The biome of the zone the player is standing in (for the
   *  hatched creature's home stamp). */
  getCurrentBiome: () => BiomeId | undefined;
  postNotification: (title: string, message: string, type: GameNotification['type'], iconColor: string) => void;
}

export interface UseVatResult {
  handleVatStart: (structure: StructureEntity, species: FaunaSpecies) => void;
  handleVatUpgrade: (structure: StructureEntity) => void;
  handleVatHatch: (structure: StructureEntity) => void;
}

export function useVat({
  getInventory,
  deductInventoryItem,
  upsertStructure,
  upsertFauna,
  getCurrentBiome,
  postNotification,
}: UseVatParams): UseVatResult {
  // Begin a gestation: sample + soup out of the pouch, the vat's
  // record carries the rest. Every gate is checked BEFORE any
  // item moves, so a refused start costs nothing.
  const handleVatStart = useCallback((structure: StructureEntity, species: FaunaSpecies): void => {
    const vat = structure.vat ?? { tier: 1 };
    if (vat.gestating) {
      postNotification('The Vat Is Working', 'One gestation at a time — this culture is already growing something.', 'alert', '#34d399');
      return;
    }
    const plan = vatPlanFor(species);
    if (vat.tier < plan.vatTier) {
      postNotification(
        'The Culture Is Too Shallow',
        `A ${plan.def.name} needs a ${plan.vatTier === 2 ? 'richened' : 'deepened'} vat — apply the next growth kit first.`,
        'alert',
        '#f59e0b',
      );
      return;
    }
    const inventory = getInventory();
    for (const ing of plan.ingredients) {
      if ((inventory[ing.id] ?? 0) < ing.count) {
        postNotification(
          'The Soup Is Incomplete',
          `Still needed: ${ing.count}x ${ITEMS[ing.id]?.name ?? ing.id}.`,
          'alert',
          '#f59e0b',
        );
        return;
      }
    }
    for (const ing of plan.ingredients) deductInventoryItem(ing.id, ing.count);
    upsertStructure({
      ...structure,
      vat: { tier: vat.tier, gestating: { species, progress: 0, total: plan.seconds } },
    });
    postNotification(
      'Gestation Begins',
      `The vat drinks the ${plan.def.name} sample and closes over it. Something is growing.`,
      'craft',
      '#34d399',
    );
  }, [getInventory, deductInventoryItem, upsertStructure, postNotification]);

  // Apply the next growth kit: the vat deepens in place, and a
  // running gestation is never disturbed by the deepening.
  const handleVatUpgrade = useCallback((structure: StructureEntity): void => {
    const vat = structure.vat ?? { tier: 1 };
    const kit = vatKitFor(vat.tier);
    if (!kit || !deductInventoryItem(kit, 1)) return;
    upsertStructure({ ...structure, vat: { ...vat, tier: vat.tier + 1 } });
    postNotification(
      'The Culture Deepens',
      vat.tier + 1 === 2
        ? 'The vat richens — wild-country creatures, and anything that hunts, can grow here now.'
        : 'The vat goes deep and strange — the far country can grow here now.',
      'craft',
      '#34d399',
    );
  }, [deductInventoryItem, upsertStructure, postNotification]);

  // Hatch: the finished creature climbs out at the vat's side,
  // imprinted — tamed from its first breath, following, carrying
  // its species' granted name (there is no player naming; the
  // granted name IS the continuity from its predecessor).
  const handleVatHatch = useCallback((structure: StructureEntity): void => {
    const vat = structure.vat ?? { tier: 1 };
    const g = vat.gestating;
    if (!g || g.progress < g.total) return;
    const def = speciesDef(g.species);
    const fauna: FaunaEntity = {
      id: `fauna_vat_${g.species}_${Math.random().toString(36).substring(2, 9)}`,
      species: g.species,
      x: structure.worldX + 1.4,
      z: structure.worldZ + 0.4,
      y: 0,
      rotation: 0,
      state: 'following',
      isTamed: true,
      tamedBy: 'vat',
      targetX: structure.worldX + 1.4,
      targetZ: structure.worldZ + 0.4,
      // Bonus-spawn species carry their stats in the table; the
      // classic census species keep theirs in worldGen's census,
      // so a hatched census creature rides a sound middle value.
      speed: def.bonusSpawn?.speed ?? 1.4,
      health: def.bonusSpawn?.health ?? 60,
      maxHealth: def.bonusSpawn?.health ?? 60,
      byproductTimer: 0,
      sampleTimer: 0,
      animTime: 0,
      biome: getCurrentBiome(),
      customName: def.petName,
      command: 'follow',
    };
    upsertFauna(fauna);
    upsertStructure({ ...structure, vat: { tier: vat.tier } });
    soundEngine.playTameCritter();
    postNotification(
      'It Hatches',
      `The vat irises open — a ${def.name} climbs out, blinking, and falls in behind you. ${def.petName} has arrived.`,
      'tame',
      '#34d399',
    );
  }, [upsertFauna, upsertStructure, getCurrentBiome, postNotification]);

  return { handleVatStart, handleVatUpgrade, handleVatHatch };
}
