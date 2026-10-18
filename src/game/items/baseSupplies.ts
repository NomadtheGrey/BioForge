/**
 * baseSupplies — the Base Supplies shelf (Adam, 2026-10-16).
 *
 * Adam asked both tabbed screens (the Bio-Forge Workstation and
 * the pouch) for one more tab: everything you'd use to BUILD
 * THE BASE — walls, the Culture Vat, and their kin — grouped so
 * a piece is findable at a glance instead of lost in the full
 * list. This file is the classifier both screens share, so the
 * shelf can never drift between them.
 *
 * WHAT COUNTS, and how it's decided:
 * - PLACEABLES: items a recipe makes whose category is
 *   'structure' (walls, doors, stations, furniture...). They
 *   shelve into the curated functional groups below — a hand
 *   grouping, because "what is it FOR in a base" is a design
 *   judgment no field in the data carries.
 * - BUILDING MATERIALS: everything a structure recipe EATS that
 *   is not itself a placeable (compost, resin, living thread...).
 *   This half is DERIVED from RECIPES, so it stays true on its
 *   own as recipes change.
 * - A placeable missing from the curated map is NOT lost: it
 *   falls into the catch-all group until someone shelves it.
 */

import { ITEMS, RECIPES } from './constants';
import type { ItemId } from '../../types/game';

export interface BaseSupplyGroup {
  id: string;
  label: string;
}

/** The shelf's groups, in display order. */
export const BASE_SUPPLY_GROUPS: BaseSupplyGroup[] = [
  { id: 'walls', label: 'Walls & Shell' },
  { id: 'ways', label: 'Doors, Gates & Ways' },
  { id: 'stations', label: 'Stations & Growing' },
  { id: 'home', label: 'Storage & Furnishings' },
  { id: 'light', label: 'Light & Defense' },
  { id: 'materials', label: 'Building Materials' },
  { id: 'more', label: 'More Base Pieces' },
];

/** Curated placeables, by group — the findability Adam asked
 *  for. Ids are item ids; anything structure-shaped that a
 *  recipe makes and isn't listed here lands in 'more'. */
const PLACEABLE_GROUPS: Record<string, string[]> = {
  walls: [
    'rootweave_wall',
    'chitin_glass_wall',
    'saltglass_pane',
    'spore_canopy',
    'root_tile_floor',
    'woven_rug',
  ],
  ways: [
    'iris_slit_door',
    'pen_gate',
    'pen_fence',
    'vine_ladder',
    'biotunnel_mouth',
    'deep_biotunnel_mouth',
  ],
  stations: [
    'bio_forge_station',
    'culture_vat',
    'cultivation_mound',
    'memorial',
    'sample_rack',
  ],
  home: [
    'storage_pod',
    'root_shelf',
    'root_table',
    'root_stool',
    'root_bed',
    'hearthpod',
    'banner_post',
  ],
  light: [
    'lantern_fern_post',
    'tamed_snap_trap_turret',
  ],
};

const placeableGroupOf = (itemId: ItemId): string | null => {
  for (const [group, ids] of Object.entries(PLACEABLE_GROUPS)) {
    if (ids.includes(itemId)) return group;
  }
  return null;
};

/** Every item a recipe makes whose category is 'structure' —
 *  the placeable universe, derived (recipes are the authority:
 *  a structure nobody can craft is world scenery, not a
 *  supply). */
const PLACEABLE_IDS: Set<string> = new Set(
  RECIPES.filter((r) => ITEMS[r.outputId]?.category === 'structure').map(
    (r) => r.outputId,
  ),
);

/** Building materials: ingredients of placeable recipes that
 *  are not themselves placeables. Derived from RECIPES. */
const MATERIAL_IDS: Set<string> = new Set(
  RECIPES.filter((r) => PLACEABLE_IDS.has(r.outputId)).flatMap((r) =>
    r.ingredients.map((ing) => ing.id),
  ),
);

/** The group a base supply shelves under, or null when the
 *  item is no base supply at all. */
export const baseSupplyGroupOf = (itemId: ItemId): string | null => {
  if (PLACEABLE_IDS.has(itemId)) {
    return placeableGroupOf(itemId) ?? 'more';
  }
  if (MATERIAL_IDS.has(itemId) && !PLACEABLE_IDS.has(itemId)) {
    return 'materials';
  }
  return null;
};

export const isBaseSupply = (itemId: ItemId): boolean =>
  baseSupplyGroupOf(itemId) !== null;
