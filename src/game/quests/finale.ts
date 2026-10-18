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

// ---------------------------------------------------------------------------
// FOLLOW — THE REPAIR BILL (D2, 2026-10-17)
// ---------------------------------------------------------------------------
// §7 prices the portal's repair in the design's own words:
// "prismatic cores to re-heart the ring, lodestone to
// re-aim it, living thread to rebind what time ate." The
// counts are the finale's weight (Adam proceeded on this
// shape, 2026-10-17): a real bill, not a second job.
// The bill is payable at ANY station ring, in any order —
// the stations are one network, and the repair is the
// player's project, so its state rides the quest signals.

import type { ItemId, QuestSignals } from '../../types/game';

export type PortalPartId = 'heart' | 'aim' | 'bind';

export interface PortalPart {
  id: PortalPartId;
  /** The repair's name, as the ring's story tells it. */
  name: string;
  itemId: ItemId;
  count: number;
}

export const PORTAL_BILL: PortalPart[] = [
  { id: 'heart', name: 'Re-heart the ring', itemId: 'prismatic_core', count: 2 },
  { id: 'aim', name: 'Re-aim the ring', itemId: 'lodestone_plate', count: 4 },
  { id: 'bind', name: 'Rebind what time ate', itemId: 'living_thread', count: 3 },
];

/** Parts of the bill still unpaid. */
export function portalPartsMissing(signals: QuestSignals | undefined): PortalPart[] {
  const repair = signals?.finaleRepair ?? {};
  return PORTAL_BILL.filter((part) => !repair[part.id]);
}

/** The ring's answer to a click, as pure decision:
 *  - 'open'   — the departure is already made; the way stands.
 *  - 'depart' — the bill stands paid in full AND the discovery
 *               stands read; this click goes through.
 *  - 'sealed' — the bill is paid, but the discovery (What
 *               Happened Here) is not yet made: the departure
 *               is available only after the discovery (Adam,
 *               2026-10-18) — the knowing binds the stone as
 *               well as the quest. Paying the bill early is
 *               still allowed; mending is not leaving.
 *  - 'pay'    — these parts can be paid from the pouch right now.
 *  - 'wait'   — nothing payable; these parts (and their costs) remain. */
export type PortalOutcome =
  | { kind: 'open' }
  | { kind: 'depart' }
  | { kind: 'sealed' }
  | { kind: 'pay'; parts: PortalPart[] }
  | { kind: 'wait'; missing: PortalPart[] };

export function portalClickOutcome(
  signals: QuestSignals | undefined,
  hasItem: (itemId: ItemId, count: number) => boolean,
  discovered: boolean,
): PortalOutcome {
  if (signals?.departed) return { kind: 'open' };
  const missing = portalPartsMissing(signals);
  if (missing.length === 0) return discovered ? { kind: 'depart' } : { kind: 'sealed' };
  const payable = missing.filter((part) => hasItem(part.itemId, part.count));
  if (payable.length > 0) return { kind: 'pay', parts: payable };
  return { kind: 'wait', missing };
}

// ---------------------------------------------------------------------------
// ANSWER — THE VISIT AND THE DESCENT (D3, 2026-10-18)
// ---------------------------------------------------------------------------
// The site may be FOUND early (the grove has always been
// there), but the visit itself waits for the discovery —
// you cannot say goodbye to people you cannot name yet
// (the dev lane's watch, under Adam's seal law). The gift
// (the deep tunnel's recipe) rides the visit: the forge
// shelves it only once finaleVisit stands.

/** The Presence's answer to an address:
 *  - 'gone'    — the departure is already made.
 *  - 'notyet'  — found, but the discovery is unread: presence only.
 *  - 'visit'   — the meeting, the goodbye, and the gift.
 *  - 'after'   — the visit stands made; they have given what they give. */
export type VisitOutcome = 'gone' | 'notyet' | 'visit' | 'after';

export function visitOutcome(signals: QuestSignals | undefined, discovered: boolean): VisitOutcome {
  if (signals?.departed) return 'gone';
  if (!discovered) return 'notyet';
  if (!signals?.finaleVisit) return 'visit';
  return 'after';
}

/** The deep tunnel's answer to an address: descend (the
 *  act, seal-gated like every family's), already-gone, or
 *  sealed. Growing and placing the mouth are preparation —
 *  free, like mending the ring. */
export type DescendOutcome = 'gone' | 'descend' | 'sealed';

export function descendOutcome(signals: QuestSignals | undefined, discovered: boolean): DescendOutcome {
  if (signals?.departed) return 'gone';
  return discovered ? 'descend' : 'sealed';
}

