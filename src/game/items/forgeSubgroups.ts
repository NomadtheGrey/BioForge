/**
 * FORGE SUBGROUPS — the Structures view's shelves (Adam's
 * ruling, 2026-10-19: "Put defenses on the same group as
 * structures, subgroup them in the listing below, open/close
 * them accordion style. Subgroups, really.")
 *
 * In the Bio-Forge's Base Supplies view (the structures
 * listing), Defenses stops being a sibling TAB of the
 * structures and becomes one SUBGROUP among them — the chime
 * sentinel is found where a player arming a camp looks, and
 * nothing is listed in two top-level places. The subgroups
 * are the shelf's own families (items/baseSupplies), with
 * Defenses inserted beside its old neighborhood (Light &
 * Defense), and membership is a PARTITION:
 *
 *   a recipe shelves under DEFENSES when its category is
 *   'defenses' (the shield family, the turret) OR its output
 *   is a named defense structure (isDefenseStructure — the
 *   chime today); otherwise it shelves under its base-supply
 *   group. A recipe lands in exactly one subgroup, always.
 *
 * Pure functions only — the modal owns the accordion STATE
 * (session-only, like the touch chips: never persisted) and
 * asks here for the partition and the default open shelf:
 * the first subgroup holding a recipe the player can craft
 * right now, else the first subgroup with anything in it.
 */
import type { CraftingRecipe } from '../../types/game';
import {
  BASE_SUPPLY_GROUPS,
  baseSupplyGroupOf,
  isDefenseStructure,
} from './baseSupplies';

export interface ForgeSubgroup {
  id: string;
  label: string;
}

export const DEFENSES_SUBGROUP_ID = 'defenses';

/** The shelf order: the base-supply families as they stand,
 *  with Defenses spliced in right after Light & Defense —
 *  adjacency keeps the neighborhood the old tab lived in. */
export const FORGE_SUBGROUPS: ForgeSubgroup[] = (() => {
  const groups: ForgeSubgroup[] = BASE_SUPPLY_GROUPS.map((g) => ({
    id: g.id,
    label: g.label,
  }));
  const lightAt = groups.findIndex((g) => g.id === 'light');
  groups.splice(lightAt >= 0 ? lightAt + 1 : groups.length, 0, {
    id: DEFENSES_SUBGROUP_ID,
    label: 'Defenses',
  });
  return groups;
})();

/** The ONE subgroup a recipe shelves under in the Structures
 *  view. Defenses membership wins over the base group — the
 *  partition law: a defense structure never also lists under
 *  its supply family. */
export function forgeSubgroupOf(recipe: CraftingRecipe): string {
  if (
    recipe.category === 'defenses' ||
    isDefenseStructure(recipe.outputId)
  ) {
    return DEFENSES_SUBGROUP_ID;
  }
  return baseSupplyGroupOf(recipe.outputId) ?? 'more';
}

export interface ForgeSubgroupShelf {
  group: ForgeSubgroup;
  recipes: CraftingRecipe[];
}

/** The visible recipes partitioned into their subgroups, in
 *  shelf order, empty shelves omitted. */
export function partitionForgeSubgroups(
  recipes: CraftingRecipe[],
): ForgeSubgroupShelf[] {
  const byId = new Map<string, CraftingRecipe[]>();
  for (const r of recipes) {
    const id = forgeSubgroupOf(r);
    const list = byId.get(id);
    if (list) list.push(r);
    else byId.set(id, [r]);
  }
  return FORGE_SUBGROUPS.filter((g) => byId.has(g.id)).map((g) => ({
    group: g,
    recipes: byId.get(g.id)!,
  }));
}

/** Which subgroup opens first: the first holding a recipe the
 *  player can craft right now (the house suggestion — the
 *  newly-craftable thing should not hide behind a fold), else
 *  the first non-empty subgroup, else null. */
export function defaultOpenSubgroup(
  shelves: ForgeSubgroupShelf[],
  canCraft: (r: CraftingRecipe) => boolean,
): string | null {
  for (const shelf of shelves) {
    if (shelf.recipes.some(canCraft)) return shelf.group.id;
  }
  return shelves[0]?.group.id ?? null;
}
