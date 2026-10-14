# Lore & Artifacts — Brainstorm + Settled Rules

**Status: MIXED (2026-10-13).** The requirement and the "Settled rules" are
decided. The fate list and mechanics are BRAINSTORM ONLY — unpinned, to be
sorted later.

## The requirement (Adam, 2026-10-13)

Alien ruins must carry **clues** to what happened, and **artifacts**,
eventually. That means **every generated world has its own backstory** — not
one master document, but a story the world itself holds and the player
uncovers piece by piece.

## Settled rules (pinned)

- **Precursor technology is biological (2026-10-10).** Ruins are grown
  structures that have gone feral or dormant. Artifacts are dormant
  organisms, revived by feeding, light, or grafting — never machines running
  on batteries or switches. The Bio-Forge itself is a cultivated fabrication
  organism; the ruins are its wild ancestors.
- **Artifacts are found dormant and need activating (2026-10-10).** The
  activation is systemic: figure out what the organism wants — light, a
  grown component, bio-pellets — and provide it. No keys, no switches.
- **The first hint stays silent (2026-10-10).** The starting zone's small
  precursor remnant sits off the main path with no text and no marker.
- **Discovery is optional and artful.** No quest lanes pointing at lore.
  Objectives stay parked until the game deserves them; players who only want
  to farm and build may ignore the mystery entirely.

## How a world gets its story (proposed architecture, unpinned)

At world creation, the world takes **one precursor fate**. The fate is
stored with the save and quietly directs generation: ruin style, which
artifacts exist and where, and how strange the far zones become. Because the
host generates zones and peers receive them via `world_sync`, guests explore
the *host's* world's story. Two worlds are not just different maps — they
are different mysteries with different answers.

**A second axis — the remnant state** — decides what is *left* of the
precursors (see below). A world's story is **fate × remnant**: the Crash
with degenerate survivors is a different mystery from the Crash with an
underground enclave, though the same thing "happened."

### Candidate fates (brainstorm)

- **The Gardeners.** Bio-engineers who seeded and tended the planet, then
  left on purpose. Ruins are orderly, overgrown, and kind; artifacts are
  cultivation tools still doing their jobs badly.
- **The Crash.** An ark or colony vessel broke up here. Ruins cluster along
  a debris path; the "precursor" presence is one crew, one bad week.
- **The Long Experiment.** The world was a laboratory. The tameable,
  obviously-engineered species are escaped experiments, and the far zones
  hold the experiments that were never meant to get out.
- **The Evacuation.** They left in a hurry, mid-meal, mid-project. Something
  out at the far zones is the reason — the strangeness gradient is the
  story's shape.
- **The Becoming.** They didn't die or leave; they merged into the
  ecosystem. The Living Valley is not a metaphor, and some "creatures" are
  closer to citizens than animals.
- **The War.** They destroyed themselves. Ruins are scarred and fortified,
  grown weapons gone wild; some zones are old battlefields where nothing
  tameable will settle.
- **The Sickness.** Disease took them. Ruins are eerily intact — tools down
  mid-task, projects finished, people gone. War scars a world; sickness
  leaves it tidy and terrible.
- **Taken Out.** Another civilization destroyed them. This fate introduces
  a third party into the lore: the precursors were not the top power, and
  the ruin damage isn't theirs and isn't natural.
- **The Uplift.** Another civilization raised them up and took them in. The
  kindest fate — ruins orderly, emptied, almost grateful — and it also
  introduces the third party.
- **The Departure.** Natives who simply left, by space travel or portal, in
  good order and by choice. The ruins are a hometown emptied, not a disaster
  site. (Distinct from the Gardeners: visitors finishing a job vs. a people
  leaving home.)
- **The Return to Water.** They became ocean- and river-dwelling and
  dissociated from technology entirely. Fate and remnant in one: they may
  still be *present* — in the water. Ties directly to the alien-rivers open
  question in BIOMES_BRAINSTORM.md.

### Remnant states — what is left of them (Adam, 2026-10-13, brainstorm)

- **Extinct.** Only ruins and artifacts remain. The loneliest worlds.
- **Almost extinct.** A few still present, hidden; meeting one is among the
  rarest events in the game.
- **Present but degenerate.** Regressed descendants who have lost the
  knowledge that built the ruins. Raises the possibility that one of the
  tameable "creature" species *is* the precursors, fallen that far.
- **Split in two.** A surface branch and an underground branch, diverged
  past recognizing each other (the Time Machine pattern). This makes the
  instanced caves story-bearing: the underground branch lives in the cave
  instances, the surface branch above them, and neither side's existence is
  announced to the other.
- **Survivors underground.** An enclave that chose the caves when whatever
  happened, happened. Pairs naturally with the Evacuation fate: they were
  not fleeing the planet — they were fleeing *downward*.

## Clue layers (brainstorm)

No exposition dumps. The story arrives through three channels:

1. **Architecture.** What they built, what broke, what was abandoned
   mid-use. Ruin state differs by fate.
2. **Artifacts.** Portable dormant organisms. Two classes:
   - *Lore artifacts* — fragments whose sets, once assembled, open a chapter
     of that world's story in the codex.
   - *Working artifacts* — precursor bio-tech that still functions once
     revived: gauntlet modules and unique tools, so lore and progression
     feed each other.
3. **Ecology.** The creatures and plants are evidence. A lantern-fern is
   manufactured life — precursor technology made of meat, still running its
   program long after its makers vanished.

## Open questions

- Who picks the fate: rolled at creation, chosen by the player, or a hybrid
  (first world always the same gentle fate, later worlds roll)?
- Can a fate repeat across a player's worlds, or does the roster exhaust?
- How much do artifacts "say"? Glyph fragments decoded by completing sets,
  or purely visual storytelling with codex narration?
- Do working artifacts duplicate gauntlet upgrades (alternate sources) or
  offer things crafting never can (unique effects)?
- If a remnant state leaves precursors present, are they characters — met,
  traded with, spoken to — or kept ambient, glimpsed and never confirmed?
- Were the precursors native to the world, or arrivals? (The Gardeners and
  the Crash assume arrivals; the Departure assumes natives. Origin may be a
  hidden third axis of a world's story.)
- If a third party exists (Taken Out, the Uplift), are they still out
  there — and do they ever appear, or are they forever offstage?
