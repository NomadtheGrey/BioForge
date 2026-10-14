# GENERATION ALGORITHMS — INDEX (BRAINSTORM / LAB)

> **Status: BRAINSTORM — NOT PINNED.** Every algorithm below lives in a
> standalone lab outside this repo (`~/workspace/bioforge-gen-lab/`), where
> it was written, run, and measured. Nothing here is wired into the game.
> Listed **in integration priority order** — per the standing rule,
> algorithms enter the game one at a time, each proven before the next.
> Dated 2026-10-14.

## Shared contract (all generators)

- **Input seed:** the world seed string from the New Game screen, hashed
  with `hashStringToSeed` (FNV-1a). Each generator stage derives its own
  stream (`seed : purpose : stage`), so tuning one stage never re-rolls
  another.
- **Determinism:** same seed + same inputs + same generator version =
  byte-identical output, verified by harness on every generator.
- **Version stamps:** each generator family carries its own version
  (surface GEN_VERSION, CAVERN_GEN_VERSION, RUIN_GEN_VERSION — all
  currently 1), stored with the world/zone so math changes never rewrite
  existing saves.
- **Persistence:** player changes are saved as full world snapshots
  (the save system already built), never as seed diffs. The host generates
  and is the single source of truth; guests receive snapshots, they never
  regenerate.
- **Zones:** interior zones (caverns, ruin interiors) are instances. A
  zone generator takes the world seed plus a **zone id salt**, so many
  distinct zones live in one world. Every zone carries a **portal link
  record**: surface anchor (mouth position + facing) and the player's
  return spawn just outside it. The anchor is stored bookkeeping — it
  never feeds the seed math.

---

## P1 — Surface flora/fauna scatter → the HYBRID

**Status:** built, measured, verified in the lab. Recommendation only;
the hybrid itself is currently a recipe (its two parent variants exist
separately), not yet a single combined variant.

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

## P2 — Biome layer

**Status:** built and proven in the lab; opt-in (`withBiomes`), defaults
off; output byte-identical with the layer off.

**Algorithm:** `biomeAt(seed, x, z)` — a seeded biome map on its own hash
streams. Distance rings decide which ecological types are available
(meadow guaranteed within 12 m of spawn; wetland 12 m+; fungal 30 m+;
ember 44 m+), a per-seed standardized noise field carves boundaries
inside the rings. Measured shares: meadow 23–34%, wetland 29–36%,
fungal 17–21%, ember 13–22%.

**Rules live on the biome** (per the pinned biome/zone split): each biome
carries flora/fauna density multipliers. Species rows carry a `biomes`
affinity list; weight 0 outside the list = the species does not exist
there — proven with a dummy ember-only species (26 spawned, 0 outside
ember). This is the seam for future biome-unique creatures.

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
| surface + biomes | GEN_VERSION | 1 |
| caverns | CAVERN_GEN_VERSION | 1 |
| ruins | RUIN_GEN_VERSION | 1 |
