// ============================================================================
// ruinInterior.ts — instanced ruin interiors (P4, interior stage)
// ============================================================================
//
// A faithful in-game port of the gen lab's ruinsLab.mjs (same stages,
// same knobs, same seeded streams — layouts match the lab's maps for
// the fates/tiers the lab ran). A ruin interior is a SEPARATE
// INSTANCE in the cavern pattern: the surface landmark is only a
// portal; the interior is a room-based layout generated from
// (world seed + the landmark's instanceId + the world's fate) alone,
// so every client holding the landmark rebuilds it identically.
//
// Game adaptations from the lab (all deliberate):
//   * FATES — the lab styled two (gardeners, crash); the game has
//     eleven. RUIN_LAYOUT_STYLES below extends the lab's two anchor
//     bundles across all eleven by flavor: grown/merged fates stay
//     irregular and overgrown, built fates stay squarer and more
//     collapsed, fallen fates sit between. The layout VARIANT each
//     fate uses comes from ruins.ts FATE_STYLES (Adam's call: the
//     fate picks the generator); this table is the numeric style the
//     chosen generator runs with.
//   * TIERS — the game adds 'medium' between the lab's small/grand,
//     and all tiers are sized to fit the game's ±48 m movement
//     boundary (the lab's 64-cell grand would overflow it). 'traces'
//     landmarks have NO interior — a textless surface remnant only.
//   * RETRY — a bounded deterministic retry (zoneId '#rN' suffix,
//     the cavern generator's lesson): a layout that fails validation
//     regenerates rather than shipping a broken ruin. Attempt 0 is
//     the plain instanceId, so every first-try-valid ruin is
//     byte-identical to the un-retried math.
//
// THE SURFACE-ANCHOR INVARIANT (from the lab, load-bearing): the
// surface anchor is bookkeeping ONLY — never a random-stream input.
// ============================================================================

import { createSeededRandom, hashStringToSeed } from '../engine/motion';
import { cavernCellToWorld } from './cavern';
import type { RuinVariantId, RuinTierId, WorldFate } from './ruins';
import { finaleFamilyOf } from '../quests/finale';

/** Interior generator version, stamped into every result's meta. */
export const RUIN_INTERIOR_GEN_VERSION = 1;

export type RuinInteriorTier = Exclude<RuinTierId, 'traces'>;

export interface RuinRoom {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
  tags: string[];
}

export interface RuinFeature {
  id: string;
  type: 'clue_shallow' | 'cache' | 'clue_deep' | 'artifact_heart' | 'portal_ring';
  cx: number;
  cy: number;
  roomId: string;
  depth: number;
  band: 'shallow' | 'mid' | 'deep';
}

export interface RuinResult {
  seedStr: string;
  zoneId: string;
  variant: RuinVariantId;
  tier: RuinInteriorTier;
  fate: WorldFate;
  width: number;
  height: number;
  cellMeters: number;
  /** Row strings: '#' wall, '.' floor, 'o' overgrowth (walkable),
   *  'x' rubble (blocked), 'E' entrance, 'S' secret, '*' heart. */
  grid: string[];
  rooms: RuinRoom[];
  edges: { a: string; b: string; bridge: boolean; collapsed: boolean; loop: boolean }[];
  entrance: { cx: number; cy: number; roomId: string };
  heart: { cx: number; cy: number; roomId: string };
  secret: { cx: number; cy: number; roomId: string } | null;
  features: RuinFeature[];
  maxDepth: number;
  damageStats: { collapseCells: number; overgrowthCells: number; shrunkenRooms: number };
  link: {
    zoneId: string;
    zoneEntrance: { cx: number; cy: number };
    zoneEntrySpawn: { cx: number; cy: number; facing: { dx: number; dy: number } };
  };
  meta: { genVersion: number; validation: RuinValidation };
}

export interface RuinValidation {
  roomsReachable: boolean;
  gridReachable: boolean;
  featuresOnFloor: boolean;
  noOverlap: boolean;
  openBandOk: boolean;
  deadEnds: number;
  loops: number;
  pass: boolean;
}

// ---------------------------------------------------------------------------
// Per-fate layout styles (the lab's FATE_STYLES, extended to eleven)
// ---------------------------------------------------------------------------

export interface RuinLayoutStyle {
  roomMin: number;
  roomMax: number;
  squareness: number;
  damage: { collapse: number; overgrowth: number };
  collapseWidth: number;
}

export const RUIN_LAYOUT_STYLES: Record<WorldFate, RuinLayoutStyle> = {
  // The lab's two anchors, verbatim:
  gardeners:       { roomMin: 3, roomMax: 9, squareness: 0.3,  damage: { collapse: 1, overgrowth: 6 }, collapseWidth: 2 },
  crash:           { roomMin: 4, roomMax: 6, squareness: 0.85, damage: { collapse: 4, overgrowth: 1 }, collapseWidth: 3 },
  // Extended by flavor across the remaining nine:
  long_experiment: { roomMin: 4, roomMax: 7, squareness: 0.6,  damage: { collapse: 2, overgrowth: 2 }, collapseWidth: 2 },
  evacuation:      { roomMin: 4, roomMax: 6, squareness: 0.8,  damage: { collapse: 3, overgrowth: 1 }, collapseWidth: 2 },
  becoming:        { roomMin: 3, roomMax: 8, squareness: 0.35, damage: { collapse: 1, overgrowth: 5 }, collapseWidth: 2 },
  war:             { roomMin: 4, roomMax: 6, squareness: 0.7,  damage: { collapse: 6, overgrowth: 0 }, collapseWidth: 3 },
  sickness:        { roomMin: 3, roomMax: 6, squareness: 0.5,  damage: { collapse: 2, overgrowth: 4 }, collapseWidth: 2 },
  taken_out:       { roomMin: 4, roomMax: 7, squareness: 0.6,  damage: { collapse: 3, overgrowth: 1 }, collapseWidth: 3 },
  uplift:          { roomMin: 3, roomMax: 8, squareness: 0.4,  damage: { collapse: 1, overgrowth: 4 }, collapseWidth: 2 },
  departure:       { roomMin: 5, roomMax: 6, squareness: 0.9,  damage: { collapse: 1, overgrowth: 1 }, collapseWidth: 2 },
  return_to_water: { roomMin: 3, roomMax: 7, squareness: 0.45, damage: { collapse: 2, overgrowth: 5 }, collapseWidth: 2 },
};

