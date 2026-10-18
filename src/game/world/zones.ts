// ============================================================================
// zones.ts — the world is a grid of zones; a zone HAS a biome
// ============================================================================
//
// Adam's model (corrected 2026-10-14, superseding the lab's within-zone
// biome patches): a biome is PER-ZONE. One zone — a 100 m × 100 m map —
// has exactly one biome, and that biome is the zone's identity: it
// drives the zone's generation rules (density, species affinity,
// stamps, ground tint) uniformly across the whole zone. Biomes never
// patchwork inside a zone.
//
// Zones tile the world on a coordinate grid. The SPAWN ZONE is (0, 0)
// and is always a meadow — home ground is gentle, whatever the seed.
// Every other zone's biome is derived deterministically from the world
// seed + zone coordinates, in bands by HOP DISTANCE (Manhattan
// distance on the zone grid — the same "distance = zones traveled"
// measure the ruins placement model uses): near zones stay gentle,
// far zones turn strange. Danger and strangeness rise with distance
// from home, zone-shaped.
//
// Each zone also has a NAME — poetic flavor, per the pinned split
// (biomes carry rules, names carry poetry) — drawn from pools that
// MATCH its biome, so a meadow is never called something like "Amber
// Thicket". The name is as deterministic as the biome: same seed +
// same coordinates = same zone, forever, computed on demand without
// the zone ever having been generated or visited. That is what lets
// the HUD label the zone beyond the map's edge before travel exists.
// ============================================================================

import { createSeededRandom, hashStringToSeed } from '../engine/motion';
import { RARITY_ROLL_WEIGHT, variantsForFamily, hybridForPair, hybridTint, type BiomeId, type BiomeVariantDef, type HybridDef } from './biomes';

export interface ZoneCoords {
  zx: number;
  zz: number;
}

export interface ZoneInfo extends ZoneCoords {
  biome: BiomeId;
  /** The zone's variant, when it rolled one (null = plain family). */
  variant: BiomeVariantDef | null;
  /** The zone's hybrid margin, when one grew here (2026-10-15):
   *  the def plus this zone's side of the pair — primary is THIS
   *  zone's own family, secondary the neighbor it margins with.
   *  A hybrid zone carries no variant: the margin IS its face. */
  hybrid: { def: HybridDef; primary: BiomeId; secondary: BiomeId } | null;
  name: string;
  /** Zone-graph distance from the spawn zone (Manhattan / BFS hops). */
  hops: number;
}

/** The spawn zone's coordinates — home. */
export const SPAWN_ZONE: ZoneCoords = { zx: 0, zz: 0 };

/** The canonical string key for a zone — save records key their
 *  per-zone snapshots by it, so the format lives in exactly one
 *  place (zone travel, 2026-10-15). */
export function zoneKey(zx: number, zz: number): string {
  return `${zx},${zz}`;
}

export function zoneHops(zx: number, zz: number): number {
  return Math.abs(zx) + Math.abs(zz);
}

/** World position → the zone containing it. Zones are 100 m tiles
 *  centered on the spawn zone: (−50…+50) on both axes is zone (0,0). */
export function zoneCoordsAt(x: number, z: number): ZoneCoords {
  return { zx: Math.floor((x + 50) / 100), zz: Math.floor((z + 50) / 100) };
}

// ---------------------------------------------------------------------------
// Biome by zone — hop bands, seeded pick within the band
// ---------------------------------------------------------------------------

// Which biomes are "on the table" at each hop distance, and their
// weights. The gradient is the pinned world-progression rule in zone
// form: meadow fades, wetland carries the near rings, fungal moves in,
// and ember — the strange one — only exists 3+ zones out and dominates
// the far field. Exported (2026-10-15) so the biome harness can hold
// the table to the registry in biomes.ts: a biome's FIRST appearance
// here must equal its registered minHops — the per-biome distance
// gates Adam's biome graph is authored with.
export const ZONE_BIOME_BANDS: { maxHops: number; table: [BiomeId, number][] }[] = [
  { maxHops: 0, table: [['meadow', 1]] },
  { maxHops: 1, table: [['meadow', 0.45], ['wetland', 0.55]] },
  { maxHops: 2, table: [['meadow', 0.15], ['wetland', 0.3], ['fungal', 0.3], ['rootwood', 0.25]] },
  { maxHops: 3, table: [['wetland', 0.1], ['fungal', 0.18], ['ember', 0.16], ['saltglass', 0.1], ['frost', 0.1], ['rootwood', 0.05], ['precursor', 0.13], ['bone', 0.1], ['storm', 0.05], ['living', 0.03]] },
  { maxHops: 4, table: [['fungal', 0.2], ['ember', 0.25], ['saltglass', 0.14], ['frost', 0.14], ['rootwood', 0.05], ['precursor', 0.1], ['bone', 0.05], ['storm', 0.04], ['living', 0.03]] },
  { maxHops: Infinity, table: [['fungal', 0.15], ['ember', 0.28], ['saltglass', 0.18], ['frost', 0.15], ['precursor', 0.1], ['bone', 0.05], ['storm', 0.05], ['living', 0.04]] },
];

