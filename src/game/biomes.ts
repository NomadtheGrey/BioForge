// ============================================================================
// biomes.ts — biome TYPES: the rules a zone's identity carries (P2)
// ============================================================================
//
// A biome is an ecological TYPE (meadow / wetland / fungal / ember)
// that carries RULES — the density multipliers and species affinities
// in this file, spawn tables / lighting tints in future layers.
//
// Per Adam's model (corrected 2026-10-14), a biome belongs to a whole
// ZONE: one zone has one biome, and that biome is the zone's identity.
// Biomes never patchwork inside a zone. WHICH biome a given zone has —
// and the zone's poetic name — is zones.ts' job; this file is only the
// type table and the rule factors other systems consume.
//
//   meadow   the starter biome — fertile, gentle; the spawn zone's type
//   wetland  soggy ground, standing water — lush
//   fungal   dark, spore-thick hollows — sparser fauna in the dark
//   ember    heat vents, ash soil — the strange one, far zones only
//
// (Biolume Caverns is deliberately absent: it's an instanced-zone
// interior, not a surface biome.)
//
// History note: the lab's first biome seam (and this file's first
// version) modeled biome as a per-point noise field INSIDE one map —
// rings of types around spawn. Adam's per-zone correction retired
// that here; the lab keeps its own copy for the record.
// ============================================================================

export type BiomeId = 'meadow' | 'wetland' | 'fungal' | 'ember';

/** How often a biome shows up among the rolls it's eligible for. */
export type BiomeRarity = 'common' | 'uncommon' | 'rare';

export interface BiomeDef {
  id: BiomeId;
  /** Position-acceptance multipliers: how thick life grows in such a zone. */
  floraDensity: number;
  faunaDensity: number;
  /**
   * The biome-graph facts (Adam, 2026-10-15): the four shipped
   * types are FAMILIES — the top level of the biome matrix — and
   * biomes are TIERED by nature: four shells of rising danger,
   * exoticness, and rarity around the spawn zone (I Hearthlands,
   * II The Wilds, III Strange Country, IV The Far Weird). The
   * tier is the coarse dial — other systems (cave size, ruin
   * size, clue and artifact density) will read a zone's tier to
   * scale themselves — while MINIMUM DISTANCE (in zone hops) is
   * the tier's concrete gate, refinable per biome, and RARITY is
   * the weight class among eligible rolls. Tier, distance, and
   * rarity must trend together (the biome harness checks the
   * registry never lets a nearer tier out-rank a farther gate),
   * and zones.ts' band table must agree with minHops: a biome's
   * first band appearance IS its minHops.
   */
  tier: 1 | 2 | 3 | 4;
  minHops: number;
  rarity: BiomeRarity;
}

/** The biome table — the rules live here, tunable in one place. */
export const BIOMES: BiomeDef[] = [
  { id: 'meadow', floraDensity: 1.2, faunaDensity: 1.2, tier: 1, minHops: 0, rarity: 'common' }, // starter: fertile, alive
  { id: 'wetland', floraDensity: 1.1, faunaDensity: 1.0, tier: 1, minHops: 1, rarity: 'common' }, // lush, soggy
  { id: 'fungal', floraDensity: 1.0, faunaDensity: 0.8, tier: 2, minHops: 2, rarity: 'common' }, // sparser life in the dark
  { id: 'ember', floraDensity: 0.8, faunaDensity: 0.9, tier: 3, minHops: 3, rarity: 'uncommon' }, // harsher ground, thinner cover
];

/** A biome's exoticness/danger tier (1 = hearthlands … 4 = far weird). */
export function biomeTier(id: BiomeId): number {
  return BIOMES.find((b) => b.id === id)?.tier ?? 1;
}

/** A biome's minimum distance from the spawn zone, in hops. */
export function biomeMinHops(id: BiomeId): number {
  return BIOMES.find((b) => b.id === id)?.minHops ?? 0;
}

/** A biome's rarity class among eligible rolls. */
export function biomeRarity(id: BiomeId): BiomeRarity {
  return BIOMES.find((b) => b.id === id)?.rarity ?? 'common';
}

/**
 * How a zone's biome TINTS its ground. The terrain's base color still
 * comes from its quadrant (the survey's sector shading), and the zone's
 * biome hue is blended evenly over the whole zone: `strength` is how
 * far every vertex leans toward the biome color. Meadow leans least —
 * home ground should mostly feel like itself — while the far, strange
 * biomes lean hard enough to read at a glance.
 */
export const BIOME_TINTS: Record<BiomeId, { color: number; strength: number }> = {
  meadow: { color: 0x3a6b35, strength: 0.25 },
  wetland: { color: 0x0e7a6d, strength: 0.5 },
  fungal: { color: 0x7a2ea0, strength: 0.5 },
  ember: { color: 0xc2571b, strength: 0.55 },
};

/** Weight bonus a biome-affined species gets inside its home biome(s). */
export const BIOME_HOME_BONUS = 1.5;

/** Position-acceptance multiplier for a biome (density is a biome rule). */
export function biomeDensityFactor(kind: 'flora' | 'fauna', biomeId: BiomeId): number {
  const b = BIOMES.find((x) => x.id === biomeId);
  if (!b) return 1;
  return kind === 'flora' ? b.floraDensity : b.faunaDensity;
}

/**
 * Species weight factor for a biome. 'all' species are welcome in
 * every biome (factor 1); a listed species gets the home bonus inside
 * its biome(s) and weight 0 anywhere else — that zero is what makes
 * exclusivity a hard rule rather than a tendency (the species dealer
 * excludes zero-weight points while any legal point remains).
 */
export function biomeWeightFactor(biomes: readonly BiomeId[] | 'all', biomeId: BiomeId): number {
  if (biomes === 'all') return 1;
  return biomes.includes(biomeId) ? BIOME_HOME_BONUS : 0;
}