// Size tiers, game-fitted (the interior must live inside the ±48 m
// movement boundary at 2 m per cell, like the caverns' 44).
const TIER_CONFIG: Record<RuinInteriorTier, { width: number; height: number; rooms: [number, number]; extraLoops: number; loopMaxDist: number }> = {
  small:  { width: 32, height: 32, rooms: [4, 6],   extraLoops: 0, loopMaxDist: 14 },
  medium: { width: 40, height: 40, rooms: [8, 11],  extraLoops: 1, loopMaxDist: 20 },
  grand:  { width: 44, height: 44, rooms: [12, 16], extraLoops: 2, loopMaxDist: 24 },
};

interface RuinOpts {
  cellMeters: number;
  corridorWidth: number;
  secretCorridorWidth: number;
  roomGap: number;
  openBand: { min: number; max: number };
}

const RUIN_DEFAULTS: RuinOpts = {
  cellMeters: 2,
  corridorWidth: 2,
  secretCorridorWidth: 1,
  roomGap: 2,
  openBand: { min: 0.08, max: 0.6 },
};

// ---------------------------------------------------------------------------
// Small helpers (lab ports)
// ---------------------------------------------------------------------------

type Grid = string[][];

function ruinSeed(seedStr: string, zoneId: string, stage: string): number {
  return hashStringToSeed(`${seedStr}:zone:${zoneId}:ruin-${stage}`);
}

function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

function shuffle<T>(rng: () => number, arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function makeGrid(w: number, h: number): Grid {
  const g: Grid = new Array(h);
  for (let y = 0; y < h; y++) g[y] = new Array(w).fill('#');
  return g;
}

function setFloor(g: Grid, w: number, h: number, x: number, y: number, ch = '.'): [number, number] {
  const cx = Math.max(1, Math.min(w - 2, x));
  const cy = Math.max(1, Math.min(h - 2, y));
  g[cy][cx] = ch;
  return [cx, cy];
}

function isFloor(ch: string): boolean {
  return ch === '.' || ch === 'o' || ch === 'E' || ch === 'S' || ch === '*';
}

function rectsOverlap(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
  gap = 0
): boolean {
  return (
    a.x - gap < b.x + b.w &&
    a.x + a.w + gap > b.x &&
    a.y - gap < b.y + b.h &&
    a.y + a.h + gap > b.y
  );
}

function rollRoomSize(rng: () => number, style: RuinLayoutStyle): { w: number; h: number } {
  const span = style.roomMax - style.roomMin;
  const w = style.roomMin + Math.floor(rng() * (span + 1));
  let h = style.roomMin + Math.floor(rng() * (span + 1));
  if (rng() < style.squareness) {
    h = Math.max(style.roomMin, Math.min(style.roomMax, w + (rng() < 0.5 ? -1 : 1)));
  }
  return { w, h };
}

function roomCenter(r: { x: number; y: number; w: number; h: number }): [number, number] {
  return [r.x + Math.floor(r.w / 2), r.y + Math.floor(r.h / 2)];
}

// ---------------------------------------------------------------------------
// Corridor carving (L-shaped, in the cavern spirit)
// ---------------------------------------------------------------------------

interface RoomInternal extends RuinRoom {
  doors: { x: number; y: number }[];
}

interface EdgeInternal {
  a: string;
  b: string;
  bridge: boolean;
  collapsed: boolean;
  loop?: boolean;
  spine?: [number, number, string][];
}

function carveCorridor(
  g: Grid, w: number, h: number,
  roomA: RoomInternal, roomB: RoomInternal, cw: number
): { spine: [number, number, string][]; doors: [number, number, string][] } {
  const [x1, y1] = roomCenter(roomA);
  const [x2, y2] = roomCenter(roomB);
  const spine: [number, number, string][] = [];
  const step = (a: number, b: number): number => (a === b ? 0 : a < b ? 1 : -1);
  const sx = step(x1, x2), sy = step(y1, y2);
  for (let x = x1; ; x += sx) {
    for (let dy = 0; dy < cw; dy++) setFloor(g, w, h, x, y1 + dy);
    spine.push([x, y1, 'h']);
    if (x === x2) break;
  }
  for (let y = y1; ; y += sy) {
    for (let dx = 0; dx < cw; dx++) setFloor(g, w, h, x2 + dx, y);
    spine.push([x2, y, 'v']);
    if (y === y2) break;
  }
  const doors: [number, number, string][] = [];
  const inRect = (r: RoomInternal, x: number, y: number): boolean =>
    x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;
  for (let i = 0; i < spine.length; i++) {
    const [x, y] = spine[i];
    if (!inRect(roomA, x, y)) { doors.push([x, y, roomA.id]); break; }
  }
  for (let i = spine.length - 1; i >= 0; i--) {
    const [x, y] = spine[i];
    if (!inRect(roomB, x, y)) { doors.push([x, y, roomB.id]); break; }
  }
  return { spine, doors };
}

function stampRoom(g: Grid, w: number, h: number, r: RoomInternal): void {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) setFloor(g, w, h, x, y);
}

// ---------------------------------------------------------------------------
// Room graph utilities (shared by all three variants)
// ---------------------------------------------------------------------------

function roomDepths(
  rooms: RoomInternal[], edges: EdgeInternal[], entranceId: string
): { depth: Map<string, number>; adj: Map<string, string[]> } {
  const adj = new Map<string, string[]>(rooms.map((r) => [r.id, []]));
  for (const e of edges) {
    adj.get(e.a)!.push(e.b);
    adj.get(e.b)!.push(e.a);
  }
  const depth = new Map<string, number>([[entranceId, 0]]);
  const q = [entranceId];
  while (q.length) {
    const id = q.shift()!;
    for (const nb of adj.get(id)!)
      if (!depth.has(nb)) { depth.set(nb, depth.get(id)! + 1); q.push(nb); }
  }
  return { depth, adj };
}

