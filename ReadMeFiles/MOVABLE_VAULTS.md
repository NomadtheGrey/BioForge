# Movable Vaults — the move verb for containers

Design record, Adam's rulings verbatim where he ruled. Build slot: Slice S6
of The World Asks Back build stack, staged on `wip` after S5 (BioTunnel
guest fix). Sequenced last because App, placement, travel, and the container
panels are all inside the Asks Back claim — one owner throughout.

## The problem

Containers (storage pods, sample racks, culture vats) can be grown, filled,
upgraded — and then never relocated except by dissolving them. Dissolving is
the teardown verb: it takes the structure apart. Players need the gentle
verb: pick the whole thing up, contents and all, and set it down somewhere
better.

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
field the normal zone snapshot would store. All five paths move that whole
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
  `{zoneKey, entity snapshot}` — the snapshot being the whole entity (see
  the whole-entity rule).
- **Gauntlet INERT while carrying** (Adam's ruling): all tool inputs dead —
  no harvest, strike, plant, build, solvent. The only live click is the
  put-down click (route clicks to the placement handler first); a tool
  attempt gets a soft "hands full" response. HUD shows the carried state.
- **Put down:** left-click places at the ghost (validity = placement
  rules; red ghost refuses silently, as placement does today). `R` rotates
  (existing placement rotation input). Right-click / Esc CANCELS — the
  entity restores to its origin: the live list if the player is back in
  that zone, else written into that zone's parked visited snapshot.
  Touch: tap ground to set down; the placement cancel button backs out
  (existing touch placement flow).
- **Zone travel mid-carry:** the carried entity rides like follow-pets do
  through `completeTravel` (held out of lists, so it simply isn't in the
  departing zone's parked snapshot); the placement ghost stays live after
  arrival — set down in the new zone.

## The autosave rule (Adam's catch, 2026-10-16)

BioForge autosaves every ~30 seconds. The first draft of this design said
"save/quit mid-carry sets the vault down at the player's feet before the
save writes" — under a 30-second autosave that rule fires constantly, and a
long carry would drop the vault every half minute. Adam caught it; the
rule is amended:

- **A save NEVER interrupts a carry in live play.** When the save record
  is built while carrying, the carried entity is PROJECTED into the saved
  copy of the current zone at the player's position — save-time projection
  only. The live entity stays out of zone lists; the carry continues
  untouched.
- Every autosave re-projects from live truth, so nothing accumulates or
  duplicates. On reload, the vault stands where the last save caught the
  player mid-carry.
- Quit (pagehide) is just the last autosave — same projection. It reads as
  "the vault set down when you left."
- Carry itself is never a saved state: **no new save key,
  SAVE_FORMAT_VERSION stays 1**, nothing new for the loader to understand
  and nothing an old save can lack.
- Guest carrying a HOST structure: projection applies only where save
  ownership is local; host structures keep riding the broadcast path
  (remove on lift, upsert on set-down; host stays truth on save). The
  build must handle this edge explicitly.

## Edge rules

- **Death mid-carry:** the vault sets down where the player fell — into
  that zone's parked snapshot at the fall position. Recoverable, and it
  feeds the Walk Back pattern (go back for what you dropped).
- **The vat:** carries like the pod and rack; gestation rides the entity
  snapshot untouched. An autosave projection must never reset or pause
  gestation.

## Verification markers (background lane spot-check)

The carry state, the inert-gauntlet gate, restore-on-cancel — greppable,
plus fresh-checkout tsc 0 + build green on the pushed tip, and the
standing must-survive marker sweep.
