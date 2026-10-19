// ============================================================================
// fungusWall.ts — the Mycologist's Wall's law, as pure rules
// ============================================================================
// BioForge wave 2, 2026-10-19 (Adam: "give fungus a purpose" — the
// wall is fine, but a trophy case is not enough). The wall is a
// workplace, not a shelf: mounted fungus caps stay ALIVE and keep
// working. Two jobs, one per fungus family:
//
//   1. LIGHT — the glow family's mounts genuinely shed light, and
//      the wall grows brighter with every glow mount (read live
//      off the entity by the engine's structure-light getter —
//      the same seam the lantern-fern post's growth curve rides).
//   2. THE BIN — a compost bin at the wall's foot: the rot family's
//      mounts digest organic scraps into compost on loaded-zone
//      time. A notch below the Mound's economics everywhere: the
//      Mound stays the compost engine; the wall is a side crew.
//
// The COLLECTION is the third job: mounted count vs the 37 CAP
// kinds, shown in the panel. Pride is a purpose.
//
// The classification below is the one truth: every CAP-kind item
// is either a glow fungus, a rot-eater, both, or neither, and the
// reasons are the item defs' own words (descriptions quoted in
// GLOW_REASON / DECOMPOSER_REASON). A mounted cap contributes to
// each effect it qualifies for — one mount, read twice, honestly.
// ============================================================================

import type { ItemId, StructureEntity } from '../../types/game';
import { ITEM_KINDS } from '../items/itemKinds';

/** The full mountable universe, derived — the CAP kind's members. */
export function capKindMembers(): ItemId[] {
  return ITEM_KINDS['cap'].members;
}

// ---------------------------------------------------------------------------
// The two families (subset of the CAP kind — 37 members total)
// ---------------------------------------------------------------------------

/**
 * GLOW — the fungi that shed light. Classified from their own
 * def copy: 'glow-side down', 'faintly glow-gilled', 'gathered
 * by their own light', the lamp-shade, the crackling discharge.
 */
export const GLOW_CAPS: ItemId[] = [
  'glass_cap',    // "a natural lamp-shade" — stores the noon, glows it back.
  'gloom_cap',    // "glow-side down in the basket" — explicitly glows.
  'static_cap',   // "a crackling Static Cap" — faint discharge light.
  'dark_cap',     // "faintly glow-gilled" — explicitly glows.
  'sump_cap',     // "gathered by their own light" — explicitly glows.
];

/**
 * DECOMPOSERS — the rot family: fungi whose nature is digestion,
 * grown on the dead, the decayed, the finished. Bone, ash, skull,
 * compost beds, pool rims.
 */
export const DECOMPOSER_CAPS: ItemId[] = [
  'compost_cap',  // from the beetles' finished beds — eats the composted.
  'dust_cap',     // from the bone dust — flour of the Bonefields.
  'marrow_cap',   // from the pale pools' rims — the rot's edge.
  'rib_cap',      // from the Leviathan Graveyard — bone-grown.
  'tomb_cap',     // from tombs — the fungus of the dead.
  'husk_cap',     // "from an unoccupied skull" — skull-hollow fungus.
  'gloom_cap',    // the dark country's provision — decay's country.
  'dark_cap',     // from the shallow dark — rot's own light.
  'sump_cap',     // from the pools' raft-edges — feeds at rot's edge.
];

/** The bin's menu (Part A): the decomposer crew eats what nothing
 *  else eats — fiber, bone, chitin scrap. 1 stock per item, all. */
export const WALL_BIN_FEED: ItemId[] = ['soft_fiber', 'clean_bone', 'carapace_scale'];

/** The Mound's decomposer feed (Part B): clean_bone and
 *  carapace_scale become Mound feed, consulted AFTER the kind
 *  tables and into the same stock budget — a notch below kind
 *  feed by priority, which the feed copy names honestly. */
export const MOUND_DECOMPOSER_FEED: ItemId[] = ['clean_bone', 'carapace_scale'];

// ---------------------------------------------------------------------------
// The bin's economics (a notch below the Mound's everywhere)
// ---------------------------------------------------------------------------

