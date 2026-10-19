// ============================================================================
// planter.ts — the Planter's law, as pure rules (BioForge wave 2,
// slice 5, 2026-10-19; Adam's "plants as furniture").
// ============================================================================
// A placeable grown structure — a handsome grown pot that holds ONE
// planted flora as a living table piece. "A plant with an address."
//
// THE SHAPE OF THE RECORD (types/game.ts):
//   planter?: { species: FloraSpecies | null; plantedAt: number; growth: number; anchorMs?: number }
// Per-piece state doctrine (Adam, 2026-10-17): the tenant lives in
// the planter's own record, never a hook-level map. Optional, so
// old saves load with it absent (read as empty). NO save-version
// change.
//
// THE CLOCK (timestamp law, Adam 2026-10-19 gap fix — 'A tick
// timer is a promise the zone must stay loaded to keep; a
// timestamp is a promise the world keeps on its own.'): growth is
// the BASE banked at anchorMs (wall clock — the save's
// createdAt/savedAt basis, the sky calendar's day count); the
// EFFECTIVE growth is pure (planterGrowthEffective), computed
// wherever it is read, re-anchored wherever the tenant is
// disturbed. No standing timer: an unloaded pot grows on, lazily
// caught up. plantedAt is legacy (sim seconds from the tick era) —
// kept so old records still parse, ignored by every reader.
//
// MATURATION: no species growth-duration constant exists anywhere
// in the flora tables (checked 2026-10-19 — wild flora carry a
// static growthStage, set at worldgen and never advanced), so the
// planter uses one honest house curve for every species. Two
// literal game-hours would be ~42 loaded-zone seconds (a Sol-cycle
// is 500 of them) — absurdly fast, a plant that matures while you
// blink. The planter matures over one full Sol-cycle instead:
// plant at dusk, wake to a grown plant. A pot is not a wild bed,
// so the tenant never reaches wild size (PLANTER_POT_SCALE).
//
// THE PICKER'S TRUTH: plantablePropagules lists DISTINCT propagule
// items held in the pouch where speciesForPropagule(item) is
// non-null. propagation.ts is the ONLY truth — seed species offer
// their seed item, piece species their piece; wild-only species
// (propagation null) can NEVER appear. The glow_spore stock is the
// one deliberate exclusion: it is the glow family's SHARED spore
// stock (two species, one item, resolved by where you stand), and
// a pot cannot stand in two places — speciesForPropagule returns
// null for it, so the picker honestly leaves it out.
//
// THE TAKE-BACK RULE (mirrors the field-dissolve rule):
// emptying the planter returns propaguleItemOf(species) x1 — seed
// species give back their seed, piece species their piece. The
// same rule guards the structure-dissolve seam: a dissolved
// planter returns its tenant's propagule FIRST, never vaporized.
// ============================================================================

import type { FloraSpecies, ItemId, StructureEntity } from '../../types/game';
import { FLORA_LIGHT_BASE } from './lightSpecs';
import { gestureForFlora, type LightGesture } from './lightGestures';
import { speciesForPropagule } from '../flora/propagation';
import { ITEMS } from '../items/constants';

/** A Sol-cycle of the world's own seconds — the planter's maturation. */
export const PLANTER_MATURATION_SECONDS = 500;

/**
 * Growth STEPS (legacy of the tick era, when the sim quantized
 * writes to bound re-renders). No standing timer writes anymore —
 * the timestamp law reads effective growth straight — so this is
 * kept only for readers that still import it, and new code should
 * prefer the continuous effective value.
 */
export const PLANTER_GROWTH_STEPS = 24;

/**
 * The tenant's max visual scale vs. its wild size. A pot is not a
 * wild bed — the contained plant caps at less than half its wild
 * silhouette, whatever the species.
 */
export const PLANTER_POT_SCALE = 0.45;

/** The house dimming for a potted light: a pot is not a wild bed. */
export const PLANTER_LIGHT_SCALE = 0.6;

/**
 * The planter's own record, as the sim and the panel read it.
 * growth is the BASE banked at anchorMs (wall clock — the
 * timestamp law); plantedAt is legacy from the tick era (sim
 * seconds), kept so old records still parse, ignored by readers.
 */
export interface PlanterState {
  species: FloraSpecies | null;
  plantedAt: number;
  growth: number;
  anchorMs?: number;
}

/**
 * Read the planter's record off any structure entity. Absent (old
 * saves, or a planter that predates the field) reads as empty —
 * the birth spread in useToolInteractions stamps the real thing.
 */
export function readPlanter(entity: StructureEntity): PlanterState {
  return {
    species: entity.planter?.species ?? null,
    plantedAt: entity.planter?.plantedAt ?? 0,
    growth: entity.planter?.growth ?? 0,
    anchorMs: entity.planter?.anchorMs,
  };
}

/**
 * TIMESTAMPS, NOT TICKERS (Adam, 2026-10-19 gap fix; the dev
 * chair's phrasing, worth keeping: 'A tick timer is a promise the
 * zone must stay loaded to keep; a timestamp is a promise the
 * world keeps on its own.'). The tenant's EFFECTIVE growth at a
 * wall-clock moment: base banked at the anchor, plus the honest
 * elapsed over the maturation span. Same curve the tick drew
 * (planterGrowth01, linear to full) — only the clock changed, from
 * the zone's loaded seconds to the world's own time (the save's
 * createdAt/savedAt basis, the sky calendar's day count). No
 * standing timer: an unloaded pot grows on, lazily caught up.
 * A pre-gap-fix tenant has no anchor — the first read banks NOW
 * with its carried growth: no jump, no loss. Pure — lab-tested.
 */
