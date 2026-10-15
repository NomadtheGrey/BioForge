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
 * from game/pouch.ts; these handlers only move counts and write
 * the pod back via upsertStructure, so the world snapshot carries
 * its contents like any other structure data.
 */

import { useCallback, useEffect } from 'react';
import type { GameNotification, ItemId, StructureEntity } from '../types/game';
import { ITEMS } from '../game/constants';
import {
  pouchTierOf,
  stackCapFor,
  storageKitFor,
  storageRoomFor,
  type StorageContents,
} from '../game/pouch';

interface UseStorageParams {
  getInventory: () => Record<ItemId, number>;
  getPlayerPosition: () => { x: number; z: number };
  addInventoryItem: (itemId: ItemId, count?: number) => void;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  upsertStructure: (structure: StructureEntity) => void;
  spawnDroppedItem: (itemId: ItemId, count: number, x: number, z: number) => void;
  setOverflowHandler: (handler: ((itemId: ItemId, count: number) => void) | null) => void;
  postNotification: (title: string, message: string, type: GameNotification['type'], iconColor: string) => void;
}

export interface UseStorageResult {
  handleStorageDeposit: (structure: StructureEntity, itemId: ItemId) => void;
  handleStorageWithdraw: (structure: StructureEntity, itemId: ItemId) => void;
  handleStorageUpgrade: (structure: StructureEntity) => void;
}

export function useStorage({
  getInventory,
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
      spawnDroppedItem(itemId, count, pos.x, pos.z);
      postNotification(
        'Pouch Full',
        `No room for ${count} more ${ITEMS[itemId]?.name ?? itemId} — it fell at your feet. Storage pods and pouch upgrades make room.`,
        'alert',
        '#f59e0b',
      );
    });
    return () => setOverflowHandler(null);
  }, [setOverflowHandler, spawnDroppedItem, postNotification, getPlayerPosition]);

  const handleStorageDeposit = useCallback((structure: StructureEntity, itemId: ItemId): void => {
    const contents: StorageContents = structure.storage ?? { tier: 1, items: {} };
    const held = getInventory()[itemId] ?? 0;
    const move = Math.min(held, storageRoomFor(contents, itemId));
    if (move <= 0) {
      postNotification('Pod Is Full', 'No room in this pod for that — upgrade it or stash something else.', 'alert', '#f59e0b');
      return;
    }
    deductInventoryItem(itemId, move);
    upsertStructure({
      ...structure,
      storage: {
        tier: contents.tier,
        items: { ...contents.items, [itemId]: (contents.items[itemId] ?? 0) + move },
      },
    });
  }, [getInventory, deductInventoryItem, upsertStructure, postNotification]);

  const handleStorageWithdraw = useCallback((structure: StructureEntity, itemId: ItemId): void => {
    const contents: StorageContents = structure.storage ?? { tier: 1, items: {} };
    const stored = contents.items[itemId] ?? 0;
    const inventoryNow = getInventory();
    const cap = stackCapFor(itemId, pouchTierOf(inventoryNow));
    const move = Math.min(stored, Math.max(0, cap - (inventoryNow[itemId] ?? 0)));
    if (move <= 0) {
      postNotification('Pouch Is Full', `No room for more ${ITEMS[itemId]?.name ?? itemId} — your stacks hold ${cap}.`, 'alert', '#f59e0b');
      return;
    }
    // addInventoryItem clamps too, but `move` is pre-fitted, so no
    // overflow can fire — the remainder simply stays in the pod.
    addInventoryItem(itemId, move);
    upsertStructure({
      ...structure,
      storage: {
        tier: contents.tier,
        items: { ...contents.items, [itemId]: stored - move },
      },
    });
  }, [getInventory, addInventoryItem, upsertStructure, postNotification]);

  const handleStorageUpgrade = useCallback((structure: StructureEntity): void => {
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
