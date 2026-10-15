// ============================================================================
// species.ts — THE SPECIES TABLE (creature build phase, slice 1)
// ----------------------------------------------------------------------------
// Design source: ReadMeFiles/CREATURES_BRAINSTORM_*.md (358 species designed
// by the BioForge creatures chat; this table is where those designs become
// data). The build note in Part 1 of that document is the contract:
//
//   * A species is DATA, not a code file. One entry here per species.
//   * Shared systems (spawning, taming, byproduct sheds, meshes) are
//     written ONCE and read this table — no per-species branches.
//   * A genuinely new behavior becomes a named entry other species can
//     reuse, never a fork in five files.
//
// HOW A SPECIES REACHES THE WORLD (three routes, all shipped patterns):
//   1. THE CENSUS (worldGen.ts FAUNA_CENSUS) — the classic starter three
//      (soft_puff, burrow_mouse, chitin_stalker). The census is a promise
//      about the starter multiset and STAYS UNTOUCHED by new species.
//   2. RADAR SPECIALS (worldGen.ts, hand-placed blocks) — the vesper
//      glider and mirror moth: biome-gated BONUS life dealt outside the
//      census, never in the spawn zone. Predates this table; left as-is.
//   3. BONUS SPAWNS (this table's `bonusSpawn`) — the general form of
//      route 2: worldGen runs ONE generic loop over every entry that
//      carries a bonusSpawn spec. New species land HERE.
//
// Entries for census/radar species carry no bonusSpawn: their interaction
// data (name, taming, byproducts) still lives here so the shared systems
// have exactly one place to read.
// ============================================================================

import type { BiomeId } from './biomes';
import type { FaunaSpecies, ItemId } from '../types/game';

/**
 * Behavior profile — the design document's temperament, reduced to the
 * verb family the shared fauna simulation should treat the species
 * with. Slice 1 records it (the generic wander sim serves every profile
 * today); later behavior slices key flee/herd/perch verbs off it.
 */
export type SpeciesProfile =
  | 'grazer'    // calm wander-and-crop (soft_puff, meadowback)
  | 'rodent'    // small, quick, curious (burrow_mouse, frost_vole)
  | 'predator'  // territorial hunter (chitin_stalker)
  | 'drifter'   // airborne, unhurried, untamable (mirror_moth)
  | 'glider'    // airborne, wary (vesper_glider)
  | 'flyer'     // airborne, powered — flaps more than it glides (vent_drake)
  | 'hare'      // burst-fast prey animal (pale_hare)
  | 'insect'    // tiny background life (dew_gnat, glint_beetle)
  | 'bird'      // ground birds with opinions (sedge_hen)
  | 'amphibian' // water-edge small life (ember_newt)
  | 'slug'      // the slow end of the world (gloom_slug)
  | 'lizard'    // baskers and darters (sun_lizard)
  | 'turtle'    // unhurried to the template's limit (mud_turtle)
  | 'colony'    // the colony is the creature (hollow_hermit)
  | 'territorial' // defends one place, reluctantly (rootfall_bear)
  | 'radial'    // no front to be curious with (kiln_star)
  | 'serpent';  // the graph's recurring answer to "what hunts here?" (slag_serpent)

export interface SpeciesByproduct {
  /** Item shed on the ground when the timer fires. */
  item: ItemId;
  /** Seconds between sheds. */
  seconds: number;
  /**
   * true  = only tamed individuals shed (the puff/stalker pattern).
   * false = wild shedding — a supply chain must never require harming
   *         or taming the species (Adam's ruling for the glider's
   *         vanes; the moth's dew and the hare's fur follow it).
   */
  tamedOnly: boolean;
}

/**
 * The hunt spec (creature build phase, slice 5, 2026-10-15): a
 * species carrying one is DANGEROUS, and the danger doctrine
 * rides on these numbers — every danger has a readable tell
 * (the alert: inside aggroRange a wild hunter stops and faces
 * you, in EVERY difficulty), and attacks exist only where the
 * world is armed (Normal/Hostile): there the hunter chases and
 * bites for `damage` a hit. Peaceful keeps the theater and
 * skips the teeth, exactly as the stalker's shipped pattern
 * promised. A species' profile stays its verbs — a grazer can
 * carry a hunt (the Sporeback's startle-charge) without
 * becoming a predator.
 */
export interface SpeciesHunt {
  /** Meters: inside this, a wild hunter notices you. */
  aggroRange: number;
  /** Player health per landed bite (the player pool is 100). */
  damage: number;
  /** Meters: a chase converts to bites inside this. */
  biteRange: number;
  /** Seconds between bites while in range. */
  biteCooldownSeconds: number;
}

/**
 * The flight spec (creature build phase, slice 6, 2026-10-15):
 * how a species' body is DRAWN above the terrain. The sim stays
 * 2D (as it always has — the vesper glider shipped that way);
 * flight is altitude + a rise-and-settle bob + a wing flap for
 * meshes that name their wings 'wingL'/'wingR'. The flight
 * spectrum from the design pass lives in these numbers: powered
 * fliers flap fast and bob quick (the Spire Bat), obligate
 * gliders ride high and slow (the Bonepicker).
 */
export interface SpeciesFlight {
  /** Cruise height above the terrain, meters. */
  altitude: number;
  /** Rise-and-settle amplitude, meters. */
  bobHeight: number;
  /** Bob cycles per second (radians of animTime, like the
   *  shipped branches use). */
  bobRate: number;
  /** Wing flap rate; absent = no wing flap (a blur-winged
   *  insect, or a shape that reads better still). */
  flapRate?: number;
}

export interface SpeciesBonusSpawn {
  /** Family affinities — the zone's biome OR a hybrid's secondary
   *  family both count, the same admixture rule the census uses.
   *  'all' is the ubiquitous layer: every family, every zone. */
  biomes: BiomeId[] | 'all';
  /** Variant gate (slice 3): when set, the species deals ONLY in
   *  zones of this variant — the biome-unique layer, one creature
   *  per specific place, found nowhere else. */
  variant?: string;
  /** Individuals dealt per eligible zone. */
  count: number;
  /** Keep this far from the zone center (the radar species use 10). */
  minRadius: number;
  /** Minimum distance from fauna already placed. */
  spacing: number;
  /** Shipped stat block (bonus species carry theirs here; census
   *  species carry theirs in the census). */
  speed: number;
  speedJitter: number;
  health: number;
}

