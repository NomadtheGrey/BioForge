# GENERATION ALGORITHMS — INDEX

> **Status: MIXED (2026-10-14).** P1, P2, and P3 have been promoted from
> the standalone lab (`~/workspace/bioforge-gen-lab/`) into the game and
> are marked **SHIPPED** below. P4 remains lab-proven but not yet wired
> into the game; P5 is future work. The families are listed **in
> integration priority order** — per the standing rule, algorithms enter
> the game one at a time, each proven before the next.

## Shared contract (all generators)

- **Input seed:** the world seed string from the New Game screen, hashed
  with `hashStringToSeed` (FNV-1a). Each generator stage derives its own
  stream (`seed : purpose : stage`), so tuning one stage never re-rolls
  another.
- **Determinism:** same seed + same inputs + same generator version =
  byte-identical output, verified by harness on every generator.
- **Version stamps:** each generator family carries its own version,
  stored with the world/zone so math changes never rewrite existing
  saves. The shipped surface generator is now `WORLD_GEN_VERSION 3`;
  the lab's original `GEN_VERSION 1` remains part of its experiment
  record. Caverns and ruins are still at lab version 1.
- **Persistence:** player changes are saved as full world snapshots
  (the save system already built), never as seed diffs. The host generates
  and is the single source of truth; guests receive snapshots, they never
  regenerate.
- **Surface zones:** the world is a grid of 100 m × 100 m zones,
  addressed by integer zone coordinates. The current playable map is
  the **spawn zone, (0, 0)**. A surface zone's biome and poetic name are
  deterministic functions of the world seed + zone coordinates (see
  P2), so neighboring zones can be identified before travel between
  zones is implemented.
- **Instanced interiors:** caverns and ruin interiors are separate
  instances attached to a surface location. Their generators take the
  world seed plus a **zone/instance id salt**. Every instance carries a
  **portal link record**: surface anchor (mouth position + facing) and
  the player's return spawn just outside it. The anchor is stored
  bookkeeping — it never feeds the seed math.

---

## P1 — Surface flora/fauna scatter → the HYBRID

**Status: SHIPPED (2026-10-14).** The hybrid is implemented in
`src/game/worldGen.ts` and grows the flora/fauna for a new seeded
world. Two game-specific adjustments were made during integration:
the shipped species census is fixed rather than rolled, and the
lantern-fern guarantee is constructed directly on a seeded 6–16 m
ring around spawn instead of relying on a post-pass.

**Algorithm:** positions from **noise-clustered** placement (fbm value
noise thresholding — groves and clearings; flora VMR 1.30, the only
variant that reads as a *place*), species rolled from
**distance-weighted** tables (near/far multipliers per species — docile
and common near spawn, hazardous and strange far; predators 0.0% within
15 m, stalker mean distance 48.2 m). Min-spacing rejection (flora 1.0 m,
fauna 4.0 m) and a lantern-fern guarantee post-pass for the light economy.

**Also tested:** uniform random (baseline), jittered grid (fine for a
tended garden; **disqualified for fauna** — creatures land on a visible
lattice, VMR 0.04).

**Inputs:** seed string; density preset (shipped 8 flora / 5 fauna, full
80 / 24 — the right density is an open playtest question); variant knobs
(cluster scale ~14 m, threshold 0.32, per-species near/far multipliers).

**Watch-outs:** hazard safety is probabilistic (3.7% of snap_traps within
15 m even in the best variant — a hard rule needs a hazard post-pass);
the lantern guarantee re-skins but cannot relocate; the stalker far
multiplier inflates predator counts (~10.3 of 24 fauna).

Detail: SEEDED_GENERATION_BRAINSTORM.md.

## P2 — Biome layer (per-zone)

**Status: SHIPPED, then corrected to the per-zone model (2026-10-14).**
Implemented in `src/game/biomes.ts`, `src/game/zones.ts`, and
`src/game/worldGen.ts`; `WORLD_GEN_VERSION` is now **3**.

**The model:** a biome belongs to a whole **zone**, and the biome is
that zone's identity. Biomes do not patchwork inside a zone. The spawn
zone (0, 0) is always a **meadow**. Every other zone's biome is derived
deterministically from the world seed + zone coordinates by hop bands:

- 1 hop: meadow or wetland
- 2 hops: meadow, wetland, or fungal
- 3 hops: wetland, fungal, or ember
- 4 hops: fungal or ember
- 5+ hops: fungal/ember, with ember dominant

