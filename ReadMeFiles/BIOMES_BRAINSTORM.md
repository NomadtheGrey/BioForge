# Biomes — Brainstorm + Settled Rules

**Status: MIXED (updated 2026-10-15).** The "Settled rules" section is
decided, and the first four ecological types are now implemented under
the per-zone model described below. On 2026-10-15 Adam settled the
GROWTH FRAMEWORK (families + variants, two-biome combinations as a
graph/matrix, plausible adjacency) — see "The biome graph" below.
The specific family roster, variant names, and hybrid names inside
that framework remain working drafts for his eyeball, and the biome
candidates remain BRAINSTORM ONLY; chosen ones move into
CORE_MECHANICS.md when they ship.

## Settled rules (pinned)

- **Biome = rules, zone name = poetry.** A biome is an ecological
  classification that drives spawn tables, hazards, lighting/fog, and other
  gameplay. A zone name is a unique poetic label for a place; flavor and
  exploration only. Biomes must look visually distinct from each other.
- **One zone, one biome (Adam, 2026-10-14).** A biome is a property of
  an entire surface zone and forms that zone's identity. Biomes do not
  form patches inside a zone. The starting zone — zone (0, 0), the
  current 100 m × 100 m map — is a meadow.
- **Zone names should fit their biome.** Names are generated from
  biome-specific word pools, so the name reinforces the ecology instead
  of contradicting it. A meadow should not be named as though it were a
  dry thicket or an ash waste.
- **The host generates zones** (noise-based terrain, caves, ruins) and peers
  receive them via `world_sync`. Peers never regenerate the world themselves.
- **World progression — the strangeness gradient (Adam, 2026-10-13).** The
  most bizarre biomes are reserved for zones farther from the starting zone.
  Danger *and* strangeness rise gently with distance traveled: near home,
  recognizable ecology and modest danger; far out, weirder physics, stranger
  creatures, rules that must be learned by living with them.
- **Preparation is the gate — never a lock.** Zone barriers are systemic, not
  token-based: solved with a game verb (build, grow, light, tame), never a
  key. Crafting tiers are just the recipe graph; there are no artificial tier
  locks. A player may push into a dangerous zone early and simply feel
  under-equipped.
- **The Field Synthesizer Gauntlet is the survival platform.** Resources
  gathered along the way improve it into environmental adaptations, e.g.:
  spore country → grown filtration membrane; ember country → thermal lining
  and heat-resistant resin; saltglass glare/cold → polarized insulated field;
  magnetic dunes → navigation/tool stabilizer; deep caves → a light
  reservoir charged by lantern-ferns. Each biome teaches the player how to
  survive the next one.
- **The helmet is the sensory platform (Adam, 2026-10-13).** The gauntlet
  acts on the world; a special helmet perceives it — vision, audio, and
  other senses. Grown modules, one per problem the planet teaches: biolume
  night-sight, spore/gas sight, echo-hearing for fog, glare/flare
  shielding, creature-mood readings, a precursor-glyph overlay in ruins.
  As precursor bio-tech it is a tame organism you wear. **Boundary:** the
  gauntlet and helmet are the two worn platforms, each upgraded as one
  item — no drift into a full suit of armor built piece by piece. (A full
  suit is a door left open for much later, not a current direction.)
- **Instanced interior zones (Adam, 2026-10-13).** Caves, ruins, and similar
  interiors are SEPARATE INSTANCES — their own zones — not spaces carved
  into surface terrain. An entrance links to an instance with its own
  layout, biome rules, and spawn tables, and the instance may sprawl far
  beyond its surface footprint. Consequences noted for when zones are built:
  entities, saves, and `world_sync` become zone-scoped; players may split
  across zones (the host simulates the occupied ones); pets need a zone-hop
  rule (v1: a following pet reappears beside its owner after a transition).
  Only the occupied instance needs full simulation and rendering.

## The biome graph — families, variants, combinations (Adam, 2026-10-15)

The growth framework, in Adam's formulation: **biomes form a graph —
lay the families on both axes of a matrix, and where two line up,
their combination is a hybrid biome.** The diagonal is the pure
biomes; every off-diagonal cell is a crossfade of its row and
column. It effectively **squares the biome count**: with *N*
families the world holds *N* pure biomes plus *N(N−1)/2* hybrids —
4 families → 10 zone identities, 6 → 21, 10 → 55 — each hybrid
needing only a name pool, a tint blend, and a rule or two of its
own, because both parents already exist.

