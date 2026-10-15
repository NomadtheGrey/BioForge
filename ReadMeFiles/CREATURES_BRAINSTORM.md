# Creatures — Brainstorm (Design Chat)

**Status: BRAINSTORM ONLY (created 2026-10-15). Nothing in this file
is pinned.** This is the design chat's working doc for FUTURE
creatures: species concepts, behaviors, temperaments, taming, drops,
and biome homes. Everything here stays tentative until Adam says
"pin that"; pinned designs move into CORE_MECHANICS.md when they ship.

Scope notes:

- **Design only.** No creature code is written from this chat while
  the biome program holds its claims on the shared files
  (zones / biomes / worldGen / types / constants / tool
  interactions). A build phase is a separate, later decision.
- **Shipped behavior lives elsewhere.** What creatures already in
  the game actually do is recorded in
  CREATURE_BEHAVIORS_BRAINSTORM.md, including the biome program's
  behavior stubs for shipped species (Mirror Moth, Vesper Glider).
  This doc designs forward from those stubs; it does not rewrite
  them.
- **The biome home map lives elsewhere.** Families, variants, and
  hybrids are in BIOMES_BRAINSTORM.md. Creatures are designed per
  family / hybrid home from that graph.

## The creature matrix (Adam, 2026-10-15)

Biomes got a matrix — families on both axes, pure biomes on the
diagonal, hybrids off it. Creatures get matrices too: cross two
independent axes and the cells become design prompts. Most cells
will be nonsense, and that is fine — empty cells cost nothing, and
the plausible minority is a roster generator. Sparse is good.

Axes so far:

1. **Life Type** — what the creature is alive *as*.
2. **Locomotion** — how the creature gets around. **Built out
   below.**
3. **(Open slot — candidate raised.)** Adam senses there is a
   third axis. On 2026-10-15 he raised **Shape** — what a creature
   looks like — as likely being it. The approach is under
   discussion; the slot stays open until the approach is agreed,
   and Shape is NOT part of the spectra template below (spectra
   describe behavior; shape would be a matrix axis like Life Type
   and Locomotion).

A separate, free grid falls out of the biomes work: **Life Type x
Biome Family** as the roster map — who lives where — again with
empty cells expected.

## Axis 1 — Life Type (sketch, for context)

Adam's starting point: flora / fauna / fungus is just what Earth
happened to produce; BioForge is not limited to it, and —
Adam's ruling in spirit — *"we're not chemists, we are
BioForge-ists"*: a type is defined by how it lives in the game
(its verbs), not by real-world chemistry.

- **Fauna** — flesh, mobile, eats, has a temperament.
- **Flora** — rooted, grows in stages, lives on light and dew,
  plantable.
- **Fungus** — spreads over dead matter, spores, networked, loves
  dark and damp.
