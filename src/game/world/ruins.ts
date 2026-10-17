// ============================================================================
// ruins.ts — precursor ruins on the surface (P4, surface stage)
// ============================================================================
//
// Graduated from the gen lab (ruinsLab.mjs) after its harness passed.
// This module owns the ON-SURFACE half of ruins:
//
//   * the world's FATE — derived deterministically from the world seed
//     at creation (Adam, 2026-10-14: the seed picks it; the UI never
//     shows it — a world's story is discovered by reading its ruins).
//     Every ruin in a world shares the world's fate: one world, one
//     precursor story.
//   * the fate → VARIANT table (Adam, 2026-10-14: the fate picks the
//     generator): grown/merged fates lay out as room graphs, built
//     fates subdivide as BSP, fallen/colony fates scatter placed
//     rooms. The interior stage consumes this; the surface stores it.
//   * how many ruin sites a surface zone gets (a probabilistic roll —
//     roughly one per zone, a second only when lucky, some zones
//     none; the spawn zone gets at most TRACES, a textless remnant),
//   * how big they are (size tier ramps with ZONE HOPS from spawn and
//     saturates around 8 hops — meters govern inside a zone, hops
//     govern between zones),
//   * where they sit (clear of the homestead, cave mouths, and the
//     zone's scatter) and how they're dressed (broken pillars, wall
//     stubs, shards — data the renderer turns into meshes).
//
// The landmark's link record (fate / variant / tier / dressing) is
// stored save data, NEVER a generation input for the interior: the
// ruin below derives from (world seed + instanceId + fate) alone.
//
// SURFACE CONVENTIONS match caveSurface.ts: zone-local meters, (0,0)
// is the zone center, angles in the XZ plane, a site's `facing`
// points from the anchor toward the zone center (the approach).
// ============================================================================

import { createSeededRandom, hashStringToSeed } from '../engine/motion';
import type { BiomeId } from './biomes';
import type { RuinDressingPiece, RuinDressingType } from '../../types/game';

export type { RuinDressingPiece, RuinDressingType };

/** Surface-stage ruin generation version. */
export const RUIN_GEN_VERSION = 1;

// ---------------------------------------------------------------------------
// Fates — the eleven precursor endings (LORE_AND_ARTIFACTS_BRAINSTORM)
// ---------------------------------------------------------------------------

export type WorldFate =
  | 'gardeners'
  | 'crash'
  | 'long_experiment'
  | 'evacuation'
  | 'becoming'
  | 'war'
  | 'sickness'
  | 'taken_out'
  | 'uplift'
  | 'departure'
  | 'return_to_water';

export const WORLD_FATES: WorldFate[] = [
  'gardeners',
  'crash',
  'long_experiment',
  'evacuation',
  'becoming',
  'war',
  'sickness',
  'taken_out',
  'uplift',
  'departure',
  'return_to_water',
];

/** The three interior layout generators (the lab's variants). */
export type RuinVariantId = 'roomGraph' | 'bsp' | 'placedRooms';

export interface FateStyle {
  /** Display name — for docs/logs, NOT surfaced in-game (discovery). */
  name: string;
  /** The interior generator this fate chooses. */
  variant: RuinVariantId;
  /** Landmark stone tint (hex): how this world's ruins READ. */
  tint: number;
  /** One-word damage flavor, for docs and the interior stage. */
  flavor: string;
}

/**
 * The fate table. Variant logic: fates whose precursors GREW or
 * MERGED with the world lay out organically (roomGraph); fates that
 * BUILT — ships, facilities, orders — subdivide in modules (bsp);
 * fates that FELL in scattered groups left placed rooms.
 */
export const FATE_STYLES: Record<WorldFate, FateStyle> = {
  gardeners:      { name: 'The Gardeners',       variant: 'roomGraph',   tint: 0x65a30d, flavor: 'grown' },
  crash:          { name: 'The Crash',           variant: 'bsp',         tint: 0xb45309, flavor: 'wrecked' },
  long_experiment:{ name: 'The Long Experiment', variant: 'roomGraph',   tint: 0x0ea5e9, flavor: 'sterile' },
  evacuation:     { name: 'The Evacuation',      variant: 'bsp',         tint: 0x94a3b8, flavor: 'hasty' },
  becoming:       { name: 'The Becoming',        variant: 'roomGraph',   tint: 0xa855f7, flavor: 'merged' },
  war:            { name: 'The War',             variant: 'bsp',         tint: 0xdc2626, flavor: 'shattered' },
  sickness:       { name: 'The Sickness',        variant: 'placedRooms', tint: 0x9da32e, flavor: 'quarantined' },
  taken_out:      { name: 'Taken Out',           variant: 'placedRooms', tint: 0x64748b, flavor: 'silenced' },
  uplift:         { name: 'The Uplift',          variant: 'roomGraph',   tint: 0xf59e0b, flavor: 'reaching' },
  departure:      { name: 'The Departure',       variant: 'bsp',         tint: 0x38bdf8, flavor: 'orderly' },
  return_to_water:{ name: 'Return to Water',     variant: 'placedRooms', tint: 0x0d9488, flavor: 'drowned' },
};

