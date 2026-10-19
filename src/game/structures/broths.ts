/**
 * Vat broths — the Culture Vat's second ingredient (Adam, 2026-10-19,
 * wave 2, slice 2; the creatures lane co-designed the bias table).
 *
 * A broth is one gel, loaded into the vat before or during a gestation.
 * It ferments beside the growing creature — and this is the law Adam
 * pinned: NO FIRE anywhere in copy or mechanic. The broth warms
 * ITSELF as it ferments, by the compost principle (a steaming mound is
 * the image). The warmth IS the strength of its bias: a cold broth
 * whispers; a ripe broth decides.
 *
 * WHAT A BROTH CAN DO — the certified axes (creatures chair). At hatch
 * the sample's species, imprint, and name are FIXED; what exists to
 * stamp is:
 *   VIGOR     — the health/maxHealth stamp ×. Real today.
 *   QUICKNESS — the speed stamp ×. Real today.
 *   GENTLENESS— a disposition stamped on the hatchling, consumed by the
 *               wild hunt when RELEASED: a broth-gentle hunter behaves
 *               provokedOnly back in the wild. For a follower it is
 *               invisible BY DESIGN — stamping it without the consumer
 *               would be fake, so the consumer shipped in the same
 *               landing (useWorldEntities, beside the provokedOnly read).
 *   SHED      — a cadence multiplier on the def's shed intervals,
 *               stamped on the entity and read by the shed sweep.
 *   SWIFT     — bog_jelly's gift is to the VAT, not the creature: the
 *               gestation paces faster as the broth warms (a setting
 *               agent, setting).
 *
 * FAKE — never wired (creatures chair's truth): species change;
 * flight/swim grants; size; and 'pond-true' as an affinity. On land
 * fauna pond-true would be a no-op for the OPPOSITE of the obvious
 * reason: land animals swim fine already — the sim models no water
 * behavior for land fauna at all (no drag, no hesitation; a land
 * follower crosses a pond by walking its bed), so there is NOTHING
 * TO TEACH — the competence is already universal. The fake
 * direction is the reverse: promising a pond creature land-ease
 * (the fish-walking problem). If fauna ever gain the player's wading
 * drag, pond-true gains a real consumer and should be re-certified
 * then. The design list's salt→pond-true is DISSOLVED: salt's truth
 * is brine = preservation = VIGOR, on its own merits. GENTLE for a tamed companion has no seam —
 * it is recorded as designed-but-unwired, and the panel says so
 * honestly rather than pretending.
 *
 * NOTHING here keeps state. Fermentation time rides the vat's own
 * record (vat.broth.fermented, seconds of loaded-zone time,
 * advanced in the world tick); biases are pure functions of the
 * broth + its warmth, computed once at hatch. The broth is DRUNK by
 * the hatch (consumed at hatch — say so in copy). A removed broth is
 * poured out, warmth and all — the unload returns the gel, not the
 * culture.
 */

import type { FaunaSpecies, ItemId } from '../../types/game';
import { ITEM_KINDS } from '../items/itemKinds';

/** Every gel the broth slot accepts: exactly the GEL kind's membership. */
export const BROTH_GELS: ItemId[] = ITEM_KINDS.gel.members;

export function isBrothGel(id: ItemId): boolean {
  return BROTH_GELS.includes(id);
}

/**
 * Fermentation time to full ripeness, in seconds of loaded-zone time.
 * A strange gestation is 500; a broth loaded with the sample is
 * warm at the end and ripe if it started a little early. Loading the
 * broth into an empty vat and letting it think is the gardener's
 * move — it keeps fermenting between gestations.
 */
export const BROTH_RIPE_SECONDS = 300;

/**
 * Warmth: the broth's strength, 0 (just poured, cold and asleep) to
 * 1 (ripe). Monotonic, plateaus — warmth is never more than full.
 */
export function brothWarmth(fermentedSeconds: number): number {
  if (fermentedSeconds <= 0) return 0;
  return Math.min(1, fermentedSeconds / BROTH_RIPE_SECONDS);
}

/** Fermentation stages, in the game's voice. */
export type BrothStage = 'cold' | 'waking' | 'warm' | 'ripe';

export const BROTH_STAGE_COPY: Record<BrothStage, { label: string; line: string }> = {
  cold: {
    label: 'Cold',
    line: 'Asleep — slick, inert, cold as a pond stone.',
  },
  waking: {
    label: 'Waking',
    line: 'The surface pearls with bubbles. Something is stirring down there.',
  },
  warm: {
    label: 'Warm',
    line: 'Warm to the wrist, breathing slow. The vat smells faintly of bread.',
  },
  ripe: {
    label: 'Ripe',
    line: 'Ripe — thick, busy, and warm all the way through. It smells of pond and fresh bread.',
  },
};

export function brothStageOf(warmth: number): BrothStage {
  if (warmth < 0.15) return 'cold';
  if (warmth < 0.45) return 'waking';
  if (warmth < 0.8) return 'warm';
  return 'ripe';
}

