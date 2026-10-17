# The Departure — the finale design note

*Recorded 2026-10-17 by the dev lane, from Adam's sketch the
morning the Autumn Stack went live. Status: DESIGN IN PROGRESS —
Adam's idea, written up at his word; not a pin, not a build plan.
One whole side of it (section 5) is deliberately left blank at
his instruction: "that's a convo for another hour."*

## 1. The shape: knowing, then answering

The World Asks Back has always had two beats in it, and until
now only the first existed. The fragment set and the assembled
chapter are the **knowing**: the player learns what happened to
this world's Precursors — the fate, named outright, the game's
one earned exception to its own silence.

The finale is the **answering**. What the player *does* about
what they learned. Depending on the fate, the honest answers
differ in kind: **follow them. Uplift them. Destroy them.
Whatever the fate permits.** A fate that naturally allows
following makes the answer a pursuit; a fate that doesn't makes
it something else — and Adam's unification (section 2) is what
makes all of it buildable.

## 2. The unification: eleven fates, one departure

Eleven fates would bankrupt any design that authored eleven
endgames. They don't need eleven. Whether the story says
*follow* or *leave, because following is impossible*, the final
quest is mechanically the same act — **the player travels to
another world**. If the fate permits following, the following
*is* the traveling: the Precursors' road and the player's road
are one road. If it doesn't, the final quest is striving for
that same road for the player's own reasons.

The fate decides what the departure **means**. It does not
decide what the departure **is**. One engineering problem,
eleven skins.

## 3. Fate families — the working sort (dev lane, 2026-10-17)

The eleven fates, sorted by what they allow — the answer each
one makes honest. (Read against the chapters in
src/game/quests/awChapters.ts; each chapter's own text is the
evidence.)

- **FOLLOW** — they left, alive, and a road exists →
  *Gardeners, Long Experiment, Evacuation, Uplift,
  Departure.*
- **ANSWER** ("the Present" — they never left; they are
  still here, transformed) → *Becoming, Return to Water.*
- **CONFRONT** — what remains is a threat (the strangers who
  ended them) → *Taken Out.* A family of one, by design: only
  one fate has a guilty party.
- **HONOR** — nobody to meet, follow, or fight → *Crash,
  War, Sickness.*

One final approach per family, each converging on the same
gate. Follow is heavy (five of eleven) because most endings
in this game are leavings; the sort is a working proposal for
Adam's pin, not yet a pin itself.

## 4. The finale quest: grow the way out

The departure is not a ship and is never built — nothing in
BioForge is built. It is the largest thing the Bio-Forge ever
grows, and *growing it is the finale quest*: a gathering tour
of the whole game as ingredients. Wild-country materials. The
apexes' country, visited on purpose. Every family's craft at
its height. The endgame gives the player a reason to use
everything they have learned — which is what a finale is for.

**The mechanism (Adam, 2026-10-17): the way out is a TIER 4
RECIPE** — the first T4 in the game, expensive the way a finale
should be — and the finale's arc is *obtaining* it, then paying
it. Where the recipe comes from is the family's flavor:

- **ANSWER (Becoming, Return to Water):** the artifacts are
  assembled, the mystery solved — then the player goes and
  FINDS them (the Living Valleys; the bright water) and TALKS.
  When the player is ready to move on, the Precursors GIVE
  them the T4 recipe for leaving. The ones who stayed hand the
  road to the ones who go.
- **FOLLOW:** the road already exists — they left it, some of
  them "in repair for whoever comes after." The recipe is
  theirs, left behind in the stations and grand ruins; the
  finale is earning the right to walk the road they walked.
- **HONOR (Adam, 2026-10-17):** the artifacts are assembled,
  and assembling them *opens the way to a memorial* — where
  ANSWER worlds have a meeting, Honor worlds have a
  commemoration; there is no one left to talk to, so the
  player builds the remembering. The recipe comes *somehow*
  through the memorial (Adam's word — the exact how is a
  pin-time detail; the dev lane's placeholder: the recipe is
  kept at the memorial, left by a people who tidied their
  houses for whoever came next). Then leave.
- **CONFRONT (Adam, 2026-10-17):** the same pattern — with a
  motive choice at the encounter. Facing the strangers who
  ended the Precursors, the player goes in **revenge** or in
  **curiosity**; the stance is the player's, the skeleton is
  the same, and the road out runs through the confrontation
  either way. (The recipe arrives through it — salvaged,
  seized, or granted by whatever the player finds; the
  motive colors everything except the shape.)

**The uniform skeleton, all four families:** assemble the
artifacts → the family's encounter (a road inherited, a
meeting, a memorial, a confrontation) → the expensive T4
recipe, somehow → grow the way out, and leave. The families
differ in everything except the shape.

The registry's long-deferred **Every Ending** (Line 1,
cross-save) is this design's empty chair: it was always the
capstone and never had a shape. It has one now.

## 5. PARKED — what's on the other side

Deliberately undesigned, at Adam's word: what the next world
*contains* — its adventures, its differences, whether a second
world is a harder country or a stranger one — is a conversation
for another hour. This note designs the door, not the room
behind it. Nothing in the build should be shaped by guesses
about the other side until that conversation happens.

## 6. Rulings (Adam, 2026-10-17 — the same morning)

The questions this note shelved were answered within the hour:

1. **Companions stay on their home world.** The hearth dog,
   the vat-born, the settled friends — they belong to their
   world and do not cross. "We'll find more." Bonds are
   per-world and complete in themselves; leaving is a real
   goodbye, and the new world's creatures carry the heart's
   next chapter. (No companion migration, ever — the sample
   route was not taken either.)
2. **The atlas stands.** Worlds are a collection the grower
   keeps; the old home remains visitable. The save system
   carries the atlas — the warmer, more expensive option,
   chosen knowingly.
3. **Co-op movement is per-player and free.** Either player
   can leave, stay, or return as they see fit — no party
   vote, no joint departure. Each grower travels their own
   atlas; a shared world is a place you can come back to.
4. **The destination shows as undiscovered.** The finale's
   destination entry exists before the crossing — as a
   question mark, "undiscovered," a named unknown — until it
   is traversed. The road has a visible end; what the end
   *is* stays behind the door (section 5).

Still open for the pin: the fate-family sort (section 3),
the vessel's ingredient list, and everything in section 5.
