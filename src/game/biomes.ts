// ============================================================================
// biomes.ts — the biome layer: ecological types with rules (P2)
// ============================================================================
//
// The second generation algorithm promoted from the gen lab into the
// game (Adam's rule: one at a time, proven in-game before the next).
// Ported faithfully from the lab's biome seam (genLab.mjs), which was
// built, measured, and verified there first.
//
// Pinned split, honored throughout: a biome TYPE is an ecological
// classification that carries RULES — density multipliers here, species
// affinity here, spawn tables / lighting tints in future layers. A zone
// NAME ("Violet Cradle", "Amber Thicket") is a poetic map label and
// lives in an entirely different system; nothing in this file knows or
// cares what a place is called.
//
//   meadow   the starter biome — fertile, gentle, always surrounds spawn
//   wetland  soggy ground, standing water — lush
//   fungal   dark, spore-thick hollows — sparser fauna in the dark
//   ember    heat vents, ash soil — the strange one, far from home only
//
// (Biolume Caverns is deliberately absent: it's an instanced-zone
// interior, not a surface biome.)
//
// How a point gets its biome: DISTANCE RINGS decide which types are on
// the table (meadow guaranteed within 12 m of spawn; wetland joins at
// 12 m+; fungal at 30 m+; ember at 44 m+ — danger and strangeness rise
// with distance from home), and a seeded noise field, standardized per
// seed, picks among the allowed types so boundaries inside a ring are
// organic rather than circular.
//
// biomeAt is a pure function of the world seed: same seed + same point
// = same biome, forever. It runs on its OWN hash streams, so asking
// about biomes never consumes or disturbs the position/species dice.
// ============================================================================

import { createNoise2D, hashStringToSeed } from './motion';

export type BiomeId = 'meadow' | 'wetland' | 'fungal' | 'ember';

export interface BiomeDef {
  id: BiomeId;
  /** Position-acceptance multipliers: how thick life grows here. */
  floraDensity: number;
  faunaDensity: number;
}

/** The biome table — the rules live here, tunable in one place. */
export const BIOMES: BiomeDef[] = [
  { id: 'meadow', floraDensity: 1.2, faunaDensity: 1.2 }, // starter: fertile, alive
  { id: 'wetland', floraDensity: 1.1, faunaDensity: 1.0 }, // lush, soggy
  { id: 'fungal', floraDensity: 1.0, faunaDensity: 0.8 }, // sparser life in the dark
  { id: 'ember', floraDensity: 0.8, faunaDensity: 0.9 }, // harsher ground, thinner cover
];

/**
 * How each biome TINTS the ground. The terrain's base color still comes
 * from its quadrant (the zone's identity — Violet Cradle stays violet),
 * and the biome hue is blended over it: `strength` is how far each
 * vertex leans toward the biome color. Meadow leans least — home
 * ground should mostly feel like itself — while the far, strange
 * biomes lean hard enough to read at a glance. This is the type made
 * visible; the zone NAME remains a separate, poetic system.
 */
export const BIOME_TINTS: Record<BiomeId, { color: number; strength: number }> = {
  meadow: { color: 0x3a6b35, strength: 0.25 },
  wetland: { color: 0x0e7a6d, strength: 0.5 },
  fungal: { color: 0x7a2ea0, strength: 0.5 },
  ember: { color: 0xc2571b, strength: 0.55 },
};

/** Within this distance of spawn the biome is always meadow. */
const BIOME_MEADOW_RADIUS = 12;
/** Biome patch size in meters — big enough to read as a place. */
const BIOME_FIELD_SCALE = 26;
/** Weight bonus a biome-affined species gets inside its home biome(s). */
export const BIOME_HOME_BONUS = 1.5;

// Biome rings: which types are "on the table" grows with distance from
// spawn. `edges` are z-score thresholds on the standardized biome field:
// e.g. edges [-0.84, -0.25, 0.25] carve the field into the four allowed
// types at roughly 20 / 20 / 20 / 40% of the ring's area. Ring edges are
// crisp circles; WITHIN a ring, the noise makes boundaries organic.
interface BiomeRing {
  maxR: number;
  allowed: BiomeId[];
  edges: number[];
}

const BIOME_RINGS: BiomeRing[] = [
  { maxR: BIOME_MEADOW_RADIUS, allowed: ['meadow'], edges: [] },
  { maxR: 30, allowed: ['meadow', 'wetland'], edges: [-0.25] },
  { maxR: 44, allowed: ['meadow', 'wetland', 'fungal'], edges: [-0.67, 0.43] },
  { maxR: Infinity, allowed: ['meadow', 'wetland', 'fungal', 'ember'], edges: [-0.84, -0.25, 0.25] },
];

