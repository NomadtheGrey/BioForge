// ============================================================================
// cavern.ts — instanced cavern generation (P3 of the generation index)
// ============================================================================
//
// A faithful in-game port of the gen lab's cavernLab.mjs (same stages,
// same knobs, same seeded streams — layouts match the lab's maps). A
// cavern is a SEPARATE INSTANCE (settled design, 2026-10-13): the
// surface cave mouth is only a portal; the zone has its own layout,
// bigger than the surface footprint, and its own rules (Biolume
// Caverns = permanent dark).
//
//   Stage A — cellular automata: random wall fill, smoothed.
//   Stage B — graph repair: keep big chambers, seal pockets, carve
//             corridors (MST-style), then deliberate loops so no route
//             is the only way through.
//   Entrance — the southernmost floor cell; a BFS depth field from it
//             grades the whole cave (shallow → deep).
//   Stage C — features placed by depth band (generic types in v1:
//             glow_fungus / common_resource / rare_mineral / hazard,
//             plus the 'heart' — the deepest cell).
//   Stage D — validation: one connected region, every feature
//             reachable, corridors wide. A shipped cavern must pass.
//
// THE SURFACE-ANCHOR INVARIANT (load-bearing, from the lab): the
// surface anchor is bookkeeping ONLY. It is echoed into the link
// record and never reaches a random stream — the same (worldSeed,
// instanceId) generates a byte-identical cave with or without it.
//
// Game sizing: the lab ran 64x64 cells (128 m). The game's movement
// boundary is ±48 m, so in-game caverns generate at 44x44 cells
// (88 m) — comfortably inside the boundary with wall margin to spare.
// ============================================================================

import { createSeededRandom, hashStringToSeed } from './motion';

/** Cavern generator version. Stamped into every generated zone's meta. */
export const CAVERN_GEN_VERSION = 1;

/** In-game cavern size in cells (one cell = 2 m → an 88 m zone). */
export const CAVERN_GRID_CELLS = 44;

export type CavernFeatureType = 'glow_fungus' | 'common_resource' | 'rare_mineral' | 'hazard' | 'heart' | 'descent' | 'vine_shaft';

export interface CavernFeature {
  id: string;
  type: CavernFeatureType;
  cx: number;
  cy: number;
  depth: number;
}

export interface CavernLink {
  zoneId: string;
  surfaceAnchor: { x: number; z: number; facing: number } | null;
  surfaceExitSpawn: { x: number; z: number; facing: number } | null;
  zoneEntrance: { cx: number; cy: number };
  zoneEntrySpawn: { cx: number; cy: number; facing: { dx: number; dy: number } };
}

export interface CavernResult {
  seedStr: string;
  zoneId: string;
  width: number;
  height: number;
  cellMeters: number;
  /** Row strings: '#' wall, '.' floor. Row 0 is the NORTH edge. */
  grid: string[];
  entrance: { x: number; y: number };
  heart: { x: number; y: number } | null;
  /** The way DOWN to the next level, when this level rolled one. */
  descent: { x: number; y: number } | null;
  /** The express way OUT: an alien vine shaft climbing straight to
   *  the surface, when this (deep) level grew one. */
  vineShaft: { x: number; y: number } | null;
  /** 1-based depth level of this cavern (1 = just under the surface). */
  depthLevel: number;
  features: CavernFeature[];
  depthStats: { maxDepth: number; bandCounts: { shallow: number; mid: number; deep: number } };
  openShare: number;
  link: CavernLink;
  meta: { genVersion: number; validation: CavernValidation };
}

export interface CavernValidation {
  featuresReachable: boolean;
  singleFloorRegion: boolean;
  openShare: number;
  openBandOk: boolean;
  corridorWidthShare: number;
  corridorsWide: boolean;
  pass: boolean;
}

interface CavernOpts {
  width: number;
  height: number;
  cellMeters: number;
  fillProb: number;
  smoothIterations: number;
  birthMin: number;
  survivalMin: number;
  borderWall: boolean;
  minChamberSize: number;
  corridorWidth: number;
  extraLoops: number;
  featureTargets: Record<string, number>;
  featureMinSpacing: number;
  exitOffsetMeters: number;
  openBand: { min: number; max: number };
}