// ---------------------------------------------------------------------------
// HONOR — THE MEMORIAL AND THE STALK (D4, 2026-10-18)
// ---------------------------------------------------------------------------
// The memorial is the player's own grown ground: raise it,
// plant the stalk in it from SEED VARIETY (three different
// seed kinds — the whole garden goes into the road), tend
// it once per world day (compost and dew), and when it has
// drunk enough days, CLIMB. The stalk's whole life rides
// the memorial's entity state (the dev lane's watch): the
// last-tend day persists on the entity, so a reload can
// never reopen a day's tend. Tending and planting are
// preparation — free under the seal law; the CLIMB is the
// act, and it waits for the discovery like every family's.

/** Tends that raise the stalk to climbing height. */
export const STALK_TENDS_TO_GROW = 4;
/** The tend's price: compost and dew, per day. */
export const STALK_TEND_COST: { itemId: ItemId; count: number }[] = [
  { itemId: 'basic_compost', count: 2 },
  { itemId: 'dew_essence', count: 1 },
];
/** The seed kinds the garden can give the stalk (the six
 *  plantables — seeds are never crafted, only harvested). */
export const STALK_SEED_IDS: ItemId[] = [
  'seed_lantern_fern', 'seed_sap_weaver', 'seed_petal_mill',
  'seed_snap_trap', 'seed_bell_bloom', 'seed_bounce_shroom',
] as ItemId[];

/** The memorial's state, as the executor reads it off the entity. */
export interface MemorialState {
  planted: boolean;
  tends: number;
  lastTendDay: number;
}

export type MemorialOutcome =
  | 'gone'        // the climb is already made
  | 'plant'       // no stalk yet
  | 'tend'        // planted, thirsty, a new day
  | 'tend-wait'   // planted, already drank today
  | 'climb'       // grown — and the discovery stands
  | 'climb-sealed'; // grown — but the knowing isn't made

export function memorialOutcome(
  signals: QuestSignals | undefined,
  state: MemorialState,
  discovered: boolean,
  today: number,
): MemorialOutcome {
  if (signals?.departed) return 'gone';
  if (!state.planted) return 'plant';
  if (state.tends >= STALK_TENDS_TO_GROW) return discovered ? 'climb' : 'climb-sealed';
  if (state.lastTendDay >= today) return 'tend-wait';
  return 'tend';
}

// ---------------------------------------------------------------------------
// CONFRONT — THE SCAR AND THE MOTIVE (D5, 2026-10-18)
// ---------------------------------------------------------------------------
// What the strangers left is DAMAGE: a tear in the deep
// rooms of taken-out grand ruins, matching no grown weapon.
// The tear is the only passage that leads where they went.
// The motive latches ONCE, ever (the dev lane's watch):
//   REVENGE steps through — no recipe, no growing; the
//     departure is a pursuit, and the act waits only on the
//     discovery, like every family's.
//   CURIOSITY reads the tear — the one reading the world
//     has never allowed — and grows a way of the grower's
//     own, scar-taught. Its price is not road materials but
//     PASSAGE PROTECTIONS: grown defenses against a place
//     the world's rules do not cover (§7 — priced here at
//     finale weight, in the absence of the recipe
//     conversation the doc parks).
// Choosing the stance is preparation — free at any time.
// Stepping through is the act — sealed until the discovery.

/** Curiosity's passage protections, paid once at the scar. */
export const SCAR_PRICE: { itemId: ItemId; count: number }[] = [
  { itemId: 'carapace_scale', count: 6 },
  { itemId: 'cinder_scale', count: 4 },
  { itemId: 'saltglass_shard', count: 3 },
  { itemId: 'living_thread', count: 2 },
];

export type ScarOutcome =
  | 'gone'    // the descent is already made
  | 'choose'  // no motive latched — the choice is offered
  | 'pursue'  // revenge, discovered: step through
  | 'pay'     // curiosity, protections in hand: pay them
  | 'wait'    // curiosity, protections short
  | 'descend' // curiosity, paid + discovered: step through
  | 'sealed'; // the road is chosen/paid — the knowing isn't made

export function scarOutcome(
  signals: QuestSignals | undefined,
  discovered: boolean,
  hasItem: (itemId: ItemId, count: number) => boolean,
): ScarOutcome {
  if (signals?.departed) return 'gone';
  if (!signals?.finaleMotive) return 'choose';
  if (signals.finaleMotive === 'revenge') return discovered ? 'pursue' : 'sealed';
  // curiosity
  if (!signals.finaleScarPaid) {
    return SCAR_PRICE.every((c) => hasItem(c.itemId, c.count)) ? 'pay' : 'wait';
  }
  return discovered ? 'descend' : 'sealed';
}
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
