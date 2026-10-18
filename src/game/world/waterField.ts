// ============================================================================
// WATER FIELD — pond discs + river ribbons for the current terrain context
// ----------------------------------------------------------------------------
// Extracted from threeEngine.ts (2026-10-16, rivers landing) when the
// engine file outgrew the push transport's single-argument limit.
// Everything here is a pure function of the terrain resolvers'
// output: give it the seed + zone + the engine's local height
// function and it returns the water meshes (riding the terrain
// group) plus the LOCAL-frame lists the depth/surface queries read.
// The engine owns the context (seed/zone/legacy) and the public
// waterDepthAt / waterSurfaceAt surface; this module owns the
// shapes. P5 moves 2-3 (Adam, 2026-10-16).
// ============================================================================
import * as THREE from 'three';
import { zonePondsAt, zoneRiversAt, type PondLiquid, type RiverSeg } from './terrain';

/** A pond in the engine's LOCAL frame (zone origin subtracted). */
export interface PondLocal {
  x: number;
  z: number;
  radius: number;
  waterY: number;
  liquid: PondLiquid;
}

/** A river segment in the engine's LOCAL frame. */
export interface RiverSegLocal {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  waterY: number;
  liquid: PondLiquid;
}

/** Distance from a point to a 2D segment (the water queries). */
export function distToSeg2D(
  px: number,
  pz: number,
  s: { x1: number; z1: number; x2: number; z2: number },
): number {
  const vx = s.x2 - s.x1;
  const vz = s.z2 - s.z1;
  const t = Math.max(0, Math.min(1, ((px - s.x1) * vx + (pz - s.z1) * vz) / (vx * vx + vz * vz || 1)));
  return Math.hypot(px - (s.x1 + vx * t), pz - (s.z1 + vz * t));
}

/** One material per liquid (liquids pass, 2026-10-16): water is
 *  the calm blue the ponds shipped with; brine is a pale milky
 *  green; lava glows — emissive orange over a dark red body, so
 *  it reads as dangerous before it ever deals a point of damage. */
function waterMaterial(liquid: PondLiquid): THREE.MeshStandardMaterial {
  if (liquid === 'lava') {
    return new THREE.MeshStandardMaterial({
      color: 0xd63c08,
      emissive: 0xff5a00,
      emissiveIntensity: 1.35,
      transparent: true,
      opacity: 0.97,
      roughness: 0.5,
      metalness: 0.0,
      depthWrite: false,
    });
  }
  if (liquid === 'brine') {
    return new THREE.MeshStandardMaterial({
      color: 0x9fd4c0,
      transparent: true,
      opacity: 0.7,
      roughness: 0.2,
      metalness: 0.05,
      depthWrite: false,
    });
  }
  return new THREE.MeshStandardMaterial({
    color: 0x2e6da4,
    transparent: true,
    opacity: 0.78,
    roughness: 0.15,
    metalness: 0.05,
    depthWrite: false,
  });
}

/**
 * Build the water meshes for one terrain context: pond discs plus
 * one ribbon quad per WET river segment, in a single group. A
 * river segment is wet when its water level stands above the
 * carved floor at its midpoint; dry segments are gullies — the
 * channel carve shows, no water is drawn. Gathered over the 3x3
 * zone neighborhood: the ground mesh apron reaches 10 m into
 * neighbor zones, and water near a border belongs to the view
 * from both sides.
 */