export interface SpeciesDef {
  id: FaunaSpecies;
  /** Display name, as the codex and notifications use it. */
  name: string;
  profile: SpeciesProfile;
  /** Per-attempt taming probability (design doc spectra). null = the
   *  species cannot be tamed (the mirror moth is fully timid by
   *  design; the scale-bear is codex-only legacy and never spawns). */
  tameChance: number | null;
  /** Which shipped taming flow serves this species:
   *  'nectar'  = 1x Sweet Nectar, the standard lure flow;
   *  'predator' = the stalker's bespoke offering (kept in the hook);
   *  null = no lure flow (untamable). */
  bait: 'nectar' | 'predator' | null;
  /** Default companion name granted on a successful tame. */
  petName: string;
  byproduct: SpeciesByproduct | null;
  /** The hunt spec (slice 5): present only on dangerous species.
   *  Tamed hunters never hunt the player; on guard they patrol
   *  like the stalker always did. */
  hunt?: SpeciesHunt;
  /** The flight spec (slice 6): present only on airborne
   *  species. Draw-only — see SpeciesFlight. */
  flight?: SpeciesFlight;
  /** Present only for route-3 species (see header). */
  bonusSpawn: SpeciesBonusSpawn | null;
}

export const SPECIES: Record<FaunaSpecies, SpeciesDef> = {
  // ------------------------------------------------------------------
  // The shipped cast — values lifted from the code they replace
  // (tame constants in useToolInteractions, shed blocks in
  // useWorldEntities) so behavior is preserved exactly.
  // ------------------------------------------------------------------
  soft_puff: {
    id: 'soft_puff',
    name: 'Soft-Puff',
    profile: 'grazer',
    tameChance: 0.8,
    bait: 'nectar',
    petName: 'Luminescent Puff',
    byproduct: { item: 'bio_pellet', seconds: 25, tamedOnly: true },
    bonusSpawn: null, // census species
  },
  burrow_mouse: {
    id: 'burrow_mouse',
    name: 'Burrow Mouse',
    profile: 'rodent',
    tameChance: 0.6,
    bait: 'nectar',
    petName: 'Burrow Scout',
    byproduct: null, // codex copy mentions pellets; no shed was ever wired
    bonusSpawn: null, // census species (affinity 'all')
  },
  chitin_stalker: {
    id: 'chitin_stalker',
    name: 'Chitin-Stalker',
    profile: 'predator',
    tameChance: 0.25,
    bait: 'predator',
    petName: 'Base Guardian Stalker',
    byproduct: { item: 'carapace_scale', seconds: 35, tamedOnly: true },
    // The original hunter: its shipped AGGRO_RANGE was 8 — the
    // table carries the same number now, and the sim reads it
    // from here (slice 5 generalization).
    hunt: { aggroRange: 8, damage: 8, biteRange: 1.6, biteCooldownSeconds: 1.2 },
    bonusSpawn: null, // census species
  },
  mirror_moth: {
    id: 'mirror_moth',
    name: 'Mirror Moth',
    profile: 'drifter',
    tameChance: null, // fully timid by design — it cannot be tamed
    bait: null,
    petName: 'Mirror Moth',
    // Pollinators shake dew from the mirror lilies as they drift;
    // wild or tame, the marsh provides (2026-10-15).
    byproduct: { item: 'dew_essence', seconds: 50, tamedOnly: false },
    // Hover-drift (slice 6): the moth had no lift branch in the
    // mesh updater — the table's flight spec finally draws it at
    // the height its design always claimed.
    flight: { altitude: 0.9, bobHeight: 0.15, bobRate: 2.2, flapRate: 5.5 },
    bonusSpawn: null, // radar special (Mirror Marsh block in worldGen)
  },
  vesper_glider: {
    id: 'vesper_glider',
    name: 'Vesper Glider',
    profile: 'glider',
    tameChance: null, // no lure flow wired yet; its design slice decides
    bait: null,
    petName: 'Vesper Glider',
    // NATURAL shedding: the radar's supply chain must never require
    // harming one (Adam, 2026-10-14) — the vanes are non-lethal.
    byproduct: { item: 'sonar_vane', seconds: 45, tamedOnly: false },
    // Its shipped glide, documented as data (slice 6): the
    // bespoke branch in updateFaunaMesh still draws it (named
    // wings), and these numbers match that branch exactly.
    flight: { altitude: 0.85, bobHeight: 0.22, bobRate: 1.7, flapRate: 2.6 },
    bonusSpawn: null, // radar special (meadow/fungal block in worldGen)
  },
  scale_bear: {
    id: 'scale_bear',
    name: 'Scale-Bear Guardian',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Scale-Bear Guardian',
    byproduct: null,
    bonusSpawn: null, // codex-only legacy species; never spawns
  },

  // ------------------------------------------------------------------
  // Slice 1 — the first designed species (CREATURES_BRAINSTORM roster)
  // ------------------------------------------------------------------

  // #2 — the Meadow's family emblem: a broad-backed herd grazer whose
  // back is flat and warm enough to ride on, and things do. Taming is
  // a herd negotiation at 40% per lure attempt (design spectra).
  meadowback: {
    id: 'meadowback',
    name: 'Meadowback',
    profile: 'grazer',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Meadowback',
    // Sheds Soft Fiber tufts periodically when tame (the vesper-vane
    // patience pattern) — a second, kinder door to soft_fiber beside
    // Ribbon-Moss. Wild shedding is rarer in the design; slice 1
    // ships the tame shed.
    byproduct: { item: 'soft_fiber', seconds: 40, tamedOnly: true },
    bonusSpawn: {
      biomes: ['meadow'],
      count: 2,
      minRadius: 12,
      spacing: 6,
      speed: 1.1, // slow, unhurried; it has never once hurried
      speedJitter: 0.1,
      health: 110,
    },
  },

  // #107 — Meadow x Frost (the Pale Meadows): the Blink Hare's
  // ordinary cousin — no vapor, no tricks. Burst-fast, wary-gentle,
  // 55%: the margin's easiest friendship. Sheds Pale Fur wild or
  // tame (the cold series' fifth door, first from outside Frost).
  pale_hare: {
    id: 'pale_hare',
    name: 'Pale Hare',
    profile: 'hare',
    tameChance: 0.55,
    bait: 'nectar',
    petName: 'Pale Hare',
    byproduct: { item: 'pale_fur', seconds: 60, tamedOnly: false },
    bonusSpawn: {
      biomes: ['meadow', 'frost'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      speed: 2.9,
      speedJitter: 0.2,
      health: 25,
    },
  },

  // #114 — the Cold Range's mouse (Frost / Saltglass / Bone): a
  // subnivean vole that lives all winter in the warm dark between
  // snowpack and ground. Shy, still-then-scurry, 35% — the honest
  // version of the everywhere-mouse: its range respects the cold.
  frost_vole: {
    id: 'frost_vole',
    name: 'Frost Vole',
    profile: 'rodent',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Frost Vole',
    byproduct: null,
    bonusSpawn: {
      biomes: ['frost', 'saltglass', 'bone'],
      count: 2,
      minRadius: 8,
      spacing: 3,
      speed: 1.9,
      speedJitter: 0.15,
      health: 20,
    },
  },

  // ------------------------------------------------------------------
  // Slice 2 (2026-10-15) — family casts + the everywhere pest.
  // Numbers are the design doc's spectra, translated plainly.
  // ------------------------------------------------------------------

  // #1 — the everywhere pest: a dew-sipping gnat, harmless by
  // design, wild forever (too small and simple for a lure to say
  // anything to). The world's metronome: where gnats gather, dew
  // gathers — and half the food web eats them.
  dew_gnat: {
    id: 'dew_gnat',
    name: 'Dew Gnat',
    profile: 'insect',
    tameChance: null,
    bait: null,
    petName: 'Dew Gnat',
    byproduct: null,
    // Its shipped darting hover, documented as data (slice 6);
    // the bespoke branch still draws it.
    flight: { altitude: 0.55, bobHeight: 0.13, bobRate: 7.3 },
    bonusSpawn: {
      biomes: 'all',
      count: 3,
      minRadius: 6,
      spacing: 3,
      speed: 2.6, // fast, erratic
      speedJitter: 0.4,
      health: 5,
    },
  },

  // #40 — the meadow's weather: spring-legged hoppers that rise
  // around a walking player in clouds. The family's food-web
  // floor; "you cannot tame the weather of a meadow."
  meadow_hopper: {
    id: 'meadow_hopper',
    name: 'Meadow Hopper',
    profile: 'insect',
    tameChance: null,
    bait: null,
    petName: 'Meadow Hopper',
    byproduct: null,
    bonusSpawn: {
      biomes: ['meadow'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      speed: 2.2,
      speedJitter: 0.3,
      health: 5,
    },
  },

  // #42 — a coal-skinned, ember-bellied newt of the warm runoff
  // channels. Startled, its belly flushes — the Ember family's
  // smallest telegraph (glow = feeling). 50%: it bonds to whoever
  // is a refuge. (Design bait is cool water in hand; slice 2 ships
  // the standard lure flow.)
  ember_newt: {
    id: 'ember_newt',
    name: 'Ember Newt',
    profile: 'amphibian',
    tameChance: 0.5,
    bait: 'nectar',
    petName: 'Ember Newt',
    byproduct: null,
    bonusSpawn: {
      biomes: ['ember'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      speed: 1.4, // still, then a dart
      speedJitter: 0.2,
      health: 15,
    },
  },

  // #45 — a crystalline beetle grown of Saltglass's own material.
  // It stores glare at noon and spends it at dusk, flashing slow
  // signals across the flats. Sheds facets rarely: SALTGLASS
  // SHARD, wild — the family's shard economy gains its fourth
  // door (reed, grazer, stilt, beetle).
  glint_beetle: {
    id: 'glint_beetle',
    name: 'Glint Beetle',
    profile: 'insect',
    tameChance: null,
    bait: null,
    petName: 'Glint Beetle',
    byproduct: { item: 'saltglass_shard', seconds: 240, tamedOnly: false },
    bonusSpawn: {
      biomes: ['saltglass'],
      count: 2,
      minRadius: 8,
      spacing: 3,
      speed: 1.8,
      speedJitter: 0.2,
      health: 8,
    },
  },

  // #48 — a biolume-banded grub, decomposer first in line: it
  // eats the Hollow's spent cap-flesh and its glow is its
  // digestion showing. Bait, light, and food-web in one small
  // segmented body (its bait-item harvest is a later slice).
  glow_grub: {
    id: 'glow_grub',
    name: 'Glow Grub',
    profile: 'insect',
    tameChance: null,
    bait: null,
    petName: 'Glow Grub',
    byproduct: null,
    bonusSpawn: {
      biomes: ['fungal'],
      count: 3,
      minRadius: 8,
      spacing: 2.5,
      speed: 0.5,
      speedJitter: 0.05,
      health: 8,
    },
  },

  // #52 — Meadow x Wetland: an honest non-human biped, all legs
  // and opinions, patrolling the shoreline where grass gives up
  // and becomes marsh. 45% — halfway to domesticated by
  // temperament, and it knows it. (Its Sedge Eggs are recorded
  // in the design as the roster's first egg — a later economy
  // slice lays them.)
  sedge_hen: {
    id: 'sedge_hen',
    name: 'Sedge Hen',
    profile: 'bird',
    tameChance: 0.45,
    bait: 'nectar',
    petName: 'Sedge Hen',
    byproduct: null,
    bonusSpawn: {
      biomes: ['meadow', 'wetland'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      speed: 1.7,
      speedJitter: 0.15,
      health: 20,
    },
  },

  // #55 — Meadow x Living: the valley's opposition and its
  // manners — goat herds trim the hello-vines back, so in a
  // Welcoming valley the hello stays a hello, and in a Hungry
  // one the grab gets trimmed before it finishes. 60%: it was
  // halfway the valley's pet already. (The trimming office
  // itself is a later behavior slice.)
  valley_goat: {
    id: 'valley_goat',
    name: 'Valley Goat',
    profile: 'grazer',
    tameChance: 0.6,
    bait: 'nectar',
    petName: 'Valley Goat',
    byproduct: null,
    bonusSpawn: {
      biomes: ['meadow', 'living'],
      count: 2,
      minRadius: 12,
      spacing: 5,
      speed: 1.3,
      speedJitter: 0.1,
      health: 60,
    },
  },

  // #57 — the Soft-Puff's deliberate mirror, re-imagined by the
  // steadiest cold: same round body, wholly other country. 70%
  // — in the family's killing cold, the tamest thing on the
  // roster waits at knee height. Sheds Puff Down wild or tame,
  // on its own calendar (the cold series' soft-answer rule).
  rime_puff: {
    id: 'rime_puff',
    name: 'Rime Puff',
    profile: 'grazer',
    tameChance: 0.7,
    bait: 'nectar',
    petName: 'Rime Puff',
    byproduct: { item: 'puff_down', seconds: 75, tamedOnly: false },
    bonusSpawn: {
      biomes: ['frost'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      speed: 1.5,
      speedJitter: 0.15,
      health: 30,
    },
  },

  // #32 — the Underroot's citizen: a dark-backed slug traveling
  // the undersides of roots, eating what grows where the light
  // gives up. Its slime trail glows faintly for hours — the
  // Underroot's breadcrumbs are laid by its animal. 45%: it
  // follows a carried light slowly, to eat what the light
  // wakes. (Trail-glow and the Gloom Gel yield are later
  // slices; the slug itself ships whole.)
  gloom_slug: {
    id: 'gloom_slug',
    name: 'Gloom Slug',
    profile: 'slug',
    tameChance: 0.45,
    bait: 'nectar',
    petName: 'Gloom Slug',
    byproduct: null,
    bonusSpawn: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 10,
      spacing: 4,
      speed: 0.4, // the honest slowest, shared with a snail in amber
      speedJitter: 0.05,
      health: 25,
    },
  },

  // #116 — the Warm Range's doorstep animal: a basker keeping a
  // daily circuit of stones, each lizard a small solar
  // calendar, and the Dew Gnat's second check. 30% — warm-hand
  // learning: it will sit on a still, warm gauntlet.
  sun_lizard: {
    id: 'sun_lizard',
    name: 'Sun Lizard',
    profile: 'lizard',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Sun Lizard',
    byproduct: null,
    bonusSpawn: {
      biomes: ['ember', 'saltglass', 'meadow'],
      count: 2,
      minRadius: 8,
      spacing: 4,
      speed: 1.6,
      speedJitter: 0.3,
      health: 18,
    },
  },

  // #118 — the Wet Range's slow citizen: a pond-edge turtle,
  // precisely lily-sized trouble, whose parliaments are
  // basking logs. 50% — the oldest pet-shape there is.
  mud_turtle: {
    id: 'mud_turtle',
    name: 'Mud Turtle',
    profile: 'turtle',
    tameChance: 0.5,
    bait: 'nectar',
    petName: 'Mud Turtle',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland', 'meadow', 'rootwood'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 0.7,
      speedJitter: 0.05,
      health: 35,
    },
  },

  // #180 — the Wetland's great grazer: hippo-hearted, pondweed-
  // draped, belly-deep in the wade for hours, grazing the
  // submerged meadows with its head under for a minute at a
  // time. 50%, placid and immovable.
  bog_cow: {
    id: 'bog_cow',
    name: 'Bog Cow',
    profile: 'grazer',
    tameChance: 0.5,
    bait: 'nectar',
    petName: 'Bog Cow',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland', 'meadow'],
      count: 2,
      minRadius: 12,
      spacing: 6,
      speed: 0.9,
      speedJitter: 0.05,
      health: 130,
    },
  },

  // ------------------------------------------------------------------
  // Slice 3 (2026-10-15) — Wetland / Rootwood / Fungal casts, and
  // the first VARIANT-GATED spawns (the biome-unique layer).
  // ------------------------------------------------------------------

  // #4 — the Fungal emblem: an antlered grazer in open symbiosis
  // with fungus — shelf fungus grows on its antlers in seeded
  // patterns, and it defends one compost grove. 25%, the
  // stalker's number: trust here is a season, not a snack. (Its
  // tame antler harvest and spore-trail growth nudge are later
  // slices; the stag itself ships whole.)
  spore_stag: {
    id: 'spore_stag',
    name: 'Spore Stag',
    profile: 'grazer',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Spore Stag',
    byproduct: null,
    bonusSpawn: {
      biomes: ['fungal'],
      count: 1,
      minRadius: 14,
      spacing: 8,
      speed: 1.0, // slow, deliberate, almost silent for its size
      speedJitter: 0.05,
      health: 90,
    },
  },

  // #6 — the Fungal Hollow's one-off: a fungus COLONY living in
  // a giant hollow shroom shell — the colony is the creature.
  // Stationary scenery by day, walking very slowly by night;
  // fully timid, wild forever (you cannot tame a colony in a
  // house). Deals ONLY in Hollow zones — the first variant-
  // gated species. (Its dawn-gift encounter — stillness, dim
  // light, a Hollow Heart Spore left at the base — is a later
  // behavior slice.)
  hollow_hermit: {
    id: 'hollow_hermit',
    name: 'Hollow Hermit',
    profile: 'colony',
    tameChance: null,
    bait: null,
    petName: 'Hollow Hermit',
    byproduct: null,
    bonusSpawn: {
      biomes: ['fungal'],
      variant: 'fungal_hollow',
      count: 1,
      minRadius: 10,
      spacing: 8,
      speed: 0.3, // slowest on the roster
      speedJitter: 0.02,
      health: 60,
    },
  },

  // #33 — the Rootfall's resident: a moss-grown bear that
  // inherited a fallen giant's hollow heart, defended with
  // enormous reluctance and total conviction, in that order.
  // 20%, over days — a landlord negotiation. It cracks
  // heartroot nuts at the hollow mouth and leaves Heart Sap
  // as rent: shed wild, collectable without waking him, if
  // you're quiet. (The item already exists — the Heartbloom's
  // harvest; the bear is its second door.) Deals ONLY in
  // Rootfall zones.
  rootfall_bear: {
    id: 'rootfall_bear',
    name: 'Rootfall Bear',
    profile: 'territorial',
    tameChance: 0.2,
    bait: 'nectar',
    petName: 'Rootfall Bear',
    byproduct: { item: 'heart_sap', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['rootwood'],
      variant: 'rootwood_rootfall',
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.0, // none, then all of it, once
      speedJitter: 0.05,
      health: 160,
    },
  },

  // #24 — the Mulchwood's farmer: a dome-backed beetle carrying
  // a tended fungus comb, harvesting trimmings to feed it and
  // eating its fruit — the meadow's surplus becomes the fungal
  // country's food on six legs. 40%: a beetle that farms
  // understands an offering. (Its compost-engine burrows are a
  // later economy slice.)
  mulch_beetle: {
    id: 'mulch_beetle',
    name: 'Mulch Beetle',
    profile: 'insect',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Mulch Beetle',
    byproduct: null,
    bonusSpawn: {
      biomes: ['meadow', 'fungal'],
      count: 2,
      minRadius: 8,
      spacing: 3,
      speed: 1.5,
      speedJitter: 0.15,
      health: 10,
    },
  },

  // #25 — the Brine Shallows' postcard: a serene wader held
  // high and dry on six salt-crystal stilts it renews by
  // standing in brine — when it renews them, the shed crystals
  // are SALTGLASS SHARD (the family's shard, one more door).
  // 35%: it approves of still, patient players, being one.
  brine_stilt: {
    id: 'brine_stilt',
    name: 'Brine Stilt',
    profile: 'bird',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Brine Stilt',
    byproduct: { item: 'saltglass_shard', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['wetland', 'saltglass'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 1.1, // slow, stately
      speedJitter: 0.05,
      health: 30,
    },
  },

  // #162 — Wetland x Living: a throat-fanned frog whose call
  // is a GREETING, answered antiphonally across the marsh at
  // dusk — the Greeter's mirror-law at frog scale. 50%:
  // reciprocal calling is the method; it will chorus from a
  // homestead pond within a season of being sung to. (In a
  // Hungry-fed marsh the design calls from BEHIND you — the
  // ventriloquism is a later behavior slice.)
  hello_frog: {
    id: 'hello_frog',
    name: 'Hello Frog',
    profile: 'amphibian',
    tameChance: 0.5,
    bait: 'nectar',
    petName: 'Hello Frog',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland', 'living'],
      count: 3, // a chorus, not a soloist
      minRadius: 8,
      spacing: 3,
      speed: 2.4, // burst
      speedJitter: 0.3,
      health: 12,
    },
  },

  // #177 — the sometimes-below band's siesta citizen: it hunts
  // under the pool's surface and sleeps above it, in a raft of
  // its own foam moored to reeds. 45%.
  foam_frog: {
    id: 'foam_frog',
    name: 'Foam Frog',
    profile: 'amphibian',
    tameChance: 0.45,
    bait: 'nectar',
    petName: 'Foam Frog',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland', 'ember'],
      count: 2,
      minRadius: 8,
      spacing: 3,
      speed: 1.6,
      speedJitter: 0.2,
      health: 12,
    },
  },

  // #179 — the roster's most Earth-honest citizen, named for
  // the real animal without embarrassment: a fin-legged
  // mudflat walker with strict personal bubbles and territorial
  // displays like a puppet theater. 35%: it will take food
  // from a still hand, and judges the hand's stillness as the
  // whole exam.
  mudskipper: {
    id: 'mudskipper',
    name: 'Mudskipper',
    profile: 'amphibian',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Mudskipper',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland', 'saltglass'],
      count: 2,
      minRadius: 8,
      spacing: 3,
      speed: 1.8,
      speedJitter: 0.2,
      health: 10,
    },
  },

  // #182 — the water column's refusal to be a place: a thick-
  // skinned fish that crosses LAND between pools at night in
  // rain, on pectorals like elbows, with total commitment — it
  // startles more travelers than any predator in the family.
  // Its territory includes a commute. 40%: keep its
  // destination pool clean and its road unblocked.
  landfish: {
    id: 'landfish',
    name: 'Landfish',
    profile: 'amphibian',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Landfish',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland'],
      count: 1,
      minRadius: 12,
      spacing: 6,
      speed: 1.1, // slow on land; the design respects both gaits
      speedJitter: 0.1,
      health: 30,
    },
  },

  // ------------------------------------------------------------------
  // Slice 4 (2026-10-15) — emblems + variant one-offs of the far
  // families: Ember, Saltglass, Frost, Bone, Storm.
  // ------------------------------------------------------------------

  // #5 — the Ember emblem: the danger-leaning one, a true
  // predator — coiled stillness, then burst speed; it does not
  // wander, it WAITS, then it MOVES. Tameability LOWEST of the
  // emblems at 15%, and the design says some individuals are
  // effectively wild forever. Sheds Cinder Scales while
  // basking — carapace's hot-country cousin. (Its hunt — burst
  // ambushes from vent steam on Normal/Hostile, the ticking-
  // scale tell on Peaceful — rides the danger behavior slice;
  // v1 ships the hound on the standard lure flow.)
  cinderhound: {
    id: 'cinderhound',
    name: 'Cinderhound',
    profile: 'predator',
    tameChance: 0.15,
    bait: 'nectar',
    petName: 'Cinderhound',
    byproduct: { item: 'cinder_scale', seconds: 180, tamedOnly: false },
    // The emblem hunts (slice 5): burst ambushes from vent
    // steam on armed worlds; on Peaceful its scales tick and
    // glow as it notices you — the alert IS the tell.
    hunt: { aggroRange: 9, damage: 10, biteRange: 1.8, biteCooldownSeconds: 1.4 },
    bonusSpawn: {
      biomes: ['ember'],
      count: 1,
      minRadius: 14,
      spacing: 8,
      speed: 2.8, // burst speed; its stillness is the sim's wander pauses
      speedJitter: 0.1,
      health: 100,
    },
  },

  // #7 — the Saltglass emblem: a crystalline grazer whose
  // minerals accrete into its plates as it ages — the
  // material's verb, on an animal. Where the grazers stand
  // frozen, it is the dangerous bright hour; where they feed,
  // it is safe to be out. 30% (the design's resonance taming
  // is a later refinement; v1 ships the lure). Shed plates
  // are SALTGLASS SHARD — the family's one shard economy.
  shard_grazer: {
    id: 'shard_grazer',
    name: 'Shard Grazer',
    profile: 'grazer',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Shard Grazer',
    byproduct: { item: 'saltglass_shard', seconds: 240, tamedOnly: false },
    bonusSpawn: {
      biomes: ['saltglass'],
      count: 2, // small herds
      minRadius: 12,
      spacing: 6,
      speed: 1.0, // slow and placed — every step is also a listening
      speedJitter: 0.05,
      health: 100,
    },
  },

  // #27 — the Frost emblem: the steady cold made flesh —
  // unhurried in all weathers, a herd that rotates rest in
  // shifts so a Frost Stag is awake and watching at every
  // hour. 30%, and patience measured in days. Sheds Frost
  // Velvet from its antlers — the cold country's own
  // insulation, another soft thing given up willingly.
  frost_stag: {
    id: 'frost_stag',
    name: 'Frost Stag',
    profile: 'grazer',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Frost Stag',
    byproduct: { item: 'frost_velvet', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['frost'],
      count: 1,
      minRadius: 14,
      spacing: 8,
      speed: 1.1,
      speedJitter: 0.05,
      health: 140,
    },
  },

  // #16 — the Flats' clock: a glass-shelled crab, a light-
  // drinker that basks shell-up at noon storing glare and
  // glows faintly through the bitter night on the proceeds.
  // Crabs up and glowing means the safe hours; crabs buried
  // means the glare is lying. 35% — it trades approach for
  // shade. Sheds shell plates: SALTGLASS SHARD.
  glass_crab: {
    id: 'glass_crab',
    name: 'Glass Crab',
    profile: 'insect',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Glass Crab',
    byproduct: { item: 'saltglass_shard', seconds: 240, tamedOnly: false },
    bonusSpawn: {
      biomes: ['saltglass'],
      variant: 'saltglass_flats',
      count: 2,
      minRadius: 10,
      spacing: 4,
      speed: 1.6, // mid, bursty — sideways
      speedJitter: 0.25,
      health: 25,
    },
  },

  // #17 — freeze-thaw made into a neighbor: a blind, ice-
  // furred mole that lives the family's swing in its own
  // body — active in the warm hours, frozen stiff as a stone
  // at nightfall until the next thaw. 50% while thawed.
  // (The freeze itself is a later behavior slice; v1 ships
  // the mole awake.)
  thawmole: {
    id: 'thawmole',
    name: 'Thawmole',
    profile: 'rodent',
    tameChance: 0.5,
    bait: 'nectar',
    petName: 'Thawmole',
    byproduct: null,
    bonusSpawn: {
      biomes: ['saltglass'],
      variant: 'saltglass_thaw',
      count: 2,
      minRadius: 8,
      spacing: 3,
      speed: 0.9,
      speedJitter: 0.1,
      health: 15,
    },
  },

  // #28 — the Prism Beds' living prism: a translucent frog —
  // noon light through a Prism Frog comes out the other side
  // sorted into colors. 40%: the lure is shade in glare
  // country and a steady hand. Sheds its skin whole, in one
  // glassy piece: Prism Skin, sorted light for later craft.
  prism_frog: {
    id: 'prism_frog',
    name: 'Prism Frog',
    profile: 'amphibian',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Prism Frog',
    byproduct: { item: 'prism_skin', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['saltglass'],
      variant: 'saltglass_prism',
      count: 2,
      minRadius: 8,
      spacing: 3,
      speed: 2.2, // hop-fast, sit-still
      speedJitter: 0.3,
      health: 8,
    },
  },

  // #19 — the Graveyard's cleanliness, maintained: a white-
  // carapaced ant COLONY — bone dust that decided to move.
  // A carcass the ants take is bone-clean in days. Untameable
  // (the hive reason); dealt as a small river of individuals,
  // only in the Leviathan Graveyard. (Its Clean Bone receipt
  // — carrion left at the nest skull's eye socket — is a
  // later encounter slice.)
  skull_ants: {
    id: 'skull_ants',
    name: 'Skull Ants',
    profile: 'colony',
    tameChance: null,
    bait: null,
    petName: 'Skull Ants',
    byproduct: null,
    bonusSpawn: {
      biomes: ['bone'],
      variant: 'leviathan_graveyard',
      count: 4,
      minRadius: 8,
      spacing: 2,
      speed: 1.2, // flowing
      speedJitter: 0.2,
      health: 3,
    },
  },

  // #20 — compass trouble with a face: a faceted geode-body
  // that travels by ROLLING — downhill is travel, uphill is a
  // project. It eats the dunes' magnetic strangeness and
  // wears the receipt. 30%: taming is a roller that has
  // chosen your slope as its rest hollow. Sheds crust
  // flakes: Lodestone Sand. (The roll itself is drawn as
  // travel in v1; the tumbling animation is later polish.)
  dune_roller: {
    id: 'dune_roller',
    name: 'Dune Roller',
    profile: 'radial',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Dune Roller',
    byproduct: { item: 'lodestone_sand', seconds: 200, tamedOnly: false },
    bonusSpawn: {
      biomes: ['storm'],
      variant: 'magnetic_dunes',
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 1.8, // wind-and-slope fast, self-slow
      speedJitter: 0.2,
      health: 40,
    },
  },

  // #63 — the Bonefields' contemporary: an ancient tortoise,
  // fragment-laden and moss-grown, crossing the fragment
  // country the way weather crosses it — and arriving. It
  // farms its own back by walking (fragments lodge, moss
  // takes them, the tortoise grazes the moss). 40%, with the
  // roster's strangest follow: it sets out toward its person
  // and arrives when it arrives. Sheds Field Scutes on the
  // circuit — distinct from the Fen Scute, on purpose.
  boneback_tortoise: {
    id: 'boneback_tortoise',
    name: 'Boneback Tortoise',
    profile: 'turtle',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Boneback Tortoise',
    byproduct: { item: 'field_scute', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['bone'],
      variant: 'bonefields',
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 0.35, // slowest on the roster — and the roster has a slug
      speedJitter: 0.02,
      health: 150,
    },
  },

  // #64 — the Marrow Flats' generosity with legs: a pale,
  // bone-antlered deer, the healthiest-looking animal in a
  // family of scavengers. Its antler-rubbing is the economy —
  // rub-sites leave gatherable BONE MEAL, the biome program's
  // item, at a second door. 35%: win the herd's matriarch and
  // the flats' whole herd is at least polite.
  marrow_deer: {
    id: 'marrow_deer',
    name: 'Marrow Deer',
    profile: 'grazer',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Marrow Deer',
    byproduct: { item: 'bone_meal', seconds: 240, tamedOnly: false },
    bonusSpawn: {
      biomes: ['bone'],
      variant: 'marrow_flats',
      count: 2,
      minRadius: 12,
      spacing: 5,
      speed: 1.6,
      speedJitter: 0.15,
      health: 70,
    },
  },

  // #66 — Ember x Saltglass: a star-bodied crawler that walks
  // by TIPPING point-to-point, starfish logic at walking
  // speed, on pans where heat fuses glass underfoot. UNTA-
  // MABLE — there is no approach it recognizes as an approach.
  // It leaves a shed point now and then, like a tooth of
  // glass: SALTGLASS SHARD, the shard economy's fifth door,
  // from the hybrid country this time.
  kiln_star: {
    id: 'kiln_star',
    name: 'Kiln Star',
    profile: 'radial',
    tameChance: null,
    bait: null,
    petName: 'Kiln Star',
    byproduct: { item: 'saltglass_shard', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['ember', 'saltglass'],
      count: 1,
      minRadius: 12,
      spacing: 6,
      speed: 0.6, // tipping-slow; its geometry is its pace
      speedJitter: 0.05,
      health: 45,
    },
  },

  // ------------------------------------------------------------------
  // Slice 5 (2026-10-15) — THE DANGER SLICE: the hunt system
  // generalizes off the stalker's species key onto the table,
  // and the bench's first hunters ride it. Doctrine (pass 12):
  // every danger has a readable tell — here it is the alert,
  // a wild hunter stopping to face you inside its aggro range;
  // on Peaceful that regard is the whole event, and on armed
  // worlds the chase and bite behind it are real.
  // ------------------------------------------------------------------

  // #132 — the roster's first true PACK hunter: a fang pack
  // runs the Stag herds' rotation like auditors run books.
  // Tameability 10%, the Bench's floor, and the entry is blunt
  // about the method: not the pack, never the pack — a lone
  // yearling, over a winter. Dealt as a pack of three, denning
  // in the Ice Fangs (variant gate; the pack's hunting circuit
  // ranges the Stillwhite in the design's prose).
  fangwolf: {
    id: 'fangwolf',
    name: 'Fangwolf',
    profile: 'predator',
    tameChance: 0.1,
    bait: 'nectar',
    petName: 'Fangwolf',
    byproduct: null,
    hunt: { aggroRange: 10, damage: 9, biteRange: 1.8, biteCooldownSeconds: 1.1 },
    bonusSpawn: {
      biomes: ['frost'],
      variant: 'frost_fangs',
      count: 3, // a pack, dealt together
      minRadius: 14,
      spacing: 3,
      speed: 3.0, // pursuit-fast; endurance over burst
      speedJitter: 0.15,
      health: 80,
    },
  },

  // #131 — the family's ground itself, armed: a scorpion
  // under the crust, defensive-aggressive, whose tail and
  // claws are grown saltglass. Untameable. Its molted tail-
  // segments work as SALTGLASS SHARD — the shard economy's
  // seventh door, mined from a hazard's leavings.
  salt_scorpion: {
    id: 'salt_scorpion',
    name: 'Salt Scorpion',
    profile: 'predator',
    tameChance: null,
    bait: null,
    petName: 'Salt Scorpion',
    byproduct: { item: 'saltglass_shard', seconds: 300, tamedOnly: false },
    hunt: { aggroRange: 6, damage: 11, biteRange: 1.7, biteCooldownSeconds: 1.5 },
    bonusSpawn: {
      biomes: ['saltglass'],
      count: 1,
      minRadius: 12,
      spacing: 6,
      speed: 1.5, // a sting's speed in a slow body
      speedJitter: 0.1,
      health: 55,
    },
  },

  // #128 — Ember's answer to "what hunts here?": a slag
  // serpent of the Drift and the Scar, a ripple of heat-
  // shimmer before it is a snake. Ambush-aggressive, strike-
  // fast, untameable. (Its ash-devil surfacing spiral — the
  // optical tell — is later polish; the alert carries the
  // doctrine in v1.)
  slag_serpent: {
    id: 'slag_serpent',
    name: 'Slag Serpent',
    profile: 'serpent',
    tameChance: null,
    bait: null,
    petName: 'Slag Serpent',
    byproduct: null,
    hunt: { aggroRange: 8, damage: 12, biteRange: 2.0, biteCooldownSeconds: 1.6 },
    bonusSpawn: {
      biomes: ['ember'],
      count: 1,
      minRadius: 14,
      spacing: 8,
      speed: 2.4,
      speedJitter: 0.1,
      health: 95,
    },
  },

  // #130 — the glare, hunting: a refractive cat that hunts at
  // high noon when its coat works and the glare blinds
  // everything else. Untameable (it can be baited into shadow
  // a moment, which the entry records as a trick, not a
  // friendship). Sheds Prism Hair in its shadow-tracks,
  // gathered at dawn — an ambient wild shed, at dawn's pace.
  prism_cat: {
    id: 'prism_cat',
    name: 'Prism Cat',
    profile: 'predator',
    tameChance: null,
    bait: null,
    petName: 'Prism Cat',
    byproduct: { item: 'prism_hair', seconds: 300, tamedOnly: false },
    hunt: { aggroRange: 9, damage: 10, biteRange: 1.7, biteCooldownSeconds: 1.2 },
    bonusSpawn: {
      biomes: ['saltglass'],
      count: 1,
      minRadius: 12,
      spacing: 6,
      speed: 3.0, // stillness and explosions
      speedJitter: 0.15,
      health: 50,
    },
  },

  // #124 — the Wetland's stillness, with an author: a log-
  // bodied ambusher that owns one pool utterly. At rest it IS
  // a drowned log; the tell is the pool's small life going
  // quiet. Untameable, and the heaviest bite on the bench —
  // an ambusher's whole speed budget, spent at once. (Dealt
  // on the marsh's ground in v1; pool-anchored placement is
  // the water slice's refinement.)
  fen_lurker: {
    id: 'fen_lurker',
    name: 'Fen Lurker',
    profile: 'predator',
    tameChance: null,
    bait: null,
    petName: 'Fen Lurker',
    byproduct: null,
    hunt: { aggroRange: 6, damage: 14, biteRange: 2.0, biteCooldownSeconds: 1.6 },
    bonusSpawn: {
      biomes: ['wetland'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 2.6,
      speedJitter: 0.1,
      health: 120,
    },
  },

  // #127 — fluency as menace: a long-legged widow of the
  // Hollow who webs GLOW GRUBS into her snares alive, so her
  // hunting webs glow exactly like safe fungal ground
  // lighting. The tell: her webs' glow doesn't flicker — real
  // grub light breathes. Untameable. (The webs themselves —
  // and Widow Silk from abandoned ones — are a later slice;
  // the widow ships first.)
  hollow_widow: {
    id: 'hollow_widow',
    name: 'Hollow Widow',
    profile: 'predator',
    tameChance: null,
    bait: null,
    petName: 'Hollow Widow',
    byproduct: null,
    hunt: { aggroRange: 7, damage: 9, biteRange: 1.8, biteCooldownSeconds: 1.3 },
    bonusSpawn: {
      biomes: ['fungal'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 2.2,
      speedJitter: 0.1,
      health: 45,
    },
  },

  // #126 — the groves' weather: a walking grove of fruiting
  // towers, placid until STARTLED — a startled sporeback
  // CHARGES, and the charge is area denial as a panic reflex.
  // Profile stays grazer (its verbs are a grazer's); the hunt
  // carries the charge. 10% — taming as an etiquette exam:
  // never, ever surprise it. (The spore-cloud answer and the
  // Peaceful stop-short are later polish; the charge itself
  // rides the hunt in v1.)
  sporeback: {
    id: 'sporeback',
    name: 'Sporeback',
    profile: 'grazer',
    tameChance: 0.1,
    bait: 'nectar',
    petName: 'Sporeback',
    byproduct: null,
    hunt: { aggroRange: 7, damage: 10, biteRange: 2.2, biteCooldownSeconds: 2.0 },
    bonusSpawn: {
      biomes: ['fungal'],
      count: 1,
      minRadius: 14,
      spacing: 8,
      speed: 1.1, // glacial, until it isn't
      speedJitter: 0.05,
      health: 160,
    },
  },

  // ------------------------------------------------------------------
  // Slice 6 (2026-10-15) — THE AERIAL SLICE: the table learns
  // flight (see SpeciesFlight), and the sky's cast lands.
  // ------------------------------------------------------------------

  // #9 — the Bone emblem, a glider shipped as a glider: a
  // bare-headed, broad-winged scavenger whose circling MARKS
  // what explorers want — carcasses, graveyards, leviathan
  // bones. 20%, and time-gated in spirit: it respects
  // PROVISION over attempts (v1 ships the lure; the carrion
  // economy is a later slice). Sheds Grave Feathers at roosts
  // — patience loot, the vesper pattern at the opposite end
  // of the size axis.
  bonepicker: {
    id: 'bonepicker',
    name: 'Bonepicker',
    profile: 'glider',
    tameChance: 0.2,
    bait: 'nectar',
    petName: 'Bonepicker',
    byproduct: { item: 'grave_feather', seconds: 300, tamedOnly: false },
    flight: { altitude: 2.4, bobHeight: 0.35, bobRate: 0.9, flapRate: 1.1 },
    bonusSpawn: {
      biomes: ['bone'],
      count: 2, // where something has died, the pickers assemble
      minRadius: 12,
      spacing: 6,
      speed: 2.2, // the wind's pace
      speedJitter: 0.15,
      health: 40,
    },
  },

  // #10 — the Storm emblem: the creature that is MOSTLY WING,
  // a slight body on a huge span with a ribbon tail that is
  // rudder, anchor-line, and signature. 25% — the design's
  // path is a perch (build high, in open wind, and a kite may
  // adopt it); v1 ships the lure and keeps the perch for a
  // later behavior slice. Sheds Kite Ribbons at its anchors.
  storm_kite: {
    id: 'storm_kite',
    name: 'Storm Kite',
    profile: 'glider',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Storm Kite',
    byproduct: { item: 'kite_ribbon', seconds: 300, tamedOnly: false },
    flight: { altitude: 3.0, bobHeight: 0.4, bobRate: 1.1, flapRate: 1.4 },
    bonusSpawn: {
      biomes: ['storm'],
      count: 1,
      minRadius: 14,
      spacing: 8,
      speed: 2.6, // the wind's, for better and worse
      speedJitter: 0.2,
      health: 35,
    },
  },

  // #129 — the Scar's chimney-keeper: a soot-sailed drake
  // that dive-hunts the vent fields. It rides slice 5's hunt
  // from the air — the chase is drawn at altitude, the bite
  // lands the same. 10%, by provision at ITS vent, over
  // weeks. THE TELL (design): its shadow crosses the vent
  // steam before the dive; in v1 the alert carries it.
  vent_drake: {
    id: 'vent_drake',
    name: 'Vent Drake',
    profile: 'flyer',
    tameChance: 0.1,
    bait: 'nectar',
    petName: 'Vent Drake',
    byproduct: null,
    hunt: { aggroRange: 10, damage: 11, biteRange: 2.0, biteCooldownSeconds: 1.5 },
    flight: { altitude: 2.6, bobHeight: 0.35, bobRate: 1.4, flapRate: 2.2 },
    bonusSpawn: {
      biomes: ['ember'],
      count: 1,
      minRadius: 14,
      spacing: 8,
      speed: 2.8, // fast in the dive, lazy in the climb
      speedJitter: 0.15,
      health: 55,
    },
  },

  // #30 — the Fangs' second set of teeth, soft ones: a huge-
  // eared bat of the spire ledges, a colony animal — it bonds
  // to a ROOST, not a person (colony-logic taming; v1 ships
  // the lure at the design's 20%). Sheds Spire Down from the
  // roost floor — insulation-kin to Frost Velvet, the cold
  // answered at two scales, stag and bat. Shares the Fangs
  // with the fangwolf pack, which is the design's own joke:
  // the eruption, still going on at night, on wings.
  spire_bat: {
    id: 'spire_bat',
    name: 'Spire Bat',
    profile: 'flyer',
    tameChance: 0.2,
    bait: 'nectar',
    petName: 'Spire Bat',
    byproduct: { item: 'spire_down', seconds: 240, tamedOnly: false },
    flight: { altitude: 1.8, bobHeight: 0.3, bobRate: 3.2, flapRate: 6.5 },
    bonusSpawn: {
      biomes: ['frost'],
      variant: 'frost_fangs',
      count: 3, // a colony's overflow
      minRadius: 10,
      spacing: 3,
      speed: 3.0,
      speedJitter: 0.25,
      health: 10,
    },
  },

  // #61 — the Graveyard's courier: a pale, grave-quiet moth,
  // the treaty's third signatory — it eats Bonemoss spores
  // and carries them bone to bone on dusted wings. Untamable
  // by smallness; the Graveyard's small citizens are staff,
  // not stock. No drops.
  dust_moth: {
    id: 'dust_moth',
    name: 'Dust Moth',
    profile: 'flyer',
    tameChance: null,
    bait: null,
    petName: 'Dust Moth',
    byproduct: null,
    flight: { altitude: 1.1, bobHeight: 0.25, bobRate: 2.4, flapRate: 5.0 },
    bonusSpawn: {
      biomes: ['bone'],
      count: 3, // loose dusk companies over the bones
      minRadius: 8,
      spacing: 3,
      speed: 1.2, // flutter and settle
      speedJitter: 0.2,
      health: 4,
    },
  },
};

/** The one lookup every shared system uses. */
export function speciesDef(id: FaunaSpecies): SpeciesDef {
  return SPECIES[id];
}

/** Route-3 species (generic bonus spawns), in table order. */
export const BONUS_SPAWN_SPECIES: SpeciesDef[] = Object.values(SPECIES).filter(
  (def) => def.bonusSpawn !== null,
);
