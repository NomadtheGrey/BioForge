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

1. **Life** — what the creature is alive *as*, in two crossing
   parts: its **Kind** (fauna / flora / fungus) and its
   **Material** (what it's made of — flesh-and-leaf ordinary, or
   crystalline, gel, vapor, forged). Built out below.
2. **Locomotion** — how the creature gets around. **Built out
   below.**
3. **Shape** — what a creature looks like: its body plan.
   **Built out below** (Adam's go, 2026-10-15). Shape is a matrix
   axis like the other two, NOT a spectra field — the triad is
   substance x motion x form.

A separate, free grid falls out of the biomes work: **Life Type x
Biome Family** as the roster map — who lives where — again with
empty cells expected.

## Axis 1 — Life: Kinds x Materials (built out 2026-10-15)

Adam's starting point: flora / fauna / fungus is just what Earth
happened to produce; BioForge is not limited to it, and — Adam's
ruling in spirit — *"we're not chemists, we are BioForge-ists"*:
a kind of life is defined by how it lives in the game (its
verbs), not by real-world chemistry.

**Adam's crystalline ruling (2026-10-15) reshaped this axis.**
Crystalline is NOT a fourth kind standing beside fauna / flora /
fungus. In Adam's words, it "can go with animals, plants, fungus,
whatever else we have — it looks like another matrix." He is
right: crystalline is a **Material** — what a creature is *made
of* — and Materials cross Kinds in a matrix of their own:

### Kinds (how it lives — the verbs)

- **Fauna** — mobile, eats, has a temperament; the kind the
  Taming Lure speaks to.
- **Flora** — rooted, grows in stages, lives on light and dew,
  plantable.
- **Fungus** — spreads over dead matter, spores, networked,
  loves dark and damp.

### Materials (what it's made of — the substance)

- **Ordinary** — flesh, leaf, and spore-flesh: the native stuff
  of its kind. Every shipped species is Ordinary.
- **Crystalline** (Adam's addition) — grows instead of being
  born; slow; refracts and rings; sheds shards. Verbs: accrete,
  resonate, shed. Silicon-flavored at most. The cave crystals —
  harvestable, regrowable, clearly not plants — were this
  material waiting for its matrix: they are Crystalline *Flora*
  (rooted growers), and the same material on Fauna gives a
  shard-plated animal, on Fungus a crystal shelf that fruits
  shards instead of spores.
- **Gel** — no fixed form; splits, merges, squeezes through
  gaps. You do not lure a gel animal; you feed a puddle until it
  trusts you.
- **Vapor** — mist and charge, solid only sometimes; a scanner
  sees it better than eyes do. The strangest material; far-zone
  by nature.
- **Forged** — precursor-*made*: grown, not evolved. Adam
  accepted the lore cost under the species delegation
  (2026-10-15); Forged stays far-zone / ruin country, where the
  blur between creature and artifact is the local theme rather
  than a setting-wide claim. The behavior doc's "still on duty"
  untamables are Forged Fauna by this reading.

### The matrix at work (3 Kinds x 5 Materials = 15 cells)

- **Crystalline Fauna** — a slow grazer in shard plates; taming
  is tuning and patience, not appetite.
- **Crystalline Fungus** — a shelf colony that grows prisms the
  way ordinary fungus grows caps; caves' second crystal story.
- **Gel Flora** — a translucent ground-cover that flows a few
  centimeters a day toward light; harvesting is scooping, and it
  regrows from what you leave.
- **Vapor Fauna** — an animal-shaped fog with a flight spectrum,
  a day-night inversion, and a scanner-first encounter.
- **Forged Flora** — a precursor garden organism that still
  tends itself: planted rows in a ruin that have outlived the
  gardeners by centuries.
- **Vapor Flora** — CONTEXT ruling: a free-floating gas-bag
  plant is Drifting locomotion wearing Flora's verbs (it makes
  seeds, it photosynthesizes) — legal, far-zone, strange.
  A *rooted* vapor plant is NONSENSE for now: roots need ground
  and vapor declines to stay in it.
- **Forged Fungus** — infrastructure that is alive: a network
  grown as wiring / plumbing by the precursors, still running.
  Legal, and quietly one of the best lore carriers on the grid.

### Where "Collective" went

The earlier draft listed Collective as a kind of life. Under
Adam's crystalline logic it fails the same test Crystalline
failed: a colony can be fauna (a swarm), fungus (a network), or
even forged (a distributed machine). Colony-vs-individual is a
**property any cell can carry** — read off the Social spectrum
at its pack extreme, usually wearing a Cloud or Segmented shape.
Retired as a separate kind (Marlowe's call under the species
delegation, 2026-10-15; revisable).

### What the two halves each decide

- **Kind decides the verbs**: how it feeds, grows, reproduces,
  and whether the lure / planter / harvest grammar applies.
- **Material decides the substance rules**: what it drops
  (crystal -> shards; gel -> membranes and sacs; vapor ->
  condensates and essences; forged -> precursor parts), its
  default tempo (crystalline slow, vapor elusive), and how the
  world hurts or helps it (heat, light, water).
- A species design names both halves: not "a crystal creature"
  but **Crystalline Fauna**, not "a ghost thing" but **Vapor
  Fauna**. If a design cannot name its Kind, it is not a design
  yet — it is a mood.

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
climbing, aerial, slithering); far out, the oddities (rolling,
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
4. **Aerial (flying <-> gliding)** — travel through the air,
   recorded as ONE mode with a mandatory per-species spectrum,
   the **flight spectrum**: powered <-> glide. (Adam's framing,
   2026-10-15: the two are really a spectrum; the split-vs-merge
   call was delegated to Marlowe, who merged them — see item 7
   and the resolved question below.) Anchors: **obligate flyer**
   (a fly — powered or grounded, nothing between); **flyer-
   leaning** (a robin — flies as a rule, glides in snatches);
   **glider-leaning** (an albatross — glides as a rule, flaps
   when it must); **obligate glider** (a flying squirrel, the
   Vesper Glider — height is a resource it spends and must
   re-earn from launches, slopes, or thermals). Where a species
   sits decides its energy story and its follow behavior: a
   powered flyer follows anywhere; an obligate glider follows
   in arcs between high points and sometimes simply cannot —
   which is information, not a defect. This also vindicates the
   shipped stubs, which record both the Mirror Moth and the
   Vesper Glider under "flying": correct at the mode level, with
   the spectrum now carrying the difference (Moth: powered
   flutter / hover, mid-spectrum; Glider: the obligate-glide
   end).
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

7. **Gliding / Soaring** — NOT a separate mode: it is the glide
   end of the Aerial spectrum (item 4). This stub stays in the
   numbering so earlier references to "item 7" still land in the
   right place.
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
    mode wearing aerial's clothes — see item 4's spectrum.)
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
- **The flying / gliding split** — RESOLVED (2026-10-15): no
  split. Aerial is one mode (item 4) with a mandatory per-species
  flight spectrum, powered <-> glide. Adam supplied the spectrum
  framing and delegated the call; Marlowe merged rather than
  split, because a binary split would have misfiled every
  robin and albatross in between — and because the stubs'
  existing single "flying" label turns out to be right at the
  mode level.
