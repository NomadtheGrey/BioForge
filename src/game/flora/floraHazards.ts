/**
 * FLORA HAZARDS (ghost slice G3, 2026-10-19) — the mechanism the
 * `hazardous` flag always promised and never had.
 *
 * Until this slice, FloraDef.hazardous / FloraEntity.isHazardous
 * were stamped at dealing and read by NOTHING: the Snap-Trap's
 * codex said "the jaws are real," and no jaw anywhere closed.
 * Adam's ruling on exactly this class of gap (2026-10-19, the
 * codex's unwired promises): expand over cut — WIRE the promise.
 * So: hazardous flora with a spec here actually threaten the
 * player, through a readable tell, on the house rules — the
 * danger doctrine (every danger has a readable tell; Peaceful =
 * warnings and theater only; damage under the armed floor).
 *
 * THE SHAPE: each hazardous species gets a spec — the radius of
 * its reach, the WIND-UP (the tell: tendrils tense, jaws lift —
 * step out and it never fires), the bite and its cooldown, and
 * whether it CONSTRICTS (holds the ankle: the movement snare
 * the game loop already knows how to apply). The per-plant
 * state machine is a pure step function so the sim's flora pass
 * stays a thin adapter and the logic is testable off-hook.
 *
 * WHO IS ARMED, AND WHO IS NOT:
 * - mouth_vine — the constrictor. Its door is the pacify: fed
 *   Sweet Nectar (the lure, in useToolInteractions), it goes
 *   slack for a minute and never starts a wind-up.
 * - snap_trap — the biter. No constriction, no pacify: it is a
 *   bloom, and it bites; care and distance are its doors (and
 *   its seed + scale forge the sentry that guards others).
 * - gulp_lily — deliberately ABSENT. Its pad grabs small FAUNA
 *   stepping to drink, not the delver; its codex already tells
 *   that truth ("a hazard, not a crop" — endured, not picked).
 *   Arming it against the player would make its text false.
 */
import type { FloraSpecies } from '../../types/game';

export interface FloraHazardSpec {
  /** Meters from the plant's heart where its reach begins. */
  radius: number;
  /** Seconds of visible tell before the snap lands. Stepping
   *  out of reach during the wind-up cancels it, cleanly. */
  windup: number;
  /** Damage per landed bite (armed worlds only). */
  bite: number;
  /** Seconds between bites while the player stays in reach. */
  biteCooldown: number;
  /** True = the plant holds the ankle while snapped (the loop's
   *  snare factor), not merely bites and lets go. */
  constrict: boolean;
}

export const FLORA_HAZARD_SPECS: Partial<Record<FloraSpecies, FloraHazardSpec>> = {
  mouth_vine: { radius: 2.2, windup: 0.8, bite: 8, biteCooldown: 2.5, constrict: true },
  snap_trap: { radius: 1.6, windup: 0.5, bite: 10, biteCooldown: 3, constrict: false },
};

/** The events one plant can raise in a tick. 'warn' fires once
 *  per wind-up (the tell); 'snare' heartbeats while a constrictor
 *  holds (the loop keeps the deadline fresh); 'bite' lands damage. */
export type FloraHazardEvent = 'warn' | 'bite' | 'snare';

export interface FloraHazardState {
  /** Seconds of wind-up accumulated toward the snap. */
  windup: number;
  /** Seconds until the next bite may land. */
  cooldown: number;
}

export const FLORA_HAZARD_REST: FloraHazardState = { windup: 0, cooldown: 0 };

export interface FloraHazardStep {
  state: FloraHazardState;
  events: FloraHazardEvent[];
}

/**
 * One plant, one tick. Pure: the caller owns the clock and the
 * consequences. Rules, in order:
 * - A pacified plant (mouth_vine fed) rests, whatever the range.
 * - Out of reach: any wind-up bleeds off instantly (the tell is
 *   honest — leaving is always a full answer); cooldown ticks.
 * - In reach: the wind-up climbs; crossing the spec's wind-up
 *   with time to spare fires 'warn' exactly once (at the start).
 *   Once wound, the plant is SNAPPED: a constrictor heartbeats
 *   'snare', and bites land on the cooldown — armed worlds only.
 *   (On Peaceful the sim passes armed=false: the wind-up and the
 *   warning still happen — theater — but no snare, no bite.)
 */
export function stepFloraHazard(
  state: FloraHazardState,
  spec: FloraHazardSpec,
  input: { dt: number; dist: number; pacified: boolean; armed: boolean }
): FloraHazardStep {
  const cooldown = Math.max(0, state.cooldown - input.dt);
  if (input.pacified || input.dist > spec.radius) {
    return { state: { windup: 0, cooldown }, events: [] };
  }
  const events: FloraHazardEvent[] = [];
  let windup = state.windup + input.dt;
  if (state.windup === 0) events.push('warn');
  if (windup >= spec.windup) {
    windup = spec.windup;
    if (input.armed) {
      if (spec.constrict) events.push('snare');
      if (cooldown <= 0) {
        events.push('bite');
        return { state: { windup, cooldown: spec.biteCooldown }, events };
      }
    }
  }
  return { state: { windup, cooldown }, events };
}