const CAVERN_DEFAULTS: CavernOpts = {
  width: 64,
  height: 64,
  cellMeters: 2,
  fillProb: 0.45,
  smoothIterations: 5,
  birthMin: 5,
  survivalMin: 4,
  borderWall: true,
  minChamberSize: 24,
  corridorWidth: 2,
  extraLoops: 2,
  featureTargets: {
    glow_fungus: 36,
    common_resource: 22,
    rare_mineral: 12,
    hazard: 6,
  },
  featureMinSpacing: 3,
  exitOffsetMeters: 2,
  openBand: { min: 0.25, max: 0.75 },
};

type Grid = number[][];

/** Derive an independent deterministic stream: world seed + zone + stage. */
function stageSeed(seedStr: string, zoneId: string, stage: string): number {
  return hashStringToSeed(`${seedStr}:zone:${zoneId}:${stage}`);
}

function makeGrid(w: number, h: number, fill: number): Grid {
  const g: Grid = new Array(h);
  for (let y = 0; y < h; y++) {
    g[y] = new Array(w);
    for (let x = 0; x < w; x++) g[y][x] = fill;
  }
  return g;
}

/** Count wall neighbors (8-neighborhood); out-of-bounds counts as wall. */
function wallNeighbors(g: Grid, w: number, h: number, x: number, y: number): number {
  let n = 0;
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || g[ny][nx] === 1) n++;
    }
  return n;
}

/**
 * Flood-fill all 4-connected floor regions, largest first. 4-connectivity
 * is deliberate: diagonal-only "connections" would be a collision lie.
 */
function findRegions(g: Grid, w: number, h: number): [number, number][][] {
  const seen = makeGrid(w, h, 0);
  const regions: [number, number][][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (g[y][x] !== 0 || seen[y][x]) continue;
      const region: [number, number][] = [];
      const stack: [number, number][] = [[x, y]];
      seen[y][x] = 1;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        region.push([cx, cy]);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (g[ny][nx] !== 0 || seen[ny][nx]) continue;
          seen[ny][nx] = 1;
          stack.push([nx, ny]);
        }
      }
      regions.push(region);
    }
  regions.sort((a, b) => b.length - a.length);
  return regions;
}

/** BFS distances over floor from a start cell — the cave's depth field. */
function bfsDepth(g: Grid, w: number, h: number, sx: number, sy: number): { dist: Grid; max: number } {
  const dist = makeGrid(w, h, -1);
  dist[sy][sx] = 0;
  const queue: [number, number][] = [[sx, sy]];
  let max = 0;
  for (let qi = 0; qi < queue.length; qi++) {
    const [cx, cy] = queue[qi];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      if (g[ny][nx] !== 0 || dist[ny][nx] !== -1) continue;
      dist[ny][nx] = dist[cy][cx] + 1;
      if (dist[ny][nx] > max) max = dist[ny][nx];
      queue.push([nx, ny]);
    }
  }
  return { dist, max };
}

function depthBand(r: number): 'shallow' | 'mid' | 'deep' {
  if (r <= 0.33) return 'shallow';
  if (r <= 0.66) return 'mid';
  return 'deep';
}

const FEATURE_BAND_WEIGHTS: Record<string, { shallow: number; mid: number; deep: number }> = {
  glow_fungus:     { shallow: 1.6,  mid: 1.0,  deep: 0.4  },
  common_resource: { shallow: 1.4,  mid: 1.0,  deep: 0.6  },
  rare_mineral:    { shallow: 0.3,  mid: 1.0,  deep: 1.8  },
  hazard:          { shallow: 0.05, mid: 0.5,  deep: 1.5  },
};