/** A zone's biome: pure function of world seed + zone coordinates. */
export function zoneBiomeAt(seedStr: string, zx: number, zz: number): BiomeId {
  const hops = zoneHops(zx, zz);
  if (hops === 0) return 'meadow'; // the spawn zone is always home ground
  const band = ZONE_BIOME_BANDS.find((b) => hops <= b.maxHops) ?? ZONE_BIOME_BANDS[ZONE_BIOME_BANDS.length - 1];
  // Own stream per zone: asking about one zone never perturbs another.
  const rng = createSeededRandom(hashStringToSeed(`${seedStr}:zone-biome:${zx},${zz}`));
  const total = band.table.reduce((sum, [, w]) => sum + w, 0);
  let roll = rng() * total;
  for (const [biome, w] of band.table) {
    roll -= w;
    if (roll <= 0) return biome;
  }
  return band.table[band.table.length - 1][0];
}

// ---------------------------------------------------------------------------
// Zone names — poetic, biome-matched, deterministic
// ---------------------------------------------------------------------------

// Two-part names (modifier + landform) from per-biome pools, so the
// name always fits the ecology: meadows are sunlit and gentle, ember
// zones are scarred and strange. The game's four legacy quadrant names
// live on inside the pools where they actually fit — "Turquoise Glade"
// is a wetland name, "Violet Cradle" a fungal one (mycelial, violet),
// "Prismatic Verge" an ember one.
export const ZONE_NAME_PARTS: Record<BiomeId, { first: string[]; second: string[] }> = {
  meadow: {
    first: ['Sunlit', 'Verdant', 'Gentle', 'Golden', 'Whispering', 'Quiet'],
    second: ['Vale', 'Meadow', 'Cradle', 'Reach', 'Downs', 'Expanse'],
  },
  wetland: {
    first: ['Turquoise', 'Misty', 'Mirror', 'Still', 'Sedge'],
    second: ['Glade', 'Marsh', 'Fen', 'Shallows', 'Reach'],
  },
  fungal: {
    first: ['Violet', 'Spore', 'Umbral', 'Pale', 'Amber'],
    second: ['Cradle', 'Hollow', 'Thicket', 'Grove', 'Vault'],
  },
  ember: {
    first: ['Prismatic', 'Ember', 'Ashen', 'Scarlet', 'Glass'],
    second: ['Verge', 'Scar', 'Flats', 'Crown', 'Wastes'],
  },
  saltglass: {
    first: ['Salt', 'White', 'Crystal', 'Pale', 'Singing'],
    second: ['Reach', 'Expanse', 'Flats', 'Silence', 'Fields'],
  },
  frost: {
    first: ['White', 'Silent', 'Frozen', 'Pale', 'Still'],
    second: ['Reach', 'Waste', 'Silence', 'Fields', 'Deep'],
  },
  rootwood: {
    first: ['Rooted', 'Green', 'Ancient', 'Towering', 'Quiet'],
    second: ['Reach', 'Wood', 'Arches', 'Hollows', 'Crown'],
  },
  precursor: {
    first: ['Golden', 'Patient', 'Ancient', 'Ordered', 'Quiet'],
    second: ['Garden', 'Reach', 'Rows', 'Terrace', 'Fields'],
  },
  bone: {
    first: ['Quiet', 'Ancient', 'Bleached', 'Patient', 'Vast'],
    second: ['Rest', 'Fields', 'Graveyard', 'Reach', 'Flats'],
  },
  storm: {
    first: ['Charged', 'Humming', 'Restless', 'Bright', 'Wild'],
    second: ['Reach', 'Flats', 'Fields', 'Sands', 'Country'],
  },
  living: {
    first: ['Breathing', 'Patient', 'Vast', 'Gentle', 'Deep'],
    second: ['Valley', 'Vale', 'Reach', 'Hollow', 'Body'],
  },
};

