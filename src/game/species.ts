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
  | 'hare'      // burst-fast prey animal (pale_hare)
  | 'insect'    // tiny background life (dew_gnat, glint_beetle)
  | 'bird'      // ground birds with opinions (sedge_hen)
  | 'amphibian' // water-edge small life (ember_newt)
  | 'slug'      // the slow end of the world (gloom_slug)
  | 'lizard'    // baskers and darters (sun_lizard)
  | 'turtle'    // unhurried to the template's limit (mud_turtle)
  | 'colony'    // the colony is the creature (hollow_hermit)
  | 'territorial' // defends one place, reluctantly (rootfall_bear)
  | 'radial';   // no front to be curious with (kiln_star)

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
};

/** The one lookup every shared system uses. */
export function speciesDef(id: FaunaSpecies): SpeciesDef {
  return SPECIES[id];
}

/** Route-3 species (generic bonus spawns), in table order. */
export const BONUS_SPAWN_SPECIES: SpeciesDef[] = Object.values(SPECIES).filter(
  (def) => def.bonusSpawn !== null,
);