export function buildWaterGroup(
  seed: string,
  zoneX: number,
  zoneZ: number,
  heightAt: (x: number, z: number) => number,
): { group: THREE.Group; ponds: PondLocal[]; riverSegs: RiverSegLocal[] } {
  const group = new THREE.Group();
  group.name = 'ponds';
  const ponds: PondLocal[] = [];
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const p of zonePondsAt(seed, zoneX + dx, zoneZ + dz)) {
        const lx = p.cx - zoneX * 100;
        const lz = p.cz - zoneZ * 100;
        if (Math.abs(lx) > 62 + p.radius || Math.abs(lz) > 62 + p.radius) continue;
        ponds.push({ x: lx, z: lz, radius: p.radius, waterY: p.waterY, liquid: p.liquid });
        const geo = new THREE.CircleGeometry(p.radius, 28);
        geo.rotateX(-Math.PI / 2);
        const disc = new THREE.Mesh(geo, waterMaterial(p.liquid));
        disc.position.set(lx, p.waterY, lz);
        disc.name = 'pondWater';
        group.add(disc);
      }
    }
  }
  // River segments arrive from the terrain resolver's zone index
  // (the same object can surface under several zones — dedup).
  const segs = new Set<RiverSeg>();
  for (let dz = -1; dz <= 1; dz++) {
    for (let dx = -1; dx <= 1; dx++) {
      for (const s of zoneRiversAt(seed, zoneX + dx, zoneZ + dz)) segs.add(s);
    }
  }
  const riverSegs: RiverSegLocal[] = [];
  // Ribbons merge per liquid: one geometry + material each, so a
  // lava river and a water river can share a zone's view.
  const ribbonBuckets = new Map<PondLiquid, { positions: number[]; indices: number[] }>();
  for (const s of segs) {
    const x1 = s.x1 - zoneX * 100;
    const z1 = s.z1 - zoneZ * 100;
    const x2 = s.x2 - zoneX * 100;
    const z2 = s.z2 - zoneZ * 100;
    if (Math.max(x1, x2) < -64 || Math.min(x1, x2) > 64 || Math.max(z1, z2) < -64 || Math.min(z1, z2) > 64) continue;
    riverSegs.push({ x1, z1, x2, z2, waterY: s.waterY, liquid: s.liquid });
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    if (s.waterY <= heightAt(mx, mz) + 0.05) continue; // dry gully
    let bucket = ribbonBuckets.get(s.liquid);
    if (!bucket) {
      bucket = { positions: [], indices: [] };
      ribbonBuckets.set(s.liquid, bucket);
    }
    const vx = x2 - x1;
    const vz = z2 - z1;
    const vl = Math.hypot(vx, vz) || 1;
    const px = (-vz / vl) * 2.0;
    const pz = (vx / vl) * 2.0;
    const base = bucket.positions.length / 3;
    bucket.positions.push(
      x1 + px, s.waterY, z1 + pz,
      x1 - px, s.waterY, z1 - pz,
      x2 + px, s.waterY, z2 + pz,
      x2 - px, s.waterY, z2 - pz,
    );
    bucket.indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  for (const [liquid, bucket] of ribbonBuckets) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(bucket.positions, 3));
    geo.setIndex(bucket.indices);
    geo.computeVertexNormals();
    const mat = waterMaterial(liquid);
    mat.side = THREE.DoubleSide;
    const ribbon = new THREE.Mesh(geo, mat);
    ribbon.name = 'riverWater';
    group.add(ribbon);
  }
  return { group, ponds, riverSegs };
}

/** The water surface height at a LOCAL point, or null when dry. */
/** The STILL water surface at a point (Stillsteps, movement
 *  build 2026-10-18): ponds only, water only — rivers flow
 *  and never hold a step, and lava/brine ponds are not
 *  "still water" in the item's promise. Null when no pond
 *  of plain water covers the point. */
export function pondWaterSurfaceAt(ponds: PondLocal[], x: number, z: number): number | null {
  let surface: number | null = null;
  for (const p of ponds) {
    if (p.liquid !== 'water') continue;
    if (Math.hypot(x - p.x, z - p.z) >= p.radius) continue;
    surface = surface === null ? p.waterY : Math.max(surface, p.waterY);
  }
  return surface;
}

export function waterSurfaceFromLists(ponds: PondLocal[], riverSegs: RiverSegLocal[], x: number, z: number): number | null {
  let surface: number | null = null;
  for (const p of ponds) {
    if (Math.hypot(x - p.x, z - p.z) >= p.radius) continue;
    surface = surface === null ? p.waterY : Math.max(surface, p.waterY);
  }
  for (const s of riverSegs) {
    if (distToSeg2D(x, z, s) >= 2.0) continue;
    surface = surface === null ? s.waterY : Math.max(surface, s.waterY);
  }
  return surface;
}

/** Which liquid stands at a LOCAL point, and how deep — the
 *  deepest body at the point wins when two overlap (a river
 *  mouth in a pond). Null on dry land. The movement loop reads
 *  this for lava harm (liquids pass, 2026-10-16). */
export function liquidFromLists(
  ponds: PondLocal[],
  riverSegs: RiverSegLocal[],
  x: number,
  z: number,
  heightAt: (x: number, z: number) => number,
): { liquid: PondLiquid; depth: number } | null {
  let best: { liquid: PondLiquid; depth: number } | null = null;
  for (const p of ponds) {
    if (Math.hypot(x - p.x, z - p.z) >= p.radius) continue;
    const depth = p.waterY - heightAt(x, z);
    if (depth > 0 && (best === null || depth > best.depth)) best = { liquid: p.liquid, depth };
  }
  for (const s of riverSegs) {
    if (distToSeg2D(x, z, s) >= 2.0) continue;
    const depth = s.waterY - heightAt(x, z);
    if (depth > 0 && (best === null || depth > best.depth)) best = { liquid: s.liquid, depth };
  }
  return best;
}

/** How deep the water is at a LOCAL point (meters; 0 = dry). */
export function waterDepthFromLists(
  ponds: PondLocal[],
  riverSegs: RiverSegLocal[],
  x: number,
  z: number,
  heightAt: (x: number, z: number) => number,
): number {
  let depth = 0;
  for (const p of ponds) {
    if (Math.hypot(x - p.x, z - p.z) >= p.radius) continue;
    depth = Math.max(depth, p.waterY - heightAt(x, z));
  }
  for (const s of riverSegs) {
    if (distToSeg2D(x, z, s) >= 2.0) continue;
    depth = Math.max(depth, s.waterY - heightAt(x, z));
  }
  return Math.max(0, depth);
}
