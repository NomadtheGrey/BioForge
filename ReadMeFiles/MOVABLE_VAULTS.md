# Movable Vaults — the move verb for containers

Design record, Adam's rulings verbatim where he ruled. **SHIPPED:**
Slice S6 of The World Asks Back, live since 2026-10-17 (the stack's
merge). It was sequenced last in its stack because App, placement,
travel, and the container panels were all inside the Asks Back
claim — one owner throughout.

## Ruling history (read in order — the latest governs)

1. **First design (2026-10-16):** full carry, cross-zone ferry allowed;
   death sets the vault down where the player fell; autosave handling per
   amendment 2.
2. **Amendment (2026-10-16 ~21:03, Adam's catch):** BioForge autosaves
   every ~30 s, so "set down before the save writes" would fire
   constantly. Rule: a save NEVER interrupts a carry — the save record
   projects the carried vault at the player's feet in the current zone
   (save-time projection only; the live carry continues).
3. **Recut (2026-10-17 morning): the scoot** — 15 m leash, same zone only,
   exits cancel to origin. Adam's concern: a carried full vault is
   portable storage.
4. **FINAL (2026-10-17 07:09, Adam): the leash is friction, not a wall.**
   "It can be a cross zone thing, it's just inconvenient to try to use it
   for storage. Gauntlet and shield are already disabled, as are weapons,
   while carrying the storage." Cross-zone carry is BACK; the 15 m radius
   gate is OUT. The anti-storage protection is the carry itself: while
   hauling a vault you have no gauntlet tools, no shield, no weapons —
   you are tool-less and defenseless for the whole haul, which makes the
   vault impractical as adventuring storage without banning the
   cross-country move a base relocation sometimes needs.

## The problem

Containers (storage pods, sample racks, culture vats) can be grown, filled,
upgraded — and then never relocated except by dissolving them. Dissolving is
the teardown verb: it takes the structure apart. Players need the gentle
verb: pick the whole thing up, contents and all, and set it down somewhere
better — across the base, or across the country if they're willing to walk
unarmed to do it.

Adam's words: "These vaults need to be movable... We don't want him to have
to pick up stuff off the floor or out of his pockets." + "We can make the
gauntlet inert until the player sets it down. We'll need input mechanics
for putting it down."

## Scope

Containers with contents/state: `storage_pod`, `sample_rack`, `culture_vat`.

The structure entity is NEVER dissolved: tier, contents, and a vat's
gestation ride inside it, intact, start to finish. The solvent stays the
teardown verb (item + tier kits + contents to the pouch, per c281746);
move is the gentle verb.

## The whole-entity rule (Adam, 2026-10-16)

"Anything we might pick up with inventory or tiers needs to be respected."

The carry holds THE WHOLE ENTITY, never a hand-picked field subset —
contents in their exact slots, tier intact, gestation mid-count, every
field the normal zone snapshot would store. All paths move that whole
entity: put-down, cancel-restore, autosave projection, death-drop, and the
guest structure broadcast. No seam where inventory or tier can leak;
tier-gated behavior (capacity, gestation) reads from the entity as usual
because the entity never stops being itself. Fidelity floor = the solvent
fix (c281746: tiers + contents returned whole); move is simpler and safer
because nothing is ever taken apart.

## Mechanics

- **Entry:** a Move button on the container's own panel. One carried
  structure at a time.
- **Carrying state** = placement mode with the carried structure's ghost
  (existing ghost/footprint/datum/reach rules), the entity held OUT of all
  zone lists in an App carry state recording origin
  `{zoneKey, entity snapshot}` — the snapshot being the whole entity.
- **THE WHOLE KIT IS INERT while carrying** (Adam's ruling): gauntlet
  tools dead (no harvest, plant, build, solvent), weapons dead (the
  striker draws through the gauntlet), shield dead. The only live click is
  the put-down click (route clicks to the placement handler first); a tool
  attempt gets a soft "hands full" response. HUD shows the carried state.
  This total disarmament is the design's answer to portable storage.
- **Put down:** left-click places at the ghost (validity = placement
  rules; red ghost refuses silently, as placement does today). Rotation is
  CAMERA-FACING-derived, like all placement in the game (pinned by Adam
  2026-10-17: no R-rotate input exists in the game, and none is added for
  the carry — you face the direction you want the vault to face).
  Right-click / Esc CANCELS — the
  entity restores to its origin (the live list if the player is back in
  that zone, else written into that zone's parked visited snapshot).
  Touch: tap ground to set down; the placement cancel button backs out
  (existing touch placement flow).
- **Zone travel mid-carry:** the carried entity rides like follow-pets do
  through `completeTravel` (held out of lists, so it simply isn't in the
  departing zone's parked snapshot); the placement ghost stays live after
  arrival — set down in the new zone.

## Saves, death, and guests

- **Autosave (Adam's catch, amendment 2):** the game saves every ~30 s,
  and a save NEVER interrupts a carry in live play. When the save record
  is built while carrying, the carried entity is PROJECTED into the saved
  copy of the current zone at the player's position — save-time
  projection only. Every autosave re-projects from live truth, so nothing
  accumulates; on reload, the vault stands where the last save caught the
  player mid-carry. Quit (pagehide) is just the last autosave — same
  projection; it reads as "the vault set down when you left."
- **Carry never persists as a state:** no new save key,
  SAVE_FORMAT_VERSION stays 1. **The carry state is session UI, full
  stop:** it dies with any world reload (death respawn, disconnect, world
  switch) rather than resurrecting against fresh world state — a future
  refactor must never promote it into persisted state by accident.
- **Death mid-carry:** the vault sets down where the player fell — into
  that zone's parked snapshot at the fall position. Recoverable, and it
  feeds Walk Back (go back for what you dropped).
- **Guests carrying a host structure:** remove/place go through the
  existing structure broadcast (remove on lift, upsert on set-down); the
  host stays truth on save. Projection applies only where save ownership
  is local; host structures ride the broadcast path — the build must
  handle this edge explicitly.

## The vat

Carries like the pod and rack; gestation rides the entity snapshot
untouched — an autosave projection must never reset or pause gestation,
because the projected copy is the same whole entity.

## Parked seed — the WALKING vault (NOT this build)

Adam likes the walking vault for a DIFFERENT kind of vault: a structure
kind that relocates by uprooting and ambling after the player, sealed
while walking. Filed here as a design seed for a later day — do not scope
it into S6.

## Verification markers (background lane spot-check)

The carry state, the inert-kit gate (gauntlet + weapons + shield),
restore-on-cancel, and the autosave projection — plus fresh-checkout
tsc 0 + build green on the pushed tip and the standing must-survive marker
sweep. (The morning recut's radius-gate marker is dead — ignore it.)
