// ============================================================================
// planter.ts — the Planter's law, as pure rules (BioForge wave 2,
// slice 5, 2026-10-19; Adam's "plants as furniture").
// ============================================================================
// A placeable grown structure — a handsome grown pot that holds ONE
// planted flora as a living table piece. "A plant with an address."
//
// THE SHAPE OF THE RECORD (types/game.ts):
//   planter?: { species: FloraSpecies | null; plantedAt: number; growth: number }
// Per-piece state doctrine (Adam, 2026-10-17): the tenant lives in
// the planter's own record, never a hook-level map. Optional, so
// old saves load with it absent (read as empty). NO save-version
// change.
//
// THE CLOCKS:
// - plantedAt is SIM SECONDS (the world tick's clock — the same
//   clock the chime's lastWarnAt keeps). App never stamps it: a
//   fresh planting arrives with plantedAt 0, and the sim's planter
//   pass (hooks/useWorldEntities) stamps the first tick it sees,
//   so App never needs the sim clock.
// - growth (0..1) is the mesh and the modal's working value,
//   advanced by that same sim pass on LOADED-ZONE time (the house
//   time — vat gestation, the wall's bin). It is quantized to
//   PLANTER_GROWTH_STEPS so the pass writes at most that many
//   times per plant per maturation, not once per second.
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

/** A Sol-cycle of loaded-zone sim seconds — the planter's maturation. */
export const PLANTER_MATURATION_SECONDS = 500;

/** Growth is stored quantized to this many steps (writes are rare). */
export const PLANTER_GROWTH_STEPS = 24;

/**
 * The tenant's max visual scale vs. its wild size. A pot is not a
 * wild bed — the contained plant caps at less than half its wild
 * silhouette, whatever the species.
 */
export const PLANTER_POT_SCALE = 0.45;

/** The house dimming for a potted light: a pot is not a wild bed. */
export const PLANTER_LIGHT_SCALE = 0.6;

/** The planter's own record, as the sim and the panel read it. */
export interface PlanterState {
  species: FloraSpecies | null;
  plantedAt: number;
  growth: number;
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
  };
}

/**
 * The growth fraction 0..1 for a planting of the given age. Pure —
 * the sim tick feeds it (simNow - plantedAt) and stores the
 * quantized result; the mesh and the modal only ever read the
 * stored growth.
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
 * (see the module header for the glow_spore exclusion).
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
  return out;
}

/**
 * Plant a species into an empty planter record. plantedAt stays 0
 * — the sim's planter pass stamps the first tick it sees (App
 * never touches the sim clock). Idempotent: planting into an
 * occupied record is a no-op, never a clobber.
 */
export function applyPlant(state: PlanterState, species: FloraSpecies): PlanterState {
  if (state.species) return state;
  return { species, plantedAt: 0, growth: 0 };
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
