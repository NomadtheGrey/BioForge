# CREATURES BRAINSTORM — PART 8: THE GHOSTS, GIVEN BODIES

*Filed 2026-10-19, the creatures lane. Adam's commission, on the
Mouth-Vine's grave: "If these ghost creatures and plants and
fungus are interesting, have creatures chat create them and put
them in game." The census stands at
goals/bioforge-debugging/files/ghost-census.md: fauna 194/194
alive, docs 346/346 built, and exactly two species-ghosts worth
building — both flora, both pre-provisioned by the game's own
light table long before they had bodies. This part designs them.
(G1, the completions — Bell-Bloom's codex entry and the
Snap-Trap turret correction — shipped ahead of this doc; the
Bounce-Shroom was acquitted as a designed cultivar.)*

## G2 — RIBBON MOSS (Flora × Ordinary)

The silent ghost: a union member and a light-table line (teal,
0x2dd4bf, ground-low at y 0.4) and nothing else — no def, no
codex, no mention in any design doc. The light table is the only
testimony about what it was meant to be: a LOW, TEAL, SOFT glow
that hugs the ground. Moss, then, that shines faintly upward —
the floor's answer to the glow fungus's caps.

- **Form**: a dark mat the size of a doormat, and from its edges
  long flat RIBBONS that lie along the ground and lift at their
  tips, lit teal at the ends like the last inch of a fiber
  cable. It grows in shade: Rootwood and Wetland country, where
  the light is already borrowed.
- **Economy**: cut with the glove — **Ribbon Moss** (the cutting
  itself, ×2, with dew essence in the mat). Per the propagation
  grammar (mosses plant by their own stock), the cutting IS the
  propagule: take a ribbon, plant a ribbon. A garden of it is a
  floor of soft teal — the base-builder's night path, grown.
- **Dealing**: bonusGrow — Rootwood/Wetland, patches of 2–3,
  never in the spawn zone (it is found, not given).
- No hazard, no behavior engine: its trick is that it GLOWS and
  can be MOVED — a living light you relocate by gardening. In a
  game whose lights are grown, a plantable light-moss is a
  citizen, not a decoration.

## G3 — MOUTH-VINE (Flora × Ordinary), the ghost #1

The Studio codex promised: "Semi-carnivorous creeping tendrils
that reflexively snap toward fast movement. Prone to
constriction… Pacify by feeding Sweet Nectar before harvesting
or pruning back." The biomes it named were invented, but the
ANIMAL of the idea (it is a plant; the idea has teeth anyway)
is sound, and its two halves separate it from its living kin:
the Maw Bloom SNAPS from a rooted bloom; the Grabvine GRABS
from above. The Mouth-Vine CREEPs at ankle height and
CONSTRICTS — and it can be FED.

- **Form**: a ground-creeping vine, corded tendrils radiating
  from a root crown, each tendril ending in a small jawed
  leaf-pair. Dealt in Wetland and Fungal country (its census
  kin the Snap-Trap's country), 1–2 per zone where it grows.
- **The hazard**: the shipped hazard machinery, worn openly —
  brush a tendril's reach (≈2.2 m) and a tendril snaps to the
  ankle: a CONSTRICTION — movement drag while you stand in
  its patch, and a bite of damage where difficulty arms it
  (Peaceful: it holds your ankle theatrically and cannot
  hurt you). Step out of the patch and it lets go; it cannot
  chase. The tell is the chitter-creak of tendrils tensing —
  worn as the tensing itself: tendrils nearest the player
  lift before they snap (a 0.8 s wind-up, interruptible by
  leaving).
- **The door — FEEDING**: apply Sweet Nectar to the vine the
  way fertilizer is applied (the feed rides the existing
  item-on-flora grammar) and the whole plant goes slack and
  sweet-drunk for 60 seconds: no snap, no constriction, and
  the harvest is free. A fed vine is also the only SAFE way
  to take its cutting for the garden.
- **Economy**: harvest **Tendril Fiber** ×2 (its corded stems;
  if no such item exists when built, Ribbon Fiber is the
  honest fallback and the codex says so) — propagation by
  piece (its own cutting, 'mouth_vine' stock per the moss/
  vine grammar: the cutting item carries the species' name).
- **Codex**: the entry RETURNS — same species id, the light
  line already waiting (lime, low) — rewritten true: real
  country, real hazard, real door. What the Studio promised
  in invented words, the shipped entry says in true ones.