function degreeOf(edges: EdgeInternal[], id: string): number {
  let d = 0;
  for (const e of edges) if (e.a === id || e.b === id) d++;
  return d;
}

/** Bridge edges: removing one disconnects the graph. Damage may
 *  never touch these — the "no dead end on the critical path" rule. */
function findBridges(rooms: RoomInternal[], edges: EdgeInternal[]): Set<number> {
  const adj = new Map<string, [string, number][]>(rooms.map((r) => [r.id, []]));
  edges.forEach((e, i) => { adj.get(e.a)!.push([e.b, i]); adj.get(e.b)!.push([e.a, i]); });
  const disc = new Map<string, number>(), low = new Map<string, number>(), bridges = new Set<number>();
  let t = 0;
  function dfs(u: string, parentEdge: number): void {
    disc.set(u, t); low.set(u, t); t++;
    for (const [v, ei] of adj.get(u)!) {
      if (ei === parentEdge) continue;
      if (!disc.has(v)) {
        dfs(v, ei);
        low.set(u, Math.min(low.get(u)!, low.get(v)!));
        if (low.get(v)! > disc.get(u)!) bridges.add(ei);
      } else {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  }
  for (const r of rooms) if (!disc.has(r.id)) dfs(r.id, -1);
  return bridges;
}

// ---------------------------------------------------------------------------
// Variant A — roomGraph (grows root-like from the entrance room)
// ---------------------------------------------------------------------------

function layoutRoomGraph(
  rng: () => number, w: number, h: number,
  style: RuinLayoutStyle, tier: (typeof TIER_CONFIG)[RuinInteriorTier]
): { rooms: RoomInternal[]; edges: EdgeInternal[] } {
  const rooms: RoomInternal[] = [];
  const edges: EdgeInternal[] = [];
  const [nMin, nMax] = tier.rooms;
  const target = nMin + Math.floor(rng() * (nMax - nMin + 1));

  const s0 = rollRoomSize(rng, style);
  const ex = 2 + Math.floor(rng() * (w - s0.w - 4));
  const ey = h - s0.h - 2;
  rooms.push({ id: 'r0', x: ex, y: ey, w: s0.w, h: s0.h, depth: 0, tags: ['entrance'], doors: [] });

  let tries = 0;
  while (rooms.length < target && tries < 600) {
    tries++;
    const parent = pick(rng, rooms);
    const dir = Math.floor(rng() * 4); // 0 N, 1 E, 2 S, 3 W
    const s = rollRoomSize(rng, style);
    const gap = 1 + Math.floor(rng() * 3); // short corridor-length gap
    let nx = 0, ny = 0;
    if (dir === 0) { ny = parent.y - gap - s.h; nx = parent.x + Math.floor(rng() * (parent.w + s.w)) - Math.floor(s.w / 2); }
    else if (dir === 1) { nx = parent.x + parent.w + gap; ny = parent.y + Math.floor(rng() * (parent.h + s.h)) - Math.floor(s.h / 2); }
    else if (dir === 2) { ny = parent.y + parent.h + gap; nx = parent.x + Math.floor(rng() * (parent.w + s.w)) - Math.floor(s.w / 2); }
    else { nx = parent.x - gap - s.w; ny = parent.y + Math.floor(rng() * (parent.h + s.h)) - Math.floor(s.h / 2); }
    nx = Math.max(1, Math.min(w - s.w - 1, nx));
    ny = Math.max(1, Math.min(h - s.h - 1, ny));
    const cand: RoomInternal = { id: 'r' + rooms.length, x: nx, y: ny, w: s.w, h: s.h, depth: 0, tags: [], doors: [] };
    if (rooms.some((r) => rectsOverlap(r, cand, 1))) continue;
    rooms.push(cand);
    edges.push({ a: parent.id, b: cand.id, bridge: false, collapsed: false });
  }

  addLoops(rng, rooms, edges, tier.extraLoops, tier.loopMaxDist);
  return { rooms, edges };
}

// ---------------------------------------------------------------------------
// Variant B — bsp (binary space partition; one snug room per leaf)
// ---------------------------------------------------------------------------

function layoutBSP(
  rng: () => number, w: number, h: number,
  style: RuinLayoutStyle, tier: (typeof TIER_CONFIG)[RuinInteriorTier]
): { rooms: RoomInternal[]; edges: EdgeInternal[] } {
  const [nMin, nMax] = tier.rooms;
  const target = nMin + Math.floor(rng() * (nMax - nMin + 1));
  const minLeaf = 9;

  interface Leaf { x: number; y: number; w: number; h: number }
  let leaves: Leaf[] = [{ x: 2, y: 2, w: w - 4, h: h - 4 }];
  const splits: { left: Leaf; right: Leaf }[] = [];
  // A leaf that fails a split is UNSPLITTABLE, not deleted — deleting
  // it would lose a room. (Lab note, kept.)
  const unsplittable = new Set<Leaf>();
  const canSplit = (r: Leaf): boolean => !unsplittable.has(r) && (r.w >= minLeaf * 2 || r.h >= minLeaf * 2);
  while (leaves.length < target) {
    const splittable = leaves.filter(canSplit);
    if (!splittable.length) break;
    splittable.sort((a, b) => b.w * b.h - a.w * a.h);
    const r = splittable[0];
    const vertical = r.w >= r.h ? rng() < 0.7 : rng() < 0.3;
    const ratio = 0.35 + rng() * 0.3;
    let a: Leaf, b: Leaf;
    if (vertical) {
      const sx = Math.floor(r.w * ratio);
      if (sx < minLeaf || r.w - sx < minLeaf) { unsplittable.add(r); continue; }
      a = { x: r.x, y: r.y, w: sx, h: r.h };
      b = { x: r.x + sx, y: r.y, w: r.w - sx, h: r.h };
    } else {
      const sy = Math.floor(r.h * ratio);
      if (sy < minLeaf || r.h - sy < minLeaf) { unsplittable.add(r); continue; }
      a = { x: r.x, y: r.y, w: r.w, h: sy };
      b = { x: r.x, y: r.y + sy, w: r.w, h: r.h - sy };
    }
    splits.push({ left: a, right: b });
    leaves.splice(leaves.indexOf(r), 1, a, b);
  }

  const rooms: RoomInternal[] = leaves.map((leaf, i) => {
    const s = rollRoomSize(rng, style);
    const rw = Math.max(3, Math.min(s.w, leaf.w - 2));
    const rh = Math.max(3, Math.min(s.h, leaf.h - 2));
    const x = leaf.x + 1 + Math.floor(rng() * Math.max(1, leaf.w - rw - 1));
    const y = leaf.y + 1 + Math.floor(rng() * Math.max(1, leaf.h - rh - 1));
    return { id: 'r' + i, x, y, w: rw, h: rh, depth: 0, tags: [], doors: [] };
  });

  const leafOf = rooms.map((r, i) => ({ r, leaf: leaves[i] }));
  const edges: EdgeInternal[] = [];
  const seen = new Set<string>();
  for (const { left, right } of splits) {
    const inL = leafOf.filter(({ leaf }) => rectsOverlap(leaf, left, 0) && leaf.x === left.x && leaf.y === left.y);
    const inR = leafOf.filter(({ leaf }) => rectsOverlap(leaf, right, 0) && leaf.x === right.x && leaf.y === right.y);
    if (!inL.length || !inR.length) continue;
    const ra = pick(rng, inL).r;
    const rb = pick(rng, inR).r;
    const key = ra.id + '|' + rb.id;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ a: ra.id, b: rb.id, bridge: false, collapsed: false });
  }
  addLoops(rng, rooms, edges, tier.extraLoops, tier.loopMaxDist);
  // Entrance = room closest to the south edge, centered ties.
  const entrance = rooms.slice().sort((a, b) =>
    (b.y + b.h) - (a.y + a.h) || Math.abs(a.x + a.w / 2 - w / 2) - Math.abs(b.x + b.w / 2 - w / 2)
  )[0];
  entrance.tags.push('entrance');
  return { rooms, edges };
}