- **Element honesty:** does a mode its home cannot support (a
  swimmer rolled into a dry zone) simply never spawn there —
  affinity enforced, as with biomes — or can the world strand
  one as an event? Marlowe's lean: affinity enforced; stranding
  is event design, not generation.
- **Stationary fauna and the codex:** when is a stationary animal
  a *creature* rather than scenery? Proposal: the moment it can
  react — reach, lure, snap, sing. Awaiting Adam.

## Axis 3 — Shape (built out 2026-10-15)

**Definition.** Shape is a creature's body plan — what it looks
like, its silhouette. With Life Type (substance) and Locomotion
(motion), it completes the matrix triad: **what it's alive as x
how it moves x what form it takes.** The three are independent —
a Serpentine shape can be Fauna, Gel, or Crystalline — which is
what makes Shape an axis rather than a description.

**The "almost unique" standard (Adam, 2026-10-15).** Making every
shape *truly* unique does not scale, and Earth does not do it
either — a few dozen body plans carry everything alive, and
identity comes from plan + proportions + modifiers + combinations
+ material (Life Type). So the standard here is Adam's: **almost
unique.** The silhouette test, softened to match: two species
sharing a plan should still be tellable apart at a glance (on a
phone screen, at distance, in silhouette); nobody has to invent
a new geometry per creature.

