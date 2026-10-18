// ============================================================================
// cavernFauna.ts — THE CAVE DEALER (creature program Part 7, slice
// C1, 2026-10-18; design: CREATURES_BRAINSTORM_7.md)
//
// Surface fauna are dealt by worldGen from biome, variant and gate.
// Cavern fauna are dealt HERE, from DEPTH — the one axis a cave
// has. The two dealers share no table and no stream: a cavern
// species can never leak onto the surface, nor a surface species
// down, because neither dealer has ever heard of the other's
// country.
//
// The dealer runs inside useInstances' enterCavernLevel — the one
// door every cavern level enters through, shared by entry and
// descent — alongside the level's flora. Its stream is its own
// (instanceId + depth + 'cavern:fauna'), so the cavern generator's
// streams are never perturbed: CAVERN_GEN_VERSION does not move,
// existing caves keep their shapes, and every peer in a level
// deals the identical citizenry from the identical cavern.
// ============================================================================

import { createSeededRandom, hashStringToSeed } from '../engine/motion';
import { cavernCellToWorld, type CavernResult } from '../world/cavern';
import type { FaunaEntity, FaunaSpecies } from '../../types/game';

// One row of the depth table: a species, the count range this band
// deals, and the body it deals in (speed/health live here, not in
// bonusSpawn — the surface dealer reads those from the spawn spec;
// the cavern dealer keeps its own page, as designed).
interface CavernBandRow {
  species: FaunaSpecies;
  min: number;
  max: number;
  speed: number;
  health: number;
}

// The bands (Part 7 §1): the Biolume shallows are skitter country
// with the odd young colony; the Violet Deep evens out; from the
// Abyssal Dark down, the L3 band holds — the dark below the named
// strata is not a new country, just more of the deepest one. The
// Pale Stalker (C2) and the Deep Maw (C3) join this table with
// their slices; the Maw's row will anchor to the heart cell
// instead of the open floor.
function bandForDepth(depth: number): CavernBandRow[] {
  if (depth <= 1) {
    return [
      { species: 'gloom_skitter', min: 3, max: 5, speed: 2.6, health: 18 },
      { species: 'spore_husk', min: 0, max: 2, speed: 0, health: 30 },
    ];
  }
  if (depth === 2) {
    return [
      { species: 'gloom_skitter', min: 2, max: 4, speed: 2.6, health: 18 },
      { species: 'spore_husk', min: 1, max: 3, speed: 0, health: 30 },
    ];
  }
  return [
    { species: 'gloom_skitter', min: 2, max: 3, speed: 2.6, health: 18 },
    { species: 'spore_husk', min: 2, max: 3, speed: 0, health: 30 },
  ];
}

// Is the straight line between two grid cells all floor? Walked in
// half-cell steps: a leg the dealer stamps into a citizen's roam
// has been walked here first, so the sim — which cannot see the
// grid — is never handed a target through a wall.
function legIsFloor(
  grid: string[],
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  const dist = Math.hypot(bx - ax, by - ay);
  const steps = Math.max(1, Math.ceil(dist * 2));
  for (let i = 0; i <= steps; i++) {
    const cx = Math.round(ax + ((bx - ax) * i) / steps);
    const cy = Math.round(ay + ((by - ay) * i) / steps);
    if (grid[cy]?.[cx] !== '.') return false;
  }
  return true;
}

/**
 * Deal one cavern level's citizens. Pure in (cavern, instanceId,
 * depth): the same level deals the same fauna on every client,
 * every visit — instances are never saved, so a re-entered level
 * is a renewed one, the same law surface zones live by on travel.
 */
export function dealCavernFauna(
  cavern: CavernResult,
  instanceId: string,
  depth: number,
): FaunaEntity[] {
  const rng = createSeededRandom(
    hashStringToSeed(`${instanceId}:d${depth}:cavern:fauna`),
  );
  const { grid, width, height, entrance, heart } = cavern;
  const cell = cavern.cellMeters;

  // The open floor, minus the two places citizens may not be
  // dealt onto: the entrance neighborhood (the player
  // materializes there — nothing spawns in the doorway) and the
  // heart cell's neighborhood (the Deep Maw's seat from C3; in
  // C1 the heart simply stays clear, a quiet chamber).
  const floorCells: { cx: number; cy: number }[] = [];
  for (let cy = 0; cy < height; cy++) {
    for (let cx = 0; cx < width; cx++) {
      if (grid[cy]?.[cx] !== '.') continue;
      if (Math.abs(cx - entrance.x) <= 2 && Math.abs(cy - entrance.y) <= 2) continue;
      if (heart && Math.abs(cx - heart.x) <= 1 && Math.abs(cy - heart.y) <= 1) continue;
      floorCells.push({ cx, cy });
    }
  }
  if (floorCells.length === 0) return [];

  const fauna: FaunaEntity[] = [];
  const taken: { x: number; z: number }[] = []; // world-space, spacing
  let n = 0;

  for (const row of bandForDepth(depth)) {
    const count = row.min + Math.floor(rng() * (row.max - row.min + 1));
    for (let k = 0; k < count; k++) {
      // Find a home cell: spread at least 4 m from every citizen
      // already dealt, so a level's life reads as a population,
      // not a pile. Attempts are bounded; a cramped cave simply
      // deals fewer citizens than the band hoped.
      let home: { cx: number; cy: number } | null = null;
      for (let attempt = 0; attempt < 40 && !home; attempt++) {
        const cand = floorCells[Math.floor(rng() * floorCells.length)];
        const w = cavernCellToWorld(cand.cx, cand.cy, width, height);
        if (taken.some((p) => Math.hypot(p.x - w.x, p.z - w.z) < 4)) continue;
        home = cand;
      }
      if (!home) continue;
      const homeWorld = cavernCellToWorld(home.cx, home.cy, width, height);
      taken.push(homeWorld);

      // The roam: the home point plus up to two more floor points
      // within 12 m, each leg walked along the grid above. A
      // sessile citizen (speed 0) keeps just its home — it is not
      // going anywhere, and its entry says so.
      const roam: { x: number; z: number }[] = [{ ...homeWorld }];
      if (row.speed > 0) {
        for (let attempt = 0; attempt < 12 && roam.length < 3; attempt++) {
          const cand = floorCells[Math.floor(rng() * floorCells.length)];
          if (Math.hypot(cand.cx - home.cx, cand.cy - home.cy) * cell > 12) continue;
          if (!legIsFloor(grid, home.cx, home.cy, cand.cx, cand.cy)) continue;
          const w = cavernCellToWorld(cand.cx, cand.cy, width, height);
          if (roam.some((p) => Math.hypot(p.x - w.x, p.z - w.z) < 3)) continue;
          roam.push(w);
        }
      }

      n += 1;
      fauna.push({
        id: `cavefauna_${instanceId}_d${depth}_${n}`,
        species: row.species,
        x: homeWorld.x,
        z: homeWorld.z,
        y: 0,
        rotation: rng() * Math.PI * 2,
        state: 'wandering',
        isTamed: false,
        targetX: homeWorld.x,
        targetZ: homeWorld.z,
        speed: row.speed,
        health: row.health,
        maxHealth: row.health,
        byproductTimer: 0,
        animTime: 0,
        cavernRoam: roam,
      });
    }
  }
  return fauna;
}
