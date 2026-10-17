/**
 * Pouch tiers + storage tiers — the carrying-capacity rules
 * (Adam, 2026-10-15: "craft inventory upgrades that increase the
 * stack size he can carry, tiered — tier 0, some smallish stack
 * size, tier 1, more, etc.")
 *
 * THE POUCH: every stack in the pouch is capped. The cap is the
 * pouch TIER's number — tier 0 (no upgrade) is a smallish 10 — with
 * one exception: an item whose own maxStack is 1 (equipment, worn
 * platforms) never stacks, whatever the tier. (Item maxStack
 * values above 1 are flavor from the unenforced era; the tier is
 * the law now.) Owning an upgrade item IS the tier, derived from
 * the pouch like the gauntlet modules — nothing extra to save.
 *
 * Overflow: when a gain would exceed the cap, the excess FALLS ON
 * THE GROUND as a dropped item at the player's feet (Adam's call)
 * — useInventory reports it through its overflow handler and App
 * spawns the drop. Nothing silently vanishes.
 *
 * STORAGE PODS: a placed pod holds a few DISTINCT stacks, each up
 * to its tier's per-stack cap; upgrade kits raise the placed pod's
 * tier in place, contents preserved.
 */

import type { ItemId, StructureType } from '../../types/game';
import { ITEMS } from './constants';

/** Stack cap per pouch tier (index = tier). */
export const POUCH_TIER_CAPS: readonly number[] = [10, 25, 50, 100];

/** Pouch upgrade items by the tier they grant (index+1 = tier). */
export const POUCH_UPGRADE_ITEMS: readonly ItemId[] = [
  'woven_pouch',
  'resin_satchel',
  'living_rucksack',
];

export const POUCH_TIER_NAMES: readonly string[] = [
  'Pockets',
  'Woven Pouch',
  'Resin-Bound Satchel',
  'Living Rucksack',
];

/** The pouch tier a pouch-full of items earns: the highest upgrade owned. */
export function pouchTierOf(inventory: Record<ItemId, number>): number {
  let tier = 0;
  POUCH_UPGRADE_ITEMS.forEach((itemId, idx) => {
    if ((inventory[itemId] ?? 0) > 0) tier = Math.max(tier, idx + 1);
  });
  return tier;
}

/** The live stack cap for one item under a given pouch tier. */
export function stackCapFor(itemId: ItemId, tier: number): number {
  const def = ITEMS[itemId];
  if (def && def.maxStack === 1) return 1;
  return POUCH_TIER_CAPS[Math.min(tier, POUCH_TIER_CAPS.length - 1)];
}

/** Storage pod capacity by tier: distinct stacks × per-stack cap. */
export const STORAGE_TIERS: readonly { slots: number; perStack: number; name: string }[] = [
  // Kind counts raised (Adam, 2026-10-17): the pouch holds
  // unlimited KINDS, so a pod holding four felt wrong — storage
  // is furniture, and kinds are its axis. Four Vaults together
  // (see clusters below) pool 256 kinds: endgame storage.
  { slots: 16, perStack: 25, name: 'Storage Pod' },
  { slots: 32, perStack: 50, name: 'Storage Hutch' },
  { slots: 64, perStack: 100, name: 'Storage Vault' },
];

/**
 * The Sample Rack's capacity (slice D, 2026-10-16): a pod-family
 * variant themed to the vat loop — MANY distinct stacks (a
 * collection is species-wide) of modest depth, samples only.
 * The samples-only rule itself is enforced at deposit time in
 * useStorage; this table is only the shape of the shelves.
 */
export const SAMPLE_RACK_CAPS: { slots: number; perStack: number; name: string } = {
  slots: 24,
  perStack: 25,
  name: 'Sample Rack',
};

/**
 * The capacity row a storage structure actually uses: pods read
 * the tier table; the rack reads its own fixed row whatever its
 * stored tier says (racks are born tier 1 and never deepen).
 */
export function storageCapsFor(
  type: StructureType,
  tier: number,
): { slots: number; perStack: number; name: string } {
  if (type === 'sample_rack') return SAMPLE_RACK_CAPS;
  return STORAGE_TIERS[Math.min(Math.max(tier, 1), STORAGE_TIERS.length) - 1];
}

/** The kit item that raises a pod FROM the given tier (null at max). */
export function storageKitFor(tier: number): ItemId | null {
  if (tier === 1) return 'storage_kit_hutch';
  if (tier === 2) return 'storage_kit_vault';
  return null;
}

export interface StorageContents {
  tier: number;
  items: Partial<Record<ItemId, number>>;
}

