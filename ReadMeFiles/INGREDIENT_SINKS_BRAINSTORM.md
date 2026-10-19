# INGREDIENT SINKS — BRAINSTORM

*BRAINSTORM — not pinned, nothing here is canon until Adam
reacts. Written 2026-10-17 (background chat) at Adam's brief:
"think of great things to build with our substantial
ingredient list." Grounded in the shipped registry, read
first: no idea below names a material that does not exist
in `src/game/items/constants.ts`.*

*Sweep note (2026-10-18): **P1 has SHIPPED from this file** —
category ingredients (`src/game/items/itemKinds.ts`: CAP / GEL /
WOOL / DOWN / GREENERY, spent most-abundant-first through the one
resolver) and **the Mound** (item 12 below), live 2026-10-18.
The rest of this file remains brainstorm, unpinned.*

## The census (why this sheet exists)

The registry holds **273 items: 192 raw materials** — and
only **35 distinct ids are consumed by anything** (every
recipe, weapon ladder, shield, kit, and system between
them). **168 raw materials have no sink at all.** They drop,
they harvest, they stack to their caps, and they wait.

The honor roll of the purposeless, by family of material:

- **The apex trio** — `lodestone_plate`, `fall_plume`,
  `hush_gel`: the wild country's teeth drop trophies with
  nowhere to go.
- **The gels** — `bog_jelly`, `salt_jelly`, `thaw_jelly`,
  `lake_jelly`, `gloom_gel`, `quiver_gel`, `hush_gel`:
  seven jellies, zero uses.
- **The textiles** — wools (`dusk_wool`, `lambswool`,
  `mother_wool`), downs (puff, picker, fisher, whale,
  spire), `veil_cloth`, `rib_silk`, `deck_silk`,
  `banner_fiber`, `kite_ribbon`, `kite_pennant`.
- **The great cap herd** — roughly forty caps (haycap to
  greeting_cap) plus a meadow of petals, leaves, and fronds.
- **Glass** — `saltroot_glass`, `star_glass`,
  `behemoth_glass`, `glass_shed`, `glass_frond`,
  `glass_cap`.
- **Bone & marrow** — `clean_bone`, `worn_skull`,
  `rib_silk`, `rib_seed`, the `marrow_*` set,
  `leviathan_plate`, `leviathan_hide`, `coat_slab`.
- **Storm-charged** — `storm_fruit`, `stormcap`,
  `static_cap`, `aurora_cord`.
- **Frost** — `nevermelt_ice`, `frost_velvet`, `ice_shelf`,
  `ice_petal`, `ice_bloom`.

Two names in the original brief are **not in the shipped
registry** (they live in design docs): *stillwater_pearl*
and *ember_silt*. The shipped silt is `silt_petal`; there
is no pearl. Ideas below cite shipped ids only.

**The trap to avoid:** 168 bespoke recipes. Nobody should
write them, and Adam should never have to read them. The
sinks that matter are the ones that drink whole FAMILIES
of material at once — which is why the two platform ideas
come first.

## Platform ideas (pay once, many sinks ride)

**P1 — Category ingredients.** Recipes today name exact
ids. Let a recipe slot instead name a KIND — "any cap,"
"any petal," "any gel," "any wool" — and the forge accepts
the family's whole herd. *Cost: recipesData shape + the
crafting UI's ingredient check (items/recipesData.ts,
components/CraftingModal-adjacent, useCrafting if separate)
— a medium platform change, honestly the largest single
idea on this sheet, and the one that makes half the rest
cheap.* Everything marked "rides P1" below is small once
P1 stands.

**P2 — The Boon Slot.** The game has no timed player
effect: no buffs, no draughts, no "for the next minute."
One slot on the player (loop-owned, host-authoritative
like the cycle), one active boon, an icon by the vitals.
*Cost: useGameLoop + PlayerState (optional field — old
saves unaffected) + a HUD tile — medium.* Consumables
below marked "rides P2" are each small once it stands.

## Homestead