- **Families and variants ("adjacently similar" is fine).** A
  *family* carries the baseline rules — affinity class, density,
  hazards, the gauntlet/helmet adaptation it teaches. A *variant*
  is a specific place inside a family: same skeleton, own tint,
  name pool, spawn seasoning, and one or two signature features.
  The four shipped biomes (meadow, wetland, fungal, ember) are the
  first families; the twelve candidates below slot in as variants.
- **THE VARIANT RULE (Adam, 2026-10-15): a variant belongs to ONE
  family, full stop.** It must read as its parent's own country —
  same materials, same weathers, pushed further — and never as a
  cross between two families. The working test: if a pitch needs
  a SECOND family's materials or weather to explain itself, it is
  not a variant; it is a HYBRID and waits for the hybrid pass.
  (First application, same day: the 'frozen forest' draft failed
  the test — no Forest family exists, Rootwood is the wooded one —
  and became the Ice Fangs as a variant, the Frozen Forest as a
  Frost x Rootwood hybrid candidate. Audit of the eleven shipped
  variants against the rule: all pass. Note glass appears in two
  families by two births — fire-fused in Ember's Obsidian Garden,
  salt-fused in Saltglass's Prism Beds — which the rule allows:
  the material is each family's own, made its own way.)
- **Combinations.** A zone may be a crossfade of two families. A
  hybrid inherits both parents' affinity lists (a species at home
  in either parent can appear) and blends their rules; its own
  signature feature comes from the *tension* between the parents.
- **Plausible adjacency (Adam's Ember/Wetland rule).** Clashing
  families never border directly — water does not leak into fire
  country and put it out. Where the graph would place a clash side
  by side, the world grows their HYBRID as the margin between them:
  the crossfade is the buffer. Generation consequence, noted for
  the build: zone rolls can no longer be fully independent — a new
  zone's roll must glance at its already-rolled neighbors (the
  host generates and stores zones, so neighbors exist to consult).

### The family roster (working draft — 10 families)

The shipped four, plus six promoted from the candidate bank and
Adam's Living thread. Each family is also a rung on the adaptation
ladder the gauntlet and helmet learn from (spore country teaches
filtration, ember teaches thermal lining, saltglass teaches
polarized fields, storm teaches stabilization…):

1. **Meadow** (shipped) — temperate life, home ground.
2. **Wetland** (shipped) — water, reeds, mist.
3. **Fungal** (shipped) — dark, spores, decomposers.
4. **Ember** (shipped) — heat, vents, ash.
5. **Saltglass** — glare, crystal, freeze-thaw swings. *(Saltglass
   Flats, Brine Shallows)*
6. **Rootwood** — canopy, giant roots, vertical shade. *(Rootwood
   Canopy)*
7. **Bone** — graveyards, death-fertile, scavenger country.
   *(Leviathan Graveyard)*
8. **Storm** — magnetic fields, shifting sand, updrafts.
   *(Magnetic Dunes, Skyfall Basin)*
9. **The Living** — the land is one organism (see below).
   *(Welcoming Valley, Hungry Valley)*
10. **Precursor** — nature growing through engineered geometry.
    *(Precursor Garden)*

Meadow variants on the bank: Leviathan Graveyard belongs to Bone
above; Mirror Marsh is Wetland's; Lag Fields sit as Wetland ×
Storm's strange mist country. **Biolume Caverns is NOT a surface
biome (Adam, 2026-10-15):** the caves already have their own
variety axis — the depth strata — and their darkness is total
without any "sleep schedule" machinery behind it. Different cavern
types are welcome, but they belong to the cavern system, not to
this graph; the name stays where it already lives, on the first
cave stratum.

### The Living family — one organism, two temperaments

