// ============================================================================
// flora.ts — THE FLORA TABLE (creature build phase, slice 9)
// ----------------------------------------------------------------------------
// Design source: ReadMeFiles/CREATURES_BRAINSTORM_*.md — the plant and
// fungus kingdoms of the 358-species roster. This file is the flora mirror
// of species.ts, under the same contract:
//
//   * A species is DATA, not a code file. One entry here per species.
//   * Shared systems (spawning, harvest yields, meshes) are written ONCE
//     and read this table — no per-species branches.
//   * Kinds stay visibly separate (Adam's word-group rule): this table is
//     FLORA and FUNGUS; fauna lives in species.ts. The `kind` field says
//     which kingdom each entry belongs to.
//
// HOW A FLORA SPECIES REACHES THE WORLD:
//   1. THE CENSUS (worldGen.ts FLORA_CENSUS) — the classic starter five.
//      A promise about the starter multiset; STAYS UNTOUCHED here.
//   2. VARIANT DRESSING (worldGen.ts hand-placed blocks) — the biome
//      program's bespoke flora (glow fungus, cinder blooms, ...).
//      Predates this table; left as-is.
//   3. BONUS GROWTH (worldGen.ts generic loop, slice 9) — everything in
//      this table with a `bonusGrow` spec: biome affinity + the SAME
//      gates the fauna loop uses (variant / hybrid pair / zone weather),
//      dealt outside the census, never in the spawn zone, one seeded
//      stream per species.
//
// HARVEST: yields live HERE (`harvest`), not in the tool hook.
// useToolInteractions' computeHarvestYields consults this table first
// and falls back to its legacy switch for the census/dressing species
// whose yields carry bespoke commentary. New species never need a hook
// edit again.
//
// PLANTING (seed items, player-grown flora) is a later economy slice,
// exactly as creature taming refinements followed the fauna slices.
// ============================================================================

import type { BiomeId } from './biomes';
import type { WeatherMode } from './zones';
import type { CodexEntry, FloraSpecies, ItemId } from '../types/game';

/** What one harvest gives up. The harvest glove leaves the plant
 *  standing to regrow; the solvent dissolves it outright — both read
 *  this same shape (the hook's one-table rule, kept). */
export interface FloraHarvest {
  item: ItemId;
  /** Yield of an unfertilized plant. */
  count: number;
  /** Yield when the Yield Fertilizer flag is set. */
  fertilizedCount: number;
  /** Flat extras, unaffected by fertilizer. */
  extras?: [ItemId, number][];
}

/** Placement spec for the generic bonus-growth loop — the flora
 *  mirror of SpeciesBonusSpawn (species.ts). Gates mean the same
 *  things in both loops; keep the semantics identical. */
export interface FloraBonusGrow {
  /** Family affinities — the zone's biome OR a hybrid's secondary
   *  family both count. 'all' is the ubiquitous layer. */
  biomes: BiomeId[] | 'all';
  /** Variant gate: deals ONLY in zones of this variant. */
  variant?: string;
  /** Hybrid gate: deals ONLY in a hybrid zone of this family pair. */
  hybrid?: readonly [BiomeId, BiomeId];
  /** Weather gate: deals only where the zone's weather matches. */
  weather?: WeatherMode;
  /** Individuals dealt per eligible zone. */
  count: number;
  /** Keep this far from the zone center. */
  minRadius: number;
  /** Minimum distance from flora already placed. */
  spacing: number;
  /** Mesh scale band (seeded within ±25%). */
  scale: number;
}

export interface FloraDef {
  id: FloraSpecies;
  name: string;
  /** Which kingdom: plant or fungus. (The codex files both under
   *  'flora'; this field is the design-facing distinction.) */
  kind: 'flora' | 'fungus';
  /** Harvest yields as data; null = not harvestable (scenery,
   *  hazards you endure rather than pick, the not-yet-built). */
  harvest: FloraHarvest | null;
  /** Hazardous flora (the snap trap's kin): the entity is stamped
   *  isHazardous and the shipped hazard machinery applies. */
  hazardous?: boolean;
  bonusGrow: FloraBonusGrow | null;
}

