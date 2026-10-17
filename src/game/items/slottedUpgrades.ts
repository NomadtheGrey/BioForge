/**
 * slottedUpgrades — the SLOTTED-UPGRADE predicate (Adam, 2026-10-17).
 *
 * Some "items" in the pouch are not cargo at all: they are
 * upgrades GROWN INTO a piece of gear — the gauntlet's
 * modules and Field Synthesizer Graft, the helmet's worn
 * lenses and radar, the Quicksteps growths, and the pouch
 * tiers themselves. They consume no carrying in spirit —
 * they ride their platform — so they must never be treated
 * as loose things: above all they cannot be stashed into a
 * storage pod (Adam's play-pass catch: gauntlet modules were
 * being offered in the pod's deposit list).
 *
 * Membership is the union of the four owning sets, checked
 * at CALL time (a function, not a precomputed set) so the
 * predicate always reads the live tables and module init
 * order can never bite:
 *   - the gauntlet family (quests.ts isGauntletUpgrade),
 *   - the helmet gear set (items/constants),
 *   - the Quicksteps gear set (items/constants),
 *   - the pouch tier line (items/pouch POUCH_UPGRADE_ITEMS).
 *
 * Physical pieces are NOT slotted upgrades: a shield or a
 * striker is a THING you hold, and it can still be stashed.
 * If a future upgrade is per-piece state rather than an
 * item (the shield Spike Graft), it never enters the pouch
 * as an item at all and needs no entry here.
 */

import type { ItemId } from '../../types/game';
import { BOOTS_GEAR_ITEM_IDS, HELMET_GEAR_ITEM_IDS } from './constants';
import { POUCH_UPGRADE_ITEMS } from './pouch';
import { isGauntletUpgrade } from '../quests/quests';

/** True when this item is an upgrade slotted into worn gear. */
export const isSlottedUpgrade = (id: ItemId): boolean =>
  isGauntletUpgrade(id) ||
  HELMET_GEAR_ITEM_IDS.includes(id) ||
  BOOTS_GEAR_ITEM_IDS.includes(id) ||
  POUCH_UPGRADE_ITEMS.includes(id);
