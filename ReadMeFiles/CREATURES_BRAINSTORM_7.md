# CREATURES BRAINSTORM — PART 7: THE CAVE CITIZENS

*Filed 2026-10-18, the creatures lane. Adam's assignment, verbatim:
"Let's have Creatures work on the cave creatures." Caves were parked
2026-10-15 behind two gates — the overworld roster finishing, and
Normal difficulty needing its death/respawn rule — and both gates
have since closed (roster complete at 361; death/respawn pinned:
the dead reappear at their spawn point). This part designs the
fauna of the cavern instances: who lives at depth, how they get
there, and what they do when the light arrives.*

## 0. THE FOUNDATIONS (Adam's pins, not reopened here)

- Caverns are INSTANCED zones (the portal pattern): a mouth on the
  surface links to a generated space with its own rules. The cavern
  generates from the mouth's instanceId ALONE, so every client —
  co-op guests included — rebuilds the identical cave.
- Depth is a LEVEL fed to the same generator (seed = instanceId +
  depth). The stack runs surface → L1 → L2 → … with NO cap; the
  descent roll (55% at L1, 40% deeper, +5% per zone-hop from spawn,
  capped +30%) makes depth self-limiting. Strata: **L1 Biolume
  Caverns, L2 The Violet Deep, L3 The Abyssal Dark, L4 The Lightless
  Deep, L5 The First Dark**, and plain depth counts below.
- Cave monsters belong to **Normal and Hostile**. Peaceful caves
  stay safe. (How safety is kept is §4.)
- What lives at depth is decided by the world's **fate × remnant**:
  degenerate worlds hold the cave monsters as DEVOLVED PEOPLE;
  extinct worlds hold ecology only; survivors-underground worlds
  hold the BUNKER PEOPLE — a hidden settlement, not monsters, and
  a far-future NPC piece that STAYS PARKED through this program.
- The cavern's flora already graduated (glow fungus, sunshard and
  prism clusters are real harvestable flora in the instance list).
  Its features — hazards, the descent, the heart crystal — stay
  scenery. Today's instance fauna list is EMPTY: this part fills it.
- Caves wear the biome they're dug under, fading with depth
  (biomeTint): "the deep forgets the surface." Cave fauna read the
  same way — the L1 citizens are near-kin of the surface's gloom
  country; below L3, nothing up there has a name for what's down
  here.

## 1. THE PIPELINE — DEPTH-BANDED DEALING

Surface fauna are dealt by worldGen from biome, variant and gate.
Cavern fauna are dealt by a sibling module —
`src/game/creatures/cavernFauna.ts` — from DEPTH:

- `dealCavernFauna(cavern, instanceId, depth)` runs inside
  useInstances' `enterCavernLevel` — the one door every cavern
  level enters through, shared by entry and descent — exactly
  where the level's flora are dealt today. The fauna list it
  returns replaces the empty array the instance ships now.
- The dealer reads the cavern's own grid: floor cells only,
  entrance neighborhood excluded (nothing spawns in the doorway),
  positions spread by minimum spacing on the dealer's own seeded
  stream (instanceId + depth + 'cavern:fauna'), so the cavern's
  layout streams are never perturbed — CAVERN_GEN_VERSION does
  not move, and existing caves keep their shapes; they simply
  gain citizens.
- Species carry NO bonusSpawn: the cavern roster table lives in
  the dealer (depth band → species → count range), the mirror of
  how the surface keeps its gates in worldGen. A cavern species
  can never leak onto the surface, and a surface species can
  never leak down — the two dealers share no table.
- Deterministic ids (`cavefauna_<instanceId>_d<depth>_<n>`), so
  co-op peers in the same level agree on which creature is which,
  exactly as cave flora already do.
- Counts are per LEVEL, not per cave: every descent deals a fresh
  band. Instances are never saved (a player inside a cave saves
  the parked surface world and wakes outside), so cave fauna need
  no persistence — re-entering a level re-deals it, wildlife
  renewed, the same law the surface's zones live by on travel. (One edge
  the law creates, stated plainly: a cave citizen TAMED inside a
  level is renewed with it — cave pets are for the delve, not
  the homestead. If that ever changes, it changes in the
  instance layer, not in this roster.)

Depth bands (v1):

| Depth | Gloom Skitter | Spore Husk | (later slices) |
|---|---|---|---|
| L1 Biolume Caverns | 3–5 | 0–2 | |
| L2 The Violet Deep | 2–4 | 1–3 | Pale Stalker 1 (C2) |
| L3 The Abyssal Dark | 2–3 | 2–3 | + Deep Maw 1 at the heart (C3) |
| L4+ | 2–3 | 2–3 | the L3 band holds |

## 2. SLICE C1 — THE ECOLOGY (this build)

### GLOOM SKITTER — Fauna × Gel

The L1 citizen, kin to the gloom country's gels the way the Eave
Bat is kin to the surface's ruins: a palm-sized skittering body on
six quick legs, dark translucent gel over a paler core, two eye
dots that catch light it wants no part of.

- **The trick: it is LIGHT-SHY.** It flees the player's approach
  radius — the honest v1 reading of "it flees your lantern": a
  skitter bolts at burst speed when the player closes within
  6 m, darts 8–10 m off, and settles. It never attacks
, has no
  hunt block, cannot damage anyone in any difficulty. In Peaceful
  it is pure atmosphere; in Normal it is the first thing that
  teaches a delver the cave is inhabited.
