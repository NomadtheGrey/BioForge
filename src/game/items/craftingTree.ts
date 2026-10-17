// ============================================================================
// THE CRAFTING TREE (Adam, 2026-10-17)
// ----------------------------------------------------------------------------
// Pure derivation over the shipped tables — no state, no React —
// answering the two questions the forge's ingredient rows now ask:
//
//   1. WHERE DOES THIS COME FROM?  (itemSources)
//      Read off the real sources: the recipe book, the FLORA
//      harvest table, the species tables (kill loot + sheds), the
//      seed rule — with the item's own description as the honest
//      fallback when no table claims it.
//
//   2. WHAT WOULD IT TAKE?  (buildCraftPlan)
//      The full tree under an item: every recipe level expanded,
//      netted against the pouch. Netting walks the tree ONCE with
//      a shared remaining-pouch map, so a raw material two
//      branches both need is counted against the pouch ONCE, in
//      recipe order — the classic crafting-calculator rule.
//
// The forge's GROW chain does not chain into kind slots or graft
// recipes; the same restraint applies here: graft recipes are
// never a tree step (a graft is not how a shield is MADE), and
// when two recipes make the same item, the book's first
// non-graft recipe is the path (deterministic).
// ============================================================================

import type { CraftingRecipe, ItemId } from '../../types/game';
import { ITEMS } from './constants';
import { RECIPES } from './recipesData';
import { FLORA } from '../flora/flora';
import { SPECIES } from '../creatures/species';

/** The recipe that MAKES an item, if any: the book's first
 *  non-graft recipe with this output. */
export function recipeFor(itemId: ItemId): CraftingRecipe | null {
  return recipeIn(RECIPES, itemId);
}

/** recipeFor against an explicit book (the plan walk carries
 *  one so the cycle guard can be lab-proven on a synthetic
 *  book — the shipped book is acyclic, but no future recipe
 *  may ever hang the forge modal). */
function recipeIn(book: CraftingRecipe[], itemId: ItemId): CraftingRecipe | null {
  return book.find((r) => r.outputId === itemId && !r.graftShield) ?? null;
}

/** Where an item comes from, in plain lines — every source the
 *  tables know, best first. Empty only when the item itself is
 *  unknown to the registry. */
export function itemSources(itemId: ItemId): string[] {
  const lines: string[] = [];
  const recipe = recipeFor(itemId);
  if (recipe) lines.push(`Grown at the Bio-Forge — ${recipe.name}`);

  // The flora table: a species whose harvest (main item or a
  // flat extra) yields this item.
  const floraNames: string[] = [];
  for (const def of Object.values(FLORA)) {
    const h = def.harvest;
    if (!h) continue;
    if (h.item === itemId || (h.extras ?? []).some(([id]) => id === itemId)) {
      floraNames.push(def.name);
    }
  }
  if (floraNames.length > 0) {
    lines.push(`Harvest: ${floraNames.slice(0, 3).join(', ')}${floraNames.length > 3 ? ', and others' : ''}`);
  }

  // The species tables: kill loot, sheds, and the sample rule.
  const felledBy: string[] = [];
  const shedBy: string[] = [];
  for (const def of Object.values(SPECIES)) {
    if ((def.killLoot ?? []).some(([id]) => id === itemId)) felledBy.push(def.name);
    if (def.byproduct && def.byproduct.item === itemId) shedBy.push(def.name);
  }
  if (felledBy.length > 0) lines.push(`Felled from: ${felledBy.slice(0, 3).join(', ')}`);
  if (shedBy.length > 0) lines.push(`Shed by: ${shedBy.slice(0, 3).join(', ')}`);
  if (itemId.startsWith('sample_')) {
    const speciesId = itemId.slice('sample_'.length);
    const def = (SPECIES as Record<string, { name: string }>)[speciesId];
    if (def) lines.push(`A living sample of the ${def.name} — creatures shed them; the Culture Vat regrows from them`);
  }

  if (lines.length === 0) {
    // The honest fallback: the item's own words about itself.
    const desc = ITEMS[itemId]?.description ?? '';
    const first = desc.split('. ')[0];
    if (first) lines.push(first.endsWith('.') ? first : `${first}.`);
  }
  return lines;
}

