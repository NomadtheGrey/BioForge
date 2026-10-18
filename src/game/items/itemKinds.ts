/**
 * itemKinds — CATEGORY INGREDIENTS (P1, 2026-10-18).
 *
 * The game's raw-material bench is wide on purpose: every
 * species drops its own cap, petal, gel — 270+ items, most
 * with no sink. Merging them would flatten the world's
 * fingerprint; instead, recipes and the Mound SPEND BY KIND:
 * "any cap ×4" is a real ingredient, resolved here.
 *
 * THE ONE RESOLVER (the dev lane's watch): resolveKindSpend
 * is the only implementation. The forge's preview and the
 * craft itself both call it, so what the player sees spent
 * is what burns. Resolution is DETERMINISTIC: members are
 * spent in list order, so a plan never wobbles between the
 * preview and the write.
 *
 * MEMBER DISCIPLINE: a kind holds only items with no other
 * sink (verified against the recipe book when P1 landed —
 * the lab's kind-check re-proves it). When a member gains a
 * real recipe, it LEAVES its kind in the same landing (the
 * Windlung precedent: puff_down and whale_down left DOWN
 * when the boots began eating them; spire_down was never
 * in, the Plume Charm eats it).
 *
 * THE SPEND ORDER (the dev lane's pick-transparency watch,
 * a rule players will plan around): MOST ABUNDANT FIRST —
 * a kind burns your surplus and spares the rare single you
 * hold one of; ties fall to member-list order. The order is
 * stable for a given inventory, and the forge's preview
 * shows the exact items the craft will take before it
 * takes them, from this same function.
 */
import type { ItemId } from '../../types/game';

/** The kinds, by name — the vocabulary recipes speak. */
export type ItemKindId = 'cap' | 'gel' | 'wool' | 'down' | 'greenery';

export interface ItemKind {
  id: ItemKindId;
  /** Player-facing name for rows and toasts ("Any Cap"). */
  label: string;
  /** Member item ids, in spend order. */
  members: ItemId[];
}

const K = (id: string) => id as ItemId;

export const ITEM_KINDS: Record<ItemKindId, ItemKind> = {
  cap: {
    id: 'cap',
    label: 'Any Cap',
    members: [
      'ink_cap', 'stormcap', 'saltcap_heart', 'tomb_cap', 'glass_cap', 'door_cap',
      'static_cap', 'hearth_cap', 'bed_cap', 'scar_cap', 'strike_cap', 'dune_cap',
      'still_cap', 'canopy_cap', 'gloom_cap', 'row_cap', 'wild_cap', 'dust_cap',
      'marrow_cap', 'rib_cap', 'scald_cap', 'compost_cap', 'brine_cap', 'iron_cap',
      'hedge_cap', 'sun_cap', 'mist_cap', 'night_cap', 'dark_cap', 'husk_cap',
      'shell_cap', 'trail_cap', 'sweet_cap', 'rust_cap', 'greeting_cap', 'sump_cap',
      'steam_cap',
    ].map(K),
  },
  gel: {
    id: 'gel',
    label: 'Any Gel',
    // The three sample_*_jelly ids are NOT here: samples are
    // the vat's economy, never kind-matter.
    members: ['quiver_gel', 'gloom_gel', 'hush_gel', 'bog_jelly', 'salt_jelly', 'thaw_jelly', 'lake_jelly'].map(K),
  },
  wool: {
    id: 'wool',
    label: 'Any Wool',
    members: ['dusk_wool', 'lambswool', 'mother_wool'].map(K),
  },
  down: {
    id: 'down',
    label: 'Any Down',
    // puff_down / whale_down left when the Windlung ladder
    // began eating them; spire_down was never a member (the
    // Plume Charm eats it). What remains is honestly free.
    members: ['picker_down', 'fisher_down'].map(K),
  },
  greenery: {
    id: 'greenery',
    label: 'Any Greenery',
    members: [
      'listening_frond', 'ice_petal', 'glyph_leaf', 'vent_petal', 'glass_frond',
      'forge_petal', 'ember_leaf', 'frost_leaf', 'sage_leaf', 'silt_petal',
      'dust_petal', 'obsidian_petal', 'clock_petal', 'roadweed_leaf', 'gloam_frond',
      'scald_frond', 'mulch_petal',
    ].map(K),
  },
};

/** How much of a kind an inventory holds, across all members. */
export function kindHeld(inventory: Partial<Record<ItemId, number>>, kind: ItemKindId): number {
  return ITEM_KINDS[kind].members.reduce((sum, id) => sum + (inventory[id] ?? 0), 0);
}

/** One line of a resolved spend: this many of this exact item. */
export interface KindSpendLine {
  itemId: ItemId;
  count: number;
}

/**
 * THE RESOLVER. Plans spending `count` of `kind` out of
 * `inventory`. The plan is returned whole or not at all:
 * when the kind runs short, `satisfied` is false and the
 * plan holds only what COULD be taken — callers doing a
 * real craft must check `satisfied` and write nothing when
 * it fails (atomicity, the dev lane's watch: resolution
 * fully resolves before the single inventory write).
 * Spend order: most abundant member first, ties in list
 * order (see the header — surplus burns, singles are spared).
 */
export function resolveKindSpend(
  inventory: Partial<Record<ItemId, number>>,
  kind: ItemKindId,
  count: number,
): { lines: KindSpendLine[]; satisfied: boolean } {
  const lines: KindSpendLine[] = [];
  let remaining = count;
  // Candidates in spend order: held count descending, with
  // the member's list position as the stable tiebreak.
  const candidates = ITEM_KINDS[kind].members
    .map((member, index) => ({ member, index, held: inventory[member] ?? 0 }))
    .filter((c) => c.held > 0)
    .sort((a, b) => b.held - a.held || a.index - b.index);
  for (const c of candidates) {
    if (remaining <= 0) break;
    const take = Math.min(c.held, remaining);
    lines.push({ itemId: c.member, count: take });
    remaining -= take;
  }
  return { lines, satisfied: remaining <= 0 };
}

/**
 * The Mound's menu (P1): the kinds it eats, in the order it
 * eats them — caps first (its staple), then gels, then
 * greenery. Wool and down are not mound food: they are the
 * loom's future, not the compost's.
 */
export const MOUND_KINDS: ItemKindId[] = ['cap', 'gel', 'greenery'];

/** How much one feeding banks at most. */
export const MOUND_FEED_MAX = 12;
/** The harvest's price in banked stock, per compost paid. */
export const MOUND_HARVEST_COST = 5;
