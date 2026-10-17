/**
 * THE STRIKERS — BioForge's grown weapons (Adam, 2026-10-16).
 *
 * The doctrine, in Adam's words across the morning: one weapon per
 * craft tier, one ranged and one up close; all of them grown, never
 * machined (this is a biological planet); all of them seated on the
 * gauntlet in ONE seventh tool slot — the slot draws a single
 * weapon at a time, and the 7 key / mouse wheel swaps the draw
 * between the player's best owned close weapon and best owned
 * ranged weapon. A better tier is an UPGRADE, not a sibling: the
 * Tier-2 craft consumes the Tier-1 weapon of the same kind (see
 * the recipes in constants.ts), so a player only ever holds one
 * close striker and one ranged striker. Weapon-specific upgrade
 * paths beyond the tiers are deliberately NOT here — Adam parked
 * those for later.
 *
 * Harm doctrine carries over from the solvent ruling: companions
 * are never valid targets, and on Peaceful nothing here can hurt
 * anything (the sim gates strikes on the same signal that arms
 * hunter bites). A kill by any route drops the creature's SAMPLE —
 * the culture vat's remains rule — via the shared death sweep in
 * hooks/useWorldEntities.ts.
 *
 * This module is the RULES TABLE only. Behavior (strike plumbing,
 * projectile flight, flinch) lives in hooks/useWorldEntities.ts;
 * input (slot, toggle, clicks) in hooks/useToolInteractions.ts and
 * hooks/useGameInput.ts; the first-person models in
 * game/engine/viewmodel.ts.
 */

import type { ItemId } from '../../types/game';

/** Close = in-hand striker. Ranged = fired striker. */
export type WeaponKind = 'close' | 'ranged';

export interface WeaponDef {
  /** The item (crafted, maxStack 1, one-time gauntlet upgrade). */
  itemId: ItemId;
  kind: WeaponKind;
  /**
   * Craft tier: 1, 2 or 3. For display and best-owned derivation
   * only — the forge's real tier still derives from the recipe
   * graph (a Tier-2 recipe consumes the Tier-1 weapon, so the
   * graph agrees with this column by construction).
   */
  tier: 1 | 2 | 3;
  /** Damage dealt by one landed strike. */
  damage: number;
  /** Seconds before the same hand may strike again. */
  cooldownSeconds: number;
  /** Stamina spent per strike (paid even on a whiff). */
  staminaCost: number;
  /** CLOSE only: striking reach in meters — a step beyond the
   *  hunter bite ranges (1.6-2.0), so a timely hit beats the bite. */
  reach?: number;
  /** CLOSE only: seconds of stagger the hit inflicts (no movement,
   *  no bites). The flinch is the melee's real job; damage second. */
  flinchSeconds?: number;
  /** RANGED only: the shot's travel speed, meters per second. The
   *  shot is aimed at where the target STOOD when fired — a target
   *  that has moved ~2m by arrival is missed cleanly. */
  projectileSpeed?: number;
  /** RANGED only: burst radius in meters. When the shot arrives,
   *  every wild creature inside the radius of the arrival point is
   *  struck (the Spore Puffer's bursting ball). Omitted = the shot
   *  strikes only its named target, and only if it lingered. */
  burstRadius?: number;
}

/**
 * The ladder. Damage tuning, against the wild health ranges the
 * world actually deals (common country 30-60, stalker country
 * ~120, the biggest hunters 200+):
 *  - Tier 1 answers COMMON country: a mouse falls in two Barb
 *    hits; a stalker takes seven — possible, not sensible.
 *  - Tier 2 answers WILD country: stalkers in four Fang hits.
 *  - Tier 3 answers STRANGE country: the big hunters in four
 *    Sting hits, and the Lance out-damages everything at range.
 * Ranged trades damage for distance and certainty for travel
 * time — a shot can miss a moving target outright.
 */
export const WEAPONS: WeaponDef[] = [
  {
    itemId: 'briar_barb',
    kind: 'close',
    tier: 1,
    damage: 18,
    cooldownSeconds: 0.45,
    staminaCost: 8,
    reach: 2.4,
    flinchSeconds: 0.35,
  },
  {
    itemId: 'spit_pod',
    kind: 'ranged',
    tier: 1,
    damage: 12,
    cooldownSeconds: 0.9,
    staminaCost: 6,
    projectileSpeed: 16,
  },
  {
    itemId: 'chitin_fang',
    kind: 'close',
    tier: 2,
    damage: 34,
    cooldownSeconds: 0.5,
    staminaCost: 9,
    reach: 2.4,
    flinchSeconds: 0.4,
  },
  {
    itemId: 'spore_puffer',
    kind: 'ranged',
    tier: 2,
    damage: 24,
    cooldownSeconds: 1.1,
    staminaCost: 8,
    projectileSpeed: 15,
    burstRadius: 1.8,
  },
  {
    itemId: 'glass_sting',
    kind: 'close',
    tier: 3,
    damage: 55,
    cooldownSeconds: 0.55,
    staminaCost: 10,
    reach: 2.5,
    flinchSeconds: 0.45,
  },
  {
    itemId: 'storm_lance',
    kind: 'ranged',
    tier: 3,
    damage: 44,
    cooldownSeconds: 1.3,
    staminaCost: 10,
    projectileSpeed: 26,
  },
];

/** Every striker item id, in ladder order. */
export const WEAPON_ITEM_IDS: ItemId[] = WEAPONS.map((w) => w.itemId);

/** True when the item is one of the six strikers. */
export function isWeaponItem(id: ItemId): boolean {
  return WEAPON_ITEM_IDS.includes(id);
}

/** The rules row for a striker item, if it is one. */
export function weaponOf(itemId: ItemId): WeaponDef | undefined {
  return WEAPONS.find((w) => w.itemId === itemId);
}

/**
 * The best striker of `kind` the pouch actually holds — highest
 * tier wins. The drawn-weapon derivation: because higher tiers
 * CONSUME the lower weapon in their craft, a pouch can hold at
 * most one weapon per kind in practice; this stays correct even
 * for grandfathered pouches that somehow hold two.
 */
export function bestWeapon(
  inventory: Record<ItemId, number>,
  kind: WeaponKind,
): WeaponDef | undefined {
  let best: WeaponDef | undefined;
  for (const w of WEAPONS) {
    if (w.kind !== kind) continue;
    if ((inventory[w.itemId] ?? 0) <= 0) continue;
    if (!best || w.tier > best.tier) best = w;
  }
  return best;
}

/** True when the pouch holds any striker at all (slot unlock). */
export function anyWeaponOwned(inventory: Record<ItemId, number>): boolean {
  return WEAPON_ITEM_IDS.some((id) => (inventory[id] ?? 0) > 0);
}