// ---------------------------------------------------------------------------
// The biome noise field — built once per seed and cached
// ---------------------------------------------------------------------------

/**
 * Three-octave fbm over the game's seeded 2D noise (mirrors the lab's
 * createNoise2DFbm: layer seeds stride by a large odd constant, each
 * octave halves amplitude and doubles frequency, result renormalized).
 */
function createNoise2DFbm(seed: number, octaves = 3): (x: number, y: number) => number {
  const layers = Array.from({ length: octaves }, (_, i) =>
    createNoise2D((seed + i * 1013904223) >>> 0),
  );
  return (x: number, y: number): number => {
    let sum = 0;
    let weight = 0;
    let amp = 1;
    let freq = 1;
    for (const layer of layers) {
      sum += layer(x * freq, y * freq) * amp;
      weight += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / weight;
  };
}

interface BiomeField {
  n: (x: number, y: number) => number;
  ox: number;
  oz: number;
  mean: number;
  std: number;
}

// The field is standardized per seed (16x16 sample grid -> mean/std)
// because raw fbm values cluster around their own mean — raw thresholds
// would give wildly different biome shares per seed, while z-score
// edges behave the same everywhere. Own hash streams ('<seed>:biome-*'),
// so the field never disturbs any other generation stream.
const biomeFieldCache = new Map<string, BiomeField>();

function getBiomeField(seedStr: string): BiomeField {
  let f = biomeFieldCache.get(seedStr);
  if (!f) {
    const n = createNoise2DFbm(hashStringToSeed(seedStr + ':biome-field'), 3);
    const ox = (hashStringToSeed(seedStr + ':biome-ox') % 200) - 100;
    const oz = (hashStringToSeed(seedStr + ':biome-oz') % 200) - 100;
    let sum = 0;
    let sum2 = 0;
    let cnt = 0;
    for (let ix = 0; ix < 16; ix++) {
      for (let iy = 0; iy < 16; iy++) {
        const v = n((ix - 8) / 4, (iy - 8) / 4);
        sum += v;
        sum2 += v * v;
        cnt++;
      }
    }
    const mean = sum / cnt;
    const std = Math.sqrt(Math.max(1e-6, sum2 / cnt - mean * mean));
    f = { n, ox, oz, mean, std };
    biomeFieldCache.set(seedStr, f);
  }
  return f;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * biomeAt(seedStr, x, z) — which biome covers this point of this world.
 * Within 12 m of spawn: always 'meadow' (the starter ground is safe).
 * Beyond that, the distance ring picks the types on the table and the
 * standardized noise field picks among them — so meadow dominates near
 * home, ember exists only 44 m+ out, and every boundary is organic.
 */
export function biomeAt(seedStr: string, x: number, z: number): BiomeId {
  const r = Math.hypot(x, z);
  const f = getBiomeField(seedStr);
  const t = (f.n(x / BIOME_FIELD_SCALE + f.ox, z / BIOME_FIELD_SCALE + f.oz) - f.mean) / f.std;
  const ring = BIOME_RINGS.find((g) => r <= g.maxR) ?? BIOME_RINGS[BIOME_RINGS.length - 1];
  let idx = 0;
  while (idx < ring.edges.length && t >= ring.edges[idx]) idx++;
  return ring.allowed[idx];
}

/** Position-acceptance multiplier for a biome (density is a biome rule). */
export function biomeDensityFactor(kind: 'flora' | 'fauna', biomeId: BiomeId): number {
  const b = BIOMES.find((x) => x.id === biomeId);
  if (!b) return 1;
  return kind === 'flora' ? b.floraDensity : b.faunaDensity;
}

/**
 * Species weight factor for a biome. 'all' species are welcome
 * everywhere (factor 1); a listed species gets the home bonus inside
 * its biome(s) and weight 0 anywhere else — that zero is what makes
 * exclusivity a hard rule rather than a tendency (the species dealer
 * excludes zero-weight points while any legal point remains).
 */
export function biomeWeightFactor(biomes: readonly BiomeId[] | 'all', biomeId: BiomeId): number {
  if (biomes === 'all') return 1;
  return biomes.includes(biomeId) ? BIOME_HOME_BONUS : 0;
}
