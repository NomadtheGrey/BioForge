# BioForge Creatures — Part 6: Far Country Teeth

*Pinned by Adam, 2026-10-17 (creatures chat). The question that opened it:
"Do we have enough truly dangerous creatures out far away to challenge the
player?" The audit's honest answer: enough dangerous SPECIES, but the far
country only challenges a player who goes looking — the giants are
provoked-only (Adam's slice-32 pin) and ordinary hunters hunt exactly as
hard at 8 hops as at 2. This part fixes the pressure, two ways.*

## The frame

"Tier 3 country" in code = the storm and living families (tier 3, minHops
3, rarity doing the far work), and the deepest ground in the game is the
ring of variants gated at 4+ hops: Magnetic Dunes, Skyfall Basin,
Twominded Valley, Frost Fangs, the Leviathan Graveyard, the Ember Scar,
and kin. Division of labor:

- **The gradient** (existing creatures) covers ALL far country in tiers
  2–3 and keeps rising with distance — under a hard cap.
- **Three new predators** anchor the three far places that most deserve
  a name to fear.

## Half 1 — THE DISTANCE GRADIENT (slice 50)

Applied at SPAWN from the zone's tier and hop count (worldgen stamps the
scaled values; no species-table edits; near country is untouched). Adam's
cap ruling: "Not absolutely — at some point they'll be ridiculous." Every
axis is capped, and the caps are the design, not an afterthought.

| Axis | Rule | Cap |
|---|---|---|
| Hunter damage | +12% per tier above 1, +4% per hop beyond 5 | +60% |
| Aggro range | +10% per tier above 1, +3% per hop beyond 5 | +50% |
| Hunter density | ×1.25 tier 2, ×1.5 tier 3, +10% per hop beyond 5 | ×2 |
| Persistence (leash) | scales with the aggro axis | +50% |

The persistence axis is the one that changes the FEEL: out far, things
don't just hit harder — they don't quit. Peaceful mode still spares
everything (the shared combatArmed gate); every tell stays as readable
as it is today. WORLD_GEN_VERSION bumps; new species and scaled hunters
appear only in newly generated zones, per the standing rule.

## Half 2 — THE THREE FAR PREDATORS (slice 51)

All variant-locked bonus spawns (the pond/river gate pattern), so each
exists ONLY in its named country in newly generated zones. Calibration
bench: today's unprovoked hunters top out at 18 damage / 10 m aggro; the
provoked giants run 25–55. These three sit between — real teeth, below
the giants. All three stay inside the danger doctrine: unprovoked, never
untelegraphed; Peaceful spares them like everything else.

### LODESTONE HOUND — Fauna × Forged — Magnetic Dunes (storm variant, 4+ hops)

A hound plated in iron it grew itself, coursing the dunes in wide arcs,
reading the iron in the ground — and in you.

- Hunt: aggro 14 m, bite 22, bite range 2.2, cooldown 1.8 s; health ~90;
  speed a fast trot just under player sprint.
- THE STARE (its tell, bespoke): before its FIRST charge it stops dead
  and stares, head locked on the player, for 2 full seconds. Break away
  (range or line) during the stare and the hunt resets — it goes back to
  coursing. Footfalls ring on the iron sand: you hear it before the stare.
- Tame floor 8% (dangerous-species band, honest).
- Drop: **Lodestone Plate** ×2–3 (new item, premium craft material —
  deliberately gating nothing critical; the universal sample rides along).
- Field Note: *"It rings when it walks on the iron sand, and it looks at
  you a long time before it decides. Use the looking."*

### FALL HAWK — Fauna × Ordinary — Skyfall Basin (storm variant, 4+ hops)

It hunts from the basin's thermals and FALLS on what it catches in the
open. (Named around the Storm Kite, a peaceful perch species — no kin.)

- Hunt (aerial): while the player is in the OPEN within 18 m of its
  shadow-line, it stoops — 26 damage on the dive — then must climb a
  full 8 s before it can dive again. Landed/on the ground it is a poor
  fighter (bite 10): its country is the sky.
- Tells: its shadow crosses you first; a thin whistle on the dive.
- Counterplay: canopy, roofs, and ruin cover make the player
  untargetable. The climb window is safe ground time.
- Health ~55; tame floor 5%. Drop: **Fall Plume** ×2 (feather family —
  kept distinct from fur/down per doctrine).

### HUSH HOUND — Fauna × Gel — Twominded Valley (living variant, 4+ hops)

The valley's other dog. The Threshold Hound shows you the door; this one
is the door closing. A piece of the valley itself, walked loose.

- Hunt: aggro 12 m, bite 20, bite range 2.0, cooldown 1.6 s; health ~120
  (you are meant to LEAVE, not kill it — killing is possible and pays).
- THE LONG PURSUIT (bespoke): speed just above walk, below sprint — and
  it does not give up. Its leash is effectively the whole zone; it keeps
  coming until the player leaves the valley country or reaches sanctuary.
- Tell: the valley goes QUIET around it — small life flees it, so a
  still, empty pocket in living country IS the warning. Listen for the
  absence.
- Sanctuary: it circles the valley heart but never enters the heart
  clearing (the heart rule that already governs the valley's staff).
- Tame floor 5% — the valley rarely lets go of a piece of itself.
- Drop: **Hush Gel** ×2–3 (gel material, distinct item from the gloom
  economy's gels; premium, gating nothing critical).

Each predator ships with: species table entry, variant-gated spawn,
codex entry, Field Note (above; unlock on scan, witness stamp when its
signature move commits near the player), and a mesh riding an existing
profile with one signature silhouette piece (plate ridges / stoop wings
/ the long gel hound).

*Build amendment (slice 51, from the spawn smoke test): the three
predators are EXEMPT from the gradient on both axes. Their table rows
were written already-scaled for their named country — a 22 bite is the
design, not a base for the gradient to multiply toward 35 — and each
is a seated individual: its zone holds exactly ONE (the density axis
would otherwise deal a second Hush Hound into the same valley, which
breaks the fiction and the encounter alike). The exemption is a named
set (FAR_APEX_IDS) in worldGen beside farPressureFor.*

## Build shape

- Slice 50: the gradient — worldgen spawn-stamping + sim read; types
  additive only (types/game.ts stays whole, per Adam's pin).
- Slice 51: the three predators.
- Both stage on wip per the ALL-TO-WIP rule; the 800-zones harness takes
  the new expectations and the variant-string audit runs as always
  (magnetic_dunes / skyfall_basin / twominded_valley all verified as
  real variant ids in world/biomes.ts before a line was written).