/**
 * Gel-material fauna (creatures chair's KINSHIP law): species made of
 * the medium take any broth at FULL strength — for them the broth is
 * never foreign. The set is CERTIFIED, from the design record — not
 * derived by name: a name regex caught only the three jellies and
 * missed four, including the hush gel's own source animal. A future
 * species joins this set in the same landing that builds it
 * (deep_maw is the named next candidate — NOT yet, do not add it).
 */
const GEL_MATERIAL_SPECIES: ReadonlySet<FaunaSpecies> = new Set([
  'gloom_skitter',
  'spore_husk',
  'gloom_slug',
  'hush_hound',
  'sky_jelly',
  'mirror_jelly',
  'brine_jelly',
]);

export function isGelMaterial(species: FaunaSpecies): boolean {
  return GEL_MATERIAL_SPECIES.has(species);
}

/**
 * Gentleness is binary and gated: only a RIPE broth stamps it.
 * A half-warmed broth does not make a gentle hunter — the culture
 * has to be all the way in, or it is not in at all.
 */
export const GENTLENESS_RIPE_WARMTH = 0.8;

export interface BrothBias {
  /** Health/maxHealth multiplier at hatch. */
  vigorMul: number;
  /** Speed multiplier at hatch. */
  quicknessMul: number;
  /** Shed-interval multiplier (1 = the def's own cadence). */
  shedCadenceMul: number;
  /** Stamps brothGentle on the hatchling (see GENTLENESS above). */
  gentle: boolean;
  /** The vat-side gift: this gel sets the culture, it does not feed
   *  the creature. Consumed as a pace rate by the world tick. */
  swift: boolean;
}

/**
 * The certified bias table (creatures chair's magnitudes, warmth
 * scaled): cold ≈ nothing, ripe = full. Linear in warmth — a
 * half-warm broth gives half its strength, honestly.
 */
export function brothBias(
  species: FaunaSpecies,
  gelId: ItemId,
  fermentedSeconds: number,
): BrothBias {
  // Kinship: gel-material fauna take the full strength always.
  const w = isGelMaterial(species) ? 1 : brothWarmth(fermentedSeconds);
  const base: BrothBias = {
    vigorMul: 1,
    quicknessMul: 1,
    shedCadenceMul: 1,
    gentle: false,
    swift: false,
  };
  switch (gelId) {
    case 'salt_jelly':
      // Brine = preservation: the preserved thing comes through stronger.
      base.vigorMul = 1 + 0.3 * w;
      break;
    case 'thaw_jelly':
      // The melt's edge, refreshment: quick feet.
      base.quicknessMul = 1 + 0.15 * w;
      break;
    case 'quiver_gel':
      // Trembling, spore-live: the quickest thing the table offers.
      base.quicknessMul = 1 + 0.3 * w;
      break;
    case 'gloom_gel':
      // The slug's slime, gathered where it crawled: what it sheds,
      // it sheds sooner and more often.
      base.shedCadenceMul = 1 - 0.4 * w;
      break;
    case 'lake_jelly':
      // The deep ponds' own gel: gentleness, binary, ripe only.
      base.gentle = w >= GENTLENESS_RIPE_WARMTH;
      break;
    case 'hush_gel':
      // The quiet valley: gentleness, binary, ripe only.
      base.gentle = w >= GENTLENESS_RIPE_WARMTH;
      break;
    case 'bog_jelly':
      // The wet country's setting agent: its gift is to the vat.
      base.swift = true;
      break;
  }
  return base;
}

/**
 * bog_jelly's pace: the gestation's clock runs faster as the broth
 * warms. At a ripe broth the pace is 1.43 — the truth chair's
 * ×0.7 approached, never exceeded; a cold bog broth sets no faster
 * than plain culture. Read by the world tick where gestating
 * progress advances (useWorldEntities, beside the vat clock).
 */
export function brothPaceMul(warmth: number): number {
  return 1 + 0.43 * warmth;
}

/** What the broth slot promises, per gel — the panel's honest line. */
export const BROTH_PROMISE: Record<string, string> = {
  salt_jelly: 'A stronger hatchling — brine preserves, and the preserved come through hardier.',
  thaw_jelly: 'A quicker hatchling — the melt\'s refreshment in its feet.',
  quiver_gel: 'The quickest feet the table offers — the gel trembles, and so will the young.',
  gloom_gel: 'A freer shedder — what it sheds, it sheds sooner. (Only for creatures that shed.)',
  lake_jelly: 'A gentle hunter — IF it is a hunter, and IF the broth is ripe when it hatches. Released, it will not start what no one started.',
  hush_gel: 'A gentle hunter — IF it is a hunter, and IF the broth is ripe when it hatches. The quiet valley, in a young.',
  bog_jelly: 'A faster vat — the broth is a setting agent; the culture sets sooner as it warms.',
};
