// ====================================================================
// PROPAGATION — the planting economy's one truth (Adam's
// ruling, 2026-10-18: "Those plants which 'would' have seeds
// can provide 0-2 seeds; those plants which 'wouldn't' have
// seeds be plantable with a piece of the original plant.").
//
// Every reader reads the species def's `propagation` field
// through THIS module — the planter (what an item grows), the
// solvent (what dissolving reclaims), the glove harvest (the
// 0-2 seed roll), the trowel's seed wheel (what counts as
// planting stock), and the item registry (which seed_<species>
// items exist — items/constants generates them from the same
// field). Before this module, the planter knew 7 species, the
// solvent's reclaim chain assumed seed items that mostly
// didn't exist (only 6 did), and any unrecognized seed planted
// a lantern fern by fallthrough. Now they can never disagree.
// ====================================================================

import type { FloraSpecies, ItemId } from '../../types/game';
import { FLORA, floraDef } from './flora';

/** The item a species is planted WITH (and dissolving
 *  reclaims): its seed item for seed-bearers, its piece
 *  item for the rest; null when wild-only or unclassified. */
export function propaguleItemOf(species: FloraSpecies): ItemId | null {
  const route = floraDef(species)?.propagation;
  if (route === 'seed') return `seed_${species}` as ItemId;
  if (typeof route === 'string') return route;
  return null;
}

/** True when the species propagates by seed/spores (the
 *  glove-roll class) rather than by piece. */
export function propagatesBySeed(species: FloraSpecies): boolean {
  return floraDef(species)?.propagation === 'seed';
}

// The planter's reverse map: propagule item → species. Built
// once from the defs. The glow family's shared spore stock is
// the one deliberate collision (two species, one item) — it
// resolves by WHERE you stand, as it always has, so it is
// handled at the call site, not in this map.
const SPECIES_BY_PROPAGULE: ReadonlyMap<ItemId, FloraSpecies> = (() => {
  const map = new Map<ItemId, FloraSpecies>();
  for (const def of Object.values(FLORA)) {
    const item = propaguleItemOf(def.id);
    if (item && item !== 'glow_spore') map.set(item, def.id);
  }
  return map;
})();

/** Which species a pouch item plants; null when the item
 *  plants nothing (no more lantern-fern fallthrough). The
 *  glow_spore stock is contextual — see the planter. */
export function speciesForPropagule(item: ItemId): FloraSpecies | null {
  return SPECIES_BY_PROPAGULE.get(item) ?? null;
}

/** True when a pouch item is planting stock (any species'
 *  seed or piece) — the trowel wheel's membership test. */
export function isPropaguleItem(item: ItemId): boolean {
  return item === 'glow_spore' || SPECIES_BY_PROPAGULE.has(item);
}
