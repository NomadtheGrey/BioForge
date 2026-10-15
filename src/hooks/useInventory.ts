/**
 * BioForge Inventory Domain Hook
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 8 (Modular Separation), 9 (Strict Type Safety)
 *
 * STACK CAPS LIVE HERE (Adam, 2026-10-15): every gain — harvest,
 * loot, craft output, pickups — flows through addInventoryItem or
 * craftRecipe, and both clamp to the pouch tier's cap
 * (game/pouch.ts). What doesn't fit FALLS ON THE GROUND: the hook
 * reports the excess through the overflow handler App registers
 * (setOverflowHandler), and App spawns it as a dropped item at the
 * player's feet. Existing holdings above a cap (an old save, the
 * debug kit) are never trimmed — caps bind gains, not possessions.
 */

import { useState, useCallback, useRef } from 'react';
import { ItemId, CraftingRecipe } from '../types/game';
import { INITIAL_INVENTORY, ITEMS } from '../game/constants';
import { pouchTierOf, stackCapFor } from '../game/pouch';

export interface UseInventoryResult {
  inventory: Record<ItemId, number>;
  addInventoryItem: (itemId: ItemId, count?: number) => void;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  hasItem: (itemId: ItemId, minCount?: number) => boolean;
  craftRecipe: (recipe: CraftingRecipe) => boolean;
  restoreInventory: (saved: Record<ItemId, number>) => void;
  /** App registers where overflow drops land (spawnDroppedItem). */
  setOverflowHandler: (handler: ((itemId: ItemId, count: number) => void) | null) => void;
}

export function useInventory(): UseInventoryResult {
  const [inventory, setInventory] = useState<Record<ItemId, number>>(() => {
    const initialMap: Partial<Record<ItemId, number>> = {};
    INITIAL_INVENTORY.forEach((entry) => {
      initialMap[entry.id as ItemId] = entry.count;
    });
    return initialMap as Record<ItemId, number>;
  });

  // The latest committed inventory, for cap math outside updaters
  // (updaters must stay pure — overflow is a side effect).
  const inventoryRef = useRef(inventory);
  inventoryRef.current = inventory;

  const overflowRef = useRef<((itemId: ItemId, count: number) => void) | null>(null);
  const setOverflowHandler = useCallback(
    (handler: ((itemId: ItemId, count: number) => void) | null): void => {
      overflowRef.current = handler;
    },
    []
  );

  /**
   * Clamp a gain of `count` of `itemId` against the CURRENT pouch:
   * returns how much fits. The rest is the caller's overflow.
   */
  const fitsCount = useCallback((itemId: ItemId, count: number): number => {
    const current = inventoryRef.current;
    const cap = stackCapFor(itemId, pouchTierOf(current));
    const room = Math.max(0, cap - (current[itemId] || 0));
    return Math.min(count, room);
  }, []);

  const addInventoryItem = useCallback((itemId: ItemId, count = 1): void => {
    if (count <= 0) return;
    const fits = fitsCount(itemId, count);
    if (fits > 0) {
      setInventory((prev) => ({
        ...prev,
        [itemId]: (prev[itemId] || 0) + fits,
      }));
    }
    const overflow = count - fits;
    if (overflow > 0) {
      overflowRef.current?.(itemId, overflow);
    }
  }, [fitsCount]);

  const hasItem = useCallback((itemId: ItemId, minCount = 1): boolean => {
    return (inventory[itemId] || 0) >= minCount;
  }, [inventory]);

  const deductInventoryItem = useCallback((itemId: ItemId, count = 1): boolean => {
    if (count <= 0) return true;
    if ((inventory[itemId] || 0) < count) return false;

    setInventory((prev) => ({
      ...prev,
      [itemId]: Math.max(0, (prev[itemId] || 0) - count),
    }));
    return true;
  }, [inventory]);

  const craftRecipe = useCallback((recipe: CraftingRecipe): boolean => {
    const hasAll = recipe.ingredients.every((ing) => (inventory[ing.id] || 0) >= ing.count);
    if (!hasAll) return false;

    // The output clamps like any other gain (computed against the
    // pouch BEFORE the ingredients leave — that's the player's
    // moment-of-craft capacity), and its overflow drops too.
    const fits = fitsCount(recipe.outputId, recipe.outputCount);
    setInventory((prev) => {
      const nextInv = { ...prev };
      recipe.ingredients.forEach((ing) => {
        nextInv[ing.id] = Math.max(0, (nextInv[ing.id] || 0) - ing.count);
      });
      if (fits > 0) {
        nextInv[recipe.outputId] = (nextInv[recipe.outputId] || 0) + fits;
      }
      return nextInv;
    });
    const overflow = recipe.outputCount - fits;
    if (overflow > 0) {
      overflowRef.current?.(recipe.outputId, overflow);
    }

    return true;
  }, [inventory, fitsCount]);

  // Replaces the whole inventory from a loaded save. A copy is stored so
  // later edits can never mutate the save record the caller is holding.
  const restoreInventory = useCallback((saved: Record<ItemId, number>): void => {
    setInventory({ ...saved });
  }, []);

  return {
    inventory,
    addInventoryItem,
    deductInventoryItem,
    hasItem,
    craftRecipe,
    restoreInventory,
    setOverflowHandler,
  };
}
