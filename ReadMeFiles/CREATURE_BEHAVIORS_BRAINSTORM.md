# Creature Behaviors — Brainstorm

**Status: BRAINSTORM ONLY (2026-10-13). Nothing in this file is pinned.**
These are raw ideas to sort through later. When something gets chosen, it moves
into CORE_MECHANICS.md and gets marked decided there.

## Where we start from (already built)

- Restless wandering — wild creatures roam instead of standing like statues.
- Aggro *awareness* in Peaceful: a wild stalker inside its range notices the
  player, holds position, and faces them. Actual attacks are Normal-difficulty
  design, not Peaceful.
- Pet commands cycle follow → stay → guard. Guard is species-specific:
  stalkers patrol a ring around their post; soft-puffs and burrow mice become
  drop collectors and fetch nearby drops into the player's pouch.
- Taming is a percentage roll per attempt, bait consumed either way
  (Soft-Puff 80%, Burrow Mouse 60%, Chitin-Stalker 25%).

## Earthly behavior toolbox

Behaviors a player recognizes from real animals — readable at a glance.

- **Herd and sentinel.** Grazers travel together; most eat while one keeps
  watch. An alarm makes the herd bunch and flee. Taming one member may earn
  the whole herd's tolerance.
- **Burrow and cache.** A creature digs up seeds, carries them home, and
  buries extras. Forgotten caches occasionally sprout into wild plants.
- **Pollinator rounds.** A flying creature visits mature flowers in a loose
  route, fertilizing them, possibly carrying traits from one plant to another.
- **Cleaner symbiosis.** A small creature follows a larger one, eating
  parasites or "itch spores." Help the little one and the big one becomes
  approachable.
- **Alarm network.** Prey don't flee one by one: one chitters, nearby prey
  scatter, and a predator may come investigate the noise.
- **Parents and juveniles.** Young stay glued to an adult. Feeding the adult
  is safe; crowding the juvenile makes the adult protective.
- **Territory and scent.** Predators follow patrol routes and scent-mark
  them. Other creatures avoid fresh marks unless hungry, desperate, or tame.
- **Sleep schedules.** Some species burrow or curl up to sleep; others only
  emerge in darkness. The world feels different depending on when you arrive.

## Alien behavior toolbox

Behaviors that could only happen on this planet.

- **Blink-when-unobserved.** Moves freely while not directly watched, freezes
  under a gaze, and blinks a few meters away if stared at too long. Taming is
  a slow-approach puzzle.
- **Light-drinking.** Gathers around lantern-ferns at night and slowly
  absorbs their glow. Frightened, it releases the stored light in a flash and
  escapes.
- **Echo mimic.** Learns sounds it hears — a harvest pop, a forge chime, a
  pet's call — and repeats them later, attracting or confusing other fauna.
- **Colony merge.** Tiny motes behave individually until threatened, then
  flow together into one larger worker or guardian. Startle it and it bursts
  back apart.
- **Shared memory spores.** A species shares experiences: feed several and
  the colony warms to you; harm one and distant members may already distrust
  you.
- **Dream double.** The body sleeps somewhere hidden while a translucent
  projection wanders and explores. You can interact with the projection, but
  taming requires finding the sleeping body.
- **Chemical moods.** Color and emissions change with surroundings. Calm near
  bell blooms, it releases growth spores; agitated near snap traps, it
  produces a predator-repelling mist.
- **Gravity-sick hopper.** Doesn't walk — falls in controlled arcs, bounces
  off walls, hangs beneath a canopy before dropping somewhere new.

## Favorite first combinations (Marlowe's picks, unapproved)

1. **Burrow Mouse:** burrow + cache + alarm calls — turns it into a real
   species instead of a small soft-puff variant.
2. **A glasswing-type pollinator:** pollinator rounds + light-drinking —
   ties fauna directly into the plant economy.
3. **A blink creature:** the signature alien — the species people remember
   BioForge for.
4. **Herd behavior:** unglamorous, but reusable across half the future roster.

## Radar-linked fauna concept — Vesper Glider