/**
 * A zone's VARIANT: a sub-roll inside its family. Most zones are
 * plain; an eligible zone (past the variant's minHops gate) rolls
 * its family's variants by rarity weight against staying plain
 * (weight 1). Pure function of seed + coordinates, own stream —
 * asking about a variant never perturbs the family roll.
 */
export function zoneVariantAt(seedStr: string, zx: number, zz: number): BiomeVariantDef | null {
  const hops = zoneHops(zx, zz);
  if (hops === 0) return null; // home ground is plain meadow, always
  const family = zoneBiomeAt(seedStr, zx, zz);
  const options = variantsForFamily(family).filter((v) => hops >= v.minHops);
  if (options.length === 0) return null;
  const rng = createSeededRandom(hashStringToSeed(`${seedStr}:zone-variant:${zx},${zz}`));
  const total = 1 + options.reduce((sum, v) => sum + RARITY_ROLL_WEIGHT[v.rarity], 0);
  let roll = rng() * total;
  if (roll < 1) return null; // the plain family zone wins the roll
  roll -= 1;
  for (const v of options) {
    roll -= RARITY_ROLL_WEIGHT[v.rarity];
    if (roll <= 0) return v;
  }
  return options[options.length - 1];
}

/**
 * A zone's HYBRID (2026-10-15, Adam's border rule): the zone
 * looks at its four neighbors' PURE family rolls — all pure
 * functions of seed + coords, so the border check is too, and
 * host and guests agree without speaking. Where a neighbor's
 * family pairs with this zone's in the pair table (named hybrid,
 * default blend, or no entry for impossible pairs) and the
 * strength roll passes, the margin grows HERE. Home country
 * (0-1 hops) never margins: the near map stays legible.
 */
export function zoneHybridAt(seedStr: string, zx: number, zz: number): { def: HybridDef; primary: BiomeId; secondary: BiomeId } | null {
  if (zoneHops(zx, zz) < 2) return null;
  const family = zoneBiomeAt(seedStr, zx, zz);
  const rng = createSeededRandom(hashStringToSeed(`${seedStr}:zone-hybrid:${zx},${zz}`));
  const roll = rng();
  let best: { def: HybridDef; primary: BiomeId; secondary: BiomeId } | null = null;
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
    const nf = zoneBiomeAt(seedStr, zx + dx, zz + dz);
    if (nf === family) continue;
    const def = hybridForPair(family, nf);
    if (!def) continue; // impossible pair: the influence does not take
    if (roll >= def.strength) continue; // the border stays clean this time
    if (!best || def.strength > best.def.strength) best = { def, primary: family, secondary: nf };
  }
  return best;
}

/**
 * A zone's FACE — the tint / light / effect the renderer and the
 * loop consume, resolved in ONE place (2026-10-15): the variant
 * when it has one, else its hybrid margin, else null (the plain
 * family face). Every setZoneBiome call site reads this so a
 * hybrid zone grades and behaves identically however the player
 * arrived (walk, load, or host sync).
 */
export function zoneFaceAt(seedStr: string, zx: number, zz: number): { tint: { color: number; strength: number }; lightDistanceMult: number; lightIntensityMult: number; effect: string | null } | null {
  const hybrid = zoneHybridAt(seedStr, zx, zz);
  if (hybrid) {
    return { tint: hybridTint(hybrid.def), lightDistanceMult: 1, lightIntensityMult: 1, effect: hybrid.def.effect };
  }
  const variant = zoneVariantAt(seedStr, zx, zz);
  if (variant) {
    return { tint: variant.tint, lightDistanceMult: variant.lightDistanceMult, lightIntensityMult: variant.lightIntensityMult, effect: variant.effect };
  }
  return null;
}

