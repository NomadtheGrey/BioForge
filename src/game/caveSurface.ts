// ============================================================================
// caveSurface.ts — cave mouths on the surface (P3, surface half)
// ============================================================================
//
// Graduated from the gen lab (caveSurfaceLab.mjs) after its harness passed
// every check. This module decides the ON-SURFACE half of caves:
//
//   * how many cave mouths a surface zone gets (a roll by biome — except
//     the spawn zone, which always gets exactly one: a findable first
//     cave is the P3 proof, and a guaranteed mouth hard-tests the
//     placement rules against the homestead),
//   * where they sit (clear of structures and scatter, inside the map,
//     out of the player's yard),
//   * which way they face (out of the mouth, toward the zone center —
//     you exit facing the way home),
//   * how they're dressed (rock lips, boulders, path stones, a biome
//     accent — data the renderer turns into meshes), and
//   * the surface half of the portal link: the anchor + the exit spawn
//     exactly 2 m in front of it. The interior generator (a later step)
//     owns the underground half; the anchor is stored bookkeeping and
//     must NEVER feed the interior's seed math.
//
// SURFACE CONVENTIONS (same as the rest of the game):
//   * Zone-local meters: x east, z south, (0,0) is the zone center — in
//     the spawn zone, also the player spawn / homestead center.
//   * Angles are radians in the XZ plane: 0 = +x (east), increasing
//     toward +z. A mouth's `facing` points OUT of the cave, along the
//     approach — the direction a player faces when they EXIT.
//   * The zone's biome is an INPUT (zones.ts zoneBiomeAt owns it) — this
//     module never re-derives zone identity.
// ============================================================================

import { createSeededRandom, hashStringToSeed } from './motion';
import type { BiomeId } from './biomes';
import type { CaveDressingPiece, CaveDressingType } from '../types/game';

export type { CaveDressingPiece, CaveDressingType };

/** Surface-stage generation version, stamped on sections it produces. */
export const CAVE_SURFACE_GEN_VERSION = 1;

/** How far in front of the anchor an exiting player is placed (meters).
 *  Matches the cavern link contract: outside the portal trigger, so
 *  exiting never instantly re-triggers entry. */
export const CAVE_EXIT_OFFSET_METERS = 2;

/**
 * Blockers for the starter homestead, in zone-local meters — these MUST
 * mirror INITIAL_STRUCTURES in hooks/useWorldEntities.ts (the forge,
 * floors, wall, door, and mound around spawn). They live here because
 * world generation may not import a hooks module; if the homestead ever
 * moves, move these too, or the spawn zone's cave mouth could land on
 * the player's porch.
 */
export const HOMESTEAD_BLOCKERS: CaveBlocker[] = [
  { x: 0, z: 0, radius: 1.4 }, { x: 2, z: 0, radius: 1.4 },
  { x: 0, z: 2, radius: 1.4 }, { x: 2, z: 2, radius: 1.4 },
  { x: 0, z: -1, radius: 1.2 }, { x: 2, z: -1, radius: 1.2 },
  { x: 4, z: 4, radius: 1.5 }, { x: -4, z: 0, radius: 1.4 },
];

export interface CaveMouthSpec {
  id: string;
  /** The instanced-zone id this mouth leads to ('cavern:<zx>,<zz>:<i>'). */
  instanceId: string;
  /** Mouth position + exit facing (radians, XZ plane). The stored
   *  return address for this cave — bookkeeping, never seed math. */
  anchor: { x: number; z: number; facing: number };
  placementMethod: 'seeded' | 'scan';
  footprintRadiusMeters: number;
  portalRadiusMeters: number;
  dressing: CaveDressingPiece[];
  /** Where an exiting player appears: anchor + 2 m along facing. */
  surfaceExitSpawn: { x: number; z: number; facing: number };
}

export interface CaveSurfaceValidation {
  mouthCount: number;
  inBounds: boolean;
  centerClearanceOk: boolean;
  spacingOk: boolean;
  blockersClear: boolean;
  approachClear: boolean;
  exitOffsetOk: boolean;
  guaranteedMouthOk: boolean;
  pass: boolean;
}