**1. The Down Bed.** The Root Bed grows a second tier:
`mother_wool` + `lambswool` + `puff_down` + `soft_fiber`.
Resting in it at night advances the world to dawn — the
host sets the phase through the day/night authority that
already exists. Sleep is the sky calendar's honest enemy:
sleep through a shower night and you miss the shower. The
world keeps its own time; the bed just lets you skip your
watch of it. *Cost: structure def + builder (structure
lane files), a rest interaction, the phase-set call —
medium. Tier-4 note: none — this is the home you leave,
not the way out.*

**2. Banner Posts.** `banner_fiber` + `kite_pennant` +
`kite_ribbon` + `gale_straw`: tall grown standards for the
homestead, dyed by the family whose silk you spend
(rib_silk = bone-white, deck_silk = pond-blue, and so on).
Pure pride, and in co-op a landmark you can see across a
zone. *Cost: structure def + builder + tint-by-ingredient
(a small placement-time choice) — small-medium. The
optional minimap dot is HUD-lane adjacency.*

**3. The Mycologist's Wall.** A homestead board that
mounts one of each cap — the great herd becomes a
collection with a wall to show on. Mounting consumes the
cap; the wall remembers the set. *Cost: structure def +
builder + a mounted-set list on the world snapshot (an
OPTIONAL save field — old saves load with it empty) —
medium. This is the collector's sink: it gives ~40 items
a destination without 40 recipes.*

**4. Bone Chime Sentinel.** `clean_bone` + `rib_silk` +
`chime_straw` + `worn_skull`: a grown chime at the camp's
edge. When a hunter crosses ~25 m, it chimes — a sound
and a small notice — and the homestead stops being
ambush country. Pairs honestly with the wild-country
gradient: the deeper you settle, the more it's worth.
*Cost: structure def + builder + a proximity tick against
the fauna list (structureLife or the game loop) + a sound
— medium. Tier-4 note: campcraft at its height; a camp
that warns you is the apex country's table manners.*

## Wild-country tools & deployables

**5. Lodestone Wayspike.** `lodestone_plate` +
`lodestone_sand` + `ironwood`: a planted spike that pulls
the compass — the minimap gains a marker for it, named
when planted. Personal waypoints, grown not built; in
co-op every guest sees the host's spikes. The apex
hound's plate becomes the reason you dare the magnetic
dunes twice. *Cost: structure def + placement + a marker
feed to the Minimap (HUD adjacency) — medium. Tier-4
note: the apexes' country, visited on purpose — a spike
per apex is a gathering tour all by itself.*

**6. The Lodestone Bulwark.** A fourth shield, grown from
`lodestone_plate` + `carapace_scale`: braced, it is a
wall like its kin — and dropped items within ~6 m drift
slowly toward it. Magnetism as table service: guardian
kills and dissolve kills stop scattering their samples
into the grass. *Cost: creatures/shields.ts + one item +
one recipe — SMALL, the cheapest apex sink on the sheet.
Tier-4 note: apex materials at a family's craft-height —
exactly the register the finale asks for.*

**7. Plume Charm.** `fall_plume` + `spire_down` (or
`roc_feather`): a single-use grown charm in the pouch.
Falling — a cave shaft, a skyfall basin edge — it spends
itself and the fall turns gentle. The Fall Hawk's plume
becomes the underworld's insurance. *Cost: item + recipe
+ a fall-velocity check in useGameLoop — small-medium.*

**8. Hush Poultice.** `hush_gel` + `gloom_gel` +
`sage_leaf`: a thrown (placed) calm — hunters inside its
radius lose the hunt for a minute and wander off. The
Hush Hound's gel buys the stealth verb the game lacks,
without a stealth system. *Cost: item + recipe + a fauna
temperament touch (creatures-lane adjacency: a calmTimer
beside dissolveTimer/flinchTimer — the canary fields show
the shape) — medium. Rides nothing; stands alone.*