/**
 * A world's fate, derived from its seed alone — no storage needed:
 * the save carries the worldSeed, so the fate is recomputable by any
 * client (co-op guests included) and old saves gain theirs free.
 */
export function fateForWorld(seedStr: string): WorldFate {
  const rng = createSeededRandom(hashStringToSeed(`${seedStr}:fate`));
  return WORLD_FATES[Math.floor(rng() * WORLD_FATES.length)];
}

// ---------------------------------------------------------------------------
// Size tiers — distance measured in ZONE HOPS (Adam, 2026-10-14)
// ---------------------------------------------------------------------------

export type RuinTierId = 'traces' | 'small' | 'medium' | 'grand';

export const RUIN_TIER_FOOTPRINT: Record<RuinTierId, number> = {
  traces: 3,
  small: 5.5,
  medium: 8,
  grand: 10.5,
};

const TIER_LADDER: RuinTierId[] = ['traces', 'small', 'medium', 'grand'];

/** Size ramps with hops and saturates around ~8 hops out. */
export function tierForHops(hops: number): RuinTierId {
  if (hops <= 0) return 'traces';
  if (hops <= 2) return 'small';
  if (hops <= 5) return 'medium';
  return 'grand';
}

function tierDown(tier: RuinTierId): RuinTierId {
  return TIER_LADDER[Math.max(0, TIER_LADDER.indexOf(tier) - 1)];
}

// ---------------------------------------------------------------------------
// Presence knobs — sparse and probabilistic (Adam: ~one per zone, two
// only if really lucky, some zones none). Named so he tunes from play.
// ---------------------------------------------------------------------------

/** Spawn zone: only ever traces, and not guaranteed even then. */
export const RUIN_TRACES_CHANCE_SPAWN = 0.55;
/** Any other zone's chance of one ruin at its hop tier. */
export const RUIN_PRESENCE_CHANCE = 0.62;
// The GRADIENT STEP (2026-10-15, Adam's directive: distance drives
// ruin presence as it already drives ruin size): presence and the
// second-site chance RISE with hops — wild country is older, more
// built-on, more lost. Near home the constants above hold.
export function ruinPresenceForHops(hops: number): number {
  return Math.min(0.88, RUIN_PRESENCE_CHANCE + hops * 0.03);
}
export function ruinSecondForHops(hops: number): number {
  return Math.min(0.3, RUIN_SECOND_CHANCE + hops * 0.02);
}
/** Given one ruin, the chance of a second, one tier smaller. */
export const RUIN_SECOND_CHANCE = 0.12;

// ---------------------------------------------------------------------------
// Site spec
// ---------------------------------------------------------------------------

export interface RuinBlocker {
  x: number;
  z: number;
  radius: number;
}

export interface RuinSiteSpec {
  id: string;
  /** Instanced-zone id for the future interior ('ruin:<zx>,<zz>:<i>'). */
  instanceId: string;
  anchor: { x: number; z: number; facing: number };
  tier: RuinTierId;
  footprintRadiusMeters: number;
  placementMethod: 'seeded' | 'scan';
  dressing: RuinDressingPiece[];
  /** Where an exiting player will appear: anchor + 2 m along facing. */
  surfaceExitSpawn: { x: number; z: number; facing: number };
}

export interface GenerateZoneRuinsOptions {
  zoneZx: number;
  zoneZz: number;
  zoneBiome: BiomeId;
  fate: WorldFate;
  blockers: RuinBlocker[];
}

function ruinSeed(seedStr: string, zx: number, zz: number, stage: string): number {
  return hashStringToSeed(`${seedStr}:ruin-surface:${zx},${zz}:${stage}`);
}

// ---------------------------------------------------------------------------
// Dressing — broken stone, seeded per site. The entrance approach
// (a corridor along the facing, ±0.5 rad, within 3.5 m) stays clear of
// BLOCKING pieces: you can always walk up to the gate.
// ---------------------------------------------------------------------------

const TIER_PIECE_COUNTS: Record<RuinTierId, { min: number; max: number }> = {
  traces: { min: 3, max: 5 },
  small: { min: 6, max: 9 },
  medium: { min: 9, max: 13 },
  grand: { min: 13, max: 18 },
};

