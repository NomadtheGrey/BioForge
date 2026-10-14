# SEEDED WORLD GENERATION — LAB FINDINGS (BRAINSTORM)

> **Status: LAB RECORD + IMPLEMENTATION UPDATE (2026-10-14).** The
> measurements below remain the lab's brainstorm record. Since they were
> written, the surface hybrid and biome mechanics have shipped in the
> game with the adjustments noted here — most importantly, Adam
> corrected biomes from a per-point map inside one zone to **one biome
> per zone**. The current shipped account is in
> `GENERATION_ALGORITHMS.md` (P1/P2).

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

## Recommendation (now shipped, with game adjustments)

**Hybrid: noiseClustered positions + distanceWeighted species mix, with the
biome layer on.** The game fixes the shipped species census instead of
rolling it, and guarantees lantern ferns by constructing them first on
a seeded 6–16 m ring around spawn.

- Noise-clustered placement is the only variant that makes groves, clearings,
  and herds — a world that reads like a *place* instead of a sprinkle.
- Distance weighting enforces the settled rule that danger and strangeness
  rise with distance from spawn (predators 0.0% within 15 m; stalkers pushed
  to a 48.2 m mean). Each species gets near/far multipliers; docile near,
  hazardous far.
- jitteredGrid fauna lands on a visible lattice (VMR 0.04) — never ship it
  for creatures. Uniform stays as the honest baseline.

## The biome seam (lab mechanics; game model corrected)

Room was left — and then built — for more biomes, more species, and
species unique to one biome:

- **BIOMES table** — ecological types (meadow / wetland / fungal / ember),
  not place names, carrying per-biome flora/fauna density multipliers.
  (Biolume Caverns is an instanced interior, not a surface biome.)
- **Lab's original `biomeAt(seed, x, z)`** — a deterministic per-point
  biome map using meter rings and a standardized noise field. It proved
  the seam in the lab, but **it is not the shipped game model**. Adam
  corrected the design to per-zone identity: one surface zone has one
  biome, selected from seed + zone coordinates by zone-hop bands. The
  game's per-point `biomeAt` was removed; generated entities are now
  stamped uniformly with their zone's biome.
- **Species affinity** — every species row carries a `biomes` list ('all'
  by default). A dummy lab-only species, `ember_orchid` (ember only),
  proved exclusivity: 26 spawned across 6 runs, **0 outside ember**. Zero
  weight = dropped entirely, so biome-unique species are a hard rule, not
  a tendency. A future biome-unique creature is one table row.
- **Versioning** — the lab used `GEN_VERSION = 1`; the shipped surface
  generator now stamps `WORLD_GEN_VERSION = 3` after the per-zone
  correction. Same seed + same shipped version = same generated zone,
  while existing saves keep their stored snapshots.

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

The cavern and ruin generators were subsequently built and verified in
the lab. Per the one-at-a-time integration rule, **P3 caverns are the
next generation family to promote into the game**, followed by P4
ruins; layered terrain remains later still. Current status for every
family lives in `GENERATION_ALGORITHMS.md`.
