/**
 * The Culture Vat — creature renewal rules (Adam, 2026-10-15).
 *
 * Fauna never respawn in BioForge: a zone's cast is dealt once
 * and removals persist. Renewal is a player act — grow the
 * creature again from something of the original. This module is
 * the whole rulebook for that act: which soup band a species
 * needs, what the soup is, how long a gestation runs, and how
 * the vat's own tiers gate the bands. The panel renders these
 * rules; the gestation hook advances them; nothing here keeps
 * state.
 */

import type { FaunaSpecies, ItemId } from '../types/game';
import { BIOMES } from './biomes';
import { speciesDef, type SpeciesDef } from './species';

/** The three soup bands, in vat-tier order (band N needs vat tier N+1). */
export type VatBand = 'common' | 'wild' | 'strange';

export const VAT_BAND_ORDER: VatBand[] = ['common', 'wild', 'strange'];

/** Vat tier names, for the panel header (index = tier - 1). */
export const VAT_TIER_NAMES = ['Culture Vat', 'Deep Culture Vat', 'Genesis Vat'];

/** The growth kit that raises a vat FROM the given tier (null at the top). */
export function vatKitFor(tier: number): ItemId | null {
  if (tier === 1) return 'vat_kit_rich';
  if (tier === 2) return 'vat_kit_deep';
  return null;
}

/** A species' sample item id — the template member of ItemId. */
export function sampleItemId(species: FaunaSpecies): ItemId {
  return `sample_${species}` as ItemId;
}

/** Is this item one of the vat's sample vials? (The rack's law.) */
export function isSampleItem(itemId: ItemId): boolean {
  return itemId.startsWith('sample_');
}

/**
 * Which band a species gestates in. The band follows its HOME:
 * the highest tier among its dealt families (biomes.ts tiers —
 * 0 Hearthlands, 1 Wilds... by family registry), with two bumps
 * Adam's recipe design carries: anything that HUNTS rises one
 * band (a guardian is never cheap), and a variant-gated species
 * is always strange country (it lives in exactly one specific
 * place). 'all'-country pests and the classic census species
 * (whose table homes are the near country) rest at common unless
 * they hunt.
 */
// Family registry is an array; index its tiers by id once.
// Family tier -> soup band: 0-1 common, 2 wild, 3 strange.
const TIER_OF_FAMILY: Record<string, number> = Object.fromEntries(
  BIOMES.map((b) => [b.id as string, b.tier]),
);
const BAND_OF_TIER = [0, 0, 1, 2];

export function vatBandFor(def: SpeciesDef): VatBand {
  if (def.bonusSpawn?.variant) return 'strange';
  let band = 0;
  if (def.bonusSpawn && def.bonusSpawn.biomes !== 'all') {
    for (const family of def.bonusSpawn.biomes) {
      band = Math.max(band, BAND_OF_TIER[TIER_OF_FAMILY[family] ?? 0]);
    }
  }
  if (def.hunt) band = Math.min(2, band + 1);
  return VAT_BAND_ORDER[band];
}

/** The soup a band consumes, besides the sample itself. */
export const VAT_SOUP: Record<VatBand, { id: ItemId; count: number }[]> = {
  common: [
    { id: 'basic_compost', count: 1 },
    { id: 'dew_essence', count: 2 },
  ],
  wild: [
    { id: 'bio_pellet', count: 1 },
    { id: 'dew_essence', count: 2 },
    { id: 'resin_sap', count: 1 },
  ],
  strange: [
    { id: 'bio_pellet', count: 1 },
    { id: 'dew_essence', count: 2 },
    { id: 'living_thread', count: 1 },
  ],
};

/**
 * The strange band's signature shard: one shard of the species'
 * HOME family, on top of the soup — the recipe tastes of the
 * country the creature is from. Mapped per family; families with
 * no shard of their own (the near green country) contribute none,
 * and their strange-band members (variant-gated near-country
 * rares) ride on the thread alone.
 */
export const VAT_SIGNATURE_SHARD: Partial<Record<string, ItemId>> = {
  saltglass: 'saltglass_shard',
  storm: 'fulgurite_shard',
  ember: 'obsidian_shard',
  frost: 'nevermelt_ice',
};

/** Full ingredient list for gestating a species (sample first). */
export function vatIngredientsFor(def: SpeciesDef): { id: ItemId; count: number }[] {
  const band = vatBandFor(def);
  const list: { id: ItemId; count: number }[] = [
    { id: sampleItemId(def.id), count: 1 },
    ...VAT_SOUP[band],
  ];
  if (band === 'strange' && def.bonusSpawn && def.bonusSpawn.biomes !== 'all') {
    for (const family of def.bonusSpawn.biomes) {
      const shard = VAT_SIGNATURE_SHARD[family];
      if (shard) {
        list.push({ id: shard, count: 1 });
        break;
      }
    }
  }
  return list;
}

/**
 * Gestation lengths, in seconds of loaded-zone time. A Sol-cycle
 * is 500 of these seconds (the day advances 0.002/s): a common
 * creature hatches inside half a cycle, a strange one takes the
 * whole turning.
 */
export const VAT_GESTATION_SECONDS: Record<VatBand, number> = {
  common: 250,
  wild: 375,
  strange: 500,
};

/** The vat tier a band requires (common 1, wild 2, strange 3). */
export function vatTierForBand(band: VatBand): number {
  return VAT_BAND_ORDER.indexOf(band) + 1;
}

/**
 * Sample shedding (the living source): a TAMED creature sheds a
 * viable sample of itself on this interval; a WILD one leaves a
 * trace far more rarely. Seconds of loaded-zone sim time.
 */
export const SAMPLE_SHED_SECONDS_TAMED = 900;
export const SAMPLE_SHED_SECONDS_WILD = 2400;

/** Convenience: everything the panel needs about one species. */
export function vatPlanFor(species: FaunaSpecies) {
  const def = speciesDef(species);
  const band = vatBandFor(def);
  return {
    def,
    band,
    ingredients: vatIngredientsFor(def),
    seconds: VAT_GESTATION_SECONDS[band],
    vatTier: vatTierForBand(band),
  };
}