export const FLORA: Record<string, FloraDef> = {
  // ------------------------------------------------------------------
  // Wave 1 (slice 9, 2026-10-15) — the pipeline's proof: twelve
  // species across six families and both kingdoms, exercising
  // every gate the loop inherited (variant, hybrid, plain
  // affinity) on day one.
  // ------------------------------------------------------------------

  // #94 — the snap trap's aquatic rhyme: a lily whose pad is a
  // POD that folds on small fauna stepping to drink. Patient,
  // floating-anchored, Mirror Marsh first among its homes —
  // hence the variant gate. Hazardous, like its cousin: the
  // Wetland's stillness, with an author. Its cup gathers the
  // marsh's dew; that is what a careful harvest takes.
  gulp_lily: {
    id: 'gulp_lily',
    name: 'Gulp Lily',
    kind: 'flora',
    harvest: { item: 'dew_essence', count: 2, fertilizedCount: 3 },
    hazardous: true,
    bonusGrow: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.1,
    },
  },

  // #121 — the route made visible: a grass whose seeds ride
  // FEET, so it grows where walking happens — trails,
  // migrations, the Leviathan's road. A thickened waygrass
  // line IS a route, readable from a ridge. Open + Temperate
  // ranges per its entry. Cuts to fiber like all honest grass.
  waygrass: {
    id: 'waygrass',
    name: 'Waygrass',
    kind: 'flora',
    harvest: { item: 'soft_fiber', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['meadow', 'storm', 'bone', 'saltglass'],
      count: 4,
      minRadius: 6,
      spacing: 3,
      scale: 1.0,
    },
  },

  // #224 — fire's promise: a lily whose seeds germinate ONLY
  // after flame passes (Earth's serotiny, cited by its entry),
  // so after a Drift fire the Ashen fields bloom red in a
  // single week. The Ember country's calendar of fire has a
  // beginning, and this is it. Petals, like the bell bloom's.
  flame_lily: {
    id: 'flame_lily',
    name: 'Flame Lily',
    kind: 'flora',
    harvest: { item: 'vibrant_petal', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: {
      biomes: ['ember'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.0,
    },
  },

  // #226 — the flats' noon clock: a daisy whose petals wear a
  // fine salt crust it SHEDS at noon daily (the flats'
  // children measure the Pan Lizard's statue hours against
  // the shedding). Crust-petaled petals are the harvest.
  salt_daisy: {
    id: 'salt_daisy',
    name: 'Salt Daisy',
    kind: 'flora',
    harvest: { item: 'vibrant_petal', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'saltglass_flats',
      count: 4,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #244 — a compass the size of a field: a crystalline cress
  // whose needle-leaves align to the magnetic field, all
  // pointing one way — the Dunes are where navigation dies,
  // and the cress is the country's answer, grown. Magnetic
  // grit gathers at its roots: Lodestone Sand's second door.
  compass_cress: {
    id: 'compass_cress',
    name: 'Compass Cress',
    kind: 'flora',
    harvest: { item: 'lodestone_sand', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['storm'],
      variant: 'magnetic_dunes',
      count: 4,
      minRadius: 8,
      spacing: 3,
      scale: 0.8,
    },
  },

  // #256 — a meadow seen through glass: it grows IN the lake
  // ice of the Singing Ice, blooming under the surface in the
  // clear depths. In v1 it takes the singing ground like the
  // other variant flora — the under-ice garden waits on the
  // pond system, honestly noted rather than faked. Its
  // harvest is the frost-dew beaded on the blades. (Nevermelt
  // Ice stays the Rime Spires' single source — by doctrine
  // this grass does NOT yield it.)
  ice_grass: {
    id: 'ice_grass',
    name: 'Ice Grass',
    kind: 'flora',
    harvest: { item: 'dew_essence', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_singing',
      count: 4,
      minRadius: 8,
      spacing: 3,
      scale: 1.0,
    },
  },

  // #120 — THE field mushroom: the classic cap-and-stem, done
  // honestly — the baseline against which the family's exotic
  // caps are measured. Fruits after rain across the Temperate
  // + Wet ranges. Compost gold, like the visor shroom.
  field_cap: {
    id: 'field_cap',
    name: 'Field Cap',
    kind: 'fungus',
    harvest: { item: 'basic_compost', count: 2, fertilizedCount: 3, extras: [['glow_spore', 1]] },
    bonusGrow: {
      biomes: ['fungal', 'rootwood', 'meadow', 'wetland'],
      count: 4,
      minRadius: 6,
      spacing: 3,
      scale: 1.0,
    },
  },

  // #163 — the Cold Groves' tower: pale caps stepping up a
  // stalk, frost-furred, fruiting THROUGH snow in the still
  // cold on the Frozen Forest's fungal side. A hybrid citizen
  // (Fungal × Frost) — the hybrid gate's first flora.
  frostcap: {
    id: 'frostcap',
    name: 'Frostcap',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 2, fertilizedCount: 4 },
    bonusGrow: {
      biomes: ['fungal', 'frost'],
      hybrid: ['fungal', 'frost'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.2,
    },
  },

  // #265 — the herds' recycler: a pasture cap fruiting on hay
  // and herd-leavings — what the herds drop, the haycap
  // renders, and the meadow's famous fertility is mostly this
  // small citizen at ankle height. Its design names its own
  // harvest item: the Haycap itself, gathered whole.
  haycap: {
    id: 'haycap',
    name: 'Haycap',
    kind: 'fungus',
    harvest: { item: 'haycap', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['meadow'],
      count: 4,
      minRadius: 6,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #271 — the Flame Lily's other half: a black cap fruiting
  // on charcoal and coal beds — the lily waits for fire; the
  // coal cap ARRIVES after it, in the burn's first cool week.
  // Between them the Ember calendar of fire has a beginning
  // and an end, both botanical. Renders charcoal to compost.
  coal_cap: {
    id: 'coal_cap',
    name: 'Coal Cap',
    kind: 'fungus',
    harvest: { item: 'basic_compost', count: 2, fertilizedCount: 3, extras: [['glow_spore', 1]] },
    bonusGrow: {
      biomes: ['ember'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.0,
    },
  },

  // #275 — the melt line, edible: a morel advancing in a dark
  // honeycomb front where the snowfields retreat — the
  // Stillwhite's spring is brief and delicious, and the
  // family's whole cast times its year by the morel line.
  // Frost Voles cache them; so will you. Named item, gathered.
  snow_morel: {
    id: 'snow_morel',
    name: 'Snow Morel',
    kind: 'fungus',
    harvest: { item: 'snow_morel', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['frost'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #325 — the kingdom writes its script, then provides the
  // ink: a ruin cap that MELTS into black ink at maturity
  // (Earth's inkcaps, under the familiar license). The
  // chroniclers gather the melt in pots, and the far
  // country's texts are copied in this fungus. Its harvest
  // item is the melt itself: Ink Cap, bottled by the picking.
  ink_cap: {
    id: 'ink_cap',
    name: 'Ink Cap',
    kind: 'fungus',
    harvest: { item: 'ink_cap', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.0,
    },
  },

  // ------------------------------------------------------------------
  // Wave 2 (slice 10, 2026-10-16) — the pipeline's second growth:
  // the families wave 1 didn't reach (Bone, Storm, the Living's
  // own flora), three more hybrid citizens, and the roster's
  // design-named harvest items, gathered as named.
  // ------------------------------------------------------------------

  // #38 — a sheet with ambitions: a moss that grows ONLY on
  // bone — never soil, never stone — softening every skeleton
  // it takes until a cleaned ribcage looks upholstered. The
  // Graveyard's ground cover and its upholsterer. Harvested
  // by handfuls, moss-fashion: the item is its own name.
  bonemoss: {
    id: 'bonemoss',
    name: 'Bonemoss',
    kind: 'flora',
    harvest: { item: 'bonemoss', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['bone'],
      count: 4,
      minRadius: 8,
      spacing: 3,
      scale: 1.2,
    },
  },

  // #78 — the valley listening back: an ear-fronded fern that
  // TURNS — a leaf at a time, over minutes — toward sound:
  // toward the Greeter's rustle, toward birdsong, toward a
  // player's voice at the valley's edge. Arrive talking and
  // the ferns will be facing you. Harvested kindly: a frond
  // that was facing you is a souvenir with a direction.
  listening_fern: {
    id: 'listening_fern',
    name: 'Listening Fern',
    kind: 'flora',
    harvest: { item: 'listening_frond', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['living'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.0,
    },
  },

  // #86 — grown ice, tuned: a small bell of ice-crystal
  // petals on a living stalk that RINGS when frost forms
  // fast — the petals chime as they grow. Its petal is the
  // roster's first PERISHABLE material: it melts by the next
  // warm hour unless kept cold. (The perishability clock is
  // a later economy system; the deadline is in the item's
  // text from day one, honestly.)
  snowbell: {
    id: 'snowbell',
    name: 'Snowbell',
    kind: 'flora',
    harvest: { item: 'ice_petal', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['frost'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #108 — flowering from ribs and eye-sockets: a vine that
  // grows THROUGH the Grave Roots' skeletons, rooting in
  // root-soil, until a leviathan wears its spine in white
  // flowers. Dusk-cut flowers are the harvest — a decoration
  // with a provenance.
  grave_vine: {
    id: 'grave_vine',
    name: 'Grave Vine',
    kind: 'flora',
    harvest: { item: 'gravevine_flower', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['rootwood', 'bone'],
      hybrid: ['rootwood', 'bone'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.1,
    },
  },

  // #164 — living conduits of crystal: a Glasswood tree
  // whose roots grow SALTGLASS as they grow, threading the
  // soil with glass. An old saltroot's root-plate is a
  // crystal garden lying in the ground. The harvest is what
  // falls: naturally tubed root-glass — the far crafters'
  // piping and lens-blanks. Dealt sparse: trees.
  saltroot: {
    id: 'saltroot',
    name: 'Saltroot',
    kind: 'flora',
    harvest: { item: 'saltroot_glass', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['saltglass', 'rootwood'],
      hybrid: ['saltglass', 'rootwood'],
      count: 2,
      minRadius: 14,
      spacing: 8,
      scale: 1.5,
    },
  },

  // #202 — grown for the lightning: a low, spired root-shrub
  // whose spires are the Loud Valley's own stormcatchers —
  // the zot strikes them FIRST, and the charge is stored in
  // root-fruit that glow. Gathered discharged, after the
  // glow fades: tart, tingling — the loud country's
  // provisions.
  stormroot: {
    id: 'stormroot',
    name: 'Stormroot',
    kind: 'flora',
    harvest: { item: 'storm_fruit', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['storm', 'living'],
      hybrid: ['storm', 'living'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.0,
    },
  },

  // #219 — the water's edge, lit: a sedge crowned with gel
  // pods of biolume, lit at dusk, dimmed at dawn — the
  // marsh's own lanterns along the banks. (The Lantern Fern
  // lights the woods' floors; the bog lantern lights the
  // WATER's edge.) A whole pod, carefully: the wet country's
  // lamp oil, grown.
  bog_lantern: {
    id: 'bog_lantern',
    name: 'Bog Lantern',
    kind: 'flora',
    harvest: { item: 'bog_light', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.0,
    },
  },

  // #233 — the flats' whole instrument: a grass whose hollow
  // blades are length-sorted by the wind itself, so a field
  // SINGS in weather, each stand a chord. Cut blades are the
  // harvest: straw for pipes, calls, and instruments — the
  // Storm country's first export of music.
  gale_grass: {
    id: 'gale_grass',
    name: 'Gale Grass',
    kind: 'flora',
    harvest: { item: 'gale_straw', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['storm'],
      variant: 'charged_flats',
      count: 4,
      minRadius: 8,
      spacing: 3,
      scale: 1.1,
    },
  },

  // #235 — threshold-true: the valley's rose grows at
  // DOORWAYS and blooms in proportion to a door's use — a
  // kept homestead's step flowers; an abandoned one goes
  // bare within a season. In a Hungry valley, count your
  // doors by the roses, and be concerned by any door that
  // blooms which you did not build. Petals: the valley's
  // small change.
  doorstep_rose: {
    id: 'doorstep_rose',
    name: 'Doorstep Rose',
    kind: 'flora',
    harvest: { item: 'vibrant_petal', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['living'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #238 — the gardens' handwriting, still writing: a vine
  // bred to grow GLYPH-SHAPED leaves in sequence along its
  // stems — what it writes has never repeated in recorded
  // watching. Fallen letter-leaves are the harvest: kept as
  // curios, pressed in codexes, traded by chroniclers.
  glyph_vine: {
    id: 'glyph_vine',
    name: 'Glyph Vine',
    kind: 'flora',
    harvest: { item: 'glyph_leaf', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 1.0,
    },
  },

  // #269 — THE classic glowing cap, at grove scale: the
  // mushroom of the family's postcards, gill-lit green, in
  // rings and drifts under the groves. Never harvested for
  // the cap — its shed spores are the gathering, the
  // economy's standing door to Glow Spore.
  glowcap: {
    id: 'glowcap',
    name: 'Glowcap',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 2, fertilizedCount: 4 },
    bonusGrow: {
      biomes: ['fungal'],
      count: 4,
      minRadius: 8,
      spacing: 3,
      scale: 1.1,
    },
  },

  // #272 — a puffball that puffs WARM: stepped on or struck,
  // it exhales a breath of heated spore-dust, the Drift's
  // small theater. Gathered unpuffed, it is a hand-warmer
  // that works once, by being squeezed — the country's
  // disposable comfort. Ships as a quiet crop in v1; the
  // warm puff is a later behavior note.
  ash_puff: {
    id: 'ash_puff',
    name: 'Ash Puff',
    kind: 'fungus',
    harvest: { item: 'ash_puff', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['ember'],
      variant: 'ashen_drift',
      count: 3,
      minRadius: 10,
      spacing: 4,
      scale: 0.9,
    },
  },
};

/** Table lookup by species id (the hook + worldGen read here). */
export function floraDef(id: FloraSpecies): FloraDef | undefined {
  return FLORA[id];
}

/** Every table species that grows via the generic bonus loop. */
export const BONUS_GROW_FLORA: FloraDef[] = Object.values(FLORA).filter((d) => d.bonusGrow !== null);

// ---------------------------------------------------------------------------
// Codex entries (waves 1–2). They live HERE, with the flora table, rather
// than in constants.ts: INITIAL_CODEX spreads this array in, and
// constants.ts has outgrown what a single push can carry — the flora
// codex travelling with the flora table keeps both files pushable
// and the kingdoms' text beside the kingdoms' data.
// ---------------------------------------------------------------------------
export const FLORA_CODEX: CodexEntry[] = [
  {
    species: 'gulp_lily',
    name: 'Gulp Lily',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The snap trap\'s aquatic rhyme: a lily whose pad is a pod — small fauna stepping to drink find the pad fold: GULP. It owns its pool\'s surface the way the snapper owns its bottom. Approach for the dew in its cup the way the marsh approaches everything: slowly, and from the side the pad isn\'t watching.',
    byproducts: ['Dew Essence (in the cup)'],
    tamingOrCraftNotes: 'A hazard, not a crop: harvest leaves it standing, and it does not hold a grudge — it holds whatever steps on it.',
    biome: 'Wetland (Mirror Marsh first among its pools)',
    iconColor: '#22c55e',
  },
  {
    species: 'waygrass',
    name: 'Waygrass',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The route made visible: a grass whose seeds ride feet, so it grows where walking happens — trails, migrations, the Leviathan\'s road, caravan lines. A thickened waygrass line is a route, readable from a ridge: the country\'s memory of every journey, kept in grass.',
    byproducts: ['Soft Fiber'],
    tamingOrCraftNotes: 'Cuts to fiber like all honest grass. Follow it and you are walking a road something else surveyed.',
    biome: 'Open + Temperate (Meadow, Storm, Bone, Saltglass)',
    iconColor: '#84cc16',
  },
  {
    species: 'flame_lily',
    name: 'Flame Lily',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Fire\'s promise: a lily whose seeds germinate only after flame passes, so a flame lily field is a promise written against the next burn — and after a Drift fire, the Ashen fields bloom red in a single week. The Ember country\'s calendar of fire has a beginning, and it is botanical.',
    byproducts: ['Vibrant Petal', 'Dew Essence'],
    tamingOrCraftNotes: 'Harvest the bloom; the seed bank in the ash is the country\'s business, and it keeps its appointments.',
    biome: 'Ember',
    iconColor: '#ef4444',
  },
  {
    species: 'salt_daisy',
    name: 'Salt Daisy',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The flats\' noon clock: a daisy whose petals wear a fine salt crust it sheds at noon daily — the flats\' children measure the statue-lizard\'s still hours against the shedding, in a game with no rules written anywhere. Pretty, patient, and keeping time for a whole country.',
    byproducts: ['Vibrant Petal (crust-petaled)'],
    tamingOrCraftNotes: 'Pick the petals; come back tomorrow at noon and watch it tell the time.',
    biome: 'Saltglass (the Flats)',
    iconColor: '#f8fafc',
  },
  {
    species: 'compass_cress',
    name: 'Compass Cress',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A compass the size of a field: a low crystalline cress whose needle-leaves align to the magnetic field, all pointing one way. The Dunes are where navigation dies; the cress is the country\'s answer, grown — caravans plant it at evening camps and read it at dawn.',
    byproducts: ['Lodestone Sand (gathered at its roots)'],
    tamingOrCraftNotes: 'Harvest the grit at its roots; the leaves keep pointing, free of charge.',
    biome: 'Storm (the Magnetic Dunes)',
    iconColor: '#67e8f9',
  },
  {
    species: 'ice_grass',
    name: 'Ice Grass',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A meadow seen through glass: it grows in the lake ice of the Singing Ice, blooming under the surface in the clear depths — the ice-skating glider passes over a garden, and the great shadow crosses it, and the garden blooms on, in the blue, out of reach of both. What reaches you is the frost-dew beaded on the blades at the ice\'s edge.',
    byproducts: ['Dew Essence (frost-dew)'],
    tamingOrCraftNotes: 'Gather the dew; the garden itself is under glass in every sense.',
    biome: 'Frost (the Singing Ice)',
    iconColor: '#a5f3fc',
  },
  {
    species: 'field_cap',
    name: 'Field Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'THE field mushroom: the classic cap-and-stem, done honestly — the baseline against which the kingdom\'s exotic caps are measured. It fruits after rain across four families, unshowy and everywhere the ground is kind. Every forager\'s education starts here.',
    byproducts: ['Basic Compost', 'Glow Spore'],
    tamingOrCraftNotes: 'Renders to compost gold, like its visor-faced cousin — the field\'s quiet alchemy.',
    biome: 'Temperate + Wet (Fungal, Rootwood, Meadow, Wetland)',
    iconColor: '#d6c48f',
  },
  {
    species: 'frostcap',
    name: 'Frostcap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The Cold Groves\' tower: pale caps stepping up a stalk, frost-furred — its caps wear rime like the Frost Stag wears velvet. It fruits through snow, in the still cold, on the frozen forest\'s fungal side: winter, growing upward, one pale step at a time.',
    byproducts: ['Glow Spore'],
    tamingOrCraftNotes: 'Pick the caps; the stalk stands the winter and steps again.',
    biome: 'Fungal × Frost (the Cold Groves only)',
    iconColor: '#e0f2fe',
  },
  {
    species: 'haycap',
    name: 'Haycap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The herds\' recycler: a pasture cap fruiting on hay and herd-leavings — what the herds drop, the haycap renders, and the meadow\'s famous fertility is mostly this small citizen working at ankle height. Gathered whole, cap and all.',
    byproducts: ['Haycap (itself)'],
    tamingOrCraftNotes: 'Follow a herd for a day and you will find its whole economy, fruiting behind them.',
    biome: 'Meadow',
    iconColor: '#eab308',
  },
  {
    species: 'coal_cap',
    name: 'Coal Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The Flame Lily\'s other half: a black cap fruiting on charcoal and coal beds — the lily waits for fire; the coal cap arrives after it, fruiting in the burn\'s first cool week. Between them, the Ember country\'s calendar of fire has a beginning and an end, both botanical.',
    byproducts: ['Basic Compost', 'Glow Spore'],
    tamingOrCraftNotes: 'Renders the burn to compost — the scar, composted, becomes the next field.',
    biome: 'Ember (charcoal and coal beds)',
    iconColor: '#292524',
  },
  {
    species: 'snow_morel',
    name: 'Snow Morel',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The melt line, edible: a dark honeycomb morel advancing in a front where the snowfields retreat — the Stillwhite\'s spring is edible and brief. Frost Voles cache them, pufflings shelter under them, and the family\'s whole cast times its year by the morel line.',
    byproducts: ['Snow Morel (itself)'],
    tamingOrCraftNotes: 'Gather at the melt line, in the brief week — the voles are caching against the same calendar.',
    biome: 'Frost (the melt lines)',
    iconColor: '#78716c',
  },
  {
    species: 'ink_cap',
    name: 'Ink Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The kingdom writes its script, then provides the ink: a ruin cap that melts into black ink at maturity. The chroniclers gather the melt in pots, and the far country\'s one-day sentences are copied across the world in this fungus. A library, at ankle height, self-destructing politely.',
    byproducts: ['Ink Cap (the gathered melt)'],
    tamingOrCraftNotes: 'Gather the melt at maturity — tomorrow it is a black puddle and a smell of libraries.',
    biome: 'Precursor (the ruins)',
    iconColor: '#1c1917',
  },
  {
    species: 'bonemoss',
    name: 'Bonemoss',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A sheet with ambitions: a green so deep it reads black in shade, growing only on bone — never soil, never stone — softening every skeleton it takes, until a cleaned ribcage looks upholstered. The Graveyard\'s ground cover is also its upholsterer, and the treaty\'s quietest signatory.',
    byproducts: ['Bonemoss (handfuls, moss-fashion)'],
    tamingOrCraftNotes: 'Gather handfuls; the ribcage will not miss them, and the moss keeps the rest of its appointments.',
    biome: 'Bone (on bone, only on bone)',
    iconColor: '#14532d',
  },
  {
    species: 'listening_fern',
    name: 'Listening Fern',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The valley listening back: an ear-fronded fern that turns — a leaf at a time, over minutes — toward sound: toward birdsong, toward the Greeter\'s rustle, toward a player\'s voice at the valley\'s edge. Arrive talking and the ferns will be facing you. In a Hungry valley, the ferns face the paths, and the paths are where you are.',
    byproducts: ['Listening Frond (a souvenir with a direction)'],
    tamingOrCraftNotes: 'Cut fronds kindly. Some items are the world\'s texture; a frond that was facing you is one of them.',
    biome: 'The Living (family cast)',
    iconColor: '#4ade80',
  },
  {
    species: 'snowbell',
    name: 'Snowbell',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Grown ice, tuned: a small bell of ice-crystal petals on a living stalk. It rings — when frost forms fast, a cold front or a Stillwhite dusk, the petals chime as they grow, and a snowbell slope in a hard frost is an instrument the weather plays once and puts down.',
    byproducts: ['Ice Petal (perishable — melts by the next warm hour unless kept cold)'],
    tamingOrCraftNotes: 'Pick the petal and use it quickly, or keep it cold. A crafting ingredient with a deadline: what it makes must be worth hurrying for.',
    biome: 'Frost (family cast)',
    iconColor: '#bae6fd',
  },
  {
    species: 'grave_vine',
    name: 'Grave Vine',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Flowering from ribs and eye-sockets: a bone-climbing vine of the Grave Roots that roots in root-soil and blooms through the hybrid country\'s skeletons, until a leviathan wears its spine in white flowers by the second spring. Rootwood\'s patience, Bone\'s furniture, one citizen.',
    byproducts: ['Gravevine Flower (dusk-cut)'],
    tamingOrCraftNotes: 'Cut the flowers at dusk; pale, cold-scented — a decoration with a provenance, which builders will pay for long before any recipe claims it.',
    biome: 'Rootwood × Bone (the Grave Roots only)',
    iconColor: '#f1f5f9',
  },
  {
    species: 'saltroot',
    name: 'Saltroot',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Living conduits of crystal: a Glasswood tree whose roots grow saltglass as they grow, threading the soil with glass. An old saltroot\'s root-plate, exposed, is a crystal garden lying in the ground — the flats giving up, and the wood arriving, in the same plant.',
    byproducts: ['Saltroot Glass (fallen root-glass, gathered)'],
    tamingOrCraftNotes: 'Gather what falls: naturally tubed crystal, the far crafters\' piping and lens-blanks. The tree keeps growing its half of the bargain.',
    biome: 'Saltglass × Rootwood (the Glasswood only)',
    iconColor: '#a5f3fc',
  },
  {
    species: 'stormroot',
    name: 'Stormroot',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Grown for the lightning: a low, spired root-shrub whose spires are the Loud Valley\'s own stormcatchers — the zot strikes them first, by design and by appetite, and the charge is stored in root-fruit that glow. The valley outsources its lightning rods to a shrub and eats the batteries.',
    byproducts: ['Storm Fruit (discharged, gathered after the glow fades)'],
    tamingOrCraftNotes: 'Tart, tingling — the loud country\'s provisions. Gather after a storm, when the fruit have spent their bright hour.',
    biome: 'Storm × Living (the Loud Valley only)',
    iconColor: '#fbbf24',
  },
  {
    species: 'bog_lantern',
    name: 'Bog Lantern',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The water\'s edge, lit: a sedge crowned with gel pods of biolume, lit at dusk and dimmed at dawn — the marsh\'s own lanterns, uncounted along the banks. The Lantern Fern lights the woods\' floors; the bog lantern lights the water\'s edge, which is a different country with different travelers.',
    byproducts: ['Bog Light (a whole pod, carefully — a gel lantern that lasts a season)'],
    tamingOrCraftNotes: 'Take a whole pod, carefully. The wet country\'s lamp oil, grown.',
    biome: 'Wetland (the banks)',
    iconColor: '#a3e635',
  },
  {
    species: 'gale_grass',
    name: 'Gale Grass',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The flats\' whole instrument: a grass whose hollow blades are length-sorted by the wind itself, so a gale grass field sings in weather — each stand a chord, the field a slow music the Charged Flats make by existing. Travelers navigate the flats by ear in a blow: the chords are landmarks.',
    byproducts: ['Gale Straw (cut blades)'],
    tamingOrCraftNotes: 'For pipes, calls, and the far craft of instruments — the Storm country\'s first export of music.',
    biome: 'Storm (the Charged Flats)',
    iconColor: '#fde68a',
  },
  {
    species: 'doorstep_rose',
    name: 'Doorstep Rose',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Threshold-true: the valley\'s rose grows at doorways and blooms in proportion to a door\'s use — a kept homestead\'s step flowers, and an abandoned one goes bare within a season. In a Hungry valley, count your doors by the roses — and be concerned by any door that blooms which you did not build.',
    byproducts: ['Vibrant Petal (the valley\'s small change)'],
    tamingOrCraftNotes: 'Pick the petals; the rose keeps its own ledger of your comings and goings, and it has never once been wrong.',
    biome: 'The Living (at doorways)',
    iconColor: '#fb7185',
  },
  {
    species: 'glyph_vine',
    name: 'Glyph Vine',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The gardens\' handwriting, still writing: a vine bred to grow glyph-shaped leaves in sequence along its stems — what it writes has never repeated in recorded watching. The Garden\'s staff tended it as a chronicle; the chronicle continues without them, one letter-leaf at a time.',
    byproducts: ['Glyph Leaf (fallen letter-leaves)'],
    tamingOrCraftNotes: 'Kept as curios, pressed in codexes, traded by chroniclers at rates this entry refuses to stabilize.',
    biome: 'Precursor (the Garden, the ruins\' edges)',
    iconColor: '#a3e635',
  },
  {
    species: 'glowcap',
    name: 'Glowcap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'THE classic glowing cap, at grove scale — the mushroom of the family\'s postcards, gill-lit green, in rings and drifts under the groves. The Glow Grub is an animal that glows; the glowcap is the light the grub evolved inside. The grove\'s ceiling is the ground, lit from below.',
    byproducts: ['Glow Spore (shed spores — never the cap)'],
    tamingOrCraftNotes: 'Gather the shed spores at fruiting, from the air of its rings. The cap itself stays, and lights the next gathering.',
    biome: 'Fungal (the groves)',
    iconColor: '#4ade80',
  },
  {
    species: 'ash_puff',
    name: 'Ash Puff',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A puffball that puffs warm: stepped on or struck, it exhales a breath of heated spore-dust — the Drift\'s small theater, dotting the ash like punctuation. Travelers learn its silhouette the way they learn every Ember lesson: once, warmly.',
    byproducts: ['Ash Puff (unpuffed balls — a hand-warmer that works once, by being squeezed)'],
    tamingOrCraftNotes: 'Gather them unpuffed and squeeze when the cold gets in. The country\'s disposable comfort.',
    biome: 'Ember (the Ashen Drift)',
    iconColor: '#d6d3d1',
  },
];