// --------------------------------------------------------------------------
// Stage A — cellular automata
// --------------------------------------------------------------------------
function stageCA(g: Grid, w: number, h: number, rng: () => number, opts: CavernOpts): void {
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (opts.borderWall && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
        g[y][x] = 1;
      } else {
        g[y][x] = rng() < opts.fillProb ? 1 : 0;
      }
    }
  for (let it = 0; it < opts.smoothIterations; it++) {
    const next = makeGrid(w, h, 1);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (opts.borderWall && (x === 0 || y === 0 || x === w - 1 || y === h - 1)) {
          next[y][x] = 1;
          continue;
        }
        const n = wallNeighbors(g, w, h, x, y);
        if (g[y][x] === 1) next[y][x] = n >= opts.survivalMin ? 1 : 0;
        else next[y][x] = n >= opts.birthMin ? 1 : 0;
      }
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) g[y][x] = next[y][x];
  }
}

// --------------------------------------------------------------------------
// Stage B — graph repair
// --------------------------------------------------------------------------
interface CarvedCorridor {
  cells: [number, number, string][];
  clamped: boolean;
}

function carveCorridor(g: Grid, w: number, h: number, x1: number, y1: number, x2: number, y2: number, cw: number): CarvedCorridor {
  const cells: [number, number, string][] = [];
  let clamped = false;
  const clamp = (v: number, lo: number, hi: number): number => {
    if (v < lo) { clamped = true; return lo; }
    if (v > hi) { clamped = true; return hi; }
    return v;
  };
  const stepX = x2 > x1 ? 1 : -1;
  for (let x = x1; x !== x2 + stepX; x += stepX) {
    const cx = clamp(x, 1, w - 2);
    const cy = clamp(y1, 1, h - 2);
    for (let dy = 0; dy < cw; dy++) g[clamp(y1 + dy, 1, h - 2)][cx] = 0;
    cells.push([cx, cy, 'h']);
  }
  const stepY = y2 > y1 ? 1 : -1;
  for (let y = y1; y !== y2 + stepY; y += stepY) {
    const cy = clamp(y, 1, h - 2);
    const cx = clamp(x2, 1, w - 2);
    for (let dx = 0; dx < cw; dx++) g[cy][clamp(x2 + dx, 1, w - 2)] = 0;
    cells.push([cx, cy, 'v']);
  }
  return { cells, clamped };
}

function closestPair(rng: () => number, regionA: [number, number][], regionB: [number, number][]): [[number, number], [number, number]] {
  const sample = (region: [number, number][]): [number, number][] => {
    const out: [number, number][] = [];
    const n = Math.min(300, region.length);
    for (let i = 0; i < n; i++) out.push(region[Math.floor(rng() * region.length)]);
    return out;
  };
  const a = sample(regionA), b = sample(regionB);
  let best: [[number, number], [number, number]] | null = null;
  let bestD = Infinity;
  for (const [ax, ay] of a)
    for (const [bx, by] of b) {
      const d = (ax - bx) * (ax - bx) + (ay - by) * (ay - by);
      if (d < bestD) { bestD = d; best = [[ax, ay], [bx, by]]; }
    }
  return best!;
}