- Numbers: hp 18, speed 2.6 (burst ×1.7 on the flee), tame 30%
  (bait category nectar — it eats what the cave grows, and nectar is close enough to lead it). Kill loot:
  gloom_chitin ×1. Byproduct: none — it is not a farm.
- When C2's light signal lands (§3), the skitter adopts it: lit
  players repel it from farther; dark players can walk almost
  up to one. Noted here so C2 doesn't forget C1's citizen.

### SPORE HUSK — Fungus × Gel

A sessile colony: a ribbed, translucent dome the size of a
sitting dog, grown over a ring of stub feet it long ago stopped
needing, breathing slowly. The cave's first teeth — environmental,
patient, and entirely avoidable by anyone watching where they step.

- **The trick: THE BURST.** Cycle on the sim's social slots:
  DORMANT (breathing; player beyond 3.2 m) → SWELLING (player
  inside 3.2 m: the dome swells visibly over 1.2 s — the
  readable tell; step out and it subsides) → BURST (if the
  player is still inside 4.5 m when the swell completes:
  a spore cloud — 12 damage where difficulty arms it, and the
  colony scatters 2 husk_spore as ground pickups through the
  critter-excrete path) → SPENT (deflated, harmless, 45 s) →
  DORMANT again.
- The doors are honest: walk around it (corridors are wide and
  husks never grow in doorways of the deal — spacing and the
  entrance exclusion see to that), out-wait the swell, harvest
  the burst it gives up, or kill it (hp 30; kill loot husk_spore
  ×2, gloom_chitin ×1). Colonies also weep a single husk_spore
  on a long byproduct cycle (600 s): patience is a door too.
- Codex type 'flora' (it is a fungus; the codex files fungi with
  the flora) though it lives and ticks in the fauna list, where
  the sim's state machines are.
- Field Notes: neither C1 citizen gets one. Notes are for
  bespoke beings; these two are ecology. The stalker's and the
  Maw's notes arrive with their slices.

New items (both premium cave materials, gating nothing critical):
**gloom_chitin** (the dark plate of cave things) and
**husk_spore** (the colony's own seed-dust).

## 3. SLICE C2 — THE PALE STALKER (designed, next build)

Fauna × Ordinary, L2 down, one per level. Blind, tall, and patient:
it hunts by LIGHT and SOUND, and it makes the lantern a decision.

- It needs one new signal into the sim: whether the player is
  LIT (a lit lantern in the Left Hand, a placed lamp near, the
  Lantern Shield's glow) — passed to updateTick the way the
  armed flag already is, derived in App from the held item and
  nearby light structures. The stalker's detection is then
  two-channel: a lit player is perceived at 16 m (and the stalker
  turns toward the light even beyond bite intent — the tell);
  a dark, still player at 4 m; a dark, MOVING player at 8 m
  (sound). Crouch-still in the dark is the honest counterplay.
- Hunt shape: it stalks at walking pace and only commits inside
  6 m; its bite is heavy (26) and slow (2.4 s). The gradient
  does not apply — its table is written for its country, the
  apex rule. Taming floor 5%: you do not befriend the thing
  that listens for you; a 5% floor says a few have, somehow.
- In degenerate-fate worlds the codex reads it as kin (§5).
  Field Note on first witness of a stalker's turn-toward-light.

## 4. SLICE C3 — THE DEEP MAW (designed, third build)

Fungus × Gel at L3 down, ONE per level, dealt onto the cavern's
heart cell — sessile around the heart crystal the generator
already grows there ("the mother geode" of the October sketch).

- A ring of gel petals around a gullet, rooted in the crystal's
  light. It does not chase; its chamber is its range. Inside
  7 m it begins to INHALE (loose items and the player's footing
  drag — a pull the player can walk out of, stronger as it
  deepens); at 3 m the gullet snaps for 30. The tell is the
  inhale's sound-shape: petals lean in, dust streams toward it.
- Killing it (hp 160) is the deep delve's prize fight: maw_heart
  ×1 (a prismatic material, gating nothing critical in v1) and
  the heart crystal chamber left quiet. In Peaceful it inhales
  theater-only — petals lean, nothing is taken, nothing snaps.
- The CAVE EPIC SEAT stays open beyond the Maw: every deep
  cavern has a Maw; an epic is one being in the whole world.
  When epics come to the caves, they come as their own design.

## 5. FATE × REMNANT — THE V1 READING

The roster above is the ECOLOGY set: it deals in every world,
because every world's caves have an ecology. The fate decides
who the ecology IS, and v1 carries that in the record, not the
roster: in worlds whose fate ended in degeneration, the Pale
Stalker's codex and Field Note read it as devolved kin — the
light-hunting is a people's habit remembered by the body; the
skitter's note-kin entries take the same tone. In extinct-fate
worlds the same entries read as pure animal. The bunker-people
worlds keep their secret: their caves deal the ecology set and
nothing in v1 says why the deep levels feel *listened to*. If
the bunker piece is ever built, it arrives as its own program
with Adam's word, exactly as parked.

## 6. PEACEFUL, EXACTLY

Peaceful caves stay safe by the game's standing law: the shared
armed gate (combatArmedRef / attacksArmed) already decides
whether ANY fauna may harm the player, and the cave citizens
run on it unchanged. The husk swells and bursts spores that
cannot hurt; the Maw inhales and cannot take; the stalker (C2)
turns toward your light and cannot bite. What Peaceful keeps is
the whole ecology — a Peaceful cave is inhabited, breathing,
and shy of your lantern. It simply has no teeth, which is what
Peaceful has always meant on the surface too.