// ---------------------------------------------------------------------------
// Variant C — placedRooms (scatter + Kruskal MST + loops)
// ---------------------------------------------------------------------------

function layoutPlacedRooms(
  rng: () => number, w: number, h: number,
  style: RuinLayoutStyle, tier: (typeof TIER_CONFIG)[RuinInteriorTier],
  opts: RuinOpts
): { rooms: RoomInternal[]; edges: EdgeInternal[] } {
  const [nMin, nMax] = tier.rooms;
  const target = nMin + Math.floor(rng() * (nMax - nMin + 1));
  const rooms: RoomInternal[] = [];
  let tries = 0;
  while (rooms.length < target && tries < 800) {
    tries++;
    const s = rollRoomSize(rng, style);
    const cand: RoomInternal = {
      id: 'r' + rooms.length,
      x: 1 + Math.floor(rng() * (w - s.w - 2)),
      y: 1 + Math.floor(rng() * (h - s.h - 2)),
      w: s.w, h: s.h, depth: 0, tags: [], doors: [],
    };
    if (rooms.some((r) => rectsOverlap(r, cand, opts.roomGap))) continue;
    rooms.push(cand);
  }

  // Kruskal MST over room centers (deterministic tie-break by id).
  const parent = new Map<string, string>(rooms.map((r) => [r.id, r.id]));
  const find = (x: string): string => (parent.get(x) === x ? x : (parent.set(x, find(parent.get(x)!)), parent.get(x)!));
  const pairs: { a: string; b: string; d: number }[] = [];
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i], b = rooms[j];
      const [ax, ay] = roomCenter(a), [bx, by] = roomCenter(b);
      pairs.push({ a: a.id, b: b.id, d: (ax - bx) ** 2 + (ay - by) ** 2 });
    }
  pairs.sort((p, q) => p.d - q.d || (p.a < q.a ? -1 : 1) || (p.b < q.b ? -1 : 1));
  const edges: EdgeInternal[] = [];
  for (const p of pairs) {
    const ra = find(p.a), rb = find(p.b);
    if (ra !== rb) { parent.set(ra, rb); edges.push({ a: p.a, b: p.b, bridge: false, collapsed: false }); }
  }
  addLoops(rng, rooms, edges, tier.extraLoops, tier.loopMaxDist);
  const entrance = rooms.slice().sort((a, b) =>
    (b.y + b.h) - (a.y + a.h) || Math.abs(a.x + a.w / 2 - w / 2) - Math.abs(b.x + b.w / 2 - w / 2)
  )[0];
  entrance.tags.push('entrance');
  return { rooms, edges };
}

/** Extra loop edges between non-adjacent rooms within a max center
 *  distance. Escape routes, not shortcuts. */
function addLoops(
  rng: () => number, rooms: RoomInternal[], edges: EdgeInternal[],
  count: number, maxDist: number
): number {
  const connected = new Set<string>(
    edges.map((e) => e.a + '|' + e.b).concat(edges.map((e) => e.b + '|' + e.a))
  );
  let added = 0, tries = 0;
  while (added < count && tries < 100) {
    tries++;
    const a = pick(rng, rooms), b = pick(rng, rooms);
    if (a.id === b.id) continue;
    if (connected.has(a.id + '|' + b.id)) continue;
    const [ax, ay] = roomCenter(a), [bx, by] = roomCenter(b);
    if ((ax - bx) ** 2 + (ay - by) ** 2 > maxDist * maxDist) continue;
    edges.push({ a: a.id, b: b.id, bridge: false, collapsed: false, loop: true });
    connected.add(a.id + '|' + b.id);
    connected.add(b.id + '|' + a.id);
    added++;
  }
  return added;
}

// ---------------------------------------------------------------------------
// Stage: carve layout onto the grid + designate secret/heart
// ---------------------------------------------------------------------------

