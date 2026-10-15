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
  | 'hare';     // burst-fast prey animal (pale_hare)

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
   *  family both count, the same admixture rule the census uses. */
  biomes: BiomeId[];
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
};

/** The one lookup every shared system uses. */
export function speciesDef(id: FaunaSpecies): SpeciesDef {
  return SPECIES[id];
}

/** Route-3 species (generic bonus spawns), in table order. */
export const BONUS_SPAWN_SPECIES: SpeciesDef[] = Object.values(SPECIES).filter(
  (def) => def.bonusSpawn !== null,
);
