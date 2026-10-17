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
