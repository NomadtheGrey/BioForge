# S7 — The Settled Dead (deaths ledger + dead-anchor echoes)

Status: PREPARED 2026-10-17 (dev lane), awaiting Adam's pin.
Program: The World Asks Back, slice 7. Fixes the one known limitation
carried out of S4 and filed at its landing.

## The problem (S4's named debt)

S4 made settled individuals (creatures the player released from the vat
to live wild in a named zone) materialize from their ledger record on
zone entry. But killing one leaves the record standing — so the
individual re-materializes on a later entry. The world forgets the
death. S4's harness proved everything except this; the fix was agreed
in shape at the time: a settled-deaths ledger feeding dead-anchor
echoes. This slice builds it.

## The fix, in three parts

### 1. The deaths ledger

`asksBack` gains a `settledDeaths` list (optional key inside the
existing blob — save-format law holds: `SAVE_FORMAT_VERSION` stays 1,
old saves load with `?? []`). Each entry: the settled record's id, the
individual's name, species, home zone key, and the game-day it died.

Written host-authoritatively at the moment of death, through the same
event sink as every other Asks Back signal (the death/cull path in the
combat sweep already sees the individual die; it reports
`settled_death` with the record id). A death with no settled record
writes nothing — ordinary fauna were never individuals.

### 2. The dead stay dead

`applyZoneConsequences` settled materialization skips any record whose
id stands in `settledDeaths` — in both modes ('generate' and 'load').
The load path additionally filters a parked snapshot's fauna list by
the ledger (id, or name+species where ids are absent), so a snapshot
taken while the individual lived cannot smuggle it back on restore.
Save/load, leave/return, and host-snapshot arrival all pass through
the same apply path, so one filter covers every door.

The settled record itself is NOT deleted — the notebook remembers the
individual existed. Materialization is what stops.

### 3. Dead-anchor echoes become offerable

The Director's echo pool gains the `dead_anchor` kind, anchored on the
ledger: an echo saga of two beats.

- **Beat 1 — Go to where they ranged.** Travel to the dead individual's
  home zone (named in the offer by the individual's name: the world
  asks after Old Fen by name, as settled anchors already do).
- **Beat 2 — Mark it.** A remembrance act at the zone: plant a flora,
  or witness the range for a span — one authored act, not a fetch.
- **Resolution.** The echo is answered and stays answered (housekeeping
  law). The zone keeps a light consequence: a `remembered` mark in its
  consequence record — no population math, the place is simply noted
  as one where something was lost and marked. The ledger entry carries
  `echoAnswered: true`.

Echo discipline holds: dead-anchor echoes count toward the personal
echo share cap (PERSONAL_ECHO_CAP, 0.35 starting value), one offer per
day, and an individual generates at most one echo, ever.

## Host authority

The ledger lives in the host's `asksBack` blob like everything else in
the program. Guests' kills of settled individuals reach the ledger
through the host's death path (the host runs the combat consequences
for its world); a guest never writes the ledger directly.

## Verification (driver, not by eye)

1. Settle an individual → kill it → leave and return: it does not
   re-materialize. Reload the save: still gone.
2. The same, where the zone was parked in a snapshot BEFORE the death:
   restore filters it out.
3. Kill a non-settled creature of the same species in the same zone:
   nothing written, nothing filtered.
4. The Director deals a dead-anchor echo for the ledger entry; the
   offer names the individual; completing both beats marks it answered;
   it never re-offers (300-generation fuzz, the S3 standard).
5. Old saves (no `settledDeaths` key) load clean.

## Open questions for Adam (pin-time, none block preparation)

- **Cause of death:** record it (culled by the player / killed wild /
  died of the world)? The ledger can carry it cheaply; it changes the
  echo's tone — a memorial for a creature the player themselves culled
  reads differently from one the world took.
- **Forgetting:** the notebook compacts saga records today; should very
  old deaths eventually fade from the ledger (freeing the name), or is
  a settled death permanent for the life of the world?
- **The mark:** is a silent `remembered` zone note enough, or should
  the resolution leave something visible in the zone (a named wildflower
  patch is the obvious candidate — flora system, separate mini-slice if
  wanted)?

## Files (expected)

`asksBackState.ts` (ledger type + writer), the death path in the combat
sweep (signal), `asksBack/applyConsequences.ts` (the filter),
`asksBack/director.ts` + `templates.ts` (dead-anchor echo), read-side
zone state as needed. App.tsx only if the sink needs a new verb.