This is the strangeness gradient in zone form: home and its immediate
neighbors stay gentle; the strange biomes live farther out.

**Rules live on the biome** (per the pinned biome/zone split): the
zone's biome supplies flora/fauna density multipliers, species-affinity
weighting, the biome stamp recorded on generated entities, and an even
ground tint across the whole zone. Species rows still carry a `biomes`
affinity list; weight 0 outside the list remains the hard-exclusion
mechanism for future biome-unique creatures. All currently shipped
species remain `'all'`, so naming the first species↔biome pairings is
still a tuning/design step.

**Zone names:** each zone also has a deterministic poetic name drawn
from word pools matched to its biome — a meadow does not receive a name
that reads like a dry thicket or an ember waste. The legacy names live
where they fit: *Turquoise Glade* in the wetland pool, *Violet Cradle*
in fungal, *Prismatic Verge* in ember, and *Amber Thicket* as a fungal
possibility. The four old quadrant labels are no longer zone or biome
names; the quadrants are only sector shading on the current map.

**Player-facing geography now in the game:**

- The HUD identifies the current zone by name, biome, and coordinates.
- Within 10 m of the current map edge, it also names the neighboring
  zone in that direction and that zone's biome.
- The minimap/survey shows the current zone's name, biome, and grid
  coordinates.
- The radar rim carries a home arrow toward the spawn point. Its
  longer-term equipment framing is recorded in `CORE_MECHANICS.md`:
  the player will eventually assemble a **Prismatic Field Radar** from
  four biological subassemblies — including parts from two planned
  species, Echo Reed and Vesper Glider — rather than treating the full
  navigation suite as an abstract permanent gift.

**Lab history:** the lab first modeled biome as a per-point field
inside one map (distance rings + standardized noise). That experiment
proved the density/affinity mechanics, but Adam corrected the game's
model to per-zone identity the same day. The per-point `biomeAt` map
was therefore removed from the game and should not be reintroduced as
the surface-zone model.

## P3 — Cavern generator

**Status:** built, validated, independently re-verified in the lab.

**Algorithm:** cellular automata + graph repair, for instanced cave zones
(64×64 cells at 2 m = a 128 m zone behind a cave-mouth portal).
Seeded wall fill (~45%) → 5 neighbor-rule smoothing passes → flood-fill
region analysis → corridors carved between kept chambers, tiny pockets
filled, 2 deliberate loop corridors (escape routes) → BFS depth field
from the entrance grades all features (glow fungus and easy resources
shallow; rare minerals and hazards deep; the deepest cell is the heart)
→ built-in validation (single connected region, every feature reachable,
corridor width spot-check). Measured: open floor 57–62%, raw regions
2–4 collapsing to 1 after repair. `fillProb` is the blob-vs-maze dial
(0.42→0.48 swings open floor 65%→48%).

**Inputs:** seed string + zone id salt (+ optional surface anchor for
the portal link record — bookkeeping only, never seed math).
**Version:** CAVERN_GEN_VERSION 1.

**Stubbed:** generic feature types only; no transition code, no
verticality, no liquids. Open experiment: biased drunkard's-walk
corridors vs the current L-shaped carves.

**Surface half — BUILT in the lab (2026-10-14).** The interior above
only covered the underground; `caveSurfaceLab.mjs`
(CAVE_SURFACE_GEN_VERSION 1) now generates the on-surface section: for
a given zone (seed + coords + biome + hops + caller-supplied blockers)
it rolls mouth presence (the spawn zone always gets exactly one, in a
20–42 m annulus clear of the homestead; other zones roll by biome —
fungal/ember zones are more cave-prone, some zones get two, some
none), places mouths with footprint clearance from structures and
scatter, faces them toward the zone center, and dresses each one
(rock lips, boulder arc, rubble, path stones, a biome accent) with a
guaranteed-clear approach corridor. Each mouth pairs with its cavern
instance through the portal-link record; the anchor invariance was
re-verified with surface-chosen anchors (cave grids byte-identical,
exit spawn exactly 2 m out). All harness checks pass, including a
stress run against full-density scatter as blockers.

