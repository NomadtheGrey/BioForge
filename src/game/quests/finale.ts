/**
 * finale — THE DEPARTURE's spine (D1, 2026-10-17).
 *
 * The finale design (ReadMeFiles/THE_DEPARTURE.md): eleven
 * fates converge on one act — the departure — but the
 * METHOD depends on the fate. Adam sorted the fates into
 * four families by what they allow (section 3), and the
 * evening sitting pinned one way out per family (section
 * 7). This module is that sort as data: which family a
 * world's fate belongs to, and the road that family walks.
 *
 * D1 is the frame only — the finale quest, its gate, and
 * the family's name on the tracker. Each family's
 * set-piece (the portal repair, the visit and the Super
 * BioTunnel, the memorial and the Beanstalk, the scar)
 * lands as its own slice and writes the completion this
 * frame reads.
 */

import type { WorldFate } from '../world/ruins';

/** The four ways out, one per fate family. */
export type FinaleFamilyId = 'follow' | 'answer' | 'honor' | 'confront';

/**
 * The sort (THE_DEPARTURE.md §3, Adam 2026-10-17):
 * FOLLOW — they left, alive, and a road exists.
 * ANSWER — they never left; they are still here.
 * CONFRONT — what remains is a threat. A family of one.
 * HONOR — nobody to meet, follow, or fight.
 */
export const FATE_FAMILY: Record<WorldFate, FinaleFamilyId> = {
  gardeners: 'follow',
  long_experiment: 'follow',
  evacuation: 'follow',
  uplift: 'follow',
  departure: 'follow',
  becoming: 'answer',
  return_to_water: 'answer',
  taken_out: 'confront',
  crash: 'honor',
  war: 'honor',
  sickness: 'honor',
};

/** Which family's road a world's fate walks. */
export function finaleFamilyOf(fate: WorldFate): FinaleFamilyId {
  return FATE_FAMILY[fate];
}

/**
 * Each family's road, in the words the quest surfaces
 * carry (§7): the method, named plainly. `todo` is the
 * tracker's standing line until the departure is made;
 * the per-family set-pieces sharpen it as they land.
 */
export const FINALE_ROADS: Record<FinaleFamilyId, { name: string; todo: string }> = {
  follow: {
    name: 'Repair the Portal',
    todo: 'Find the station they left in the grand ruins, and make its ring whole.',
  },
  answer: {
    name: 'The Visit, and the Tunnel That Doesn’t Stop',
    todo: 'Go to them. Say goodbye. Grow the deep way down and through.',
  },
  honor: {
    name: 'The Beanstalk',
    todo: 'Raise the memorial. Plant the stalk, tend it, and climb.',
  },
  confront: {
    name: 'Through the Scar',
    todo: 'Find the scar they left in the deep rooms — and choose how you step through.',
  },
};