interface LayoutResult {
  rooms: RoomInternal[];
  edges: EdgeInternal[];
  entranceRoom: RoomInternal;
  secret: RoomInternal | null;
  heart: RoomInternal;
}

function buildLayout(
  rng: () => number, g: Grid, w: number, h: number,
  variant: RuinVariantId, style: RuinLayoutStyle,
  tier: (typeof TIER_CONFIG)[RuinInteriorTier], opts: RuinOpts
): LayoutResult {
  let layout: { rooms: RoomInternal[]; edges: EdgeInternal[] };
  if (variant === 'roomGraph') layout = layoutRoomGraph(rng, w, h, style, tier);
  else if (variant === 'bsp') layout = layoutBSP(rng, w, h, style, tier);
  else layout = layoutPlacedRooms(rng, w, h, style, tier, opts);

  const { rooms, edges } = layout;
  for (const r of rooms) stampRoom(g, w, h, r);

  const roomById = new Map(rooms.map((r) => [r.id, r]));
  edges.forEach((e) => {
    const { spine, doors } = carveCorridor(g, w, h, roomById.get(e.a)!, roomById.get(e.b)!, opts.corridorWidth);
    e.spine = spine;
    for (const [dx, dy, rid] of doors) roomById.get(rid)!.doors.push({ x: dx, y: dy });
  });

  const entranceRoom = rooms.find((r) => r.tags.includes('entrance'))!;
  const { depth } = roomDepths(rooms, edges, entranceRoom.id);
  for (const r of rooms) r.depth = depth.get(r.id) ?? -1;

  // Secret: deepest leaf (degree 1) room — reachable, just tucked away.
  const leaves = rooms.filter((r) => degreeOf(edges, r.id) === 1 && r.id !== entranceRoom.id);
  leaves.sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : 1));
  const secret = leaves[0] || null;
  if (secret) secret.tags.push('secret');

  // Heart: deepest room overall (not the secret unless it IS the deepest).
  const byDepth = rooms.slice().sort((a, b) => b.depth - a.depth || (a.id < b.id ? -1 : 1));
  const heart = byDepth.find((r) => r.id !== (secret && secret.id)) || byDepth[0];
  heart.tags.push('heart');

  return { rooms, edges, entranceRoom, secret, heart };
}

// ---------------------------------------------------------------------------
// Stage: damage pass ("run the centuries")
// ---------------------------------------------------------------------------
// Fate-parameterized. collapse — rubble across corridor cross-sections,
// ONLY on non-bridge edges (the lab's hard rule: damage can never seal
// a room). overgrowth — room cells reclaimed by flora, still walkable.

// ---------------------------------------------------------------------------
// Grid reachability — BFS over floor cells; the set of rooms whose
// CENTER is reached. The lab validated at room-GRAPH level; the game
// walks the grid, and corridors share cells where they cross, so a
// graph-non-bridge collapse can still sever the only walked path.
// The lab's hard rule ("damage can never seal a room") is enforced
// HERE, at grid level: any damage step that strands a room center is
// reverted, and final validation re-proves it.
// ---------------------------------------------------------------------------

function bfsReachedRooms(g: Grid, w: number, h: number, rooms: RoomInternal[], sx: number, sy: number): Set<string> {
  const seen = new Set<string>();
  const key = (x: number, y: number): string => x + ',' + y;
  const q: [number, number][] = [[sx, sy]];
  seen.add(key(sx, sy));
  while (q.length) {
    const [x, y] = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy, k = key(nx, ny);
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen.has(k) || !isFloor(g[ny][nx])) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  const reached = new Set<string>();
  for (const r of rooms) {
    const [cx, cy] = roomCenter(r);
    if (seen.has(key(cx, cy))) reached.add(r.id);
  }
  return reached;
}

