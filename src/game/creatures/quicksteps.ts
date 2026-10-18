// ============================================================================
// THE QUICKSTEPS' RULES — and THE WINDLUNG (Adam, 2026-10-17)
// ----------------------------------------------------------------------------
// The movement platform's pure rules live here, beside the
// shield family's (shields.ts) and the strikers' (weapons.ts).
//
// THE WINDLUNG is a breath grown into the Quicksteps: a
// three-tier ladder (each tier's recipe consumes the one
// below, the weapons pattern) that bends the whole stamina
// economy — every drain costs less, every recovery restores
// more. At tier 3 a sprint barely sips and a spent bar refills
// in under two seconds: "barely any drain, near-instant
// healing" (Adam).
//
// The factors apply at the points where stamina is actually
// spent or recovered: the game loop's continuous accounting
// (sprint, recovery, the braced drain, the scar's tax) and the
// one discrete payer (App's spendStamina, which weapon
// strikes and shield blocks both route through).
//
// Per the EQUIPMENT-STATE DOCTRINE the ladder is
// ownership-derived — the tier IS which rung you hold; there
// is no per-piece state to keep.
// ============================================================================

import type { ItemId } from '../../types/game';

/** The ladder's rungs, low to high. */
export const WINDLUNG_RUNGS: ItemId[] = ['windlung_sprig', 'windlung_bellows', 'windlung_heart'];

/** The stamina factors a tier applies. Tier 0 = no Windlung:
 *  the economy exactly as it was. */
export interface StaminaFactors {
  /** Multiplier on every stamina DRAIN (sprint, blocks,
   *  strikes, the braced tax, hazard taxes). */
  drain: number;
  /** Multiplier on every stamina RECOVERY (resting regen,
   *  warm-ground recovery). */
  regen: number;
}

export const WINDLUNG_FACTORS: StaminaFactors[] = [
  { drain: 1, regen: 1 },
  { drain: 0.7, regen: 1.8 },
  { drain: 0.45, regen: 2.8 },
  { drain: 0.18, regen: 4.5 },
];

/** A Quicksteps growth's worn answer (the movement build,
 *  2026-10-18): grown = owned, the same doctrine as the
 *  Windlung rungs below — the growth rides the platform by
 *  being in the pouch; there is no separate equip state,
 *  and no state is saved. The game loop reads these through
 *  its getter deps, so the answers stay local-player. */
export function emberSolesGrown(inventory: Partial<Record<ItemId, number>>): boolean {
  return (inventory['ember_soles'] ?? 0) > 0;
}

/** Waders: the Mirror Marsh's wading drag, answered. */
export function wadersGrown(inventory: Partial<Record<ItemId, number>>): boolean {
  return (inventory['waders'] ?? 0) > 0;
}

/** Webfoots: the swim becomes a stroke, not a struggle. */
export function webfootsGrown(inventory: Partial<Record<ItemId, number>>): boolean {
  return (inventory['webfoots'] ?? 0) > 0;
}

/** Stillsteps: step onto still water and it holds. */
export function stillstepsGrown(inventory: Partial<Record<ItemId, number>>): boolean {
  return (inventory['stillsteps'] ?? 0) > 0;
}

/**
 * THE WATER MODULE (Adam's consolidation ruling, 2026-10-18):
 * Webfoots and Stillsteps are ONE module with tiers, the way
 * he always pictured it — the second growth grows ON the
 * first (its recipe consumes the Webfoots). Tier 1 = the
 * stroke; tier 2 = the held step, tier 1 implied. Ownership
 * folds honestly: holding either piece today counts it —
 * stillsteps alone reads tier 2 (the growth contains the
 * base watercraft). At tier 2 the player carries a STANCE
 * (swim / walk the water, F in the water — the loop reads
 * it through its getters); the stance is a runtime posture,
 * never saved, like the shield's raise.
 */
export function waterModuleTier(inventory: Partial<Record<ItemId, number>>): 0 | 1 | 2 {
  if (stillstepsGrown(inventory)) return 2;
  if (webfootsGrown(inventory)) return 1;
  return 0;
}

/** Which rung the pouch holds (0 = none). The ladder consumes
 *  upward, so at most one rung is ever held; the highest wins
 *  regardless. */
export function windlungTierOf(inventory: Partial<Record<ItemId, number>>): number {
  for (let tier = WINDLUNG_RUNGS.length; tier >= 1; tier--) {
    if ((inventory[WINDLUNG_RUNGS[tier - 1]] ?? 0) > 0) return tier;
  }
  return 0;
}

/** The factors for a tier (tier 0 = unmodified economy). */
export function staminaFactors(tier: number): StaminaFactors {
  return WINDLUNG_FACTORS[Math.max(0, Math.min(WINDLUNG_FACTORS.length - 1, tier))];
}
