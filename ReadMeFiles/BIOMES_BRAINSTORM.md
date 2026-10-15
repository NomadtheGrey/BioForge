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
above; Mirror Marsh is Wetland's; Biolume Caverns is Fungal gone
fully dark (and already lives as the first cave stratum's name);
Lag Fields sit as Wetland × Storm's strange mist country.

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
