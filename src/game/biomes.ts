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

export interface BiomeDef {
  id: BiomeId;
  /** Position-acceptance multipliers: how thick life grows in such a zone. */
  floraDensity: number;
  faunaDensity: number;
}

/** The biome table — the rules live here, tunable in one place. */
export const BIOMES: BiomeDef[] = [
  { id: 'meadow', floraDensity: 1.2, faunaDensity: 1.2 }, // starter: fertile, alive
  { id: 'wetland', floraDensity: 1.1, faunaDensity: 1.0 }, // lush, soggy
  { id: 'fungal', floraDensity: 1.0, faunaDensity: 0.8 }, // sparser life in the dark
  { id: 'ember', floraDensity: 0.8, faunaDensity: 0.9 }, // harsher ground, thinner cover
];

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
