// ============================================================================
// worldGen.ts — seeded surface generation for NEW worlds
// ============================================================================
//
// The first generation algorithm to graduate from the gen lab into the
// game (Adam's rule: one algorithm at a time, proven in-game before the
// next joins). This is the lab's winning HYBRID, simplified for in-game
// counts:
//
//   * POSITIONS come from noise-clustered scatter — a seeded fbm noise
//     field decides where ground is "grove-worthy", so plants clump into
//     groves and creatures into loose herds instead of confetti.
//   * SPECIES PLACEMENT follows the distance rule — each species has a
//     near/far weight pair, so friendly staples hug the spawn point and
//     the hazardous / predatory species live far out. Danger and
//     strangeness rise with distance from home (Adam's gradient).
//
// Two deliberate deviations from the lab, both for gameplay safety at the
// game's small shipped counts (8 flora / 5 fauna):
//
//   * The species CENSUS is fixed (the same multiset the hand-placed
//     starter world always had), instead of rolled stochastically. A
//     purely rolled mix at n=5 could deal a world with no chitin stalker
//     — or three. The distance weights decide WHERE each guaranteed
//     creature lives, not WHETHER it exists. (At future higher densities
//     the census can relax back to rolled weights.)
//   * A lantern-fern guarantee: the light economy needs lantern ferns
//     within reach of spawn, whatever the dice said. At lab densities
//     this was a conversion pass; at n=8 converting plants wrecked the
//     census (one test seed lost its only sap weaver AND still ended
//     with no fern in range — all eight plants had clustered far away).
//     So the guarantee is BY CONSTRUCTION here: the two ferns are placed
//     first, on a seeded ring around spawn, before the groves scatter.
//
// Everything derives from the world's seed string via independent rng
// streams (positions / species / decoration), so the same seed always
// grows the same world, and tuning one stream never reshuffles another.
// Generation runs ONCE, at world creation; the resulting entities are
// what get saved — saves never regenerate.
//
// THE BIOME LAYER (P2) runs inside this scatter at ZONE scope (Adam's
// per-zone model): the zone being generated has ONE biome — its
// identity (zones.ts) — and that biome's density multipliers gate the
// scatter while its affinity factor shapes species placement, for the
// whole zone uniformly. Every generated entity is stamped with the
// zone's biome. (v2 briefly stamped per-point biomes from a noise
// field inside the zone; Adam corrected the model to per-zone the
// same day, and v3 supersedes it.)
// ============================================================================

import { createNoise2D, createSeededRandom, hashStringToSeed } from './motion';
import { biomeDensityFactor, biomeWeightFactor } from './biomes';
import type { BiomeId } from './biomes';
import { zoneBiomeAt, zoneVariantAt, zoneHybridAt, zoneWeatherAt, livingHeartAt } from './zones';
import { BONUS_GROW_FLORA } from './flora';
import type { FaunaEntity, FaunaSpecies, FloraEntity, FloraSpecies, StructureEntity } from '../types/game';
import { generateCaveSurface, HOMESTEAD_BLOCKERS } from './caveSurface';
import { fateForWorld, generateZoneRuins, FATE_STYLES } from './ruins';
import { BONUS_SPAWN_SPECIES } from './species';
import { zonePondsAt, zoneRiversAt, landformHeightAt } from './terrain';
import type { PondDef, RiverSeg } from './terrain';

/**
 * Stamp recorded on saves so future format/gen changes can migrate.
 * v1: the hybrid scatter (positions + distance species rule).
 * v2: + the biome layer, per-point (superseded within the day).
 * v3: biome layer at zone scope — one biome per zone (zones.ts).
 * v4: + cave mouths on the surface (P3 surface half, caveSurface.ts).
 * v5: + ruin landmarks (P4 surface stage, ruins.ts) — fate-styled,
 *     hop-scaled; existing saves keep their snapshots and simply
 *     never grow ruins (mouths behaved the same at v4).
 * v6: + species affinities (P2 graduation) and the radar species.
 * v7: + zone travel — the scatter streams are ZONE-MIXED for every
 *     zone except the spawn zone, whose streams keep their legacy
 *     names so home generates byte-identically forever (zone travel,
 *     2026-10-15). Before v7 every zone would have grown the same
 *     layout in a different species cast; nobody had ever generated
 *     a second zone, so the sameness was theoretical until travel.
 * v16: + designed species (creature build phase, slice 1, 2026-10-15)
 *     — generic BONUS spawns dealt from the species table
 *     (src/game/species.ts) outside the census, biome-gated, never in
 *     the spawn zone; the census promise is untouched, exactly like
 *     the radar species at v6. Existing saves keep their snapshots.
 * v17: creature build phase, slice 2 (2026-10-15) — twelve more
 *     designed species in the table, incl. the first 'all'-affinity
 *     bonus spawn (the Dew Gnat, the everywhere pest). Table-only
 *     change; the generator learns nothing new but the word 'all'.
 * v18: creature build phase, slice 3 (2026-10-15) — nine more
 *     species, and the bonus loop learns the VARIANT GATE: a
 *     species whose table entry names a variant deals only there
 *     (Hollow Hermit in fungal_hollow, Rootfall Bear in
 *     rootwood_rootfall) — the biome-unique layer, in code.
 * v19: creature build phase, slice 4 (2026-10-15) — eleven more
 *     species (three far emblems + six variant one-offs riding
 *     the gate). Table-only change; the generator learns nothing.
 * v20: creature build phase, slice 5 (2026-10-15) — seven danger-
 *     bench hunters join the table (the hunt system itself lives
 *     in the sim hooks, not here). Table-only change again.
 * v21: creature build phase, slice 6 (2026-10-15) — five aerial
 *     species join the table (the flight system lives in the
 *     mesh kit, not here). Table-only change again.
 * v22: creature build phase, slice 7 (2026-10-15) — eleven
 *     ground-cast species join the table, incl. both Living
 *     valley-face one-offs riding the variant gate. Table-only.
 * v23: creature build phase, slice 8 (2026-10-15) — the bonus
 *     loop learns two gates (hybrid pair, zone weather) and
 *     eleven species join the table through them and the far
 *     ranges. The gates are generic: future hybrid and
 *     weather-locked species are table entries, not new code.
 * v24: creature build phase, slice 9 (2026-10-15) — THE FLORA
 *     PIPELINE: a flora table (flora.ts) + a generic bonus-growth
 *     loop beside the fauna one, harvest yields as table data.
 *     Twelve wave-1 species grow through it.
 * v25: creature build phase, slice 10 (2026-10-16) — flora
 *     wave 2: twelve more table species (Bone/Storm/Living
 *     casts, three hybrid citizens). Table-only change.
 * v26: creature build phase, slice 11 (2026-10-16) — the
 *     fauna wave: twelve species on the proven rails (pack
 *     hunt, hybrid gates, rib-height and canopy draws).
 *     Table-only change.
 * v27: creature build phase, slice 12 (2026-10-16) — flora
 *     wave 3: twelve more table species (four hybrid citizens,
 *     the gardeners' Forged fungus, the marsh's second mirror).
 *     Table-only change.
 * v28: creature build phase, slice 13 (2026-10-16) — fauna
 *     wave 2, the small skies: twelve wide-range songbirds and
 *     small fry on the four range sets. Table-only change.
 * v29: creature build phase, slice 14 (2026-10-16) — flora
 *     wave 4, the fungus bench: twelve table species; also
 *     corrects two wave-3 variant gates that were typo'd
 *     ('ice_fangs'/'vent_fields' never matched a variant id,
 *     so Fang Fern and Vent Rose never dealt).
 * v30: creature build phase, slice 15 (2026-10-16) — fauna
 *     wave 3: twelve species incl. the first stationary fauna
 *     (Stillmouth, speed 0 by design) and two vapor citizens
 *     (Fog Calf, Mote Swarm). Table-only change.
 * v31: creature build phase, slice 16 (2026-10-16) — flora
 *     wave 5, the rose bench: twelve table species (a rose for
 *     every country that would have one, plus the sky pond,
 *     the banner, the wrong bloom). Table-only change.
 * v32: creature build phase, slice 17 (2026-10-16) — fauna
 *     wave 4: twelve species incl. three bench hunters
 *     (Bonebreaker, Zot Serpent, Ironjaw) and the Brambleback,
 *     the Hedge Rose's planter. Table-only change.
 * v33: creature build phase, slice 18 (2026-10-16) — flora
 *     wave 6: twelve species incl. the Raincatcher, the Arch
 *     Tree, the Maw Bloom, and the Grabvine. Table-only.
 * v34: creature build phase, slice 19 (2026-10-16) — flora
 *     wave 7: the meadow bench and the roadsides (Noonflower,
 *     Lambswool, Coalwood, Roadweed and kin). Table-only.
 * v35: creature build phase, slice 20 (2026-10-16) — fauna
 *     wave 5: the worms and the margins (Ironworm, Steam Eel,
 *     Shardwing, Threshold Hound and kin). Table-only change.
 * v36: creature build phase, slice 21 (2026-10-16) — flora
 *     wave 8, the fungus bench I: twelve species (Bog Jelly,
 *     Root Cup, Static Cap, Hearth Cap, Scar Cap and kin).
 *     Table-only change.
 * v37: creature build phase, slice 22 (2026-10-16) — fauna
 *     wave 6: the winged ranges and the wisps (Hearth Wisp,
 *     Deck Weaver, Lake Glider, Walking Root and kin).
 *     Table-only change.
 * v38: creature build phase, slice 23 (2026-10-16) — flora
 *     wave 9, the fungus bench II: twelve species (Strike Cap,
 *     Basin Puff, Prism Cap, Song Cap, Gloom Cap and kin).
 *     Table-only change.
 * v39: creature build phase, slice 24 (2026-10-16) — fauna
 *     wave 7, the landmark wave: the last land-legal fauna
 *     (Row Tender — emblems 11/11 — Feral Tender, Feral
 *     Warden, Storm Roc, Heartling and kin). What remains is
 *     gated on systems: pond-locked swimmers, oversize tier.
 *     Table-only change.
 * v40: creature build phase, slice 25 (2026-10-16) — flora
 *     wave 10, the cap bench: twelve fungus species (Row Cap,
 *     Wild Cap, Rib Cap, Iron Cap, Sun Cap and kin).
 *     Table-only change.
 * v41: creature build phase, slice 26 (2026-10-16) — flora
 *     wave 11, the fungus tail: twelve species (Mist Cap,
 *     Tool Cap, Night Cap, Trail Cap, Great Puff and kin).
 *     Flora meshes split: floraMeshesLate.ts inaugurated.
 *     Table-only change.
 * v42: creature build phase, slice 27 (2026-10-16) — flora
 *     wave 12: the trees, vines and mosses (Answer Tree,
 *     Relic Tree, Ironwood, Row Moss, Gloam Fern and kin).
 *     Table-only change.
 * v43: creature build phase, slice 28 (2026-10-16) — flora
 *     wave 13: the orchids, reeds and candles (Night Candle,
 *     Scar Orchid, Feral Rose, Bone Orchid, Snow Cress and
 *     kin). Table-only change.
 * v44: creature build phase, slice 29 (2026-10-16) — flora
 *     wave 14, THE FINAL flora wave: the last twelve land
 *     species (Scald Fern, Mulch Rose, Brine Rose, Steam Cap
 *     and the molds). With this version the LAND ROSTER IS
 *     COMPLETE — 325 of 358 designed species in game. What
 *     remains is gated on Adam's calls: the landscape flora
 *     trio, Lake Jelly + the pond fauna (pond system), and
 *     the oversize tier. Table-only change.
 * v45: creature build phase, slice 30 (2026-10-16) — THE
 *     OVERSIZE TIER, fauna side: eleven landscape and huge
 *     citizens (Grass Leviathan, Cloud Whale, Storm
 *     Leviathan, Garden Colossus, Sleeping Mountain, Glass
 *     Behemoth, Old Marrow, Winter Mother, Dune Whale,
 *     Great Hermit, Tempest Worm). Opened by Adam's proceed
 *     with the scale calls delegated (one per zone, far,
 *     slow, heavy, untameable). The Lake Leviathan stays
 *     with the pond group. Table-only change.
 * v46: creature build phase, slice 31 (2026-10-16) — THE
 *     LANDSCAPE FLORA TRIO: Valley Heart, Mother Grove and
 *     First Tree — LANDSCAPE presences on the plant side,
 *     harvest-null, one per zone, at the flora table's
 *     maximum scale. With this version 338 of the 358
 *     designed species are in game; only the pond group
 *     (~20) remains, gated on ponds existing as data.
 *     Table-only change.
 * v47: creature build phase, slice 32 (2026-10-16) — THE
 *     OVERSIZE PIN (Adam): the oversize tier is chill until
 *     the player messes with them — provokedOnly hunts,
 *     stamped by player-side harm — and if killed they
 *     provide good loot: a table-driven killLoot field
 *     resolved in the shared death sweep beside the sample.
 *     Behavior + table change; generation itself unchanged.
 * v48: creature build phase, slice 33 (2026-10-16) — THE
 *     WARDEN'S RECEIPTS (Adam): the Feral Warden's glyph
 *     Requisition — the kill-drop deferred since slice 24 —
 *     rides the killLoot rail: destroy the Warden and its
 *     receipts drop beside the sample. One item, one table
 *     row; the last recorded creature debt is paid.
 * v49: creature build phase, slice 34 (2026-10-16) — THE
 *     BAILIFF (Adam): the Feral Warden is renamed FERAL
 *     BAILIFF ("too Minecrafty") — display name and codex
 *     only; the species id 'feral_warden' is unchanged, so
 *     saves, samples and vat recipes are untouched. The
 *     archetype it descends from reads Garden Keeper in the
 *     codex now, on its page and the Garden Colossus's.
 * v50: creature build phase, slice 35 (2026-10-16) — THE
 *     POND GATE (Adam's pond pin, P5 move 2): the bonus loops
 *     learn the pond gate — a species whose spec carries
 *     `pond` deals only into one of the zone's ponds
 *     (zonePondsAt, water in v1), only in landform worlds
 *     (the worldHasLandforms binding above), anchored at the
 *     pond with the sim clamping its world to the disc, and
 *     drawn at its swim depth under the surface. Wave A: the
 *     first eleven pond citizens. The swimmers have waited
 *     for water since the roster was drawn; the water is in.
 * v51: creature build phase, slice 36 (2026-10-16) — POND
 *     WAVE B: the last ten pond fauna (incl. the Lake
 *     Leviathan, the water epic) and the Lake Jelly fungus.
 *     With this landing the designed roster is COMPLETE:
 *     every one of the 358 designed species is in the game.
 * v52: creature build phase, slice 37 (2026-10-16) — the
 *     one-off ledger, first pass (Adam: "use your best
 *     judgement"): the Fen Lurker and Pool Snapper come home
 *     to ponds at last (pond-anchored, swimming); the Sedge
 *     Hen lays the roster's first egg (Sedge Egg shed); the
 *     Grave Owl's roost pellets shed Clean Bone — two
 *     economies the codex has promised since design week.
 *     Table-only; generation learns nothing new.
 * v53: creature build phase, slice 38 (2026-10-16) — the
 *     one-off ledger, second pass: the BLINK HARE blinks
 *     (most wander re-rolls arrive by vanish, in the sim) and
 *     the PLUNGE DUCK dives (a table-driven dive cycle —
 *     flight and swim alternate on the sim's phase clock).
 *     Behavior-only; generation learns nothing new.
 * v54: creature build phase, slice 39 (2026-10-16) — the
 *     HEARTH DOG arrives: it leaves the wild deal (the sim
 *     walks it in when a zone holds a heart tile — Adam's
 *     pin), keeps the doorstep, and bonds reversed (three
 *     offerings and the dog decides) or leaves undecided.
 *     Generation only stops dealing it; the rest is sim.
 * v55: creature build phase, slice 40 (2026-10-16) — the
 *     clock's first creature uses: HARVEST WINDOWS (Meltcap,
 *     Night Cap and Night Candle keep midnight; Sun Cap and
 *     Noonflower keep noon — the glove refuses out of the
 *     hour) and the DRIFT KRILL's night rise (mid-water by
 *     day, up under the film at midnight). Generation learns
 *     nothing new; the tables and the light changed.
 * v56: creature build phase, slice 41 (2026-10-16) — the
 *     RIVER GATE: the silver set (Silver Skater, Silverfin,
 *     Plated Crab, Silver Dipper) and the Mirror Heron deal
 *     along wet water river segments — their designs' named
 *     home since the pond group shipped them as a stand-in —
 *     anchored to a stretch of channel, with ponds kept as
 *     the fallback where no river runs wet. Lava rivers
 *     never qualify.
 * v57: creature build phase, slice 42 (2026-10-16) — one-
 *     offs III, on best judgement: the HOLLOW HERMIT keeps
 *     its schedule (still by day) and its dawn trade (a
 *     Hollow Heart Spore for a night of stillness); the MOON
 *     MOTH flies the Night Candle's road; the GLOOM SLUG
 *     sheds Gloom Gel where it crawls; PUFFBELLS puff on the
 *     hour, synchronized by the shared clock; BOILER CRABS
 *     vent steam. Generation learns nothing new.
 * v58: creature build phase, slice 43 (2026-10-16) — the
 *     HEARTH WISP certifies: wisps take up at hearthpods
 *     (the dev chat's flameless hearth, landed today), and
 *     HEARTH CAPS fruit only in a certified hearth's ash —
 *     the growth tick holds them at stage 3 otherwise.
 *     Behavior-only; generation learns nothing new.
 * v59: creature build phase, slice 44 (2026-10-16) — the
 *     ROOTFALL BEAR's landlord negotiation (courted with its
 *     own Heart Sap rent; provoked-only defense of the
 *     hollow) and the ROOT OTTER's bank (pond-dealt at last,
 *     swimming its circuit, caching bright treasure in the
 *     roots on a long clock). The otter's deal narrows to
 *     ponded Drowned Roots zones — its country, honestly.
 * v60: creature build phase, slice 45 (2026-10-16) — the
 *     MULCH BEETLE's compost engine turns over (finished
 *     compost at the burrow mouth: growth fertilizer, shed
 *     wild and tamed), and the TUMBLE SAGE travels: a ripe
 *     sage left unharvested lets go, rolls downwind shedding
 *     leaf, and re-roots — the Wind Plains' migration at
 *     garden scale. Behavior-only; generation unchanged.
 */