The valley is a single dormant organism, and hosts have
temperaments (Adam, 2026-10-15: "does the flora almost behave like
fauna? Do alien vines reach out to touch you and say hello? Are
there hostile valleys that try to eat you?"):

- **The Welcoming Valley.** Curious, gentle flora: vines reach out
  and brush the traveler — a hello. The ground heals shallow
  damage; buildings are ACCEPTED, rooted in and strengthened.
- **The Hungry Valley.** Carnivorous flora with fauna behavior:
  stalking snap-vines, bushes leaning in to taste the air,
  unattended drops quietly digested, buildings pushed out like
  splinters. The hello and the grab begin with the same gesture —
  a vine reaching toward you; color and speed teach the difference.
- Mechanically near: snap traps are already flora with appetites,
  and taming already treats plants and creatures with the same
  interaction bones. Flora with fauna states (idle → alert → lunge)
  is an extension, not an invention.

### Example hybrids (working draft names)

- **Wetland × Ember → the Scalding Fens.** Geothermal marsh: steam
  vents, hot pools, resin plants grown fat. The clash, resolved
  into a real place — and the buffer that keeps its parents apart.
- **Meadow × Fungal → the Mulchwood.** Sunlit rot: giant
  toadstools in clearings, compost country, decomposers at peace.
- **Wetland × Saltglass → the Brine Shallows.** Salt crust cracking
  over mudflats, glare doubled on standing water.
- **Ember × Storm → the Iron Ashes.** Black magnetic sand over vent
  country; storms drag the dunes into new shapes overnight.

## Instantiating the graph — the working table (draft, 2026-10-15)

Adam's build order: **fill in the families, then put the biomes
into code ONE BY ONE** (the generation-queue cadence — each proven
in-game before the next). Each PURE biome, when its turn comes,
gets a short round of questions from Marlowe (its rules, its
hazards, what makes it itself) plus variant proposals, and Adam's
answers become its spec. **The HYBRIDS are the exception (Adam,
2026-10-15): no one-by-one review — that would take weeks.** A
hybrid is a blend of two parents that already had their question
rounds; Marlowe drafts its name, tint, and rule deltas by best
judgment, and Adam eyeballs the results in bulk. Two properties
every biome carries from birth:

- **Minimum distance** (`minHops`): no zone nearer than this to the
  starting zone may hold it — set by danger and exoticness. This
  refines the current hop bands into per-biome gates.
- **Rarity** (common / uncommon / rare): its weight among eligible
  rolls once the distance gate opens. Exotic biomes stay rare even
  where they're allowed (Adam: Magnetic Dunes and Skyfall Basin
  should not be common sights).
- **THE GATE CAP (Adam, 2026-10-15):** family `minHops` never
  exceeds **3**. Distance gates sort the near country; beyond 3
  hops, scarcity is RARITY's job (the far weird ones roll rare,
  not far). Variant gates are a separate dial and may sit at 4.
  Consequence for the table below: Storm's Magnetic Dunes and
  Skyfall Basin become family min 3 + RARE when their round comes.

And Adam's open structural note: **some biomes may be their own
family** (a family of one, hybrids still apply), and some may not
lend themselves to variants at all. Decided per biome, in its
question round — the table below is the draft to argue with.

### Families, distances, rarities, variants (DRAFT)

- **Meadow** — family min 0. *Meadow* (min 0, common; the starter).
  Variants: none on the bank yet. *Questions: does the home family
  even want variants, or is plainness its identity?*
- **Wetland** — family min 1. *Wetland* (min 1, common).
  *Mirror Marsh* (min 2, uncommon): reflective pools, lights
  doubled at night. *Questions: are the pools terrain (real water —
  the P5 question) or dressed ground? Does wet ground slow the
  walker? Do the doubled lights cost engine lights or fake it with
  brighter sprites?*
- **Fungal** — family min 2. *Fungal* (min 2, common).
  *Fungal Hollow* (min 3, uncommon): giant mushrooms, dim green
  shade, spore air. *Questions: giant mushrooms as scenery scale,
  harvestables, or climbable platforms? Spores: visual only, or a
  breathing hazard the filtration graft answers?*
- **Ember** — family min 3. *Ember* (min 3, common in band).
  *Ember Scar* (min 4, uncommon): cracked rock, working vents.
  *Questions: vents as hazard, resource (resin/heat), or both? Day
  heat drain — a stamina pressure, or comfort-by-night only?*