function stageRepair(g: Grid, w: number, h: number, rng: () => number, opts: CavernOpts) {
  const preRegions = findRegions(g, w, h);
  const preStats = {
    count: preRegions.length,
    largestShare: preRegions.length
      ? preRegions[0].length / preRegions.reduce((s, r) => s + r.length, 0)
      : 0,
  };

  const corridors: CarvedCorridor[] = [];
  const keptChambers: [number, number][][] = [];
  let filledPockets = 0;

  const main = preRegions[0] || [];
  const connected: [number, number][][] = [main];
  for (const region of preRegions.slice(1)) {
    if (region.length < opts.minChamberSize) {
      for (const [x, y] of region) g[y][x] = 1;
      filledPockets++;
      continue;
    }
    keptChambers.push(region);
    let bestD = Infinity;
    let bestPair: [[number, number], [number, number]] | null = null;
    for (let i = 0; i < connected.length; i++) {
      const [ra, rb] = closestPair(rng, region, connected[i]);
      const d = (ra[0] - rb[0]) ** 2 + (ra[1] - rb[1]) ** 2;
      if (d < bestD) { bestD = d; bestPair = [ra, rb]; }
    }
    const [[ax, ay], [bx, by]] = bestPair!;
    corridors.push(carveCorridor(g, w, h, ax, ay, bx, by, opts.corridorWidth));
    connected.push(region);
  }

  // Deliberate loops: carve between far-apart already-connected points —
  // the cycle created is an escape route.
  const floor: [number, number][] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (g[y][x] === 0) floor.push([x, y]);
  let loopsAdded = 0, loopAttempts = 0;
  while (loopsAdded < opts.extraLoops && loopAttempts < 60 && floor.length > 2) {
    loopAttempts++;
    const a = floor[Math.floor(rng() * floor.length)];
    const b = floor[Math.floor(rng() * floor.length)];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (d < Math.min(w, h) / 2) continue;
    corridors.push(carveCorridor(g, w, h, a[0], a[1], b[0], b[1], opts.corridorWidth));
    loopsAdded++;
  }

  const postRegions = findRegions(g, w, h);
  return {
    preStats,
    keptChambers: keptChambers.length,
    filledPockets,
    corridors,
    loopsAdded,
    postRegionCount: postRegions.length,
  };
}

// --------------------------------------------------------------------------
// Entrance + portal link
// --------------------------------------------------------------------------
function pickEntrance(g: Grid, w: number, h: number): { x: number; y: number } | null {
  let best: [number, number] | null = null;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (g[y][x] !== 0) continue;
      if (!best || y > best[1] || (y === best[1] && x < best[0])) best = [x, y];
    }
  if (!best) return null;
  // Clear a small alcove so the player never spawns in a 1-wide crack.
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const nx = best[0] + dx, ny = best[1] + dy;
      if (nx > 0 && ny > 0 && nx < w - 1 && ny < h - 1) g[ny][nx] = 0;
    }
  return { x: best[0], y: best[1] };
}

function buildPortalLink(
  g: Grid, w: number, h: number,
  entrance: { x: number; y: number },
  zoneId: string,
  surfaceAnchor: { x: number; z: number; facing: number } | null,
  opts: CavernOpts,
): CavernLink {
  // Entry facing: from the entrance toward the floor centroid — always
  // into the cave, since the entrance is the southernmost floor cell.
  let floorN = 0, sumX = 0, sumY = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (g[y][x] === 0) { floorN++; sumX += x; sumY += y; }
  let dx = sumX / floorN - entrance.x;
  let dy = sumY / floorN - entrance.y;
  const len = Math.hypot(dx, dy);
  const facing = len > 1e-9 ? { dx: dx / len, dy: dy / len } : { dx: 0, dy: -1 };

  let surfaceExitSpawn: CavernLink['surfaceExitSpawn'] = null;
  if (surfaceAnchor) {
    surfaceExitSpawn = {
      x: surfaceAnchor.x + Math.cos(surfaceAnchor.facing) * opts.exitOffsetMeters,
      z: surfaceAnchor.z + Math.sin(surfaceAnchor.facing) * opts.exitOffsetMeters,
      facing: surfaceAnchor.facing,
    };
  }

  return {
    zoneId,
    surfaceAnchor: surfaceAnchor
      ? { x: surfaceAnchor.x, z: surfaceAnchor.z, facing: surfaceAnchor.facing }
      : null,
    surfaceExitSpawn,
    zoneEntrance: { cx: entrance.x, cy: entrance.y },
    zoneEntrySpawn: { cx: entrance.x, cy: entrance.y, facing },
  };
}