export const WORLD_GEN_VERSION = 60; // v49 (2026-10-16): creature slice 34 — Feral Warden renamed Feral Bailiff (display only); v48 was creature slice 33 (the Warden's Requisition)

// ---------------------------------------------------------------------------
// World shape + density (named constants — Tenet 10)
// ---------------------------------------------------------------------------

/** The world is a 100 m square; coordinates run -50..+50 on both axes. */
const WORLD_HALF_EXTENT = 50;
/** Spawn-to-corner distance; the "far" end of the distance gradient. */
const WORLD_MAX_DIST = Math.SQRT2 * WORLD_HALF_EXTENT;

/** Shipped density: same headcount as the old hand-placed starter world. */
const FLORA_COUNT = 8;
const FAUNA_COUNT = 5;

/** Placement spacing — matches the game's own rules (MIN_PLANT_SPACING). */
const FLORA_MIN_SPACING = 1.0;
const FAUNA_MIN_SPACING = 4.0;
/** Keep the spawn clearing empty so the player never materializes in a bush. */
const SPAWN_CLEAR_FLORA = 2.5;
const SPAWN_CLEAR_FAUNA = 3.0;

// Cluster-field knobs (from the lab's noiseClustered defaults): the field
// is sampled at position/scale, so one "grove" is roughly SCALE meters
// wide; THRESHOLD is where acceptance starts, SLOPE softens its edge.
const FLORA_CLUSTER_SCALE = 14;
const FAUNA_CLUSTER_SCALE = 22;
const CLUSTER_THRESHOLD = 0.32;
const CLUSTER_SLOPE = 0.28;
/** Placement attempts allowed per wanted entity before spacing relaxes. */
const MAX_ATTEMPTS_MULT = 200;

// Lantern-fern ring: the guaranteed ferns live on a ring this far from
// spawn — clear of the homestead, well inside a new player's first walk.
const FERN_RING_MIN_RADIUS = 6;
const FERN_RING_MAX_RADIUS = 16;

// ---------------------------------------------------------------------------
// Species tables — census (guaranteed headcount) + distance flavor
// ---------------------------------------------------------------------------

interface FloraSpeciesDef {
  species: FloraSpecies;
  count: number;
  baseWeight: number;
  /** Distance multipliers: weight at spawn vs at the far corners. */
  near: number;
  far: number;
  hazardous: boolean;
  /**
   * Biome affinity: 'all' = welcome in every biome. A list = the
   * species ONLY grows in those biomes (weight 0 elsewhere — a hard
   * rule, see biomes.ts) with a home bonus inside them. All shipped
   * species are 'all' for now, exactly as labbed; giving a species a
   * list later is a one-line table edit per species.
   */
  biomes: BiomeId[] | 'all';
}

interface FaunaSpeciesDef {
  species: FaunaSpecies;
  count: number;
  baseWeight: number;
  near: number;
  far: number;
  /** Shipped stat block, with a small seeded jitter on speed. */
  speed: number;
  speedJitter: number;
  health: number;
  /** Biome affinity — same rule as flora (see FloraSpeciesDef). */
  biomes: BiomeId[] | 'all';
}

