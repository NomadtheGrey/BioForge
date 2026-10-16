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
import { zonePondsAt, zoneRiversAt, type RiverSeg } from './terrain';

/** A pond in the engine's LOCAL frame (zone origin subtracted). */
export interface PondLocal {
  x: number;
  z: number;
  radius: number;
  waterY: number;
}

/** A river segment in the engine's LOCAL frame. */
export interface RiverSegLocal {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  waterY: number;
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

function waterMaterial(): THREE.MeshStandardMaterial {
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
        ponds.push({ x: lx, z: lz, radius: p.radius, waterY: p.waterY });
        const geo = new THREE.CircleGeometry(p.radius, 28);
        geo.rotateX(-Math.PI / 2);
        const disc = new THREE.Mesh(geo, waterMaterial());
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
  const positions: number[] = [];
  const indices: number[] = [];
  for (const s of segs) {
    const x1 = s.x1 - zoneX * 100;
    const z1 = s.z1 - zoneZ * 100;
    const x2 = s.x2 - zoneX * 100;
    const z2 = s.z2 - zoneZ * 100;
    if (Math.max(x1, x2) < -64 || Math.min(x1, x2) > 64 || Math.max(z1, z2) < -64 || Math.min(z1, z2) > 64) continue;
    riverSegs.push({ x1, z1, x2, z2, waterY: s.waterY });
    const mx = (x1 + x2) / 2;
    const mz = (z1 + z2) / 2;
    if (s.waterY <= heightAt(mx, mz) + 0.05) continue; // dry gully
    const vx = x2 - x1;
    const vz = z2 - z1;
    const vl = Math.hypot(vx, vz) || 1;
    const px = (-vz / vl) * 2.0;
    const pz = (vx / vl) * 2.0;
    const base = positions.length / 3;
    positions.push(
      x1 + px, s.waterY, z1 + pz,
      x1 - px, s.waterY, z1 - pz,
      x2 + px, s.waterY, z2 + pz,
      x2 - px, s.waterY, z2 - pz,
    );
    indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
  }
  if (positions.length > 0) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mat = waterMaterial();
    mat.side = THREE.DoubleSide;
    const ribbon = new THREE.Mesh(geo, mat);
    ribbon.name = 'riverWater';
    group.add(ribbon);
  }
  return { group, ponds, riverSegs };
}

/** The water surface height at a LOCAL point, or null when dry. */
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