export interface CaveSurfaceSection {
  seedStr: string;
  zone: { zx: number; zz: number; biome: BiomeId; hops: number; isSpawnZone: boolean };
  mouths: CaveMouthSpec[];
  meta: { genVersion: number; targetMouths: number; validation: CaveSurfaceValidation };
}

/** A solid thing a mouth must keep its footprint clear of. */
export interface CaveBlocker {
  x: number;
  z: number;
  radius: number;
}

export interface CaveSurfaceOptions {
  zoneZx?: number;
  zoneZz?: number;
  /** The zone's biome (from zones.ts in the game). Default 'meadow'. */
  zoneBiome?: BiomeId;
  /** Zone-graph distance from spawn. Default: Manhattan distance. */
  zoneHops?: number;
  blockers?: CaveBlocker[];
}

const DEFAULTS = {
  zoneSizeMeters: 100,
  footprintRadiusMeters: 5.2,
  // Presence by biome: fungal/ember zones are more cave-prone (their
  // geology is stranger); far zones get a small second-mouth bonus.
  presenceByBiome: { meadow: 0.55, wetland: 0.65, fungal: 0.8, ember: 0.75 } as Record<BiomeId, number>,
  secondByBiome: { meadow: 0.1, wetland: 0.15, fungal: 0.3, ember: 0.3 } as Record<BiomeId, number>,
  secondFarBonus: 0.1,
  secondFarHops: 4,
  // Placement annulus around the zone center. In the spawn zone the
  // inner radius doubles as the homestead clearance.
  minRadiusSpawnZone: 20,
  maxRadiusSpawnZone: 42,
  minRadiusOtherZone: 12,
  maxRadiusOtherZone: 43,
  mouthSpacingMeters: 24,
  placementAttempts: 500,
  facingJitterRad: 0.3,
  portalRadiusMeters: 1.4,
  approachLengthMeters: 8,
  approachHalfWidthMeters: 1.6,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function stageSeed(seedStr: string, zx: number, zz: number, stage: string): number {
  return hashStringToSeed(`${seedStr}:cave-surface:${zx},${zz}:${stage}`);
}

function dir(angle: number): { x: number; z: number } {
  return { x: Math.cos(angle), z: Math.sin(angle) };
}

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// ---------------------------------------------------------------------------
// Presence — how many mouths this zone rolls
// ---------------------------------------------------------------------------

function rollMouthCount(rng: () => number, biome: BiomeId, hops: number, isSpawnZone: boolean): number {
  if (isSpawnZone) return 1; // guaranteed first cave (see header)
  const presence = DEFAULTS.presenceByBiome[biome] ?? 0.6;
  if (rng() >= presence) return 0;
  let second = DEFAULTS.secondByBiome[biome] ?? 0.15;
  if (hops >= DEFAULTS.secondFarHops) second += DEFAULTS.secondFarBonus;
  return rng() < second ? 2 : 1;
}

// ---------------------------------------------------------------------------
// Placement — one mouth that respects the surface it lands on
// ---------------------------------------------------------------------------

function candidateOk(
  x: number,
  z: number,
  placed: CaveMouthSpec[],
  blockers: CaveBlocker[],
  minRadius: number,
  maxRadius: number,
): boolean {
  const half = DEFAULTS.zoneSizeMeters / 2;
  if (Math.abs(x) + DEFAULTS.footprintRadiusMeters > half - 0.001) return false;
  if (Math.abs(z) + DEFAULTS.footprintRadiusMeters > half - 0.001) return false;
  const r = Math.hypot(x, z);
  if (r < minRadius || r > maxRadius) return false;
  for (const m of placed) {
    if (Math.hypot(m.anchor.x - x, m.anchor.z - z) < DEFAULTS.mouthSpacingMeters) return false;
  }
  for (const b of blockers) {
    if (Math.hypot(b.x - x, b.z - z) < DEFAULTS.footprintRadiusMeters + (b.radius ?? 0)) return false;
  }
  return true;
}

/**
 * Place one mouth: seeded random tries in the annulus first, then a
 * deterministic ring-and-spoke scan as fallback (seed-offset, so the
 * fallback isn't the same point in every world). The scan is what makes
 * the spawn-zone guarantee a guarantee rather than a hope.
 */
function placeMouth(
  rng: () => number,
  placed: CaveMouthSpec[],
  blockers: CaveBlocker[],
  minRadius: number,
  maxRadius: number,
  scanSeed: number,
): { x: number; z: number; method: 'seeded' | 'scan' } | null {
  for (let i = 0; i < DEFAULTS.placementAttempts; i++) {
    const angle = rng() * Math.PI * 2;
    // sqrt distribution: even coverage of the annulus AREA, not its radii.
    const r = Math.sqrt(minRadius * minRadius + rng() * (maxRadius * maxRadius - minRadius * minRadius));
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    if (candidateOk(x, z, placed, blockers, minRadius, maxRadius)) return { x, z, method: 'seeded' };
  }
  const angleOffset = (scanSeed % 360) * (Math.PI / 180);
  for (let r = minRadius; r <= maxRadius; r += 2) {
    for (let step = 0; step < 24; step++) {
      const angle = angleOffset + (step / 24) * Math.PI * 2;
      const x = Math.cos(angle) * r;
      const z = Math.sin(angle) * r;
      if (candidateOk(x, z, placed, blockers, minRadius, maxRadius)) return { x, z, method: 'scan' };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Dressing — the local set that makes a mouth read as a cave
// ---------------------------------------------------------------------------
// Dressing is data, not rendering: typed pieces in zone-local meters.
// Layout law: rock mass sits BEHIND and BESIDE the mouth, never in the
// approach; flat path stones lead out in front; a biome accent ties the
// mouth to its zone. Local frame: `behind` runs along the inward
// direction (into the rock), `side` perpendicular.

// NOTE: no 'glow_spore_cluster' pieces here anymore — those became a
// REAL harvestable plant (worldGen rings every mouth with living
// clusters; Adam, 2026-10-14). Dressing accents are pure scenery.
const BIOME_ACCENTS: Record<BiomeId, { type: CaveDressingType; count: number }[]> = {
  meadow: [],
  wetland: [{ type: 'reed_cluster', count: 3 }],
  fungal: [{ type: 'glow_fungus_cluster', count: 4 }],
  ember: [
    { type: 'heat_cracked_stone', count: 3 },
    { type: 'ember_vent', count: 1 },
  ],
};

function dressMouth(rng: () => number, anchor: { x: number; z: number; facing: number }, biome: BiomeId): CaveDressingPiece[] {
  const out = dir(anchor.facing);
  const inward = { x: -out.x, z: -out.z };
  const side = { x: -out.z, z: out.x };
  const at = (behind: number, s: number) => ({
    x: anchor.x + inward.x * behind + side.x * s,
    z: anchor.z + inward.z * behind + side.z * s,
  });

  const pieces: CaveDressingPiece[] = [];
  const add = (type: CaveDressingType, behind: number, s: number, scale: number, blocking: boolean) => {
    const p = at(behind, s);
    pieces.push({ id: `d${pieces.length}`, type, x: p.x, z: p.z, rotation: rng() * Math.PI * 2, scale, blocking });
  };

  add('cave_mouth', 0, 0, 1, false);
  add('dark_soil_patch', 0.6, 0, 1.3, false);
  add('rock_lip', 0.8, -1.7, 1, true);
  add('rock_lip', 0.8, 1.7, 1, true);

  const boulders = 5 + Math.floor(rng() * 4);
  for (let i = 0; i < boulders; i++) {
    const behind = 0.6 + rng() * 3.8;
    const s = (1.9 + rng() * 3.1) * (rng() < 0.5 ? -1 : 1);
    add('boulder', behind, s, 0.6 + rng() * 1.2, true);
  }

  const rubble = 6 + Math.floor(rng() * 5);
  for (let i = 0; i < rubble; i++) {
    // Rubble frames the PORTAL BOULDER (Adam, 2026-10-14): it belongs
    // BEHIND the big rock and out to its sides — never in front of the
    // entrance face, and never buried inside the boulder itself. Close
    // in, it is pushed out past the rock's flanks; deeper back, it can
    // skirt across behind it. The scatter stays seeded-random — the
    // framing just keeps the doorway clear.
    const behind = 1.0 + rng() * 3.6;
    let s = (0.8 + rng() * 3.4) * (rng() < 0.5 ? -1 : 1);
    if (behind < 2.8) s = Math.sign(s) * Math.max(Math.abs(s), 2.2);
    add('rubble', behind, s, 0.3 + rng() * 0.5, false);
  }

  for (let i = 0; i < 3; i++) {
    const ahead = -(2.5 + i * 2); // negative behind = in front of the mouth
    add('path_stone', ahead, (rng() - 0.5) * 1.0, 0.7 + rng() * 0.4, false);
  }

  for (const accent of BIOME_ACCENTS[biome] ?? BIOME_ACCENTS.meadow) {
    for (let i = 0; i < accent.count; i++) {
      const behind = 0.4 + rng() * 2.6;
      const s = (1.9 + rng() * 2.4) * (rng() < 0.5 ? -1 : 1);
      add(accent.type, behind, s, 0.7 + rng() * 0.6, false);
    }
  }

  return pieces;
}

// ---------------------------------------------------------------------------
// Validation — the generator grades its own homework
// ---------------------------------------------------------------------------

function validateSurface(section: Omit<CaveSurfaceSection, 'meta'>, blockers: CaveBlocker[]): CaveSurfaceValidation {
  const v: CaveSurfaceValidation = {
    mouthCount: section.mouths.length,
    inBounds: true,
    centerClearanceOk: true,
    spacingOk: true,
    blockersClear: true,
    approachClear: true,
    exitOffsetOk: true,
    guaranteedMouthOk: true,
    pass: false,
  };
  const half = DEFAULTS.zoneSizeMeters / 2;
  const isSpawn = section.zone.isSpawnZone;
  const minRadius = isSpawn ? DEFAULTS.minRadiusSpawnZone : DEFAULTS.minRadiusOtherZone;

  for (const m of section.mouths) {
    if (Math.abs(m.anchor.x) + DEFAULTS.footprintRadiusMeters > half) v.inBounds = false;
    if (Math.abs(m.anchor.z) + DEFAULTS.footprintRadiusMeters > half) v.inBounds = false;
    if (Math.hypot(m.anchor.x, m.anchor.z) < minRadius - 1e-9) v.centerClearanceOk = false;

    for (const b of blockers) {
      if (Math.hypot(b.x - m.anchor.x, b.z - m.anchor.z) < DEFAULTS.footprintRadiusMeters + (b.radius ?? 0) - 1e-9) {
        v.blockersClear = false;
      }
    }

    // Approach corridor, re-derived from world positions: blocking
    // dressing in front of the mouth within the half-width is a layout
    // bug — the player would walk into set dressing on their way in.
    const out = dir(m.anchor.facing);
    const inward = { x: -out.x, z: -out.z };
    const side = { x: -out.z, z: out.x };
    for (const d of m.dressing) {
      if (!d.blocking) continue;
      const rx = d.x - m.anchor.x;
      const rz = d.z - m.anchor.z;
      const behind = rx * inward.x + rz * inward.z;
      const s = Math.abs(rx * side.x + rz * side.z);
      const inFront = -behind;
      if (inFront > -0.5 && inFront < DEFAULTS.approachLengthMeters && s < DEFAULTS.approachHalfWidthMeters) {
        v.approachClear = false;
      }
    }

    const exitDist = Math.hypot(m.surfaceExitSpawn.x - m.anchor.x, m.surfaceExitSpawn.z - m.anchor.z);
    if (Math.abs(exitDist - CAVE_EXIT_OFFSET_METERS) > 1e-9) v.exitOffsetOk = false;
  }

  for (let i = 0; i < section.mouths.length; i++) {
    for (let j = i + 1; j < section.mouths.length; j++) {
      const a = section.mouths[i].anchor;
      const b = section.mouths[j].anchor;
      if (Math.hypot(a.x - b.x, a.z - b.z) < DEFAULTS.mouthSpacingMeters - 1e-9) v.spacingOk = false;
    }
  }

  if (isSpawn && section.mouths.length < 1) v.guaranteedMouthOk = false;

  v.pass =
    v.inBounds && v.centerClearanceOk && v.spacingOk && v.blockersClear &&
    v.approachClear && v.exitOffsetOk && v.guaranteedMouthOk;
  return v;
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Generate the cave-mouth section for one surface zone. Deterministic in
 * (seedStr, zone coords, biome, blockers). The spawn zone (0,0) always
 * yields exactly one mouth; other zones roll presence by biome.
 */
export function generateCaveSurface(seedStr: string, options: CaveSurfaceOptions = {}): CaveSurfaceSection {
  const zx = options.zoneZx ?? 0;
  const zz = options.zoneZz ?? 0;
  const biome = options.zoneBiome ?? 'meadow';
  const hops = options.zoneHops ?? (Math.abs(zx) + Math.abs(zz));
  const isSpawnZone = zx === 0 && zz === 0;
  const blockers = options.blockers ?? [];

  const minRadius = isSpawnZone ? DEFAULTS.minRadiusSpawnZone : DEFAULTS.minRadiusOtherZone;
  const maxRadius = isSpawnZone ? DEFAULTS.maxRadiusSpawnZone : DEFAULTS.maxRadiusOtherZone;

  // Presence draws BEFORE placement, so tuning dressing never changes
  // how many mouths a zone rolled.
  const presenceRng = createSeededRandom(stageSeed(seedStr, zx, zz, 'presence'));
  const target = rollMouthCount(presenceRng, biome, hops, isSpawnZone);

  const mouths: CaveMouthSpec[] = [];
  for (let i = 0; i < target; i++) {
    const placeRng = createSeededRandom(stageSeed(seedStr, zx, zz, `place:${i}`));
    const spot = placeMouth(placeRng, mouths, blockers, minRadius, maxRadius, stageSeed(seedStr, zx, zz, 'scan'));
    if (!spot) continue; // no legal ground — validation reports the shortfall

    // Facing: out of the mouth, toward the zone center (in the spawn
    // zone: toward home), plus a little seeded personality.
    const faceRng = createSeededRandom(stageSeed(seedStr, zx, zz, `facing:${i}`));
    const toCenter = Math.atan2(-spot.z, -spot.x);
    const facing = wrapAngle(toCenter + (faceRng() * 2 - 1) * DEFAULTS.facingJitterRad);

    const anchor = { x: spot.x, z: spot.z, facing };
    const dressRng = createSeededRandom(stageSeed(seedStr, zx, zz, `dress:${i}`));
    const dressing = dressMouth(dressRng, anchor, biome);

    mouths.push({
      id: `cave_${zx}_${zz}_${i}`,
      instanceId: `cavern:${zx},${zz}:${i}`,
      anchor,
      placementMethod: spot.method,
      footprintRadiusMeters: DEFAULTS.footprintRadiusMeters,
      portalRadiusMeters: DEFAULTS.portalRadiusMeters,
      dressing,
      surfaceExitSpawn: {
        x: anchor.x + Math.cos(facing) * CAVE_EXIT_OFFSET_METERS,
        z: anchor.z + Math.sin(facing) * CAVE_EXIT_OFFSET_METERS,
        facing,
      },
    });
  }

  const section: Omit<CaveSurfaceSection, 'meta'> = {
    seedStr,
    zone: { zx, zz, biome, hops, isSpawnZone },
    mouths,
  };
  const validation = validateSurface(section, blockers);
  return { ...section, meta: { genVersion: CAVE_SURFACE_GEN_VERSION, targetMouths: target, validation } };
}
