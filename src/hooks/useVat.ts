/**
 * useVat — the Culture Vat's behaviors (Adam, 2026-10-15 design;
 * built 2026-10-16), extracted from App.tsx in the useStorage
 * shape. The RULES live in game/structures/vat.ts (bands, soups, gestation
 * lengths, kits); this hook only moves items, writes the vat's
 * record back via upsertStructure, and — at hatch — writes a new
 * creature into the world via upsertFauna. Gestation TIME itself
 * advances in the world tick (useWorldEntities), host-side like
 * every other living process.
 */

import { useCallback } from 'react';
import type { FaunaEntity, FaunaSpecies, GameNotification, ItemId, StructureEntity } from '../types/game';
import type { BiomeId } from '../game/world/biomes';
import { ITEMS } from '../game/items/constants';
import { speciesDef } from '../game/creatures/species';
import { vatKitFor, vatPlanFor } from '../game/structures/vat';
import {
  BROTH_STAGE_COPY,
  brothBias,
  isBrothGel,
} from '../game/structures/broths';
import { soundEngine } from '../audio/soundEngine';

interface UseVatParams {
  getInventory: () => Record<ItemId, number>;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  /** Returns the gel to the pouch when a broth is poured out. */
  addInventoryItem: (itemId: ItemId, count?: number) => number;
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
  handleVatBrothLoad: (structure: StructureEntity, gelId: ItemId) => void;
  handleVatBrothRemove: (structure: StructureEntity) => void;
}

/**
 * Species the vat REFUSES to gestate (creatures chair, wave 2): the
 * Hearth Dog and the Hearth Wisp are arrival-law, not manufacture —
 * 'it arrives, or it doesn't.' A sample in a jar does not change that.
 */
const GESTATION_REFUSALS: Partial<Record<FaunaSpecies, string>> = {
  hearth_dog:
    'The vat will not grow a hearth dog — it arrives, or it doesn\'t. No sample in a jar changes that.',
  hearth_wisp:
    'The vat will not grow a hearth wisp — it arrives, or it doesn\'t. The wisp is a visit, not a crop.',
};

