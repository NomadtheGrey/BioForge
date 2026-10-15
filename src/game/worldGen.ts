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
import { zoneBiomeAt, zoneVariantAt } from './zones';
import type { FaunaEntity, FaunaSpecies, FloraEntity, FloraSpecies, StructureEntity } from '../types/game';
import { generateCaveSurface, HOMESTEAD_BLOCKERS } from './caveSurface';
import { fateForWorld, generateZoneRuins, FATE_STYLES } from './ruins';

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
 */
export const WORLD_GEN_VERSION = 9; // v9 (2026-10-15): frost, the 6th built family, joins the bands at 3 hops (family gates cap at 3 — rarity does the far work)

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
  { species: 'bell_bloom', count: 2, baseWeight: 0.22, near: 1.2, far: 0.8, hazardous: false, biomes: ['meadow', 'wetland'] },
  { species: 'petal_mill', count: 2, baseWeight: 0.20, near: 0.9, far: 1.15, hazardous: false, biomes: ['meadow', 'fungal'] },
  { species: 'sap_weaver', count: 1, baseWeight: 0.18, near: 0.6, far: 1.4, hazardous: false, biomes: ['fungal', 'ember'] },
  { species: 'snap_trap', count: 1, baseWeight: 0.12, near: 0.03, far: 2.4, hazardous: true, biomes: ['wetland', 'fungal'] },
];

// 2 soft-puffs, 2 burrow mice, 1 chitin stalker — the shipped five.
const FAUNA_CENSUS: FaunaSpeciesDef[] = [
  { species: 'soft_puff', count: 2, baseWeight: 0.45, near: 1.6, far: 0.35, speed: 1.7, speedJitter: 0.1, health: 40, biomes: ['meadow', 'wetland'] },
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
export function generateSeededWorld(seedStr: string, zoneZx = 0, zoneZz = 0): GeneratedWorld {
  // The zone's single biome — its identity — drives every biome rule
  // below for the whole zone.
  const zoneBiome: BiomeId = zoneBiomeAt(seedStr, zoneZx, zoneZz);
  // The zone's VARIANT, when it rolled one (biome graph, 2026-10-15):
  // density deltas and variant-only life hang off this below.
  const zoneVariant = zoneVariantAt(seedStr, zoneZx, zoneZz);
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
  const floraCensusHere = isSpawnZone
    ? floraCensusRest
    : floraCensusRest.filter((d) => d.biomes === 'all' || d.biomes.includes(zoneBiome));
  const faunaCensusHere = isSpawnZone
    ? FAUNA_CENSUS
    : FAUNA_CENSUS.filter((d) => d.biomes === 'all' || d.biomes.includes(zoneBiome));

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
  const floraDensityAt = (): number => biomeDensityFactor('flora', zoneBiome) * (zoneVariant?.floraDensityMult ?? 1);
  const faunaDensityAt = (): number => biomeDensityFactor('fauna', zoneBiome) * (zoneVariant?.faunaDensityMult ?? 1);

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
      distanceWeight(def, p.x, p.z) * biomeWeightFactor(def.biomes, zoneBiome),
    ),
  ];
  const faunaDealt = assignSpecies(
    faunaScatter.points, faunaCensusHere, faunaSpRng, (def, p) =>
      distanceWeight(def, p.x, p.z) * biomeWeightFactor(def.biomes, zoneBiome),
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

  return {
    flora: [...flora, ...caveFlora],
    fauna,
    structures: [...structures, ...ruinStructures],
    relaxedPlacements: floraScatter.relaxed + faunaScatter.relaxed,
  };
}
