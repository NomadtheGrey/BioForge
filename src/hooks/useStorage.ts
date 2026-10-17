/**
 * useStorage — the storage-pod behaviors + pouch overflow landing
 * (Adam, 2026-10-15), extracted from App.tsx under the push-size
 * ceiling like useQuests before it.
 *
 * OVERFLOW: when a gain exceeds the pouch tier's stack cap,
 * useInventory reports the excess through its overflow handler;
 * this hook registers that handler — the excess FALLS ON THE
 * GROUND at the player's feet as a normal dropped item.
 *
 * TRANSFERS: deposit/withdraw move as much as FITS and leave the
 * rest where it was — unlike world gains, a transfer never spills.
 * All capacity rules (slots, per-stack caps, tiers, kits) come
 * from game/items/pouch.ts; these handlers only move counts and write
 * the pod back via upsertStructure, so the world snapshot carries
 * its contents like any other structure data.
 */

import { useCallback, useEffect } from 'react';
import type { GameNotification, ItemId, StructureEntity } from '../types/game';
import { ITEMS } from '../game/items/constants';
import {
  mergedStorageItems,
  pouchTierOf,
  stackCapFor,
  storageCapsFor,
  storageClusterOf,
  storageKitFor,
  storageRoomFor,
  type StorageContents,
} from '../game/items/pouch';
import { isSampleItem } from '../game/structures/vat';
import { isSlottedUpgrade } from '../game/items/slottedUpgrades';

interface UseStorageParams {
  getInventory: () => Record<ItemId, number>;
  /** The live structures list (for storage clusters: adjacent
   *  pods behave as one unit — pouch.ts has the grouping). */
  getStructures: () => StructureEntity[];
  getPlayerPosition: () => { x: number; z: number };
  addInventoryItem: (itemId: ItemId, count?: number) => void;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  upsertStructure: (structure: StructureEntity) => void;
  spawnDroppedItem: (itemId: ItemId, count: number, x: number, z: number, pickupDelayMs?: number) => void;
  setOverflowHandler: (handler: ((itemId: ItemId, count: number) => void) | null) => void;
  postNotification: (title: string, message: string, type: GameNotification['type'], iconColor: string, key?: string) => void;
}

export interface UseStorageResult {
  handleStorageDeposit: (structure: StructureEntity, itemId: ItemId) => void;
  handleStorageWithdraw: (structure: StructureEntity, itemId: ItemId) => void;
  handleStorageUpgrade: (structure: StructureEntity) => void;
}

