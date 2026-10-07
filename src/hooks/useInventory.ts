/**
 * BioForge Inventory Domain Hook
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback } from 'react';
import { ItemId, CraftingRecipe } from '../types/game';
import { INITIAL_INVENTORY, ITEMS } from '../game/constants';

export interface UseInventoryResult {
  inventory: Record<ItemId, number>;
  addInventoryItem: (itemId: ItemId, count?: number) => void;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  hasItem: (itemId: ItemId, minCount?: number) => boolean;
  craftRecipe: (recipe: CraftingRecipe) => boolean;
}

export function useInventory(): UseInventoryResult {
  const [inventory, setInventory] = useState<Record<ItemId, number>>(() => {
    const initialMap: Partial<Record<ItemId, number>> = {};
    INITIAL_INVENTORY.forEach((entry) => {
      initialMap[entry.id as ItemId] = entry.count;
    });
    return initialMap as Record<ItemId, number>;
  });

  const addInventoryItem = useCallback((itemId: ItemId, count = 1): void => {
    if (count <= 0) return;

    setInventory((prev) => ({
      ...prev,
      [itemId]: (prev[itemId] || 0) + count,
    }));
  }, []);

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

    setInventory((prev) => {
      const nextInv = { ...prev };
      recipe.ingredients.forEach((ing) => {
        nextInv[ing.id] = Math.max(0, (nextInv[ing.id] || 0) - ing.count);
      });
      nextInv[recipe.outputId] = (nextInv[recipe.outputId] || 0) + recipe.outputCount;
      return nextInv;
    });

    return true;
  }, [inventory]);

  return {
    inventory,
    addInventoryItem,
    deductInventoryItem,
    hasItem,
    craftRecipe,
  };
}