function dressSite(
  rng: () => number,
  siteId: string,
  anchor: { x: number; z: number; facing: number },
  tier: RuinTierId,
  footprint: number
): RuinDressingPiece[] {
  const pieces: RuinDressingPiece[] = [];
  const counts = TIER_PIECE_COUNTS[tier];
  const total = counts.min + Math.floor(rng() * (counts.max - counts.min + 1));
  let pillarsLeft = tier === 'grand' ? 2 : tier === 'medium' ? 1 : 0;
  let stubsLeft = tier === 'traces' ? 0 : tier === 'small' ? 1 : 2;

  const add = (type: RuinDressingType, dx: number, dz: number, scale: number, blocking: boolean): void => {
    pieces.push({
      id: `${siteId}_d${pieces.length}`,
      type,
      x: anchor.x + dx,
      z: anchor.z + dz,
      rotation: rng() * Math.PI * 2,
      scale,
      blocking,
    });
  };

  for (let i = 0; i < total; i++) {
    // Scatter within the footprint, biased outward (the gate area
    // around the anchor stays readable as an entrance).
    const angle = rng() * Math.PI * 2;
    const r = footprint * (0.3 + rng() * 0.7);
    const dx = Math.cos(angle) * r;
    const dz = Math.sin(angle) * r;
    // Approach corridor check: angle relative to the facing.
    const rel = Math.abs(((angle - anchor.facing) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI);
    const inApproach = rel < 0.5 && r < 3.5;

    let type: RuinDressingType;
    const roll = rng();
    if (pillarsLeft > 0 && roll < 0.16 && !inApproach) {
      type = 'pillar';
      pillarsLeft--;
    } else if (stubsLeft > 0 && roll < 0.34 && !inApproach) {
      type = 'wall_stub';
      stubsLeft--;
    } else if (roll < 0.46) {
      type = 'toppled_pillar';
    } else if (roll < 0.62) {
      type = 'arch_fragment';
    } else if (roll < 0.82) {
      type = 'shard';
    } else {
      type = 'rubble';
    }
    // Traces are only ever shards and rubble — a textless remnant.
    if (tier === 'traces' && type !== 'shard' && type !== 'rubble') {
      type = rng() < 0.5 ? 'shard' : 'rubble';
    }
    const blocking = (type === 'pillar' || type === 'wall_stub') && !inApproach;
    const scale = type === 'pillar' ? 0.85 + rng() * 0.5 : 0.6 + rng() * 0.7;
    add(type, dx, dz, scale, blocking);
  }
  return pieces;
}

// ---------------------------------------------------------------------------
// The zone roll + placement
// ---------------------------------------------------------------------------

/**
 * Decide a zone's ruin sites. Deterministic per (seed, zone, fate):
 * the same world always grows the same ruins, on every client.
 */
export function generateZoneRuins(
  seedStr: string,
  options: GenerateZoneRuinsOptions
): { sites: RuinSiteSpec[] } {
  const { zoneZx, zoneZz, fate, blockers } = options;
  const hops = Math.abs(zoneZx) + Math.abs(zoneZz);
  const rng = createSeededRandom(ruinSeed(seedStr, zoneZx, zoneZz, 'presence'));

  // --- presence roll -------------------------------------------------
  const tiers: RuinTierId[] = [];
  if (hops === 0) {
    if (rng() < RUIN_TRACES_CHANCE_SPAWN) tiers.push('traces');
  } else {
    if (rng() < ruinPresenceForHops(hops)) {
      tiers.push(tierForHops(hops));
      if (rng() < ruinSecondForHops(hops)) tiers.push(tierDown(tierForHops(hops)));
    }
  }
  if (tiers.length === 0) return { sites: [] };

  // --- placement -----------------------------------------------------
  const placeRng = createSeededRandom(ruinSeed(seedStr, zoneZx, zoneZz, 'placement'));
  const dressRng = createSeededRandom(ruinSeed(seedStr, zoneZx, zoneZz, 'dressing'));
  const sites: RuinSiteSpec[] = [];

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    const footprint = RUIN_TIER_FOOTPRINT[tier];
    const margin = 46 - footprint;
    let placed: { x: number; z: number } | null = null;

    for (let attempt = 0; attempt < 60 && !placed; attempt++) {
      const x = (placeRng() * 2 - 1) * margin;
      const z = (placeRng() * 2 - 1) * margin;
      // The site's core must clear every blocker by its working
      // radius (pieces scatter inside the footprint; the gate and
      // dais live in the core).
      const coreRadius = footprint * 0.72;
      if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.radius + coreRadius)) continue;
      if (sites.some((s) => Math.hypot(s.anchor.x - x, s.anchor.z - z) < s.footprintRadiusMeters + footprint + 4)) continue;
      placed = { x, z };
    }
    if (!placed) continue; // a ruin that can't sit cleanly doesn't happen — sparse is honest

    // Face the zone center: the approach reads from the homeland side,
    // and an exiting player (interior stage) lands facing home.
    const facing = Math.atan2(-placed.z, -placed.x);
    const anchor = { x: placed.x, z: placed.z, facing };
    const siteId = `ruin_${zoneZx}_${zoneZz}_${i}`;
    sites.push({
      id: siteId,
      instanceId: `ruin:${zoneZx},${zoneZz}:${i}`,
      anchor,
      tier,
      footprintRadiusMeters: footprint,
      placementMethod: 'seeded',
      dressing: dressSite(dressRng, siteId, anchor, tier, footprint),
      surfaceExitSpawn: {
        x: placed.x + Math.cos(facing) * 2,
        z: placed.z + Math.sin(facing) * 2,
        facing,
      },
    });
  }

  return { sites };
}