// =====================================================================
// WEATHER (2026-10-15): every zone face resolves to a sky. One
// pure table — variant overrides first (the Skyfall's rain falls
// UP; the Mirror Marsh stays still on purpose), then the hybrid
// margins with weather of their own, then the family defaults:
// storm rains, frost snows, ember sheds ash, wetland drizzles.
// The engine renders it (threeEngine.setWeather); this function
// is the whole decision, so the lab can test the sky without a
// renderer.
// =====================================================================
export type WeatherMode = 'none' | 'rain' | 'uprain' | 'snow' | 'ash';

export function zoneWeatherAt(seedStr: string, zx: number, zz: number): { mode: WeatherMode; intensity: number } {
  const hybrid = zoneHybridAt(seedStr, zx, zz);
  const variant = hybrid ? null : zoneVariantAt(seedStr, zx, zz);
  if (variant) {
    switch (variant.id) {
      case 'skyfall_basin': return { mode: 'uprain', intensity: 1.2 };
      case 'mirror_marsh': return { mode: 'none', intensity: 0 }; // stillness is the marsh's whole fiction
      case 'ashen_drift': return { mode: 'ash', intensity: 1.35 };
      case 'stillwhite': return { mode: 'snow', intensity: 1.25 };
      case 'magnetic_dunes': return { mode: 'ash', intensity: 0.8 }; // wind-blown grit, not rain
      case 'charged_flats': return { mode: 'rain', intensity: 0.85 };
      default: break;
    }
  }
  if (hybrid) {
    switch (hybrid.def.id) {
      case 'ember|storm': return { mode: 'rain', intensity: 0.8 };
      case 'frost|rootwood': return { mode: 'snow', intensity: 0.8 };
      case 'frost|wetland': return { mode: 'snow', intensity: 0.5 };
      default: break; // other margins take their primary family's sky
    }
  }
  switch (zoneBiomeAt(seedStr, zx, zz)) {
    case 'storm': return { mode: 'rain', intensity: 1 };
    case 'frost': return { mode: 'snow', intensity: 0.9 };
    case 'ember': return { mode: 'ash', intensity: 0.7 };
    case 'wetland': return { mode: 'rain', intensity: 0.45 };
    default: return { mode: 'none', intensity: 0 };
  }
}

/** What the HUD calls a zone's kind: its variant when it has one. */
export function zoneKindLabel(info: ZoneInfo): string {
  if (info.hybrid) return info.hybrid.def.name;
  return info.variant ? info.variant.name : biomeDisplayName(info.biome);
}

/** A zone's name: pure function of world seed + coordinates + biome. */
export function zoneNameFor(seedStr: string, zx: number, zz: number, biome: BiomeId, variant?: BiomeVariantDef | null, hybrid?: { def: HybridDef; primary: BiomeId; secondary: BiomeId } | null): string {
  // A hybrid zone names itself from BOTH families' pools mixed —
  // the name should sound like the margin it is.
  const parts = variant
    ? variant.nameParts
    : hybrid
      ? {
          first: [...ZONE_NAME_PARTS[hybrid.primary].first, ...ZONE_NAME_PARTS[hybrid.secondary].first],
          second: [...ZONE_NAME_PARTS[hybrid.primary].second, ...ZONE_NAME_PARTS[hybrid.secondary].second],
        }
      : ZONE_NAME_PARTS[biome];
  const rng = createSeededRandom(hashStringToSeed(`${seedStr}:zone-name:${zx},${zz}`));
  const first = parts.first[Math.floor(rng() * parts.first.length)];
  const second = parts.second[Math.floor(rng() * parts.second.length)];
  return `${first} ${second}`;
}

/** Everything the game needs to know about a zone, in one lookup. */
export function zoneInfo(seedStr: string, zx: number, zz: number): ZoneInfo {
  const biome = zoneBiomeAt(seedStr, zx, zz);
  const hybrid = zoneHybridAt(seedStr, zx, zz);
  const variant = hybrid ? null : zoneVariantAt(seedStr, zx, zz);
  return { zx, zz, biome, variant, hybrid, name: zoneNameFor(seedStr, zx, zz, biome, variant, hybrid), hops: zoneHops(zx, zz) };
}