// --------------------------------------------------------------------------
// Stage C — features by depth band
// --------------------------------------------------------------------------
function stageFeatures(
  rng: () => number, g: Grid, w: number, h: number,
  depth: Grid, maxDepth: number, opts: CavernOpts,
): { features: CavernFeature[]; heart: { x: number; y: number } | null } {
  const floor: [number, number][] = [];
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++)
      if (g[y][x] === 0) floor.push([x, y]);

  const features: CavernFeature[] = [];
  const bandOf = (x: number, y: number) => depthBand(maxDepth > 0 ? depth[y][x] / maxDepth : 0);
  for (const type of Object.keys(opts.featureTargets)) {
    const target = opts.featureTargets[type];
    const weights = FEATURE_BAND_WEIGHTS[type];
    const maxW = Math.max(weights.shallow, weights.mid, weights.deep);
    let placed = 0, attempts = 0;
    while (placed < target && attempts < target * 200) {
      attempts++;
      const [x, y] = floor[Math.floor(rng() * floor.length)];
      if (rng() > weights[bandOf(x, y)] / maxW) continue;
      let ok = true;
      for (const f of features) {
        if ((f.cx - x) ** 2 + (f.cy - y) ** 2 < opts.featureMinSpacing ** 2) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      features.push({ id: `cf_${features.length}`, type: type as CavernFeatureType, cx: x, cy: y, depth: depth[y][x] });
      placed++;
    }
  }

  // The heart: the deepest floor cell (first in scan order on ties).
  let heart: { x: number; y: number } | null = null;
  for (let y = 1; y < h - 1 && !heart; y++)
    for (let x = 1; x < w - 1; x++)
      if (g[y][x] === 0 && depth[y][x] === maxDepth) { heart = { x, y }; break; }
  if (heart) features.push({ id: 'cf_heart', type: 'heart', cx: heart.x, cy: heart.y, depth: maxDepth });

  return { features, heart };
}

// --------------------------------------------------------------------------
// Stage C2 — the descent (the way down to the next depth level)
// --------------------------------------------------------------------------
// Adam's deeper caves (2026-10-14): a level may grow a shaft down to
// another generated level beneath it. The shaft belongs in the deep
// dark: a floor cell at ≥75% of the cave's max BFS depth, never the
// heart's own cell or its immediate neighbor (the heart keeps its
// chamber), and never near the entrance. Placement is a pure scan —
// no RNG — so it cannot shift any seeded stream; whether a descent
// EXISTS at all is the only roll, drawn on its own 'descent' stream.
function placeDescent(
  g: Grid, w: number, h: number,
  depth: Grid, maxDepth: number,
  heart: { x: number; y: number } | null,
  entrance: { x: number; y: number },
): { x: number; y: number } | null {
  const minD = Math.ceil(maxDepth * 0.75);
  const far = (x: number, y: number, heartGap: number): boolean => {
    if (heart && Math.abs(x - heart.x) + Math.abs(y - heart.y) < heartGap) return false;
    if (Math.abs(x - entrance.x) + Math.abs(y - entrance.y) < 5) return false;
    return true;
  };
  for (const heartGap of [2, 1]) {
    let best: { x: number; y: number } | null = null;
    let bestD = -1;
    for (let y = 1; y < h - 1; y++)
      for (let x = 1; x < w - 1; x++) {
        if (g[y][x] !== 0) continue;
        const d = depth[y][x];
        if (d < minD || d <= bestD) continue;
        if (!far(x, y, heartGap)) continue;
        best = { x, y };
        bestD = d;
      }
    if (best) return best;
  }
  return null;
}

// --------------------------------------------------------------------------
// Stage C3 — the vine shaft (the express way out)
// --------------------------------------------------------------------------
// Adam's climb-out answer for uncapped depth (2026-10-14): on deep
// levels, an alien vine may grow down through a crack in the ceiling
// — one climb takes the player straight to the surface, skipping
// the level-by-level portal walk. Vines reach toward the light, so
// the shaft roots in the MID depths (30–70% of max BFS depth), never
// at the entrance and never on top of another feature's cell (≥2
// cells clear). Pure scan again; existence is the only roll.
function placeVineShaft(
  g: Grid, w: number, h: number,
  depth: Grid, maxDepth: number,
  features: CavernFeature[],
  entrance: { x: number; y: number },
): { x: number; y: number } | null {
  const lo = Math.ceil(maxDepth * 0.3);
  const hi = Math.floor(maxDepth * 0.7);
  let best: { x: number; y: number } | null = null;
  let bestD = -1;
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      if (g[y][x] !== 0) continue;
      const d = depth[y][x];
      if (d < lo || d > hi || d <= bestD) continue;
      if (Math.abs(x - entrance.x) + Math.abs(y - entrance.y) < 5) continue;
      let clear = true;
      for (const f of features) {
        if (Math.abs(f.cx - x) + Math.abs(f.cy - y) < 2) { clear = false; break; }
      }
      if (!clear) continue;
      best = { x, y };
      bestD = d;
    }
  return best;
}