- **Crystalline** (Adam's first addition) — grows instead of being
  born; slow; refracts and rings; sheds shards. The cave crystals
  already behave as harvestable, regrowable life without being
  plants — this type is their real bucket. Silicon-flavored at
  most; the verbs are what matter: accrete, resonate, shed.
- **Gel** (Marlowe candidate) — no fixed form; splits, merges,
  squeezes through gaps. You do not lure a gel; you feed a puddle
  until it trusts you.
- **Collective** (Marlowe candidate) — the creature *is* the
  colony; many small bodies, one mind. Taming relocates a colony
  rather than winning a pet.
- **Vapor** (Marlowe candidate) — mist and charge, solid only
  sometimes; a scanner sees it better than eyes do. The strangest
  candidate; far-zone material.
- **Forged** (Marlowe candidate) — precursor-*made* life: grown,
  not evolved; constructs that repair and reproduce. Carries a lore
  cost — it blurs creature vs. artifact — so it needs Adam's taste
  call before it is used.

Type x Type could also be crossed like the biome graph (pure on
the diagonal, blends off it — Crystal Fauna, Fungal Flora, ...).
Not yet explored; noted so it is not lost.

Open on this axis: final roster size (eight drafted above; mirroring
the biomes' ten risks filler), and whether Crystalline is mostly
harvestable life or also gets true animals.

## Axis 2 — Locomotion (built out 2026-10-15)

**Definition.** Locomotion is how a creature gets around — its
primary way of moving through the world. It is *not* speed (speed
is a per-species spectrum, already used in the behavior stubs) and
not temperament or social structure.

**Why it earns an axis:**

- **It redefines the pet commands.** Follow / stay / guard mean
  different things per mode: a burrower on follow pops up beside
  you; a swimmer on follow cannot leave its water and instead
  meets you at the shore; a stationary tamable cannot follow at
  all, so stay / guard is its whole personality; a flyer follows
  overhead. Same three commands, different creatures.
- **It binds creatures to places.** A swimmer needs a body of
  liquid; a burrower needs diggable ground; a climber needs
  verticals (trunks, ruin walls, cave roofs). Locomotion plus
  biome affinity decides where a species can honestly live, and
  what happens when its player crosses a zone edge.
- **It telegraphs danger.** In Normal / Hostile, how a threat
  moves is how a player reads it: ground rumble before a burrower
  surfaces, a blink rhythm before a phaser arrives. Peaceful
  movement stays the same; only intent changes.
- **Its production cost is uneven — plan for it.** Hopping,
  slithering, drifting, and rolling are procedural motion the
  engine can fake cheaply (the puff wiggle / hop pattern already
  proves the shape). Legged walking is the expensive mode — rigged
  legged models were the open animation risk back when the roster
  was three species. Flying and swimming additionally need the
  *world* to cooperate (airspace, water bodies), not just a model.

**The strangeness gradient applies to movement too** (draft):
near spawn, familiar modes (stationary, walking, hopping,
burrowing); mid-distance, the less obvious ones (swimming,
climbing, gliding, slithering); far out, the oddities (rolling,
drifting colonies, phasing). Preparation stays the gate — never
a lock — per the settled biome rules.

### Adam's six (2026-10-15)

1. **Stationary** — rooted or sessile; does not travel. All current
   flora and fungus live here, but a stationary *fauna* is a live
   provocation (a creature that waits, reaches, and lures instead
   of chasing). Wiggle / reach / spore-release still give it life
   in place.
2. **Walking / Running** — legged ground travel. Stalkers and mice
   today. The default fauna mode — and the priciest to animate
   well (see cost note above).
3. **Bouncing / Hopping** — travel by arcs and landings. Soft-Puff
   today; procedural squash-and-stretch carries it. Also the
   bounce-shroom's lesson: the world itself can lend this mode to
   the player.
4. **Flying** — powered flight; the creature chooses its path
   through the air and can gain height at will. (See the gliding
   note below on the shipped moth / glider wording.)
5. **Swimming** — travel through liquid, bound to it. Needs real
   liquid to live in: marsh pools, flooded caves, whatever the
   Wetland family grows. A swimmer out of its element is beached,
   not slow.
6. **Burrowing** — travel *through* ground, surfacing where it
   chooses. The Burrow Mouse's namesake mode, still mostly unused.
   The underground is its road network: it can be near you and
   invisible, which serves both cute (cache runs) and, in harder
   modes, dread (the rumble).

### Marlowe's additions (2026-10-15, unapproved)

7. **Gliding / Soaring** — unpowered or semi-powered air travel:
   height is a resource the creature spends and must re-earn from
   thermals, slopes, or launches. Proposed as *distinct* from
   flying because the energy story — and the follow behavior —
   differ completely. NOTE: the shipped behavior stubs currently
   record both the Mirror Moth ("flying — low hover-drift") and
   the Vesper Glider ("flying — glide + bob") under *flying*; this
   split is a design-chat refinement proposal, not a rewrite of
   shipped fact, and needs Adam's call.
8. **Slithering / Crawling** — legless, belly-driven travel.
   Snakes, worms, slugs — and the only honest option for Gel life.
   Cheap procedurally; reads beautifully at small scale.
9. **Climbing / Clinging** — travel on verticals and ceilings:
   trunks (Rootwood), ruin walls, cave roofs. The cave system's
   missing movement; a ceiling fauna changes how a player watches
   a dark room.
10. **Drifting / Floating** — buoyant travel on wind or current.
    The creature influences its course more than it chooses it.
    Spores, vapor life, floating flora, drifting colonies. (The
    Mirror Moth's pool-to-pool drift is a near neighbor of this
    mode wearing flying's clothes — see the gliding note.)
11. **Rolling** — travel as a living wheel. Sounds like a joke
    until a Crystalline geode-creature rolls slowly across
    Saltglass, gathering mineral crust as it goes. Nearly free to
    animate; unforgettable to meet.
12. **Phasing / Blinking** — travel by short hops *through* space
    or matter instead of across it. The far-out mode: Vapor or
    Forged life only, deep minHops only. Brainstorm already holds
    a blink-behavior concept (see the alien toolbox in
    CREATURE_BEHAVIORS_BRAINSTORM.md); this names its movement.

### Considered and folded (not separate modes — yet)

- **Leaping** — folded into Bouncing / Hopping (a hop with intent
  is still a hop).
- **Wading** — a Walking variant, not its own mode: the Mirror
  Marsh's wading drag is exactly walking made expensive by water,
  and the Waders (Boots platform) are the player's answer to it.
- **Skating / Skimming** — surface-of-liquid travel; a Swimming /
  Drifting flavor unless a species makes it a headline.
- **Swinging / Brachiating** — a Climbing variant for canopy life.
- **Hitchhiking** — riding another creature is a *relationship*,
  not a locomotion; it belongs in the behavior toolbox with
  cleaner symbiosis.

### The matrix at work (illustrative cells — not species designs)

- **Crystalline x Rolling** — the geode roller above.
- **Fungus x Burrowing** — a mycelium that *travels* underground
  and fruits where it arrives; the colony moves, the mushrooms
  are just its footprints.
- **Flora x Swimming** — resolves honestly as floating, drifting
  plant life (the Mirror Lily already cups light on the surface).
- **Fauna x Stationary** — the ambush pet / living furniture
  provocation; taming earns a guardian that never leaves its post
  because leaving is not in its nature.
- **Vapor x Phasing** — the far-zone extreme: a creature you
  mostly detect, occasionally glimpse, and never quite follow.
- **Collective x Drifting** — a mote colony riding the wind as one
  slow animal the size of a weather system.

### Open questions on this axis

- **One mode or two?** Does a species get a single primary mode,
  or a primary plus a secondary — including life-stage changes
  (larva burrows, adult flies; a swimmer that hauls out and
  crawls)? Marlowe's lean: primary + optional secondary, because
  the transformation moment ("wait — it can *fly* now?") is a
  discovery the game should be able to give. Awaiting Adam.
- **The flying / gliding split** (item 7 above): adopt, or keep
  the shipped stubs' single "flying" with flavor notes?
- **Element honesty:** does a mode its home cannot support (a
  swimmer rolled into a dry zone) simply never spawn there —
  affinity enforced, as with biomes — or can the world strand
  one as an event? Marlowe's lean: affinity enforced; stranding
  is event design, not generation.
- **Stationary fauna and the codex:** when is a stationary animal
  a *creature* rather than scenery? Proposal: the moment it can
  react — reach, lure, snap, sing. Awaiting Adam.

## The spectra template (per-species behavior profile)

Every designed species gets a line on each spectrum below — this
is the expanded version of the four-field template the biome
program's shipped-species stubs already use (temperament, social,
speed, locomotion). **Adam approved adding all six new spectra on
2026-10-15** (his words: "We can add all of those" — adopted as
template *fields*, brainstorm status; no species values are pinned
by this, and Adam flagged the addition himself as deliberate,
eyes-open feature expansion).

Original four:

- **Temperament** — aggressive <-> timid.
- **Social** — pack <-> solo.
- **Speed** — fast <-> slow.
- **Locomotion** — categorical, not a slider; see Axis 2.

Added 2026-10-15:

- **Size** — tiny pest <-> apex giant. Anchors the distribution
  model: the ubiquitous layer's pest seat lives at the tiny end
  (the mosquito seat; the burrow mouse holds the rat seat), and
  the untamables' "epically large" reason lives at the giant end.
- **Diet** — categorical like locomotion: grazer / hunter /
  scavenger / decomposer — plus BioForge extensions to consider
  (light-drinker, dew-sipper, mineral accreter for Crystalline
  life). Diet is what a creature's drops and taming bait mean.
- **Day-night** — diurnal <-> nocturnal, with crepuscular (dusk /
  dawn) as the named middle. The Vesper Glider's flavor already
  lives here.
- **Curiosity** — ignores you <-> comes to look at you. DISTINCT
  from temperament: approaching to inspect is neither aggression
  nor timidity, and it gives Peaceful encounters a third shape
  besides flee-or-ignore. (Marlowe's pick for most game in it;
  Adam's adoption of the set includes it.)
- **Territory** — wide-roaming <-> defends one spot. Decides what
  stay / guard means for a wild creature before taming ever
  enters the picture, and where a species' "home" is in a zone.
- **Tameability** — wild forever <-> half-domesticated. The
  *disposition* behind the mechanics: the shipped per-attempt
  lure percentages (Soft-Puff 80 / Burrow Mouse 60 /
  Chitin-Stalker 25) are this spectrum expressed as numbers, and
  its floor is where the untamables live.

A species design in this doc is not complete until it carries a
spectra line — all ten fields, even if the entry is "mid / n/a"
with a reason.

## Cross-references

- BIOMES_BRAINSTORM.md — the family x hybrid graph; creature
  homes are chosen per family / hybrid from it.
- CREATURE_BEHAVIORS_BRAINSTORM.md — shipped behavior, the
  behavior toolboxes, and the biome program's shipped-species
  stubs this doc designs forward from.
- CORE_MECHANICS.md — where pinned designs land when they ship.