### The plan roster (draft — Marlowe's list, Adam approved building it)

1. **Blob** — round, amorphous, no fixed outline. Soft-Puff today.
   Procedural squash carries it; the cheapest plan there is.
2. **Quadruped** — four-legged beast. Chitin-Stalker today. The
   classic fauna read — and the rigging-risk plan (legged models
   are the known hard case for the Meshy pipeline).
3. **Biped** — upright, two-legged. NOT a rare plan (Adam's
   correction, 2026-10-15): Earth has apes, kangaroos, and more —
   bipeds are ordinary, just less common than quadrupeds and the
   many-legged plans. What reads as *person* is not the plan but
   near-human PROPORTIONS; that narrower case keeps its NPC
   weight (cf. the fate x remnant bunker-people idea) and is a
   proportion call at species-design time, not a rarity rule on
   the plan.
4. **Serpentine** — long, legless, head-to-tail. Worms, snakes,
   eels; locomotion is usually slithering, swimming, or burrowing.
5. **Segmented** — a chain of repeated sections. Caterpillar /
   millipede logic; each segment can carry a feature (a light, an
   eye, a shard), so the plan advertises its own variations.
6. **Radial** — star / disc symmetry, the same from every side,
   no obvious front. The deepest-alien plan on the list; pairs
   with stationary, drifting, or tipping-rolling locomotion.
