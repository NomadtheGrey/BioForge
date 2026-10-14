# RUINS GENERATION (BRAINSTORM / LAB)

> **Status: BRAINSTORM — NOT PINNED.** Built and measured in the
> standalone generation lab (`~/workspace/bioforge-gen-lab/`,
> `src/ruinsLab.mjs`, run `node evaluate-ruins.mjs`). Nothing here is
> wired into the game. Dated 2026-10-14. This doc parks the ruins
> algorithm so it can be tested and argued with; the final variant call
> still needs Adam's eye on the maps.

## What a ruin is

A ruin is **two generators, not one**:

1. **Surface presence** — a visible structure/landmark with an entrance
   on the surface of a zone. (Not yet built — the placement stage.)
2. **Instanced interior** — its own zone behind the entrance, same
   portal pattern as the caverns, reusing the portal link /
   return-address record: the interior stores a surface anchor (mouth
   position + facing); exiting places the player just outside the
   entrance, facing away, so they don't instantly re-trigger the
   portal. The anchor is stored bookkeeping in the save's zone-link
   table (host-authoritative) — it **never feeds the seed math**, or
   moving the data would change the layout.

Ruins are **grown/feral precursor structures**, not masonry-and-machines
(pinned concept). Interiors are room-based.

## Placement: distance is counted in ZONE HOPS, not meters

