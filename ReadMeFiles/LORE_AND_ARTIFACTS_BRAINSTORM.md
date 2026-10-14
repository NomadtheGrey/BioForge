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
