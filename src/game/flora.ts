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
  // lens that was grown, not ground — the far crafters'
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
  // Wave 5 (slice 16, 2026-10-16) — the rose bench and far
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
  // rooted, in season, like everything the loop plants; its
  // travels are its own affair.) A rooted sage yields Sage
  // Leaf, plains herb, storm-cured.
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
};

/** Table lookup by species id (the hook + worldGen read here). */
export function floraDef(id: FloraSpecies): FloraDef | undefined {
  return FLORA[id];
}

/** Every table species that grows via the generic bonus loop. */
export const BONUS_GROW_FLORA: FloraDef[] = Object.values(FLORA).filter((d) => d.bonusGrow !== null);

// ---------------------------------------------------------------------------
// Codex entries (waves 1–6 — the complete flora roster). They live
// HERE, with the flora table, rather
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
  {
    species: 'meadow_clover',
    name: 'Meadow Clover',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The humblest entry on the roster, and load-bearing: clover marks RICH SOIL the way the Driftworm\'s ridges mark the Stillwhite — a player who can read clover knows where the meadow is keeping its strength, and plans the garden accordingly. Its harvest is its message: pinched handfuls, feed and compost grade, and the field left richer for being read.',
    byproducts: ['Basic Compost (pinched handfuls)'],
    tamingOrCraftNotes: 'Gather handfuls for feed and compost — and read the sheet first: where clover spreads thick, the soil is telling you something.',
    biome: 'Meadow (family cast)',
    iconColor: '#22c55e',
  },
  {
    species: 'vent_rose',
    name: 'Vent Rose',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A flower with a shutter: rim-rooted at the vents, it opens with the heat pulses and closes against the worst of them, petal-scaled and pulse-timed — the scar\'s metronome, blooming on the vent\'s breathing. Cut at the open moment, its petals hold the heat they opened to.',
    byproducts: ['Vent Petal (cut at the open moment)'],
    tamingOrCraftNotes: 'Harvest with the glove for heat-holding petal-scale. Timing is the whole craft: an open rose gives, a closed one waits.',
    biome: 'Ember (the Vent Fields)',
    iconColor: '#f43f5e',
  },
  {
    species: 'stormcap',
    name: 'Stormcap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The travelling kingdom at full strangeness: a gas-bellied cap on a stalk, stationary as a mycelium — and drifting as a fruiting body, until it lands and roots wherever the storm sets it down. In the Spore Storm country, where Storm air carries Fungal seed, a stormcap on the wind is the margin country\'s mail.',
    byproducts: ['Stormcap (grounded caps, gathered before they root)'],
    tamingOrCraftNotes: 'Gather the grounded caps — spiced, storm-cured, the far country\'s provisions. A rooted one has already arrived; leave it to its address.',
    biome: 'Storm × Fungal (the Spore Storm country only)',
    iconColor: '#a78bfa',
  },
  {
    species: 'anvil_cap',
    name: 'Anvil Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The gardeners grew a fungus as a TOOL: fruiting brackets — flat, dense, tool-hard — that served the gardens as anvils, shelves, and worktops, social in rows where a row of work was wanted. The Tenders\' furniture, still fruiting in their fields: the empty Forged cell of the living graph, filled first, as the pass\'s thesis.',
    byproducts: ['Anvil Bracket'],
    tamingOrCraftNotes: 'Harvest with the glove. A bracket is a shelf that is also a seed: mounted and given years and damp, it may fruit — the roster\'s slowest joke, kept.',
    biome: 'Precursor (the gardeners\' country)',
    iconColor: '#78716c',
  },
  {
    species: 'glass_fern',
    name: 'Glass Fern',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A fern in grown glass: fronds that are lenses in series, piping light from crown to root, so a glass fern stand glows at ground level in sorted colors — the Obsidian Garden lit from inside its own plants. Where the Saltglass country grows its garden, the garden does the lighting.',
    byproducts: ['Glass Frond (a cut frond)'],
    tamingOrCraftNotes: 'Harvest with the glove — a lens that was grown, not ground. The far crafters\' optics begin here.',
    biome: 'Saltglass (the Obsidian Garden)',
    iconColor: '#67e8f9',
  },
  {
    species: 'forge_bloom',
    name: 'Forge Bloom',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The Kiln Gardens\' flower: a spiral-bedded ember bloom whose warm petals HOLD HEAT — picked at dusk, hand-warm till dawn. The gardeners bred a flower as a hand-warmer, and it has bloomed unattended ever since in the margin where their kilns stood, keeping the shift they left.',
    byproducts: ['Forge Petal'],
    tamingOrCraftNotes: 'Harvest with the glove at dusk for a petal that keeps warmth — pockets, gloves, and winter camps across the cold graph will pay for this flower.',
    biome: 'Ember × Precursor (the Kiln Gardens only)',
    iconColor: '#fb923c',
  },
  {
    species: 'ember_ivy',
    name: 'Ember Ivy',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A wall of coals, breathing: ember-veined ivy whose stems carry a slow smolder that never quite flames, climbing the Burned Valley the fire visited and the family kept. At night a wall of it is the valley remembering, politely, at vegetable speed.',
    byproducts: ['Ember Leaf'],
    tamingOrCraftNotes: 'Harvest with the glove — a leaf that holds a coal\'s warmth for an hour: the traveler\'s hand-warmer, sibling to the Ash Puff.',
    biome: 'Ember × Living (the Burned Valley only)',
    iconColor: '#f97316',
  },
  {
    species: 'frost_ivy',
    name: 'Frost Ivy',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The Ember Ivy\'s deliberate sister, in the other clash country: frost-keeping ivy that preserves what it touches under a rime skin — a frost-ivy wall is a gallery of held things, flowers and insects and one famous glove, kept at the moment the cold took them. The Cold Valley\'s archive, climbing.',
    byproducts: ['Frost Leaf'],
    tamingOrCraftNotes: 'Harvest with the glove — wrap a provision in a frost leaf and the provision keeps: the cold graph\'s refrigerator, grown.',
    biome: 'Living × Frost (the Cold Valley only)',
    iconColor: '#bae6fd',
  },
  {
    species: 'mirror_reed',
    name: 'Mirror Reed',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The river grows its plants twice: a reed grown in both directions from the waterline — a reed above, and in the stillwater a second reed, rooted — the reflection is not a reflection. Its submerged blooms are gathered by the lag-taught: a flower that grew in a reflection, in the country where reflections keep their own hours.',
    byproducts: ['Mirror Bloom (the submerged blooms)'],
    tamingOrCraftNotes: 'Harvest with the glove — kept for the helmet\'s sake; worn, it is said to steady the wearer in the lag country. Grown in both directions; useful in both.',
    biome: 'Wetland (the Mirror Marsh)',
    iconColor: '#7dd3fc',
  },
  {
    species: 'rime_grass',
    name: 'Rime Grass',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A down bed that stands up: grass that grows rime feathers on its blades in the still cold, so a field of it shimmers like bedding — the Driftworm travels under it, the Frost Vole caches in its root-mat, and the Stillwhite\'s famous silence is partly this grass not rustling. A homestead that keeps rime grass at its walls stands measurably warmer.',
    byproducts: ['Soft Fiber (spring blades, thatch of the first quality)'],
    tamingOrCraftNotes: 'Harvest with the glove for fiber — but leave the walls their blanket: the field itself is the yield.',
    biome: 'Frost (family cast)',
    iconColor: '#e0f2fe',
  },
  {
    species: 'fang_fern',
    name: 'Fang Fern',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Keeping the geysers\' schedule in vegetable form: a fern whose fronds freeze into serrated ice teeth each night and thaw supple by day, under the Ice Fangs. Spire Bats roost out of its reach, and the entry notes the fact without further advice. Its shed teeth are the winter country\'s green ivory, carving grade — gathered dead, as everything honest in the cold country is.',
    byproducts: ['Basic Compost (shed teeth-fronds)'],
    tamingOrCraftNotes: 'Harvest with the glove at midday, when the teeth are supple. The fern keeps the geysers\' hours; learn them or wear the lesson.',
    biome: 'Frost (the Ice Fangs)',
    iconColor: '#a5f3fc',
  },
  {
    species: 'mirror_cap',
    name: 'Mirror Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The marsh\'s fungal citizen: a cap whose upper surface is a mirror — still, dark, reflective, showing a sky a half-second late, in keeping with the country\'s terms. Pools of fungus along the marsh paths. The cap is bitter and nobody eats it; its yield is the reflection, and the directions the reflection gives.',
    byproducts: ['Glow Spore'],
    tamingOrCraftNotes: 'Gather spores with the glove — and use the cap the way the marsh does: to check what the sky is doing half a second from now.',
    biome: 'Wetland (the Mirror Marsh)',
    iconColor: '#94a3b8',
  },
  {
    species: 'meltcap',
    name: 'Meltcap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A clock made of fungus: it fruits in the dark — a pale cap by moonlight, sweet-smelling, standing proud at midnight — and by dawn it has melted to a stain and a smell. The Hollow keeps two shifts, and the meltcap works the night one entirely.',
    byproducts: ['Meltcap (a cap cut at midnight, exactly)'],
    tamingOrCraftNotes: 'Harvest with the glove at midnight — cut at dawn it collapses in the pouch, which the codex records as the tuition everyone pays once.',
    biome: 'Fungal (background cast)',
    iconColor: '#e9d5ff',
  },
  {
    species: 'poolcap',
    name: 'Poolcap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The travelling fungus at the surface: a raft of small sail-backed caps that rides wind and pool-current as one slow sailing — the colony moving house at the speed of weather. Where the raft beaches, the marsh gains a harbor that feeds people.',
    byproducts: ['Poolcap (caps pinched from the raft\'s edge)'],
    tamingOrCraftNotes: 'Harvest with the glove from the raft\'s edge — the raft sails on, diminished and unbothered.',
    biome: 'Wetland (family cast)',
    iconColor: '#6ee7b7',
  },
  {
    species: 'saltcap',
    name: 'Saltcap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The material crossover in the kind where it is strangest: a living fungus heart wearing a rind of the family\'s glass — in the Salt Hollows, where Fungal meets Saltglass, the mushroom learned masonry. The rind is the family\'s glass; the heart is the fungus\'s answer.',
    byproducts: ['Saltglass Shard (the rind)', 'Saltcap Heart (beneath the rind)'],
    tamingOrCraftNotes: 'Harvest with the glove — the first mushroom that pays in glass: the shard economy\'s sixth door, and the heart is a keeper\'s item besides.',
    biome: 'Fungal × Saltglass (the Salt Hollows only)',
    iconColor: '#a5f3fc',
  },
  {
    species: 'tomb_cap',
    name: 'Tomb Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Dust-fed: a squat, pale cap fruiting on stored organics and old wood inside ruins, where Fungal meets the Precursor\'s leavings — and what drifts in the cache chambers is its spore-release. The ruins\' dust has an author, and the author is hiring the air.',
    byproducts: ['Tomb Cap (its caps, dried)'],
    tamingOrCraftNotes: 'Harvest with the glove — bitter, preservative: used to dust stores against WORSE tenants. The pantry\'s guard, grown in the pantry\'s ancestors.',
    biome: 'Fungal × Precursor (the ruins themselves only)',
    iconColor: '#d6d3d1',
  },
  {
    species: 'ring_cap',
    name: 'Ring Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A fairy ring made honest: an expanding ring-colony whose circle greens the grass along its front, a hand\'s width a year — Meadowbacks graze the ring grass preferentially, and a ring old enough is a slow circle of the country\'s best grazing, drawn by a fungus that has never once hurried.',
    byproducts: ['Glow Spore (ring caps, unlisted — the ring is the yield)'],
    tamingOrCraftNotes: 'Gather spores with the glove, and read the ring: its diameter is its age, and its grass is the meadow\'s recommendation of itself.',
    biome: 'Meadow (family cast)',
    iconColor: '#4ade80',
  },
  {
    species: 'veil_cap',
    name: 'Veil Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The fungus kingdom\'s gift to travelers: a cap whose partial veil is a spore-proof silk membrane, at the Hollow\'s edges where the air turns. Against spore clouds, against the deep groves\' worst air, the veil is the difference between visiting the Hollow and joining it.',
    byproducts: ['Veil Cloth (veils, carefully cut)'],
    tamingOrCraftNotes: 'Harvest with the glove — filter-grade: the grove country\'s mask and bandage in one. Cut carefully; a torn veil is a story you tell with a cough.',
    biome: 'Fungal (the Hollow\'s edges)',
    iconColor: '#f1f5f9',
  },
  {
    species: 'glass_cap',
    name: 'Glass Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The kingdom\'s second crystal citizen: a translucent cap grown through with saltglass, fruiting among the Prism Moss — the moss sorts the noon, the cap stores it, and at dusk the Beds give the light back at reading strength. The Prism Beds\' floor has two light-workers now, on two shifts.',
    byproducts: ['Glass Cap (a whole cap)'],
    tamingOrCraftNotes: 'Harvest with the glove, whole and careful — a natural lamp-shade and lens blank in one piece.',
    biome: 'Saltglass (the Prism Beds)',
    iconColor: '#67e8f9',
  },
  {
    species: 'heart_shelf',
    name: 'Heart Shelf',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A staircase the fungus built for the animal that uses it: great woody brackets at climbing intervals up the heartroot stands — the Canopy Sloth\'s resting platforms, shelf to shelf, and an old stand is a staircase with a regular. The custom is fallen-only, and the sloths enforce it by simply continuing to climb.',
    byproducts: ['Soft Fiber (fallen shelves, timber grade)'],
    tamingOrCraftNotes: 'Gather fallen shelves only — the shelf that is cut is the shelf that ends the staircase.',
    biome: 'Rootwood (the heartroot stands)',
    iconColor: '#b45309',
  },
  {
    species: 'bone_puff',
    name: 'Bone Puff',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'White on white: a puffball of the Bonefields, round and pale as the country\'s own moons. When it puffs, the spore-dust is white on white and the fields seem to breathe out — the Dust Hawk hunts through its puffs, using the white weather as cover, and the fields forgive them both.',
    byproducts: ['Bone Puff (young puffs)'],
    tamingOrCraftNotes: 'Gather the young puffs with the glove — the Bone country\'s provision, mild as the fields are not.',
    biome: 'Bone (the Bonefields)',
    iconColor: '#f5f5f4',
  },
  {
    species: 'wind_puff',
    name: 'Wind Puff',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The broadcaster: a puffball whose puff rides the front — a single fruiting body can seed three zones in one storm. The kingdom\'s two storm strategies stand side by side here: the emigrant, which sends a cap, and the broadcast, which sends a weather.',
    byproducts: ['Glow Spore (unpuffed — its yield is its range)'],
    tamingOrCraftNotes: 'Gather with the glove before the front arrives. After it, you are not harvesting; you are downstream.',
    biome: 'Storm (the open country)',
    iconColor: '#e7e5e4',
  },
  {
    species: 'door_cap',
    name: 'Door Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Both kingdoms keep the valley\'s register: the Doorstep Rose signs the threshold in flowers, the door cap signs it in fungus, fruiting on doorframes of the valley\'s homesteads. The outside ones are gathered; the inside ones are left, with the door shut — the same codex the rose keeps, in a quieter hand.',
    byproducts: ['Door Cap (the outside ones)'],
    tamingOrCraftNotes: 'Harvest with the glove — a mild keeper\'s mushroom. Take the outside ones only; hospitality has a direction.',
    biome: 'Living (the valley\'s homesteads)',
    iconColor: '#a3e635',
  },
  {
    species: 'glyph_cap',
    name: 'Glyph Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The made world\'s third living script, and the shortest: a cap whose gills form glyph-like patterns at fruiting — the Glyph Vine writes in leaves that keep, the fungus writes in gills that don\'t. Copy the pattern while it fruits; by evening the page is compost and the library has closed itself.',
    byproducts: ['Basic Compost (the cap is food, unlisted — the pattern, copied, is the yield)'],
    tamingOrCraftNotes: 'Harvest with the glove, and bring the codex habit: the treasure here is free, and it is perishable in the oldest way.',
    biome: 'Precursor (the ruins\' edges)',
    iconColor: '#a3e635',
  },
  {
    species: 'canopy_cup',
    name: 'Canopy Cup',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A pond in the sky: a broad living bowl on the canopy\'s branches, holding rain for weeks — froglets, skater-kin, a whole wetland the size of a hat, suspended in the family that builds with height. The Rootwood keeps its water at every storey, and the top storey\'s is the cleanest.',
    byproducts: ['Cup Water (canopy rain, unhurried)'],
    tamingOrCraftNotes: 'Harvest with the glove — the cleanest drink in the family. The cup refills and does not mind, within reason.',
    biome: 'Rootwood (family cast)',
    iconColor: '#38bdf8',
  },
  {
    species: 'banner_vine',
    name: 'Banner Vine',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'It gives its length to the wind: a vine anchored hard in the high rocks, streaming horizontal in storm weather like a banner — the Storm country\'s flag, grown, announcing the wind\'s direction and temper to anyone who can read a vine.',
    byproducts: ['Banner Fiber (cut lengths, storm-grade)'],
    tamingOrCraftNotes: 'Harvest with the glove — storm-grade fiber, kin to Kite Ribbon in the crafting family: the Storm economy pays in things that hold against wind.',
    biome: 'Storm (family cast)',
    iconColor: '#f43f5e',
  },
  {
    species: 'charnel_bloom',
    name: 'Charnel Bloom',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The Gravebloom\'s hybrid cousin, and the comparison is the design: where the gravebloom is a flower that happens to grow on graves, the charnel bloom is a FUNGUS wearing a flower\'s whole performance — bone-rooted, corpse-pale, with a marrow-gold heart it shows only at night.',
    byproducts: ['Grave Pollen (night-cut petals)'],
    tamingOrCraftNotes: 'Harvest with the glove at night — marrow-gold, sweet, uncanny. What it crafts into is later design\'s business.',
    biome: 'Bone × Fungal (hybrid country only)',
    iconColor: '#fbbf24',
  },
  {
    species: 'wrongbloom',
    name: 'Wrongbloom',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Same gold core, same eight petals, wound the OTHER way: the Untended\'s bloom, spiral-reversed — the true bloom\'s mirror in the gardens nobody kept. It yields Wrong Thread, recorded as a non-material: it looks like Living Thread, spools like it, and unwinds in the hand over hours, and crafts made with it quietly come undone.',
    byproducts: ['Wrong Thread (a non-material — it unwinds)'],
    tamingOrCraftNotes: 'Harvest with the glove, and label the spool twice. The Untended\'s joke is only funny the first time.',
    biome: 'Precursor (the Untended)',
    iconColor: '#a78bfa',
  },
  {
    species: 'tumble_sage',
    name: 'Tumble Sage',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The rolling mode\'s plant citizen: a sage ball of the Wind Plains that, at season\'s turn, lets go of its root and becomes its own seed-head — the whole plant, traveling as luggage and luggage as plant. Rooted, in season, it is a plains herb of the first respect.',
    byproducts: ['Sage Leaf (a rooted sage, storm-cured)'],
    tamingOrCraftNotes: 'Harvest with the glove while it is rooted. Chasing it across the Wind Plains is exercise the codex declines to prescribe.',
    biome: 'Meadow × Storm (the Wind Plains only)',
    iconColor: '#a3a380',
  },
  {
    species: 'amber_bloom',
    name: 'Amber Bloom',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Forever at the moment of opening: a river flower blooming inside the amber flow of the Sap Rivers, visible through the amber at peak — the river is a pressed collection arranged by centuries of current, and every bloom in it is perfect, and every bloom in it is spoken for by the river.',
    byproducts: ['Amber Bloom (in the great melt years, one or two, whole, at the banks)'],
    tamingOrCraftNotes: 'Harvest with the glove in the melt years only — flood-rare, and priced like it. The river gives up its flowers the way it gives up everything: on its schedule.',
    biome: 'Rootwood (in the Sap Rivers)',
    iconColor: '#f59e0b',
  },
  {
    species: 'silt_rose',
    name: 'Silt Rose',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The Wetland\'s rose, mud-rooted and filtering: its root-mat drinks silt, and the water around a silt rose runs clear in a visible ring — the Stillmouth\'s garden, and the marsh\'s waterworks in a flower. Where the ring fails, the water is telling you something about the rose.',
    byproducts: ['Silt Petal'],
    tamingOrCraftNotes: 'Harvest with the glove — one petal, one clear bucket: a water-clarifier for cisterns and camps, an old traveler\'s trick the codex finally writes down.',
    biome: 'Wetland (family cast)',
    iconColor: '#9f7a5a',
  },
  {
    species: 'ghost_orchid',
    name: 'Ghost Orchid',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'It has no green in it at all: a leafless orchid that eats fungus, tapping the mycelium networks like a pale spy at the kingdom\'s table — the flora kingdom\'s one citizen who pays no sunlight tax, in the country where the sun is a rumor anyway.',
    byproducts: ['Ghost Bloom (naturally fallen blooms ONLY, by custom older than the codex\'s manners)'],
    tamingOrCraftNotes: 'Gather fallen blooms with the glove. You do not cut a ghost orchid; the custom is older than the codex, and the Hollow keeps its customs.',
    biome: 'Fungal (family country)',
    iconColor: '#f1f5f9',
  },
  {
    species: 'thaw_rose',
    name: 'Thaw Rose',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The variant\'s calendar in a flower: an ice-petaled rose blooming in meltwater for one week of the Thaw, its petals holding grown crystal at their rims — when the thaw roses open on the flats, the flats are open, and the country\'s short bright season is officially in session.',
    byproducts: ['Thaw Bloom (a whole bloom, in its week)'],
    tamingOrCraftNotes: 'Harvest with the glove in the bloom week — a rose that stays cold in the hand for a day: the flats\' one luxury, couriered at speed.',
    biome: 'Saltglass (the Thaw)',
    iconColor: '#fda4af',
  },
  {
    species: 'dust_rose',
    name: 'Dust Rose',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The family\'s rose, bone-white: it grows only in bone-dust soil, and its blooms open the color of old ivory, with a scent the record phrases carefully — "the Graveyard, sweetened." Dust Moths carry its pollen bone to bone, a white service for a white flower.',
    byproducts: ['Dust Petal'],
    tamingOrCraftNotes: 'Harvest with the glove — mourning-pale, used for dyes that hold their color in sun: the white fields\' one export of softness.',
    biome: 'Bone (family cast)',
    iconColor: '#f5f5f4',
  },
  {
    species: 'obsidian_rose',
    name: 'Obsidian Rose',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The rose census\'s dark entry: glass-petaled — black, glossy, sharp-edged as the Garden\'s own soil. (Its design entry files it under Ember\'s telling of the Obsidian Garden; the garden as built stands in Saltglass country, and the rose, being a plant, lives where the garden is.) The Shardwing nests above it, and the garden keeps both.',
    byproducts: ['Obsidian Petal (a petal, gloved)'],
    tamingOrCraftNotes: 'Harvest with the glove, and mean the glove — the black work\'s material, edge and all.',
    biome: 'Saltglass (the Obsidian Garden)',
    iconColor: '#1c1917',
  },
  {
    species: 'hedge_rose',
    name: 'Hedge Rose',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The rose census\'s keystone: hedge-built, and planted-by-walking — this is the species the Brambleback plants, its seeds passing through the animal and sprouting behind it along every Hedgewood path. The hedge is a collaboration neither party signed, and both parties keep.',
    byproducts: ['Hedge Hip (the hedge country\'s trail fruit)'],
    tamingOrCraftNotes: 'Gather the hips with the glove — vitamin-bright, free along every hedge in the wood. Thank the brambleback by leaving the path as you found it.',
    biome: 'Meadow × Rootwood (the Hedgewood only)',
    iconColor: '#e11d48',
  },
  {
    species: 'raincatcher',
    name: 'Raincatcher',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Vapor flora, the context-ruled cell: a gas-bag canopy over a soft heart, rain-bellied — it lives on the Skyfall Basin\'s updrafts and comes down only when heavy with caught rain, sinking at night to drink from the pools its own rain made: a closed loop with a pulse. It cannot be planted or moved. A Raincatcher is a citizen of one sky.',
    byproducts: ['None — what a player can do is keep its pools clean, and be rained on gratefully'],
    tamingOrCraftNotes: 'No harvest. Keep the basin\'s pools clean; the citizen handles the weather.',
    biome: 'Storm (the Skyfall Basin)',
    iconColor: '#bae6fd',
  },
  {
    species: 'tending_vine',
    name: 'Tending Vine',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Forged flora: a garden vine whose tendril ends are shaped — pruners, probes, a small lamp — patient, networked to its garden, tasting soil the way the Warden reads intruders. It cannot be transplanted, but it accepts assignments: plant something in its row and it will tend yours alongside its own. Between Vine and Warden, a tolerated player has staff.',
    byproducts: ['Tending Cutting (its prunings, stacked neatly where a gardener would)'],
    tamingOrCraftNotes: 'Take the cuttings with the glove — permitted. Taking MORE is noticed.',
    biome: 'Precursor (the gardens)',
    iconColor: '#a3e635',
  },
  {
    species: 'hearthroot',
    name: 'Hearthroot',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'A root-flower that grows TOWARD dwellings, fed measurably by being lived near. In a Welcoming valley it puts roots under your doorstep and blooms along your path — the valley\'s hello, at flora scale, arriving slowly. In a Hungry valley it is the same plant, growing toward dwellings to get IN: blooms along the path are a promise, and the promise is the problem.',
    byproducts: ['Hearth Bloom'],
    tamingOrCraftNotes: 'Gather with the glove — and know which valley you are standing in before you follow the blooms home.',
    biome: 'The Living Valley (both temperaments)',
    iconColor: '#fb923c',
  },
  {
    species: 'puffbell',
    name: 'Puffbell',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The fungal family\'s second clock — the Meltcap keeps the night, the Puffbell keeps the HOUR: at intervals a mature bell draws in, swells, and puffs a visible ring of spore-smoke with a soft percussive note, felt in the ribs more than heard. In a grove the bells synchronize within a day of arriving; nobody teaches them. The grove is one organism remembering it has a tempo.',
    byproducts: ['Puff Spore (its spore-smoke, gathered)'],
    tamingOrCraftNotes: 'Gather with the glove — plantable by spore-smoke: stand in a puff at the hour, walk to your ground, and you have planted a clock.',
    biome: 'Fungal (family cast)',
    iconColor: '#d8b4fe',
  },
  {
    species: 'arch_tree',
    name: 'Arch Tree',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Grown, not built, in both parents\' senses: Rootwood\'s living wood shaped by the gardeners\' art into architecture — a tree grown into a doorway, trunk split and trained into an arch, canopy braided overhead, standing in the gardens\' spiral order where garden met forest. The roster\'s recurring discovery, planted: infrastructure is a biome that hasn\'t been moved into yet — here the infrastructure grew, and then grew tenants.',
    byproducts: ['None — it is a colonnade, not a crop'],
    tamingOrCraftNotes: 'Walk through it slowly. The gardeners planted a door; the forest moved into the house.',
    biome: 'Precursor × Rootwood (the colonnade country only)',
    iconColor: '#92400e',
  },
  {
    species: 'smoke_tree',
    name: 'Smoke Tree',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'It smolders: heartwood at a permanent ember, never flame, never out — and its canopy is a low, slow smoke the tree makes of its own leaves and breathes back. The Charwood\'s stands stand in their own weather, and at night the smolder dims to a coal-glow in the trunk\'s seams: a stand of trees with fire in their joints, breathing slowly.',
    byproducts: ['Smolder Heart (a cutting that keeps the ember)'],
    tamingOrCraftNotes: 'Cut with the glove, once — a smoke tree\'s ash feeds smoke trees; take the heart, leave the grove its future.',
    biome: 'Ember × Rootwood (the Charwood only)',
    iconColor: '#ea580c',
  },
  {
    species: 'lightcreep',
    name: 'Lightcreep',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Gel flora: a light-clear ground-sheet with a leading edge that flows — centimeters a day, toward the Hollow\'s dim green light, so a sheet found in spring is a hand\'s width on by summer. It eats by lying on things for a season; sheets merge on contact into one larger citizen. Recorded stationary, with the design\'s own footnote: if any flora earns a locomotion footnote, it is this one.',
    byproducts: ['Lightcreep Sheet (a cut piece — carried in a dark pouch, it starts a new sheet where laid)'],
    tamingOrCraftNotes: 'Cut with the glove. The sheet is the harvest and the planting both.',
    biome: 'Fungal (the Hollow\'s floors)',
    iconColor: '#a3e635',
  },
  {
    species: 'zot_star',
    name: 'Zot Star',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Radial flora — the shape plan\'s first plant: a star of crystal petals around a heart of sand turned to glass, rooted in strike glass on the Charged Flats. It grows only where lightning has been — no zot, no star — so a map of zot stars IS a map of the strikes: the family\'s archive, flowering. At the warning light every star on the flats turns its face up at once: the second banner, closer and quieter.',
    byproducts: ['Star Glass (a petal of strike-glass)'],
    tamingOrCraftNotes: 'Gather with the glove — and read the flats by it: where the stars cluster, the sky has opinions.',
    biome: 'Storm (the Charged Flats)',
    iconColor: '#fde047',
  },
  {
    species: 'grabvine',
    name: 'Grabvine',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The mirror-law, weaponized: Welcoming vines sway toward a guest; grabvines hold perfectly still — and in the Living Valley, stillness is the tell. Its tendrils cross paths at ankle and wrist height, grown there, waiting for the tension of a step. What the path brings, it composts in place: a grabvine thicket is the Hungry valley\'s garden and its larder.',
    byproducts: ['Living Thread (a tendril cutting — the valley\'s dangerous door to its own signature material)'],
    tamingOrCraftNotes: 'HAZARDOUS. Harvest with the glove, at arm\'s length, and never twice the same thicket. The hello and the grab begin with the same gesture; this one has practiced leaving the gesture out.',
    biome: 'The Living (Hungry valleys)',
    iconColor: '#4d7c0f',
  },
  {
    species: 'maw_bloom',
    name: 'Maw Bloom',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The snap trap\'s plan at throne scale: a bloom you could stand in, at path-bends and clearings\' hearts, perfumed WRONG — garden fruit\'s sweetness in a country with no gardens. The entry teaches the tell plainly: in a Hungry valley, a smell that doesn\'t belong is a mouth. It blooms at the warm hours, shut and harmless-looking at night; the codex notes the safe window without smiling.',
    byproducts: ['None — its seeds are carried by what escapes it'],
    tamingOrCraftNotes: 'HAZARDOUS. Never cultivated. Pass its clearings at night, upwind of the perfume.',
    biome: 'The Living (Hungry valleys)',
    iconColor: '#be185d',
  },
  {
    species: 'quiver_cap',
    name: 'Quiver Cap',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'The second empty cell, filled with gel: an Underroot-edge fungus whose cap is gel — it quivers at footsteps, sweats clear beads, and reproduces by dripping: spore-beads roll downhill in gel skins and root where they stop, a fungus that uses Rolling without having it. It fruits in the wet and slumps in the dry: a rain gauge with opinions.',
    byproducts: ['Quiver Gel (a trembling, spore-live gel — the Gloom Gel\'s cultivated cousin)'],
    tamingOrCraftNotes: 'Gather with the glove — the easiest fungus on the roster to move: a bead, carried and set on damp rot, roots in a day.',
    biome: 'Fungal (Underroot edges)',
    iconColor: '#a5f3fc',
  },
  {
    species: 'balloon_vine',
    name: 'Balloon Vine',
    type: 'flora',
    discovered: false,
    scannedCount: 0,
    description: 'Drifting flora\'s second citizen: a vine whose seed-pods inflate with warm gas at ripeness and lift their cuttings clear of the mother, to drift the Basin and root where they ground — the Stormcap\'s flora mirror: the fungus detaches a cap, the vine detaches a cradle; two kingdoms, one emigration. Pods ground on the Raincatchers and ride a while, rent-free.',
    byproducts: ['Pod Bladder (a cradle-pod\'s gas bladder)'],
    tamingOrCraftNotes: 'Gather grounded pods with the glove — a grounded pod, kept, roots eagerly: the far country\'s easiest exotic.',
    biome: 'Storm (the Skyfall Basin\'s gardens)',
    iconColor: '#86efac',
  },
];
