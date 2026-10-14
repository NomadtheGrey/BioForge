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
// Biomes are NOT here. The lab's biome layer stays parked until Adam
// promotes it; this module is positions + species only.
// ============================================================================

import { createNoise2D, createSeededRandom, hashStringToSeed } from './motion';
import type { FaunaEntity, FaunaSpecies, FloraEntity, FloraSpecies } from '../types/game';

/** Stamp recorded on saves so future format/gen changes can migrate. */
export const WORLD_GEN_VERSION = 1;

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
}

// The census IS the shipped starter world's multiset:
// 2 ferns, 2 bell blooms, 2 petal mills, 1 sap weaver, 1 snap trap.
const FLORA_CENSUS: FloraSpeciesDef[] = [
  { species: 'lantern_fern', count: 2, baseWeight: 0.28, near: 1.8, far: 0.25, hazardous: false },
  { species: 'bell_bloom', count: 2, baseWeight: 0.22, near: 1.2, far: 0.8, hazardous: false },
  { species: 'petal_mill', count: 2, baseWeight: 0.20, near: 0.9, far: 1.15, hazardous: false },
  { species: 'sap_weaver', count: 1, baseWeight: 0.18, near: 0.6, far: 1.4, hazardous: false },
  { species: 'snap_trap', count: 1, baseWeight: 0.12, near: 0.03, far: 2.4, hazardous: true },
];

// 2 soft-puffs, 2 burrow mice, 1 chitin stalker — the shipped five.
const FAUNA_CENSUS: FaunaSpeciesDef[] = [
  { species: 'soft_puff', count: 2, baseWeight: 0.45, near: 1.6, far: 0.35, speed: 1.7, speedJitter: 0.1, health: 40 },
  { species: 'burrow_mouse', count: 2, baseWeight: 0.35, near: 1.0, far: 1.0, speed: 1.85, speedJitter: 0.15, health: 30 },
  { species: 'chitin_stalker', count: 1, baseWeight: 0.20, near: 0.03, far: 2.6, speed: 2.4, speedJitter: 0, health: 120 },
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
): ScatterResult {
  // Acceptance: how "grove-worthy" is this point? Field value mapped to
  // 0..1, then a soft threshold — deep-field points almost always accept,
  // barren points almost never do, edges are a coin weighted by depth.
  const acceptP = (x: number, z: number): number => {
    const n = field(x / scale + fieldOffsetX, z / scale + fieldOffsetZ);
    const t = (n + 1) / 2;
    return smooth01((t - CLUSTER_THRESHOLD) / CLUSTER_SLOPE);
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
      let total = 0;
      const weights = remaining.map((p) => {
        const w = Math.max(weightOf(def, p), 0.0001);
        total += w;
        return w;
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
  /** Placements that needed the spacing safety valve (expect 0). */
  relaxedPlacements: number;
}

/**
 * Grow a new world's flora and fauna from its seed string.
 * Same seed -> same world, always. Called once at world creation
 * (App's handleCreateSave); the result is saved as concrete entities.
 */
export function generateSeededWorld(seedStr: string): GeneratedWorld {
  // Independent streams per job: re-rolling positions must never reshuffle
  // species, and decoration (rotation/scale/speed jitter) touches neither.
  const floraPosRng = createSeededRandom(streamSeed(seedStr, 'flora:position:hybrid'));
  const faunaPosRng = createSeededRandom(streamSeed(seedStr, 'fauna:position:hybrid'));
  const floraSpRng = createSeededRandom(streamSeed(seedStr, 'flora:species'));
  const faunaSpRng = createSeededRandom(streamSeed(seedStr, 'fauna:species'));
  const decorRng = createSeededRandom(streamSeed(seedStr, 'decorate'));
  const fernRng = createSeededRandom(streamSeed(seedStr, 'flora:fern-ring'));

  // The guaranteed lantern ferns go down FIRST, on their ring; the grove
  // scatter then treats them as blockers so nothing crowds them out.
  const fernDef = FLORA_CENSUS.find((d) => d.species === 'lantern_fern')!;
  const fernPoints = placeFernRing(fernRng);
  const floraCensusRest = FLORA_CENSUS.filter((d) => d.species !== 'lantern_fern');

  // One cluster field per kind, offset so flora groves and fauna herds
  // don't trace the same shapes.
  const floraField = createClusterField(streamSeed(seedStr, 'flora:cluster-field'));
  const faunaField = createClusterField(streamSeed(seedStr, 'fauna:cluster-field'));
  const floraOx = (streamSeed(seedStr, 'flora:ox') % 200) - 100;
  const floraOz = (streamSeed(seedStr, 'flora:oz') % 200) - 100;
  const faunaOx = (streamSeed(seedStr, 'fauna:ox') % 200) - 100;
  const faunaOz = (streamSeed(seedStr, 'fauna:oz') % 200) - 100;

  const floraScatter = scatterClustered(
    floraPosRng, floraField, floraOx, floraOz,
    FLORA_COUNT - fernDef.count, FLORA_CLUSTER_SCALE, FLORA_MIN_SPACING, SPAWN_CLEAR_FLORA,
    fernPoints,
  );
  const faunaScatter = scatterClustered(
    faunaPosRng, faunaField, faunaOx, faunaOz,
    FAUNA_COUNT, FAUNA_CLUSTER_SCALE, FAUNA_MIN_SPACING, SPAWN_CLEAR_FAUNA,
  );

  const floraDealt: { def: FloraSpeciesDef; point: PlacedPoint }[] = [
    ...fernPoints.map((point) => ({ def: fernDef, point })),
    ...assignSpecies(floraScatter.points, floraCensusRest, floraSpRng, (def, p) => distanceWeight(def, p.x, p.z)),
  ];
  const faunaDealt = assignSpecies(
    faunaScatter.points, FAUNA_CENSUS, faunaSpRng, (def, p) => distanceWeight(def, p.x, p.z),
  );

  // Build full entities with the shipped starter world's shape: mature,
  // harvest-ready flora (the first session's economy is unchanged — only
  // the map differs), wild fauna wandering from their spawn point.
  const flora: FloraEntity[] = floraDealt.map((d, i) => ({
    id: `flora_${i + 1}`,
    species: d.def.species,
    x: d.point.x,
    z: d.point.z,
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

  return {
    flora,
    fauna,
    relaxedPlacements: floraScatter.relaxed + faunaScatter.relaxed,
  };
}
