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

export type BiomeId = 'meadow' | 'wetland' | 'fungal' | 'ember' | 'saltglass' | 'frost' | 'rootwood' | 'precursor' | 'bone' | 'storm' | 'living';

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
  { id: 'saltglass', floraDensity: 0.75, faunaDensity: 0.7, tier: 2, minHops: 3, rarity: 'uncommon' }, // the 5th family (2026-10-15): salt, crystal, glare — the sparsest country yet
  { id: 'frost', floraDensity: 0.7, faunaDensity: 0.75, tier: 2, minHops: 3, rarity: 'uncommon' }, // the 6th family built (11th on the roster): the steady state — it never thaws. Family gates cap at 3 hops (Adam, 2026-10-15); rarity does the far-country work.
  { id: 'rootwood', floraDensity: 1.3, faunaDensity: 1.0, tier: 1, minHops: 2, rarity: 'common' }, // the 7th family built: the wooded one — giant living roots as architecture; the lushest country in the game
  { id: 'precursor', floraDensity: 1.1, faunaDensity: 0.8, tier: 2, minHops: 3, rarity: 'uncommon' }, // the 8th family built: gardens of the vanished — nature growing through engineered geometry
  { id: 'bone', floraDensity: 0.9, faunaDensity: 0.9, tier: 2, minHops: 3, rarity: 'uncommon' }, // the 9th family built: graveyard country — death-fertile, scavenger land
  { id: 'storm', floraDensity: 0.85, faunaDensity: 0.8, tier: 3, minHops: 3, rarity: 'uncommon' }, // the 10th family built: the FIRST Tier 3 family — charged country, lightning that occasionally zots the player (Adam)
  { id: 'living', floraDensity: 1.25, faunaDensity: 0.9, tier: 3, minHops: 3, rarity: 'rare' }, // the 11th and FINAL family built: one organism, a whole valley — content by default, moody by variant (Adam's spectrum)
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
  saltglass: { color: 0xd8e2dc, strength: 0.45 }, // pale salt-green-white
  frost: { color: 0xcfe4f5, strength: 0.5 }, // ice blue-white
  rootwood: { color: 0x4a5d23, strength: 0.5 }, // deep green-brown
  precursor: { color: 0xa8b56b, strength: 0.45 }, // pale gold-green, cultivated light
  bone: { color: 0xd8cfb8, strength: 0.5 }, // parchment bone-pale
  storm: { color: 0x6b7c8c, strength: 0.5 }, // slate storm-grey
  living: { color: 0x4a3560, strength: 0.5 }, // deep violet — no chlorophyll on this planet (Adam)
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
export type BiomeEffectId = 'spore_stamina' | 'marsh_sluggish' | 'scar_heat' | 'thaw_cold' | 'frost_stillcold' | 'storm_zot' | 'living_welcome' | 'living_hunger';

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
  /** Storm only (2026-10-15): mean seconds between lightning
   *  zots in this variant — the loop jitters it. Absent = the
   *  family default (35s) for plain Storm zones. */
  zotIntervalSec?: number;
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
    // The Mycelium Web (Fungal fill-in, 2026-10-15): the family
    // as ONE NETWORK — the giant shrooms grow in rings and arcs,
    // the web showing through the ground (worldGen plants the
    // pattern). The spore air breathes with the whole ring.
    id: 'mycelium_web',
    family: 'fungal',
    name: 'The Mycelium Web',
    minHops: 2,
    rarity: 'uncommon',
    tint: { color: 0x4c1d95, strength: 0.55 }, // deep network violet
    floraDensityMult: 1.25,
    faunaDensityMult: 0.85,
    effect: 'spore_stamina',
    lightDistanceMult: 1,
    lightIntensityMult: 1.05,
    nameParts: {
      first: ['Woven', 'Vast', 'Patient', 'Silent', 'Deep'],
      second: ['Web', 'Network', 'Reach', 'Threads', 'Knot'],
    },
  },
  {
    // The Glowfen (Fungal fill-in, 2026-10-15): the luminous
    // face — cave glow-fungus growing TOPSIDE, light pushed up
    // and out. Pure fungal (the pools are biolume, not water —
    // the variant rule holds). The gentle face of the family.
    id: 'glowfen',
    family: 'fungal',
    name: 'The Glowfen',
    minHops: 2,
    rarity: 'uncommon',
    tint: { color: 0x365a6e, strength: 0.45 }, // teal-violet glow
    floraDensityMult: 1.15,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 1.15,
    lightIntensityMult: 1.25,
    nameParts: {
      first: ['Glowing', 'Bright', 'Soft', 'Pale', 'Kind'],
      second: ['Fen', 'Pools', 'Lights', 'Marsh', 'Glow'],
    },
  },
  {
    // The Petrified Grove (Fungal fill-in, 2026-10-15): the
    // quiet face — shroom giants turned to STONE, standing as
    // grey scenery in sparse country. Subtraction as content
    // (the Ashen Drift pattern): what is here is what died here.
    id: 'petrified_grove',
    family: 'fungal',
    name: 'The Petrified Grove',
    minHops: 3,
    rarity: 'rare',
    tint: { color: 0x6e6a75, strength: 0.55 }, // stone grey-violet
    floraDensityMult: 0.55,
    faunaDensityMult: 0.7,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 0.95,
    nameParts: {
      first: ['Stone', 'Silent', 'Ancient', 'Grey', 'Patient'],
      second: ['Grove', 'Giants', 'Rest', 'Forest', 'Stand'],
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
  {
    // The Flats (Saltglass, 2026-10-15): the endless salt pan.
    // GLARE is its whole being — pooled-light intensity x1.6, the
    // Mirror Marsh trick at full strength. No tax; the light
    // itself is the event.
    id: 'saltglass_flats',
    family: 'saltglass',
    name: 'The Flats',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0xe8f0ec, strength: 0.55 }, // whitest country in the game
    floraDensityMult: 0.9,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 1.15,
    lightIntensityMult: 1.6,
    nameParts: {
      first: ['White', 'Silent', 'Blinding', 'Endless', 'Salt'],
      second: ['Flats', 'Silence', 'Pan', 'Reach', 'White'],
    },
  },
  {
    // The Thaw (Saltglass, 2026-10-15): freeze-thaw country, and
    // the Ember Scar's mirror image — mild days, but its NIGHTS
    // tax stamina with cold (thaw_cold). Cross it by daylight.
    id: 'saltglass_thaw',
    family: 'saltglass',
    name: 'The Thaw',
    minHops: 4,
    rarity: 'uncommon',
    tint: { color: 0xbcd6de, strength: 0.5 }, // thaw-water blue-grey
    floraDensityMult: 1.0,
    faunaDensityMult: 0.85,
    effect: 'thaw_cold',
    lightDistanceMult: 1,
    lightIntensityMult: 1,
    nameParts: {
      first: ['Thawing', 'Frozen', 'Weeping', 'Pale', 'Cracked'],
      second: ['Thaw', 'Reach', 'Flats', 'Silence', 'Cradle'],
    },
  },
  {
    // The Prism Beds (Saltglass, 2026-10-15): the family's RICH
    // variant — crystal reed beds fused from salt and light, and
    // the source of saltglass_shard, the second glass crafting
    // material. Rare even out here.
    id: 'saltglass_prism',
    family: 'saltglass',
    name: 'The Prism Beds',
    minHops: 4,
    rarity: 'rare',
    tint: { color: 0xc4b5e0, strength: 0.45 }, // prismatic lavender hint
    floraDensityMult: 1.2,
    faunaDensityMult: 0.8,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.25, // the beds throw the light around
    nameParts: {
      first: ['Prism', 'Rainbow', 'Singing', 'Glass', 'Bright'],
      second: ['Beds', 'Garden', 'Reach', 'Fields', 'Crown'],
    },
  },
  {
    // The Stillwhite (Frost, 2026-10-15): the family's scar —
    // total white stillness where the cold taxes stamina at 4/s
    // ALWAYS, day and night alike. The Scar burns by day and the
    // Thaw bites by night; the Stillwhite has no warm hour at
    // all. Gentle rate, no respite.
    id: 'frost_stillwhite',
    family: 'frost',
    name: 'The Stillwhite',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0xe6f0f8, strength: 0.6 }, // the whitest blue
    floraDensityMult: 0.85,
    faunaDensityMult: 0.9,
    effect: 'frost_stillcold',
    lightDistanceMult: 1,
    lightIntensityMult: 1,
    nameParts: {
      first: ['Still', 'White', 'Silent', 'Patient', 'Vast'],
      second: ['White', 'Stillness', 'Reach', 'Quiet', 'Plain'],
    },
  },
  {
    // The Ice Fangs (Frost, 2026-10-15): standing ice formations
    // — frozen geysers and pressure spires — that harvest to
    // NEVERMELT ICE. (Adam caught the first draft: a 'frozen
    // forest' is shaped like a Frost x Rootwood hybrid, not a
    // variant. The forest waits for the hybrid pass; the Fangs
    // are purely Frost's own growth.)
    id: 'frost_fangs',
    family: 'frost',
    name: 'The Ice Fangs',
    minHops: 4,
    rarity: 'uncommon',
    tint: { color: 0xbcd8ee, strength: 0.5 },
    floraDensityMult: 1.1,
    faunaDensityMult: 0.85,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.1,
    nameParts: {
      first: ['Brittle', 'Sharp', 'Frozen', 'Pale', 'Tall'],
      second: ['Fangs', 'Teeth', 'Spires', 'Reach', 'Stand'],
    },
  },
  {
    // The Singing Ice (Frost, 2026-10-15): a frozen lake-field
    // that booms under pressure and throws light far through the
    // ice (reach x1.3). The family's gift variant — beauty, no
    // tax. Rare.
    id: 'frost_singing',
    family: 'frost',
    name: 'The Singing Ice',
    minHops: 4,
    rarity: 'rare',
    tint: { color: 0xd6ecfa, strength: 0.5 },
    floraDensityMult: 0.9,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 1.3,
    lightIntensityMult: 1.1,
    nameParts: {
      first: ['Singing', 'Booming', 'Bright', 'Glass', 'Patient'],
      second: ['Ice', 'Lake', 'Mirror', 'Field', 'Deep'],
    },
  },
  {
    // Rootwood Canopy (2026-10-15): the family's signature face —
    // the biggest roots, bright clearings between them, and the
    // root BRIDGES at their most generous (worldGen deals them).
    id: 'rootwood_canopy',
    family: 'rootwood',
    name: 'Rootwood Canopy',
    minHops: 2,
    rarity: 'uncommon',
    tint: { color: 0x5d7a2e, strength: 0.5 }, // brighter green
    floraDensityMult: 1.15,
    faunaDensityMult: 1.0,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.1, // clearings catch the light
    nameParts: {
      first: ['High', 'Bright', 'Green', 'Vast', 'Old'],
      second: ['Canopy', 'Crown', 'Reach', 'Roof', 'Arches'],
    },
  },
  {
    // The Underroot (Rootwood, 2026-10-15): where the canopy
    // closes overhead and the ground lives in gloom — pooled
    // light reach x0.7. The family's scar is darkness, like the
    // Drift's: your lights matter here.
    id: 'rootwood_underroot',
    family: 'rootwood',
    name: 'The Underroot',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0x2f3d1e, strength: 0.65 }, // deep shade green
    floraDensityMult: 1.1,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 0.7,
    lightIntensityMult: 0.85,
    nameParts: {
      first: ['Dark', 'Deep', 'Quiet', 'Rooted', 'Low'],
      second: ['Underroot', 'Shade', 'Hollows', 'Vault', 'Dark'],
    },
  },
  {
    // The Rootfall (Rootwood, 2026-10-15): a giant has FALLEN —
    // horizontal country, split heartwood, compost-rich soil.
    // The family's gift variant: the densest heartroot stands.
    id: 'rootwood_rootfall',
    family: 'rootwood',
    name: 'The Rootfall',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0x6b4f2a, strength: 0.45 }, // fallen-wood brown
    floraDensityMult: 1.3,
    faunaDensityMult: 1.0,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1,
    nameParts: {
      first: ['Fallen', 'Great', 'Split', 'Old', 'Resting'],
      second: ['Rootfall', 'Giant', 'Rest', 'Reach', 'Grave'],
    },
  },
  {
    // Precursor Garden (2026-10-15): the signature face — the
    // tended geometry at full strength. Blooms grow in a visible
    // spiral here (worldGen plants the pattern), and the garden
    // pays double: Living Thread AND rich ordinary stock (Adam).
    id: 'precursor_garden',
    family: 'precursor',
    name: 'Precursor Garden',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0xbcc97e, strength: 0.5 }, // brighter cultivated gold
    floraDensityMult: 1.25,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.05,
    nameParts: {
      first: ['Golden', 'Patient', 'Ordered', 'Bright', 'Old'],
      second: ['Garden', 'Rows', 'Spiral', 'Terrace', 'Court'],
    },
  },
  {
    // The Untended (Precursor, 2026-10-15): the same garden,
    // ten thousand years without a gardener — the spiral gone
    // feral, lush and dark. The family's wild face.
    id: 'precursor_untended',
    family: 'precursor',
    name: 'The Untended',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0x3d5222, strength: 0.6 }, // deep wild green
    floraDensityMult: 1.3,
    faunaDensityMult: 1.1,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 0.9,
    nameParts: {
      first: ['Wild', 'Feral', 'Lost', 'Tangled', 'Deep'],
      second: ['Untended', 'Garden', 'Tangle', 'Rows', 'Deep'],
    },
  },
  {
    // The Tending Field (Precursor, 2026-10-15): the densest
    // bloom spirals in the world, where the tenders still stand
    // in the rows — FORGED creatures, grown for garden work,
    // biggish and long dead (Adam's ruling: no machines on this
    // biological planet). Their husks generate as scenery.
    id: 'precursor_tending',
    family: 'precursor',
    name: 'The Tending Field',
    minHops: 4,
    rarity: 'rare',
    tint: { color: 0xc2cf8a, strength: 0.45 },
    floraDensityMult: 1.1,
    faunaDensityMult: 0.8,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.1,
    nameParts: {
      first: ['Standing', 'Patient', 'Iron', 'Bright', 'Old'],
      second: ['Tending', 'Field', 'Rows', 'Works', 'Court'],
    },
  },
  {
    // The Bonefields (Bone, 2026-10-15): the family's common
    // face — fragments and rib-shards everywhere (generated bone
    // scenery), and flora sheltering in their shade. The soil
    // remembers everything that ever died here, and feeds it
    // forward.
    id: 'bonefields',
    family: 'bone',
    name: 'The Bonefields',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0xe2dac6, strength: 0.55 }, // paler, bleached
    floraDensityMult: 1.0,
    faunaDensityMult: 1.0,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.05,
    nameParts: {
      first: ['Bleached', 'Quiet', 'Old', 'Patient', 'Dry'],
      second: ['Fields', 'Bones', 'Rest', 'Shards', 'Flats'],
    },
  },
  {
    // The Marrow Flats (Bone, 2026-10-15): the generous face —
    // the richest bone-soil in the world, gravebloom standing
    // thick. Death, fully composted into generosity.
    id: 'marrow_flats',
    family: 'bone',
    name: 'The Marrow Flats',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0xcfc39e, strength: 0.5 }, // warmer marrow tone
    floraDensityMult: 1.3,
    faunaDensityMult: 0.9,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1,
    nameParts: {
      first: ['Rich', 'Warm', 'Deep', 'Quiet', 'Old'],
      second: ['Marrow', 'Flats', 'Fields', 'Rest', 'Soil'],
    },
  },
  {
    // Leviathan Graveyard (Bone, 2026-10-15): ONE impossible
    // skeleton — ribs you walk under, a skull like a house —
    // as generated scenery. Adam's call: it ROLLS as a rare
    // variant; rarity does the scarcity work, no landmark
    // bookkeeping. Reverent quiet country.
    id: 'leviathan_graveyard',
    family: 'bone',
    name: 'Leviathan Graveyard',
    minHops: 4,
    rarity: 'rare',
    tint: { color: 0xdcd2ba, strength: 0.5 },
    floraDensityMult: 1.1,
    faunaDensityMult: 0.8,
    effect: null,
    lightDistanceMult: 1,
    lightIntensityMult: 1.05,
    nameParts: {
      first: ['Great', 'Silent', 'Ancient', 'Patient', 'Vast'],
      second: ['Rest', 'Graveyard', 'Ribs', 'Quiet', 'Fall'],
    },
  },
  {
    // The Charged Flats (Storm, 2026-10-15): the family's
    // COMMON face (Adam's approval) — humming air, static on
    // the skin, scorched-glass patches and fulgurite fingers
    // where the lightning has kissed the ground. Zots every
    // ~30s: warned, shelterable, survivable — the tax of
    // charged country.
    id: 'charged_flats',
    family: 'storm',
    name: 'The Charged Flats',
    minHops: 3,
    rarity: 'common',
    tint: { color: 0x7d93a8, strength: 0.5 }, // brighter slate-blue
    floraDensityMult: 1.05,
    faunaDensityMult: 1.0,
    effect: 'storm_zot',
    zotIntervalSec: 30,
    lightDistanceMult: 1,
    lightIntensityMult: 1.05,
    nameParts: {
      first: ['Charged', 'Humming', 'Bright', 'Static', 'Open'],
      second: ['Flats', 'Fields', 'Reach', 'Plains', 'Sands'],
    },
  },
  {
    // Magnetic Dunes (Storm, 2026-10-15): black sand, the
    // charge at its angriest — zots every ~16s. RARE, per the
    // gate cap: the family gates at 3, the weird faces price
    // themselves in rarity.
    id: 'magnetic_dunes',
    family: 'storm',
    name: 'Magnetic Dunes',
    minHops: 4,
    rarity: 'rare',
    tint: { color: 0x2b2b30, strength: 0.6 }, // near-black sand
    floraDensityMult: 0.7,
    faunaDensityMult: 0.8,
    effect: 'storm_zot',
    zotIntervalSec: 16,
    lightDistanceMult: 1,
    lightIntensityMult: 0.95,
    nameParts: {
      first: ['Black', 'Iron', 'Singing', 'Dark', 'Deep'],
      second: ['Dunes', 'Sands', 'Fields', 'Reach', 'Drift'],
    },
  },
  {
    // Skyfall Basin (Storm, 2026-10-15): the basin DRINKS the
    // charge — zots rare here (~60s), the flora richest in
    // Storm country. Old reports say the rain falls up in the
    // basin; the calm is real whatever the rain does.
    id: 'skyfall_basin',
    family: 'storm',
    name: 'Skyfall Basin',
    minHops: 4,
    rarity: 'rare',
    tint: { color: 0xa8c8d8, strength: 0.45 }, // pale sky-cyan
    floraDensityMult: 1.3,
    faunaDensityMult: 0.9,
    effect: 'storm_zot',
    zotIntervalSec: 60,
    lightDistanceMult: 1.1,
    lightIntensityMult: 1.1,
    nameParts: {
      first: ['Calm', 'Bright', 'Open', 'Patient', 'High'],
      second: ['Basin', 'Skyfall', 'Bowl', 'Fields', 'Rest'],
    },
  },
  {
    // Welcoming Valley (Living, 2026-10-15): the host in its
    // generous mood — the ground HEALS you as you stand in it.
    // One face of Adam's temperament spectrum; the plain family
    // (no variant) is the Content Valley, which does neither.
    id: 'welcoming_valley',
    family: 'living',
    name: 'Welcoming Valley',
    minHops: 3,
    rarity: 'uncommon',
    tint: { color: 0x6b4a7a, strength: 0.45 }, // warm violet-gold
    floraDensityMult: 1.35,
    faunaDensityMult: 1.05,
    effect: 'living_welcome',
    lightDistanceMult: 1.05,
    lightIntensityMult: 1.1,
    nameParts: {
      first: ['Welcoming', 'Gentle', 'Open', 'Warm', 'Kind'],
      second: ['Valley', 'Vale', 'Arms', 'Reach', 'Rest'],
    },
  },
  {
    // Hungry Valley (Living, 2026-10-15): the host in its taking
    // mood — the GRAB. Warned like the zot (fairness), aimed at
    // the spot you stood on (move and it grabs air), and FEEDING
    // the heartbloom quiets it while it digests.
    id: 'hungry_valley',
    family: 'living',
    name: 'Hungry Valley',
    minHops: 3,
    rarity: 'rare',
    tint: { color: 0x4a2438, strength: 0.55 }, // deep red-violet
    floraDensityMult: 1.1,
    faunaDensityMult: 0.9,
    effect: 'living_hunger',
    lightDistanceMult: 1,
    lightIntensityMult: 0.95,
    nameParts: {
      first: ['Hungry', 'Patient', 'Waiting', 'Deep', 'Red'],
      second: ['Valley', 'Vale', 'Maw', 'Reach', 'Throat'],
    },
  },
  {
    // Two-Minded Valley (Living, 2026-10-15): BOTH temperaments
    // at once, split by ground (Adam) — it heals in its
    // clearings and grabs in its HEART THICKET, the seeded patch
    // around the heartbloom (zones.livingHeartAt). The rarest
    // face of the strangest family.
    id: 'twominded_valley',
    family: 'living',
    name: 'Two-Minded Valley',
    minHops: 4,
    rarity: 'rare',
    tint: { color: 0x54355e, strength: 0.5 }, // mid violet
    floraDensityMult: 1.2,
    faunaDensityMult: 1.0,
    effect: 'living_hunger', // the loop special-cases twominded: hunger only inside the thicket, welcome outside
    lightDistanceMult: 1,
    lightIntensityMult: 1.0,
    nameParts: {
      first: ['Two-Minded', 'Divided', 'Strange', 'Patient', 'Vast'],
      second: ['Valley', 'Vale', 'Body', 'Reach', 'Heart'],
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