/** A fresh pod's contents record (tier 1, empty). */
export function emptyStorage(): StorageContents {
  return { tier: 1, items: {} };
}

/** Distinct stacks currently held (the slot count in use). */
export function storageSlotsUsed(contents: StorageContents): number {
  return Object.values(contents.items).filter((n) => n > 0).length;
}

/**
 * Room for `count` more of an item in a pod: bounded by the slot
 * count (a NEW stack needs a free slot) and the per-stack cap.
 */
export function storageRoomFor(
  contents: StorageContents,
  itemId: ItemId,
  caps: { slots: number; perStack: number } = STORAGE_TIERS[
    Math.min(Math.max(contents.tier, 1), STORAGE_TIERS.length) - 1
  ],
): number {
  const held = contents.items[itemId] ?? 0;
  if (held <= 0 && storageSlotsUsed(contents) >= caps.slots) return 0;
  return Math.max(0, caps.perStack - held);
}

// ---------------------------------------------------------------------------
// STORAGE CLUSTERS (Adam, 2026-10-17): storage pods placed
// ADJACENT to each other behave as ONE bigger unit — their
// kind caps pool, their contents present as one store, and a
// deposit fills the pod you touched first, then its neighbors.
// Contents never leave their own entities: the save shape is
// untouched, a member lifted by the carry or dissolved simply
// leaves the cluster with its share inside, and the pool
// shrinks by exactly that member. Sample racks never cluster
// (their shelves are vial-shaped, a different law).
// ---------------------------------------------------------------------------

/** Center-to-center distance within which two pods count as
 *  adjacent. Pods stand about a meter wide; builder placement
 *  side by side lands centers roughly 1.2–2 m apart, so this
 *  forgives a small gap and still reads as "beside". */
export const STORAGE_CLUSTER_RADIUS = 2.6;

/**
 * The cluster a pod belongs to: the connected group of
 * storage pods within STORAGE_CLUSTER_RADIUS of each other
 * (adjacency chains — a row of pods is one cluster). The
 * root comes first; the rest follow by distance from it.
 * A non-pod (the rack) or an unlisted root returns [root].
 */
export function storageClusterOf(
  structures: readonly { id: string; type: string; worldX: number; worldZ: number }[],
  root: { id: string; type: string; worldX: number; worldZ: number },
): typeof structures {
  if (root.type !== 'storage_pod') return [root];
  const pods = structures.filter((s) => s.type === 'storage_pod');
  if (!pods.some((s) => s.id === root.id)) return [root];
  const byId = new Map(pods.map((s) => [s.id, s]));
  const members = new Set<string>([root.id]);
  const queue = [root.id];
  while (queue.length > 0) {
    const current = byId.get(queue.shift()!)!;
    for (const other of pods) {
      if (members.has(other.id)) continue;
      const d = Math.hypot(other.worldX - current.worldX, other.worldZ - current.worldZ);
      if (d <= STORAGE_CLUSTER_RADIUS) {
        members.add(other.id);
        queue.push(other.id);
      }
    }
  }
  const rest = [...members]
    .filter((id) => id !== root.id)
    .map((id) => byId.get(id)!)
    .sort(
      (a, b) =>
        Math.hypot(a.worldX - root.worldX, a.worldZ - root.worldZ) -
        Math.hypot(b.worldX - root.worldX, b.worldZ - root.worldZ),
    );
  return [byId.get(root.id)!, ...rest];
}

/** The cluster's contents as one store: counts summed per item. */
export function mergedStorageItems(
  members: readonly { storage?: StorageContents }[],
): Partial<Record<ItemId, number>> {
  const merged: Partial<Record<ItemId, number>> = {};
  for (const member of members) {
    const items = member.storage?.items ?? {};
    for (const [id, count] of Object.entries(items) as [ItemId, number][]) {
      if (count > 0) merged[id] = (merged[id] ?? 0) + count;
    }
  }
  return merged;
}

/** The cluster's pooled caps: kind slots SUM across members;
 *  the per-stack figure shown is the deepest member's (any one
 *  stack still lives within a single pod's own cap — deposits
 *  distribute member by member). */
export function pooledStorageCaps(
  members: readonly { type: string; storage?: StorageContents }[],
): { slots: number; perStack: number } {
  let slots = 0;
  let perStack = 0;
  for (const member of members) {
    const caps = storageCapsFor(member.type as never, member.storage?.tier ?? 1);
    slots += caps.slots;
    perStack = Math.max(perStack, caps.perStack);
  }
  return { slots, perStack };
}
