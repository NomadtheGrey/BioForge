// =====================================================================
// FIELD NOTES — the bookkeeping module (dev chat wiring, 2026-10-16)
// =====================================================================
//
// fieldNotes.ts (creatures chat, slice 46) holds the DATA: 27 notes
// keyed to species, each with a clue and a named witness event. This
// module is the WIRING side: the save-backed state shape and the pure
// lookups the unlock / witness call sites use.
//
// THE STATE (saved with the world, beside the codex):
//   unlocked  — note ids the player has EARNED by scanning the note's
//               species (the codex's discovered flag flips on the
//               same event, so unlock and discovery never disagree).
//               A locked note is ABSENT from the quest log — not
//               greyed, not hinted. You cannot miss what you have
//               never seen.
//   witnessed — note ids whose named event has happened near the
//               player (the dog deciding, a window harvest taken in
//               its hour, a cache treasure collected). A record, not
//               an objective: nothing is rewarded, nothing is gated.
//               Witnessing is stored even before the note unlocks —
//               see the moment first, scan the species later, and the
//               log already remembers you were there.
//
// THE SINK: App owns `recordFieldWitness(noteId)` and hands it down
// (tool interactions, the game loop's refs). Sim-side moments that
// live in useWorldEntities (wisp anchoring, bear tenancy, the otter's
// bank, the hermit's dawn gift…) call the same sink through the
// loop's live refs when the creatures chat wires them — one door,
// every witness walks through it.

import { FIELD_NOTES, type FieldNote } from './fieldNotes';
import type { ItemId } from '../types/game';

/** The save-backed field-notes state (see the header). */
export interface FieldNotesState {
  unlocked: string[];
  witnessed: string[];
}

/** A fresh book: nothing unlocked, nothing witnessed. */
export const EMPTY_FIELD_NOTES: FieldNotesState = {
  unlocked: [],
  witnessed: [],
};

/** The note with this id, if it exists. */
export function noteById(noteId: string): FieldNote | undefined {
  return FIELD_NOTES.find((n) => n.id === noteId);
}

/**
 * Every note a scan of `speciesId` unlocks: the species' own note,
 * plus any GROUP note whose anyOf set contains it (the oversize
 * tier — scanning any one of the great ones opens their shared
 * note).
 */
export function noteIdsForSpecies(speciesId: string): string[] {
  return FIELD_NOTES.filter(
    (n) =>
      n.species === speciesId ||
      (n.anyOf !== undefined && n.anyOf.includes(speciesId)),
  ).map((n) => n.id);
}

/**
 * The witness note for a WINDOW HARVEST of `speciesId` — the five
 * phase-gated crops (slice 40) whose notes witness "harvested inside
 * its hour". Data-driven on purpose: the note whose species matches
 * AND whose witness text names the hour, so a future window species
 * needs no code change here.
 */
export function windowNoteIdForSpecies(speciesId: string): string | undefined {
  return FIELD_NOTES.find(
    (n) => n.species === speciesId && n.witness.includes('inside its hour'),
  )?.id;
}

/**
 * Pickup witnesses: collecting one of these items IS the note's
 * named event, so the game loop's pickup closure stamps it here.
 *   gloom_gel    — "Gloom Gel picked up." (the slug's shed)
 *   silver_scale — "A Silver Scale collected." (the silverfin's shed)
 *   glass_shed   — "A shed plate collected." (the shard grazer's shed)
 *   requisition  — "A Requisition drops." (the bailiff's kill drop;
 *                  stamped on COLLECTION — the moment the player
 *                  actually sees it — rather than the kill, which can
 *                  happen off-screen at a companion's paws)
 * The otter's cache note is deliberately NOT here: caches bank
 * ordinary items indistinguishable from any other drop, so its
 * witness belongs at the bank itself, sim-side.
 */
const PICKUP_WITNESS: Partial<Record<ItemId, string>> = {
  gloom_gel: 'note_gloom_slug',
  silver_scale: 'note_silverfin',
  glass_shed: 'note_shard_grazer',
  requisition: 'note_feral_warden',
};

/** The note a pickup of `itemId` witnesses, if any. */
export function noteIdForPickupItem(itemId: ItemId): string | undefined {
  return PICKUP_WITNESS[itemId];
}