// --------------------------------------------------------------------------
// Stage D — validation
// --------------------------------------------------------------------------
function validateCavern(
  g: Grid, w: number, h: number,
  entrance: { x: number; y: number },
  features: CavernFeature[],
  corridors: CarvedCorridor[],
  opts: CavernOpts,
): CavernValidation {
  const { dist } = bfsDepth(g, w, h, entrance.x, entrance.y);
  const featuresReachable = features.every((f) => dist[f.cy][f.cx] !== -1);
  const singleFloorRegion = findRegions(g, w, h).length === 1;

  let floorCount = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) if (g[y][x] === 0) floorCount++;
  const openShare = floorCount / (w * h);
  const openBandOk = openShare >= opts.openBand.min && openShare <= opts.openBand.max;

  let checked = 0, good = 0;
  for (const c of corridors) {
    for (const [x, y, orient] of c.cells) {
      checked++;
      let ok = true;
      for (let k = 0; k < opts.corridorWidth; k++) {
        const nx = orient === 'v' ? x + k : x;
        const ny = orient === 'h' ? y + k : y;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || g[ny][nx] !== 0) { ok = false; break; }
      }
      if (ok) good++;
    }
  }
  const corridorWidthShare = checked ? good / checked : 1;
  const corridorsWide = corridorWidthShare >= 0.95;

  return {
    featuresReachable,
    singleFloorRegion,
    openShare,
    openBandOk,
    corridorWidthShare,
    corridorsWide,
    pass: featuresReachable && singleFloorRegion && openBandOk && corridorsWide,
  };
}

// --------------------------------------------------------------------------
// Public entry point
// --------------------------------------------------------------------------
export interface GenerateCavernOptions {
  zoneId?: string;
  width?: number;
  height?: number;
  /** Bookkeeping ONLY — never feeds generation (see the invariant). */
  surfaceAnchor?: { x: number; z: number; facing: number } | null;
  /** 1-based depth level this cavern sits at (stamped on the result). */
  depthLevel?: number;
  /**
   * Probability (0–1) that this level grows a DESCENT to the next
   * one. Undefined = no descent is on the table for this call. The
   * roll draws on its own seeded stream, so it never perturbs the
   * layout or feature streams.
   */
  descentChance?: number;
  /**
   * Probability (0–1) that this level grows a VINE SHAFT — the
   * express climb straight to the surface. Its own seeded stream,
   * same isolation as the descent roll.
   */
  vineChance?: number;
}