export function planterGrowthEffective(
  p: { growth: number; anchorMs?: number },
  nowMs: number,
): number {
  const anchor = p.anchorMs ?? nowMs;
  const elapsed = Math.max(0, (nowMs - anchor) / 1000);
  return Math.min(1, p.growth + elapsed / PLANTER_MATURATION_SECONDS);
}

/**
 * Re-anchor a planter: the effective growth becomes the new base,
 * banked NOW. Call it wherever the tenant is disturbed (plant,
 * take-back writes its own empty record). Every other read is
 * pure-effective and writes nothing.
 */
export function touchPlanterGrowth<T extends PlanterState>(p: T, nowMs: number): T {
  return { ...p, growth: planterGrowthEffective(p, nowMs), anchorMs: nowMs };
}

/**
 * The growth fraction 0..1 for a planting of the given age. Pure —
 * kept as the curve's one definition (linear to full over the
 * maturation span); the timestamp law (planterGrowthEffective)
 * is what readers call now.
 */
export function planterGrowth01(plantedAt: number, nowSimSeconds: number): number {
  const age = Math.max(0, nowSimSeconds - plantedAt);
  return Math.min(1, age / PLANTER_MATURATION_SECONDS);
}

/** The visual scale of the tenant at a stored growth value. */
export function planterTenantScale(growth: number): number {
  const g = Math.min(1, Math.max(0, growth));
  // A seedling is a nub (0.3 of pot scale), a mature tenant fills
  // the pot but never outgrows it.
  return PLANTER_POT_SCALE * (0.3 + 0.7 * g);
}

/** Plain-words growth bands for the panel. */
export function planterGrowthLabel(growth: number): string {
  if (growth <= 0) return 'A seedling, all promise';
  if (growth < 0.34) return 'Young, reaching';
  if (growth < 0.67) return 'Growing well';
  if (growth < 1) return 'Nearly settled';
  return 'Full and settled';
}

/**
 * The picker's list: DISTINCT propagule items held in the pouch
 * that name a species. propagation.ts is the only truth consulted
 * (see the module header for the glow_spore exclusion). Sorted by
 * item display name (stable alphabetical) — the picker's canonical
 * order, data-side, so every consumer of the law lists the same
 * way regardless of pouch order (UI sorting audit, 2026-10-19).
 */
export function plantablePropagules(inventory: Record<ItemId, number>): ItemId[] {
  const seen = new Set<ItemId>();
  const out: ItemId[] = [];
  for (const [itemId, count] of Object.entries(inventory) as [ItemId, number][]) {
    if ((count ?? 0) <= 0) continue;
    if (seen.has(itemId)) continue;
    if (speciesForPropagule(itemId) === null) continue;
    seen.add(itemId);
    out.push(itemId);
  }
  out.sort((a, b) => {
    const na = ITEMS[a]?.name ?? a;
    const nb = ITEMS[b]?.name ?? b;
    return na.localeCompare(nb);
  });
  return out;
}

/**
 * Plant a species into an empty planter record. The tenant is
 * born anchored NOW (wall clock) at growth 0 — no tick needs to
 * stamp it; the timestamp law carries it from here. Idempotent:
 * planting into an occupied record is a no-op, never a clobber.
 */
export function applyPlant(state: PlanterState, species: FloraSpecies): PlanterState {
  if (state.species) return state;
  return { species, plantedAt: 0, growth: 0, anchorMs: Date.now() };
}

/**
 * Empty the planter. The CALLER returns propaguleItemOf(species)
 * to the pouch (the take-back rule) — this only clears the
 * record. Idempotent: emptying an empty planter is a no-op.
 */
export function applyTake(state: PlanterState): PlanterState {
  if (!state.species) return state;
  return { species: null, plantedAt: 0, growth: 0 };
}

/** The light a planted tenant sheds — the engine's special-case reads this. */
export interface PlanterLight {
  color: number;
  intensity: number;
  distance: number;
  y: number;
  gesture: LightGesture;
}

/**
 * The planter's light law (BioForge wave 2, slice 5): a planted
 * planter sheds its tenant's own flora light, dimmed for the pot
 * (PLANTER_LIGHT_SCALE — a pot is not a wild bed), with the
 * species' own gesture from Part A. Lantern ferns are excluded
 * from FLORA_LIGHT_BASE (their light is growth-dynamic in the
 * engine), so they take the explicit branch: the door fern's own
 * color at the house scale (a mature wild fern peaks near 30/20;
 * x0.6 = 18/12), swaying like the wild one.
 */
export function planterLightOf(species: FloraSpecies): PlanterLight {
  if (species === 'lantern_fern') {
    return { color: 0x06b6d4, intensity: 18, distance: 12, y: 1.2, gesture: 'sway' };
  }
  const b = FLORA_LIGHT_BASE[species];
  return {
    color: b.color,
    intensity: b.intensity * PLANTER_LIGHT_SCALE,
    distance: b.distance * PLANTER_LIGHT_SCALE,
    y: b.y,
    gesture: gestureForFlora(species, b.gesture),
  };
}