/** One node of a crafting plan. `need` is the gross amount this
 *  branch requires; `fromPouch` is what the shared pouch walk
 *  allocated to it; `shortfall` is what remains after that — for
 *  a craftable node the shortfall is what gets MADE (in
 *  `batches` batches), for a raw node it is what must be FOUND. */
export interface CraftTreeNode {
  itemId: ItemId;
  need: number;
  fromPouch: number;
  shortfall: number;
  recipe: CraftingRecipe | null;
  batches: number;
  children: CraftTreeNode[];
  /** True when the walk stopped here on the cycle/depth guard:
   *  the node renders as a raw need rather than expanding
   *  forever. Reachable only if the book itself loops. */
  cycle?: boolean;
}

export interface CraftPlan {
  root: CraftTreeNode;
  /** Raw (non-craftable) shortfalls across the whole tree,
   *  merged by item — the "still to gather" list. */
  rawNeeds: { itemId: ItemId; count: number }[];
}

/** Build the netted plan for `rootNeed` of `rootId` against a
 *  pouch. The walk is depth-first in book order and consumes a
 *  single remaining-pouch map, so shared ingredients are never
 *  double-counted against what the player holds. */
/** The walk's depth discipline: past this many levels — or the
 *  moment an item would appear inside its OWN subtree — the
 *  node stops expanding and reads as a raw need. The shipped
 *  book never comes close (its deepest chain is ~4); the guard
 *  exists so a future looping recipe cannot hang the modal. */
export const CRAFT_TREE_MAX_DEPTH = 16;

export function buildCraftPlan(
  rootId: ItemId,
  rootNeed: number,
  inventory: Partial<Record<ItemId, number>>,
  book: CraftingRecipe[] = RECIPES
): CraftPlan {
  const remaining: Partial<Record<ItemId, number>> = { ...inventory };
  const raw = new Map<ItemId, number>();

  const walk = (itemId: ItemId, need: number, path: ReadonlySet<ItemId>, depth: number): CraftTreeNode => {
    const held = remaining[itemId] ?? 0;
    const fromPouch = Math.min(held, need);
    remaining[itemId] = held - fromPouch;
    const shortfall = need - fromPouch;
    const recipe = recipeIn(book, itemId);
    const node: CraftTreeNode = {
      itemId,
      need,
      fromPouch,
      shortfall,
      recipe,
      batches: 0,
      children: [],
    };
    if (shortfall <= 0) return node;
    if (!recipe || path.has(itemId) || depth >= CRAFT_TREE_MAX_DEPTH) {
      // A raw leaf — or the cycle/depth guard stopping a loop:
      // either way the shortfall is something to FIND, and the
      // node is marked so the modal can say so honestly.
      if (recipe && (path.has(itemId) || depth >= CRAFT_TREE_MAX_DEPTH)) node.cycle = true;
      raw.set(itemId, (raw.get(itemId) ?? 0) + shortfall);
      return node;
    }
    node.batches = Math.ceil(shortfall / Math.max(1, recipe.outputCount));
    const nextPath = new Set(path);
    nextPath.add(itemId);
    node.children = (recipe.ingredients ?? []).map((ing) =>
      walk(ing.id, ing.count * node.batches, nextPath, depth + 1)
    );
    return node;
  };

  const root = walk(rootId, rootNeed, new Set(), 0);
  const rawNeeds = [...raw.entries()]
    .map(([itemId, count]) => ({ itemId, count }))
    .sort((a, b) => (ITEMS[a.itemId]?.name ?? a.itemId).localeCompare(ITEMS[b.itemId]?.name ?? b.itemId));
  return { root, rawNeeds };
}