export function useVat({
  getInventory,
  deductInventoryItem,
  addInventoryItem,
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
    // The arrival-law refusal (creatures chair, wave 2): some
    // creatures are not manufactured.
    const refusal = GESTATION_REFUSALS[species];
    if (refusal) {
      postNotification('The Vat Declines', refusal, 'alert', '#f59e0b');
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
    // The gloom hard refusal (creatures chair): a gloom broth's
    // whole gift is to the shedding — for a creature that sheds
    // nothing the gel would be eaten for nothing, so the vat
    // refuses the GESTATION instead (the broth stays loaded, warm
    // and waiting, for a creature that can take it).
    if (vat.broth?.gelId === 'gloom_gel' && !plan.def.byproduct) {
      postNotification(
        'The Broth Objects',
        `A gloom broth's gift is to the shedding — and a ${plan.def.name} sheds nothing. Pour the broth out first, or grow a creature that sheds.`,
        'alert',
        '#f59e0b',
      );
      return;
    }
    for (const ing of plan.ingredients) deductInventoryItem(ing.id, ing.count);
    upsertStructure({
      ...structure,
      vat: { ...vat, gestating: { species, progress: 0, total: plan.seconds } },
    });
    postNotification(
      'Gestation Begins',
      `The vat drinks the ${plan.def.name} sample and closes over it. Something is growing.`,
      'craft',
      '#34d399',
    );
    // The gentle soft no-op, said honestly (creatures chair): a
    // gentleness broth changes nothing for a creature that is not
    // a hunter, or for the oversize tier that is already
    // provoked-only by nature. The gestation runs — the broth is
    // the player's, spent knowingly.
    const brothGel = vat.broth?.gelId;
    if (brothGel === 'lake_jelly' || brothGel === 'hush_gel') {
      if (!plan.def.hunt || plan.def.hunt.provokedOnly) {
        postNotification(
          'A Quiet Honesty',
          `The ${ITEMS[brothGel]?.name ?? brothGel} will change little for a ${plan.def.name} — it is ${plan.def.hunt?.provokedOnly ? 'already gentle unless provoked' : 'no hunter at all'}, and gentleness is a hunter's gift.`,
          'system',
          '#94a3b8',
        );
      }
    }
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
        : 'The vat goes deep and strange — the wild country can grow here now.',
      'craft',
      '#34d399',
    );
  }, [deductInventoryItem, upsertStructure, postNotification]);

  // Load a broth: one gel, poured into the vat's side dish, where
  // it ferments in loaded-zone time. Cold at loading — the culture
  // is asleep. It keeps fermenting between gestations; the
  // gardener's move is to pour early and let it think.
  const handleVatBrothLoad = useCallback((structure: StructureEntity, gelId: ItemId): void => {
    const vat = structure.vat ?? { tier: 1 };
    if (vat.broth) {
      postNotification('The Broth Is Set', 'One broth at a time — pour out the old one first.', 'alert', '#a5f3fc');
      return;
    }
    if (!isBrothGel(gelId)) return;
    if (!deductInventoryItem(gelId, 1)) return;
    upsertStructure({ ...structure, vat: { ...vat, broth: { gelId, fermented: 0 } } });
    const stage = BROTH_STAGE_COPY.cold;
    postNotification(
      'The Broth Is Poured',
      `The ${ITEMS[gelId]?.name ?? gelId} settles into the vat's side dish — ${stage.line} No fire: it will warm itself.`,
      'craft',
      '#a5f3fc',
    );
  }, [deductInventoryItem, upsertStructure, postNotification]);

  // Pour a broth out: the gel returns to the pouch, but the culture
  // does not — the warmth is poured away with it. (A deliberate
  // asymmetry: loading costs the gel once, and fermentation is the
  // vat's work, not the pouch's property.)
  const handleVatBrothRemove = useCallback((structure: StructureEntity): void => {
    const vat = structure.vat ?? { tier: 1 };
    const broth = vat.broth;
    if (!broth) return;
    addInventoryItem(broth.gelId, 1);
    upsertStructure({ ...structure, vat: { ...vat, broth: undefined } });
    postNotification(
      'The Broth Is Poured Out',
      `The ${ITEMS[broth.gelId]?.name ?? broth.gelId} comes back, but the culture goes with the dregs — the warmth is gone.`,
      'system',
      '#94a3b8',
    );
  }, [addInventoryItem, upsertStructure, postNotification]);

  // Hatch: the finished creature climbs out at the vat's side,
  // imprinted — tamed from its first breath, following, carrying
  // its species' granted name (there is no player naming; the
  // granted name IS the continuity from its predecessor).
  // A loaded broth stamps the hatch at this moment — its biases
  // are pure functions of the broth + its warmth (broths.ts;
  // gel-material fauna take the full strength always). The
  // hatchling DRINKS the broth: it is consumed here.
  const handleVatHatch = useCallback((structure: StructureEntity): void => {
    const vat = structure.vat ?? { tier: 1 };
    const g = vat.gestating;
    if (!g || g.progress < g.total) return;
    const def = speciesDef(g.species);
    const bias = vat.broth ? brothBias(g.species, vat.broth.gelId, vat.broth.fermented) : null;
    const baseHealth = def.bonusSpawn?.health ?? 60;
    const baseSpeed = def.bonusSpawn?.speed ?? 1.4;
    const brothName = vat.broth ? ITEMS[vat.broth.gelId]?.name ?? vat.broth.gelId : null;
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
      speed: baseSpeed * (bias?.quicknessMul ?? 1),
      health: Math.max(1, Math.round(baseHealth * (bias?.vigorMul ?? 1))),
      maxHealth: Math.max(1, Math.round(baseHealth * (bias?.vigorMul ?? 1))),
      byproductTimer: 0,
      sampleTimer: 0,
      animTime: 0,
      biome: getCurrentBiome(),
      customName: def.petName,
      command: 'follow',
      // The broth stamps (wave 2): gentleness only ever stamps
      // when the broth was ripe (broths.ts gates it); the shed
      // multiplier rides only when it differs from the def's own
      // cadence, so un-brothed hatches are byte-for-byte the old
      // behavior.
      brothGentle: bias?.gentle ? true : undefined,
      shedCadenceMul: bias && bias.shedCadenceMul !== 1 ? bias.shedCadenceMul : undefined,
    };
    upsertFauna(fauna);
    upsertStructure({ ...structure, vat: { tier: vat.tier } });
    soundEngine.playTameCritter();
    postNotification(
      'It Hatches',
      brothName
        ? `The vat irises open — a ${def.name} climbs out, blinking, and falls in behind you. ${def.petName} has arrived, and the ${brothName} broth is drunk dry — every living drop.`
        : `The vat irises open — a ${def.name} climbs out, blinking, and falls in behind you. ${def.petName} has arrived.`,
      'tame',
      '#34d399',
    );
  }, [upsertFauna, upsertStructure, getCurrentBiome, postNotification]);

  return { handleVatStart, handleVatUpgrade, handleVatHatch, handleVatBrothLoad, handleVatBrothRemove };
}
