# SEEDED WORLD GENERATION — LAB FINDINGS (BRAINSTORM)

> **Status: BRAINSTORM — NOT PINNED.** Results from a standalone experiment
> lab (kept outside this repo). Nothing here is a design decision until it's
> moved into CORE_MECHANICS.md. Dated 2026-10-14.

## What the lab is

An experiment space for generating a consistent BioForge world from a single
seed string (hashed with the game's own `hashStringToSeed`, toolkit ported
from `src/game/motion.ts`): same seed → byte-identical world, verified.
Scope so far: flora and fauna scatter only. Four variants were compared at
shipped density (8 flora / 5 fauna, mirroring today's hand-placed world) and
at a fuller density (80 / 24), across three seeds.

## Headline results (full density, 3-seed averages)

| metric | uniform | jitteredGrid | noiseClustered | distanceWeighted |
|---|---|---|---|---|
| flora clustering (VMR, >1 = clumped) | 0.83 | 0.30 | **1.30** | 0.84 |
| fauna clustering | 1.07 | **0.04** | **1.10** | 1.04 |
| % hazards within 15 m of spawn | 0.0 | 8.9 | 4.8 | 3.7 |
| % predators within 15 m | 3.3 | 0.0 | 4.8 | **0.0** |
| chitin_stalker mean distance | 37.0 m | 38.1 m | 39.7 m | **48.2 m** |

## Recommendation (for when generation is wired in)

**Hybrid: noiseClustered positions + distanceWeighted species mix, with the
biome layer on.**

- Noise-clustered placement is the only variant that makes groves, clearings,
  and herds — a world that reads like a *place* instead of a sprinkle.
- Distance weighting enforces the settled rule that danger and strangeness
  rise with distance from spawn (predators 0.0% within 15 m; stalkers pushed
  to a 48.2 m mean). Each species gets near/far multipliers; docile near,
  hazardous far.
- jitteredGrid fauna lands on a visible lattice (VMR 0.04) — never ship it
  for creatures. Uniform stays as the honest baseline.

## The biome seam (built, proven)

Room was left — and now built — for more biomes, more species, and species
unique to one biome:

- **BIOMES table** — ecological types (meadow / wetland / fungal / ember),
  not place names, carrying per-biome flora/fauna density multipliers.
  (Biolume Caverns is an instanced interior, not a surface biome.)
- **`biomeAt(seed, x, z)`** — deterministic biome map on its own hash
  streams. Distance rings decide which types are available (meadow
  guaranteed within 12 m of spawn; wetland 12 m+; fungal 30 m+; ember
  44 m+), and a per-seed standardized noise field carves organic boundaries
  inside the rings. Measured shares: meadow 23–34%, wetland 29–36%,
  fungal 17–21%, ember 13–22%.
- **Species affinity** — every species row carries a `biomes` list ('all'
  by default). A dummy lab-only species, `ember_orchid` (ember only),
  proved exclusivity: 26 spawned across 6 runs, **0 outside ember**. Zero
  weight = dropped entirely, so biome-unique species are a hard rule, not
  a tendency. A future biome-unique creature is one table row.
- **GEN_VERSION = 1** is stamped into generated worlds. Turning the biome
  layer on in the game is a generation-math change — the save record must
  store the genVersion a world was created with, or the same seed will
  produce a different world later. Same seed + same GEN_VERSION = same
  world, forever.

## Caveats the lab surfaced

- **Density is the biggest open knob.** At shipped density (8/5) every
  variant reads as an empty world; the hand-placed world compensates by
  clustering near spawn. The right generation density is a playtest call.
- **Hazard safety is probabilistic, not guaranteed** (3.7% of snap_traps
  within 15 m even in distanceWeighted). If the safety gradient becomes a
  rule, add a hazard post-pass (nudge/re-skin hazards inside 15 m).
- **The lantern-fern guarantee re-skins but can't relocate** — on an
  unlucky seed its "near spawn" ferns sat 32 m+ out. A real fix relocates
  points or adds a near-spawn density floor.
- Distance multipliers inflate raw counts if unchecked: the stalker far
  multiplier (2.6×) raised predators to ~10.3 of 24 fauna.

## Verification note

The lab's first run contained a real bug (spacing silently unenforced for
two variants, plus an untrustworthy violations counter) — caught by
independent re-checking, fixed, and all numbers above are from the
corrected run: spacing enforced and measured geometrically (0 violating
pairs, flora ≥ 1.0 m / fauna ≥ 4.0 m), determinism PASS on every variant,
biome layer off = byte-identical output to pre-biome runs.

## Queue after this

Per the 2026-10-14 plan: a **cavern generator** next, then a **ruins
generator** — both as instanced-zone generators (interior zones are their
own space; the cave entrance behaves like a portal, looks like a cave).
Starter sketches for both already live in WORLD_GENERATION_BRAINSTORM.md.
Actual terrain (layered) comes later still.
