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

import type { BiomeId } from '../world/biomes';
import type { WeatherMode } from '../world/zones';
import type { FloraSpecies, ItemId } from '../../types/game';
import { FLORA_CODEX as FLORA_CODEX_ENTRIES } from './floraCodex';

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
  /** Pond gate (pond build, 2026-10-16): grows ONLY in a pond
   *  in the zone (zonePondsAt, water in v1), and only in
   *  landform worlds — the mirror of the fauna pond gate. */
  pond?: boolean;
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
  /** Harvest window (slice 40, 2026-10-16): the crop only holds
   *  together around one hour of the day/night cycle — the glove
   *  refuses outside it, with `closedText` as the honest tell of
   *  what the player is looking at instead. Phase convention is
   *  the game's: 0.5 is noon, 0/1 is midnight; the window runs
   *  ±0.09 of phase (~108 seconds of real time at the ten-minute
   *  rotation). The solvent's propagule reclaim is NOT gated —
   *  spores and stock exist at every hour; only the crop keeps
   *  the appointment. */
  harvestWindow?: { around: 'noon' | 'midnight'; closedText: string };
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
  // chroniclers gather the melt in pots, and the deep
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
  // falls: naturally tubed root-glass — the deep crafters'
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

  // ------------------------------------------------------------------
  // Wave 3 (slice 12, 2026-10-16) — more family casts and margin
  // citizens: clover's quiet signal, the vent's shuttered rose,
  // a travelling fungus, the gardeners' tool-cap, two sisters of
  // ivy in the two clash valleys, and the marsh's second mirror.
  // ------------------------------------------------------------------

  // #71 — the humblest entry on the roster, and load-bearing:
  // clover marks RICH SOIL the way the Driftworm's ridges
  // mark the Stillwhite — a player who can read clover knows
  // where the meadow is keeping its strength. Its harvest is
  // its message: pinched handfuls, feed and compost grade.
  meadow_clover: {
    id: 'meadow_clover',
    name: 'Meadow Clover',
    kind: 'flora',
    harvest: { item: 'basic_compost', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow'],
      count: 5, // ground cover, in sheets
      minRadius: 6,
      spacing: 2,
      scale: 0.6,
    },
  },

  // #73 — a flower with a shutter: rim-rooted at the vents,
  // it OPENS with the heat pulses and closes against the
  // worst of them. Petals cut at the open moment hold heat —
  // the scar's soft material.
  vent_rose: {
    id: 'vent_rose',
    name: 'Vent Rose',
    kind: 'flora',
    harvest: { item: 'vent_petal', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['ember'],
      variant: 'ember_scar', // the vent country IS the Scar (gate corrected in slice 14: 'vent_fields' was a typo — no such variant id; the rose never dealt)
      count: 2,
      minRadius: 10,
      spacing: 4,
      scale: 1,
    },
  },

  // #104 — the travelling kingdom at full strangeness: a
  // gas-bellied cap whose fruiting bodies DRIFT on the storm
  // until they root — the Spore Storm country where Storm
  // air carries Fungal seed. Grounded caps, gathered before
  // they root, are spiced, storm-cured provisions.
  stormcap: {
    id: 'stormcap',
    name: 'Stormcap',
    kind: 'fungus',
    harvest: { item: 'stormcap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm', 'fungal'],
      hybrid: ['storm', 'fungal'],
      count: 3,
      minRadius: 8,
      spacing: 4,
      scale: 1,
    },
  },

  // #147 — the gardeners grew a fungus as a TOOL: brackets
  // flat, dense, tool-hard, that served as anvils, shelves
  // and worktops — the empty Forged cell, filled first. Its
  // bracket is a shelf that is also a seed: the roster's
  // slowest joke, kept.
  anvil_cap: {
    id: 'anvil_cap',
    name: 'Anvil Cap',
    kind: 'fungus',
    harvest: { item: 'anvil_bracket', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #153 — a fern in grown glass: its fronds are lenses in
  // series, light piped crown-to-root, so a glass fern stand
  // glows at ground level in sorted colors. A cut frond is a
  // lens that was grown, not ground — the deep crafters'
  // optics begin here.
  glass_fern: {
    id: 'glass_fern',
    name: 'Glass Fern',
    kind: 'flora',
    harvest: { item: 'glass_frond', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'obsidian_garden',
      count: 2,
      minRadius: 10,
      spacing: 4,
      scale: 1,
    },
  },

  // #169 — the Kiln Gardens' flower: a spiral ember bloom
  // whose petals HOLD HEAT — picked at dusk, hand-warm till
  // dawn. The gardeners bred a flower as a hand-warmer; it
  // has bloomed unattended ever since, in the Ember ×
  // Precursor margin where their kilns stood.
  forge_bloom: {
    id: 'forge_bloom',
    name: 'Forge Bloom',
    kind: 'flora',
    harvest: { item: 'forge_petal', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['ember', 'precursor'],
      hybrid: ['ember', 'precursor'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      scale: 1,
    },
  },

  // #197 — a wall of coals, breathing: ember-veined ivy
  // whose stems carry a slow smolder that never quite
  // flames, in the Burned Valley the fire visited and the
  // family kept. Its leaf holds a coal's warmth for an
  // hour — the traveler's hand-warmer.
  ember_ivy: {
    id: 'ember_ivy',
    name: 'Ember Ivy',
    kind: 'flora',
    harvest: { item: 'ember_leaf', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['ember', 'living'],
      hybrid: ['ember', 'living'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #203 — the Ember Ivy's deliberate sister, in the other
  // clash country: frost-keeping ivy that PRESERVES what it
  // touches under a rime skin — a frost-ivy wall is a
  // gallery of held things. Wrap a provision in its leaf
  // and the provision keeps: the cold graph's refrigerator.
  frost_ivy: {
    id: 'frost_ivy',
    name: 'Frost Ivy',
    kind: 'flora',
    harvest: { item: 'frost_leaf', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['living', 'frost'],
      hybrid: ['living', 'frost'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #215 — the river grows its plants twice: a reed grown in
  // both directions from the waterline, its submerged blooms
  // gathered by the lag-taught — a flower that grew in a
  // reflection, kept for the helmet's sake.
  mirror_reed: {
    id: 'mirror_reed',
    name: 'Mirror Reed',
    kind: 'flora',
    harvest: { item: 'mirror_bloom', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #227 — a down bed that stands up: rime-feathered grass
  // whose blades shimmer in the still cold — the Stillwhite's
  // famous silence is partly this grass not rustling. Its
  // real yield is the field itself; the blades are thatch of
  // the first quality, fiber grade.
  rime_grass: {
    id: 'rime_grass',
    name: 'Rime Grass',
    kind: 'flora',
    harvest: { item: 'soft_fiber', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['frost'],
      count: 4,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #247 — keeping the geysers' schedule in vegetable form:
  // fronds that freeze into serrated ice teeth each night
  // and thaw supple by day, under the Ice Fangs — Spire Bats
  // roost out of its reach, and so should gloves. Shed teeth
  // are the winter country's green ivory; dead matter to the
  // compost grade.
  fang_fern: {
    id: 'fang_fern',
    name: 'Fang Fern',
    kind: 'flora',
    harvest: { item: 'basic_compost', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_fangs', // (gate corrected in slice 14: 'ice_fangs' was a typo — no such variant id; the fern never dealt)
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #333 — the marsh's fungal citizen: a cap whose upper
  // surface is a MIRROR — still, dark, reflective, showing a
  // sky a half-second late, in keeping with the country's
  // terms. The cap is bitter; its yield is the reflection,
  // and the directions. Spores, for the gatherer.
  mirror_cap: {
    id: 'mirror_cap',
    name: 'Mirror Cap',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Wave 4 (slice 14, 2026-10-16) — the fungus bench: the deep
  // roster of caps, puffs, shelves and rafts, mushroom-fashion
  // (most of their items carry the species' own name, as the
  // design writes them). This slice also corrects two wave-3
  // variant gates that were typo'd and never dealt.
  // ------------------------------------------------------------------

  // #37 — a clock made of fungus: it fruits in the DARK, a
  // pale cap by moonlight, sweet-smelling — and by dawn it
  // has melted to a stain. A cap cut at midnight keeps; the
  // day shift gets the smell and the lesson.
  meltcap: {
    id: 'meltcap',
    name: 'Meltcap',
    kind: 'fungus',
    harvest: { item: 'meltcap', count: 1, fertilizedCount: 2 },
    harvestWindow: { around: 'midnight', closedText: 'In this light it is already half meltwater — the cap keeps only at midnight. Come back in the deep of the night.' },
    bonusGrow: {
      biomes: ['fungal'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #77 — the travelling fungus at the surface: a raft of
  // small sail-backed caps that rides wind and pool-current
  // as one slow sailing. Caps pinched from the raft's edge;
  // the raft sails on, diminished and unbothered. (Dealt at
  // the marsh's wet ground in v1 — it anchors where pools
  // gather, like everything in the Mirror country.)
  poolcap: {
    id: 'poolcap',
    name: 'Poolcap',
    kind: 'fungus',
    harvest: { item: 'poolcap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      count: 3,
      minRadius: 8,
      spacing: 4,
      scale: 1,
    },
  },

  // #80 — the material crossover in the kind where it is
  // strangest: a living fungus heart under a rind of the
  // family's glass. The rind pays in SALTGLASS SHARD — the
  // family's one shard, its sixth door, and the first
  // mushroom that pays in glass; the heart beneath is its
  // own item.
  saltcap: {
    id: 'saltcap',
    name: 'Saltcap',
    kind: 'fungus',
    harvest: {
      item: 'saltglass_shard', count: 1, fertilizedCount: 2,
      extras: [['saltcap_heart', 1]],
    },
    bonusGrow: {
      biomes: ['fungal', 'saltglass'],
      hybrid: ['fungal', 'saltglass'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      scale: 1,
    },
  },

  // #196 — dust-fed: it fruits on STORED ORGANICS and old
  // wood inside ruins, and what drifts in the cache chambers
  // is its spore-release — the ruins' dust has an author.
  // Its caps, dried, dust stores against WORSE tenants.
  tomb_cap: {
    id: 'tomb_cap',
    name: 'Tomb Cap',
    kind: 'fungus',
    harvest: { item: 'tomb_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['fungal', 'precursor'],
      hybrid: ['fungal', 'precursor'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #266 — a FAIRY RING made honest: an expanding
  // ring-colony whose circle greens the grass along its
  // front — Meadowbacks graze the ring grass preferentially:
  // a slow circle of the country's best grazing, drawn by a
  // fungus at a hand's width a year. The ring is the yield.
  ring_cap: {
    id: 'ring_cap',
    name: 'Ring Cap',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.8,
    },
  },

  // #270 — the fungus kingdom's gift to travelers: a veiled
  // cap whose partial veil is a spore-proof silk membrane —
  // cut as FILTERS against spore clouds and the deep groves'
  // worst air. The Hollow's mask and bandage in one.
  veil_cap: {
    id: 'veil_cap',
    name: 'Veil Cap',
    kind: 'fungus',
    harvest: { item: 'veil_cloth', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['fungal'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #274 — the kingdom's second crystal citizen: a
  // translucent cap grown through with saltglass, fruiting
  // among the Prism Moss — the moss sorts the noon, the cap
  // STORES it. A whole cap is a natural lamp-shade and lens
  // blank in one careful piece.
  glass_cap: {
    id: 'glass_cap',
    name: 'Glass Cap',
    kind: 'fungus',
    harvest: { item: 'glass_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'saltglass_prism',
      count: 2,
      minRadius: 10,
      spacing: 4,
      scale: 1,
    },
  },

  // #277 — a staircase the fungus built for the animal that
  // uses it: great woody brackets at climbing intervals up
  // the heartroot stands — the Canopy Sloth's resting
  // platforms. Fallen shelves only, by custom: the shelf
  // that is cut is the shelf that ends the staircase.
  heart_shelf: {
    id: 'heart_shelf',
    name: 'Heart Shelf',
    kind: 'fungus',
    harvest: { item: 'soft_fiber', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 12,
      spacing: 6,
      scale: 1.4,
    },
  },

  // #279 — white on white: a puffball of the Bonefields,
  // round and pale as the country's own moons — when it
  // puffs, the fields seem to breathe out, and the Dust Hawk
  // hunts through the white weather as cover. Young puffs
  // are the Bone country's provision, mild as the fields
  // are not.
  bone_puff: {
    id: 'bone_puff',
    name: 'Bone Puff',
    kind: 'fungus',
    harvest: { item: 'bone_puff', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #282 — the broadcaster: a puffball whose puff RIDES THE
  // FRONT — one fruiting body can seed three zones in one
  // storm. The kingdom's two storm strategies: the emigrant
  // (the Stormcap) and the broadcast. Unpuffed, its yield
  // is its range; spores for the gatherer.
  wind_puff: {
    id: 'wind_puff',
    name: 'Wind Puff',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      count: 3,
      minRadius: 8,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #283 — both kingdoms keep the valley's register: the
  // Doorstep Rose signs the threshold in flowers; the door
  // cap signs it in fungus, fruiting on DOORFRAMES. The
  // outside ones are a mild keeper's mushroom; the inside
  // ones are left, with the door shut.
  door_cap: {
    id: 'door_cap',
    name: 'Door Cap',
    kind: 'fungus',
    harvest: { item: 'door_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['living'],
      count: 2,
      minRadius: 9,
      spacing: 5,
      scale: 0.8,
    },
  },

  // #286 — the made world's third living script, and the
  // shortest: a cap whose GILLS form glyph-like patterns at
  // fruiting — the Glyph Vine writes in leaves, the fungus
  // writes in gills, briefly. The cap is food; the PATTERN,
  // copied, is the yield — filed under treasures that are
  // free.
  glyph_cap: {
    id: 'glyph_cap',
    name: 'Glyph Cap',
    kind: 'fungus',
    harvest: { item: 'basic_compost', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Wave 5 (slice 16, 2026-10-16) — the rose bench and deep
  // flora: the design's informal rose census (a rose for every
  // country that would have one), the sky's pond, the banner,
  // the wrong bloom, and the rolling sage.
  // ------------------------------------------------------------------

  // #50 — a POND IN THE SKY: a broad living bowl on the
  // canopy's branches, holding rain for weeks — froglets and
  // skater-kin live in it, a whole wetland the size of a
  // hat. Its water is canopy rain, unhurried: the cleanest
  // drink in the family. The cup refills and does not mind,
  // within reason.
  canopy_cup: {
    id: 'canopy_cup',
    name: 'Canopy Cup',
    kind: 'flora',
    harvest: { item: 'cup_water', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 11,
      spacing: 6,
      scale: 1.3,
    },
  },

  // #60 — it gives its length to the wind: a vine anchored
  // hard in the high rocks, streaming HORIZONTAL in storm
  // weather like a banner — the Storm country's flag, grown.
  // Cut lengths are Banner Fiber, storm-grade: the Storm
  // economy pays in things that hold against wind.
  banner_vine: {
    id: 'banner_vine',
    name: 'Banner Vine',
    kind: 'flora',
    harvest: { item: 'banner_fiber', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1.1,
    },
  },

  // #68 — the Gravebloom's hybrid cousin: a fungus wearing
  // a flower's whole performance — bone-rooted, corpse-pale
  // with a marrow-gold heart, in the Bone × Fungal country.
  // Night-cut petals shake loose Grave Pollen: marrow-gold,
  // sweet, uncanny.
  charnel_bloom: {
    id: 'charnel_bloom',
    name: 'Charnel Bloom',
    kind: 'fungus',
    harvest: { item: 'grave_pollen', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone', 'fungal'],
      hybrid: ['bone', 'fungal'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #91 — same gold core, same eight petals, wound the
  // OTHER way: the Untended's bloom, spiral-REVERSED — the
  // true bloom's mirror in the gardens nobody kept. It
  // yields Wrong Thread, recorded as a NON-material: it
  // spools like Living Thread and UNWINDS in the hand over
  // hours. The item carries the warning in its text.
  wrongbloom: {
    id: 'wrongbloom',
    name: 'Wrongbloom',
    kind: 'flora',
    harvest: { item: 'wrong_thread', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      variant: 'precursor_untended',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #93 — the mode's plant citizen: a sage ball of the Wind
  // Plains that, at season's turn, lets go of its root and
  // becomes its own seed-head — ROLLING, wind-driven. (Dealt
  // rooted, in season, like everything the loop plants.)
  // Slice 45 (2026-10-16): the travels are LIVE — a sage left
  // ripe and unharvested lets go in the flora tick, rolls,
  // sheds Sage Leaf as it goes, and re-roots downwind. A
  // rooted sage yields Sage Leaf, plains herb, storm-cured.
  tumble_sage: {
    id: 'tumble_sage',
    name: 'Tumble Sage',
    kind: 'flora',
    harvest: { item: 'sage_leaf', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow', 'storm'],
      hybrid: ['meadow', 'storm'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #211 — forever at the moment of opening: a river flower
  // blooming INSIDE the amber flow, visible through it at
  // peak — the Sap Rivers are full of perfect flowers
  // arranged by centuries of current like a pressed
  // collection. In the great melt years the river gives up
  // a bloom or two at the banks, whole: treasured, and
  // priced like it (one per harvest, fertilized or not).
  amber_bloom: {
    id: 'amber_bloom',
    name: 'Amber Bloom',
    kind: 'flora',
    harvest: { item: 'amber_bloom', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 11,
      spacing: 6,
      scale: 0.9,
    },
  },

  // #220 — the Wetland's rose, mud-rooted and filtering:
  // its root-mat drinks silt, and the water around a silt
  // rose runs CLEAR in a visible ring — the Stillmouth's
  // garden. Its petal is a water-clarifier: one petal, one
  // clear bucket, an old traveler's trick.
  silt_rose: {
    id: 'silt_rose',
    name: 'Silt Rose',
    kind: 'flora',
    harvest: { item: 'silt_petal', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #221 — it has no green in it at all: a leafless orchid
  // that eats FUNGUS, tapping the mycelium networks like a
  // pale spy at the kingdom's table. Its flowers are
  // gathered ONLY from naturally fallen blooms, by custom
  // older than the codex's manners — the table honors the
  // custom: the harvest is the fallen bloom, never the cut.
  ghost_orchid: {
    id: 'ghost_orchid',
    name: 'Ghost Orchid',
    kind: 'flora',
    harvest: { item: 'ghost_bloom', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['fungal'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #225 — the variant's calendar in a flower: an
  // ice-petaled rose blooming IN MELTWATER for one week of
  // the Thaw, petals holding grown crystal at their rims.
  // A whole bloom in its week stays cold in the hand for a
  // day: the flats' one luxury.
  thaw_rose: {
    id: 'thaw_rose',
    name: 'Thaw Rose',
    kind: 'flora',
    harvest: { item: 'thaw_bloom', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'saltglass_thaw',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #231 — the family's rose, bone-white: it grows ONLY in
  // bone-dust soil, blooms the color of old ivory, with a
  // scent recorded as "the Graveyard, sweetened" — Dust
  // Moths carry its pollen bone to bone. Its petal dyes
  // hold their color in sun: the white fields' one export
  // of softness.
  dust_rose: {
    id: 'dust_rose',
    name: 'Dust Rose',
    kind: 'flora',
    harvest: { item: 'dust_petal', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #258 — the rose census's dark entry: glass-petaled,
  // black, glossy, sharp-edged as the Garden's own soil.
  // (The design entry files it under Ember's telling of the
  // Obsidian Garden; the garden as BUILT belongs to
  // Saltglass, so the rose gates there — a gloved petal is
  // the black work's material, edge and all.)
  obsidian_rose: {
    id: 'obsidian_rose',
    name: 'Obsidian Rose',
    kind: 'flora',
    harvest: { item: 'obsidian_petal', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'obsidian_garden',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #262 — the rose census's KEYSTONE: hedge-built, and
  // planted-by-walking — THIS is the species the Brambleback
  // plants, its seeds passing through the animal and
  // sprouting behind it, in the Hedgewood where Meadow
  // meets Rootwood. Its hips are the hedge country's trail
  // fruit: vitamin-bright, free along every hedge.
  hedge_rose: {
    id: 'hedge_rose',
    name: 'Hedge Rose',
    kind: 'flora',
    harvest: { item: 'hedge_hip', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow', 'rootwood'],
      hybrid: ['meadow', 'rootwood'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // ------------------------------------------------------------------
  // Wave 6 (slice 18, 2026-10-16) — the last flora: the design
  // bench's final twelve. Three are citizens, not crops —
  // the Raincatcher (keep its pools; be rained on), the Arch
  // Tree (a colonnade), the Maw Bloom (a hazard) — and carry
  // harvest: null on purpose.
  // ------------------------------------------------------------------

  // #21 — VAPOR FLORA, the context-ruled cell: a gas-bag
  // canopy over a soft heart, rain-bellied, living on the
  // Skyfall Basin's updrafts and coming down only when heavy
  // with caught rain. It CANNOT be planted or moved — a
  // citizen of one sky. What a player does is keep its pools
  // clean and be rained on gratefully: no harvest, by design.
  raincatcher: {
    id: 'raincatcher',
    name: 'Raincatcher',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['storm'],
      count: 1,
      minRadius: 14,
      spacing: 10,
      scale: 2.2, // large, mostly sky
    },
  },

  // #22 — FORGED FLORA: a garden vine whose tendril ends are
  // SHAPED — pruners, probes, a small lamp — patient,
  // networked to its garden, tasting soil the way the Warden
  // reads intruders. It cannot be transplanted, but it prunes
  // itself of excess and leaves the cuttings stacked neatly
  // where a gardener would: taking them is permitted.
  tending_vine: {
    id: 'tending_vine',
    name: 'Tending Vine',
    kind: 'flora',
    harvest: { item: 'tending_cutting', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #47 — it grows TOWARD dwellings: in a Welcoming valley it
  // puts roots under your doorstep and blooms along your
  // path — the valley's hello at flora scale. In a Hungry
  // valley it is THE SAME PLANT, growing toward dwellings to
  // get IN. Both temperaments, one species, no variant
  // gate — the mirror discipline, planted.
  hearthroot: {
    id: 'hearthroot',
    name: 'Hearthroot',
    kind: 'flora',
    harvest: { item: 'hearth_bloom', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['living'],
      count: 3,
      minRadius: 8,
      spacing: 4,
      scale: 1,
    },
  },

  // #59 — the family's second clock (the Meltcap keeps the
  // night; the Puffbell keeps the HOUR): a spore-laden bell
  // that draws in, swells, and PUFFS a ring of spore-smoke —
  // and in a grove, the bells synchronize within a day. Its
  // spores are its cultivation and its harvest both: stand in
  // a puff, walk to your ground.
  puffbell: {
    id: 'puffbell',
    name: 'Puffbell',
    kind: 'fungus',
    harvest: { item: 'puff_spore', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['fungal'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #70 — grown, not built, in BOTH parents' senses: a tree
  // trained INTO a doorway, trunk split into an arch, canopy
  // braided overhead, standing in spiral colonnades where
  // garden met forest. Infrastructure that GREW — and then
  // grew tenants. A landmark: no harvest, dealt once per
  // country at colonnade scale.
  arch_tree: {
    id: 'arch_tree',
    name: 'Arch Tree',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['precursor', 'rootwood'],
      hybrid: ['precursor', 'rootwood'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      scale: 3.0,
    },
  },

  // #82 — it SMOLDERS: heartwood at a permanent ember, never
  // flame, never out, its canopy a low slow smoke the tree
  // makes of its own leaves and breathes back. The Charwood's
  // stands stand in their own weather. Its cutting keeps the
  // ember: Smolder Heart.
  smoke_tree: {
    id: 'smoke_tree',
    name: 'Smoke Tree',
    kind: 'flora',
    harvest: { item: 'smoke_heart', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['ember', 'rootwood'],
      hybrid: ['ember', 'rootwood'],
      count: 2,
      minRadius: 11,
      spacing: 6,
      scale: 1.8,
    },
  },

  // #90 — GEL FLORA: a light-clear ground-sheet with a
  // leading edge that FLOWS, centimeters a day, toward the
  // Hollow's dim green light (recorded Stationary with the
  // design's own footnote). It eats by lying on things for a
  // season; a cut piece carried in a dark pouch starts a new
  // sheet where it's laid: the sheet IS the harvest.
  lightcreep: {
    id: 'lightcreep',
    name: 'Lightcreep',
    kind: 'flora',
    harvest: { item: 'creep_sheet', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['fungal'],
      count: 2,
      minRadius: 9,
      spacing: 5,
      scale: 1.2,
    },
  },

  // #92 — RADIAL flora, the shape plan's first plant: a star
  // of crystal petals rooted IN strike glass on the Charged
  // Flats — it grows only where lightning has been, so a map
  // of zot stars IS the flats' archive of strikes. At the
  // warning light every star turns its face up at once: the
  // second banner, closer and quieter.
  zot_star: {
    id: 'zot_star',
    name: 'Zot Star',
    kind: 'flora',
    harvest: { item: 'star_glass', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      variant: 'charged_flats',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #140 — the mirror-law, weaponized: Welcoming vines SWAY
  // TOWARD a guest; grabvines hold perfectly STILL, and in
  // the Living Valley stillness is the tell. Its tendrils
  // cross paths at ankle and wrist height, grown there,
  // waiting for the tension of a step. HAZARDOUS. Its
  // tendril cutting is the Hungry valley's dangerous door to
  // the family's own signature material: Living Thread, at
  // risk, once — it is never cultivated twice.
  grabvine: {
    id: 'grabvine',
    name: 'Grabvine',
    kind: 'flora',
    harvest: { item: 'living_thread', count: 1, fertilizedCount: 1 },
    hazardous: true,
    bonusGrow: {
      biomes: ['living'],
      variant: 'hungry_valley',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #141 — the Snap Trap's plan at throne scale: a bloom you
  // could stand in, perfumed WRONG — garden fruit's sweetness
  // in a country with no gardens. THE TELL is the mismatch:
  // in a Hungry valley, a smell that doesn't belong is a
  // mouth. HAZARDOUS. It blooms at the warm hours and is
  // shut, harmless-looking, at night — the codex notes the
  // safe window without smiling. No harvest: never.
  maw_bloom: {
    id: 'maw_bloom',
    name: 'Maw Bloom',
    kind: 'flora',
    harvest: null,
    hazardous: true,
    bonusGrow: {
      biomes: ['living'],
      variant: 'hungry_valley',
      count: 1,
      minRadius: 14,
      spacing: 10,
      scale: 1.6,
    },
  },

  // #148 — the second empty cell, filled with gel: an
  // Underroot-edge fungus whose cap QUIVERS at footsteps,
  // sweats clear beads, and reproduces by dripping —
  // spore-beads in gel skins that roll downhill and root
  // where they stop (Rolling, used without having it). Its
  // gel is alchemy's pet: Quiver Gel, the Gloom Gel's
  // cultivated cousin.
  quiver_cap: {
    id: 'quiver_cap',
    name: 'Quiver Cap',
    kind: 'fungus',
    harvest: { item: 'quiver_gel', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['fungal'],
      count: 2,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #157 — DRIFTING flora's second citizen: a vine whose
  // seed-pods inflate with warm gas at ripeness and LIFT
  // their cuttings clear, to drift the Basin and root where
  // they ground (the Stormcap's mirror across kingdoms). The
  // vine stays; the generation travels. Its pod-gas bladders
  // are the harvest.
  balloon_vine: {
    id: 'balloon_vine',
    name: 'Balloon Vine',
    kind: 'flora',
    harvest: { item: 'pod_bladder', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.2,
    },
  },

  // ------------------------------------------------------------------
  // Wave 7 (slice 19, 2026-10-16) — the meadow bench and the
  // roadsides: clock-headed flowers, upholstered meadows, the
  // bridges' carpet, and the weed that keeps every road in
  // seven families.
  // ------------------------------------------------------------------

  // #217 — it opens for ONE HOUR at true noon, daily, in all
  // weathers, and the meadow keeps the appointment with it.
  // Its seed is the meadow's provisions with a deadline:
  // gathered in the hour or not at all. (The hour-window is
  // behavior; the noon discipline is LIVE (slice 40) —
  // the glove refuses outside the noon window.)
  noonflower: {
    id: 'noonflower',
    name: 'Noonflower',
    kind: 'flora',
    harvest: { item: 'noon_seed', count: 1, fertilizedCount: 2 },
    harvestWindow: { around: 'noon', closedText: 'The head is shut fast — it opens for one hour at true noon, in all weathers, and the meadow keeps the appointment. Come back at midday.' },
    bonusGrow: {
      biomes: ['meadow'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #218 — it grows plush where grazers rest and thin where
  // they don't, so an old meadow is upholstered in a map of
  // every nap ever taken in it. Cut wool-fiber is bedding and
  // bandage grade: the starter economy's soft stuff.
  lambswool: {
    id: 'lambswool',
    name: 'Lambswool',
    kind: 'flora',
    harvest: { item: 'lambswool', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #222 — a fern that FARMS: its fronds catch spores on
  // sticky upper surfaces and cultivate them — each frond a
  // hanging garden of the country's whole fungus census.
  // Frond-clippings with their crop are compost's
  // aristocracy, per the beetles.
  spore_fern: {
    id: 'spore_fern',
    name: 'Spore Fern',
    kind: 'flora',
    harvest: { item: 'basic_compost', count: 2, fertilizedCount: 3 },
    bonusGrow: {
      biomes: ['fungal'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #223 — a living coalwood is a black pillar with a green
  // crown: its outer wood chars as it grows, and its
  // heartwood is PRE-CHARRED. Felled, its timber will not
  // burn, because it already has — the Ember country's gift
  // to every hearth that fears fire. One trunk per felling:
  // timber is slow wealth.
  coalwood: {
    id: 'coalwood',
    name: 'Coalwood',
    kind: 'flora',
    harvest: { item: 'coalwood_timber', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['ember'],
      count: 2,
      minRadius: 11,
      spacing: 6,
      scale: 1.8,
    },
  },

  // #228 — during the long nights it glows in shifting
  // aurora colors, brightest when the sky itself is lit: a
  // vine that answers the sky. Lit tendrils, cut, are Aurora
  // Cord — glowing faintly for a week: the winter country's
  // trail-marker and tent-line.
  aurora_vine: {
    id: 'aurora_vine',
    name: 'Aurora Vine',
    kind: 'flora',
    harvest: { item: 'aurora_cord', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_fangs',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #229 — the root bridges' CARPET: it makes bark walkable,
  // cushions the crossing, and knits small cracks in living
  // wood. NO sanctioned harvest: a crossing stripped of moss
  // is a crossing condemned, and the table leaves the custom
  // exactly there.
  bridge_moss: {
    id: 'bridge_moss',
    name: 'Bridge Moss',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['rootwood'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1.1,
    },
  },

  // #230 — the family's second orchid, the Ghost's bright
  // cousin: an epiphyte of the highest crowns. Its blooms are
  // gathered FALLEN only, from the bridge moss where they
  // land — perfume-grade, like the canopy's own correspondence
  // arriving by post.
  canopy_orchid: {
    id: 'canopy_orchid',
    name: 'Canopy Orchid',
    kind: 'flora',
    harvest: { item: 'canopy_bloom', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #232 — it grows in long lines THROUGH the ribcages,
  // rooting rib to rib, so the Graveyard's skeletons wear
  // green stitching. Its seed-heads are Rib Seed: a hard pale
  // grain, the Bone country's own cereal — marrow-flat bread
  // starts here.
  rib_grass: {
    id: 'rib_grass',
    name: 'Rib Grass',
    kind: 'flora',
    harvest: { item: 'rib_seed', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      variant: 'leviathan_graveyard',
      count: 3,
      minRadius: 9,
      spacing: 3,
      scale: 1,
    },
  },

  // #234 — its seeds are KITES: broad-winged, front-riding,
  // traveling between basins on the same weather that brings
  // the Raincatchers down. Unopened buds are Kite Bud: a
  // storm-tea, tart and bright, brewed across the family for
  // the fronts' long evenings.
  kite_flower: {
    id: 'kite_flower',
    name: 'Kite Flower',
    kind: 'flora',
    harvest: { item: 'kite_bud', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #236 — it OPENS when someone approaches and closes when
  // the path empties — the Guest Bird's floral pair, the
  // valley's manners in a flower. No harvest: its yield is
  // its behavior.
  guest_flower: {
    id: 'guest_flower',
    name: 'Guest Flower',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['living'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #237 — each bed opens at an exact hour, bred into the
  // strain: the gardens were planted as CLOCKS. A Clock Petal's
  // color states its bed's hour: the deep country's timepiece,
  // grown.
  clock_bloom: {
    id: 'clock_bloom',
    name: 'Clock Bloom',
    kind: 'flora',
    harvest: { item: 'clock_petal', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #239 — trample-proof, flowering after the boot lifts: the
  // weed of every path in seven families. Its leaves are a
  // poultice green, the traveler's salve, free at every
  // roadside in the Temperate and Open ranges.
  roadweed: {
    id: 'roadweed',
    name: 'Roadweed',
    kind: 'flora',
    harvest: { item: 'roadweed_leaf', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow', 'rootwood', 'fungal', 'wetland', 'bone', 'storm', 'saltglass'],
      count: 3,
      minRadius: 7,
      spacing: 3,
      scale: 0.8,
    },
  },

  // ------------------------------------------------------------------
  // Wave 8 (slice 21, 2026-10-16) — the fungus bench, first
  // dozen: jellies, rusts, shelves, and hearth caps. Several
  // carry item = species-name harvests (the bench's plain
  // style); two yield readings and warnings instead of goods,
  // and carry harvest: null on purpose.
  // ------------------------------------------------------------------

  // #267 — a jelly fungus on drowned wood: amber, quivering,
  // the Bog Cow's incidental garden (cows surface wearing it
  // after long wades). Gathered jelly is a setting agent for
  // the wet country's kitchens — the Gloom Gel's marsh cousin.
  bog_jelly: {
    id: 'bog_jelly',
    name: 'Bog Jelly',
    kind: 'fungus',
    harvest: { item: 'bog_jelly', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #268 — a rust fungus of the reed stands, orange dust on
  // the stems: a rust year is read by every marsh citizen the
  // way farmers read a sky. NO harvest — its yield is the
  // warning, and the table honors it.
  reed_rust: {
    id: 'reed_rust',
    name: 'Reed Rust',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['wetland'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #273 — a jelly fungus of the salt-crust fissures, fruiting
  // after the Thaw's brine runs: the crust's tenant, paying
  // rent in preserves. Its jelly is brined and clear — the
  // flats' pickle and preserve in one organism.
  salt_jelly: {
    id: 'salt_jelly',
    name: 'Salt Jelly',
    kind: 'fungus',
    harvest: { item: 'salt_jelly', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['saltglass'],
      count: 2,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #276 — a bracket fungus of cliff and ice-side stone,
  // fruiting in pale SHELVES up the Fangs' shaded faces (Spire
  // Bats roost under the big ones). Old shelves are a light,
  // strong bracket: the winter country's tray, sledge-runner,
  // and emergency snowshoe.
  ice_shelf: {
    id: 'ice_shelf',
    name: 'Ice Shelf',
    kind: 'fungus',
    harvest: { item: 'ice_shelf', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_fangs',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #278 — a cup fungus of the root bases, catching DRIP:
  // each cup a small cistern of root-water, kept clean by the
  // cup's own chemistry. The water is the harvest (Cup Water's
  // second door — root-filtered, under a darker sky); the cups
  // themselves are infrastructure, not crops.
  root_cup: {
    id: 'root_cup',
    name: 'Root Cup',
    kind: 'fungus',
    harvest: { item: 'cup_water', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['rootwood'],
      variant: 'rootwood_underroot',
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #280 — a mold colonizing MARROW CAVITIES — the Graveyard's
  // innermost tenant, rendering old marrow to a rich black
  // earth: the Graveyard's soil-maker, gathered from spent
  // bones.
  marrow_mold: {
    id: 'marrow_mold',
    name: 'Marrow Mold',
    kind: 'fungus',
    harvest: { item: 'marrow_earth', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      variant: 'leviathan_graveyard',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #281 — a cap that CRACKLES: it gathers static in charged
  // air, hair standing on its cap before a front — the flats'
  // fungus weather-vane. Gathered, it is a tingling spice for
  // storm-country kitchens, eaten for luck before crossings.
  static_cap: {
    id: 'static_cap',
    name: 'Static Cap',
    kind: 'fungus',
    harvest: { item: 'static_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      variant: 'charged_flats',
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #284 — a cap fruiting in hearth ash, ONLY over good fires
  // (the Hearth Wisp certifies the fire; the fungus seconds
  // the motion). Smoky and sustaining: the roster's most
  // domestic mushroom, the homestead fungus. The gate is
  // LIVE (slice 43): the growth tick holds it at stage 3
  // until a wisp-kept hearthpod stands within 7 m.
  hearth_cap: {
    id: 'hearth_cap',
    name: 'Hearth Cap',
    kind: 'fungus',
    harvest: { item: 'hearth_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['living'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #285 — a BRED cap, fruiting in the garden beds' rows —
  // the Clock Blooms' fungal company, the gardens' kitchen
  // mushroom since the gardeners: mild, reliable, the
  // roster's third plain food fungus.
  bed_cap: {
    id: 'bed_cap',
    name: 'Bed Cap',
    kind: 'fungus',
    harvest: { item: 'bed_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // #287 — a path-side puffball fruiting along trails in
  // seven families (the Roadweed marks the route by surviving
  // it; the Path Puff feeds the walker). Young puffs are
  // roadside provision, free, like the salve: between them a
  // traveler eats and heals at walking pace.
  path_puff: {
    id: 'path_puff',
    name: 'Path Puff',
    kind: 'fungus',
    harvest: { item: 'path_puff', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow', 'rootwood', 'fungal', 'wetland', 'bone', 'storm', 'saltglass'],
      count: 3,
      minRadius: 7,
      spacing: 3,
      scale: 0.8,
    },
  },

  // #288 — a fine mold that grows ON MORNING DEW: a silver
  // film on leaves at dawn, gone by mid-morning. NO harvest —
  // its yield is the reading: a heavy dew-mold morning is the
  // Wet and Temperate ranges' own forecast, in silver.
  dew_mold: {
    id: 'dew_mold',
    name: 'Dew Mold',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['wetland', 'meadow', 'rootwood', 'fungal', 'living', 'precursor'],
      count: 3,
      minRadius: 7,
      spacing: 3,
      scale: 0.8,
    },
  },

  // #289 — a squat cap fruiting in vent ash at the Scar's rim
  // (the Scar Orchid blooms in the steam above it: cap below,
  // orchid above — the Scar's two-storey garden). Peppery,
  // vent-cured: the vent country's seasoning.
  scar_cap: {
    id: 'scar_cap',
    name: 'Scar Cap',
    kind: 'fungus',
    harvest: { item: 'scar_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['ember'],
      variant: 'ember_scar',
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Wave 9 (slice 23, 2026-10-16) — the fungus bench, second
  // dozen: molds that hold countries together, caps that keep
  // weather and music.
  // ------------------------------------------------------------------

  // #290 — a gray mold sheeting the ash in soft patches of
  // the Ashen Drift: where Ashveil grows in felts, the drift
  // mold grows in films — and BINDS the ash against wind.
  // NO harvest: the Drift's skin is not a crop.
  drift_mold: {
    id: 'drift_mold',
    name: 'Drift Mold',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['ember'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 1,
    },
  },

  // #291 — a mold growing ON glass — on the Garden's blooms
  // and shards, filming them green-black while the Shardwing
  // nests above it. (Gated to the garden as built, in
  // Saltglass country; its entry files the garden under
  // Ember's telling — same discrepancy as the Obsidian Rose,
  // same ruling.) Scraped mold is a polishing grit, unlisted:
  // no item.
  glass_mold: {
    id: 'glass_mold',
    name: 'Glass Mold',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'obsidian_garden',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #292 — a cap fruiting in fulgurite fields in the DAYS
  // AFTER a strike: it eats strike-glass grit, so a field's
  // strike caps are its second archive (the Zot Stars keep
  // the first). Gritty, mineral — an acquired taste the flats
  // defend.
  strike_cap: {
    id: 'strike_cap',
    name: 'Strike Cap',
    kind: 'fungus',
    harvest: { item: 'strike_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      variant: 'charged_flats',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #293 — a cap fruiting under dune crests, surfacing after
  // dew nights (the Dune Whale's passages churn its beds up —
  // the dunes' provision is found by following whales).
  // (Gated to the dunes as built, in Saltglass country; its
  // entry files them under Storm's telling — the margin is
  // argued over by both families and farmed by the cap.)
  dune_cap: {
    id: 'dune_cap',
    name: 'Dune Cap',
    kind: 'fungus',
    harvest: { item: 'dune_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'magnetic_dunes',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #294 — a puffball that FILLS WITH UP-RAIN: it drinks the
  // sky's delivery through its skin and swells — a full puff
  // is a water-skin that GREW: the Basin's canteen, disposable
  // and renewable, burst over a cup.
  basin_puff: {
    id: 'basin_puff',
    name: 'Basin Puff',
    kind: 'fungus',
    harvest: { item: 'basin_puff', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #295 — a jelly fruiting in melt pools in the Thaw's brief
  // plenty (the Thaw Rose times the bloom; the jelly times
  // the refreshment). Gathered bare-handed at the melt's
  // edge: the crossing's pause, in jelly form.
  thaw_jelly: {
    id: 'thaw_jelly',
    name: 'Thaw Jelly',
    kind: 'fungus',
    harvest: { item: 'thaw_jelly', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'saltglass_thaw',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #296 — the kingdom's third crystal citizen: a cap whose
  // GILLS are grown saltglass blades. One gill-blade, taken
  // singly, is a Prism Gill: a razor lens of grown glass —
  // the deep opticians' stock, harvested one lens at a time.
  prism_cap: {
    id: 'prism_cap',
    name: 'Prism Cap',
    kind: 'fungus',
    harvest: { item: 'prism_gill', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'saltglass_prism',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #297 — a cap fruiting standing in open snow, unmelting,
  // unsnowed — its cap sheds snow as it falls: the Stillwhite's
  // few punctuation marks, eaten fresh at the snowfield's
  // edge, cold and clean as the country.
  still_cap: {
    id: 'still_cap',
    name: 'Still Cap',
    kind: 'fungus',
    harvest: { item: 'still_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_stillwhite',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #298 — a bracket of the Fang cliffs, shelves rimed like
  // the teeth they grow under — the Spire Bats' SECOND roof.
  // Old shelves are bracket stock, winter grade (the Ice
  // Shelf's cliff cousin).
  fang_shelf: {
    id: 'fang_shelf',
    name: 'Fang Shelf',
    kind: 'fungus',
    harvest: { item: 'fang_shelf', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_fangs',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #299 — a cap fruiting on the lake's shore ice whose
  // hollow stem RESONATES with the ice's singing: a struck
  // shore rings, and the caps answer in their key. NO harvest —
  // the shore's instrument is not cut; it is consulted.
  song_cap: {
    id: 'song_cap',
    name: 'Song Cap',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_singing',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #300 — a tiny cap fruiting on canopy LEAVES, in the high
  // light (the Canopy Orchid grows in the crowns as flora;
  // the cap fruits on the leaves as fungus — the crown keeps
  // both kingdoms). A leaf's worth is the canopy's spice,
  // gathered by climbers.
  canopy_cap: {
    id: 'canopy_cap',
    name: 'Canopy Cap',
    kind: 'fungus',
    harvest: { item: 'canopy_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['rootwood'],
      variant: 'rootwood_canopy',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.8,
    },
  },

  // #301 — a dark cap with GLOWING GILLS — the Glowcap's deep
  // cousin: cap black, light below. The dark country's
  // provision, carried glow-side down in the basket, per
  // custom.
  gloom_cap: {
    id: 'gloom_cap',
    name: 'Gloom Cap',
    kind: 'fungus',
    harvest: { item: 'gloom_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['rootwood'],
      variant: 'rootwood_underroot',
      count: 3,
      minRadius: 8,
      spacing: 3,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Wave 10 (slice 25, 2026-10-16) — the cap bench: the fungus
  // kingdom's kitchens, family by family and margin by margin.
  // ------------------------------------------------------------------

  // #302 — a great bracket of the fallen giant's trunk at the
  // Rootfall (the Fall Orchid perfumes the bear's den from
  // above; the shelf feeds it from the side). Fallen shelves
  // only, unlisted — the fallen-only custom: no item.
  fall_shelf: {
    id: 'fall_shelf',
    name: 'Fall Shelf',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.2,
    },
  },

  // #303 — a cap fruiting ALONG the spiral rows at the Row
  // Moss's spacing: the moss is the Field's ruler, the cap
  // its kitchen — row-abiding, mild, self-organized.
  row_cap: {
    id: 'row_cap',
    name: 'Row Cap',
    kind: 'fungus',
    harvest: { item: 'row_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #304 — the Bed Cap GONE WILD: descended from the gardens'
  // kitchen rows, fruiting now in Untended thickets, doubled
  // in size and halved in manners. The remembered ones are
  // gathered — with the codex's caution on the basket.
  wild_cap: {
    id: 'wild_cap',
    name: 'Wild Cap',
    kind: 'fungus',
    harvest: { item: 'wild_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['precursor'],
      variant: 'precursor_untended',
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1.1,
    },
  },

  // #305 — a cap fruiting in bone dust at the fields' heart:
  // pale, floury — the Bonefields' flour-and-meal in one
  // organism.
  dust_cap: {
    id: 'dust_cap',
    name: 'Dust Cap',
    kind: 'fungus',
    harvest: { item: 'dust_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #306 — a cap fruiting at the pale pools' rims in marrow
  // silt (the Marrow Reed keeps the pools opal; the cap
  // keeps their travelers fed): the Flats' fresh course,
  // eaten at the pools.
  marrow_cap: {
    id: 'marrow_cap',
    name: 'Marrow Cap',
    kind: 'fungus',
    harvest: { item: 'marrow_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #307 — a cap fruiting INSIDE the ribcages, on the shaded
  // bone (the Marrow Mold works the marrow dark; the cap
  // works the shade): the Graveyard's provision, gathered
  // rib by rib, in the spider's off hours, per the ants'
  // advice.
  rib_cap: {
    id: 'rib_cap',
    name: 'Rib Cap',
    kind: 'fungus',
    harvest: { item: 'rib_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      variant: 'leviathan_graveyard',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #308 — a cap fruiting at the scalding pools' rims, in
  // the steam's cool edge (the Scald Fern roots the same
  // rims as flora; the fens keep both kingdoms at table).
  // Eaten hot, by country custom, straight from the rim.
  scald_cap: {
    id: 'scald_cap',
    name: 'Scald Cap',
    kind: 'fungus',
    harvest: { item: 'scald_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland', 'ember'],
      hybrid: ['wetland', 'ember'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #309 — a cap fruiting on the Mulch Beetles' FINISHED
  // compost (the Mulch Rose blooms from the same beds as
  // flora): the Mulchwood's rich course, dark and earthy —
  // the beetles' work, plated.
  compost_cap: {
    id: 'compost_cap',
    name: 'Compost Cap',
    kind: 'fungus',
    harvest: { item: 'compost_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow', 'fungal'],
      hybrid: ['meadow', 'fungal'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #310 — a cap fruiting at the brine pools' rims, salt-
  // rinded: pre-salted by its own life — the Brine Shallows'
  // provision, ready as grown.
  brine_cap: {
    id: 'brine_cap',
    name: 'Brine Cap',
    kind: 'fungus',
    harvest: { item: 'brine_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland', 'saltglass'],
      hybrid: ['wetland', 'saltglass'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #311 — a cap with a metallic sheen, fruiting on slag:
  // it eats the Ashes' waste the way the Ironjaw eats its
  // ore — the Ashes' strong course, with the codex's portion
  // note attached.
  iron_cap: {
    id: 'iron_cap',
    name: 'Iron Cap',
    kind: 'fungus',
    harvest: { item: 'iron_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['ember', 'storm'],
      hybrid: ['ember', 'storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #312 — a cap fruiting at the Hedge Roses' roots, in the
  // hedges' shade: the rose walls have a ground floor, and
  // this is its course — gathered where the hips are
  // gathered, in the same basket.
  hedge_cap: {
    id: 'hedge_cap',
    name: 'Hedge Cap',
    kind: 'fungus',
    harvest: { item: 'hedge_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow', 'rootwood'],
      hybrid: ['meadow', 'rootwood'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #334 — a cap that opens at NOON and closes by two (the
  // Noonflower keeps the meadow's hour in the other kingdom):
  // the pans' brief course, gathered at a run. Its noon
  // window is LIVE (slice 40, 2026-10-16): the glove
  // refuses outside noon, per the harvestWindow field.
  sun_cap: {
    id: 'sun_cap',
    name: 'Sun Cap',
    kind: 'fungus',
    harvest: { item: 'sun_cap', count: 1, fertilizedCount: 2 },
    harvestWindow: { around: 'noon', closedText: 'The cap is shut — it opens at noon and closes by two, and the pans keep the deadline. Come back at the height of the day, at a run.' },
    bonusGrow: {
      biomes: ['meadow', 'saltglass'],
      hybrid: ['meadow', 'saltglass'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Wave 11 (slice 26, 2026-10-16) — the fungus tail: the
  // kingdom's vapor and forged citizens, its night shift, and
  // its largest puff.
  // ------------------------------------------------------------------

  // #314 — the kingdom's second VAPOR citizen: a cap that
  // fruits IN FOG and makes more — its spore-release thickens
  // the Mirror Marsh's banks as it feeds on them. The fog's
  // provision, gathered by feel as much as sight.
  mist_cap: {
    id: 'mist_cap',
    name: 'Mist Cap',
    kind: 'fungus',
    harvest: { item: 'mist_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #315 — the kingdom's second FORGED citizen: a BRED
  // utility cap whose flesh is a springy foam — the gardeners
  // grew it as padding, and its harvest is the padding
  // itself: Tool Foam, cut to shape.
  tool_cap: {
    id: 'tool_cap',
    name: 'Tool Cap',
    kind: 'fungus',
    harvest: { item: 'tool_foam', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['living'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #316 — the kingdom's third VAPOR citizen: a cap that
  // inflates a single SAIL of membrane and rides the Basin's
  // winds away. Never harvested in flight; grounded sails
  // fruit a season where they fall, and the Basin's farmers
  // mark the landings like weather. The yield is the marking:
  // no item.
  sail_cap: {
    id: 'sail_cap',
    name: 'Sail Cap',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #317 — the Temperate night shift: a cap fruiting ONLY at
  // night — up at dusk, down at dawn, in meadow, marsh-edge
  // and grove alike (the Meltcap keeps the fungus kingdom's
  // other night appointment). Its midnight window is bespoke
  // (window LIVE, slice 40: midnight, like Meltcap's). The
  // dark hours' provision, picked by lantern.
  night_cap: {
    id: 'night_cap',
    name: 'Night Cap',
    kind: 'fungus',
    harvest: { item: 'night_cap', count: 1, fertilizedCount: 2 },
    harvestWindow: { around: 'midnight', closedText: 'By day the cap is down and the pantry is shut — it fruits at midnight, picked by lantern. Come back in the dark hours.' },
    bonusGrow: {
      biomes: ['meadow', 'rootwood', 'fungal', 'wetland', 'living'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #318 — a mold that blooms in the HOURS AFTER a front —
  // gray-green films on stone and stem, gone in two days: it
  // is the fronts' footnote, weather's own marginalia. NO
  // harvest: its yield is the record.
  storm_mold: {
    id: 'storm_mold',
    name: 'Storm Mold',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['storm', 'meadow', 'saltglass', 'ember'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #319 — a cap of the shallow dark: the surface's lightless
  // places — Underroot, bridge-undersides, husks, the
  // Graveyard's interiors. Glow-gilled faintly, kin to the
  // Gloom Cap in the next parish of dark.
  dark_cap: {
    id: 'dark_cap',
    name: 'Dark Cap',
    kind: 'fungus',
    harvest: { item: 'dark_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['rootwood', 'bone'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.85,
    },
  },

  // #320 — a cap fruiting INSIDE SKULLS — in the eye-sockets'
  // shade, in the cranium's damp (the Skull Hermit's tenancy
  // law, applied to fungus): gathered from UNOCCUPIED skulls
  // only, per the ants' treaty.
  husk_cap: {
    id: 'husk_cap',
    name: 'Husk Cap',
    kind: 'fungus',
    harvest: { item: 'husk_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      variant: 'leviathan_graveyard',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.85,
    },
  },

  // #321 — a cap fruiting on reef-shell and lakestone at the
  // great lake's waterline: the Deep Reef's shore embassy —
  // lacustrine, mild, the lake's own course, dealt at the
  // Singing Ice's shore.
  shell_cap: {
    id: 'shell_cap',
    name: 'Shell Cap',
    kind: 'fungus',
    harvest: { item: 'shell_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_singing',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #322 — a cap fruiting on the Grass Leviathan's DUNG, in
  // its trail, at HEROIC scale: a single cap feeds a camp —
  // the plains' providence, at walking pace, a week behind
  // the weather that made it. (The leviathan itself waits on
  // the oversize tier; its trail is already generous.)
  trail_cap: {
    id: 'trail_cap',
    name: 'Trail Cap',
    kind: 'fungus',
    harvest: { item: 'trail_cap', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['meadow', 'storm'],
      hybrid: ['meadow', 'storm'],
      count: 1,
      minRadius: 11,
      spacing: 6,
      scale: 1.6,
    },
  },

  // #323 — a honey-tasting cap of the valley groves (the
  // Greeting Cap bows in the hybrid country; the sweet cap
  // is the family's own): the Living's dessert, with the
  // one-bite rule printed on the codex page in the old hand.
  sweet_cap: {
    id: 'sweet_cap',
    name: 'Sweet Cap',
    kind: 'fungus',
    harvest: { item: 'sweet_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['living'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #324 — a puffball at SHEEP SIZE: the deep plains' white
  // dome that the Long Grazers step around. Young ones are a
  // feast fungus, cut in steaks: the plains' celebration
  // course.
  great_puff: {
    id: 'great_puff',
    name: 'Great Puff',
    kind: 'fungus',
    harvest: { item: 'great_puff', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['meadow'],
      count: 1,
      minRadius: 11,
      spacing: 6,
      scale: 2,
    },
  },

  // #326 — a cap of iron-red flesh fruiting on the Ashes'
  // slag (the Iron Cap takes the country's metal as sheen;
  // the rust cap takes it as body): strong, metallic — the
  // smelters' course, portion-noted like its cousin.
  rust_cap: {
    id: 'rust_cap',
    name: 'Rust Cap',
    kind: 'fungus',
    harvest: { item: 'rust_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['ember', 'storm'],
      hybrid: ['ember', 'storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Wave 12 (slice 27, 2026-10-16) — the trees, vines and
  // mosses: the Speaking Wood, the Ossuary Gardens, and the
  // Field's own ruler.
  // ------------------------------------------------------------------

  // #167 — a responsive-leaved tree of the Speaking Wood: its
  // leaves turn toward speakers and settle into reply-shapes.
  // Its fallen reply-leaves are unlisted — the yield is the
  // conversation: no item.
  answer_tree: {
    id: 'answer_tree',
    name: 'Answer Tree',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['rootwood', 'living'],
      hybrid: ['rootwood', 'living'],
      count: 1,
      minRadius: 11,
      spacing: 6,
      scale: 1.8,
    },
  },

  // #168 — the Hungry Groves' cap, mirror-written like its
  // kin: honestly recorded as VARIABLE — in Welcoming-fed
  // groves it is a mild, lemony provision (the Hungering
  // face's reading is the behavior layer's business, as with
  // the Guest Flower's two harvests).
  greeting_cap: {
    id: 'greeting_cap',
    name: 'Greeting Cap',
    kind: 'fungus',
    harvest: { item: 'greeting_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['fungal', 'living'],
      hybrid: ['fungal', 'living'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #201 — a FORGED tree of the Ossuary Gardens — the
  // gardeners kept a bone garden; of course they did. Its
  // fruit is cache-grade treasure that GROWS: sweet, stone-
  // hard, keeping forever — and the Feral Bailiff's patrol is
  // partly an orchard patrol.
  relic_tree: {
    id: 'relic_tree',
    name: 'Relic Tree',
    kind: 'flora',
    harvest: { item: 'relic_fruit', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['bone', 'precursor'],
      hybrid: ['bone', 'precursor'],
      count: 1,
      minRadius: 11,
      spacing: 6,
      scale: 1.7,
    },
  },

  // #264 — an iron-hearted tree of the Ashes: dark, dense,
  // iron-veined wood from the slag soil. Fallen limbs are the
  // Ashes' beam-stock — what deep builders make sills of,
  // because it neither burns nor rots at polite speeds.
  ironwood: {
    id: 'ironwood',
    name: 'Ironwood',
    kind: 'flora',
    harvest: { item: 'ironwood', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['ember', 'storm'],
      hybrid: ['ember', 'storm'],
      count: 1,
      minRadius: 11,
      spacing: 6,
      scale: 1.7,
    },
  },

  // #198 — a glass-leaved vine of the Bright Valley: the
  // Glass Fern's economy at vine scale — shed glass leaves at
  // lens grade, unlisted: the valley's floor glitters with
  // its leavings, and the leavings are not an item.
  glare_vine: {
    id: 'glare_vine',
    name: 'Glare Vine',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['saltglass', 'living'],
      hybrid: ['saltglass', 'living'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #200 — a vine of the Hungry Graveyard, where the
  // valley's edge grew over the old fields — mirror-written:
  // in Welcoming years its flowers are pale, honeyed Marrow
  // Blooms (temperament-year gating is bespoke; v1 deals the
  // bloom honestly).
  marrow_vine: {
    id: 'marrow_vine',
    name: 'Marrow Vine',
    kind: 'flora',
    harvest: { item: 'marrow_bloom', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone', 'living'],
      hybrid: ['bone', 'living'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #252 — the Field's ruler: a spiral-true moss that grows
  // ONLY along the spiral rows, in the Tender's own measure —
  // the Row Caps fruit at its spacing because the moss laid
  // the table. NO harvest: you do not eat the ruler.
  row_moss: {
    id: 'row_moss',
    name: 'Row Moss',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['precursor'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #246 — a light-sorting moss of the Prism Beds: a living
  // film that breaks noon into color patches on the ground.
  // NO harvest — the Beds' color is a citizen, not a crop.
  prism_moss: {
    id: 'prism_moss',
    name: 'Prism Moss',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['saltglass'],
      variant: 'saltglass_prism',
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #248 — a gloom-lit fern of the Underroot: it glows a dim
  // teal in the dark, the understory's own lighting. A frond
  // is a week's dim light, carried: the Underroot's lantern
  // for those without one.
  gloam_fern: {
    id: 'gloam_fern',
    name: 'Gloam Fern',
    kind: 'flora',
    harvest: { item: 'gloam_frond', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['rootwood'],
      variant: 'rootwood_underroot',
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #181 — a two-leaved fern of the Thirsty Marsh's edges:
  // AIR leaves above (lacy, ordinary) and WATER ribbons below
  // — cut in flood season, the ribbons are a silky aquatic
  // fiber: the wet country's weaving starts here.
  flood_fern: {
    id: 'flood_fern',
    name: 'Flood Fern',
    kind: 'flora',
    harvest: { item: 'flood_ribbon', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #204 — a FORGED bloom of the Frozen Gardens, where a
  // garden country met the steady cold and the cold won
  // politely: a thaw-year bloom, cut in its brief opening —
  // a flower that waited a hundred years for one afternoon.
  ice_bloom: {
    id: 'ice_bloom',
    name: 'Ice Bloom',
    kind: 'flora',
    harvest: { item: 'ice_bloom', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['precursor', 'frost'],
      hybrid: ['precursor', 'frost'],
      count: 1,
      minRadius: 11,
      spacing: 6,
      scale: 0.9,
    },
  },

  // #216 — a bell-flowered bank plant of the Mirror Rivers,
  // tripwire-tuned: its bells answer water — a ripple rings
  // the bank's bells in sequence. Cut bells keep the tuning:
  // what the deep crafters string them for is their business.
  ripple_bell: {
    id: 'ripple_bell',
    name: 'Ripple Bell',
    kind: 'flora',
    harvest: { item: 'ripple_bell', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Wave 13 (slice 28, 2026-10-16) — the orchids, reeds and
  // candles: vent rims, bridge undersides, and the white
  // country's first green.
  // ------------------------------------------------------------------

  // #240 — a tall white candle-flower of the warm and
  // temperate ranges: its thick petals render a clean-burning
  // wax — the deep country's candle, grown. The bloom opens at
  // midnight (window LIVE, slice 40, like its kin); the
  // glove refuses outside it.
  night_candle: {
    id: 'night_candle',
    name: 'Night Candle',
    kind: 'flora',
    harvest: { item: 'night_wax', count: 1, fertilizedCount: 2 },
    harvestWindow: { around: 'midnight', closedText: 'By day it is only a promise — the candle blooms at midnight, and the wax renders from the bloom. Come back in the dark.' },
    bonusGrow: {
      biomes: ['ember', 'meadow', 'storm', 'living'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #241 — a vent-rimmed orchid of the Ember Scar: it grows
  // on the Scar's vent rims, in the steam's edge. Fallen
  // blooms are steam-cured, smoke-sweet — the vent country's
  // small luxury (fallen-only custom).
  scar_orchid: {
    id: 'scar_orchid',
    name: 'Scar Orchid',
    kind: 'flora',
    harvest: { item: 'scar_bloom', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['ember'],
      variant: 'ember_scar',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.85,
    },
  },

  // #242 — a felt-mat ground cover of the Ashen Drift: gray
  // sheets over the ash fields, the Drift Mold's partner in
  // the other kingdom (together they hold the Drift down).
  // Cut felt is unlisted — insulation and wrapping grade, the
  // Drift's gray harvest: no item.
  ashveil: {
    id: 'ashveil',
    name: 'Ashveil',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['ember'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #243 — a charge-tuned reed of the Charged Flats: its
  // hollow stems ring faintly as charge gathers — the flats'
  // early warning, in grass form. Cut stems are Chime Straw,
  // for pipes and calls: the Gale Straw's flats cousin.
  chime_reed: {
    id: 'chime_reed',
    name: 'Chime Reed',
    kind: 'flora',
    harvest: { item: 'chime_straw', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['storm'],
      variant: 'charged_flats',
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #245 — an up-rain blooming lily of Skyfall Basin: it
  // opens its cups to the falling UP-rain and drinks from
  // below the sky. Cup-water and petals are unlisted — the
  // Basin's refreshment stand, self-filling: the yield is
  // standing there thirsty and leaving otherwise.
  sky_lily: {
    id: 'sky_lily',
    name: 'Sky Lily',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #249 — a giant-fed orchid of the Rootfall: it grows ONLY
  // on the fallen giant's bark, in the rot-rich shade (the
  // Fall Shelf brackets the same trunk below it). Fallen
  // blooms are perfume grade, unlisted — the fallen-only
  // custom: no item.
  fall_orchid: {
    id: 'fall_orchid',
    name: 'Fall Orchid',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #250 — a small hanging flower of the bridges, underside-
  // true: it blooms on the bridges' UNDERSIDES, in the shade
  // over the water. NO harvest — the view from below IS the
  // yield; its entry protects it in those words.
  deck_flower: {
    id: 'deck_flower',
    name: 'Deck Flower',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['rootwood'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.8,
    },
  },

  // #251 — the rose census's wild entry: a FORGED, garden-
  // bred rose gone unruled in the Untended. A cutting, if you
  // can take one — planted at a homestead it reverts, in a
  // generation, to a garden rose (the cutting ships as an
  // item; planting is the deferred system, as with the
  // Bramble Seed).
  feral_rose: {
    id: 'feral_rose',
    name: 'Feral Rose',
    kind: 'flora',
    harvest: { item: 'feral_cutting', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['precursor'],
      variant: 'precursor_untended',
      count: 1,
      minRadius: 11,
      spacing: 6,
      scale: 1,
    },
  },

  // #253 — a meal-fed orchid of the Bonefields: it roots in
  // bone-meal soil and blooms ivory-white at the fields'
  // heart. Its blooms are carved-looking, scentless — kept
  // for the deep country's white work.
  bone_orchid: {
    id: 'bone_orchid',
    name: 'Bone Orchid',
    kind: 'flora',
    harvest: { item: 'bone_bloom', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // #254 — a pool-keeping reed of the Marrow Flats: it stands
  // in the Flats' pale pools and filters them opal (the
  // Marrow Cap eats at the same pools). Its reed-down is
  // unlisted — the Flats' soft stuff, stuffing grade: no item.
  marrow_reed: {
    id: 'marrow_reed',
    name: 'Marrow Reed',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['bone'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #255 — a rib-shadowed sedge of the Graveyard: it grows in
  // the ribs' long shadows and nowhere else in the sun. Its
  // seeds are unlisted — ant-grade grain, and the ants'
  // opinion is the entry's only review: no item.
  pale_sedge: {
    id: 'pale_sedge',
    name: 'Pale Sedge',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['bone'],
      variant: 'leviathan_graveyard',
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #257 — a snow-blooming cress of the Stillwhite: it
  // flowers THROUGH the snowpack, tiny white bells above the
  // white — the white country's first green, unlisted
  // because it is a sign, not a crop: no item.
  snow_cress: {
    id: 'snow_cress',
    name: 'Snow Cress',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['frost'],
      variant: 'frost_stillwhite',
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.8,
    },
  },

  // ------------------------------------------------------------------
  // Wave 14 (slice 29, 2026-10-16) — THE FINAL flora wave: the
  // roses' last cousins, the molds that inherit countries, and
  // the clash margin's one address. With this wave the land
  // roster is complete; what remains is gated (landscape
  // flora, the pond group, the oversize tier).
  // ------------------------------------------------------------------

  // #259 — a heat-rooted fern of the Scalding Fens: it grows
  // in the scalding shallows themselves (the Scald Cap rims
  // the same pools as fungus; the fens keep both kingdoms in
  // the water). Its fronds are a poultice that arrives warm:
  // the Fens' medicine, self-heating.
  scald_fern: {
    id: 'scald_fern',
    name: 'Scald Fern',
    kind: 'flora',
    harvest: { item: 'scald_frond', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland', 'ember'],
      hybrid: ['wetland', 'ember'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #260 — the rose census's rich entry: a compost-crowned
  // rose of the Mulchwood, blooming on the beetles' finished
  // beds (the Compost Cap plates the same work in the other
  // kingdom). Its petals, dried, are the wood's potpourri
  // and preservative both.
  mulch_rose: {
    id: 'mulch_rose',
    name: 'Mulch Rose',
    kind: 'flora',
    harvest: { item: 'mulch_petal', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['meadow', 'fungal'],
      hybrid: ['meadow', 'fungal'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #261 — the rose census's salt entry: a tide-timed rose of
  // the Brine Shallows — a bloom at low tide is a salt-rose,
  // the Shallows' seasoning and souvenir in one.
  brine_rose: {
    id: 'brine_rose',
    name: 'Brine Rose',
    kind: 'flora',
    harvest: { item: 'brine_bloom', count: 1, fertilizedCount: 1 },
    bonusGrow: {
      biomes: ['wetland', 'saltglass'],
      hybrid: ['wetland', 'saltglass'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #263 — an ice-cored reed of the Cold Marsh: its stems
  // grow a core of clear ice through the winter. Spring stems
  // are unlisted — flute-grade hollow, the cold country's
  // small music, cousin to the chime straws: no item.
  frost_reed: {
    id: 'frost_reed',
    name: 'Frost Reed',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['wetland', 'frost'],
      hybrid: ['wetland', 'frost'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #327 — a bracket of the Frozen Forest's trunks, shelving
  // under rime (the Rime Owl's hunting perch keeps the same
  // shelves). Fallen shelves are unlisted — the fallen-only
  // custom, in its third parish: no item.
  snow_shelf: {
    id: 'snow_shelf',
    name: 'Snow Shelf',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['frost', 'rootwood'],
      hybrid: ['frost', 'rootwood'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #328 — a glow-gilled cap fruiting on the Poolcap's raft-
  // edges and the pools' own logs in the sump pools (the
  // Sumpfish keeps the same water from below — pond-locked,
  // and the cap keeps its table meanwhile): the pools' fresh
  // course, gathered by their own light.
  sump_cap: {
    id: 'sump_cap',
    name: 'Sump Cap',
    kind: 'fungus',
    harvest: { item: 'sump_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland', 'fungal'],
      hybrid: ['wetland', 'fungal'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 0.9,
    },
  },

  // #329 — a puffball of the charnel groves, gray and
  // deliberate (the Charnel Bloom impersonates a fungus
  // uphill; this one is the genuine article, keeping the
  // groves' provision plain as its name).
  grave_puff: {
    id: 'grave_puff',
    name: 'Grave Puff',
    kind: 'fungus',
    harvest: { item: 'grave_puff', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['bone', 'fungal'],
      hybrid: ['bone', 'fungal'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1,
    },
  },

  // #330 — a crystalline-edged mold filming the salt crust
  // after brine runs (where the Salt Jelly takes the cracks,
  // the mold takes the surface). NO harvest — it armors the
  // crust against wind; the flats' skin is not a crop.
  salt_mold: {
    id: 'salt_mold',
    name: 'Salt Mold',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['saltglass', 'meadow', 'storm', 'ember'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #331 — the Ember country's general mold: on ash wood, on
  // old burns, on the Drift's leavings (the Drift Mold is its
  // specialist cousin, binding one drift; this one succeeds
  // everywhere warm). NO harvest — its yield is succession
  // itself.
  ash_mold: {
    id: 'ash_mold',
    name: 'Ash Mold',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['ember', 'meadow', 'storm', 'saltglass'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #332 — a broad, flat cap of the crowns, used by canopy
  // birds as a NEST BASE: they line it, lay in it, and the
  // cap fruits around the tenancy. NO harvest while nested,
  // ever; abandoned caps are unlisted, fallen-only, by the
  // forest's whole custom: no item.
  nest_cap: {
    id: 'nest_cap',
    name: 'Nest Cap',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['rootwood'],
      variant: 'rootwood_canopy',
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 1.1,
    },
  },

  // #335 — a mold lining the SUBNIVEAN world: the Frost
  // Vole's tunnels are furred with it — it eats the tunnel
  // air's damp and returns heat, the vole's furnace, inherited
  // tunnel by tunnel. NO harvest: a furnace is not gathered.
  frost_mold: {
    id: 'frost_mold',
    name: 'Frost Mold',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['frost', 'rootwood', 'bone', 'wetland'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      scale: 1,
    },
  },

  // #336 — a cap fruiting on the Steam Eel's channel banks,
  // in the vapor where ice meets near-boiling water: the
  // clash margin's table, set in steam. Scalded-clean, eaten
  // at the bank, in the steam, by travelers who have learned
  // the margin's one address.
  steam_cap: {
    id: 'steam_cap',
    name: 'Steam Cap',
    kind: 'fungus',
    harvest: { item: 'steam_cap', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['ember', 'frost'],
      hybrid: ['ember', 'frost'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      scale: 0.9,
    },
  },

  // ------------------------------------------------------------------
  // Slice 31 (2026-10-16) — THE LANDSCAPE FLORA TRIO. LANDSCAPE
  // on the plant side: presences, not crops — harvest null for
  // all three, one per zone, at the table's maximum scale.
  // ------------------------------------------------------------------

  // #184 — the Living family's heart, at the word's scale: a
  // single tree whose canopy is a micro-biome with its own
  // weather and its own citizens — Guest Birds nest in it
  // that have never touched the valley's floor. It is where
  // the Welcoming/Hungry split is DECIDED, season by season —
  // the family's deepest open hook, recorded here as the
  // design leaves it: deliberately open, distant-future lore.
  valley_heart: {
    id: 'valley_heart',
    name: 'Valley Heart',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['living'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      scale: 3.2,
    },
  },

  // #185 — LANDSCAPE by area: not one fruiting body but ONE
  // ORGANISM — a single mycelium miles across, of which the
  // groves are fingers. The Spore Stag walks on it; the
  // Meltcap fields and Puffbell plantings are its local
  // clocks, synchronized by being, literally, one body. You
  // do not harvest the organism — its fingers are the rest of
  // the fungal table. Dealt as one grove-cluster presence.
  mother_grove: {
    id: 'mother_grove',
    name: 'Mother Grove',
    kind: 'fungus',
    harvest: null,
    bonusGrow: {
      biomes: ['fungal'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      scale: 3.0,
    },
  },

  // #187 — LANDSCAPE, stationary for the family's whole
  // memory: a single tree whose canopy is a zone's ceiling,
  // standing while its giant sibling lies fallen beside its
  // country — the Deck Weavers' bridges are built in the
  // standing one's foothills, and canopy sloths that never
  // descend live whole lives in it (the sloth entry's
  // "never" gets its one exception, here).
  first_tree: {
    id: 'first_tree',
    name: 'First Tree',
    kind: 'flora',
    harvest: null,
    bonusGrow: {
      biomes: ['rootwood'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      scale: 3.2,
    },
  },
  // Lake Jelly (pond build, 2026-10-16) — the kingdom's
  // second gel citizen: a gel FUNGUS fruiting on the Deep
  // Reef's structures in the great ponds' black water (the
  // reef builds the city; the jelly lights its windows —
  // faintly, greenly). Harvest: Lake Jelly, the deep's own
  // gel, the Gloom Gel's abyssal grade. POND-gated, like the
  // citizens it lights for.
  lake_jelly: {
    id: 'lake_jelly',
    name: 'Lake Jelly',
    kind: 'fungus',
    harvest: { item: 'lake_jelly', count: 1, fertilizedCount: 2 },
    bonusGrow: {
      biomes: ['wetland', 'frost'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 6,
      scale: 1.2,
    },
  },

  // ------------------------------------------------------------------
  // THE DEALT-ELSEWHERE TWENTY-FIVE (gap fix, 2026-10-16)
  // ------------------------------------------------------------------
  // These species reach the world by their OWN routes — the
  // starter census, worldGen's hand-placed variant dressing, and
  // the cave interiors — and for years they were the only dealt
  // flora with NO row in this table: anything that names flora
  // from the table fell back to the raw id and printed things
  // like "Lantern_fern" (the gap the dynamic-quest lab tripped
  // over). The rows below close the class: name + harvest live
  // here like every other species. Harvest values mirror the
  // tool hook's legacy switch VERBATIM (computeHarvestYields
  // reads the table first; the switch remains only as the
  // default fallback), and bonusGrow is null BY DESIGN — these
  // are dealt by their routes and must never be double-dealt by
  // the generic bonus loop (which skips null specs outright).
  // ------------------------------------------------------------------

  // The starter census five (worldGen FLORA_CENSUS).
  lantern_fern: {
    id: 'lantern_fern',
    name: 'Lantern Fern',
    kind: 'flora',
    harvest: { item: 'soft_fiber', count: 2, fertilizedCount: 5, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  bell_bloom: {
    id: 'bell_bloom',
    name: 'Bell-Bloom',
    kind: 'flora',
    harvest: { item: 'dew_essence', count: 2, fertilizedCount: 4, extras: [['soft_fiber', 1]] },
    bonusGrow: null,
  },
  petal_mill: {
    id: 'petal_mill',
    name: 'Petal-Mill',
    kind: 'flora',
    harvest: { item: 'vibrant_petal', count: 3, fertilizedCount: 6, extras: [['sweet_nectar', 2]] },
    bonusGrow: null,
  },
  sap_weaver: {
    id: 'sap_weaver',
    name: 'Sap-Weaver',
    kind: 'flora',
    harvest: { item: 'resin_sap', count: 3, fertilizedCount: 6 },
    bonusGrow: null,
  },
  snap_trap: {
    id: 'snap_trap',
    name: 'Chittering Snap-Trap',
    kind: 'flora',
    harvest: { item: 'carapace_scale', count: 1, fertilizedCount: 1 },
    hazardous: true,
    bonusGrow: null,
  },

  // The variant-dressing set (worldGen's hand-placed blocks).
  antenna_shroom: {
    id: 'antenna_shroom',
    name: 'Antenna Shroom',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 2, fertilizedCount: 4, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  visor_shroom: {
    id: 'visor_shroom',
    name: 'Visor Shroom',
    kind: 'fungus',
    harvest: { item: 'basic_compost', count: 2, fertilizedCount: 3, extras: [['glow_spore', 1]] },
    bonusGrow: null,
  },
  shelf_shroom: {
    id: 'shelf_shroom',
    name: 'Shelf Shroom',
    kind: 'fungus',
    harvest: { item: 'soft_fiber', count: 2, fertilizedCount: 4, extras: [['basic_compost', 1]] },
    bonusGrow: null,
  },
  glow_fungus: {
    id: 'glow_fungus',
    name: 'Glow Fungus',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 2, fertilizedCount: 4, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  glow_spore_cluster: {
    id: 'glow_spore_cluster',
    name: 'Glow Spore Cluster',
    kind: 'fungus',
    harvest: { item: 'glow_spore', count: 2, fertilizedCount: 4, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  echo_reed: {
    id: 'echo_reed',
    name: 'Echo Reed',
    kind: 'flora',
    harvest: { item: 'resonant_reed', count: 2, fertilizedCount: 4, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  cinder_bloom: {
    id: 'cinder_bloom',
    name: 'Cinder Bloom',
    kind: 'flora',
    harvest: { item: 'resin_sap', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  obsidian_bloom: {
    id: 'obsidian_bloom',
    name: 'Obsidian Bloom',
    kind: 'flora',
    harvest: { item: 'obsidian_shard', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  prism_reed: {
    id: 'prism_reed',
    name: 'Prism Reed',
    kind: 'flora',
    harvest: { item: 'saltglass_shard', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  rime_spire: {
    id: 'rime_spire',
    name: 'Rime Spire',
    kind: 'flora',
    harvest: { item: 'nevermelt_ice', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  heartroot: {
    id: 'heartroot',
    name: 'Heartroot',
    kind: 'flora',
    harvest: { item: 'heartwood', count: 2, fertilizedCount: 3, extras: [['soft_fiber', 1]] },
    bonusGrow: null,
  },
  dusk_grass: {
    id: 'dusk_grass',
    name: 'Duskgrass',
    kind: 'flora',
    harvest: { item: 'soft_fiber', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  heartbloom: {
    id: 'heartbloom',
    name: 'Heartbloom',
    kind: 'flora',
    harvest: { item: 'heart_sap', count: 1, fertilizedCount: 2, extras: [['dew_essence', 2]] },
    bonusGrow: null,
  },
  stormcatcher: {
    id: 'stormcatcher',
    name: 'Stormcatcher',
    kind: 'flora',
    harvest: { item: 'fulgurite_shard', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  gravebloom: {
    id: 'gravebloom',
    name: 'Gravebloom',
    kind: 'flora',
    harvest: { item: 'bone_meal', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  precursor_bloom: {
    id: 'precursor_bloom',
    name: 'Precursor Bloom',
    kind: 'flora',
    harvest: { item: 'living_thread', count: 2, fertilizedCount: 3, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  mirror_lily: {
    id: 'mirror_lily',
    name: 'Mirror Lily',
    kind: 'flora',
    harvest: { item: 'dew_essence', count: 3, fertilizedCount: 5, extras: [['resonant_reed', 1]] },
    bonusGrow: null,
  },

  // The cave set (dealt by the interiors, not the surface census).
  bounce_shroom: {
    id: 'bounce_shroom',
    name: 'Bounce-Shroom',
    kind: 'fungus',
    harvest: { item: 'seed_bounce_shroom', count: 1, fertilizedCount: 2, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  sunshard_cluster: {
    id: 'sunshard_cluster',
    name: 'Sunshard Cluster',
    kind: 'flora',
    harvest: { item: 'sunshard', count: 2, fertilizedCount: 4, extras: [['dew_essence', 1]] },
    bonusGrow: null,
  },
  prism_cluster: {
    id: 'prism_cluster',
    name: 'Prism Cluster',
    kind: 'flora',
    harvest: { item: 'prismatic_core', count: 1, fertilizedCount: 2 },
    bonusGrow: null,
  },
};

/** Table lookup by species id (the hook + worldGen read here). */
export function floraDef(id: FloraSpecies): FloraDef | undefined {
  return FLORA[id];
}

/** Every table species that grows via the generic bonus loop. */
export const BONUS_GROW_FLORA: FloraDef[] = Object.values(FLORA).filter((d) => d.bonusGrow !== null);

// The flora codex lives in floraCodex.ts (slice 21 extraction —
// this file crossed the single-push cap); re-exported here so
// existing consumers keep importing FLORA_CODEX from './flora'.
export const FLORA_CODEX = FLORA_CODEX_ENTRIES;
