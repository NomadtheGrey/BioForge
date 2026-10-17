/**
 * BioForge Inventory Domain Hook
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 8 (Modular Separation), 9 (Strict Type Safety)
 *
 * STACK CAPS LIVE HERE (Adam, 2026-10-15): every gain — harvest,
 * loot, craft output, pickups — flows through addInventoryItem or
 * craftRecipe, and both clamp to the pouch tier's cap
 * (game/items/pouch.ts). What doesn't fit FALLS ON THE GROUND: the hook
 * reports the excess through the overflow handler App registers
 * (setOverflowHandler), and App spawns it as a dropped item at the
 * player's feet. Existing holdings above a cap (an old save, the
 * debug kit) are never trimmed — caps bind gains, not possessions.
 */

import { useState, useCallback, useRef } from 'react';
import { ItemId, CraftingRecipe } from '../types/game';
import { INITIAL_INVENTORY, ITEMS, RECIPES } from '../game/items/constants';
import { pouchTierOf, stackCapFor } from '../game/items/pouch';

/** One line of a Grow Prerequisites result: a recipe that was
 *  crafted, and how many times. */
export interface GrownCraft {
  recipe: CraftingRecipe;
  times: number;
}

export interface UseInventoryResult {
  inventory: Record<ItemId, number>;
  addInventoryItem: (itemId: ItemId, count?: number) => number;
  deductInventoryItem: (itemId: ItemId, count?: number) => boolean;
  hasItem: (itemId: ItemId, minCount?: number) => boolean;
  craftRecipe: (recipe: CraftingRecipe) => boolean;
  /** Grow a craftable item's whole prerequisite chain (Adam,
   *  2026-10-16): recursively crafts whatever stands between the
   *  pouch and `needed` of targetId, in ONE atomic pass, and
   *  returns what was crafted (empty when nothing could grow). */
  growPrerequisites: (targetId: ItemId, needed: number) => GrownCraft[];
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

  /** Adds what fits; the overflow handler drops the rest.
   *  Returns how many actually entered the pouch (2026-10-17)
   *  so callers — the pickup path above all — can speak only
   *  about what was truly taken. */
  const addInventoryItem = useCallback((itemId: ItemId, count = 1): number => {
    if (count <= 0) return 0;
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
    return fits;
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

    // GRAFT (shield slice, 2026-10-17): a graft recipe grows thorn
    // spikes ONTO a shield the player already owns — the shield is
    // the workbench, not a material. Materials leave; the shield
    // count never moves (no deduct, no re-output, no overflow drop);
    // the graftShield field stamps the graft onto PlayerState in
    // the craft flow.
    const isGraft = !!recipe.graftShield;

    // The output clamps like any other gain (computed against the
    // pouch BEFORE the ingredients leave — that's the player's
    // moment-of-craft capacity), and its overflow drops too.
    const fits = isGraft ? 0 : fitsCount(recipe.outputId, recipe.outputCount);
    setInventory((prev) => {
      const nextInv = { ...prev };
      recipe.ingredients.forEach((ing) => {
        if (isGraft && ing.id === recipe.graftShield) return;
        nextInv[ing.id] = Math.max(0, (nextInv[ing.id] || 0) - ing.count);
      });
      if (!isGraft && fits > 0) {
        nextInv[recipe.outputId] = (nextInv[recipe.outputId] || 0) + fits;
      }
      return nextInv;
    });
    const overflow = isGraft ? 0 : recipe.outputCount - fits;
    if (overflow > 0) {
      overflowRef.current?.(recipe.outputId, overflow);
    }

    return true;
  }, [inventory, fitsCount]);

  /**
   * Grow Prerequisites (Adam, 2026-10-16): from a Tier 2/3
   * recipe, one click grows the short bio-reagent's whole chain
   * — its own recipe, and that recipe's craftable ingredients
   * first, recursively — instead of bouncing between recipes.
   *
   * The chain is SIMULATED against a working copy of the pouch
   * and committed as ONE inventory write, so no intermediate
   * state is ever rendered and no step can read a stale pouch
   * (the failure mode of firing craftRecipe in a loop). Partial
   * progress is kept: if a raw ingredient runs out mid-chain,
   * what was grown stays grown and the plan says so. Outputs
   * clamp to the stack cap exactly like craftRecipe, and the
   * excess drops through the overflow handler.
   */
  const growPrerequisites = useCallback((targetId: ItemId, needed: number): GrownCraft[] => {
    if (needed <= 0) return [];
    const work: Record<ItemId, number> = { ...inventoryRef.current };
    const plan = new Map<string, GrownCraft>();
    const overflows = new Map<ItemId, number>();

    const fitsInWork = (itemId: ItemId, count: number): number => {
      const cap = stackCapFor(itemId, pouchTierOf(work));
      return Math.min(count, Math.max(0, cap - (work[itemId] || 0)));
    };

    // Leave `count` of itemId standing in the working pouch,
    // crafting (recursively) whatever is short. Returns whether
    // the full count stands. `visiting` breaks recipe cycles.
    const ensure = (itemId: ItemId, count: number, visiting: Set<string>): boolean => {
      if ((work[itemId] || 0) >= count) return true;
      const recipe = RECIPES.find((r) => r.outputId === itemId);
      if (!recipe || visiting.has(itemId)) return false;
      visiting.add(itemId);
      let guard = 0;
      while ((work[itemId] || 0) < count && guard < 64) {
        guard += 1;
        // Grow every ingredient for ONE craft first; each
        // ensure() leaves its item physically in the pouch, so
        // siblings sharing a sub-ingredient see honest counts.
        const ready = recipe.ingredients.every((ing) => ensure(ing.id, ing.count, visiting));
        if (!ready) break;
        if (!recipe.ingredients.every((ing) => (work[ing.id] || 0) >= ing.count)) break;
        recipe.ingredients.forEach((ing) => {
          work[ing.id] = (work[ing.id] || 0) - ing.count;
        });
        const fits = fitsInWork(recipe.outputId, recipe.outputCount);
        if (fits > 0) {
          work[recipe.outputId] = (work[recipe.outputId] || 0) + fits;
        }
        const over = recipe.outputCount - fits;
        if (over > 0) {
          overflows.set(recipe.outputId, (overflows.get(recipe.outputId) || 0) + over);
        }
        const entry = plan.get(recipe.id);
        if (entry) entry.times += 1;
        else plan.set(recipe.id, { recipe, times: 1 });
        if (fits === 0) break; // pouch already full of the output
      }
      visiting.delete(itemId);
      return (work[itemId] || 0) >= count;
    };

    ensure(targetId, needed, new Set());
    if (plan.size === 0) return [];
    setInventory(work);
    overflows.forEach((count, itemId) => overflowRef.current?.(itemId, count));
    return [...plan.values()];
  }, []);

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
    growPrerequisites,
    restoreInventory,
    setOverflowHandler,
  };
}