function stageDamage(
  rng: () => number, g: Grid, w: number, h: number,
  layout: LayoutResult, style: RuinLayoutStyle
): { collapseCells: number; overgrowthCells: number; shrunkenRooms: number } {
  const { rooms, edges } = layout;
  let collapseCells = 0, overgrowthCells = 0, shrunkenRooms = 0;
  const [entCx, entCy] = roomCenter(layout.entranceRoom);
  const allRoomsReached = (): boolean => bfsReachedRooms(g, w, h, rooms, entCx, entCy).size === rooms.length;

  const bridges = findBridges(rooms, edges);
  edges.forEach((e, i) => { e.bridge = bridges.has(i); });

  // Collapse: spine cells inside a room rect are excluded as block
  // points — rubble in a room's middle could land on a feature site.
  const inAnyRoom = (x: number, y: number): boolean =>
    rooms.some((r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h);
  const candidates = edges.filter((e) => !e.bridge && e.spine && e.spine.length > 4)
    .map((e) => ({ e, corridorSpine: e.spine!.filter(([x, y]) => !inAnyRoom(x, y)) }))
    .filter((c) => c.corridorSpine.length > 2);
  shuffle(rng, candidates);
  const nCollapse = Math.min(style.damage.collapse, candidates.length);
  for (let k = 0; k < nCollapse; k++) {
    const { e, corridorSpine } = candidates[k];
    const mid = corridorSpine[Math.floor(corridorSpine.length / 2)];
    const [mx, my, orient] = mid;
    // Write the rubble block, then PROVE at grid level that no room
    // was sealed; a block that severs the walked path reverts (its
    // corridor still reads as damaged elsewhere — flavor survives).
    // (Net cell effect matches the lab: '#' via setFloor, then 'x'.)
    const written: [number, number, string][] = [];
    for (let d = 0; d < style.collapseWidth; d++) {
      const rawX = orient === 'h' ? mx : mx + d;
      const rawY = orient === 'h' ? my + d : my;
      const bx = Math.max(1, Math.min(w - 2, rawX));
      const by = Math.max(1, Math.min(h - 2, rawY));
      written.push([bx, by, g[by][bx]]);
      g[by][bx] = 'x';
    }
    if (allRoomsReached()) {
      collapseCells += written.length;
      e.collapsed = true;
    } else {
      for (const [bx, by, prev] of written) g[by][bx] = prev;
    }
  }

  // Room shrink: one multi-door room (never entrance/heart/secret)
  // loses a 1-cell strip. Safety: the strip must hold no corridor
  // spine cell, and every door must keep a room-floor neighbor.
  const spineCells = new Set<string>();
  for (const e of edges) if (e.spine) for (const [x, y] of e.spine) spineCells.add(x + ',' + y);
  const shrinkables = rooms.filter((r) =>
    !r.tags.includes('entrance') && !r.tags.includes('heart') && !r.tags.includes('secret') &&
    new Set(r.doors.map((d) => d.x + ',' + d.y)).size >= 2 && r.w > 4 && r.h > 4);
  if (shrinkables.length && rng() < 0.7) {
    const r = pick(rng, shrinkables);
    const sideOrder = shuffle(rng, [0, 1, 2, 3]);
    for (const side of sideOrder) {
      const saved: string[] = [];
      const strip: [number, number][] = [];
      if (side === 0) for (let x = r.x; x < r.x + r.w; x++) strip.push([x, r.y]);
      else if (side === 1) for (let y = r.y; y < r.y + r.h; y++) strip.push([r.x + r.w - 1, y]);
      else if (side === 2) for (let x = r.x; x < r.x + r.w; x++) strip.push([x, r.y + r.h - 1]);
      else for (let y = r.y; y < r.y + r.h; y++) strip.push([r.x, y]);
      if (strip.some(([x, y]) => spineCells.has(x + ',' + y))) continue;
      for (const [x, y] of strip) { saved.push(g[y][x]); g[y][x] = '#'; }
      const doorsOk = r.doors.every((d) =>
        [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
          const nx = d.x + dx, ny = d.y + dy;
          return nx >= r.x && nx < r.x + r.w && ny >= r.y && ny < r.y + r.h && isFloor(g[ny][nx]);
        })
      );
      if (doorsOk) {
        const orig = { x: r.x, y: r.y, w: r.w, h: r.h };
        if (side === 0) { r.y += 1; r.h -= 1; }
        else if (side === 1) { r.w -= 1; }
        else if (side === 2) { r.h -= 1; }
        else { r.x += 1; r.w -= 1; }
        // Same grid-level proof as collapse: a shrink that strands a
        // room center reverts whole (strip + rect).
        if (allRoomsReached()) {
          r.tags.push('shrunken');
          shrunkenRooms++;
        } else {
          Object.assign(r, orig);
          strip.forEach(([x, y], i) => { g[y][x] = saved[i]; });
        }
      } else {
        strip.forEach(([x, y], i) => { g[y][x] = saved[i]; });
      }
      break; // one shrink attempt per ruin
    }
  }

  // Overgrowth: fate-weighted room count; 30–60% of each room's cells.
  const ogTargets = shuffle(rng, rooms.filter((r) => !r.tags.includes('entrance'))).slice(0, style.damage.overgrowth);
  for (const r of ogTargets) {
    const cells: [number, number][] = [];
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) cells.push([x, y]);
    shuffle(rng, cells);
    const n = Math.floor(cells.length * (0.3 + rng() * 0.3));
    for (let i = 0; i < n; i++) {
      const [x, y] = cells[i];
      if (g[y][x] === '.') { g[y][x] = 'o'; overgrowthCells++; }
    }
    r.tags.push('overgrown');
  }

  return { collapseCells, overgrowthCells, shrunkenRooms };
}

// ---------------------------------------------------------------------------
// Stage: features by graph depth
// ---------------------------------------------------------------------------
// Clues arrive in layers with distance from the door: mundane evidence
// shallow, the story's heart deepest. The game maps these to content:
// clue_* -> glyph stones (lore), cache -> precursor caches (loot),
// artifact_heart -> the ruin's heart prize.

function stageFeatures(
  layout: LayoutResult,
  fate: WorldFate,
  tier: RuinInteriorTier,
): { features: RuinFeature[]; maxDepth: number } {
  const { rooms, entranceRoom, heart } = layout;
  const features: RuinFeature[] = [];
  const add = (type: RuinFeature['type'], room: RoomInternal, band: RuinFeature['band']): void => {
    const [cx, cy] = roomCenter(room);
    features.push({ id: 'rf_' + features.length, type, cx, cy, roomId: room.id, depth: room.depth, band });
  };

  const maxDepth = Math.max(...rooms.map((r) => r.depth));
  const bandOf = (d: number): RuinFeature['band'] =>
    (d <= 1 ? 'shallow' : d >= Math.max(2, maxDepth - 1) ? 'deep' : 'mid');
  add('clue_shallow', entranceRoom, 'shallow');
  for (const r of rooms) {
    if (r.id === entranceRoom.id || r.id === heart.id) continue;
    if (r.depth <= 1) add('clue_shallow', r, 'shallow');
    else add(r.depth % 2 === 0 ? 'clue_deep' : 'cache', r, bandOf(r.depth));
  }
  add('artifact_heart', heart, 'deep');
  // THE PORTAL STATION (Departure D2, Follow worlds): in a
  // grand ruin of a Follow fate, the ruin's GRAND HALL —
  // its largest room — holds the station ring their road
  // home ran through; the chapters say the rings "still
  // stand in the grand ruins." The heart rooms are small
  // (measured 3–7 cells); a monument belongs in the hall
  // (measured min dimension ≥ 6 in every grand ruin), so
  // the ring stands in its own chamber, at its center.
  if (tier === 'grand' && finaleFamilyOf(fate) === 'follow') {
    let hall: RoomInternal | null = null;
    for (const r of rooms) {
      if (r.id === entranceRoom.id) continue;
      if (!hall || r.w * r.h > hall.w * hall.h || (r.w * r.h === hall.w * hall.h && r.depth > hall.depth)) hall = r;
    }
    if (hall && Math.min(hall.w, hall.h) >= 5) {
      add('portal_ring', hall, 'deep');
    }
  }
  return { features, maxDepth };
}

// ---------------------------------------------------------------------------
// Stage: validation — a shipped ruin must PROVE every room reachable
// after damage, every feature on floor, no overlapping rooms.
// ---------------------------------------------------------------------------