/** The bin's stock cap (Mound: 12). */
export const WALL_BIN_MAX = 10;
/** The price of one ready compost in banked stock (Mound: 5). */
export const WALL_BIN_HARVEST_COST = 6;
/**
 * Mount-seconds of digestion per unit of stock: one decomposer
 * mount digests 1 stock per 180 loaded-zone seconds. The Mound
 * pays its compost out instantly at interaction time; the wall
 * works slowly, in the background, while you are elsewhere.
 */
export const WALL_DIGEST_SECONDS = 180;

/** How many of the mounted ids count as glow. */
export function glowMountCount(mounted: ItemId[]): number {
  const set = new Set(GLOW_CAPS);
  return mounted.filter((m) => set.has(m)).length;
}

/** How many of the mounted ids count as rot-eaters. */
export function decomposerMountCount(mounted: ItemId[]): number {
  const set = new Set(DECOMPOSER_CAPS);
  return mounted.filter((m) => set.has(m)).length;
}

/** Mounting: one mount per item id per wall; CAP-kind items only.
 *  Consuming is the caller's job (inventory); this is the record. */
export function mountCap(mounted: ItemId[], itemId: ItemId): ItemId[] {
  if (!capKindMembers().includes(itemId)) return mounted;
  if (mounted.includes(itemId)) return mounted;
  return [...mounted, itemId];
}

/** Unmounting: returns the record without the id; a living cutting
 *  goes back to the pouch (the caller restores the item). */
export function unmountCap(mounted: ItemId[], itemId: ItemId): ItemId[] {
  return mounted.filter((m) => m !== itemId);
}

/**
 * The bin's digestion tick (pure — lab-tested). Loaded-zone
 * seconds only, like the vat's clocks. mount-seconds accrue on
 * the wall's own clock; every WALL_DIGEST_SECONDS digests one
 * stock unit into one ready compost. Capacity is shared:
 * binStock + binDone never exceed WALL_BIN_MAX.
 */
export function wallBinTick(
  wall: { binStock: number; binDone: number; binClock: number; mounted: ItemId[] },
  seconds: number,
): { binStock: number; binDone: number; binClock: number } {
  const digesters = decomposerMountCount(wall.mounted);
  if (digesters <= 0 || seconds <= 0 || wall.binStock <= 0) {
    return { binStock: wall.binStock, binDone: wall.binDone, binClock: wall.binClock };
  }
  const accrued = wall.binClock + digesters * seconds;
  // Units digest as far as the stock and the ready-compost cap
  // allow: digestion CONVERTS stock into done (the total is not
  // capped — that would freeze a full bin forever), but done
  // never exceeds the bin's own box.
  const units = Math.floor(accrued / WALL_DIGEST_SECONDS);
  const take = Math.max(0, Math.min(units, wall.binStock, WALL_BIN_MAX - wall.binDone));
  // Only digested units leave the clock — undigested units
  // (a full bin, an empty stock) keep accruing, capped at one
  // buffered unit: an idle crew must not bank infinite work.
  return {
    binStock: wall.binStock - take,
    binDone: wall.binDone + take,
    binClock: Math.min(accrued - take * WALL_DIGEST_SECONDS, WALL_DIGEST_SECONDS),
  };
}

/**
 * The wall's living light (pure — the engine's structure-light
 * getter calls it through wallLightOf). Base halo, always on —
 * bone and straw by sunlight — plus a real lamp's worth per
 * glow mount, distance reaching with it. Never outshines the
 * lantern post's 40 (the physical-scale rule, lightSpecs.ts).
 */
export function wallLightOf(mounted: ItemId[]): { intensity: number; distance: number; y: number } {
  const glow = glowMountCount(mounted);
  return {
    intensity: 2.0 + glow * 2.2,              // 2.0 bare … 13.0 with all five glow kinds
    distance: 2.5 + Math.min(glow, 8) * 1.1,  // 2.5 … 8.0 — a camp lamp, not a beacon
    y: 1.4,
  };
}

/** The wall's record always reads the same way to callers. */
export function readWall(entity: StructureEntity): {
  mounted: ItemId[];
  binStock: number;
  binDone: number;
  binClock: number;
} {
  return {
    mounted: entity.wall?.mounted ?? [],
    binStock: entity.wall?.binStock ?? 0,
    binDone: entity.wall?.binDone ?? 0,
    binClock: entity.wall?.binClock ?? 0,
  };
}