// The census IS the shipped starter world's multiset:
// 2 ferns, 2 bell blooms, 2 petal mills, 1 sap weaver, 1 snap trap.
//
// AFFINITIES (Adam, 2026-10-14 — the species↔biome pass): the biomes
// lists below are now REAL. In wild zones a listed species deals ONLY
// in its biomes (the affinity gate in generateSeededWorld drops it
// elsewhere — its slots stay undealt, so off-affinity zones simply
// grow a little sparser, with a flora cast that tells you where you
// are). The SPAWN zone is the one exception: the homestead is
// cultivated ground and always deals the classic census above, so
// the first session's economy is unchanged — affinities govern the
// wild beyond the yard.
const FLORA_CENSUS: FloraSpeciesDef[] = [
  { species: 'lantern_fern', count: 2, baseWeight: 0.28, near: 1.8, far: 0.25, hazardous: false, biomes: 'all' },
  { species: 'bell_bloom', count: 2, baseWeight: 0.22, near: 1.2, far: 0.8, hazardous: false, biomes: ['meadow', 'wetland', 'precursor'] },
  { species: 'petal_mill', count: 2, baseWeight: 0.20, near: 0.9, far: 1.15, hazardous: false, biomes: ['meadow', 'fungal', 'rootwood', 'living'] },
  { species: 'sap_weaver', count: 1, baseWeight: 0.18, near: 0.6, far: 1.4, hazardous: false, biomes: ['fungal', 'ember', 'rootwood', 'precursor'] },
  { species: 'snap_trap', count: 1, baseWeight: 0.12, near: 0.03, far: 2.4, hazardous: true, biomes: ['wetland', 'fungal'] },
];

// 2 soft-puffs, 2 burrow mice, 1 chitin stalker — the shipped five.
const FAUNA_CENSUS: FaunaSpeciesDef[] = [
  { species: 'soft_puff', count: 2, baseWeight: 0.45, near: 1.6, far: 0.35, speed: 1.7, speedJitter: 0.1, health: 40, biomes: ['meadow', 'wetland', 'rootwood', 'living'] },
  { species: 'burrow_mouse', count: 2, baseWeight: 0.35, near: 1.0, far: 1.0, speed: 1.85, speedJitter: 0.15, health: 30, biomes: 'all' },
  { species: 'chitin_stalker', count: 1, baseWeight: 0.20, near: 0.03, far: 2.6, speed: 2.4, speedJitter: 0, health: 120, biomes: ['ember', 'fungal'] },
];

// ---------------------------------------------------------------------------
// Small deterministic helpers (ported from the gen lab)
// ---------------------------------------------------------------------------

/** Derive an independent stream seed so jobs never share a dice sequence. */
function streamSeed(seedStr: string, streamName: string): number {
  return hashStringToSeed(seedStr + ':' + streamName);
}

function distFromSpawn(x: number, z: number): number {
  return Math.hypot(x, z);
}

function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

