// ============================================================================
// chimeWatch.ts — the Bone Chime Sentinel's detection law, as a pure rule
// ============================================================================
// BioForge wave 2, 2026-10-19 (Adam's camp-defense entry). The sentinel
// WARNS; it never fights. Its detection is deliberately simple and
// honest: a wild creature whose species carries a hunt profile, within
// CHIME_WARN_RADIUS of the chime, in the same zone — and the chime has
// been quiet for CHIME_WARN_COOLDOWN seconds.
//
// The pure rule lives here so the lab can hold it to its truth table
// (the hunt-profile + distance + cooldown + companion-exclusion law)
// without booting the sim. The sim's chime pass in
// hooks/useWorldEntities calls it once per tick-second and performs
// the warning (notification + sound) when it says yes.
// ============================================================================

import type { StructureEntity } from '../../types/game';

/** The chime's regard: a hunter inside this distance trips the straws. */
export const CHIME_WARN_RADIUS = 25;

/** After a warning, the chime is quiet for this long (sim seconds). */
export const CHIME_WARN_COOLDOWN = 60;

/** The notification text Adam settled on — a warning, not an alarm. */
export const CHIME_WARN_TITLE = 'The chime stirs — something hunts nearby.';
export const CHIME_WARN_BODY =
  'A Bone Chime Sentinel at your camp has caught the step of something with teeth. It warns — it never fights.';

/**
 * The pure detection rule. Inputs are already in the current zone's
 * local frame (fauna x/z and structure worldX/worldZ both live in it
 * — see the coordinate note in useWorldEntities' chime pass).
 */
export function shouldChimeWarn(args: {
  /** The chime's own position (structure worldX/worldZ). */
  chimeX: number;
  chimeZ: number;
  /** Sim seconds now (the tick's clock). */
  now: number;
  /** The chime's last warning, sim seconds (absent = never warned). */
  lastWarnAt?: number;
  /** Candidate intruders in the same zone. */
  fauna: { x: number; z: number; isTamed: boolean; hasHuntProfile: boolean }[];
}): boolean {
  // The cooldown: the chime speaks once, then holds its tongue.
  // An unwarned chime (undefined) reads as ready.
  const last = args.lastWarnAt ?? -Infinity;
  if (args.now - last < CHIME_WARN_COOLDOWN) return false;
  for (const f of args.fauna) {
    // Companions and the tamed never trip it — it watches for the
    // wild, not for friends.
    if (f.isTamed) continue;
    // Hunt PROFILE, not hunt state: the tripwire fires on the
    // species' teeth, whether or not the creature is chasing right
    // now. It trips in any difficulty — a tripwire, not a combat
    // system (the arming law is for bites, not for bells).
    if (!f.hasHuntProfile) continue;
    const dx = f.x - args.chimeX;
    const dz = f.z - args.chimeZ;
    if (dx * dx + dz * dz <= CHIME_WARN_RADIUS * CHIME_WARN_RADIUS) return true;
  }
  return false;
}

/** The chime's own record always reads the same way to callers. */
export function chimeLastWarnAt(entity: StructureEntity): number {
  return entity.chime?.lastWarnAt ?? -Infinity;
}
