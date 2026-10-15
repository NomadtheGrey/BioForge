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

import { createSeededRandom, hashStringToSeed } from './motion';
import { RARITY_ROLL_WEIGHT, variantsForFamily, type BiomeId, type BiomeVariantDef } from './biomes';

export interface ZoneCoords {
  zx: number;
  zz: number;
}

export interface ZoneInfo extends ZoneCoords {
  biome: BiomeId;
  /** The zone's variant, when it rolled one (null = plain family). */
  variant: BiomeVariantDef | null;
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
  { maxHops: 2, table: [['meadow', 0.2], ['wetland', 0.4], ['fungal', 0.4]] },
  { maxHops: 3, table: [['wetland', 0.25], ['fungal', 0.45], ['ember', 0.3]] },
  { maxHops: 4, table: [['fungal', 0.45], ['ember', 0.55]] },
  { maxHops: Infinity, table: [['fungal', 0.3], ['ember', 0.7]] },
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

/** What the HUD calls a zone's kind: its variant when it has one. */
export function zoneKindLabel(info: ZoneInfo): string {
  return info.variant ? info.variant.name : biomeDisplayName(info.biome);
}

/** A zone's name: pure function of world seed + coordinates + biome. */
export function zoneNameFor(seedStr: string, zx: number, zz: number, biome: BiomeId, variant?: BiomeVariantDef | null): string {
  const parts = variant ? variant.nameParts : ZONE_NAME_PARTS[biome];
  const rng = createSeededRandom(hashStringToSeed(`${seedStr}:zone-name:${zx},${zz}`));
  const first = parts.first[Math.floor(rng() * parts.first.length)];
  const second = parts.second[Math.floor(rng() * parts.second.length)];
  return `${first} ${second}`;
}

/** Everything the game needs to know about a zone, in one lookup. */
export function zoneInfo(seedStr: string, zx: number, zz: number): ZoneInfo {
  const biome = zoneBiomeAt(seedStr, zx, zz);
  const variant = zoneVariantAt(seedStr, zx, zz);
  return { zx, zz, biome, variant, name: zoneNameFor(seedStr, zx, zz, biome, variant), hops: zoneHops(zx, zz) };
}

/** Display form of a biome id: 'fungal' -> 'Fungal'. */
/**
 * The HUD's zone labels for where the player stands (extracted from
 * App.tsx 2026-10-15 under the push-size trigger — this is pure
 * zones logic). Zone identification is a HELMET feature (Adam,
 * 2026-10-15): until a helmet with the zone-identifier upgrade
 * exists (`zoneIdInstalled`), the label does not name the land — it
 * carries the unidentified placeholder; the coordinates stay,
 * because counting zones from home is dead reckoning, not a sensor
 * reading. The edge label names the country beyond the nearest
 * border within 10 m, under the same gate.
 */
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
  zoneIdInstalled: boolean,
): ZoneHudLabels {
  const coordsLabel = `Zone ${zone.zx}, ${zone.zz}`;
  if (!seed) {
    return { name: 'Starting Zone', biomeLabel: null, coordsLabel, edgeLabel: null };
  }
  const here = zoneInfo(seed, zone.zx, zone.zz);
  const name = zoneIdInstalled ? here.name : 'Unidentified Country';
  const biomeLabel = zoneIdInstalled
    ? zoneKindLabel(here)
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
    if (!zoneIdInstalled) {
      edgeLabel = `${nearest.dir} — Unidentified Country`;
    } else {
      const beyond = zoneInfo(seed, nearest.zx, nearest.zz);
      edgeLabel = `${nearest.dir} — ${beyond.name} · ${zoneKindLabel(beyond)}`;
    }
  }
  return { name, biomeLabel, coordsLabel, edgeLabel };
}

export function biomeDisplayName(biome: BiomeId): string {
  return biome.charAt(0).toUpperCase() + biome.slice(1);
}
