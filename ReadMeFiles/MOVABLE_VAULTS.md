# Movable Vaults — the move verb for containers

Design record, Adam's rulings verbatim where he ruled. Build slot: Slice S6
of The World Asks Back build stack, staged on `wip` after S5 (BioTunnel
guest fix). Sequenced last because App, placement, and the container panels
are all inside the Asks Back claim — one owner throughout.

**RECUT 2026-10-17 (Adam): the move is a SCOOT, not a carry.** The use case
is base redesign — a few tiles over, inside the zone where the structure
already stands. The full cross-zone carry from the first draft is OUT:
"it's not meant to provide bigger pockets" — a carried full vault is
portable storage, so the move gets a leash. Everything below reflects the
recut; the earlier design's ferry / autosave-projection / death-drop
machinery is superseded and should not be built.

## The problem

Containers (storage pods, sample racks, culture vats) can be grown, filled,
upgraded — and then never relocated except by dissolving them. Dissolving is
the teardown verb: it takes the structure apart. Players need the gentle
verb for rearranging a base: lift the whole thing, contents and all, and set
it down a few tiles over.

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

The lifted state holds THE WHOLE ENTITY, never a hand-picked field subset —
contents in their exact slots, tier intact, gestation mid-count, every
field the normal zone snapshot would store. Tier-gated behavior (capacity,
gestation) reads from the entity as usual because the entity never stops
being itself. Fidelity floor = the solvent fix (c281746: tiers + contents
returned whole); move is simpler and safer because nothing is ever taken
apart.

## The scoot — mechanics

- **Entry:** a Move button on the container's own panel. One lifted
  structure at a time.
- **Lifted state** = placement mode with the structure's ghost (existing
  ghost/footprint/datum/reach rules), the entity held in an App lift state
  recording its origin `{zoneKey, position, entity}`.
- **THE LEASH:** the ghost is VALID ONLY WITHIN A SMALL RADIUS of the
  structure's origin — **15 m as the starting constant, tunable** — same
  zone by construction. Outside the disc the ghost reads invalid exactly
  like any bad placement, and a set-down click there refuses silently, as
  placement does today.
- **Gauntlet INERT while lifted** (Adam's ruling): all tool inputs dead —
  no harvest, strike, plant, build, solvent. The only live click is the
  put-down click (route clicks to the placement handler first); a tool
  attempt gets a soft "hands full" response. HUD shows the lifted state.
- **Put down:** left-click places at the ghost (validity = placement rules
  + the leash disc). `R` rotates (existing placement rotation input).
  Right-click / Esc CANCELS — the structure restores to its origin,
  untouched. Touch: tap ground to set down; the placement cancel button
  backs out (existing touch placement flow).

## Saves, death, and exits — deliberately trivial

The scoot's leash collapses the whole edge-case family:

- **World truth changes only on set-down.** Until then, every save —
  autosave included — simply records the structure at its origin, because
  origin is the only state a save can hold. An autosave mid-lift therefore
  never interrupts play and never needs any special handling: no
  projection, no set-down-on-save rule.
- **Any exit from the lifted state other than a set-down** — death, quit,
  disconnect — CANCELS the move: the structure is at its origin in its home
  zone, exactly where the save (and on death, the world) already believes
  it is. There is no death-drop to recover and nothing to Walk Back for.
- **Carry never persists:** no new save key, SAVE_FORMAT_VERSION stays 1.
- **The lift state is session UI, full stop:** it dies with any world
  reload (death respawn, disconnect, world switch) rather than
  resurrecting against fresh world state. If it lives in App state that
  resets on world load, that's automatic — but keep it that way; a future
  refactor must never promote the lift into persisted state by accident.
- **Guests:** lifting a host's structure follows the existing structure
  broadcast discipline (remove on lift, upsert on set-down; host stays
  truth on save); a guest disconnect mid-lift simply never sends the
  upsert, so the host's structure stands at its origin — consistent by
  construction.

## The vat

Carries (scoots) like the pod and rack; gestation rides the entity
untouched — nothing in the move can reset or pause it, because the entity
is never taken apart and never leaves its zone.

## Parked seed — the WALKING vault (NOT this build)

Adam likes the walking vault for a DIFFERENT kind of vault: a structure
kind that relocates by uprooting and ambling after the player, sealed
while walking. Filed here as a design seed for a later day — do not scope
it into S6.

## Verification markers (background lane spot-check)

Radius gate on ghost validity + cancel-restores-origin, plus fresh-checkout
tsc 0 + build green on the pushed tip and the standing must-survive marker
sweep. (The first draft's ferry marker is dead — ignore it.)
