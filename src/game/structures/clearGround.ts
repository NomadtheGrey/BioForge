/**
 * Clear-ground placement (Adam, 2026-10-19 — the ruin-exit trap).
 *
 * THE TRAP THIS PREVENTS: the ruin exit anchor was dealt 2 m out
 * from the ruin landmark's anchor, but a medium/grand landmark's
 * collision disc reaches 2.52 m (2.1 disc + 0.42 player radius) —
 * so the exit WROTE the player 0.5 m INSIDE solid stone. The
 * movement resolver has no ejector: inside a disc, the full step,
 * the X slide, and the Z slide all collide, so it returns the
 * current position, and the controller zeroes the velocity on top.
 * A placed-inside player can never walk out. Permanently stuck,
 * on a live save, with no escape hatch — that is what happened.
 *
 * THE LAW: never WRITE a player position the resolver would refuse
 * to let them stand on. Every placement — instance exits, the
 * pause-menu rescue, any future spawn — comes through here first.
 * If the natural spot is blocked, the search spirals outward for
 * the nearest clear spot; if the whole neighborhood is boxed in,
 * it returns null and the CALLER picks the fallback (the rescue
 * falls back to the spawn Heart Tile; an instance exit keeps its
 * own doorstep logic). The helper never teleports across the map
 * on its own — that decision belongs to the caller, in the open.
 *
 * Flora never blocks (Adam's ruling, 2026-10-18 — walk-through),
 * so only structure collision is asked. Cavern grids are not asked:
 * this is the surface placement path.
 */
import { isPositionBlocked, isCollidingWithCavernWalls, type CavernGridRef } from '../engine/collision';
import type { StructureEntity } from '../../types/game';

/** The world edge, mirroring the resolver's clamp (collision.ts). */
const WORLD_BOUNDARY = 48.0;

export interface ClearGroundOptions {
  /** Radius of the first search ring, in meters. Default = ringStep.
   *  The Stuck rescue starts at 3: a rescue is a confident relocation
   *  a few meters out, not a nudge to the stone's edge. */
  firstRing?: number;
  /** Skip the identity check (is the target itself clear?). The Stuck
   *  button always relocates — even a technically-clear spot gets a
   *  fresh few meters, because the player pressed it meaning stuck. */
  skipIdentity?: boolean;
  /** How far out the search spirals, in meters. Default 12. */
  maxRadius?: number;
  /** Ring spacing in meters. Default 1. */
  ringStep?: number;
  /** Sample points per ring, in fixed angle order (0, 30°, 60°…
   *  from +X). Fixed order = deterministic: the same input always
   *  yields the same escape spot. Default 12. */
  anglesPerRing?: number;
  /** Extra per-candidate veto beyond collision — the caller's
   *  terrain sense (lava, deep water). True = reject the point. */
  isHazard?: (x: number, z: number) => boolean;
  /** Instance rock: inside a cave/ruin the search must also refuse
   *  wall cells, or the rescue trades a stone disc for a rock wall. */
  cavern?: CavernGridRef | null;
}

function candidateOk(
  x: number,
  z: number,
  structures: StructureEntity[],
  playerLevel: number,
  opts: Required<Pick<ClearGroundOptions, 'isHazard'>> & { cavern?: CavernGridRef | null }
): boolean {
  if (isPositionBlocked(x, z, structures, playerLevel)) return false;
  if (opts.cavern && isCollidingWithCavernWalls(x, z, opts.cavern)) return false;
  if (opts.isHazard && opts.isHazard(x, z)) return false;
  return true;
}

/**
 * The nearest standable point to (x, z), or null when the whole
 * neighborhood is boxed in. The target itself is returned unchanged
 * when it is already clear — the common case costs one check.
 * The search is bounded (rings × angles), so it always terminates.
 */
export function findClearGround(
  x: number,
  z: number,
  structures: StructureEntity[],
  playerLevel: number = 0,
  opts: ClearGroundOptions = {}
): { x: number; z: number } | null {
  const ringStep = opts.ringStep ?? 1;
  const maxRadius = opts.maxRadius ?? 12;
  const firstRing = opts.firstRing ?? ringStep;
  const anglesPerRing = opts.anglesPerRing ?? 12;
  const isHazard = opts.isHazard;
  const cavern = opts.cavern ?? null;

  const clamped = {
    x: Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, x)),
    z: Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, z)),
  };
  const ok = (cx: number, cz: number) =>
    candidateOk(cx, cz, structures, playerLevel, { isHazard: isHazard ?? (() => false), cavern });
  // The common placement case: the natural spot is already clear,
  // and the cheapest correct answer is to keep it.
  if (!opts.skipIdentity && ok(clamped.x, clamped.z)) {
    return clamped;
  }
  for (let r = Math.max(firstRing, ringStep); r <= maxRadius + 1e-9; r += ringStep) {
    for (let a = 0; a < anglesPerRing; a++) {
      const theta = (a / anglesPerRing) * Math.PI * 2;
      const cx = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, clamped.x + Math.cos(theta) * r));
      const cz = Math.max(-WORLD_BOUNDARY, Math.min(WORLD_BOUNDARY, clamped.z + Math.sin(theta) * r));
      if (ok(cx, cz)) {
        return { x: cx, z: cz };
      }
    }
  }
  // Boxed in: the caller owns the fallback (Heart Tile, doorstep,
  // whatever the moment honestly calls for) — never a blind jump.
  return null;
}