export function generateCavern(seedStr: string, options: GenerateCavernOptions = {}): CavernResult {
  const { surfaceAnchor = null, ...overrides } = options;
  const opts: CavernOpts = { ...CAVERN_DEFAULTS, ...overrides };
  const zoneId = options.zoneId || 'cavern';
  const { width: w, height: h } = opts;
  const depthLevel = options.depthLevel ?? 1;

  const fillRng = createSeededRandom(stageSeed(seedStr, zoneId, 'fill'));
  const repairRng = createSeededRandom(stageSeed(seedStr, zoneId, 'repair'));
  const featureRng = createSeededRandom(stageSeed(seedStr, zoneId, 'features'));

  const g = makeGrid(w, h, 1);
  stageCA(g, w, h, fillRng, opts);
  const repair = stageRepair(g, w, h, repairRng, opts);

  const entrance = pickEntrance(g, w, h);
  if (!entrance) throw new Error(`generateCavern: no floor for an entrance (seed ${seedStr})`);
  const { dist, max: maxDepth } = bfsDepth(g, w, h, entrance.x, entrance.y);

  const { features, heart } = stageFeatures(featureRng, g, w, h, dist, maxDepth, opts);

  // The descent roll: its OWN stream, drawn only when a descent is on
  // the table, so levels without one stay byte-identical to before.
  let descent: { x: number; y: number } | null = null;
  if (options.descentChance !== undefined) {
    const descentRng = createSeededRandom(stageSeed(seedStr, zoneId, 'descent'));
    if (descentRng() < options.descentChance) {
      descent = placeDescent(g, w, h, dist, maxDepth, heart, entrance);
      if (descent) {
        features.push({ id: 'cf_descent', type: 'descent', cx: descent.x, cy: descent.y, depth: dist[descent.y][descent.x] });
      }
    }
  }

  // The vine shaft roll: same isolation — its own 'vine' stream,
  // drawn only when a vine is on the table (deep levels).
  let vineShaft: { x: number; y: number } | null = null;
  if (options.vineChance !== undefined) {
    const vineRng = createSeededRandom(stageSeed(seedStr, zoneId, 'vine'));
    if (vineRng() < options.vineChance) {
      vineShaft = placeVineShaft(g, w, h, dist, maxDepth, features, entrance);
      if (vineShaft) {
        features.push({ id: 'cf_vine', type: 'vine_shaft', cx: vineShaft.x, cy: vineShaft.y, depth: dist[vineShaft.y][vineShaft.x] });
      }
    }
  }
  const link = buildPortalLink(g, w, h, entrance, zoneId, surfaceAnchor, opts);
  const validation = validateCavern(g, w, h, entrance, features, repair.corridors, opts);

  const grid = g.map((row) => row.map((c) => (c === 1 ? '#' : '.')).join(''));

  const bandCounts = { shallow: 0, mid: 0, deep: 0 };
  let open = 0;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (g[y][x] === 0) {
        open++;
        bandCounts[depthBand(maxDepth > 0 ? dist[y][x] / maxDepth : 0)]++;
      }

  return {
    seedStr,
    zoneId,
    width: w,
    height: h,
    cellMeters: opts.cellMeters,
    grid,
    entrance,
    heart,
    descent,
    vineShaft,
    depthLevel,
    features,
    depthStats: { maxDepth, bandCounts },
    openShare: open / (w * h),
    link,
    meta: { genVersion: CAVERN_GEN_VERSION, validation },
  };
}

/** Each depth level has a name — the HUD and the entry toast use it.
 *  Past the named strata the fallback is a plain depth count: how
 *  deep a cave goes is the roll's business, not a cap's (Adam,
 *  2026-10-14 — the generator permits any depth, so names run out
 *  before the dark does). */
export const CAVERN_STRATUM_NAMES: Record<number, string> = {
  1: 'Biolume Caverns',
  2: 'The Violet Deep',
  3: 'The Abyssal Dark',
  4: 'The Lightless Deep',
  5: 'The First Dark',
};

export function cavernStratumName(depthLevel: number): string {
  return CAVERN_STRATUM_NAMES[depthLevel] ?? `Depth ${depthLevel}`;
}

/**
 * The in-game entry point: a cavern for one cave mouth. The instanceId
 * (stored on the mouth at world creation) is the zoneId, so each mouth
 * owns a distinct, reproducible cave from the world seed alone — hosts
 * and guests generate byte-identical interiors independently.
 */
export function generateGameCavern(
  worldSeed: string,
  instanceId: string,
  surfaceAnchor: { x: number; z: number; facing: number } | null,
  zoneHopsFromSpawn = 0,
): CavernResult {
  return generateGameCavernLevel(worldSeed, instanceId, 1, surfaceAnchor, zoneHopsFromSpawn);
}

