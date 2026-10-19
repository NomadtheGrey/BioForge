// ============================================================================
// Drop shapes — what a dropped item LOOKS like in the world
// (Adam, 2026-10-19: "have the drops grouped intelligently, use
// a handful of representative generative models per group,
// further refined by color for now")
// ----------------------------------------------------------------------------
// Until today every world drop — a shed pellet, a felled bear's
// plates, a prismatic heart — rendered as the same cyan
// octahedron. The item table always carried an honest identity
// (category, name, and a per-item color); the renderer just
// never asked. This module is the grouping brain: given an item
// it names ONE of a handful of shapes, and the engine builds
// that shape procedurally and tints it with the item's own
// color. No per-item models — a handful of representative forms,
// read at a glance:
//
//   vial   — a specimen vial: every creature SAMPLE (sample_*)
//   seed   — a tilted seed capsule: every plantable seed (seed_*)
//   kit    — a small crate: crafted goods (equipment, structures,
//            fertilizers) travel as kits
//   cap    — a fungus cap on a stub stem: the *_cap harvests
//   plate  — a flat hex plate: plates, scales, shells, chitin
//   gem    — a pointed crystal: shards, prisms, glass, fangs
//   orb    — a smooth orb: gels, essences, saps, pellets, organs
//   coil   — a flat coil: threads, fibers, vines, ribbons
//   puff   — a soft cluster: spores, wool, fur, down, petals
//   chunk  — a rough lump: the honest remainder (ore, wood,
//            resin lumps, meat, bone)
//
// The rules read the item's id and category — stable facts — in
// an order that puts the specific before the general (a
// lodestone PLATE is a plate before 'lodestone' can make it a
// gem; a sample is a vial before anything else can claim it).
// ============================================================================

import type { ItemDef, ItemId } from '../../types/game';
import { ITEMS } from './constants';

export type DropShape =
  | 'vial'
  | 'seed'
  | 'kit'
  | 'cap'
  | 'plate'
  | 'gem'
  | 'orb'
  | 'coil'
  | 'puff'
  | 'chunk';

/** Id fragments that mark each raw-material form. Checked in
 *  order: cap, plate, gem, orb, coil, puff — specific shapes
 *  before soft ones, so a 'chitin_plate' can never drift into
 *  the puff bucket and a 'gel_cap' reads as the fungus it is. */
const CAP_WORDS = ['_cap'];
const PLATE_WORDS = ['plate', 'scale', 'shell', 'chitin', 'carapace', 'scute', 'hide', 'slab', 'bark'];
const GEM_WORDS = ['shard', 'crystal', 'prism', 'glass', 'fulgurite', 'gem', 'fang', 'claw', 'horn', 'opal', 'sting'];
const ORB_WORDS = ['gel', 'essence', 'nectar', 'sap', 'dew', 'pellet', 'jelly', 'ichor', 'heart', 'orb', 'egg'];
const COIL_WORDS = ['thread', 'fiber', 'vine', 'cord', 'lash', 'root'];
const PUFF_WORDS = ['spore', 'wool', 'fur', 'down', 'feather', 'plume', 'petal', 'moss', 'puff', 'tuft', 'leaf', 'frond'];

function hasAny(id: string, words: string[]): boolean {
  return words.some((w) => id.includes(w));
}

/** The drop shape for an item definition. Pure and total: every
 *  item in the table lands in exactly one group, with 'chunk'
 *  as the honest floor. */
export function dropShapeFor(item: ItemDef): DropShape {
  const id = item.id as string;
  // Specimens and plantables: identity prefixes, checked first.
  if (id.startsWith('sample_')) return 'vial';
  if (item.category === 'seed' || id.startsWith('seed_')) return 'seed';
  // Crafted goods travel as kits.
  if (item.category === 'equipment' || item.category === 'structure' || item.category === 'fertilizer') {
    return 'kit';
  }
  // Raw materials, by form.
  if (hasAny(id, CAP_WORDS)) return 'cap';
  if (hasAny(id, PLATE_WORDS)) return 'plate';
  if (hasAny(id, GEM_WORDS)) return 'gem';
  if (hasAny(id, ORB_WORDS)) return 'orb';
  if (hasAny(id, COIL_WORDS)) return 'coil';
  if (hasAny(id, PUFF_WORDS)) return 'puff';
  return 'chunk';
}

/** Convenience for the renderer, which holds dropped-item
 *  entities by item id. Unknown ids (a drop from a newer save
 *  than the table) fall back to the chunk, never to a crash. */
export function dropShapeForId(itemId: ItemId): DropShape {
  const item = ITEMS[itemId];
  return item ? dropShapeFor(item) : 'chunk';
}