function validateRuin(
  g: Grid, w: number, h: number,
  layout: LayoutResult, features: RuinFeature[], opts: RuinOpts
): RuinValidation {
  const { rooms, edges, entranceRoom } = layout;
  const { depth } = roomDepths(rooms, edges, entranceRoom.id);
  const roomsReachable = rooms.every((r) => depth.has(r.id));
  // Grid-level proof (the game's addition): BFS the actual floor
  // from the entrance CELL and require every room center reached.
  const [entCx, entCy] = roomCenter(entranceRoom);
  const entCellX = entCx, entCellY = Math.min(h - 2, entranceRoom.y + entranceRoom.h - 1);
  const gridReachable = bfsReachedRooms(g, w, h, rooms, entCellX, entCellY).size === rooms.length;
  const featuresOnFloor = features.every((f) => isFloor(g[f.cy][f.cx]));
  let noOverlap = true;
  for (let i = 0; i < rooms.length; i++)
    for (let j = i + 1; j < rooms.length; j++)
      if (rectsOverlap(rooms[i], rooms[j], 0)) noOverlap = false;
  let open = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (isFloor(g[y][x])) open++;
  const openBandOk = open / (w * h) >= opts.openBand.min && open / (w * h) <= opts.openBand.max;
  const deadEnds = rooms.filter((r) => degreeOf(edges, r.id) === 1).length;
  const loops = edges.length - rooms.length + 1;
  const v: RuinValidation = { roomsReachable, gridReachable, featuresOnFloor, noOverlap, openBandOk, deadEnds, loops, pass: false };
  v.pass = roomsReachable && gridReachable && featuresOnFloor && noOverlap && openBandOk;
  return v;
}

// ---------------------------------------------------------------------------
// Public entry point (lab contract)
// ---------------------------------------------------------------------------

export function generateRuin(
  seedStr: string,
  options: { variant: RuinVariantId; tier: RuinInteriorTier; fate: WorldFate; zoneId: string }
): RuinResult {
  const { variant, tier, fate, zoneId } = options;
  const tierCfg = TIER_CONFIG[tier];
  const style = RUIN_LAYOUT_STYLES[fate];
  const opts = RUIN_DEFAULTS;
  const w = tierCfg.width, h = tierCfg.height;

  // Independent streams per stage — damage knobs never re-roll layout.
  const layoutRng = createSeededRandom(ruinSeed(seedStr, zoneId, 'layout'));
  const damageRng = createSeededRandom(ruinSeed(seedStr, zoneId, 'damage'));

  const g = makeGrid(w, h);

  // ---- Stage 1: layout ----
  const layout = buildLayout(layoutRng, g, w, h, variant, style, tierCfg, opts);

  // ---- Stage 2: damage pass ("run the centuries") ----
  const damageStats = stageDamage(damageRng, g, w, h, layout, style);

  // ---- Stage 3: features by graph depth ----
  const { features, maxDepth } = stageFeatures(layout, fate, tier);

  // ---- Entrance cell + markers (drawn last so maps read at a glance) ----
  const entranceRoom = layout.entranceRoom;
  const [ecx, ecy] = roomCenter(entranceRoom);
  const entranceCell = { x: ecx, y: Math.min(h - 2, entranceRoom.y + entranceRoom.h - 1) };
  g[entranceCell.y][entranceCell.x] = 'E';
  const [hcx, hcy] = roomCenter(layout.heart);
  if (g[hcy][hcx] !== 'E') g[hcy][hcx] = '*';
  let secretOut: RuinResult['secret'] = null;
  if (layout.secret) {
    const [scx, scy] = roomCenter(layout.secret);
    if (g[scy][scx] === '.' || g[scy][scx] === 'o') g[scy][scx] = 'S';
    secretOut = { cx: scx, cy: scy, roomId: layout.secret.id };
  }

  // ---- Stage 4: validation ----
  const validation = validateRuin(g, w, h, layout, features, opts);

  // ---- Portal link (return-address bookkeeping; never seed math) ----
  let entryDx = 0, entryDy = -1;
  {
    const dx = ecx - entranceCell.x, dy = ecy - entranceCell.y;
    const m = Math.hypot(dx, dy);
    if (m > 1e-9) { entryDx = dx / m; entryDy = dy / m; }
  }
  const link: RuinResult['link'] = {
    zoneId,
    zoneEntrance: { cx: entranceCell.x, cy: entranceCell.y },
    zoneEntrySpawn: {
      cx: entranceCell.x,
      cy: entranceCell.y,
      facing: { dx: entryDx, dy: entryDy },
    },
  };

  return {
    seedStr,
    zoneId,
    variant,
    tier,
    fate,
    width: w,
    height: h,
    cellMeters: opts.cellMeters,
    grid: g.map((row) => row.join('')),
    rooms: layout.rooms.map((r) => ({ id: r.id, x: r.x, y: r.y, w: r.w, h: r.h, depth: r.depth, tags: r.tags })),
    edges: layout.edges.map((e) => ({ a: e.a, b: e.b, bridge: e.bridge, collapsed: e.collapsed, loop: !!e.loop })),
    entrance: { cx: entranceCell.x, cy: entranceCell.y, roomId: entranceRoom.id },
    heart: { cx: hcx, cy: hcy, roomId: layout.heart.id },
    secret: secretOut,
    features,
    maxDepth,
    damageStats,
    link,
    meta: { genVersion: RUIN_INTERIOR_GEN_VERSION, validation },
  };
}

// ---------------------------------------------------------------------------
// The game entry: a ruin interior from its landmark link record
// ---------------------------------------------------------------------------

/** Max generation attempts before giving up (bounded + deterministic). */
export const MAX_RUIN_ATTEMPTS = 8;

export interface RuinLinkInput {
  instanceId: string;
  fate: WorldFate;
  variant: RuinVariantId;
  tier: RuinTierId;
}

/**
 * Build one ruin interior for play, or null when the ruin cannot be
 * generated ('traces' landmarks have no interior; a failed validation
 * after every attempt means this ruin stays sealed). Same bounded
 * deterministic retry as the cavern generator: attempt 0 uses the
 * plain instanceId (every first-try-valid ruin is identical to the
 * un-retried math), retries append '#rN' to the zoneId.
 */