/** Smoothstep — softens the distance gradient's ends. */
function smooth01(t: number): number {
  const c = clamp01(t);
  return c * c * (3 - 2 * c);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * A two-octave fbm field over the game's seeded 2D noise. The lab's
 * cluster fields showed gentle multi-scale clumping reads best: one big
 * octave for grove placement, one smaller for ragged edges.
 */
function createClusterField(seed: number): (x: number, z: number) => number {
  const broad = createNoise2D(seed);
  const detail = createNoise2D(seed ^ 0x9e3779b9);
  return (x: number, z: number): number => {
    const v = broad(x, z) + 0.5 * detail(x * 2.1, z * 2.1);
    return v / 1.5; // renormalize back toward [-1, 1]
  };
}

// ---------------------------------------------------------------------------
// Position scatter — noise-clustered (ported from the lab, spacing enforced)
// ---------------------------------------------------------------------------

interface PlacedPoint {
  x: number;
  z: number;
}

interface ScatterResult {
  points: PlacedPoint[];
  /** Points that could only be placed by relaxing the spacing rule. */
  relaxed: number;
}

function scatterClustered(
  rng: () => number,
  field: (x: number, z: number) => number,
  fieldOffsetX: number,
  fieldOffsetZ: number,
  target: number,
  scale: number,
  minSpacing: number,
  spawnClear: number,
  blockers: PlacedPoint[] = [],
  densityAt?: (x: number, z: number) => number,
): ScatterResult {
  // Acceptance: how "grove-worthy" is this point? Field value mapped to
  // 0..1, then a soft threshold — deep-field points almost always accept,
  // barren points almost never do, edges are a coin weighted by depth.
  // The BIOME LAYER multiplies that by the biome's density factor for
  // this kind: groves thicken in fertile biomes and thin out on harsh
  // ground, whatever the noise field said (clamped back to a probability).
  const acceptP = (x: number, z: number): number => {
    const n = field(x / scale + fieldOffsetX, z / scale + fieldOffsetZ);
    const t = (n + 1) / 2;
    const grove = smooth01((t - CLUSTER_THRESHOLD) / CLUSTER_SLOPE);
    return clamp01(grove * (densityAt ? densityAt(x, z) : 1));
  };
  const propose = (): PlacedPoint => ({
    x: (rng() * 2 - 1) * WORLD_HALF_EXTENT,
    z: (rng() * 2 - 1) * WORLD_HALF_EXTENT,
  });

  const points: PlacedPoint[] = [];
  const min2 = minSpacing * minSpacing;
  const clear2 = spawnClear * spawnClear;
  const maxAttempts = target * MAX_ATTEMPTS_MULT;
  let attempts = 0;

  const clearOfSpawn = (p: PlacedPoint): boolean => p.x * p.x + p.z * p.z >= clear2;
  const clearOfOthers = (p: PlacedPoint): boolean =>
    [...points, ...blockers].every((q) => {
      const dx = p.x - q.x;
      const dz = p.z - q.z;
      return dx * dx + dz * dz >= min2;
    });

  while (points.length < target && attempts < maxAttempts) {
    attempts++;
    const p = propose();
    if (rng() > acceptP(p.x, p.z)) continue; // not grove enough
    if (!clearOfSpawn(p)) continue;
    if (!clearOfOthers(p)) continue;
    points.push(p);
  }

  // Safety valve (the lab's relaxation policy): the census is a promise,
  // so if spacing starved the quota we fill the remainder ignoring the
  // spacing rule — and count them, so tuning can see it happen. At the
  // shipped counts on a 100 m field this should never engage.
  let relaxed = 0;
  while (points.length < target) {
    const p = propose();
    if (!clearOfSpawn(p)) continue;
    points.push(p);
    relaxed++;
  }

  return { points, relaxed };
}

// ---------------------------------------------------------------------------
// Species assignment — census headcount, distance-weighted placement
// ---------------------------------------------------------------------------

/**
 * How much a species "wants" a point at this distance: base weight
 * blended from its near multiplier (at spawn) to its far multiplier (at
 * the corners) along a smoothed distance ramp.
 */
function distanceWeight(def: { baseWeight: number; near: number; far: number }, x: number, z: number): number {
  const r = smooth01(distFromSpawn(x, z) / WORLD_MAX_DIST);
  return def.baseWeight * lerp(def.near, def.far, r);
}

/**
 * Deal species onto points. Far-specialists pick FIRST (their good
 * points are the scarce ones), each taking a weighted-random point from
 * those remaining, weight = distance affinity. Every point is used at
 * most once; every census slot is filled.
 */
function assignSpecies<T extends { near: number; far: number; count: number }>(
  points: PlacedPoint[],
  census: T[],
  rng: () => number,
  weightOf: (def: T, p: PlacedPoint) => number,
): { def: T; point: PlacedPoint }[] {
  const remaining = [...points];
  const ordered = [...census].sort((a, b) => b.far - b.near - (a.far - a.near));
  const dealt: { def: T; point: PlacedPoint }[] = [];

  for (const def of ordered) {
    for (let i = 0; i < def.count && remaining.length > 0; i++) {
      // Weighted pick without replacement from the remaining points.
      // A weight of exactly 0 means "this species cannot live here"
      // (biome exclusivity) — those points are EXCLUDED while any legal
      // point remains. The tiny floor applies only when NO legal point
      // is left, because the census is a promise: a guaranteed creature
      // must live somewhere, even somewhere it dislikes.
      const rawWeights = remaining.map((p) => Math.max(weightOf(def, p), 0));
      const anyLegal = rawWeights.some((w) => w > 0);
      let total = 0;
      const weights = rawWeights.map((w) => {
        const effective = anyLegal ? w : 0.0001;
        total += effective;
        return effective;
      });
      let roll = rng() * total;
      let idx = 0;
      while (idx < weights.length - 1 && roll > weights[idx]) {
        roll -= weights[idx];
        idx++;
      }
      dealt.push({ def, point: remaining[idx] });
      remaining.splice(idx, 1);
    }
  }
  return dealt;
}

// ---------------------------------------------------------------------------
// The lantern-fern ring — the spawn light guarantee, by construction
// ---------------------------------------------------------------------------

/**
 * Place the guaranteed lantern ferns on a seeded ring around spawn.
 * The second fern sits roughly opposite the first (±0.6 rad of jitter),
 * so the pair never clumps and spawn has grown light on two sides.
 */
function placeFernRing(rng: () => number): PlacedPoint[] {
  const radius = (): number => FERN_RING_MIN_RADIUS + rng() * (FERN_RING_MAX_RADIUS - FERN_RING_MIN_RADIUS);
  const r1 = radius();
  const a1 = rng() * Math.PI * 2;
  const r2 = radius();
  const a2 = a1 + Math.PI + (rng() * 1.2 - 0.6);
  return [
    { x: Math.cos(a1) * r1, z: Math.sin(a1) * r1 },
    { x: Math.cos(a2) * r2, z: Math.sin(a2) * r2 },
  ];
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface GeneratedWorld {
  flora: FloraEntity[];
  fauna: FaunaEntity[];
  /** World-grown structures (v4: cave mouths; v5: + ruin landmarks).
   *  The caller merges these with the fixed starter structures —
   *  they're wilderness, not homestead, but they ride the same
   *  structures/save/sync pipeline. */
  structures: StructureEntity[];
  /** Placements that needed the spacing safety valve (expect 0). */
  relaxedPlacements: number;
}

/**
 * Grow one ZONE's flora and fauna from the world seed string.
 * Same seed + same zone -> same growth, always. Called at world
 * creation for the spawn zone (0, 0) and again per zone the first
 * time a traveler arrives (zone travel, 2026-10-15); the result is
 * saved as concrete entities. The zone coordinates decide the zone's
 * biome (zones.ts) — the spawn zone is always a meadow.
 */
export function generateSeededWorld(seedStr: string, zoneZx = 0, zoneZz = 0, opts?: { landform?: boolean }): GeneratedWorld {
  // Pond life gate (P5 move 2, Adam, 2026-10-16): pond-gated
  // species may only be sown where ponds can honestly exist —
  // landform worlds (created after the landform epoch). Callers
  // that generate on a world's behalf pass the truth; guest and
  // sync paths omit it and stay dry by default. Consumed by the
  // species gates (creatures build) via this binding.
  const worldHasLandforms = opts?.landform === true;
  // This zone's ponds, resolved lazily on the first pond-gated
  // species (pond build, creatures chat, 2026-10-16): pond life
  // deals only into them, and only in landform worlds at all —
  // legacy worlds have no ponds to give. Water is v1's only
  // liquid; the liquid check rides the resolver's field so
  // later liquids gate by name, not by new code.
  let zonePonds: PondDef[] | null = null;
  const pondsHere = (): PondDef[] => {
    if (!worldHasLandforms) return [];
    if (zonePonds === null) {
      zonePonds = zonePondsAt(seedStr, zoneZx, zoneZz).filter((p) => p.liquid === 'water');
    }
    return zonePonds;
  };
  // This zone's WET WATER river segments, resolved lazily like
  // the ponds (river gate, slice 41, 2026-10-16): a segment
  // qualifies when its liquid is water (ember's lava rivers
  // never do) and its level stands above the carved channel at
  // its midpoint — the same wet test the renderer applies, so
  // river life is dealt exactly where water actually shows.
  let zoneRiverSegs: RiverSeg[] | null = null;
  const riverSegsHere = (): RiverSeg[] => {
    if (!worldHasLandforms) return [];
    if (zoneRiverSegs === null) {
      zoneRiverSegs = zoneRiversAt(seedStr, zoneZx, zoneZz).filter((s) => {
        if (s.liquid !== 'water') return false;
        const mx = (s.x1 + s.x2) / 2;
        const mz = (s.z1 + s.z2) / 2;
        return s.waterY > landformHeightAt(seedStr, mx, mz) + 0.05;
      });
    }
    return zoneRiverSegs;
  };
  // The zone's single biome — its identity — drives every biome rule
  // below for the whole zone.
  const zoneBiome: BiomeId = zoneBiomeAt(seedStr, zoneZx, zoneZz);
  // The zone's VARIANT, when it rolled one (biome graph, 2026-10-15):
  // density deltas and variant-only life hang off this below.
  // The margin check (2026-10-15): a hybrid zone takes the
  // hybrid INSTEAD of a variant — the border identity is the
  // stronger fact about the place (zones.ts zoneHybridAt).
  const zoneHybrid = zoneHybridAt(seedStr, zoneZx, zoneZz);
  const zoneVariant = zoneHybrid ? null : zoneVariantAt(seedStr, zoneZx, zoneZz);
  const isSpawnZone = zoneZx === 0 && zoneZz === 0;
  // Per-zone dice (zone travel, 2026-10-15): until travel existed,
  // the streams below were seeded from the world seed ALONE — every
  // zone would have scattered the same layout, differing only in
  // species cast. Now each non-spawn zone mixes its coordinates into
  // every stream name, so each zone rolls its own dice. The SPAWN
  // zone keeps the legacy stream names untouched: home must generate
  // byte-identically forever (the first session's economy, the
  // harness goldens, and every existing world's identity ride on it).
  const stream = (name: string): number =>
    streamSeed(seedStr, isSpawnZone ? name : `${name}@${zoneZx},${zoneZz}`);
  // Independent streams per job: re-rolling positions must never reshuffle
  // species, and decoration (rotation/scale/speed jitter) touches neither.
  const floraPosRng = createSeededRandom(stream('flora:position:hybrid'));
  const faunaPosRng = createSeededRandom(stream('fauna:position:hybrid'));
  const floraSpRng = createSeededRandom(stream('flora:species'));
  const faunaSpRng = createSeededRandom(stream('fauna:species'));
  const decorRng = createSeededRandom(stream('decorate'));
  const fernRng = createSeededRandom(stream('flora:fern-ring'));

  // The guaranteed lantern ferns go down FIRST, on their ring; the grove
  // scatter then treats them as blockers so nothing crowds them out.
  const fernDef = FLORA_CENSUS.find((d) => d.species === 'lantern_fern')!;
  const fernPoints = placeFernRing(fernRng);
  const floraCensusRest = FLORA_CENSUS.filter((d) => d.species !== 'lantern_fern');

  // AFFINITY GATE (Adam, 2026-10-14): outside the spawn zone, a census
  // species whose affinity list excludes this zone's biome is NOT
  // dealt — its slots stay empty and the zone grows a little sparser,
  // with a cast that fits where you are. The spawn zone (0, 0) is
  // cultivated homestead ground and always deals the classic census,
  // so the first session's economy never changes.
  // (isSpawnZone is declared with the dice streams above.)
  // Hybrid admixture (2026-10-15): a margin zone's census opens
  // to BOTH families — the blend is in the cast list itself,
  // before any density or weight is applied.
  const censusMatch = (d: { biomes: BiomeId[] | 'all' }): boolean =>
    d.biomes === 'all' || d.biomes.includes(zoneBiome) || (zoneHybrid !== null && d.biomes.includes(zoneHybrid.secondary));
  const floraCensusHere = isSpawnZone
    ? floraCensusRest
    : floraCensusRest.filter(censusMatch);
  const faunaCensusHere = isSpawnZone
    ? FAUNA_CENSUS
    : FAUNA_CENSUS.filter(censusMatch);

  // One cluster field per kind, offset so flora groves and fauna herds
  // don't trace the same shapes.
  const floraField = createClusterField(stream('flora:cluster-field'));
  const faunaField = createClusterField(stream('fauna:cluster-field'));
  const floraOx = (stream('flora:ox') % 200) - 100;
  const floraOz = (stream('flora:oz') % 200) - 100;
  const faunaOx = (stream('fauna:ox') % 200) - 100;
  const faunaOz = (stream('fauna:oz') % 200) - 100;

  // The zone biome's density gates the scatter — one factor per kind
  // for the whole zone (flora and fauna densities differ per biome:
  // a fungal zone grows plants fine but its fauna runs sparse).
  const floraDensityAt = (): number => zoneHybrid
    ? ((biomeDensityFactor('flora', zoneBiome) + biomeDensityFactor('flora', zoneHybrid.secondary)) / 2) * zoneHybrid.def.floraDensityMult
    : biomeDensityFactor('flora', zoneBiome) * (zoneVariant?.floraDensityMult ?? 1);
  const faunaDensityAt = (): number => zoneHybrid
    ? ((biomeDensityFactor('fauna', zoneBiome) + biomeDensityFactor('fauna', zoneHybrid.secondary)) / 2) * zoneHybrid.def.faunaDensityMult
    : biomeDensityFactor('fauna', zoneBiome) * (zoneVariant?.faunaDensityMult ?? 1);

  const floraScatter = scatterClustered(
    floraPosRng, floraField, floraOx, floraOz,
    FLORA_COUNT - fernDef.count, FLORA_CLUSTER_SCALE, FLORA_MIN_SPACING, SPAWN_CLEAR_FLORA,
    fernPoints, floraDensityAt,
  );
  const faunaScatter = scatterClustered(
    faunaPosRng, faunaField, faunaOx, faunaOz,
    FAUNA_COUNT, FAUNA_CLUSTER_SCALE, FAUNA_MIN_SPACING, SPAWN_CLEAR_FAUNA,
    [], faunaDensityAt,
  );

  // Species want a point by distance AND by the zone's biome: the
  // distance weight (far specialists still pick first) times the biome
  // affinity factor for THIS zone (home bonus in listed biomes). The
  // AFFINITY GATE above has already removed the species that cannot
  // live here at all; the census fallback inside assignSpecies now
  // only covers placement scarcity among the species that can.
  const floraDealt: { def: FloraSpeciesDef; point: PlacedPoint }[] = [
    ...fernPoints.map((point) => ({ def: fernDef, point })),
    ...assignSpecies(floraScatter.points, floraCensusHere, floraSpRng, (def, p) =>
      // Hybrid zones weigh a species by the BETTER of its two
      // families' fits — margin life thrives from both sides.
      distanceWeight(def, p.x, p.z) * Math.max(biomeWeightFactor(def.biomes, zoneBiome), zoneHybrid ? biomeWeightFactor(def.biomes, zoneHybrid.secondary) : 0),
    ),
  ];
  const faunaDealt = assignSpecies(
    faunaScatter.points, faunaCensusHere, faunaSpRng, (def, p) =>
      distanceWeight(def, p.x, p.z) * Math.max(biomeWeightFactor(def.biomes, zoneBiome), zoneHybrid ? biomeWeightFactor(def.biomes, zoneHybrid.secondary) : 0),
  );

  // Build full entities with the shipped starter world's shape: mature,
  // harvest-ready flora (the first session's economy is unchanged — only
  // the map differs), wild fauna wandering from their spawn point.
  const flora: FloraEntity[] = floraDealt.map((d, i) => ({
    id: `flora_${i + 1}`,
    species: d.def.species,
    x: d.point.x,
    z: d.point.z,
    biome: zoneBiome,
    rotation: decorRng() * Math.PI * 2,
    scale: 0.95 + decorRng() * 0.35,
    growthStage: 3,
    growthProgress: 1,
    fertilizedGrowth: false,
    fertilizedYield: false,
    fertilizerTimer: 0,
    harvestReady: true,
    harvestTimer: 0,
    isHazardous: d.def.hazardous,
    swayOffset: i,
  }));

  const fauna: FaunaEntity[] = faunaDealt.map((d, i) => ({
    id: `fauna_${i + 1}`,
    species: d.def.species,
    x: d.point.x,
    z: d.point.z,
    biome: zoneBiome,
    y: 0,
    rotation: decorRng() * Math.PI * 2,
    state: 'wandering',
    isTamed: false,
    targetX: d.point.x,
    targetZ: d.point.z,
    speed: d.def.speed + (decorRng() * 2 - 1) * d.def.speedJitter,
    health: d.def.health,
    maxHealth: d.def.health,
    byproductTimer: 0,
    animTime: 0,
  }));

  // ---------------------------------------------------------------------
  // Radar species (2026-10-14) — biome-gated BONUS life, dealt outside
  // the census exactly like the cave glow clusters: the census is a
  // promise about the starter multiset and stays untouched.
  //   * Echo Reed grows ONLY in wetland zones (2 plants) — the radar's
  //     listening half lives where the ground is wet.
  //   * The Vesper Glider haunts meadow and fungal zones (1), but
  //     never the spawn zone: the homestead's five stay the shipped
  //     five, and the glider is a reason to walk one zone over.
  // ---------------------------------------------------------------------
  if (zoneBiome === 'wetland') {
    const echoRng = createSeededRandom(stream('flora:echoreed'));
    let plantedEcho = 0;
    for (let attempt = 0; attempt < 40 && plantedEcho < 2; attempt++) {
      const x = (echoRng() * 2 - 1) * 44;
      const z = (echoRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 8) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.2)) continue;
      flora.push({
        id: `flora_echo_${plantedEcho}`,
        species: 'echo_reed',
        x,
        z,
        biome: zoneBiome,
        rotation: echoRng() * Math.PI * 2,
        scale: 0.95 + echoRng() * 0.35,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 200 + plantedEcho,
      });
      plantedEcho++;
    }
  }
  if ((zoneBiome === 'meadow' || zoneBiome === 'fungal') && !(zoneZx === 0 && zoneZz === 0)) {
    const vesperRng = createSeededRandom(stream('fauna:vesper'));
    for (let attempt = 0; attempt < 40; attempt++) {
      const x = (vesperRng() * 2 - 1) * 44;
      const z = (vesperRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 10) continue;
      if (fauna.some((f) => Math.hypot(f.x - x, f.z - z) < 3)) continue;
      fauna.push({
        id: 'fauna_vesper_1',
        species: 'vesper_glider',
        x,
        z,
        biome: zoneBiome,
        y: 0,
        rotation: vesperRng() * Math.PI * 2,
        state: 'wandering',
        isTamed: false,
        targetX: x,
        targetZ: z,
        speed: 2.6 + (vesperRng() * 2 - 1) * 0.15,
        health: 50,
        maxHealth: 50,
        byproductTimer: 0,
        animTime: 0,
      });
      break;
    }
  }

  // ---------------------------------------------------------------------
  // Fungal Hollow giants (Adam's first variant, 2026-10-15) — variant-
  // gated BONUS life, dealt outside the census like the radar species:
  // in a Fungal Hollow zone, a stand of GIANT mushrooms rises among
  // the ordinary fungal cast — several kinds, as on Earth (Adam):
  // antenna'd sensers, an almost-faced kind, and flat shelf stacks
  // (the climbable kind, once climbing lands). All harvestable.
  // ---------------------------------------------------------------------
  if (zoneVariant?.id === 'fungal_hollow') {
    const hollowRng = createSeededRandom(stream('flora:hollowshrooms'));
    const hollowKinds: FloraSpecies[] = [
      'antenna_shroom', 'antenna_shroom', 'antenna_shroom', 'antenna_shroom', 'antenna_shroom',
      'visor_shroom', 'visor_shroom', 'visor_shroom', 'visor_shroom',
      'shelf_shroom', 'shelf_shroom', 'shelf_shroom',
    ];
    let plantedGiants = 0;
    for (let attempt = 0; attempt < 80 && plantedGiants < hollowKinds.length; attempt++) {
      const x = (hollowRng() * 2 - 1) * 44;
      const z = (hollowRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 10) continue; // giants never crowd the entry point
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.4)) continue;
      flora.push({
        id: `flora_hollow_${plantedGiants}`,
        species: hollowKinds[plantedGiants],
        x,
        z,
        biome: zoneBiome,
        rotation: hollowRng() * Math.PI * 2,
        scale: 1.7 + hollowRng() * 1.0, // giants: well above the ordinary cast
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 400 + plantedGiants,
      });
      plantedGiants++;
    }
  }

  // ---------------------------------------------------------------------
  // Hybrid signature stand (2026-10-15): whatever else the census
  // deals, a margin zone GUARANTEES a stand of the neighbor
  // family's emblem flora — the visible proof of the blend,
  // readable from the zone edge.
  // ---------------------------------------------------------------------
  if (zoneHybrid) {
    const SIGNATURE: Record<BiomeId, FloraSpecies> = {
      meadow: 'petal_mill', wetland: 'mirror_lily', fungal: 'antenna_shroom',
      ember: 'cinder_bloom', saltglass: 'prism_reed', frost: 'rime_spire',
      rootwood: 'heartroot', precursor: 'precursor_bloom', bone: 'gravebloom',
      storm: 'stormcatcher', living: 'dusk_grass',
    };
    const sigRng = createSeededRandom(stream('flora:hybridstand'));
    let plantedSig = 0;
    for (let attempt = 0; attempt < 50 && plantedSig < 5; attempt++) {
      const x = (sigRng() * 2 - 1) * 44;
      const z = (sigRng() * 2 - 1) * 44;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2)) continue;
      flora.push({
        id: `flora_hybrid_${plantedSig}`,
        species: SIGNATURE[zoneHybrid.secondary],
        x, z,
        biome: zoneBiome,
        rotation: sigRng() * Math.PI * 2,
        scale: 0.95 + sigRng() * 0.5,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 2100 + plantedSig,
      });
      plantedSig++;
    }
  }

  // ---------------------------------------------------------------------
  // Fungal fill-ins (2026-10-15): the WEB plants its giants in a
  // RING (the network made visible); the GLOWFEN grows cave
  // glow-fungus TOPSIDE; the GROVE stands its dead as stone.
  // ---------------------------------------------------------------------
  if (zoneVariant?.id === 'mycelium_web') {
    const webRng = createSeededRandom(stream('flora:webshrooms'));
    const webKinds: FloraSpecies[] = [
      'antenna_shroom', 'visor_shroom', 'shelf_shroom', 'antenna_shroom', 'shelf_shroom',
      'visor_shroom', 'antenna_shroom', 'shelf_shroom', 'visor_shroom', 'antenna_shroom',
    ];
    const wcx = (webRng() * 2 - 1) * 16;
    const wcz = (webRng() * 2 - 1) * 16;
    const wr = 9 + webRng() * 5;
    const wStart = webRng() * Math.PI * 2;
    let plantedWeb = 0;
    for (let i = 0; i < webKinds.length; i++) {
      const a = wStart + (i / webKinds.length) * Math.PI * 2;
      const x = wcx + Math.cos(a) * wr + (webRng() * 2 - 1) * 1.1;
      const z = wcz + Math.sin(a) * wr + (webRng() * 2 - 1) * 1.1;
      if (Math.abs(x) > 46 || Math.abs(z) > 46) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.2)) continue;
      flora.push({
        id: `flora_web_${plantedWeb}`,
        species: webKinds[i],
        x, z,
        biome: zoneBiome,
        rotation: webRng() * Math.PI * 2,
        scale: 1.6 + webRng() * 0.9,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 1900 + plantedWeb,
      });
      plantedWeb++;
    }
  }
  if (zoneVariant?.id === 'glowfen') {
    const fenRng = createSeededRandom(stream('flora:glowfen'));
    let plantedFen = 0;
    for (let attempt = 0; attempt < 50 && plantedFen < 6; attempt++) {
      const x = (fenRng() * 2 - 1) * 44;
      const z = (fenRng() * 2 - 1) * 44;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.7)) continue;
      flora.push({
        id: `flora_glowfen_${plantedFen}`,
        species: 'glow_fungus',
        x, z,
        biome: zoneBiome,
        rotation: fenRng() * Math.PI * 2,
        scale: 1.2 + fenRng() * 0.6,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 1950 + plantedFen,
      });
      plantedFen++;
    }
  }

  // ---------------------------------------------------------------------
  // Mirror Marsh life (Adam, 2026-10-15) — variant-gated BONUS life:
  // mirror lilies floating on their reflective pools (the pool IS
  // the lily's mesh — a silver disc under the pads), and pollinator
  // moths drifting over the water, drawn to the doubled light.
  // ---------------------------------------------------------------------
  if (zoneVariant?.id === 'mirror_marsh') {
    const marshRng = createSeededRandom(stream('flora:mirrorlily'));
    let plantedLilies = 0;
    for (let attempt = 0; attempt < 60 && plantedLilies < 8; attempt++) {
      const x = (marshRng() * 2 - 1) * 44;
      const z = (marshRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 8) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.2)) continue;
      flora.push({
        id: `flora_lily_${plantedLilies}`,
        species: 'mirror_lily',
        x,
        z,
        biome: zoneBiome,
        rotation: marshRng() * Math.PI * 2,
        scale: 1.0 + marshRng() * 0.5,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 500 + plantedLilies,
      });
      plantedLilies++;
    }
    const mothRng = createSeededRandom(stream('fauna:mirrormoth'));
    for (let m = 0; m < 3; m++) {
      for (let attempt = 0; attempt < 40; attempt++) {
        const x = (mothRng() * 2 - 1) * 44;
        const z = (mothRng() * 2 - 1) * 44;
        if (Math.hypot(x, z) < 10) continue;
        if (fauna.some((f) => Math.hypot(f.x - x, f.z - z) < 4)) continue;
        fauna.push({
          id: `fauna_moth_${m + 1}`,
          species: 'mirror_moth',
          x,
          z,
          biome: zoneBiome,
          y: 0,
          rotation: mothRng() * Math.PI * 2,
          state: 'wandering',
          isTamed: false,
          targetX: x,
          targetZ: z,
          speed: 1.1 + (mothRng() * 2 - 1) * 0.1, // slow drifters
          health: 30,
          maxHealth: 30,
          byproductTimer: 0,
          animTime: 0,
        });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Designed species (creature build phase, slice 1, 2026-10-15) —
  // GENERIC bonus spawns from the species table (species.ts). This is
  // the radar-species pattern generalized: biome-gated BONUS life dealt
  // outside the census, never in the spawn zone, one seeded stream per
  // species so tuning one species never reshuffles another. A species
  // joins the world by gaining a bonusSpawn entry in the table — no
  // new block here. Hybrid zones admit a species through EITHER family,
  // the same admixture rule the census uses (censusMatch above).
  // ---------------------------------------------------------------------
  if (!isSpawnZone) {
    for (const def of BONUS_SPAWN_SPECIES) {
      const spec = def.bonusSpawn;
      if (!spec) continue;
      const homeHere =
        spec.biomes === 'all' ||
        spec.biomes.includes(zoneBiome) ||
        (zoneHybrid !== null && spec.biomes.includes(zoneHybrid.secondary));
      if (!homeHere) continue;
      // Variant gate (slice 3): a variant-locked species deals only
      // in its named place — the biome-unique layer.
      if (spec.variant && zoneVariant?.id !== spec.variant) continue;
      // Hybrid gate (slice 8): a hybrid citizen deals ONLY in a
      // hybrid zone of its named family pair — the pure country of
      // either parent is not its home. (zoneHybrid is already
      // computed above; a hybrid zone carries no variant, so the
      // two gates can never both apply to one zone.)
      if (spec.hybrid) {
        if (!zoneHybrid) continue;
        const pairHere: BiomeId[] = [zoneHybrid.primary, zoneHybrid.secondary];
        if (!pairHere.includes(spec.hybrid[0]) || !pairHere.includes(spec.hybrid[1])) continue;
      }
      // Weather gate (slice 8): a weather-locked species deals
      // only where the zone's own sky agrees. zoneWeatherAt is
      // deterministic per zone (seed + coordinates), so this is
      // a placement rule, never a dice roll.
      if (spec.weather && zoneWeatherAt(seedStr, zoneZx, zoneZz).mode !== spec.weather) continue;
      // Pond gate (pond build, 2026-10-16): pond species deal
      // only into one of this zone's ponds. River gate (slice
      // 41): river species deal along the zone's wet water
      // segments — the named home — and fall back to ponds
      // (when they also carry the pond gate) where no wet
      // water runs. A river species with neither water in the
      // zone deals nowhere here.
      const ponds = spec.pond || spec.river ? pondsHere() : [];
      const riverSegs = spec.river ? riverSegsHere() : [];
      if (spec.pond && !spec.river && ponds.length === 0) continue;
      if (spec.river && riverSegs.length === 0 && (ponds.length === 0 || !spec.pond)) continue;
      const bonusRng = createSeededRandom(stream(`fauna:bonus:${def.id}`));
      let placed = 0;
      for (let attempt = 0; attempt < 40 && placed < spec.count; attempt++) {
        let x = (bonusRng() * 2 - 1) * 44;
        let z = (bonusRng() * 2 - 1) * 44;
        let pondAnchor: { x: number; z: number; radius: number } | undefined;
        if (riverSegs.length > 0) {
          // River placement: a seeded point along a wet water
          // segment, jittered a step toward the bank. The
          // anchor is that point and the clamp disc is a short
          // stretch of river (6 m) — the sim's pond clamp keeps
          // the citizen on its reach of the channel, swimmers
          // draw on the river's surface, and the flyers fish
          // the stretch they were dealt.
          const seg = riverSegs[Math.floor(bonusRng() * riverSegs.length)];
          const t = bonusRng();
          const wx = seg.x1 + (seg.x2 - seg.x1) * t;
          const wz = seg.z1 + (seg.z2 - seg.z1) * t;
          const jx = wx + (bonusRng() * 2 - 1) * 1.5;
          const jz = wz + (bonusRng() * 2 - 1) * 1.5;
          x = jx - zoneZx * 100;
          z = jz - zoneZz * 100;
          pondAnchor = { x: wx - zoneZx * 100, z: wz - zoneZz * 100, radius: 6 };
        } else if (spec.pond) {
          // Pond placement: inside the disc at a seeded angle and
          // depth — the pond is the home, so the zone-center
          // minRadius rule does not apply. The anchor + radius
          // are stamped on the entity for the sim's pond clamp.
          const pond = ponds[placed % ponds.length];
          const px = pond.cx - zoneZx * 100;
          const pz = pond.cz - zoneZz * 100;
          const ang = bonusRng() * Math.PI * 2;
          const rr = Math.sqrt(bonusRng()) * pond.radius * 0.7;
          x = px + Math.cos(ang) * rr;
          z = pz + Math.sin(ang) * rr;
          pondAnchor = { x: px, z: pz, radius: pond.radius };
        } else if (Math.hypot(x, z) < spec.minRadius) continue;
        if (fauna.some((f) => Math.hypot(f.x - x, f.z - z) < spec.spacing)) continue;
        fauna.push({
          id: `fauna_bonus_${def.id}_${placed + 1}`,
          species: def.id,
          x,
          z,
          biome: zoneBiome,
          y: 0,
          rotation: bonusRng() * Math.PI * 2,
          state: 'wandering',
          isTamed: false,
          targetX: x,
          targetZ: z,
          ...(pondAnchor
            ? { anchorX: pondAnchor.x, anchorZ: pondAnchor.z, pondRadius: pondAnchor.radius }
            : {}),
          speed: spec.speed + (bonusRng() * 2 - 1) * spec.speedJitter,
          health: spec.health,
          maxHealth: spec.health,
          byproductTimer: 0,
          animTime: 0,
        });
        placed++;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Designed flora + fungus (creature build phase, slice 9, 2026-10-15)
  // — GENERIC bonus growth from the flora table (flora.ts), the mirror
  // of the fauna bonus loop above: biome affinity + the same gates
  // (variant / hybrid pair / zone weather), dealt outside the census,
  // never in the spawn zone, one seeded stream per species. A flora
  // species joins the world by gaining a table entry — no new block
  // here. (The hand-placed variant dressing blocks below predate the
  // table and stay as they are.)
  // ---------------------------------------------------------------------
  if (!isSpawnZone) {
    for (const def of BONUS_GROW_FLORA) {
      const spec = def.bonusGrow;
      if (!spec) continue;
      const homeHere =
        spec.biomes === 'all' ||
        spec.biomes.includes(zoneBiome) ||
        (zoneHybrid !== null && spec.biomes.includes(zoneHybrid.secondary));
      if (!homeHere) continue;
      if (spec.variant && zoneVariant?.id !== spec.variant) continue;
      if (spec.hybrid) {
        if (!zoneHybrid) continue;
        const pairHere: BiomeId[] = [zoneHybrid.primary, zoneHybrid.secondary];
        if (!pairHere.includes(spec.hybrid[0]) || !pairHere.includes(spec.hybrid[1])) continue;
      }
      if (spec.weather && zoneWeatherAt(seedStr, zoneZx, zoneZz).mode !== spec.weather) continue;
      // Pond gate (pond build, 2026-10-16): the mirror of the
      // fauna gate — pond flora grows only in a pond.
      const ponds = spec.pond ? pondsHere() : [];
      if (spec.pond && ponds.length === 0) continue;
      const growRng = createSeededRandom(stream(`flora:bonus:${def.id}`));
      let planted = 0;
      for (let attempt = 0; attempt < 40 && planted < spec.count; attempt++) {
        let x = (growRng() * 2 - 1) * 44;
        let z = (growRng() * 2 - 1) * 44;
        if (spec.pond) {
          // Pond placement, flora edition: in the disc, toward
          // its heart (a pond fungus fruits in the water, not on
          // the bank) — no minRadius rule; the pond is the home.
          const pond = ponds[planted % ponds.length];
          const ang = growRng() * Math.PI * 2;
          const rr = Math.sqrt(growRng()) * pond.radius * 0.75;
          x = pond.cx - zoneZx * 100 + Math.cos(ang) * rr;
          z = pond.cz - zoneZz * 100 + Math.sin(ang) * rr;
        } else if (Math.hypot(x, z) < spec.minRadius) continue;
        if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < spec.spacing)) continue;
        flora.push({
          id: `flora_bonus_${def.id}_${planted + 1}`,
          species: def.id,
          x,
          z,
          biome: zoneBiome,
          rotation: growRng() * Math.PI * 2,
          scale: spec.scale * (0.8 + growRng() * 0.5),
          growthStage: 3 + Math.floor(growRng() * 2), // established or mature
          growthProgress: 1,
          fertilizedGrowth: false,
          fertilizedYield: false,
          fertilizerTimer: 0,
          harvestReady: true,
          harvestTimer: 0,
          isHazardous: def.hazardous ?? false,
          swayOffset: 3000 + planted * 7,
        });
        planted++;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Ember Scar cinder blooms (Adam, 2026-10-15) — variant-gated
  // BONUS life: flowers that grow on the vents themselves, drinking
  // the heat everything else suffers from.
  // ---------------------------------------------------------------------
  if (zoneVariant?.id === 'ember_scar') {
    const scarRng = createSeededRandom(stream('flora:cinderbloom'));
    let plantedBlooms = 0;
    for (let attempt = 0; attempt < 50 && plantedBlooms < 6; attempt++) {
      const x = (scarRng() * 2 - 1) * 44;
      const z = (scarRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 8) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.0)) continue;
      flora.push({
        id: `flora_cinder_${plantedBlooms}`,
        species: 'cinder_bloom',
        x,
        z,
        biome: zoneBiome,
        rotation: scarRng() * Math.PI * 2,
        scale: 1.1 + scarRng() * 0.5,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 600 + plantedBlooms,
      });
      plantedBlooms++;
    }
  }

  // ---------------------------------------------------------------------
  // Obsidian Garden blooms (2026-10-15) — variant-gated BONUS life:
  // black glass flowers fused by the old burning, source of the
  // obsidian_shard crafting material.
  // ---------------------------------------------------------------------
  if (zoneVariant?.id === 'obsidian_garden') {
    const gardenRng = createSeededRandom(stream('flora:obsidianbloom'));
    let plantedGlass = 0;
    for (let attempt = 0; attempt < 50 && plantedGlass < 6; attempt++) {
      const x = (gardenRng() * 2 - 1) * 44;
      const z = (gardenRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 8) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.0)) continue;
      flora.push({
        id: `flora_obsidian_${plantedGlass}`,
        species: 'obsidian_bloom',
        x,
        z,
        biome: zoneBiome,
        rotation: gardenRng() * Math.PI * 2,
        scale: 1.0 + gardenRng() * 0.5,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 700 + plantedGlass,
      });
      plantedGlass++;
    }
  }

  // ---------------------------------------------------------------------
  // Prism Beds reeds (Saltglass, 2026-10-15) — variant-gated BONUS
  // life: crystal reeds fused from salt and light, the source of
  // the saltglass_shard crafting material.
  // ---------------------------------------------------------------------
  if (zoneVariant?.id === 'saltglass_prism') {
    const prismRng = createSeededRandom(stream('flora:prismreed'));
    let plantedReeds = 0;
    for (let attempt = 0; attempt < 60 && plantedReeds < 7; attempt++) {
      const x = (prismRng() * 2 - 1) * 44;
      const z = (prismRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 8) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.0)) continue;
      flora.push({
        id: `flora_prism_${plantedReeds}`,
        species: 'prism_reed',
        x,
        z,
        biome: zoneBiome,
        rotation: prismRng() * Math.PI * 2,
        scale: 1.0 + prismRng() * 0.6,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 800 + plantedReeds,
      });
      plantedReeds++;
    }
  }

  // ---------------------------------------------------------------------
  // Ice Fangs spires (Frost, 2026-10-15) — variant-gated BONUS
  // life: standing ice formations, source of nevermelt ice.
  // ---------------------------------------------------------------------
  if (zoneVariant?.id === 'frost_fangs') {
    const fangRng = createSeededRandom(stream('flora:rimespire'));
    let plantedSpires = 0;
    for (let attempt = 0; attempt < 50 && plantedSpires < 6; attempt++) {
      const x = (fangRng() * 2 - 1) * 44;
      const z = (fangRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 8) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.2)) continue;
      flora.push({
        id: `flora_rime_${plantedSpires}`,
        species: 'rime_spire',
        x,
        z,
        biome: zoneBiome,
        rotation: fangRng() * Math.PI * 2,
        scale: 1.1 + fangRng() * 0.7,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 900 + plantedSpires,
      });
      plantedSpires++;
    }
  }

  // ---------------------------------------------------------------------
  // Heartroot stands (Rootwood, 2026-10-15) — family-wide BONUS
  // life: buttress root clusters, the heartwood source. Thickest
  // in the Rootfall, where a giant came down.
  // ---------------------------------------------------------------------
  if (zoneBiome === 'rootwood') {
    const rootRng = createSeededRandom(stream('flora:heartroot'));
    const target = zoneVariant?.id === 'rootwood_rootfall' ? 8
      : zoneVariant?.id === 'rootwood_canopy' ? 5
      : zoneVariant?.id === 'rootwood_underroot' ? 4 : 3;
    let plantedRoots = 0;
    for (let attempt = 0; attempt < 60 && plantedRoots < target; attempt++) {
      const x = (rootRng() * 2 - 1) * 44;
      const z = (rootRng() * 2 - 1) * 44;
      if (Math.hypot(x, z) < 8) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 2.4)) continue;
      flora.push({
        id: `flora_heartroot_${plantedRoots}`,
        species: 'heartroot',
        x,
        z,
        biome: zoneBiome,
        rotation: rootRng() * Math.PI * 2,
        scale: 1.1 + rootRng() * 0.6,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 1000 + plantedRoots,
      });
      plantedRoots++;
    }
  }

  // ---------------------------------------------------------------------
  // Precursor bloom SPIRALS (Precursor, 2026-10-15) — family-wide
  // BONUS life, planted in visible ORDER: an Archimedean spiral
  // around a seeded center, the gardeners' signature still
  // legible ten thousand years on. The Untended gets the same
  // spiral with feral jitter; the Tending Field the densest ring.
  // ---------------------------------------------------------------------
  if (zoneBiome === 'precursor') {
    const spiralRng = createSeededRandom(stream('flora:precursorbloom'));
    const count = zoneVariant?.id === 'precursor_tending' ? 12
      : zoneVariant?.id === 'precursor_garden' ? 9
      : zoneVariant?.id === 'precursor_untended' ? 7 : 6;
    const feral = zoneVariant?.id === 'precursor_untended';
    const cx = (spiralRng() * 2 - 1) * 18;
    const cz = (spiralRng() * 2 - 1) * 18;
    const startAngle = spiralRng() * Math.PI * 2;
    let plantedBlooms2 = 0;
    for (let i = 0; i < count; i++) {
      const t = i / Math.max(1, count - 1);
      const angle = startAngle + t * Math.PI * 3.2; // ~1.6 turns
      const radius = 2.5 + t * 9;
      const jitter = feral ? 1.6 : 0.25;
      const x = cx + Math.cos(angle) * radius + (spiralRng() * 2 - 1) * jitter;
      const z = cz + Math.sin(angle) * radius + (spiralRng() * 2 - 1) * jitter;
      if (Math.abs(x) > 46 || Math.abs(z) > 46) continue;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.2)) continue;
      flora.push({
        id: `flora_precursor_${plantedBlooms2}`,
        species: 'precursor_bloom',
        x,
        z,
        biome: zoneBiome,
        rotation: spiralRng() * Math.PI * 2,
        scale: 1.0 + spiralRng() * 0.4,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 1100 + plantedBlooms2,
      });
      plantedBlooms2++;
    }
  }

  // ---------------------------------------------------------------------
  // Cave mouths (P3, surface half) — grown LAST, once the surface they
  // must respect exists: mouths keep their footprint clear of the
  // homestead (spawn zone only — it's the only zone with one) and of
  // every plant and creature just dealt. The spawn zone always grows
  // exactly one mouth (caveSurface.ts) — a findable first cave.
  // ---------------------------------------------------------------------
  const caveBlockers = [
    ...(zoneZx === 0 && zoneZz === 0 ? HOMESTEAD_BLOCKERS : []),
    ...flora.map((f) => ({ x: f.x, z: f.z, radius: 0.6 })),
    ...fauna.map((f) => ({ x: f.x, z: f.z, radius: 1.2 })),
  ];
  const caveSection = generateCaveSurface(seedStr, {
    zoneZx,
    zoneZz,
    zoneBiome,
    blockers: caveBlockers,
  });
  const structures: StructureEntity[] = caveSection.mouths.map((m) => ({
    id: m.id,
    type: 'cave_mouth',
    gridX: Math.round(m.anchor.x / 2),
    gridZ: Math.round(m.anchor.z / 2),
    worldX: m.anchor.x,
    worldZ: m.anchor.z,
    rotation: m.anchor.facing,
    health: 9999,
    maxHealth: 9999,
    doorOpenProgress: 0,
    cave: {
      instanceId: m.instanceId,
      exitX: m.surfaceExitSpawn.x,
      exitZ: m.surfaceExitSpawn.z,
      dressing: m.dressing,
    },
  }));

  // ---------------------------------------------------------------------
  // Glow spore clusters — a REAL plant that keeps to cave mouths (Adam,
  // 2026-10-14: the blue spheres at the entrance should be harvestable,
  // not just dressing). Each mouth gets a small ring of living clusters
  // just outside its footprint, kept out of the approach corridor (you
  // don't have to harvest your way through the doorway) and a meter
  // clear of everything already growing. EXTRA flora, outside the zone
  // census — the census promise above is untouched.
  // ---------------------------------------------------------------------
  const caveFloraRng = createSeededRandom(stream('cave:flora'));
  const caveFlora: FloraEntity[] = [];
  for (const m of caveSection.mouths) {
    for (let k = 0; k < 4; k++) {
      for (let attempt = 0; attempt < 12; attempt++) {
        const angle = caveFloraRng() * Math.PI * 2;
        // Angular distance from the mouth's facing (the approach):
        // clusters never seed the doorway itself.
        const rel = Math.abs(((angle - m.anchor.facing) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
        if (rel < 0.6) continue;
        const r = 3.0 + caveFloraRng() * 1.8;
        const x = m.anchor.x + Math.cos(angle) * r;
        const z = m.anchor.z + Math.sin(angle) * r;
        if (Math.abs(x) > 48 || Math.abs(z) > 48) continue;
        const crowded = [...flora, ...caveFlora].some((f) => Math.hypot(f.x - x, f.z - z) < 1.0);
        if (crowded) continue;
        caveFlora.push({
          id: `flora_${flora.length + caveFlora.length + 1}`,
          species: 'glow_spore_cluster',
          x,
          z,
          biome: zoneBiome,
          rotation: caveFloraRng() * Math.PI * 2,
          scale: 0.9 + caveFloraRng() * 0.4,
          growthStage: 3,
          growthProgress: 1,
          fertilizedGrowth: false,
          fertilizedYield: false,
          fertilizerTimer: 0,
          harvestReady: true,
          harvestTimer: 0,
          isHazardous: false,
          swayOffset: 100 + caveFlora.length,
        });
        break;
      }
    }
  }

  // ---------------------------------------------------------------------
  // Ruin landmarks (P4, surface stage) — grown LAST of all: a site
  // must respect the homestead, the cave mouths, and everything
  // already living on the surface. The world's FATE (derived from the
  // seed alone, game/ruins.ts) chooses the variant and the tint;
  // distance in ZONE HOPS chooses the size. The landmark's record is
  // stored bookkeeping for the interior stage — the ruin below will
  // derive from (seed + instanceId + fate), never from this record.
  // ---------------------------------------------------------------------
  const worldFate = fateForWorld(seedStr);
  const ruinBlockers = [
    ...caveBlockers,
    ...caveSection.mouths.map((m) => ({ x: m.anchor.x, z: m.anchor.z, radius: 3.4 })),
  ];
  const ruinSection = generateZoneRuins(seedStr, {
    zoneZx,
    zoneZz,
    zoneBiome,
    fate: worldFate,
    blockers: ruinBlockers,
  });
  const ruinStructures: StructureEntity[] = ruinSection.sites.map((site) => ({
    id: site.id,
    type: 'ruin_landmark',
    gridX: Math.round(site.anchor.x / 2),
    gridZ: Math.round(site.anchor.z / 2),
    worldX: site.anchor.x,
    worldZ: site.anchor.z,
    rotation: site.anchor.facing,
    health: 9999,
    maxHealth: 9999,
    doorOpenProgress: 0,
    ruin: {
      instanceId: site.instanceId,
      fate: worldFate,
      variant: FATE_STYLES[worldFate].variant,
      tier: site.tier,
      exitX: site.surfaceExitSpawn.x,
      exitZ: site.surfaceExitSpawn.z,
      dressing: site.dressing,
    },
  }));

  // ---------------------------------------------------------------------
  // ROOT BRIDGES (Rootwood, 2026-10-15) — Adam committed to
  // walkable root bridges: generated assemblies of EXISTING
  // structure types, so they persist in zone snapshots and obey
  // every building rule (datums, story support, solvent) for
  // free. Each bridge: a wall tower at both ends with a pre-grown
  // vine ladder, and a deck of root_tile_floor at level 1 across
  // the span. The taught verbs are the way up (click the ladder;
  // bounce-shrooms work too) and the story-support check is the
  // way across — step off and you drop, as anywhere. True sloped
  // ramps are P5-terrain machinery; the ladder tower is the
  // ramp's v1 form, dressed as root.
  // ---------------------------------------------------------------------
  const bridgeStructures: StructureEntity[] = [];
  if (zoneBiome === 'rootwood') {
    const bridgeRng = createSeededRandom(stream('structures:rootbridges'));
    const bridgeCount = zoneVariant?.id === 'rootwood_canopy' || zoneVariant?.id === 'rootwood_rootfall' ? 2 : 1;
    const occupied = new Set<string>([
      ...structures.map((st) => `${st.gridX},${st.gridZ}`),
      ...ruinStructures.map((st) => `${st.gridX},${st.gridZ}`),
    ]);
    let builtBridges = 0;
    for (let attempt = 0; attempt < 24 && builtBridges < bridgeCount; attempt++) {
      const alongX = bridgeRng() < 0.5;
      const len = 5 + Math.floor(bridgeRng() * 3); // 5-7 cells = 10-14 m
      const gx = Math.floor(bridgeRng() * 25) - 12;
      const gz = Math.floor(bridgeRng() * 25) - 12;
      const cells: { x: number; z: number }[] = [];
      let okRun = true;
      for (let i = 0; i < len; i++) {
        const cx = alongX ? gx + i : gx;
        const cz = alongX ? gz : gz + i;
        if (Math.abs(cx) > 19 || Math.abs(cz) > 19 || occupied.has(`${cx},${cz}`)) { okRun = false; break; }
        cells.push({ x: cx, z: cz });
      }
      if (!okRun) continue;
      const rot = alongX ? Math.PI / 2 : 0;
      [cells[0], cells[cells.length - 1]].forEach((c, ei) => {
        bridgeStructures.push({
          id: `struct_rootwall_${builtBridges}_${ei}`, type: 'chitin_glass_wall',
          gridX: c.x, gridZ: c.z, worldX: c.x * 2, worldZ: c.z * 2, rotation: rot,
          level: 0, health: 200, maxHealth: 200, doorOpenProgress: 0,
        });
        bridgeStructures.push({
          id: `struct_rootladder_${builtBridges}_${ei}`, type: 'vine_ladder',
          gridX: c.x, gridZ: c.z, worldX: c.x * 2, worldZ: c.z * 2, rotation: rot,
          level: 0, health: 120, maxHealth: 120, doorOpenProgress: 0,
        });
      });
      cells.forEach((c, ci) => {
        bridgeStructures.push({
          id: `struct_rootdeck_${builtBridges}_${ci}`, type: 'root_tile_floor',
          gridX: c.x, gridZ: c.z, worldX: c.x * 2, worldZ: c.z * 2, rotation: 0,
          level: 1, health: 200, maxHealth: 200, doorOpenProgress: 0,
        });
        occupied.add(`${c.x},${c.z}`);
      });
      builtBridges++;
    }
  }

  // ---------------------------------------------------------------------
  // Duskgrass + the heartbloom (Living, 2026-10-15) — family-
  // wide BONUS life: black-violet grass fields (no chlorophyll
  // on this planet — Adam), and ONE heartbloom at the valley's
  // heart point (zones.livingHeartAt) in EVERY Living zone: the
  // organism's heart, worn outside its body.
  // ---------------------------------------------------------------------
  if (zoneBiome === 'living') {
    const duskRng = createSeededRandom(stream('flora:duskgrass'));
    const duskCount = zoneVariant?.id === 'welcoming_valley' ? 11
      : zoneVariant?.id === 'twominded_valley' ? 9
      : zoneVariant?.id === 'hungry_valley' ? 7 : 8;
    let plantedDusk = 0;
    for (let attempt = 0; attempt < duskCount * 6 && plantedDusk < duskCount; attempt++) {
      const x = (duskRng() * 2 - 1) * 44;
      const z = (duskRng() * 2 - 1) * 44;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.3)) continue;
      flora.push({
        id: `flora_duskgrass_${plantedDusk}`,
        species: 'dusk_grass',
        x, z,
        biome: zoneBiome,
        rotation: duskRng() * Math.PI * 2,
        scale: 0.9 + duskRng() * 0.6,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 1700 + plantedDusk,
      });
      plantedDusk++;
    }
    const heart = livingHeartAt(seedStr, zoneZx, zoneZz);
    flora.push({
      id: 'flora_heartbloom_0',
      species: 'heartbloom',
      x: heart.x, z: heart.z,
      biome: zoneBiome,
      rotation: duskRng() * Math.PI * 2,
      scale: 1.6,
      growthStage: 3,
      growthProgress: 1,
      fertilizedGrowth: false,
      fertilizedYield: false,
      fertilizerTimer: 0,
      harvestReady: true,
      harvestTimer: 0,
      isHazardous: false,
      swayOffset: 1750,
    });
  }

  // ---------------------------------------------------------------------
  // Stormcatcher stands + fulgurite (Storm, 2026-10-15) —
  // family-wide BONUS life: tall reeds that drink lightning,
  // and the glass fingers the strikes leave behind (scenery;
  // the Dunes grow them thickest).
  // ---------------------------------------------------------------------
  if (zoneBiome === 'storm') {
    const stormRng = createSeededRandom(stream('flora:stormcatcher'));
    const reedCount = zoneVariant?.id === 'magnetic_dunes' ? 8
      : zoneVariant?.id === 'charged_flats' ? 6
      : zoneVariant?.id === 'skyfall_basin' ? 5 : 4;
    let plantedReeds = 0;
    for (let attempt = 0; attempt < reedCount * 6 && plantedReeds < reedCount; attempt++) {
      const x = (stormRng() * 2 - 1) * 44;
      const z = (stormRng() * 2 - 1) * 44;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.4)) continue;
      flora.push({
        id: `flora_stormcatcher_${plantedReeds}`,
        species: 'stormcatcher',
        x, z,
        biome: zoneBiome,
        rotation: stormRng() * Math.PI * 2,
        scale: 0.95 + stormRng() * 0.5,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 1500 + plantedReeds,
      });
      plantedReeds++;
    }
  }

  // ---------------------------------------------------------------------
  // Gravebloom stands (Bone, 2026-10-15) — family-wide BONUS
  // life: pale flowers rooted in bone, thickest in the Marrow
  // Flats. Plus the family's SCENERY: fragments in every bone
  // zone, and in the Graveyard, the one impossible skeleton.
  // ---------------------------------------------------------------------
  if (zoneBiome === 'bone') {
    const graveRng = createSeededRandom(stream('flora:gravebloom'));
    const graveCount = zoneVariant?.id === 'marrow_flats' ? 9
      : zoneVariant?.id === 'leviathan_graveyard' ? 7
      : zoneVariant?.id === 'bonefields' ? 5 : 4;
    let plantedGrave = 0;
    for (let attempt = 0; attempt < graveCount * 6 && plantedGrave < graveCount; attempt++) {
      const x = (graveRng() * 2 - 1) * 44;
      const z = (graveRng() * 2 - 1) * 44;
      if (flora.some((f) => Math.hypot(f.x - x, f.z - z) < 1.4)) continue;
      flora.push({
        id: `flora_gravebloom_${plantedGrave}`,
        species: 'gravebloom',
        x, z,
        biome: zoneBiome,
        rotation: graveRng() * Math.PI * 2,
        scale: 0.9 + graveRng() * 0.5,
        growthStage: 3,
        growthProgress: 1,
        fertilizedGrowth: false,
        fertilizedYield: false,
        fertilizerTimer: 0,
        harvestReady: true,
        harvestTimer: 0,
        isHazardous: false,
        swayOffset: 1300 + plantedGrave,
      });
      plantedGrave++;
    }
  }

  // ---------------------------------------------------------------------
  // Tender husks (Precursor, 2026-10-15, Adam's ruling) — there
  // are no machines on this planet. The tenders were FORGED
  // creatures: grown, purpose-shaped for garden work, biggish —
  // and dead ten thousand years. Their husks stand in the rows
  // as scenery: thickest in the Tending Field, rare elsewhere in
  // precursor country.
  // ---------------------------------------------------------------------
  const huskStructures: StructureEntity[] = [];
  if (zoneBiome === 'precursor') {
    const huskRng = createSeededRandom(stream('structures:tenderhusks'));
    const huskCount = zoneVariant?.id === 'precursor_tending' ? 3 + Math.floor(huskRng() * 2)
      : zoneVariant?.id === 'precursor_garden' ? 1 + Math.floor(huskRng() * 2)
      : zoneVariant?.id === 'precursor_untended' ? 1
      : (huskRng() < 0.5 ? 1 : 0);
    let placedHusks = 0;
    for (let attempt = 0; attempt < huskCount * 6 && placedHusks < huskCount; attempt++) {
      const x = (huskRng() * 2 - 1) * 40;
      const z = (huskRng() * 2 - 1) * 40;
      const blocked = [...structures, ...ruinStructures].some((st) => Math.hypot(st.worldX - x, st.worldZ - z) < 7)
        || huskStructures.some((st) => Math.hypot(st.worldX - x, st.worldZ - z) < 9);
      if (blocked) continue;
      huskStructures.push({
        id: `husk_${zoneZx}_${zoneZz}_${placedHusks}`,
        type: 'tender_husk',
        gridX: Math.round(x / 2),
        gridZ: Math.round(z / 2),
        worldX: x,
        worldZ: z,
        rotation: huskRng() * Math.PI * 2,
        level: 0, health: 9999, maxHealth: 9999, doorOpenProgress: 0,
      });
      placedHusks++;
    }
  }

  // Bone scenery (Bone, 2026-10-15): fragments scattered through
  // every bone zone; the LEVIATHAN only in its Graveyard — one
  // impossible skeleton per graveyard zone (the variant is rare;
  // rarity is the scarcity, per Adam's call).
  const boneStructures: StructureEntity[] = [];
  if (zoneBiome === 'bone') {
    const boneRng = createSeededRandom(stream('structures:bonescenery'));
    if (zoneVariant?.id === 'leviathan_graveyard') {
      const lx = (boneRng() * 2 - 1) * 16;
      const lz = (boneRng() * 2 - 1) * 16;
      boneStructures.push({
        id: `leviathan_${zoneZx}_${zoneZz}`,
        type: 'leviathan_ribs',
        gridX: Math.round(lx / 2), gridZ: Math.round(lz / 2),
        worldX: lx, worldZ: lz,
        rotation: boneRng() * Math.PI * 2,
        level: 0, health: 9999, maxHealth: 9999, doorOpenProgress: 0,
      });
    }
    const fragCount = zoneVariant?.id === 'bonefields' ? 8 : 5;
    let placedFrags = 0;
    for (let attempt = 0; attempt < fragCount * 6 && placedFrags < fragCount; attempt++) {
      const x = (boneRng() * 2 - 1) * 42;
      const z = (boneRng() * 2 - 1) * 42;
      if (boneStructures.some((st) => Math.hypot(st.worldX - x, st.worldZ - z) < 8)) continue;
      if ([...structures, ...ruinStructures].some((st) => Math.hypot(st.worldX - x, st.worldZ - z) < 5)) continue;
      boneStructures.push({
        id: `bonefrag_${zoneZx}_${zoneZz}_${placedFrags}`,
        type: 'bone_fragment',
        gridX: Math.round(x / 2), gridZ: Math.round(z / 2),
        worldX: x, worldZ: z,
        rotation: boneRng() * Math.PI * 2,
        level: 0, health: 9999, maxHealth: 9999, doorOpenProgress: 0,
      });
      placedFrags++;
    }
  }

  // Fulgurite scenery (Storm, 2026-10-15): glass fingers where
  // the lightning kissed the sand — across Storm country.
  const stormStructures: StructureEntity[] = [];
  if (zoneBiome === 'storm') {
    const fulgRng = createSeededRandom(stream('structures:fulgurite'));
    const fulgCount = zoneVariant?.id === 'magnetic_dunes' ? 7
      : zoneVariant?.id === 'charged_flats' ? 4 : 2;
    let placedFulg = 0;
    for (let attempt = 0; attempt < fulgCount * 6 && placedFulg < fulgCount; attempt++) {
      const x = (fulgRng() * 2 - 1) * 42;
      const z = (fulgRng() * 2 - 1) * 42;
      if ([...structures, ...ruinStructures].some((st) => Math.hypot(st.worldX - x, st.worldZ - z) < 5)) continue;
      stormStructures.push({
        id: `fulgurite_${zoneZx}_${zoneZz}_${placedFulg}`,
        type: 'fulgurite',
        gridX: Math.round(x / 2), gridZ: Math.round(z / 2),
        worldX: x, worldZ: z,
        rotation: fulgRng() * Math.PI * 2,
        level: 0, health: 9999, maxHealth: 9999, doorOpenProgress: 0,
      });
      placedFulg++;
    }
  }

  // Petrified grove scenery (2026-10-15): stone giants standing
  // in the sparse country — 5 per grove zone.
  const groveStructures: StructureEntity[] = [];
  if (zoneVariant?.id === 'petrified_grove') {
    const groveRng = createSeededRandom(stream('structures:petrified'));
    let placedGrove = 0;
    for (let attempt = 0; attempt < 40 && placedGrove < 5; attempt++) {
      const x = (groveRng() * 2 - 1) * 42;
      const z = (groveRng() * 2 - 1) * 42;
      if ([...structures, ...ruinStructures].some((st) => Math.hypot(st.worldX - x, st.worldZ - z) < 6)) continue;
      if (groveStructures.some((st) => Math.hypot(st.worldX - x, st.worldZ - z) < 8)) continue;
      groveStructures.push({
        id: `petrified_${zoneZx}_${zoneZz}_${placedGrove}`,
        type: 'petrified_shroom',
        gridX: Math.round(x / 2), gridZ: Math.round(z / 2),
        worldX: x, worldZ: z,
        rotation: groveRng() * Math.PI * 2,
        level: 0, health: 9999, maxHealth: 9999, doorOpenProgress: 0,
      });
      placedGrove++;
    }
  }

  return {
    flora: [...flora, ...caveFlora],
    fauna,
    structures: [...structures, ...ruinStructures, ...bridgeStructures, ...huskStructures, ...boneStructures, ...stormStructures, ...groveStructures],
    relaxedPlacements: floraScatter.relaxed + faunaScatter.relaxed,
  };
}
