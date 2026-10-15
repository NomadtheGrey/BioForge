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
   * exoticness, and rarity around the spawn zone — tiers 0-3, to
   * match the crafting tiers (Adam, 2026-10-15): 0 Hearthlands,
   * 1 The Wilds, 2 Strange Country, 3 The Far Weird. The
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
  tier: 0 | 1 | 2 | 3;
  minHops: number;
  rarity: BiomeRarity;
}

/** The biome table — the rules live here, tunable in one place. */
export const BIOMES: BiomeDef[] = [
  { id: 'meadow', floraDensity: 1.2, faunaDensity: 1.2, tier: 0, minHops: 0, rarity: 'common' }, // starter: fertile, alive
  { id: 'wetland', floraDensity: 1.1, faunaDensity: 1.0, tier: 0, minHops: 1, rarity: 'common' }, // lush, soggy
  { id: 'fungal', floraDensity: 1.0, faunaDensity: 0.8, tier: 1, minHops: 2, rarity: 'common' }, // sparser life in the dark
  { id: 'ember', floraDensity: 0.8, faunaDensity: 0.9, tier: 2, minHops: 3, rarity: 'uncommon' }, // harsher ground, thinner cover
];

/** A biome's exoticness/danger tier (0 = hearthlands … 3 = far weird). */
export function biomeTier(id: BiomeId): number {
  return BIOMES.find((b) => b.id === id)?.tier ?? 0;
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

// ---------------------------------------------------------------------------
// Variants — a family's special places (Adam's biome graph, 2026-10-15)
// ---------------------------------------------------------------------------
//
// A VARIANT is a rarer, more specific flavor of its family: same
// rule skeleton, own name, own tint, density deltas, and ONE
// signature twist. The twist is an EFFECT key where the variant
// touches the player directly — Adam's examples: one variant taxes
// your health, another your stamina, another makes you sluggish.
// The effect's mechanics live where the player state lives (the
// game loop); this registry only declares WHICH effect a variant
// carries, so data and behavior stay in their own houses.
//
// A zone rolls its variant AFTER its family (zones.ts
// zoneVariantAt), from its family's variants whose minHops gate it
// has passed, weighted by rarity against staying a plain family
// zone (weight 1) — most eligible zones stay plain.

/** The player-facing effect a variant carries, if any. */
export type BiomeEffectId = 'spore_stamina' | 'marsh_sluggish' | 'scar_heat';

export interface BiomeVariantDef {
  id: string;
  family: BiomeId;
  /** Display name — HUD labels and zone names speak this. */
  name: string;
  /** Distance gate, in hops from spawn — never nearer than family. */
  minHops: number;
  rarity: BiomeRarity;
  /** Ground tint while the zone wears this variant (replaces family). */
  tint: { color: number; strength: number };
  /** Multipliers over the family's density factors. */
  floraDensityMult: number;
  faunaDensityMult: number;
  effect: BiomeEffectId | null;
  /**
   * The variant's light trick (Adam, 2026-10-15): multipliers on
   * the pooled lights' reach and strength while the zone wears
   * this variant. The Mirror Marsh doubles light DISTANCE — the
   * merge formula already amplifies brightness when sources
   * cluster, so reach is what reflection really buys.
   */
  lightDistanceMult: number;
  lightIntensityMult: number;
  /** Zone-name pools for zones of this variant. */
  nameParts: { first: string[]; second: string[] };
}

/** Roll weight per rarity class (against the plain-zone weight 1). */
export const RARITY_ROLL_WEIGHT: Record<BiomeRarity, number> = {
  common: 1,
  uncommon: 0.55,
  rare: 0.25,
};

export const BIOME_VARIANTS: BiomeVariantDef[] = [
  {
    // FUNGAL HOLLOW (Adam's first variant, 2026-10-15): the fungal
    // family's deep place — giant mushrooms of several strange
    // kinds (all harvestable), and spore-thick air that taxes
    // stamina until a helmet + filter upgrade answers it.
    id: 'fungal_hollow',
    family: 'fungal',
    name: 'Fungal Hollow',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0x5b21b6, strength: 0.65 }, // deeper violet than family fungal
    floraDensityMult: 1.15, // the hollow grows THICK
    faunaDensityMult: 0.8, // ...and its animals keep their distance
    effect: 'spore_stamina',
    lightDistanceMult: 1,
    lightIntensityMult: 1,
    nameParts: {
      first: ['Spore', 'Umbral', 'Violet', 'Silent', 'Pale'],
      second: ['Hollow', 'Cathedral', 'Thicket', 'Vault', 'Deep'],
    },
  },
  {
    // MIRROR MARSH (Adam, 2026-10-15): the wetland's still twin —
    // pools of reflective liquid, light that travels twice as far
    // across them, pollinator moths over the water, and wading
    // drag on every step (the sluggish variant effect; the boots
    // module "Waders" is its planned answer, a later build).
    id: 'mirror_marsh',
    family: 'wetland',
    name: 'Mirror Marsh',
    minHops: 2,
    rarity: 'uncommon',
    tint: { color: 0x8fd0c8, strength: 0.55 }, // silver-teal sheen
    floraDensityMult: 1.05,
    faunaDensityMult: 1.15, // the pollinators gather here
    effect: 'marsh_sluggish',
    lightDistanceMult: 2,
    lightIntensityMult: 1.2,
    nameParts: {
      first: ['Still', 'Glass', 'Silver', 'Mirror', 'Pale'],
      second: ['Mere', 'Marsh', 'Pools', 'Shallows', 'Fen'],
    },
  },
  {
    // EMBER SCAR (Adam, 2026-10-15): the ember family's wound —
    // cracked ash, breathing vents, cinder blooms. By day its heat
    // drinks stamina, and at empty stamina it starts on health;
    // by night the same ground is warm and restores you fast.
    // Dangerous at noon, hospitable at midnight.
    id: 'ember_scar',
    family: 'ember',
    name: 'Ember Scar',
    minHops: 4,
    rarity: 'uncommon',
    tint: { color: 0xd9481c, strength: 0.6 }, // deeper burn than family ember
    floraDensityMult: 0.9, // the scar grows sparse
    faunaDensityMult: 1.0,
    effect: 'scar_heat',
    lightDistanceMult: 1,
    lightIntensityMult: 1,
    nameParts: {
      first: ['Scarlet', 'Searing', 'Burnt', 'Ashen', 'Prismatic'],
      second: ['Scar', 'Wound', 'Verge', 'Crown', 'Flats'],
    },
  },
  {
    // The Ashen Drift (Adam-approved slate, 2026-10-15): deep ash
    // country where everything is muffled and light dies young —
    // its pooled-light REACH is strangled to 0.6x (the Mirror
    // Marsh trick, inverted). Subtraction is its content: fewer
    // lights, close dark, quiet. No stamina tax; darkness is it.
    id: 'ashen_drift',
    family: 'ember',
    name: 'Ashen Drift',
    minHops: 4,
    rarity: 'uncommon',
    tint: { color: 0x8f8694, strength: 0.5 }, // ash grey-lavender
    floraDensityMult: 0.8,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 0.6,
    lightIntensityMult: 0.9,
    nameParts: {
      first: ['Silent', 'Grey', 'Muffled', 'Pale', 'Deep'],
      second: ['Drift', 'Ashes', 'Quiet', 'Fall', 'Hush'],
    },
  },
  {
    // The Obsidian Garden (Adam-approved slate, 2026-10-15): the
    // ember family's RICH variant — black glass flowers growing
    // from old burning, and the game's first glass crafting
    // material (obsidian_shard). No tax here; the garden pays.
    id: 'obsidian_garden',
    family: 'ember',
    name: 'Obsidian Garden',
    minHops: 4,
    rarity: 'uncommon',
    tint: { color: 0x2e2140, strength: 0.5 }, // deep violet-black
    floraDensityMult: 1.1,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.15, // glass glints carry a little farther
    nameParts: {
      first: ['Black', 'Glass', 'Violet', 'Silent', 'Sharp'],
      second: ['Garden', 'Beds', 'Crown', 'Reach', 'Bloom'],
    },
  },
];

/** A variant definition by id. */
export function variantById(id: string): BiomeVariantDef | undefined {
  return BIOME_VARIANTS.find((v) => v.id === id);
}

/** All variants belonging to one family. */
export function variantsForFamily(family: BiomeId): BiomeVariantDef[] {
  return BIOME_VARIANTS.filter((v) => v.family === family);
}

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