/**
 * One LEVEL of a mouth's cavern (Adam's deeper caves, 2026-10-14).
 * Depth is a level number fed to the same generator — never a new
 * coordinate: level 1 keeps the instanceId as its zoneId (existing
 * caves stay byte-identical), deeper levels suffix it, which re-seeds
 * every stage stream and grows a wholly different layout.
 *
 * The descent chance (Adam's rule: deeper is likelier the farther
 * the mouth sits from spawn) = a per-level base + a bonus per ZONE
 * (biome) of distance — distance in this game is counted in zones,
 * never meters (Adam, 2026-10-14). The hop count derives from the
 * mouth's stored position — data every client holding the mouth
 * entity has — so the roll lands the same on host and guests alike.
 * Deeper levels also deal RICHER feature targets (greater depths,
 * greater rewards): rares and hazards scale fastest, fungus gently
 * (light stays precious).
 */
export function generateGameCavernLevel(
  worldSeed: string,
  instanceId: string,
  depthLevel: number,
  surfaceAnchor: { x: number; z: number; facing: number } | null,
  zoneHopsFromSpawn = 0,
): CavernResult {
  const zoneId = depthLevel <= 1 ? instanceId : `${instanceId}@d${depthLevel}`;

  // No depth cap: every level rolls for a way further down. The
  // per-level chance (< 1) makes depth self-limiting in practice —
  // each additional level multiplies the odds, so very deep caves
  // exist but are rare legends rather than the norm.
  const base = depthLevel === 1 ? 0.55 : 0.4;
  const hopBonus = Math.min(zoneHopsFromSpawn * 0.05, 0.3);
  const descentChance = base + hopBonus;

  // Vine shafts are a DEEP-level mercy: level 1 is one portal from
  // daylight already, so vines only grow at depth 2 and below, in
  // about half of levels — finding one is luck, not a guarantee.
  const vineChance = depthLevel >= 2 ? 0.5 : undefined;

  const rich = 1 + 0.35 * (depthLevel - 1);
  const featureTargets =
    depthLevel <= 1
      ? undefined
      : {
          glow_fungus: Math.round(36 * (1 + 0.15 * (depthLevel - 1))),
          common_resource: Math.round(22 * rich),
          rare_mineral: Math.round(12 * rich),
          hazard: Math.round(6 * rich),
        };

  // Bounded deterministic retry: the CA + repair stages occasionally
  // produce a level whose corridors fail the Stage-D width check
  // (~1 seed in 10 at depth) — a dead shaft for a player already
  // committed inside. Regenerate with a retry-suffixed zoneId until
  // one validates. Attempt 0 is the plain zoneId, so every cave that
  // validates first try stays byte-identical; the loop is a pure
  // function of the seeds, so all clients land on the same attempt.
  for (let attempt = 0; attempt < 8; attempt++) {
    const attemptZoneId = attempt === 0 ? zoneId : `${zoneId}#r${attempt}`;
    const result = generateCavern(worldSeed, {
      zoneId: attemptZoneId,
      width: CAVERN_GRID_CELLS,
      height: CAVERN_GRID_CELLS,
      surfaceAnchor,
      depthLevel,
      descentChance,
      vineChance,
      ...(featureTargets ? { featureTargets } : {}),
    });
    if (result.meta.validation.pass || attempt === 7) return result;
  }
  // Unreachable (the loop returns on its last attempt) — but TS
  // wants a return, and a thrown bug beats a silent undefined here.
  throw new Error(`generateGameCavernLevel: retry loop fell through (${instanceId} @ depth ${depthLevel})`);
}

/**
 * Cell → world coordinates inside the instance. The cavern shares the
 * surface's numeric space (centered on the origin) but none of its
 * content: grid +x = world +x (east), grid +y = world +z (south), so
 * the entrance (southernmost cell) lands at the south edge and the
 * cave deepens northward. Cell centers sit on odd coordinates.
 */
export function cavernCellToWorld(cx: number, cy: number, width: number, height: number): { x: number; z: number } {
  return {
    x: (cx - (width - 1) / 2) * 2,
    z: (cy - (height - 1) / 2) * 2,
  };
}

/** Yaw (the game's atan2(x, z) convention) from the link's entry facing. */
export function cavernEntryYaw(link: CavernLink): number {
  return Math.atan2(link.zoneEntrySpawn.facing.dx, link.zoneEntrySpawn.facing.dy);
}