export function generateGameRuin(seedStr: string, link: RuinLinkInput): RuinResult | null {
  if (link.tier === 'traces') return null;
  const tier = link.tier as RuinInteriorTier;
  for (let attempt = 0; attempt < MAX_RUIN_ATTEMPTS; attempt++) {
    const zoneId = attempt === 0 ? link.instanceId : `${link.instanceId}#r${attempt}`;
    const ruin = generateRuin(seedStr, { variant: link.variant, tier, fate: link.fate, zoneId });
    if (ruin.meta.validation.pass) return ruin;
  }
  return null;
}

/** Cell -> world, shared with the caverns (same 2 m grid convention). */
export const ruinCellToWorld = cavernCellToWorld;

/**
 * Camera yaw (radians) for entering a ruin: face along the entry
 * spawn's facing. World convention (cavernEntryYaw's twin):
 * yaw = atan2(dx, dy) of the grid facing.
 */
export function ruinEntryYaw(ruin: RuinResult): number {
  const f = ruin.link.zoneEntrySpawn.facing;
  return Math.atan2(f.dx, f.dy);
}

/**
 * The collision grid the controller consumes: walkable chars become
 * '.', everything else '#'. The ruin's own grid keeps its richer
 * alphabet for the renderer (overgrowth, rubble, markers).
 */
export function ruinCollisionGrid(ruin: RuinResult): string[] {
  return ruin.grid.map((row) =>
    row.split('').map((ch) => (isFloor(ch) ? '.' : '#')).join('')
  );
}

// ---------------------------------------------------------------------------
// Ruin lore — what the stones remember, per fate
// ---------------------------------------------------------------------------
// The fate is never named in the UI (Adam's call: a world's story is
// discovered by reading its ruins). These lines are the reading:
// glyph stones serve the shallow/deep lines by depth band; the
// artifact heart serves the heart line when taken. Keys are the
// WorldFate ids; unknown fates fall back to the gardeners' lines.

export const RUIN_LORE: Record<string, { shallow: string; deep: string; heart: string }> = {
  gardeners: {
    shallow: 'They grew this place the way you grow a garden — patiently, and meaning it to outlive them.',
    deep: 'The roots remember hands. Whatever the Gardeners planted here, they expected to come back and prune it.',
    heart: 'At the heart, a seed the size of a fist, still warm. They left in the middle of planting.',
  },
  crash: {
    shallow: 'Scorch marks and torn bulkheads. Whatever fell here fell fast, and from very far up.',
    deep: 'Cargo, still strapped down. They survived the fall — the record just stops, mid-sentence, a week later.',
    heart: 'The heart is a flight recorder, still turning. It has been recording the silence for centuries.',
  },
  long_experiment: {
    shallow: 'Everything is labeled. Everything is measured. The experiment outlived the experimenters.',
    deep: 'Observation slits in every wall. Something here was watched for a very long time — or something was watching.',
    heart: "At the heart, one final entry: 'Subject has begun observing back. Recommend—' It ends there.",
  },
  evacuation: {
    shallow: 'They left in order. Beds made, tools hung, doors shut. Only the leaving was sudden.',
    deep: 'Lists on the walls: names, checked off one by one. Near the end, the checks get shaky.',
    heart: 'At the heart, a single uncrossed name — and a chair facing the door, as if someone sat down to wait.',
  },
  becoming: {
    shallow: 'The walls are not quite stone anymore. Neither are they quite anything else.',
    deep: "Furniture mid-change — a table becoming root, a door becoming wing. They didn't flee the change. They chose it.",
    heart: 'At the heart, shapes that might have been people, reaching up like saplings toward a sun they became part of.',
  },
  war: {
    shallow: 'Scorched stone, split pillars. Whatever happened here was done on purpose, by professionals.',
    deep: "Barricades facing inward. In the end they weren't fighting the world. They were fighting each other.",
    heart: 'At the heart, two banners, long rotted, planted in the same stone. Neither side won. The stone did.',
  },
  sickness: {
    shallow: 'Sealed doors, marked with care. Someone was trying very hard not to spread something.',
    deep: "Rows of beds, all empty, all made. The sickness took them gently, or took them elsewhere — the care never stopped.",
    heart: "At the heart, a garden of white flowers that grow nowhere else, in careful rows over what the beds couldn't hold.",
  },
  taken_out: {
    shallow: 'No damage. No disorder. Everything simply stops, like a song cut off mid-note.',
    deep: 'Meals half-eaten, tools mid-task — everywhere the same story: they were here, and then, all at once, they were not.',
    heart: 'At the heart, a circle of seats around nothing at all — the exact center of whatever took them.',
  },
  uplift: {
    shallow: 'Everything reaches: towers toward the canopy, carvings toward the sky. They were building toward something.',
    deep: 'Lessons carved at child height, then higher, then higher. They were teaching something to grow up and leave.',
    heart: 'At the heart, an empty cradle the size of a house, aimed at the stars. Whatever they raised here, it left.',
  },
  departure: {
    shallow: 'Packed, inventoried, sealed. The tidiest ending a people can write for themselves.',
    deep: 'Instructions left for whoever finds this place: how things work, what to avoid. They expected an audience.',
    heart: "At the heart, a manifest: everything accounted for, every soul signed out — and one line added later, in a different hand: 'Thank you.'",
  },
  return_to_water: {
    shallow: 'Waterlines on every wall, and everything green with the memory of the flood they chose.',
    deep: "They carved channels to invite the water in, room by room. This wasn't a disaster. It was a homecoming.",
    heart: 'At the heart, a pool that never dries, and in it, reflections of people who are not standing there.',
  },
};

/** One lore line for a fate + band, with a safe fallback. */
export function ruinLoreLine(fate: string, band: 'shallow' | 'deep' | 'heart'): string {
  const entry = RUIN_LORE[fate] ?? RUIN_LORE.gardeners;
  return entry[band];
}
