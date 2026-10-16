/**
 * THE LANDFORM FIELD — P5 terrain, move 1 (Adam, 2026-10-16).
 *
 * What the land was before this file: one fixed, unseeded sine
 * ripple (±0.7 m), identical in every zone of every world — the
 * meadow rolled exactly like the storm country. What it is now:
 * a seeded, layered heightfield, shaped per biome FAMILY, proven
 * in the gen lab (terrain-lab.mjs) before a line of it shipped.
 *
 * The design, in the order the layers compose:
 *  1. BASE FORM — fractal value noise in WORLD space (broad 55 m
 *     swells, 21 m mid, 8 m detail). World space is the load-
 *     bearing choice: the field is a pure function of (seed,
 *     world x, world z), so two zones sharing a border compute
 *     the same heights along it without ever talking.
 *  2. FAMILY SHAPING — each family bends the field its own way:
 *     ember ridges it, precursor quantizes it into terraces,
 *     saltglass flattens it outright (the Flats being flat IS the
 *     landform), rootwood adds a hummock octave, storm stretches
 *     it into dunes. Variants and hybrids wear their family's
 *     landform in v1 — shaping is a family signature.
 *  3. HOP SCALING — amplitude grows with distance from spawn
 *     (0.6 + 0.13 per hop, capped): near country rolls, far
 *     country rears. Scarcity-by-rarity's vertical twin.
 *  4. BORDER BLENDING — within 9 m of a zone edge, heights lerp
 *     toward the neighbor zone's shaped height, reaching an even
 *     50/50 exactly AT the border — so the ground is continuous
 *     across the seam even where two families' shapes disagree.
 *  5. PONDS (move 2) — seeded basin dips carved into the field,
 *     resolved as data by zonePondsAt (see the pond section).
 *
 * Adam's concern, designed for: BUILDING on uneven land. Two
 * protections stack — the datum rule (connected builds share one
 * flat datum at their lowest anchor; buildings level themselves,
 * uphill pieces settle in like foundations) and the SLOPE BUDGET
 * measured in the lab: at shipping amplitude every family keeps
 * ≥90% of its home zone within a generous buildable slope
 * (rise/run ≤ 0.5), most at 99–100%. Drama lives in FEATURES
 * (ridge lines, terrace risers, dune crests), not uniform tilt.
 *
 * Migration: worlds created before the landform epoch keep the
 * old ripple forever (App gates on the save's creation time —
 * the gauntlet-epoch pattern). Only new worlds get shaped land.
 */

import { zoneBiomeAt } from './zones';
import { hashStringToSeed } from './motion';
import type { BiomeId } from './biomes';

/**
 * The landform epoch: worlds created before this moment keep the
 * original ripple as their ground (and hold no ponds); worlds
 * created after it grow on the shaped, pond-carved field. App
 * gates engine context on it; generation gates pond life on it.
 * 13:00 UTC = 9:00 AM EDT, 2026-10-16.
 */
export const LANDFORM_EPOCH_MS = Date.UTC(2026, 9, 16, 13, 0, 0);

// ---- Layer 1: seeded value noise -------------------------------------------