**Surface half — SHIPPED in the game (2026-10-14).** The generator
graduated to `src/game/caveSurface.ts` (lab parity verified) and
world generation (WORLD_GEN_VERSION 4) grows mouths with the world:
new seeded worlds get exactly one cave mouth in the spawn zone,
placed clear of the homestead and the grown flora/fauna. Every
mouth is also ringed by 3–4 living **Glow Spore Clusters** — a real
harvestable flora species (yields Glow Spores) that keeps to cave
mouths, seeded outside the approach corridor. A mouth is
a `cave_mouth` structure — it rides the normal structures / save /
sync pipeline — carrying its portal link (instance id + exit spawn)
and dressing list as stored data; the engine renders the dressing
(rock mound, black opening, towering boulders, path stones, biome
accent, and a pulsing, procedurally drawn glow sigil on the rock
face above the opening — the entrance sign) and the mouth is
permanent (the solvent is refused) with its own collision and a
violet halo. Mouths grow only at world creation;
existing saves keep their snapshots, per the persistence rule.

**Interior — SHIPPED in the game (2026-10-14).** The cavern
generator graduated to `src/game/cavern.ts` (byte-identical grids
vs the lab). Clicking a mouth enters its instance — generated from
the mouth's instance id alone, so co-op guests rebuild the same
cave from the synced entity without the world seed — and a
`cave_exit` portal at the entrance cell returns the player to the
mouth's stored exit spawn. Underground is its own scene: instanced
cavern walls, glow-fungus light clusters, resource/rare/hazard
decor graded by depth, the heart crystal at the deepest cell,
permanent dark, flat underground height, grid collision. V1
limits: no building or planting underground; a save taken inside
writes the parked surface world with the player at the exit
anchor; peer avatars carry a zone tag and hide across zones. P3
is complete end-to-end.

## P4 — Ruin interior generators

**Status:** built, measured, verified in the lab (24 runs: 3 variants ×
small/grand × 2 fates × 2 seeds — all validate, all deterministic,
reachability independently re-verified). Recommendation: roomGraph
primary, with a fate×variant pairing idea (below). Full detail:
RUINS_GENERATION.md.

**The candidates:**
- **roomGraph** — rooms grow root-like from the entrance room
  (the stashed house design); purposeful, irregular, grown.
  Grand tier: 14.2% floor, max depth 4.75.
- **bsp** — binary space partition; one room per partition, sibling
  corridors; architectural, engineered. Grand tier: 22.3% floor,
  max depth 6.25. Reads as a crash site better than as a garden.
- **placedRooms** — non-overlapping rooms scattered with gaps, joined
  by minimum-spanning-tree corridors plus loops; a compound feel.
  Grand tier: 19.8% floor, max depth 7.5. The fallback.

**Shared inputs:** seed string + zone id salt + **world fate** + **size
tier**. The fate is the per-world style bundle (archetype, room biases,
damage flavor) — all ruins in one world share its style, so different
worlds' ruins read differently (a Gardeners world grows cultivation
vaults, a Crash world is a broken vessel). **Measured: fate moves the
numbers more than variant choice** (gardeners: room-area variance
~380–395, ~88 overgrowth cells; crash: variance ~38–50, 12 rubble
cells) — which motivates the pairing idea: let the fate choose the
layout variant too (gardeners → roomGraph, crash → bsp), so per-world
difference is structural, not just decorative.

**Placement & size tier:** a ruin is a surface presence (visible
structure + entrance) whose interior is its own instanced zone.
Distance from spawn is measured in **zone hops, not meters** (Adam,
2026-10-14): presence is sparse and probabilistic (~one ruin per
zone, two if really lucky, some zones/biomes none); size ramps with
hop count and saturates ~8 zones out — the spawn zone gets at most
traces, hop 1 is small (4–6 rooms), 8+ approaches grand (16 rooms,
loops, a secret, the story's heart deepest). The placement stage is
designed but not yet built; the lab implements the ramp's two ends.

**Damage pass:** collapse and overgrowth applied per fate after layout,
under one hard rule — never seal a room (collapse only touches
non-bridge graph edges); validation proves every room reachable after
the centuries have run. Known blemish: small-tier ruins take zero
rubble (corridors too short for the collapse rules).

**Version:** RUIN_GEN_VERSION 1.

## P5 — Terrain (future)

**Status:** not started. Will need several layers (base form, biome/
moisture fields, scatter, zones) — the layered approach is the design,
with Adam's layered Unity terrain plugin as the reference point. The
lab's generators are being built as composable layers with this in mind.

---

## Version table

| family | version constant | current |
|---|---|---|
| shipped surface + per-zone biomes | WORLD_GEN_VERSION | 3 |
| lab surface experiments | GEN_VERSION | 1 |
| caverns | CAVERN_GEN_VERSION | 1 |
| ruins | RUIN_GEN_VERSION | 1 |
