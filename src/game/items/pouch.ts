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
  { slots: 4, perStack: 25, name: 'Storage Pod' },
  { slots: 8, perStack: 50, name: 'Storage Hutch' },
  { slots: 12, perStack: 100, name: 'Storage Vault' },
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