7. **Winged** — the wings ARE the silhouette. Vesper Glider's
   vanes today. As the combination rule below shows, Winged very
   often works as a *secondary* plan (wings on some other body) —
   but it KEEPS its primary seat (Adam, 2026-10-15, adopting
   Marlowe's lean: "keep flying like you recommend"), for the
   creature that is *mostly* wing — a living kite, a sail with a
   body for ballast. Expect most Winged entries to still be
   secondaries in practice.
8. **Finned** — the aquatic outline: fins, tail, streamlining.
   No shipped swimmer wears it yet — the swimmer seat is empty
   (see the type specimen below).
9. **Plantiform** — looks like a plant: trunk, canopy, root-mass.
   Deception built into the shape — the creature is read as
   scenery until it behaves otherwise. The Living family's home
   plan, and the flora/fauna border dispute made visible.
10. **Geometric** — straight edges, flat faces, true angles that
    organic growth does not make. Crystalline life's home plan,
    and an instant "not from here" read at any distance.
11. **Husk** — the visible thing is a container: shell, dome, pod.
    The creature itself is implied, hidden, or *between* states.
    Pairs with dormancy, ambush, and life-stage changes.
12. **Cloud** — no single silhouette: a shifting aggregate with
    soft edges. Collective and Vapor life's home plan; the
    outline is a behavior, not a boundary.
13. **Multiped** — one compact body carried on 6-8 legs (Adam's
    addition, 2026-10-15). The insect / arachnid silhouette:
    distinct from Quadruped (four legs, larger body language) and
    from Segmented (a chain of sections — a Multiped has ONE
    body; its legs are the multiplication, not its body). On
    Earth this is the most successful animal plan there is, so
    the roster should expect it to be COMMON — plausibly more
    common than Quadruped. Budget note (hypothesis): many small
    rigid legs can be stepped procedurally in a wave, which may
    make Multiped cheaper to animate than one large rigged
    Quadruped — to be tested when models work reaches it.

### Layer 2 — Modifiers (adjectives, not axis values)

A species is **plan + one or two modifiers**: horned, spined,
frilled, eye-stalked, long-tailed, many-eyed, blind-smooth,
shelled, crested, lantern-lit. Modifiers are how two Quadrupeds
stop being the same animal; they never multiply the axis.

### The composition rule (Adam, 2026-10-15)

Body plans **combine**: a species may carry a **primary plan +
a secondary plan** — the primary is what the creature *is*, the
secondary is what it *also has*. Adam's founding examples:

- **Serpentine + Winged** — a sky-serpent: the serpent is the
  body, the wings are the addition. (This is why Winged so often
  reads as secondary.)
- **Plantiform + Husk** — a blooming pod: a plant-shaped shell
  that opens; scenery with something inside it.

Composition is the biome graph's hybrid logic one level down —
two parents, a crossfade child — and, like hybrids, combinations
are filtered for coherence rather than banned by category.

### Nonsense combos — Marlowe's rulings (delegated by Adam)

Adam delegated the nonsense hunt ("I trust you to find the
nonsense combos"). Rulings are **brainstorm law, revisable by
Adam**; every one carries its physics reason so he can overrule
the reasoning, not just the verdict. Four verdicts: FINE,
STAGE-SPLIT ONLY (legal across life stages, illegal within one),
CONTEXT-DEPENDENT (legal where the world supplies the condition),
NONSENSE (for now).

Shape x shape:

- Serpentine + Winged — **FINE** (Adam's example; gliding or
  powered, the wings ride a body built to undulate between
  wingbeats).
- Plantiform + Husk — **FINE** (Adam's example; seeds and pods
  are already this on Earth).
- Geometric + Blob as a single primary — **NONSENSE**: the
  silhouette languages contradict (hard angles vs. no fixed
  outline). Rescued as Husk + Geometric worn by Gel life — a soft
  creature in an angular found shell is a *story*, not nonsense.
- Radial + Biped as co-primaries — **NONSENSE**: radial symmetry
  has no front; biped IS a front. Radial features survive fine as
  modifiers (a radial frill or crown on a biped).
- Cloud + Husk — **CONTEXT-DEPENDENT**: nonsense for a lone
  creature (a container with nothing fixed to contain); FINE for
  Collective life — a swarm that has moved into a borrowed shell,
  hermit-crab logic at colony scale.

Shape x locomotion (the physics filter):

- Winged + Burrowing — **STAGE-SPLIT ONLY** (Adam's catch).
  Within one stage it fails physics: wings are large, fragile,
  drag-heavy surfaces, and a tunnel is the worst place for them.
  Across stages Earth does it constantly — burrowing cicada
  nymph, flying adult. This ruling doubles as evidence for the
  primary + secondary locomotion question in Axis 2.
- Finned + Burrowing — **CONTEXT-DEPENDENT**: nonsense in rock;
  FINE in soft substrate — lungfish and eels burrow in mud and
  sand, which is exactly Wetland ground.
- Husk + Flying — **split verdict**: powered flight NONSENSE (a
  pod is a passenger, not an aircraft); gliding / drifting FINE —
  samara seeds are flying husks, and a husk that rides the wind
  to a new home is a dispersal stage, not a vehicle.
- Winged + Swimming — **FINE**: wings as flippers (penguin logic)
  or fins that glide (see below). Shape says wings; locomotion
  decides what they're *for* today.
- Quadruped + Burrowing — **FINE**: legs are digging tools as
  readily as walking tools (mole logic); the silhouette barely
  changes, the limbs' job does.
- Cloud + Stationary — **NONSENSE for now**: an unanchored cloud
  cannot stay; staying is the one thing it cannot do. A tethered
  or vent-fed vapor that hovers over one spot is Drifting with
  an anchor, and gets designed as such.
- Radial + Walking — **FINE, flagged oddity**: a radial creature
  walks by tipping point-to-point, starfish logic at speed. It
  looks wrong in the best way; kept as a deliberate far-zone
  possibility rather than ruled nonsense.

### Type specimen — the flying fish (Adam, 2026-10-15)

Adam's example exercises the whole system at once, so it is
recorded as the composition rule's type specimen (an illustration,
not yet a species design): **Life Type Fauna; Shape Finned
primary + Winged secondary; Locomotion Swimming primary +
Aerial secondary, at the obligate-glide end of the flight
spectrum** (flying fish glide — they do not fly). It is also a
standing candidate shape for the open **Wetland family signature**
seat: the swimmer seat is currently empty — the marsh has pools,
a flying moth, and a floating lily, and nothing in the water.

### Shape is also a budget (brief — the full note lives in Axis 2)

Each plan maps to a known animation class from the models work:
Blob / Cloud / Husk are procedural-cheap; Plantiform is engine
sway; Biped rides Mixamo; Quadruped / Serpentine / Segmented
carry rigging cost. Choosing a shape chooses its cost — the axis
doubles as the roster's budget sheet, which is what makes
"almost unique" affordable: uniqueness bought with modifiers and
proportions is nearly free; uniqueness bought with new rigged
plans is not.

### Open questions on this axis

- **Plan roster size**: thirteen drafted (Multiped added by Adam,
  2026-10-15). Enough? The test is not coverage of Earth but
  whether a new creature idea keeps failing to find a home plan.

Resolved since the build: Winged keeps its primary seat (Adam,
2026-10-15). Biped carries no rarity rule — bipeds are
ordinary-uncommon; only near-human proportions carry person /
NPC weight, judged per species (Adam's correction, 2026-10-15;
the fate x remnant NPC design itself stays parked future work).

A species design in this doc is not complete until it carries a
shape line — primary plan, secondary plan if any, modifiers —
alongside its spectra line.

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

## First roster pass — the six open seats (designed 2026-10-15)

Designed by Marlowe under Adam's species delegation ("work each
species; we'll be here for weeks if I have to approve every
one"), filling the open seats named by the distribution model:
one ubiquitous pest, four family emblems (meadow / wetland /
fungal / ember), one biome-unique (the Fungal Hollow). All six
are complete template entries: Kind x Material, Shape line,
Locomotion line, the full ten-field spectra, home, drops,
taming, and hook. Names follow the shipped plain-compound style
(Soft-Puff, Burrow Mouse, Mirror Moth) per Adam's instruction —
nothing AI-ified. Everything here is draft until Adam's
end-of-work review; cleanup of any wonkiness is expected and
welcome.

### 1. Dew Gnat — the everywhere pest (ubiquitous layer)

- **Life**: Fauna x Ordinary. **Layer**: ubiquitous — census
  'all', every family, minHops 0, including cave mouths'
  approaches (not deep caves; even pests respect the dark a
  little).
- **Shape**: Multiped primary (six legs, mosquito-true) +
  Winged secondary; no modifiers — at this size the wings and
  the whine ARE the identity.
- **Locomotion**: Aerial, obligate-flyer end of the spectrum
  (the fly anchor, made literal). Short darting flights between
  leaves, lanterns, and the player.
- **Spectra**: Temperament timid but brazen around light /
  Social loose swarm (no bond; numbers gather where dew is) /
  Speed fast, erratic / Size tiny — the pest end of the axis /
  Diet dew-sipper (drinks dew off leaves at dawn; sips, never
  bites — harmless by design) / Day-night crepuscular, dusk-
  leaning / Curiosity high — comes to look at you, lands on the
  gauntlet, inspects the lantern / Territory none, roaming /
  Tameability wild forever — too small and simple for a lure to
  say anything to; this is its readable untamable reason.
- **Hook**: the world's metronome. Dawn: gnats over dewy leaves
  tell you where dew essence gathers. Dusk: they cloud around
  lantern light. They are also FOOD — Glidefins leap for them,
  moths share air with them — so a gnat-thin zone reads as an
  empty pantry to a watching player. Discipline: the whine is
  quiet and distance-capped; a pest you cannot escape hearing
  would fail the seat. No drops, no taming, no guard — its job
  is to be everywhere and be believed.

### 2. Meadowback — the meadow emblem (family layer)

- **Life**: Fauna x Ordinary. **Layer**: family emblem —
  census [meadow] (appears in meadow-family hybrids per the
  hybrid affinity rule).
- **Shape**: Quadruped primary; modifiers: broad-backed,
  long-tailed. The back is the feature — flat, warm, and wide
  enough to ride on, and things do.
- **Locomotion**: Walking (slow, unhurried; it has never once
  hurried).
- **Spectra**: Temperament calm, far timid of aggressive /
  Social HERD with sentinel rotation — the toolbox's herd-and-
  sentinel entry, made the emblem's headline / Speed slow /
  Size large (short of apex; a hill that grazes) / Diet grazer
  (grasses, bell blooms) / Day-night diurnal / Curiosity low-
  mid — a raised head, a long look, back to grazing / Territory
  wide-roaming on a slow graze circuit / Tameability mid —
  40% per lure attempt; taming is a herd negotiation as much as
  an individual's (the toolbox's "tame one, earn the herd's
  tolerance" applies).
- **Taming life**: Follow = ambles behind, late and unbothered;
  Stay = parks and grazes; **Guard = SENTINEL** — a new guard
  flavor for the template: it watches, and its alarm call (a
  low bell-note) warns the player of threats in Normal /
  Hostile, and merely announces visitors in Peaceful.
- **Drops**: sheds Soft Fiber tufts periodically when tame
  (the vesper-vane pattern — patience, not harm); wild ones
  drop the same tufts rarely where they bedded down.
- **Hook**: a walking piece of meadow. Burrow Mice and gnats
  ride its back (the hitchhiking relationship, earning its
  keep); its graze circuit keeps a visible path worn through
  its home zone, so a player learns the zone by following
  yesterday's Meadowback.

### 3. Glidefin — the wetland emblem (family layer)

- **Life**: Fauna x Ordinary. **Layer**: family emblem —
  census [wetland]; Mirror Marsh pools are its showcase home.
- **Shape**: Finned primary + Winged secondary — the flying-
  fish composition from Axis 3, as a real design. Modifiers:
  iridescent-scaled.
- **Locomotion**: Swimming primary + Aerial secondary at the
  obligate-glide end of the flight spectrum. It does not fly.
  It LEAVES — arcs out of the water after gnats, hangs a
  moment, and is water again.
- **Spectra**: Temperament timid / Social loose school /
  Speed fast in bursts, still between / Size small-mid / Diet
  hunter — of Dew Gnats and surface insects (the pest seat
  feeds the emblem seat; the web closes) / Day-night
  crepuscular — dawn and dusk glides, when the gnats are up /
  Curiosity mid — surfaces to look at things on the bank /
  Territory one pool system, roaming within it / Tameability
  low-mid — 35% at the shoreline; the lure must be offered at
  the water's edge, which is where its world and yours touch.
- **Taming life**: Follow = shore-parallel — it meets you at
  banks and crossings (Axis 2's swimmer rule, in its first
  real design); Stay = holds its pool; Guard = patrols the
  pool and leaps at pests and small threats at the surface.
- **Drops**: on a glide that ends near a friendly player,
  occasionally sheds an **Iridescent Scale** (new item,
  created under the items delegation) — a light-bending scale;
  candidate material for glare-country gear in later design,
  deliberately not load-bearing for any recipe yet.
- **Hook**: the marsh, moving. A zone with Glidefins feels
  fished-in and alive at its surface; their leaps also MARK
  the pools — a new player finds the water by watching where
  the silver arcs are.

### 4. Spore Stag — the fungal emblem (family layer)

- **Life**: Fauna x Ordinary, in open symbiosis with fungus
  (it is an animal that a garden uses as much as it uses the
  garden). **Layer**: family emblem — census [fungal].
- **Shape**: Quadruped primary; modifiers: antlered (broad,
  shelf-branched), pale-eyed. Shelf fungus grows on the
  antlers in seeded patterns.
- **Locomotion**: Walking — slow, deliberate, almost silent
  for its size.
- **Spectra**: Temperament calm, near-indifferent / Social
  solo or pair / Speed slow / Size large-mid / Diet decomposer-
  grazer — fallen caps, rot fruit, compost-rich litter /
  Day-night nocturnal-leaning (the Hollow's hours) / Curiosity
  LOW — it has seen your kind of thing before, or thinks it
  has / Territory defends one compost grove — the first
  strongly territorial emblem / Tameability low — 25%, the
  stalker's number; trust here is a season, not a snack.
- **Taming life**: Follow = a presence ten paces back; Stay =
  returns to its grove if it has one; Guard = grove guardian,
  a slow patrol ring with a spore-puff display before any
  charge (in Peaceful: display only — the warning is the
  behavior).
- **Drops / yields**: non-lethal antler harvest when tame and
  calm — Glow Spore + Basic Compost (its garden pays rent).
  Wild: where it has walked, a faint spore trail settles;
  flora rooted in a fresh trail get a small growth nudge (the
  walking-fertilizer hook; numbers are a build-phase question,
  the behavior is the design).
- **Hook**: the fungal country's memory. Its grove is a place
  a player can find again by ecology rather than by map: the
  richest compost, the oldest caps, and the stag standing in
  it like it grew there — because, in the way that matters
  here, it did.

### 5. Cinderhound — the ember emblem (family layer)

- **Life**: Fauna x Ordinary. **Layer**: family emblem —
  census [ember]. The danger-leaning emblem, per the design
  default Adam let stand: ember is the danger family and its
  emblem should feel like it.
- **Shape**: Quadruped primary; modifiers: scale-plated,
  ember-eyed. Heat shimmer above its back on cold mornings is
  part of the silhouette — you see its weather before you see
  it.
- **Locomotion**: Walking / Running — coiled stillness, then
  burst speed. It does not wander; it WAITS, then it MOVES.
- **Spectra**: Temperament AGGRESSIVE end — the roster's first
  true predator emblem / Social solo or mated pair / Speed
  fast in bursts / Size mid-large / Diet hunter (small game;
  in ember country, whatever the ash fields feed) / Day-night
  INVERTED against its family: day = heat-torpid basking on
  vent stone (ember is draining by day; so is everything in
  it), night = the hunting hours, when ember country turns
  comfortable / Curiosity mid-high and UNSETTLING — it comes
  to look at you the way the curious do, and the looking is
  also a measuring / Territory defends a vent cluster; scent-
  marks the vents (the toolbox's territory-and-scent entry) /
  Tameability LOWEST of the emblems — 15%; some individuals
  effectively wild forever, and the codex should say so
  honestly.
- **Difficulty contract**: Peaceful = awareness only, with a
  readable tell — scales tick and glow faintly as they shed
  heat when it notices you (the aggression is announced, per
  the pinned Peaceful pattern). Normal / Hostile = a real
  hunter with burst ambushes from vent steam; guard pets
  finally have an opposite number.
- **Drops**: sheds **Cinder Scales** (new item, under the
  items delegation) when basking — heat-darkened scale plates;
  candidate heat-gear material in later design, not load-
  bearing yet. Carapace's hot-country cousin, deliberately.
- **Hook**: ember country, with a pulse. A player learns the
  family from this animal: bask by day at a respectful
  distance, give the vents a wide berth at night, and never
  mistake its curiosity for the Meadowback's.

### 6. Hollow Hermit — the Fungal Hollow one-off (unique layer)

- **Life**: Fungus x Ordinary, COLONY property (Axis 1's
  colony rule, in its first real design: the colony is the
  creature). **Layer**: biome-unique — variant-gated to
  Fungal Hollow zones only. There is one per Hollow, if that.
- **Shape**: Husk primary (a giant hollow shroom shell, big
  enough to mistake for part of the Hollow — which is the
  point) + Multiped secondary (a skirt of small legs under the
  husk, visible only when it walks). Modifier: lantern-lit —
  a faint glow from inside the husk seams.
- **Locomotion**: Stationary by day (it is scenery; players
  will walk past it, and that is the design working) / Walking
  by night, very slow, only when unobserved if it can manage
  it. Primary recorded as Walking with a stationary habit —
  the doc's open primary/secondary question, answered by this
  species in favor of "both, by schedule."
- **Spectra**: Temperament fully timid — seals shut at
  approach, light, or noise / Social colony-solo (one colony,
  one husk) / Speed slowest on the roster / Size large (the
  husk; the colony is many small nothings) / Diet decomposer —
  it eats the Hollow's floor, slowly, from inside its house /
  Day-night STRICTLY nocturnal / Curiosity very low outward,
  but it WATCHES — the Visor Shroom's "watches nothing,
  probably" gets its answer here: something was watching /
  Territory one Hollow, absolutely / Tameability wild forever
  — you cannot tame a colony in a house; the untamable reason
  is the hive-controlled one from the behavior doc.
- **The encounter instead of taming**: stillness and dim light.
  A player who stays quiet near it at night, lantern low, may
  be LEFT something at dawn: a **Hollow Heart Spore** (new
  item, under the items delegation) set at the husk's base —
  the colony's trade, on the colony's terms. Repeatable
  rarely; never farmable on a timer a player can see.
- **Hook**: the Hollow keeps a secret, and the secret is a
  landlord. It also retroactively explains the Hollow: the
  richest compost, the tended-looking groves near the husk —
  someone has been gardening the dark for a long time.

## Build note — species as data (Adam's question, 2026-10-15)

Adam asked whether each creature / plant needs its own code
file, or whether a data file could carry them. Answer recorded
here for the eventual build phase (this chat builds nothing):

- **No per-species code files.** The game is already halfway
  data-driven: census tables, biome affinity lists, codex text,
  recipes, and yields are tables today (constants / biomes /
  worldGen). A species becomes **one entry in one species table**
  (a .ts data file in the biomes.ts pattern, so tsc — currently
  at zero errors — catches a malformed entry at build time).
- **The entry's fields are this doc's template.** Kind, Material,
  Shape (plan + secondary + modifiers), Locomotion (+ flight
  spectrum), all ten spectra, distribution layer + biome homes,
  drops / shed item + interval, tame percentage, guard style,
  codex text, size, palette. The design template and the data
  schema are the same list wearing two hats — that is deliberate.
- **Shared code is written once**: the wander / follow / guard
  engine, the taming roll, shed timers, and a mesh builder that
  assembles a placeholder body from Shape plan + palette + size
  (a blob is a squashed sphere; a multiped is a body on stepped
  leg cylinders; a winged thing is a body plus vane planes). A
  bespoke model, when one exists, overrides the placeholder by
  species id — one optional field, not a code fork.
- **Genuinely new behaviors are the only code** — and they are
  written once as named toolbox hooks (shedder, light-drinker,
  collector-guard) that data entries then reference by name.
  A new species that only remixes existing hooks is a data
  entry, full stop. Flora is even easier: growth stages, yields,
  and seeds are already pure data.
- **Honest limit**: data removes per-species *code*, not
  per-species *judgment* — balance, readability, and playtest
  still happen species by species. That part is this chat.

## Cross-references

- BIOMES_BRAINSTORM.md — the family x hybrid graph; creature
  homes are chosen per family / hybrid from it.
- CREATURE_BEHAVIORS_BRAINSTORM.md — shipped behavior, the
  behavior toolboxes, and the biome program's shipped-species
  stubs this doc designs forward from.
- CORE_MECHANICS.md — where pinned designs land when they ship.