function hash2(ix: number, iz: number, seed: number): number {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = smooth(x - ix);
  const fz = smooth(z - iz);
  const a = hash2(ix, iz, seed);
  const b = hash2(ix + 1, iz, seed);
  const c = hash2(ix, iz + 1, seed);
  const d = hash2(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** The layered base form, ~0..1. Wavelengths are the character:
 *  55 m swells you read as country, 21 m ground you build on,
 *  8 m texture underfoot. */
function fbm(x: number, z: number, seed: number): number {
  return (
    valueNoise(x / 55, z / 55, seed) * 0.55 +
    valueNoise(x / 21, z / 21, seed + 7) * 0.3 +
    valueNoise(x / 8, z / 8, seed + 13) * 0.15
  );
}

// ---- Layer 2: family shaping ------------------------------------------------

interface FamilyShape {
  /** Peak amplitude in meters (before hop scaling). */
  amp: number;
  /** Bend the 0..1 base field into this family's signature. */
  shape: (h: number) => number;
  /** Rootwood: mix in a short-wavelength hummock octave. */
  hummock?: boolean;
  /** Storm: stretch the field along x so ridges run in lines. */
  dunes?: boolean;
}

export const FAMILY_SHAPING: Record<BiomeId, FamilyShape> = {
  meadow: { amp: 1.2, shape: (h) => Math.pow(h, 1.15) },
  wetland: { amp: 0.55, shape: (h) => 0.35 + h * 0.3 },
  fungal: { amp: 1.9, shape: (h) => h },
  ember: { amp: 4.6, shape: (h) => 1 - Math.abs(2 * h - 1) },
  saltglass: { amp: 0.3, shape: () => 0.5 },
  frost: { amp: 2.7, shape: (h) => Math.pow(h, 1.6) },
  rootwood: { amp: 1.7, shape: (h) => h, hummock: true },
  // Terraces with SOFTENED risers: a hard quantize would make each
  // riser a vertical step in the field (a 2 m pop underfoot); the
  // smoothstep band spreads the climb over a few meters of ground
  // instead — flat treads, steep-but-walkable risers.
  precursor: {
    amp: 3.2,
    shape: (h) => {
      const t = h * 4;
      const base = Math.floor(t);
      const frac = Math.min(1, Math.max(0, (t - base - 0.35) / 0.3));
      return (base + frac * frac * (3 - 2 * frac)) / 4;
    },
  },
  bone: { amp: 2.3, shape: (h) => Math.pow(Math.abs(h - 0.5) * 2, 1.4) },
  storm: { amp: 3.5, shape: (h) => h, dunes: true },
  living: { amp: 1.5, shape: (h) => Math.sin(Math.min(1, Math.max(0, h)) * Math.PI) * 0.7 + h * 0.3 },
};

/** Shipping drama: the lab's first cut proved the slope budget
 *  with so much headroom that amplitude ships at 2.2x the proven
 *  values — the dial Adam can ask to turn after standing in it. */
const DRAMA = 2.2;

/** Amplitude growth with distance: near country gentle, far
 *  country rears — capped so the far rim stays country, not wall. */
function hopFactor(hops: number): number {
  return (0.6 + 0.13 * Math.min(hops, 7)) * DRAMA;
}

/** One zone's shaped height at a world point, in meters. The
 *  family's own shaping + its own hop scaling (border blending
 *  mixes two of these; each side must be computed with its own
 *  zone's parameters for the seam to agree from both directions). */
function shapedHeightAt(seedNum: number, family: BiomeId, hops: number, wx: number, wz: number): number {
  const f = FAMILY_SHAPING[family];
  let h = fbm(f.dunes ? wx * 0.45 : wx, wz, seedNum);
  if (f.hummock) h = h * 0.8 + valueNoise(wx / 4.5, wz / 4.5, seedNum + 29) * 0.2;
  return f.shape(h) * f.amp * hopFactor(hops);
}

// ---- The field ---------------------------------------------------------------

const ZONE_SIZE = 100;
/** Meters from a zone edge over which family shapes blend. */
const BORDER_BLEND = 9;

const seedNumCache = new Map<string, number>();
function seedNumOf(seedStr: string): number {
  let n = seedNumCache.get(seedStr);
  if (n === undefined) {
    n = hashStringToSeed(seedStr);
    seedNumCache.set(seedStr, n);
  }
  return n;
}

function zoneOf(w: number): number {
  return Math.floor((w + ZONE_SIZE / 2) / ZONE_SIZE);
}

/**
 * The SHAPED height at a world point, before ponds carve it.
 * Internal: pond candidates measure themselves against this
 * surface (measuring against the carved field would recurse —
 * candidates define the carving). Everything outside this file
 * wants landformHeightAt, the carved truth.
 */
function shapedFieldAt(seedStr: string, wx: number, wz: number): number {
  const seedNum = seedNumOf(seedStr);
  const zx = zoneOf(wx);
  const zz = zoneOf(wz);
  const family = zoneBiomeAt(seedStr, zx, zz);
  const hops = Math.abs(zx) + Math.abs(zz);
  let h = shapedHeightAt(seedNum, family, hops, wx, wz);

  // Border blending: near an edge, lean toward the neighbor's
  // shaped height for the same world point — reaching exactly
  // 50/50 at the border line itself, where the neighbor's own
  // computation mirrors this one and lands on the same number.
  const lx = wx - zx * ZONE_SIZE; // -50..50 within the zone
  const lz = wz - zz * ZONE_SIZE;
  const blendAxis = (distToEdge: number, neighborFamily: BiomeId, neighborHops: number): number => {
    if (distToEdge >= BORDER_BLEND) return h;
    const hn = shapedHeightAt(seedNum, neighborFamily, neighborHops, wx, wz);
    const w = 0.5 * (1 - distToEdge / BORDER_BLEND);
    return h + (hn - h) * w;
  };
  if (lx > ZONE_SIZE / 2 - BORDER_BLEND) {
    h = blendAxis(ZONE_SIZE / 2 - lx, zoneBiomeAt(seedStr, zx + 1, zz), Math.abs(zx + 1) + Math.abs(zz));
  } else if (lx < -ZONE_SIZE / 2 + BORDER_BLEND) {
    h = blendAxis(lx + ZONE_SIZE / 2, zoneBiomeAt(seedStr, zx - 1, zz), Math.abs(zx - 1) + Math.abs(zz));
  }
  if (lz > ZONE_SIZE / 2 - BORDER_BLEND) {
    h = blendAxis(ZONE_SIZE / 2 - lz, zoneBiomeAt(seedStr, zx, zz + 1), Math.abs(zx) + Math.abs(zz + 1));
  } else if (lz < -ZONE_SIZE / 2 + BORDER_BLEND) {
    h = blendAxis(lz + ZONE_SIZE / 2, zoneBiomeAt(seedStr, zx, zz - 1), Math.abs(zx) + Math.abs(zz - 1));
  }
  return h;
}

// ---- Layer 5: ponds (P5 move 2, Adam, 2026-10-16) ---------------------------
//
// Ponds are CARVED into the shaped field — smooth basin dips — not
// hunted as natural basins: the shaped field is too smooth to
// guarantee closed basins, and a spawn gate that starves is a lie.
// Each zone rolls seeded candidates; its family's APPETITE decides
// how many ponds its country holds. The dip field is a pure
// WORLD-space function (a point feels its own zone's ponds and any
// neighbor pond within reach), so carving never breaks a seam —
// the terrain harness re-proves continuity against the carved
// field. Adam's sequence: water now, rivers next, then lava
// (ember's appetite opens then) and brine; the liquid field rides
// the data from day one so those slot in without a shape change.

/** Liquids a pond can hold. v1 ships 'water' alone. */
export type PondLiquid = 'water';

export interface PondDef {
  /** World coords of the pond's center. */
  cx: number;
  cz: number;
  /** Water-disc radius in meters. */
  radius: number;
  /** World height of the liquid surface. */
  waterY: number;
  liquid: PondLiquid;
  /** Carve depth in meters (the bowl below the shaped field). */
  depth: number;
}

const POND_APPETITE: Record<BiomeId, { max: number; chance: number }> = {
  meadow: { max: 2, chance: 0.55 },
  wetland: { max: 3, chance: 0.8 },
  fungal: { max: 2, chance: 0.6 },
  ember: { max: 0, chance: 0 }, // ember's ponds arrive with lava
  saltglass: { max: 1, chance: 0.4 },
  frost: { max: 1, chance: 0.45 },
  rootwood: { max: 1, chance: 0.5 },
  precursor: { max: 1, chance: 0.35 },
  bone: { max: 1, chance: 0.4 },
  storm: { max: 1, chance: 0.4 },
  living: { max: 2, chance: 0.6 },
};

function pondRoll(seedNum: number, zx: number, zz: number, i: number, salt: number): number {
  let h = (seedNum * 31 + zx * 374761393 + zz * 668265263 + i * 974634211 + salt * 1442695041) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/**
 * One zone's ponds, as data. Deterministic in (seedStr, zx, zz);
 * nothing is stored anywhere — every consumer (engine rendering,
 * worldGen creature gates, movement) resolves the same list.
 * Water levels are measured against the SHAPED field (see
 * shapedFieldAt) and capped below the lowest rim, so a pond on a
 * slope never floats its downhill edge; a site whose cap would
 * crush the surface to the floor is rejected outright.
 */
export function zonePondsAt(seedStr: string, zx: number, zz: number): PondDef[] {
  const ap = POND_APPETITE[zoneBiomeAt(seedStr, zx, zz)];
  if (!ap || ap.max === 0) return [];
  const seedNum = seedNumOf(seedStr);
  const out: PondDef[] = [];
  for (let i = 0; i < ap.max; i++) {
    if (pondRoll(seedNum, zx, zz, i, 1) > ap.chance) continue;
    const cx = zx * ZONE_SIZE + (pondRoll(seedNum, zx, zz, i, 2) * 76 - 38);
    const cz = zz * ZONE_SIZE + (pondRoll(seedNum, zx, zz, i, 3) * 76 - 38);
    // Nobody spawns underwater: the spawn zone keeps its center dry.
    if (zx === 0 && zz === 0 && Math.hypot(cx, cz) < 16) continue;
    const radius = 4.5 + pondRoll(seedNum, zx, zz, i, 4) * 5;
    const depth = 1.3 + pondRoll(seedNum, zx, zz, i, 5) * 0.8;
    const hC = shapedFieldAt(seedStr, cx, cz);
    let rim = Infinity;
    for (const [ox, oz] of [[radius, 0], [-radius, 0], [0, radius], [0, -radius]] as const) {
      rim = Math.min(rim, shapedFieldAt(seedStr, cx + ox, cz + oz));
    }
    const carvedCenter = hC - depth;
    // The rim's carved height ≈ shaped rim less this pond's own dip
    // at d = radius (dip factor (cos(pi/1.7)+1)/2 ≈ 0.363).
    const surface = Math.min(carvedCenter + depth * 0.62, rim - depth * 0.363 - 0.15);
    if (surface <= carvedCenter + 0.3) continue;
    out.push({ cx, cz, radius, waterY: surface, liquid: 'water', depth });
  }
  return out;
}

/** The carve at a world point: the deepest dip among ponds in
 *  reach (MAX, not sum — overlapping bowls merge at the deeper
 *  one's depth, keeping every floor where its waterY math put it). */
function pondDipAt(seedStr: string, wx: number, wz: number): number {
  const zx = zoneOf(wx);
  const zz = zoneOf(wz);
  let dip = 0;
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const p of zonePondsAt(seedStr, zx + dx, zz + dz)) {
        const reach = p.radius * 1.7;
        const d = Math.hypot(wx - p.cx, wz - p.cz);
        if (d >= reach) continue;
        const t = d / reach;
        dip = Math.max(dip, (p.depth * (Math.cos(Math.PI * t) + 1)) / 2);
      }
    }
  }
  return dip;
}

/**
 * The landform height at a WORLD point (meters): the shaped field
 * with ponds carved in. Pure in (seedStr, wx, wz) — same inputs,
 * same height, on every client, in every zone, forever: the
 * property zone borders, host authority, and the datum system
 * all silently rely on.
 */
export function landformHeightAt(seedStr: string, wx: number, wz: number): number {
  return shapedFieldAt(seedStr, wx, wz) - pondDipAt(seedStr, wx, wz);
}