(Adam's model, 2026-10-14. This supersedes any meter-band framing.)

The world is a graph of zones. A ruin's "distance from spawn" is the
number of zones a player traveled through to reach the current zone —
BFS hops on the zone graph from the spawn zone. Meters govern things
*inside* a zone (scatter, biome rings); hops govern things *between*
zones (ruin presence, ruin size, strangeness).

**Presence — sparse and probabilistic.** Per zone, the placement stage
rolls:

- most eligible zones get **one** ruin;
- a lucky few get **two** ("really lucky");
- some zones get **none** — and some biome types may never host ruins
  at all (type-level eligibility is an open knob).

Exact percentages are undecided knobs. The *shape* is the decision:
finding a ruin should feel like something, not a per-zone guarantee.

**Size — a ramp on hop count, saturating around 8 hops:**

| hops from spawn zone | ruin scale |
|---|---|
| 0 (spawn zone) | traces at most — surface remnants, no real interior; matches the pinned first-zone remnant (small, dilapidated, obviously built, off the main path, no text, no marker) |
| 1 | small interior (lab's small tier: 4–6 rooms) |
| 2–7 | steady growth — more rooms, deeper clue layers, better artifacts |
| 8+ | approaching maximum (lab's grand tier: 16 rooms, loops, a secret, the story's heart in the deepest room) |

So the interior generator's **size tier is a readout of the zone
graph**: placement computes the hop count, the ramp converts it to a
tier, the interior builds to that tier. The lab currently implements
the two ends of the ramp (small, grand); middle tiers get defined when
the placement stage is built.

## The interior generator

**Contract:** `generateRuin(seedStr, { variant, tier, fate, zoneId,
surfaceAnchor? })` → grid + rooms + room graph + features + damage +
portal `link` + validation. `RUIN_GEN_VERSION = 1`, versioned
separately from the surface and cavern generators. Deterministic:
same seed + inputs + version = byte-identical layout, verified on
every run. Passing a surface anchor never changes the layout
(anchor-invariance verified on all combos).

**Three layout variants were built and compared head-to-head**
(24 runs: 3 variants × small/grand × 2 fates × 2 seeds — all validate,
all deterministic, every room independently re-verified reachable):

- **roomGraph** — rooms grow root-like from the entrance room, each
  new room attaching adjacent to a random existing room, then loop
  edges added. Reads as *grown*: an organic, off-center, root-ball
  cluster of irregular chambers. The stashed house candidate.
- **bsp** — binary space partition, one snug room per leaf, siblings
  connected up the split tree. Reads as a *building*: tidy rectangular
  blocks, the most floor area, the most architectural corridors.
- **placedRooms** — scattered non-overlapping rooms joined by
  minimum-spanning-tree corridors + loops. Reads as a *compound*:
  pavilion-like rooms, longest corridors, deepest graphs.

**Headline averages (grand tier):**

| variant | rooms | floor % | max depth | loops | dead ends | secret |
|---|---|---|---|---|---|---|
| roomGraph | 16 | 14.2 | 4.75 | 2 | 5 | always |
| bsp | 16 | 22.3 | 6.25 | 2 | 4.75 | always |
| placedRooms | 16 | 19.8 | 7.5 | 2 | 3.75 | always |

Every run has exactly one secret room and one artifact-heart room
(the deepest); clue/artifact placement grades by graph depth —
mundane evidence near the door, the story's heart deepest.

## Fate is the per-world style input

Ruins must look and feel **distinct per world** (there will be many
worlds). The mechanism: the generator takes the world's **fate** —
set at world creation, stored with the save — as a style bundle:
room-grammar biases (size regularity) + a damage flavor (collapse vs
overgrowth) + clue/artifact flavor. All ruins in one world share that
world's style; different worlds roll different fates (eleven in the
lore brainstorm), so their ruins read differently. Who or what picks
a world's fate is still an open question from the lore brainstorm.

**Measured: fate moves the numbers more than the variant choice does.**
Same algorithm, different fate (grand tier):

| variant | fate | room-area variance | rubble cells | overgrowth cells |
|---|---|---|---|---|
| roomGraph | gardeners | 394.6 | 2 | 87.5 |
| roomGraph | crash | 50.5 | 12 | 9.5 |
| bsp | gardeners | 380.6 | 2 | 89 |
| bsp | crash | 37.5 | 12 | 9.5 |

Gardeners = irregular rooms reclaimed by flora; crash = regular
modules with rubble across the corridors.

## The damage pass (run the centuries)

After layout, a per-fate damage pass applies collapse and/or
overgrowth. One hard rule, held on all 24 runs: **damage can never
seal a room.** Collapse only touches non-bridge graph edges (leaf
edges — including the secret's — are bridges and can never be
blocked); room shrinking reverts if a door would lose its floor.
Validation must prove every room reachable *after* the centuries
have run.

## Recommendation (not pinned)

- **roomGraph as the primary** — it matches the stashed sketch and
  the biological-precursor pin better than the alternatives.
- **Sharper idea — let the fate choose the layout variant too:**
  gardeners → roomGraph, crash → bsp. Then per-world difference is
  structural, not just decorative. bsp reads as a crash site far
  better than as a garden.
- **placedRooms is the fallback** if either primary misbehaves.

## Known blemishes

- **Small-tier ruins take zero rubble in every variant** — collapse
  needs corridors long enough for its rules, and small-tier corridors
  are too short. Small ruins currently look undamaged; if they
  should look aged, collapse needs a short-corridor mode.
- The secret's corridor is width 2 like all others — secrecy is
  currently flavor-only.
- roomGraph clusters can land one-sided (all rooms in one quadrant) —
  organic, but occasionally reads as half a ruin.
- Overgrowth/rubble cells are paint, not physics — the game engine
  decides what they do; the lab only guarantees reachability.

## Stubbed / not built

- The surface placement stage (presence roll, hop counting, exterior
  landmark) — designed above, not implemented.
- Middle size tiers between small and grand.
- Real clue/artifact content, portal transition code, zone names,
  verticality, liquids.

## Integration notes (when Adam gives the go)

- Algorithms enter the game **one at a time**, each proven in-game
  before the next (standing rule). Ruins are P4 in
  GENERATION_ALGORITHMS.md.
- The host generates; guests receive the zone via world snapshot —
  nobody regenerates. Player changes persist as full snapshots, never
  seed diffs.
- Saves must store `RUIN_GEN_VERSION` per zone; changing the layout
  math later = a version bump, never a silent rewrite of existing
  worlds.

*Lab source of truth: `~/workspace/bioforge-gen-lab/FINDINGS.md`
(ruins section) and `output/ruins/report.md` + SVG maps.*