/** Display form of a biome id: 'fungal' -> 'Fungal'. */
/**
 * The HUD's zone labels for where the player stands (extracted from
 * App.tsx 2026-10-15 under the push-size trigger — this is pure
 * zones logic). Zone identification is a HELMET feature (Adam,
 * 2026-10-15), tiered by the lens line (helmet slice 2, 2026-10-18;
 * the tier itself is derived in creatures/helmet.helmetReadTier):
 * TIER 0 (no lens) the label does not name the land — it carries
 * the unidentified placeholder; TIER 1 (Trail Lens) names the
 * FAMILY only; TIER 2 (Identifier Lens) names family, variant,
 * and all. The coordinates stay at every tier, because counting
 * zones from home is dead reckoning, not a sensor reading. The
 * edge label names the country beyond the nearest border within
 * 10 m, under the same tiers.
 */
/**
 * DISPLAY Z (Adam, 2026-10-18): under the hood, north is −Z —
 * the engine's settled convention (see the border table
 * below), and nothing in generation, travel, or saves moves.
 * But the SCREEN reads like latitude: north positive, so the
 * zone one step north of spawn reads "Zone 0, 1", not
 * "Zone 0, -1". Every player-facing Z readout (the zone
 * label, the minimap's position line, its hover readout)
 * negates through this one helper so the numbers on screen
 * can never disagree with each other.
 */
export const displayZ = (z: number): number => -z;

export interface ZoneHudLabels {
  name: string;
  biomeLabel: string | null;
  coordsLabel: string;
  edgeLabel: string | null;
}

export function zoneHudLabels(
  seed: string,
  zone: ZoneCoords,
  playerX: number,
  playerZ: number,
  readTier: 0 | 1 | 2,
): ZoneHudLabels {
  const coordsLabel = `Zone ${zone.zx}, ${displayZ(zone.zz)}`;
  if (!seed) {
    return { name: 'Starting Zone', biomeLabel: null, coordsLabel, edgeLabel: null };
  }
  const here = zoneInfo(seed, zone.zx, zone.zz);
  // The tiered read (see the header): the Trail Lens names
  // the country by its FAMILY — the proper name is dealt
  // from the variant, so it waits for the Identifier.
  const family = biomeDisplayName(here.biome);
  const name =
    readTier === 2 ? here.name : readTier === 1 ? `${family} Country` : 'Unidentified Country';
  const biomeLabel =
    readTier === 2
      ? zoneKindLabel(here)
      : readTier === 1
        ? `Trail Lens read — the ${family} family; the variant stays the land's secret`
        : 'Zone Identifier not installed — a helmet upgrade reads the land';
  // Within 10 m of the nearest border: the country beyond it.
  // North is -Z, per the minimap's orientation.
  const edges = [
    { dir: 'North', dist: 50 + playerZ, zx: zone.zx, zz: zone.zz - 1 },
    { dir: 'South', dist: 50 - playerZ, zx: zone.zx, zz: zone.zz + 1 },
    { dir: 'West', dist: 50 + playerX, zx: zone.zx - 1, zz: zone.zz },
    { dir: 'East', dist: 50 - playerX, zx: zone.zx + 1, zz: zone.zz },
  ];
  const nearest = edges.reduce((a, b) => (b.dist < a.dist ? b : a));
  let edgeLabel: string | null = null;
  if (nearest.dist <= 10) {
    if (readTier === 0) {
      edgeLabel = `${nearest.dir} — Unidentified Country`;
    } else {
      const beyond = zoneInfo(seed, nearest.zx, nearest.zz);
      edgeLabel =
        readTier === 2
          ? `${nearest.dir} — ${beyond.name} · ${zoneKindLabel(beyond)}`
          : `${nearest.dir} — ${biomeDisplayName(beyond.biome)} Country`;
    }
  }
  return { name, biomeLabel, coordsLabel, edgeLabel };
}

export function biomeDisplayName(biome: BiomeId): string {
  return biome.charAt(0).toUpperCase() + biome.slice(1);
}


// The Living's heart (2026-10-15): every Living zone has ONE
// heart point (where its heartbloom grows). In a Two-Minded
// valley the heart's patch — the HEART THICKET, radius r — is
// the hungry ground; the rest of the valley welcomes. Pure
// function of (seed, coords), like every zone roll.
export function livingHeartAt(seed: string, zx: number, zz: number): { x: number; z: number; r: number } {
  const rng = createSeededRandom(hashStringToSeed(`${seed}:zone-livingheart:${zx},${zz}`));
  return { x: (rng() * 2 - 1) * 22, z: (rng() * 2 - 1) * 22, r: 15 + rng() * 6 };
}