export function useStorage({
  getInventory,
  getStructures,
  getPlayerPosition,
  addInventoryItem,
  deductInventoryItem,
  upsertStructure,
  spawnDroppedItem,
  setOverflowHandler,
  postNotification,
}: UseStorageParams): UseStorageResult {
  // Overflow lands at the player's feet (registered once; the
  // inventory hook calls it synchronously during a gain).
  useEffect(() => {
    setOverflowHandler((itemId, count) => {
      const pos = getPlayerPosition();
      // Born on a 6-second pickup holdoff (2026-10-17): without
      // it, a full pouch re-picks this drop next tick, overflows
      // again, and the pair of toasts strobes forever.
      spawnDroppedItem(itemId, count, pos.x, pos.z, 6000);
      const name = ITEMS[itemId]?.name ?? itemId;
      const ownedCount = getInventory()[itemId] ?? 0;
      // WHY the gain overflowed decides the words (Adam's play
      // pass, 2026-10-17): the generic 'Pouch Full' copy lied
      // about a duplicate Trail Lens — he already HAD one
      // slotted on his helmet, so 'no room' was never the
      // reason, and 'storage pods make room' was doubly wrong
      // (slotted gear can't be stashed at all). Three cases:
      //   - a slotted upgrade he already owns: a spare can
      //     never be carried — say ALREADY SLOTTED;
      //   - any other one-of item (maxStack 1) he owns: a
      //     spare is unusable — say ALREADY CARRIED;
      //   - a stackable at its cap: the original copy, which
      //     is true — pods and pouch tiers DO make room.
      // Keyed 'pouchfull' in every case (2026-10-17): repeated
      // overflows refresh the one toast instead of stacking.
      if (isSlottedUpgrade(itemId) && ownedCount > 0) {
        postNotification(
          'Already Slotted',
          `The ${name} is already grown into your gear — a spare can't be carried, so it fell at your feet.`,
          'alert',
          '#a78bfa',
          'pouchfull',
        );
      } else if ((ITEMS[itemId]?.maxStack ?? 1) === 1 && ownedCount > 0) {
        postNotification(
          'Already Carried',
          `You already carry a ${name} — one is all you can use, so the spare fell at your feet.`,
          'alert',
          '#f59e0b',
          'pouchfull',
        );
      } else {
        postNotification(
          'Pouch Full',
          `No room for ${count} more ${name} — it fell at your feet. Storage pods and pouch upgrades make room.`,
          'alert',
          '#f59e0b',
          'pouchfull',
        );
      }
    });
    return () => setOverflowHandler(null);
  }, [setOverflowHandler, spawnDroppedItem, postNotification, getPlayerPosition, getInventory]);

  const handleStorageDeposit = useCallback((structure: StructureEntity, itemId: ItemId): void => {
    // The Sample Rack's law (slice D, 2026-10-16): samples only —
    // its shelves are vial-shaped, and everything else refuses.
    // Slotted upgrades refuse (Adam, 2026-10-17): gauntlet
    // modules, helmet lenses, Quicksteps growths and pouch
    // tiers are grown into their gear — never loose cargo,
    // so no path may stash them. The pod panel never offers
    // them; this guard is the backstop at the point of
    // consumption, the graft-lock pattern.
    if (isSlottedUpgrade(itemId)) {
      postNotification('Slotted Into Your Gear', 'That upgrade is grown into your equipment — it can\'t be stashed.', 'alert', '#a78bfa');
      return;
    }
    if (structure.type === 'sample_rack' && !isSampleItem(itemId)) {
      postNotification('Samples Only', 'The rack\'s shelves hold sample vials and nothing else.', 'alert', '#4ade80');
      return;
    }
    const held = getInventory()[itemId] ?? 0;
    // STORAGE CLUSTERS (Adam, 2026-10-17): a pod standing with
    // adjacent pods is one unit — the deposit fills the pod
    // you touched first, then its neighbors in order, each up
    // to its own caps. Deliberately dumb: no sorting, no
    // repacking, nothing already stored ever moves.
    const members = storageClusterOf(getStructures(), structure) as StructureEntity[];
    let remaining = held;
    let moved = 0;
    const writes: { member: StructureEntity; contents: StorageContents; take: number }[] = [];
    for (const member of members) {
      if (remaining <= 0) break;
      const memberContents: StorageContents = member.storage ?? { tier: 1, items: {} };
      const room = storageRoomFor(memberContents, itemId, storageCapsFor(member.type, memberContents.tier));
      const take = Math.min(remaining, room);
      if (take > 0) {
        writes.push({ member, contents: memberContents, take });
        remaining -= take;
        moved += take;
      }
    }
    if (moved <= 0) {
      postNotification('Storage Is Full', 'No room in this storage for that — grow it, or set another pod beside it.', 'alert', '#f59e0b');
      return;
    }
    deductInventoryItem(itemId, moved);
    for (const { member, contents: memberContents, take } of writes) {
      upsertStructure({
        ...member,
        storage: {
          tier: memberContents.tier,
          items: { ...memberContents.items, [itemId]: (memberContents.items[itemId] ?? 0) + take },
        },
      });
    }
  }, [getInventory, getStructures, deductInventoryItem, upsertStructure, postNotification]);

  const handleStorageWithdraw = useCallback((structure: StructureEntity, itemId: ItemId): void => {
    // Clusters (2026-10-17): the take draws from the touched
    // pod first, then its neighbors — the pooled store the
    // panel shows. Nothing is repacked afterwards.
    const members = storageClusterOf(getStructures(), structure) as StructureEntity[];
    const stored = (mergedStorageItems(members)[itemId] ?? 0);
    const inventoryNow = getInventory();
    const cap = stackCapFor(itemId, pouchTierOf(inventoryNow));
    const move = Math.min(stored, Math.max(0, cap - (inventoryNow[itemId] ?? 0)));
    if (move <= 0) {
      postNotification('Pouch Is Full', `No room for more ${ITEMS[itemId]?.name ?? itemId} — your stacks hold ${cap}.`, 'alert', '#f59e0b');
      return;
    }
    // addInventoryItem clamps too, but `move` is pre-fitted, so no
    // overflow can fire — the remainder simply stays stored.
    addInventoryItem(itemId, move);
    let remaining = move;
    for (const member of members) {
      if (remaining <= 0) break;
      const memberContents: StorageContents = member.storage ?? { tier: 1, items: {} };
      const here = memberContents.items[itemId] ?? 0;
      const take = Math.min(here, remaining);
      if (take > 0) {
        remaining -= take;
        upsertStructure({
          ...member,
          storage: {
            tier: memberContents.tier,
            items: { ...memberContents.items, [itemId]: here - take },
          },
        });
      }
    }
  }, [getInventory, getStructures, addInventoryItem, upsertStructure, postNotification]);

  const handleStorageUpgrade = useCallback((structure: StructureEntity): void => {
    // Racks never deepen (slice D): their shelves are grown to
    // size. The modal hides the kit row for them; this is the
    // belt under that suspender.
    if (structure.type === 'sample_rack') return;
    const contents: StorageContents = structure.storage ?? { tier: 1, items: {} };
    const kit = storageKitFor(contents.tier);
    if (!kit || !deductInventoryItem(kit, 1)) return;
    const nextTier = contents.tier + 1;
    upsertStructure({ ...structure, storage: { tier: nextTier, items: { ...contents.items } } });
    postNotification(
      'Storage Grew',
      `The pod drinks the graft and swells — a bigger home for your things now (tier ${nextTier}).`,
      'craft',
      '#f59e0b',
    );
  }, [deductInventoryItem, upsertStructure, postNotification]);

  return { handleStorageDeposit, handleStorageWithdraw, handleStorageUpgrade };
}
