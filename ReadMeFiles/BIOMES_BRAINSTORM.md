# Biomes — Brainstorm + Settled Rules

**Status: MIXED (2026-10-13).** The "Settled rules" section is decided.
The biome candidates are BRAINSTORM ONLY — none are pinned; they get sorted
later, and chosen ones move into CORE_MECHANICS.md.

## Settled rules (pinned)

- **Biome = rules, zone name = poetry.** A biome is an ecological
  classification that drives spawn tables, hazards, lighting/fog, and other
  gameplay. A zone name is a unique poetic label for a place; flavor and
  exploration only. Biomes must look visually distinct from each other.
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