**9. Rime Ward.** `nevermelt_ice` + `frost_velvet` +
`ice_shelf`: a planted cold spike; hunters crossing its
radius move at half pace. Camp defense for the deep
country, and the frost family's first verb. *Cost:
structure def + builder + a fauna speed factor where
hunter movement is computed — medium.*

## Vat & structure growths

**10. Vat Broths — the gel sink.** The vat gains an
optional BROTH slot beside the sample: feed it a jelly
and the gestation drinks it. Broths bias the hatch —
salt for the pond-true (swimmers from lake_jelly), hush
for the gentle (temperament odds), storm for the quick.
Seven gels, one slot, every broth a reason to hunt its
country. *Cost: useVat + VatModal + the hatch decision
(creatures-lane co-design — temperament/variant hooks are
theirs) — medium-large, and the flagship: it makes the
vat a kitchen, not just a cradle. Tier-4 note: the vat is
the game's deepest craft; a brothed Genesis hatch is a
craft-height proof the finale could ask for (the asking
is Adam's pin, not this sheet's).*

**11. The Glass Cloche.** `saltroot_glass` + `star_glass`
+ `saltglass_shard` (+ `behemoth_glass` for the great
size): a grown glass dome over one planted flora — it
grows at double rate, and weather never touches it. The
glass family stops being shards-in-waiting and becomes
the greenhouse verb. *Cost: structure def + builder + a
growth-rate hook where flora growth ticks — medium-large.*

**12. The Mound Eats Everything.** *(Rides P1.)* The
Cultivation Mound accepts any flora matter BY KIND — caps,
petals, leaves, fronds — and returns compost grades by
weight and rarity: the common herd → basic compost, the
strange country → rich loam. This is the honest sink for
the ~120 harvest items no bespoke system will ever cover:
not glamorous, and absolutely load-bearing. *Cost: on top
of P1, the mound's UI + a grade table — small-medium.*

## Co-op

**13. The Feast Spread.** *(Rides P2.)* `sweet_nectar` +
`storm_fruit` + `relic_fruit` + any cap: a placed spread
at the homestead. Anyone who eats gains the Long Table
boon — stamina's costs halved for a day. The host cooks;
the guests arrive hungry; the table is the session's
first ten minutes. *Cost: structure def + builder + the
eat interaction + P2 — medium all-in.*

**14. Galvanic Draught.** *(Rides P2.)* `storm_fruit` +
`static_cap` + `dew_essence`: drink, and for a minute
you are quick and your struck targets spark (a small
arc to a second creature, if one stands close). The
storm shelf's first taste. *Cost: item + recipe + P2's
effect application in the strike path — small-medium
once P2 stands.*

## Cheapest first, if Adam pins by appetite

1. **The Lodestone Bulwark** (6) — one shield, three
   files, apex sink today.
2. **Plume Charm** (7) — the underworld's insurance.
3. **Banner Posts** (2) — homestead pride, co-op
   landmark.
4. **P1 Category ingredients** — the platform the rest
   drink from; then **The Mound Eats Everything** (12).
5. **P2 The Boon Slot** — then the Feast (13) and the
   Draught (14) ride cheap.
6. **Vat Broths** (10) — the flagship, worth its
   cross-lane cost.

*Not designed here, on purpose: the Departure's Tier-4
ingredient list (Adam's pin, still open in
THE_DEPARTURE.md). Several ideas above are marked where
they could serve it — as craft-height proofs and
apex-country reasons — without this sheet presuming to
write the vessel's recipe.*

---

*ERRATA (2026-10-17, as the slices landed):*
*Idea 6 (Bulwark) landed at 493edc0 — seven files, not
three (type union, gear-tier pin, two hook touches ride
along any shield). Idea 7 (Plume Charm) landed at fe7c040
REDESIGNED: the game has no fall damage — falls are the
jump offset returning to support — so the charm is a
GLIDE, not insurance: carried, fast descents gentle to
0.45× gravity with the sink capped at 3 m/s; launches
untouched. Its recipe also spends soft_fiber ×2 (the
weave), which the sheet omitted.*