- **Saltglass** ✓ BUILT (2026-10-15) — the FIFTH FAMILY (first new
  family of the program): Tier 2, family min 3, the sparsest
  country yet (flora 0.75 / fauna 0.7); bands seat it from 3 hops
  (15%) growing to 30% at 5+. Only the lantern fern (everywhere)
  and the burrow mouse (everywhere) tolerate it among the old
  census — its emptiness is its identity. Variants, all built:
  *The Flats* (min 3, uncommon — endless pan; glare: light
  intensity x1.6, reach x1.15; Adam's questions answered: glare is
  a LIGHT effect, not a vision tax); *The Thaw* (min 4, uncommon —
  freeze-thaw; the Scar's mirror: NIGHTS drain stamina 6/s with
  cold, no health stage; cross by daylight); *The Prism Beds*
  (min 4, RARE — crystal reed beds; prism reeds harvest to
  SALTGLASS SHARD x2, the second glass crafting material).
  WORLD_GEN_VERSION 8. Its teaching, someday: a helmet visor.
- **Frost** ✓ BUILT (2026-10-15) — the SIXTH family built (11th on
  the roster; Adam reversed his creatures-chat decline and ordered
  it produced the same day). The STEADY STATE to Saltglass's
  swing: it never thaws; ice is terrain. Tier 2, family min 3 per
  the GATE CAP, uncommon; flora 0.7 / fauna 0.75; bands 15% at 3
  hops rising to 20% deep. Variants, all built: *The Stillwhite*
  (min 3, uncommon — constant cold: stamina -4/s day AND night,
  no warm hour; the Scar burns by day, the Thaw bites by night,
  the Stillwhite never lets up); *The Ice Fangs* (min 4, uncommon —
  frozen geyser teeth; RIME SPIRES harvest to NEVERMELT ICE, a
  third crafting material); *The Singing Ice* (min 4, RARE — a
  frozen lake-field; light reach x1.3 through the ice; the gift
  variant). WORLD_GEN_VERSION 9. Graph note: Ember is Frost's
  clash pair (never adjacent; their hybrid margins them).
  TAXONOMY (Adam's catch, 2026-10-15): a 'frozen forest' is NOT a
  Frost variant — there is no Forest family (Rootwood is the
  wooded one), so a frozen forest is shaped like a cross. It is
  recorded here as a hybrid candidate: **Frost x Rootwood → the
  Frozen Forest**, for the delegated hybrid pass.
- **Rootwood** ✓ BUILT (2026-10-15) — the SEVENTH family built:
  the wooded one (there is no 'Forest' family; this is the seat).
  Tier 1, family min 2, common; the lushest densities yet (flora
  1.3 / fauna 1.0); bands 25% at 2 hops thinning to 5% at 4 and
  GONE by 5 — home-country by design. Petal mills, sap weavers
  and soft puffs hold census affinities here now. Variants, all
  built: *Rootwood Canopy* (min 2, uncommon — signature; biggest
  roots, bright clearings, 2 bridges), *The Underroot* (min 3,
  uncommon — canopy gloom: light reach x0.7, the family's scar is
  darkness), *The Rootfall* (min 3, uncommon — a fallen giant;
  the gift variant, thickest heartroot). HEARTROOT stands grow in
  every rootwood zone and harvest to HEARTWOOD, the premium
  building wood. **THE BRIDGES — COMMITTED AND BUILT (Adam's
  round answers):** walkable root decks strung tower to tower in
  every rootwood zone (1-2 per zone), built from the game's own
  structure types — wall towers, pre-grown vine ladders, level-1
  root-tile decks — so they persist in snapshots and inherit
  datum/support/solvent rules free. Adam's questions answered:
  bridges ARE walkable (click a tower ladder up; bounce-shrooms
  also serve; step off and the story rules drop you), and yes,
  the canopy darkens the ground (the Underroot). HONEST LIMIT:
  the 'ramp' is a ladder tower in v1 — true sloped walking is
  P5-terrain machinery, and when terrain lands the towers can
  grow real ramps. WORLD_GEN_VERSION 10.
- **Bone** ✓ BUILT (2026-10-15) — the NINTH family built:
  graveyard country, death-fertile, scavenger land. Tier 2,
  family min 3, uncommon; bands 10% at 3 hops. Adam's round
  answers: the Graveyard ROLLS as a rare variant — rarity does
  the scarcity work, no landmark bookkeeping (zone rolls stay
  pure functions of seed + coords); gravebloom and BONE MEAL
  approved. Variants, all built: *The Bonefields* (min 3,
  uncommon — fragments everywhere, flora in their shade), *The
  Marrow Flats* (min 3, uncommon — the generous face, flora
  x1.3), *Leviathan Graveyard* (min 4, RARE — ONE impossible
  skeleton as generated scenery: ribs seven meters tall you
  walk under, a skull like a house; exactly one per graveyard
  zone, harness-asserted). Bone fragments scatter through every
  bone zone. GRAVEBLOOM — a pale flower rooted in bone —
  harvests to bone meal x2 + dew; vesper gliders hold the
  scavenger sky here. WORLD_GEN_VERSION 12.
- **Storm** ✓ BUILT (2026-10-15) — the TENTH family built and
  the FIRST OF TIER 3 (the Far Weird has a citizen). Family min
  3 per the GATE CAP; bands 5%. Adam's round: the Charged
  Flats approved as the common face; LIGHTNING ZOTS approved —
  and built: family-wide on the surface, a still-bright warning
  banner ~2.5s before each strike, shelter under any floor or
  roof (root bridges count), a hit costs 15 health + emptied
  stamina under scar heat's death rules. Rates ride a new
  optional zotIntervalSec on variant defs (plain Storm 35s).
  Variants, all built: *The Charged Flats* (min 3, COMMON —
  the everyday face: humming air, fulgurite fingers, zots
  ~30s), *Magnetic Dunes* (min 4, RARE — black sand, zots
  ~16s, fulgurite thickets), *Skyfall Basin* (min 4, RARE —
  the basin drinks the charge: zots ~60s, flora x1.3; the
  falling-up rain stays a report, not a claim, until weather
  VFX exists). STORMCATCHER reeds drink the lightning and
  harvest to FULGURITE SHARDS. WORLD_GEN_VERSION 13.
  *Questions (both): how rare is rare — one eligible roll in ten?
  For Dunes: does the minimap/compass actually fail (helmet
  stabilizer as the answer)? For Skyfall: are the updrafts a
  movement verb (ride a column) or weather dressing?*
- **The Living** — family min 4. *Welcoming Valley* (min 4, rare),
  *Hungry Valley* (min 5, rare). Treated above. *Questions: can a
  host's temperament be read before entering (edge signals)? Does
  feeding a hungry host change it — the ultimate taming?*
- **Precursor** ✓ BUILT (2026-10-15) — the EIGHTH family built:
  gardens of the vanished, nature growing through engineered
  geometry. Tier 2, family min 3, uncommon; tended densities
  (flora 1.1 / fauna 0.8); bands 15% at 3 hops. Adam's round
  answers: (1) ruins roll in nearly any biome already — gardens
  change nothing, no suppression; (2) the gardens pay TWICE —
  LIVING THREAD and rich ordinary stock (bell blooms and sap
  weavers hold census affinities here). PRECURSOR BLOOMS grow in
  an ARCHIMEDEAN SPIRAL around a seeded center in every precursor
  zone — planted order you can read from across the zone — and
  harvest to living thread x2 + dew. Variants, all built:
  *Precursor Garden* (min 3, uncommon — the spiral at full
  strength, flora x1.25), *The Untended* (min 3, uncommon — the
  spiral gone feral, jittered and dark), *The Tending Field*
  (min 4, RARE — densest spirals). THE TENDERS, RESOLVED
  (Adam, 2026-10-15): there are no machines in BioForge — this
  is a biological planet. The tenders are FORGED creatures
  (the creatures taxonomy's own category: precursor-made,
  grown not evolved), purpose-shaped for garden work, biggish
  and LONG DEAD. Their husks now generate as scenery — a
  ribcage-and-skull-dome structure, thickest in the Tending
  Field — and the alert copy was corrected: grown, not built.
  Living Forged tenders (the mimic-guardian seat) remain a
  creature-phase question. WORLD_GEN_VERSION 11.

WEATHER ✓ BUILT (2026-10-15, Adam's go-ahead): one engine
particle sky, resolved per zone face by zoneWeatherAt — the
Skyfall's rain falls UP (its alert copy no longer calls it a
report), Storm country rains (the zot's missing half), Frost
snows, Ember sheds ash (the Ashen Drift heaviest), Wetland
drizzles, the Mirror Marsh stays STILL on purpose, margins
take their own skies where named (Iron Ashes rain, Frozen
Forest snow). Weather hides itself inside caves and ruins.

HYBRID PASS ✓ BUILT (2026-10-15, Adam's go-ahead; BORDER-
DERIVED per his ruling): zoneHybridAt reads a zone's four
neighbors' pure family rolls — where a tabled pair meets and
the strength roll passes, the margin grows. Seven named
hybrids (Scalding Fens, Mulchwood, Brine Shallows, Iron Ashes,
Frozen Forest, Cold Marsh, Hedgewood — names harvested from
the creature dossiers); every other pair rides a default blend
(low strength) until its dossier names it; ember×frost has NO
entry and never margins. Generation admixes (census opens to
both families, densities average, a guaranteed signature stand
of the neighbor's emblem flora); hybrid zones carry no variant;
home country (0–1 hops) never margins. WORLD_GEN_VERSION 15.
The biome graph is COMPLETE in code: 11 families, 27 variants,
55 hybrid cells.

THE GRADIENT STEP ✓ BUILT (2026-10-15, Adam's directive):
distance now drives ALL of it — ruin presence and second-site
chances rise with hops (0.62/0.12 at home → 0.88/0.30 far),
joining the ruin size tiers and interior density that already
ramped; cavern grids grow with their mouth's zone hops (44
cells near home, byte-identical at 0–2 hops, up to 56 far);
level-1 cavern richness scales with hops, rares fastest.

FUNGI FILL-IN ✓ BUILT (2026-10-15, Adam's go-ahead): the
first family's roster completed — *The Mycelium Web* (min 2,
uncommon: the Hollow's giants planted in a seeded RING, spore
air), *The Glowfen* (min 2, uncommon: cave glow-fungus growing
TOPSIDE, light pushed up and out — pure fungal, the pools are
biolume), *The Petrified Grove* (min 3, RARE: giants turned to
stone as generated scenery, flora thinned — subtraction
country). Fungal now has four faces like every other family.

First instantiation (Marlowe's recommendation, for Adam's call):
**Fungal Hollow** — nearest to the shipped fungal, so the variant
machinery (per-biome gates, variant name pools, tint/density
deltas) gets proven on the cheapest real content before the exotic
families ask harder questions of the engine.

## Implemented first pass (2026-10-14)

The shipped ecological types are **meadow, wetland, fungal, and
ember**. Zone biome is selected from the world seed + zone coordinates
using hop distance from the spawn zone: immediate neighbors are meadow
or wetland, fungal enters at two hops, ember at three, and ember
dominates the far field. The current HUD can therefore identify the
zone beyond each map edge — neighboring zone name + biome — even though
travel between surface zones is not implemented yet.

The four names formerly used as quadrant labels are no longer separate
places. Their words survive in biome-appropriate name pools:
*Turquoise Glade* (wetland), *Violet Cradle* (fungal), *Prismatic
Verge* (ember), and *Amber Thicket* (fungal). The candidate biomes
below remain a larger idea bank for future types and should not be read
as the current four-type table.

## Candidate biomes — the nearer ring (earth-recognizable)

- **Mirror Marsh.** Shallow reflective pools, reeds, mud, drifting mist.
  Plants grow fast, movement slows in wet ground, burrowers avoid it,
  pollinators thrive. At night every light is doubled by reflection.
  *Behaviors that live here: pollinator rounds, parents and juveniles.*
- **Fungal Hollow.** Giant mushrooms, dim green shade, floating spores.
  Decomposers, colony organisms, rich compost. *Behaviors: colony merge,
  chemical moods, shared memory spores.*
- **Ember Scar.** Cracked black rock, geothermal vents, orange grass in the
  cracks. Hot and draining by day, comfortably warm at night.
  Heat-resistant grazers, resin-rich plants. *Behaviors: herd and sentinel,
  basking/sleep schedules.*
- **Saltglass Flats.** White salt, crystalline reeds, brutal glare by day,
  bitter cold after dark. Eyesight is unreliable; creatures navigate by
  vibration. *Behaviors: light-drinking, echo mimic.*
- **Rootwood Canopy.** Enormous roots form walls, bridges, and ceilings.
  Deep shade below, bright clearings above. *Behaviors: gravity-sick hopper,
  dream double, parents and juveniles nesting in root hollows.*
- **Leviathan Graveyard.** Ribs and skull of something impossibly large,
  half-buried in unusually fertile soil. Peaceful, strange, a little
  reverent. *Behaviors: scavenging, territory and scent, burrow and cache.*

## Candidate biomes — farther out (properly alien)

Reserve these for distance, per the strangeness gradient.

- **Biolume Caverns.** A cave biome where it is always night. Every living
  thing glows; darkness itself is a resource. The fern-lighting system
  becomes central, not decorative. *Behaviors: light-drinking, sleep
  schedules inverted.*
- **The Living Valley.** The ground is the skin of a dormant organism. It
  pulses slowly, heals shallow damage, and reacts to building: some
  structures are accepted and rooted in, others are pushed out like
  splinters.
- **Lag Fields.** Pale mist where sound and movement leave delayed echoes.
  Creatures appear seconds behind themselves; alarm calls arrive from the
  wrong direction. *Behaviors: echo mimic, blink-when-unobserved.*
- **Precursor Garden.** Wild nature growing through engineered geometry:
  perfect plant spirals, irrigation channels, broken cultivation machinery,
  ruins that still tend the ecosystem. *Behaviors: tool-aware creatures,
  mimic guardians.*
- **Magnetic Dunes.** Black sand reshapes during magnetic storms. Buried
  caches and ruins surface and vanish; compasses and minimaps become
  unreliable. *Behaviors: colony merge aligning like iron filings, burrow
  and cache under shifting ground.*
- **Skyfall Basin.** Nutrient rain falls *upward* from ground vents in
  rhythmic bursts. Floating seeds ride the columns; flying creatures surf
  them. Harvesting is partly about timing the next eruption.

## Suggested first four (Marlowe's picks, unapproved)

**Mirror Marsh, Fungal Hollow, Ember Scar, Biolume Caverns** — each changes
how you play rather than merely changing the wallpaper, and each gives
several brainstormed behaviors a natural home.

## World events — the turning (brainstorm, Adam 2026-10-13)

An event layer above the biomes: every so often the world *turns* — briefly
and terribly (the Pitch Black pattern: the safe world and the deadly world
are the same place at different hours). Candidate triggers, each inverting
a different rule:

- **Eclipse.** Darkness at noon; hordes of vicious predators come out, and
  things that fear lantern light stop fearing it.
- **Solar flare.** The sky goes wrong; gauntlets spark and stutter;
  light-drinking creatures gorge and glow mad.
- **Tectonic stirring.** Vents open, volcanoes mutter, toxic gas pools in
  the low places — and the caves breathe it out.
- **The Fog.** Perfectly ordinary fog, except visibility drops to arm's
  length and things move in it.

Design rules proposed (unpinned):

- **Rare enough to be legend, forecastable enough to be fair** — ruin
  warnings, and artifact "weather organs" that twitch a day ahead.
- **Survived with the game's verbs** — build the shelter, grow the light,
  post the guard pets — never a raw damage check. In co-op it is the great
  social moment: everyone home before it hits.
- **A world may have a signature calamity**, tied to its fate (see
  LORE_AND_ARTIFACTS_BRAINSTORM.md).
- Event hordes are made of **untamables** (see CREATURE_BEHAVIORS_
  BRAINSTORM.md). Open: what the hordes do in Peaceful mode.

This is distinct from the deferred weather system below: these are rare
calamities, not daily weather.

## Open questions — not yet handled (Adam, 2026-10-13)

- **Terrain height.** The world is perfectly flat on the 2 m building grid
  today, and hills are known to fight the grid's placement, click, and
  movement assumptions. Options on record, undecided: gentle height
  variation with flattened build areas, or a flat play area with procedural
  scenery beyond it. Instanced caves sidestep this underground only.
- **Alien rivers.** Rivers flowing with weird liquids rather than water are
  wanted but undesigned: courses and banks, what the liquid does (flow,
  buoyancy, hazard, resource), and which creatures live in and around it.
- **Foggy places.** Fog as a place property — visibility, mood, and
  gameplay (echo mimics and alarm calls behaving badly in fog) — is
  unhandled beyond biomes carrying lighting/fog hooks in their rules.
- **Weather.** A weather system is explicitly deferred: handle later.
  (Distinct from the rare world-event calamities above.)

**TIERS RENUMBERED (Adam, 2026-10-15):** biome tiers now run 0-3, matching
the crafting tiers — Tier 0 Hearthlands, Tier 1 The Wilds, Tier 2 Strange
Country, Tier 3 The Far Weird. The registry in biomes.ts carries tier +
minHops + rarity per biome; the harness holds them in agreement.

**FUNGAL HOLLOW — SPEC + SHIPPED (2026-10-15, live bundle index-CVWRZt1W.js).**
Adam's answers: the giant mushrooms come in SEVERAL kinds, as on Earth —
all harvestable. Three kinds shipped: Antenna Shroom (senser, glowing
antenna tips; yields glow spores + dew), Visor Shroom (the almost-face:
two eye-spots and a mouth arc; rich compost + spores), Shelf Shroom (flat
bracket stacks; soft fiber + compost). Twelve giants per hollow zone,
scaled 1.7-2.7x, bonus life outside the census. The spores are REAL: the
air taxes stamina 8/s on the surface (cancels walking regen), and a
one-time-per-world alert names the problem AND the solution — a helmet
with a filter upgrade (future content; the effect is built so the filter
can switch it off). Variant machinery shipped with it: zoneVariantAt,
VariantDef registry (tint/densities/effect), variant name pools, HUD kind
labels, engine tint override. CLIMBING is deferred to Adam's parked idea:
a cheap, opaque base WALL that supports a vine ladder — that will be how
players climb, shelves included.

**MIRROR MARSH — SHIPPED (2026-10-15, live bundle index-LC2kEKSG.js).**
Wetland variant, Tier 0, min 2 hops, uncommon. The pools are dressed
ground for now (the lily's mesh carries its own reflective pool disc;
real water is the P5 conversation). THE LIGHT TRICK (Adam's numbers):
light DISTANCE x2, intensity x1.2 in the marsh — the merge formula
already amplifies brightness, so reach is what reflection buys; the
registry field (lightDistanceMult/lightIntensityMult) lets future
biomes reuse it. Life: 8 Mirror Lilies (dew x3 + reed), 3 Mirror Moths
(pollinators; shed dew essence wild or tame). Effect: marsh_sluggish —
surface movement x0.85; its alert names the future answer, Waders.

**THE THREE PLATFORMS (Adam asked for the call, 2026-10-15; Marlowe's
call, accepted):** boots WILL be instantiated — as the third and FINAL
equipment platform. Gauntlet = ACT, Helmet = KNOW, Boots = MOVE. The
anti-suit rule: a platform may exist only if it owns a verb; three
verbs, three platforms; no stats, no set bonuses, no paper doll.
Boots are their own later build (question round included); biomes
ship ahead of them with alerts naming the answers (filter, Waders),
exactly as the Hollow shipped ahead of the helmet.

**EMBER SCAR — SHIPPED (2026-10-15).** Ember variant, Tier 2, min 4
hops, uncommon. Cinder blooms grow on the vents (resin sap x2 + dew).
THE HEAT (Adam's escalation): by day the scar drains stamina at 16/s
— faster than any regen — and at empty stamina it takes HEALTH at
1.2/s; by night the warm ground restores stamina +8/s. Its alert
teaches the rhythm: cross at dawn, rest after dark. (DEATH LANDED
the same day: on Normal/Hostile worlds health may reach 0 — the
respawn wakes you at the original spawn base, vitals restored,
pouch untouched; Peaceful keeps the floor of 1. Normal is now
selectable at the New Game screen.)
Ember roster COMPLETE (2026-10-15): Ember Scar ✓, **the Ashen
Drift** ✓ (deep ash; pooled-light REACH x0.6 — the marsh trick
inverted; darkness is its tax, no stamina drain), **the Obsidian
Garden** ✓ (black glass flowers; harvest yields the OBSIDIAN
SHARD crafting material, 2 per bloom). The ember family now has
its full four faces: plain, Scar, Drift, Garden.