**Role decided (2026-10-14); behavior details remain brainstorm.** The
Vesper Glider is planned partly because the future **Prismatic Field
Radar** needs a biological receiver part (full recipe in
`CORE_MECHANICS.md`).

- A nocturnal glider with broad, sensitive hearing vanes. By day it
  roosts in a high or sheltered place; at night it launches, glides,
  and navigates by soft emitted pulses.
- It naturally sheds **Sonar Vanes**. Wild gliders can leave them as
  occasional finds; a tamed glider can supply them over time as a
  companion byproduct. No kill harvest — the part follows BioForge's
  non-lethal pattern.
- Behavior hooks to explore when it ships: pulse/navigation sensing,
  attraction to lantern light without being purely light-drinking, and
  startle-flights that make its movement read differently from the
  ground-bound fauna.

## Parked, related

- **The wiggle pass** (procedural micro-motion so creatures feel alive in
  their bodies) is PARKED as of 2026-10-13. When revived: Adam's idea is
  Brownian-style motion — implemented as *bounded/damped* jitter (tiny random
  nudges that settle back toward the creature's pose/anchor), never a raw
  random walk, which would accumulate drift.

## Untamables (brainstorm, Adam 2026-10-13)

Some creatures are **never tameable** and are always hostile in Normal and
Hostile modes — the fight-only exception to the befriend-or-fight idea.
Untameability should always have a *readable reason* a player can learn:

- **Hive-controlled.** No individual mind to bond with; the colony is the
  animal.
- **Still on duty.** A precursor defense organism executing orders centuries
  after its makers vanished. (Ties to ruins and world fates — e.g. the War.)
- **Too alien.** Its mind doesn't map onto anything a lure can say.
- **Epically large.** Scale itself is the reason: a creature the size of a
  hill can't be a pet. At best it can be negotiated with, guided, warded
  off, or endured like weather. The Leviathan Graveyard's bones imply at
  least one may still be alive, far out.

Open: what untamables do in Peaceful — appear as spectacle that hunts other
fauna while players watch from lit doorways, or never appear at all.
Untamables are also what world-event hordes are made of (see "World events"
in BIOMES_BRAINSTORM.md), and they give guard pets something real to engage
in Normal mode.

## Shipped species — behavior stubs (biome program, 2026-10-15)

Stubs for fauna the BIOME program shipped, written by the background
chat under Adam's delegation ("use your best judgement on the spectra")
so the design chat inherits them instead of rediscovering them. The
spectra are Marlowe's calls, open to revision here: temperament
(aggressive <-> timid), social (pack <-> solo), speed, locomotion.
Full codex text for each lives in-game (constants.ts INITIAL_CODEX).

**Mirror Moth** (Mirror Marsh, shipped 2026-10-15)
- Habitat: Mirror Marsh zones only; drifts pool to pool.
- Temperament: fully timid — no aggression at any difficulty.
- Social: loose gatherings (2-3 drift the same pools; no pack bond).
- Speed: slow (1.1). Locomotion: flying — low hover-drift.
- Hook: drawn to light (the marsh's doubled reach is its weather);
  sheds Dew Essence ~every 50 s, wild or tame — the marsh provides.
- Toolbox links: Pollinator rounds; Light-drinking.

**Vesper Glider** (meadow/fungal zones, shipped 2026-10-14)
- Habitat: meadow and fungal zones; never the spawn zone.
- Temperament: wary — flees contact; never aggressive.
- Social: solo. Speed: fast (2.6). Locomotion: flying — glide + bob.
- Hook: dusk creature in flavor; sheds Sonar Vanes ~every 45 s, wild
  or tame (the radar's supply chain must never require harming one).
- Toolbox links: Sleep schedules (nocturnal flavor, not yet real).

Biome-born FLORA with behavior interest (for completeness): the
Fungal Hollow trio — Antenna Shroom (senses the air), Visor Shroom
(the almost-face; watches nothing, probably), Shelf Shroom (the
future climbable) — and the Mirror Lily (cups light, beads dew).
Flora behavior proper belongs to the Living Valley design.

## The three-layer roster (Adam's distribution model, 2026-10-15)

Every creature sits in exactly one layer:

1. **Ubiquitous** — almost everywhere; the world's background cast
   (Soft-Puff, Burrow Mouse). Affinity 'all'.
2. **Family signature** — ONE creature per biome FAMILY, found
   across the whole family, variants included. None shipped yet as
   a pure single-family signature — the roster's open seats are
   meadow, wetland, fungal, ember.
3. **Biome-unique** — ONE creature per specific biome/variant, found
   nowhere else (Mirror Moth in the Mirror Marsh). The Fungal
   Hollow's unique seat is still empty — its trio is all flora.

The affinity machinery already speaks all three layers: census
affinity 'all', census affinity [family], and variant-gated bonus
life. New species design should name its layer first.

Flora note (Ember Scar, 2026-10-15): the Cinder Bloom grows on the
scar's vents and keeps the scar's hours — dangerous country at noon,
warm at midnight. It drinks the heat everything else suffers from.

Flora note (Obsidian Garden, 2026-10-15): the Obsidian Bloom is a
flower of fused black glass — flattened shard-petals around a
violet heart, faintly lit from within. It has no behavior to speak
of (glass does not hunt), but for the record: it does not seed —
solvent reclaim returns a shard, and its harvest is the OBSIDIAN
SHARD crafting material. Creatures chat: whether anything NESTS in
the glass gardens is an open, lovely question.

Flora note (Prism Beds, Saltglass, 2026-10-15): the Prism Reed is a
cluster of translucent crystal blades around a fused shard heart,
in the game's fifth family. It hums faintly at noon (flavor; no
mechanic) and harvests to SALTGLASS SHARD. Like the obsidian
bloom, crystal does not seed — solvent returns the shard. The
Saltglass family's creature seats (family signature + the Thaw's
and Flats' unique seats) are EMPTY and belong to this chat.

Flora note (Ice Fangs, Frost, 2026-10-15): the Rime Spire is a
geyser frozen mid-eruption — clustered ice teeth around a brighter
core tooth — in Frost, the sixth built family (the steady cold;
Saltglass is the swing). Harvests to NEVERMELT ICE; solvent
returns the same (ice does not seed). Frost's creature seats —
family signature, plus uniques for the Stillwhite and the Singing
Ice — are EMPTY and belong to this chat.

Flora note (Rootwood, 2026-10-15): the Heartroot is a buttress
root cluster — arched living-wood slabs around a dense heart —
growing in every Rootwood zone (thickest in the Rootfall) and
harvesting to HEARTWOOD. The family's other furniture is the
BRIDGES: walkable root decks between ladder towers, built from
ordinary structure types. Rootwood's creature seats — family
signature, plus uniques for the Canopy and the Underroot — are
EMPTY and belong to this chat. Something should live ON the
bridges eventually; that is a creatures question, not a flora
one.

Flora note (Precursor, 2026-10-15): the Precursor Bloom is a
too-perfect geometric flower — eight identical petals around a
golden core — planted in Archimedean spirals in every Precursor
zone (the gardeners' signature, still legible). Harvests to
LIVING THREAD + dew; solvent returns the thread. Precursor's
creature seats — family signature (the mimic guardian is the
doc's standing candidate) and a Tending Field unique — are
EMPTY and belong to this chat. THE TENDERS (Adam's ruling,
2026-10-15): there are no machines on this planet; the
gardeners' tenders were FORGED creatures — this taxonomy's own
Forged category — and the ones standing in the game today are
DEAD: big ribcage-and-skull husks generating as scenery,
thickest in the Tending Field. A LIVING tender (if one ever
wakes) is a Forged Fauna design seat for this chat.

Flora note (Bone, 2026-10-15): Gravebloom — a pale flower
rooted in bone itself, marrow-gold heart — grows in every Bone
zone (Marrow Flats thickest) and harvests to BONE MEAL + dew;
solvent returns the meal. Bone country's creature seats —
family signature (a scavenger; the gliders already hold the
sky here by census) and a Leviathan Graveyard unique (what
lives IN the ribs?) — are EMPTY and belong to this chat.
