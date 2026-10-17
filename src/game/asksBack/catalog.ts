// =====================================================================
// THE WORLD ASKS BACK — read-only adapters over real game data (S2,
// ported from the lab's catalog.mts, 2026-10-16)
// =====================================================================
//
// Everything here comes from src/game: zones/biomes (families, names,
// hybrids, weather), the species + flora tables, constants (items),
// recipesData, and worldGen (the actual zone census — the strongest
// "this target is really there" proof the engine can get). No parallel
// tables are invented; if an import ever becomes impractical it must
// be called out, not worked around.

import { BIOMES, type BiomeId } from '../biomes';
import {
  zoneInfo,
  zoneWeatherAt,
  biomeDisplayName,
  type WeatherMode,
} from '../zones';
import { SPECIES } from '../species';
import { FLORA } from '../flora';
import { ITEMS } from '../constants';
import { RECIPES } from '../recipesData';
import { generateSeededWorld } from '../worldGen';

export type { BiomeId, WeatherMode };

export const FAMILIES: BiomeId[] = BIOMES.map((b) => b.id);

export interface ZoneFacts {
  zx: number;
  zz: number;
  biome: BiomeId;
  name: string;
  hops: number;
  /** This zone's family + the hybrid margin's secondary family, if any. */
  families: BiomeId[];
  hybrid: { name: string; secondary: BiomeId } | null;
  variant: string | null;
  weather: WeatherMode;
  /** Real census from worldGen: species actually sown in this zone. */
  censusFauna: string[];
  censusFlora: string[];
  /** True when worldGen grew a ruin landmark here. */
  hasRuin: boolean;
}

// The census is pure in (seed, zone) — cached per zone so the
// Director's candidate loop doesn't regenerate the world six times.
// Zone-state consequences (S2) are applied ON TOP of the cached raw
// census by the generator, never baked into the cache. Cleared
// whenever the world seed changes (new game / load).
const censusCache = new Map<string, ZoneFacts>();
let censusSeed: string | null = null;

export function zoneFacts(worldSeed: string, zx: number, zz: number): ZoneFacts {
  if (censusSeed !== worldSeed) {
    censusCache.clear();
    censusSeed = worldSeed;
  }
  const key = `${zx},${zz}`;
  const hit = censusCache.get(key);
  if (hit) return hit;
  const info = zoneInfo(worldSeed, zx, zz);
  // NOTE: called without the landform opt the travel path uses. The
  // census (which species are sown) does not depend on landforms —
  // they reshape terrain, not the sowing — and the lab proved every
  // generated target against exactly this call.
  const world = generateSeededWorld(worldSeed, zx, zz);
  const facts: ZoneFacts = {
    zx,
    zz,
    biome: info.biome,
    name: info.name,
    hops: info.hops,
    families: info.hybrid ? [info.biome, info.hybrid.secondary] : [info.biome],
    hybrid: info.hybrid
      ? { name: info.hybrid.def.name, secondary: info.hybrid.secondary }
      : null,
    variant: info.variant ? info.variant.id : null,
    weather: zoneWeatherAt(worldSeed, zx, zz).mode,
    censusFauna: [...new Set(world.fauna.map((f) => f.species))],
    censusFlora: [...new Set(world.flora.map((f) => f.species))],
    hasRuin: world.structures.some((s) => /ruin|glyph|precursor/i.test(s.type)),
  };
  censusCache.set(key, facts);
  return facts;
}

// ── names ──────────────────────────────────────────────────────────

export function faunaName(id: string): string {
  return SPECIES[id as keyof typeof SPECIES]?.name ?? id;
}
export function floraName(id: string): string {
  return FLORA[id]?.name ?? id;
}
export function itemName(id: string): string {
  return (ITEMS as Record<string, { name?: string }>)[id]?.name ?? id;
}

// ── species predicates (table-driven, never hand lists) ────────────

export function isTameable(faunaId: string): boolean {
  return SPECIES[faunaId as keyof typeof SPECIES]?.tameChance != null;
}
export function isHunter(faunaId: string): boolean {
  return SPECIES[faunaId as keyof typeof SPECIES]?.hunt != null;
}
export function isHarvestable(floraId: string): boolean {
  return FLORA[floraId]?.harvest != null;
}
/** Real harvest item for this flora (FloraHarvest.item), or null. */
export function harvestItem(floraId: string): string | null {
  return FLORA[floraId]?.harvest?.item ?? null;
}
/** True when a BioForge seed recipe crafts seed_<floraId>. */
export function hasSeedRecipe(floraId: string): boolean {
  return RECIPES.some((r) => r.outputId === (`seed_${floraId}` as never));
}

// ── item / recipe existence ────────────────────────────────────────

export function itemExists(id: string): boolean {
  return id in ITEMS;
}

// ── reward pools: real item ids, tiered by distance ────────────────
// Ordinary pouch goods — the dynamic layer never mints unique
// authored rewards.

const REWARD_POOLS: string[][] = [
  ['soft_fiber', 'dew_essence', 'basic_compost'], // tier 0 — hearthlands
  ['resin_sap', 'sweet_nectar', 'glow_spore'], // tier 1 — near wild
  ['resin_sap', 'sweet_nectar', 'glow_spore'], // tier 2 — far wild
  ['sweet_nectar', 'glow_spore'], // tier 3 — far weird
];

export function rewardTierForHops(hops: number): number {
  if (hops >= 9) return 3;
  if (hops >= 6) return 2;
  if (hops >= 3) return 1;
  return 0;
}

export function rewardItems(
  tier: number,
  count: number,
  pick: (n: number, arr: string[]) => string[],
): { itemId: string; count: number }[] {
  const pool = REWARD_POOLS[Math.min(tier, REWARD_POOLS.length - 1)];
  const ids = pick(count, pool);
  return ids.map((itemId) => ({ itemId, count: 2 + tier }));
}

/** Pretty family label for text slots. */
export function familyLabel(id: BiomeId): string {
  return biomeDisplayName(id);
}

/** The biome family of a fauna species (first affinity listed in
 *  the species' bonus-spawn table; 'all' species inherit the zone). */
export function speciesFamily(id: string): BiomeId | 'all' {
  const b = SPECIES[id as keyof typeof SPECIES]?.bonusSpawn?.biomes;
  if (!b || b === 'all' || b.length === 0) return 'all';
  return b[0];
}
