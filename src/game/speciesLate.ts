// speciesLate.ts — the late fauna waves (slices 20+).
//
// Split out of species.ts at slice 24 (2026-10-16) when the
// fauna table crossed the ~131K single-push cap — the same
// relief pattern as floraCodex.ts and creatureMeshesLate.ts.
// species.ts spreads SPECIES_LATE into SPECIES; consumers see
// one table. New fauna entries go HERE from slice 25 on.

import type { SpeciesDef } from './species';

export const SPECIES_LATE: Record<string, SpeciesDef> = {
  // ------------------------------------------------------------------
  // Slice 20 (2026-10-16) — fauna wave 5: the worms and the
  // margins (the Iron Ashes' evidence chain completed, the
  // clash margin's eel, the garden that nests).
  // ------------------------------------------------------------------

  // #15 — the biome program asked whether anything NESTS in
  // the glass gardens: yes — a lightly-crystalline winged
  // nester of the Obsidian Garden (gated to the garden as
  // built, in Saltglass country). 30%: a tenant's rate, not
  // a pet's.
  shardwing: {
    id: 'shardwing',
    name: 'Shardwing',
    profile: 'flyer',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Shardwing',
    byproduct: null,
    flight: { altitude: 2.2, bobHeight: 0.25, bobRate: 1.8, flapRate: 3.4 },
    bonusSpawn: {
      biomes: ['saltglass'],
      variant: 'obsidian_garden',
      count: 2,
      minRadius: 10,
      spacing: 6,
      speed: 2.2,
      speedJitter: 0.15,
      health: 14,
    },
  },

  // #26 — iron-fed and plate-ringed: it burrows the Iron
  // Ashes' magnetic sand (the ground rumbles with a metallic
  // note where it passes) and sheds ring-plates — Ironworm
  // Plate, the original the Ironjaw wears secondhand. 10%:
  // even its taming is mostly mineral.
  ironworm: {
    id: 'ironworm',
    name: 'Ironworm',
    profile: 'insect',
    tameChance: 0.1,
    bait: 'nectar',
    petName: 'Ironworm',
    byproduct: { item: 'ironworm_plate', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['ember', 'storm'],
      hybrid: ['ember', 'storm'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 1.0,
      speedJitter: 0.1,
      health: 40,
    },
  },

  // #29 — the Ashswimmer's rhyme in the opposite country:
  // white-furred, blind, burrowing THROUGH SNOWPACK in the
  // Stillwhite — the mode reads its substrate honestly.
  // 35%.
  driftworm: {
    id: 'driftworm',
    name: 'Driftworm',
    profile: 'insect',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Driftworm',
    byproduct: null,
    bonusSpawn: {
      biomes: ['frost'],
      variant: 'frost_stillwhite',
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 1.1,
      speedJitter: 0.1,
      health: 30,
    },
  },

  // #34 — it swims ASH: finned along the rings, ash-fed, in
  // the Ashen Drift — the Driftworm's plan in the country
  // where the drifts burn. 15%. Its shed fin-rings are
  // recorded WITHOUT an item on purpose (ash and chitin,
  // compost-grade leavings): no byproduct.
  ashswimmer: {
    id: 'ashswimmer',
    name: 'Ashswimmer',
    profile: 'insect',
    tameChance: 0.15,
    bait: 'nectar',
    petName: 'Ashswimmer',
    byproduct: null,
    bonusSpawn: {
      biomes: ['ember'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 1.4,
      speedJitter: 0.15,
      health: 22,
    },
  },

  // #54 — clear-bodied: you see its last meal as a silhouette,
  // which IS the encounter. A frost-veined crystalline serpent
  // of the Saltglass × Frost country, slithering over ice.
  // 10%. It sheds whole, in one clear tube: Glass Shed.
  glass_snake: {
    id: 'glass_snake',
    name: 'Glass Snake',
    profile: 'serpent',
    tameChance: 0.1,
    bait: 'nectar',
    petName: 'Glass Snake',
    byproduct: { item: 'glass_shed', seconds: 360, tamedOnly: false },
    bonusSpawn: {
      biomes: ['saltglass', 'frost'],
      hybrid: ['saltglass', 'frost'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.9,
      speedJitter: 0.1,
      health: 20,
    },
  },

  // #56 — the CLASH MARGIN's citizen: where Ember and Frost
  // face off without touching, the argument makes a place —
  // meltwater channels in black rock, steam standing in cold
  // air — and this eel keeps the channels. 20%.
  steam_eel: {
    id: 'steam_eel',
    name: 'Steam Eel',
    profile: 'serpent',
    tameChance: 0.2,
    bait: 'nectar',
    petName: 'Steam Eel',
    byproduct: null,
    bonusSpawn: {
      biomes: ['ember', 'frost'],
      hybrid: ['ember', 'frost'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.8,
      speedJitter: 0.1,
      health: 24,
    },
  },

  // #72 — its whole art is the FREEZE: at a threat it flattens,
  // salt-mottled and pan-still, and becomes a sculpture of
  // itself. A statue-lizard startling at your feet is the
  // flats' smallest jump and best joke — the design protects
  // it, and so does this table: no drops, no hunt, all joke.
  // 40%.
  pan_lizard: {
    id: 'pan_lizard',
    name: 'Pan Lizard',
    profile: 'lizard',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Pan Lizard',
    byproduct: null,
    bonusSpawn: {
      biomes: ['saltglass'],
      count: 3,
      minRadius: 8,
      spacing: 3,
      speed: 2.2, // bursts, then sculpture
      speedJitter: 0.2,
      health: 10,
    },
  },

  // #74 — a midge is a rumor with wings: a pale COLONY at
  // small scale over the Frost family's seeps, obligate
  // flyers at whisper height. Untameable — there is no
  // individual here to tame; the colony is the citizen.
  seep_midge: {
    id: 'seep_midge',
    name: 'Seep Midge',
    profile: 'insect',
    tameChance: null,
    bait: null,
    petName: 'Seep Midge',
    byproduct: null,
    flight: { altitude: 0.7, bobHeight: 0.15, bobRate: 3.0, flapRate: 14 },
    bonusSpawn: {
      biomes: ['frost'],
      count: 4,
      minRadius: 8,
      spacing: 2,
      speed: 1.6,
      speedJitter: 0.25,
      health: 3,
    },
  },

  // #85 — its wings carry the gardeners' Archimedean spiral,
  // one per wing, EXACT — a moth the gardens signed. An
  // obligate flyer of the family cast. (Tameability is the
  // design's quiet field here; the table reads a garden
  // citizen at 35%, the moth rate's daylight end.)
  spiral_moth: {
    id: 'spiral_moth',
    name: 'Spiral Moth',
    profile: 'flyer',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Spiral Moth',
    byproduct: null,
    flight: { altitude: 1.6, bobHeight: 0.25, bobRate: 1.8, flapRate: 4.5 },
    bonusSpawn: {
      biomes: ['precursor'],
      count: 2,
      minRadius: 9,
      spacing: 5,
      speed: 1.8,
      speedJitter: 0.15,
      health: 8,
    },
  },

  // #96 — the valley's own animal, grown the way the Greeter
  // is grown, running the mirror rule like everything in the
  // Living: in a Welcoming valley it is the hound at the
  // threshold that wags; in a Hungry one, the hound at the
  // threshold. Untameable — it belongs to the valley, not to
  // you. (Its bespoke threshold behavior is deferred with
  // the valley staff's other behaviors; the table deals the
  // citizen.)
  threshold_hound: {
    id: 'threshold_hound',
    name: 'Threshold Hound',
    profile: 'predator',
    tameChance: null,
    bait: null,
    petName: 'Threshold Hound',
    byproduct: null,
    bonusSpawn: {
      biomes: ['living'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 2.0,
      speedJitter: 0.1,
      health: 55,
    },
  },

  // #103 — a patient, long-legged picker of the White Fields,
  // white-mottled, working the salt pans bone by bone. A lined
  // nest's fallen lining is Picker Down: white, salt-stiff,
  // the fields' one soft export. 25%.
  saltpicker: {
    id: 'saltpicker',
    name: 'Saltpicker',
    profile: 'flyer',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Saltpicker',
    byproduct: { item: 'picker_down', seconds: 360, tamedOnly: false },
    flight: { altitude: 1.9, bobHeight: 0.25, bobRate: 1.8, flapRate: 4.0 },
    bonusSpawn: {
      biomes: ['saltglass', 'bone'],
      hybrid: ['saltglass', 'bone'],
      count: 2,
      minRadius: 10,
      spacing: 6,
      speed: 2.1,
      speedJitter: 0.15,
      health: 16,
    },
  },

  // #161 — arm-long at the big end, in the Drowned Graveyard
  // where the Graveyard's low edge floods and the bones stand
  // in black water: a leech of the margin pools. Untameable
  // (0%) — the margin's tithe-collector, and nobody's pet.
  marrow_leech: {
    id: 'marrow_leech',
    name: 'Marrow Leech',
    profile: 'slug',
    tameChance: null,
    bait: null,
    petName: 'Marrow Leech',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland', 'bone'],
      hybrid: ['wetland', 'bone'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 0.9,
      speedJitter: 0.1,
      health: 35,
    },
  },

  // ------------------------------------------------------------------
  // Slice 22 (2026-10-16) — fauna wave 6: the winged ranges
  // and the wisps (the ubiquitous layer's third citizen, the
  // bridges' weaver, the ice's glider and fisher).
  // ------------------------------------------------------------------

  // #62 — the ubiquitous layer's third designed member: a
  // small vapor wisp that keeps company with good fires — it
  // CERTIFIES hearths (the Hearth Cap fruits only where it
  // approves). Everywhere, gently. Untameable: it visits; it
  // does not keep.
  hearth_wisp: {
    id: 'hearth_wisp',
    name: 'Hearth Wisp',
    profile: 'drifter',
    tameChance: null,
    bait: null,
    petName: 'Hearth Wisp',
    byproduct: null,
    flight: { altitude: 0.8, bobHeight: 0.18, bobRate: 1.4 },
    bonusSpawn: {
      biomes: 'all',
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.2,
      speedJitter: 0.15,
      health: 6,
    },
  },

  // #105 — a precursor-made wisp, STILL RUNNING ITS ROUTE on
  // the Precursor × Storm far margin: node-lit, brightening
  // at its turning points, centuries into a delivery schedule
  // nobody alive remembers assigning. Untameable — it has a
  // job.
  relay_wisp: {
    id: 'relay_wisp',
    name: 'Relay Wisp',
    profile: 'drifter',
    tameChance: null,
    bait: null,
    petName: 'Relay Wisp',
    byproduct: null,
    flight: { altitude: 1.2, bobHeight: 0.2, bobRate: 1.6 },
    bonusSpawn: {
      biomes: ['precursor', 'storm'],
      hybrid: ['precursor', 'storm'],
      count: 1,
      minRadius: 13,
      spacing: 8,
      speed: 1.7, // route pace, kept for centuries
      speedJitter: 0.05,
      health: 8,
    },
  },

  // #149 — PHASING's second citizen: a ruin-dusted vapor moth
  // of the far margins whose phasing is by after-image — it
  // is briefly where it was, and then it isn't. Untameable
  // (0%): you cannot lure a rumor of a moth.
  gap_moth: {
    id: 'gap_moth',
    name: 'Gap Moth',
    profile: 'flyer',
    tameChance: null,
    bait: null,
    petName: 'Gap Moth',
    byproduct: null,
    flight: { altitude: 1.7, bobHeight: 0.25, bobRate: 1.6, flapRate: 3.2 },
    bonusSpawn: {
      biomes: ['precursor', 'storm'],
      count: 1,
      minRadius: 13,
      spacing: 8,
      speed: 2.0,
      speedJitter: 0.15,
      health: 8,
    },
  },

  // #36 — the biome program's flora note asked outright that
  // something live ON the bridges eventually: a long-limbed
  // weaver that keeps the root bridges' rigging, re-rigging
  // anchor-lines as the wood grows. It sheds silk anchor-lines
  // when it re-rigs: Deck Silk, bridge-grade fiber. 35%.
  deck_weaver: {
    id: 'deck_weaver',
    name: 'Deck Weaver',
    profile: 'insect',
    tameChance: 0.35,
    bait: 'nectar',
    petName: 'Deck Weaver',
    byproduct: { item: 'deck_silk', seconds: 300, tamedOnly: false },
    bonusSpawn: {
      biomes: ['rootwood'],
      count: 2,
      minRadius: 10,
      spacing: 6,
      speed: 1.5,
      speedJitter: 0.15,
      health: 14,
    },
  },

  // #31 — surface gliding on ice: a long-legged, mirror-footed,
  // crystal-padded skater of the Singing Ice. It renews its
  // foot-pads on shore — and the entry is explicit, and this
  // table repeats it as law: NEVERMELT ICE STAYS SINGLE-SOURCE
  // (the Rime Spires). The pads are leavings, not a door:
  // no byproduct. 25%.
  lake_glider: {
    id: 'lake_glider',
    name: 'Lake Glider',
    profile: 'insect',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Lake Glider',
    byproduct: null,
    bonusSpawn: {
      biomes: ['frost'],
      variant: 'frost_singing',
      count: 2,
      minRadius: 11,
      spacing: 6,
      speed: 2.6, // gliding
      speedJitter: 0.15,
      health: 18,
    },
  },

  // #98 — the Winged + Swimming ruling cashed in: a winged
  // fisher whose wings are FLIPPERS (penguin logic, exact),
  // working the Singing Ice and the Stillwhite's coasts from
  // the air side of the ruling. It molts flightless feathers
  // at the edge: Fisher Down, insulation's fourth door in
  // this family. 30%.
  frost_fisher: {
    id: 'frost_fisher',
    name: 'Frost Fisher',
    profile: 'flyer',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Frost Fisher',
    byproduct: { item: 'fisher_down', seconds: 360, tamedOnly: false },
    flight: { altitude: 1.8, bobHeight: 0.25, bobRate: 1.8, flapRate: 4.5 },
    bonusSpawn: {
      biomes: ['frost'],
      count: 2,
      minRadius: 11,
      spacing: 6,
      speed: 2.2,
      speedJitter: 0.15,
      health: 20,
    },
  },

  // #115 — the Warm Range's lark: it dust-bathes in ash,
  // storm-dust, and salt indifferently — the range's whole
  // palette is its bath. 40%.
  ash_lark: {
    id: 'ash_lark',
    name: 'Ash Lark',
    profile: 'flyer',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Ash Lark',
    byproduct: null,
    flight: { altitude: 1.7, bobHeight: 0.25, bobRate: 2.0, flapRate: 5.0 },
    bonusSpawn: {
      biomes: ['ember', 'meadow', 'storm', 'saltglass'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      speed: 2.3,
      speedJitter: 0.15,
      health: 10,
    },
  },

  // #117 — the Wet Range's woven citizen: it nests INTO reed
  // stands, climbing in the reeds as much as flying between
  // them. Old nests salvage as thatch, unlisted. 25%.
  reedbird: {
    id: 'reedbird',
    name: 'Reedbird',
    profile: 'flyer',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Reedbird',
    byproduct: null,
    flight: { altitude: 1.5, bobHeight: 0.22, bobRate: 2.0, flapRate: 4.6 },
    bonusSpawn: {
      biomes: ['wetland', 'rootwood', 'fungal', 'meadow'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      speed: 2.1,
      speedJitter: 0.15,
      health: 10,
    },
  },

  // #342 — it sings BEFORE fronts, in the pressure-drop
  // stillness: the Temperate and Storm ranges' living
  // barometer. A thrush that tells weather by singing at it
  // first. 40%.
  storm_thrush: {
    id: 'storm_thrush',
    name: 'Storm Thrush',
    profile: 'flyer',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Storm Thrush',
    byproduct: null,
    flight: { altitude: 1.6, bobHeight: 0.25, bobRate: 2.0, flapRate: 5.2 },
    bonusSpawn: {
      biomes: ['meadow', 'fungal', 'rootwood', 'storm'],
      count: 3,
      minRadius: 9,
      spacing: 4,
      speed: 2.2,
      speedJitter: 0.15,
      health: 9,
    },
  },

  // #166 — the Storm Kite's plan, winter-built: a pennant-
  // tailed flier of the White Storm whose ribbon tail freezes
  // in flight into streamers. Shed pennants are the byproduct:
  // Kite Pennants, frozen mid-ripple. 25%.
  blizzard_kite: {
    id: 'blizzard_kite',
    name: 'Blizzard Kite',
    profile: 'flyer',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Blizzard Kite',
    byproduct: { item: 'kite_pennant', seconds: 300, tamedOnly: false },
    flight: { altitude: 2.4, bobHeight: 0.3, bobRate: 1.8, flapRate: 3.6 },
    bonusSpawn: {
      biomes: ['storm', 'frost'],
      hybrid: ['storm', 'frost'],
      count: 2,
      minRadius: 11,
      spacing: 6,
      speed: 2.5,
      speedJitter: 0.15,
      health: 15,
    },
  },

  // #199 — glass-winged: thin saltglass membranes on a moth's
  // frame, in the Bright Ruins. Untameable (0%). A whole fallen
  // wing, found intact perhaps once a player-lifetime, is a
  // natural lens: the shed below runs at lifetime odds (900 s —
  // the table's slowest cadence class).
  shard_moth: {
    id: 'shard_moth',
    name: 'Shard Moth',
    profile: 'flyer',
    tameChance: null,
    bait: null,
    petName: 'Shard Moth',
    byproduct: { item: 'shard_wing', seconds: 900, tamedOnly: false },
    flight: { altitude: 1.8, bobHeight: 0.25, bobRate: 1.7, flapRate: 3.8 },
    bonusSpawn: {
      biomes: ['saltglass', 'precursor'],
      hybrid: ['saltglass', 'precursor'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.9,
      speedJitter: 0.1,
      health: 9,
    },
  },

  // #357 — the family's founding sentence as a citizen: "does
  // the flora almost behave like fauna?" — a root cluster that
  // WALKS, plantiform and multiped, in both the valley's
  // faces. Its rooted seasons leave a root-crown behind: a
  // living stool of heartwood-grade root. Untameable — it is
  // the valley, ambulant; not a pet.
  walking_root: {
    id: 'walking_root',
    name: 'Walking Root',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Walking Root',
    byproduct: { item: 'root_crown', seconds: 420, tamedOnly: false },
    bonusSpawn: {
      biomes: ['living'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 0.7, // roots walk at root pace
      speedJitter: 0.05,
      health: 45,
    },
  },

  // ------------------------------------------------------------------
  // Slice 24 (2026-10-16) — fauna wave 7, the landmark wave:
  // the last land-legal fauna. With the Row Tender, the
  // family emblems stand 11/11. What remains after this wave
  // is gated on systems, not tables: the pond-locked swimmers
  // and the oversize tier.
  // ------------------------------------------------------------------

  // #23 — a thick domed back breaking the marsh's surface
  // like a hot stone: the Scalding Fens' vent-turtle, finned
  // under a husk dome, finding its heat in marsh seeps at the
  // Wetland × Ember margin. 25%.
  scaldback: {
    id: 'scaldback',
    name: 'Scaldback',
    profile: 'turtle',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Scaldback',
    byproduct: null,
    bonusSpawn: {
      biomes: ['wetland', 'ember'],
      hybrid: ['wetland', 'ember'],
      count: 2,
      minRadius: 10,
      spacing: 6,
      speed: 1.1,
      speedJitter: 0.1,
      health: 45,
    },
  },

  // #35 — THE TENDER: the Precursor family's emblem, seated
  // at the Tending Field — a forged multiped with tool-arms
  // (four of its legs end in implements) that has kept the
  // rows since the makers left. With this entry the emblem
  // roster stands complete: 11/11. Untameable: it has rows
  // to tend, and a tamed tender would leave the field.
  row_tender: {
    id: 'row_tender',
    name: 'Row Tender',
    profile: 'insect',
    tameChance: null,
    bait: null,
    petName: 'Row Tender',
    byproduct: null,
    bonusSpawn: {
      biomes: ['precursor'],
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.3,
      speedJitter: 0.1,
      health: 40,
    },
  },

  // #39 — the Untended's seat: a tender of the same make,
  // gone feral with its field — it defends rows nobody planted
  // on ground nobody owns, with a tender's patience and a
  // squatter's conviction. Territorial: it warns, then it
  // means it (Normal/Hostile; Peaceful keeps the theater).
  feral_tender: {
    id: 'feral_tender',
    name: 'Feral Tender',
    profile: 'territorial',
    tameChance: null,
    bait: null,
    petName: 'Feral Tender',
    byproduct: null,
    hunt: { aggroRange: 6, damage: 7, biteRange: 1.1, biteCooldownSeconds: 1.6 },
    bonusSpawn: {
      biomes: ['precursor'],
      variant: 'precursor_untended',
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.6,
      speedJitter: 0.1,
      health: 55,
    },
  },

  // #88 — PHASING's first citizen: a vapor hare of the far
  // country whose outline thins at the edges, present in
  // pieces. Its blink locomotion is LIVE since slice 38
  // (2026-10-16): most wander re-rolls arrive by vanish.
  // v1 deals it as what it also honestly is — the fastest
  // ground citizen on the table. Its shed edge-fur blinks
  // away after collection: no byproduct can survive it. 10%.
  blink_hare: {
    id: 'blink_hare',
    name: 'Blink Hare',
    profile: 'rodent',
    tameChance: 0.1,
    bait: 'nectar',
    petName: 'Blink Hare',
    byproduct: null,
    bonusSpawn: {
      biomes: ['precursor', 'storm'],
      count: 1,
      minRadius: 13,
      spacing: 8,
      speed: 3.4,
      speedJitter: 0.2,
      health: 10,
    },
  },

  // #89 — the Basin's second citizen: a rain-clear gel jelly
  // DRIFTING THE SKY of Skyfall Basin, swimming in weather
  // the way its pond cousins swim in water. Scooping one is
  // possible and pointless (the codex reuses the Mirror
  // Jelly's kind sentence, and means it). Untameable.
  sky_jelly: {
    id: 'sky_jelly',
    name: 'Sky Jelly',
    profile: 'drifter',
    tameChance: null,
    bait: null,
    petName: 'Sky Jelly',
    byproduct: null,
    flight: { altitude: 2.2, bobHeight: 0.3, bobRate: 1.2 },
    bonusSpawn: {
      biomes: ['storm'],
      count: 2,
      minRadius: 11,
      spacing: 6,
      speed: 1.0, // drifting
      speedJitter: 0.1,
      health: 12,
    },
  },

  // #100 — the ubiquitous layer's fourth designed member:
  // an unremarkable mid-sized dog that appears WHERE A PLAYER
  // SETTLES. Slice 39 (2026-10-16) built the arrival its
  // design always promised: it is NOT dealt wild any more
  // (bonusSpawn null) — the sim walks it out of the country
  // when the current zone holds a heart tile (Adam's pin:
  // "just use the spawn tiles"), it takes up at the doorstep
  // on a perimeter it invents (the pond-clamp fields, reused),
  // and the bonding runs REVERSED: three accepted offerings
  // and the dog decides — a full pet, follow/stay/guard at
  // full fluency. Undecided after three days, it leaves one
  // morning as it came. It still cannot be lured in the
  // ordinary way: tameChance stays null, and the courtship
  // lives in the sim + the lure's dog branch, not the table.
  hearth_dog: {
    id: 'hearth_dog',
    name: 'Hearth Dog',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Hearth Dog',
    byproduct: null,
    bonusSpawn: null,
  },

  // #110 — the mimic the seat note wondered about, placed
  // where it belongs: not in either family's emblem seat but
  // at the far margin of the two strangest families — a
  // greeter-shaped courtesy with the wrong number of
  // implications, in Living × Precursor country. Untameable:
  // it wants to greet you first, and to keep greeting you.
  false_greeter: {
    id: 'false_greeter',
    name: 'False Greeter',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'False Greeter',
    byproduct: null,
    bonusSpawn: {
      biomes: ['living', 'precursor'],
      hybrid: ['living', 'precursor'],
      count: 1,
      minRadius: 13,
      spacing: 8,
      speed: 1.2,
      speedJitter: 0.1,
      health: 25,
    },
  },

  // #138 — the whole Storm family's sky, in weather: a roc
  // at the aerial spectrum's grand scale, storm-colored —
  // its underside is the weather it flies in. Untameable
  // (0%). Its grounded-season molt at the roosts leaves Roc
  // Feathers — kept distinct from every picker's feather by
  // house law: the storm signs its own.
  storm_roc: {
    id: 'storm_roc',
    name: 'Storm Roc',
    profile: 'flyer',
    tameChance: null,
    bait: null,
    petName: 'Storm Roc',
    byproduct: { item: 'roc_feather', seconds: 600, tamedOnly: false },
    flight: { altitude: 4.5, bobHeight: 0.4, bobRate: 1.2, flapRate: 2.2 },
    bonusSpawn: {
      biomes: ['storm'],
      count: 1,
      minRadius: 14,
      spacing: 10,
      speed: 3.2,
      speedJitter: 0.1,
      health: 120,
    },
  },

  // #142 — the Garden Keeper's plan, war-kept: taller in the
  // shoulders, its gardening tools long since re-purposed,
  // holding the Untended by requisition and habit. A HUNTER
  // of the bench: it warns (Peaceful theater), chases and
  // strikes on Normal/Hostile. Its Requisition receipts drop
  // when it is finally destroyed: the kill-drop DEBT recorded
  // here at slice 24 was PAID at slice 33 (2026-10-16, Adam's
  // word) on the killLoot rail slice 32 built. Untameable.
  feral_warden: {
    id: 'feral_warden',
    name: 'Feral Bailiff',
    profile: 'territorial',
    tameChance: null,
    bait: null,
    petName: 'Feral Bailiff',
    byproduct: null,
    hunt: { aggroRange: 8, damage: 11, biteRange: 1.3, biteCooldownSeconds: 1.4 },
    killLoot: [['requisition', 1]],
    bonusSpawn: {
      biomes: ['precursor'],
      variant: 'precursor_untended',
      count: 1,
      minRadius: 13,
      spacing: 8,
      speed: 1.9,
      speedJitter: 0.1,
      health: 90,
    },
  },

  // #358 — the roster's last entry and the valley's own: a
  // small, round, mouse-adjacent quadruped that is NOT a
  // mouse — it is the Living family's smallest citizen and
  // its easiest yes: 70%, the highest tame read on the table,
  // in both the valley's faces.
  heartling: {
    id: 'heartling',
    name: 'Heartling',
    profile: 'rodent',
    tameChance: 0.7,
    bait: 'nectar',
    petName: 'Heartling',
    byproduct: null,
    bonusSpawn: {
      biomes: ['living'],
      count: 2,
      minRadius: 10,
      spacing: 5,
      speed: 1.6,
      speedJitter: 0.15,
      health: 8,
    },
  },

  // ------------------------------------------------------------------
  // Slice 30 (2026-10-16) — THE OVERSIZE TIER, fauna side.
  // Adam's proceed (2026-10-16) delegated the scale calls:
  // the doctrine applied here — ONE per zone at most, dealt
  // far out (minRadius 15+), slow, heavy (health 400–900),
  // untameable: these are landscape citizens, not pets and
  // not bosses. The Lake Leviathan is NOT here — it is a
  // lake creature and waits with the pond group.
  // ------------------------------------------------------------------

  // #99 — a hill-backed quadruped of the far plains: its back
  // grows grass, its migration writes the Trail Caps' road,
  // and its shed winter coat-slabs are meadow in brick form —
  // left as scenery by the codex, and by this table.
  grass_leviathan: {
    id: 'grass_leviathan',
    name: 'Grass Leviathan',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Grass Leviathan',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 16, damage: 30, biteRange: 2.6, biteCooldownSeconds: 1.6, provokedOnly: true },
    killLoot: [['coat_slab', 4], ['soft_fiber', 4]],
    bonusSpawn: {
      biomes: ['meadow', 'storm'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 0.9,
      speedJitter: 0.05,
      health: 600,
    },
  },

  // #155 — the CLOUD shape's grand citizen: a whale plan
  // drawn in vapor, at landscape-adjacent scale, above the
  // high Storm country. Its shed vapor-rain falls as the
  // cleanest water in the world — which is weather, not an
  // item: no byproduct.
  cloud_whale: {
    id: 'cloud_whale',
    name: 'Cloud Whale',
    profile: 'drifter',
    tameChance: null,
    bait: null,
    petName: 'Cloud Whale',
    byproduct: null,
    flight: { altitude: 9, bobHeight: 0.5, bobRate: 0.8 },
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 18, damage: 25, biteRange: 3.2, biteCooldownSeconds: 1.8, provokedOnly: true },
    killLoot: [['whale_down', 3], ['dew_essence', 4]],
    bonusSpawn: {
      biomes: ['storm'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 1.4,
      speedJitter: 0.05,
      health: 500,
    },
  },

  // #170 — the roster's third LANDSCAPE-scale citizen: the
  // far flats where the Graveyard's weather is made, walking
  // in Bone × Storm country at geology's pace. Nothing taken.
  storm_leviathan: {
    id: 'storm_leviathan',
    name: 'Storm Leviathan',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Storm Leviathan',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 17, damage: 40, biteRange: 2.8, biteCooldownSeconds: 1.8, provokedOnly: true },
    killLoot: [['leviathan_plate', 4], ['bone_fragment', 4]],
    bonusSpawn: {
      biomes: ['bone', 'storm'],
      hybrid: ['bone', 'storm'],
      count: 1,
      minRadius: 17,
      spacing: 12,
      speed: 0.7,
      speedJitter: 0.05,
      health: 800,
    },
  },

  // #183 — LANDSCAPE, the word's fifth use: a biped at hill
  // scale — the Garden Keeper's plan written in mountains,
  // still gardening the far garden country at a pace of
  // seasons per gesture.
  garden_colossus: {
    id: 'garden_colossus',
    name: 'Garden Colossus',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Garden Colossus',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 16, damage: 45, biteRange: 3.0, biteCooldownSeconds: 2.0, provokedOnly: true },
    killLoot: [['prismatic_core', 2]],
    bonusSpawn: {
      biomes: ['precursor'],
      count: 1,
      minRadius: 17,
      spacing: 12,
      speed: 0.6,
      speedJitter: 0.05,
      health: 700,
    },
  },

  // #186 — LANDSCAPE, at terrain scale: an ash-mantled
  // quadruped that has slept so long under the Drift that the
  // Drift files it as geography. Speed 0 is not a bug: it is
  // asleep. Dealt as scenery that breathes.
  sleeping_mountain: {
    id: 'sleeping_mountain',
    name: 'Sleeping Mountain',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Sleeping Mountain',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 12, damage: 55, biteRange: 3.4, biteCooldownSeconds: 2.2, provokedOnly: true },
    killLoot: [['cinder_scale', 3], ['bone_fragment', 3]],
    bonusSpawn: {
      biomes: ['ember'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 0,
      speedJitter: 0,
      health: 900,
    },
  },

  // #188 — HUGE, the tier under LANDSCAPE, kept distinct on
  // purpose: it can be SEEN ACROSS, end to end, on a clear
  // day, which no true landscape citizen can. It sheds plates
  // of grown glass along its route: Behemoth Glass, the
  // thickest natural saltglass in the world. Untameable (0%).
  glass_behemoth: {
    id: 'glass_behemoth',
    name: 'Glass Behemoth',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Glass Behemoth',
    byproduct: { item: 'behemoth_glass', seconds: 600, tamedOnly: false },
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 16, damage: 35, biteRange: 2.6, biteCooldownSeconds: 1.6, provokedOnly: true },
    killLoot: [['behemoth_glass', 4], ['saltglass_shard', 4]],
    bonusSpawn: {
      biomes: ['saltglass'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 0.8,
      speedJitter: 0.05,
      health: 450,
    },
  },

  // #189 — HUGE: a tortoise-plan elder of the Marrow Flats —
  // the Boneback's grandmother, singular — forest-shelled,
  // bonemoss growing on her like a kept garden. The moss is
  // scenery; nothing is taken from the grandmother.
  old_marrow: {
    id: 'old_marrow',
    name: 'Old Marrow',
    profile: 'turtle',
    tameChance: null,
    bait: null,
    petName: 'Old Marrow',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 14, damage: 30, biteRange: 2.4, biteCooldownSeconds: 1.8, provokedOnly: true },
    killLoot: [['bonemoss', 4], ['bone_fragment', 3]],
    bonusSpawn: {
      biomes: ['bone'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 0.5,
      speedJitter: 0.05,
      health: 550,
    },
  },

  // #190 — HUGE: a mammoth at the word's full weight, herd-
  // mother of the Stillwhite's far reaches. She sheds winter
  // wool at her rubbing stones: Mother Wool, the cold graph's
  // heaviest insulation. Untameable (0%) — a mother is not a
  // mount.
  winter_mother: {
    id: 'winter_mother',
    name: 'Winter Mother',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Winter Mother',
    byproduct: { item: 'mother_wool', seconds: 480, tamedOnly: false },
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 16, damage: 38, biteRange: 2.6, biteCooldownSeconds: 1.6, provokedOnly: true },
    killLoot: [['mother_wool', 5], ['coat_slab', 2]],
    bonusSpawn: {
      biomes: ['frost'],
      variant: 'frost_stillwhite',
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 0.9,
      speedJitter: 0.05,
      health: 500,
    },
  },

  // #191 — HUGE: a finned whale that SWIMS THE DUNES, through
  // sand as through its first element, surfacing along the
  // Magnetic Dunes' margin (the Dune Caps surface in its
  // churned beds). Untameable (0%).
  dune_whale: {
    id: 'dune_whale',
    name: 'Dune Whale',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Dune Whale',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 16, damage: 35, biteRange: 2.8, biteCooldownSeconds: 1.7, provokedOnly: true },
    killLoot: [['leviathan_hide', 3], ['lodestone_sand', 4]],
    bonusSpawn: {
      biomes: ['saltglass', 'storm'],
      hybrid: ['saltglass', 'storm'],
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 1.1,
      speedJitter: 0.05,
      health: 480,
    },
  },

  // #193 — fungus-kingdom fauna at GIANT scale: a colony-mind
  // in a husk the size of a house, in the Hollow Hermit's
  // line, in the Hollow's deep rooms. It is less an animal
  // than a tenancy agreement with legs.
  great_hermit: {
    id: 'great_hermit',
    name: 'Great Hermit',
    profile: 'colony',
    tameChance: null,
    bait: null,
    petName: 'Great Hermit',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 14, damage: 28, biteRange: 2.4, biteCooldownSeconds: 1.8, provokedOnly: true },
    killLoot: [['tender_husk', 3], ['glow_spore', 4]],
    bonusSpawn: {
      biomes: ['fungal'],
      count: 1,
      minRadius: 15,
      spacing: 12,
      speed: 0.4,
      speedJitter: 0.05,
      health: 400,
    },
  },

  // #194 — HUGE: a segmented worm at the scale the word
  // starts to fail, fulgurite-lined, burrowing the Charged
  // Flats' deep country. Its abandoned tunnels are the flats'
  // mines — fulgurite by the cartload through the economy's
  // EXISTING door, at geology's rates: no byproduct here.
  // Untameable (0%).
  tempest_worm: {
    id: 'tempest_worm',
    name: 'Tempest Worm',
    profile: 'serpent',
    tameChance: null,
    bait: null,
    petName: 'Tempest Worm',
    byproduct: null,
    // Provoked hunt + kill loot (slice 32, 2026-10-16 — Adam's oversize pin).
    hunt: { aggroRange: 17, damage: 42, biteRange: 3.0, biteCooldownSeconds: 1.6, provokedOnly: true },
    killLoot: [['fulgurite_shard', 6], ['carapace_scale', 3]],
    bonusSpawn: {
      biomes: ['storm'],
      variant: 'charged_flats',
      count: 1,
      minRadius: 16,
      spacing: 12,
      speed: 1.3,
      speedJitter: 0.05,
      health: 520,
    },
  },

  // #13 — the Mirror Marsh's gel flagship: a clear bell whose
  // top is a still mirror. Timeless, trance-calm, untameable —
  // the marsh looking at itself. POND (pond build, 2026-10-16):
  // it deals only into a Mirror Marsh pond, drifting just
  // under the film.
  mirror_jelly: {
    id: 'mirror_jelly',
    name: 'Mirror Jelly',
    profile: 'drifter',
    tameChance: null,
    bait: null,
    petName: 'Mirror Jelly',
    byproduct: null,
    swim: { depth: 0.15 },
    bonusSpawn: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 6,
      speed: 0.5,
      speedJitter: 0.1,
      health: 20,
    },
  },

  // #41 — Wetland's surface walker: long-legged, mirror-footed,
  // skating the film the Lake Glider's kinship promised.
  // Presence only — nothing to take, nothing to tame.
  pond_skater: {
    id: 'pond_skater',
    name: 'Pond Skater',
    profile: 'insect',
    tameChance: null,
    bait: null,
    petName: 'Pond Skater',
    byproduct: null,
    swim: { depth: 0 },
    bonusSpawn: {
      biomes: ['wetland'],
      pond: true,
      count: 3,
      minRadius: 0,
      spacing: 4,
      speed: 2.2,
      speedJitter: 0.15,
      health: 10,
    },
  },

  // #49 — the Brine Shallows' gel (Wetland x Saltglass margin):
  // salt-crusted at the rim, clear at the heart. Scooping one
  // gets you the shallows, briefly — the codex says put the
  // country back. No drop, by design.
  brine_jelly: {
    id: 'brine_jelly',
    name: 'Brine Jelly',
    profile: 'drifter',
    tameChance: null,
    bait: null,
    petName: 'Brine Jelly',
    byproduct: null,
    swim: { depth: 0.15 },
    bonusSpawn: {
      biomes: ['wetland', 'saltglass'],
      hybrid: ['wetland', 'saltglass'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 6,
      speed: 0.5,
      speedJitter: 0.1,
      health: 22,
    },
  },

  // #65 — the sump pools' fish (Wetland x Fungal margin):
  // stagnant-water patience, tameable at the patient rate.
  sumpfish: {
    id: 'sumpfish',
    name: 'Sumpfish',
    profile: 'amphibian',
    tameChance: 0.25,
    bait: 'nectar',
    petName: 'Sumpfish',
    byproduct: null,
    swim: { depth: 0.9 },
    bonusSpawn: {
      biomes: ['wetland', 'fungal'],
      hybrid: ['wetland', 'fungal'],
      pond: true,
      count: 3,
      minRadius: 0,
      spacing: 4,
      speed: 1.1,
      speedJitter: 0.1,
      health: 18,
    },
  },

  // #112 — schooling ribbons in every clear pond of the
  // temperate wet country. A caught handful is food and bait,
  // unlisted — the school remains, so no item and no tame:
  // you do not adopt a river's small change.
  brook_minnow: {
    id: 'brook_minnow',
    name: 'Brook Minnow',
    profile: 'colony',
    tameChance: null,
    bait: null,
    petName: 'Brook Minnow',
    byproduct: null,
    swim: { depth: 0.4 },
    bonusSpawn: {
      biomes: ['wetland', 'meadow', 'rootwood'],
      pond: true,
      count: 5,
      minRadius: 0,
      spacing: 2.5,
      speed: 1.8,
      speedJitter: 0.2,
      health: 6,
    },
  },

  // #133 — Frost's under-ice ambusher: it hunts the band
  // beneath the ice it cannot always break. A HUNTER (0%):
  // warnings as theater on Peaceful, teeth on Normal up.
  ice_maw: {
    id: 'ice_maw',
    name: 'Ice Maw',
    profile: 'predator',
    tameChance: null,
    bait: null,
    petName: 'Ice Maw',
    byproduct: null,
    hunt: { aggroRange: 7, damage: 14, biteRange: 1.8, biteCooldownSeconds: 1.5 },
    swim: { depth: 0.8 },
    bonusSpawn: {
      biomes: ['frost'],
      pond: true,
      count: 1,
      minRadius: 0,
      spacing: 10,
      speed: 1.6,
      speedJitter: 0.1,
      health: 60,
    },
  },

  // #152 — the collective citizen of the great pond country:
  // the cloud is the creature. Untameable, unharvestable at
  // scale. Its night rise to the surface (the lakes' second
  // clock) is flavor in v1 — it rides mid-water.
  drift_krill: {
    id: 'drift_krill',
    name: 'Drift Krill',
    profile: 'colony',
    tameChance: null,
    bait: null,
    petName: 'Drift Krill',
    byproduct: null,
    swim: { depth: 0.5 },
    bonusSpawn: {
      biomes: ['wetland', 'frost'],
      pond: true,
      count: 5,
      minRadius: 0,
      spacing: 3,
      speed: 0.9,
      speedJitter: 0.15,
      health: 8,
    },
  },

  // #172 — the deep ponds' placid bottom-grazer of the wet
  // temperate country: huge, unhurried, uninterested. No tame
  // (its entry is explicit) and nothing drops but the sample.
  deep_carp: {
    id: 'deep_carp',
    name: 'Deep Carp',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Deep Carp',
    byproduct: null,
    swim: { depth: 1.2 },
    bonusSpawn: {
      biomes: ['wetland', 'rootwood', 'living'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 6,
      speed: 0.7,
      speedJitter: 0.1,
      health: 55,
    },
  },

  // #173 — the maw's understudy in small: eyeless, hunting by
  // vibration in water that has never had light. A modest
  // HUNTER of the deep band (0%, by its entry).
  pale_eel: {
    id: 'pale_eel',
    name: 'Pale Eel',
    profile: 'serpent',
    tameChance: null,
    bait: null,
    petName: 'Pale Eel',
    byproduct: null,
    hunt: { aggroRange: 6, damage: 9, biteRange: 1.5, biteCooldownSeconds: 1.6 },
    swim: { depth: 1.1 },
    bonusSpawn: {
      biomes: ['frost', 'wetland'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 6,
      speed: 1.4,
      speedJitter: 0.1,
      health: 30,
    },
  },

  // #175 — the wet country's diving duck: flies, swims, and
  // plunges whole-body after pond fish. It carries BOTH specs
  // and the dive cycle (slice 38, 2026-10-16): ten seconds on
  // the wing, six on the water, around the sim's phase clock.
  plunge_duck: {
    id: 'plunge_duck',
    name: 'Plunge Duck',
    profile: 'bird',
    tameChance: 0.55,
    bait: 'nectar',
    petName: 'Plunge Duck',
    byproduct: null,
    flight: { altitude: 2.0, bobHeight: 0.25, bobRate: 1.9, flapRate: 7 },
    swim: { depth: 0 },
    dive: { cycleSeconds: 16, waterSeconds: 6 },
    bonusSpawn: {
      biomes: ['wetland', 'meadow'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 6,
      speed: 2.4,
      speedJitter: 0.15,
      health: 16,
    },
  },

  // #213 — the Mirror Marsh's surface-locked, inverted fish:
  // it swims the film from beneath, studying the sky's copy.
  // The mirror country's citizens run contemplative: 20%.
  mirror_fish: {
    id: 'mirror_fish',
    name: 'Mirror Fish',
    profile: 'amphibian',
    tameChance: 0.2,
    bait: 'nectar',
    petName: 'Mirror Fish',
    byproduct: null,
    swim: { depth: 0.05 },
    bonusSpawn: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      pond: true,
      count: 3,
      minRadius: 0,
      spacing: 4,
      speed: 1.0,
      speedJitter: 0.1,
      health: 12,
    },
  },

  // #171 — THE WATER EPIC: the fourth LANDSCAPE citizen, in
  // the great ponds of Wetland and under the Singing Ice. It
  // does not surface; what the world knows is a slow shadow.
  // Oversize doctrine applies (Adam's pin): abyssally calm
  // until provoked, geography-grade loot on a kill.
  lake_leviathan: {
    id: 'lake_leviathan',
    name: 'Lake Leviathan',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Lake Leviathan',
    byproduct: null,
    hunt: { aggroRange: 14, damage: 45, biteRange: 3.0, biteCooldownSeconds: 2.0, provokedOnly: true },
    killLoot: [['leviathan_plate', 3], ['leviathan_hide', 3]],
    swim: { depth: 1.1 },
    bonusSpawn: {
      biomes: ['wetland', 'frost'],
      pond: true,
      count: 1,
      minRadius: 0,
      spacing: 14,
      speed: 0.6,
      speedJitter: 0.05,
      health: 800,
    },
  },

  // #174 — the double-corner citizen: COLLECTIVE and
  // STATIONARY both — a reef colony on the great ponds'
  // floors, building the city the Lake Jelly lights. Speed 0
  // (the Stillmouth precedent); it is a place as much as a
  // creature.
  deep_reef: {
    id: 'deep_reef',
    name: 'Deep Reef',
    profile: 'colony',
    tameChance: null,
    bait: null,
    petName: 'Deep Reef',
    byproduct: null,
    swim: { depth: 1.25 },
    bonusSpawn: {
      biomes: ['wetland'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 8,
      speed: 0,
      speedJitter: 0,
      health: 80,
    },
  },

  // #176 — the temperate ponds' diving beetle: it carries its
  // air down with it in a bright bubble. Keepable in a jar,
  // says its entry — 30%.
  diver_beetle: {
    id: 'diver_beetle',
    name: 'Diver Beetle',
    profile: 'insect',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Diver Beetle',
    byproduct: null,
    swim: { depth: 0.6 },
    bonusSpawn: {
      biomes: ['meadow', 'wetland', 'rootwood', 'fungal'],
      pond: true,
      count: 3,
      minRadius: 0,
      spacing: 3.5,
      speed: 1.3,
      speedJitter: 0.15,
      health: 10,
    },
  },

  // #178 — a small bright blade on wings over the wet range's
  // pond edges: perch-loyal at 20%, and it molts dart-feathers
  // at its perches (unlisted — no item).
  dartfisher: {
    id: 'dartfisher',
    name: 'Dartfisher',
    profile: 'bird',
    tameChance: 0.2,
    bait: 'nectar',
    petName: 'Dartfisher',
    byproduct: null,
    flight: { altitude: 2.0, bobHeight: 0.2, bobRate: 2.2, flapRate: 9 },
    swim: { depth: 0 },
    bonusSpawn: {
      biomes: ['meadow', 'wetland', 'rootwood'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 5,
      speed: 2.6,
      speedJitter: 0.15,
      health: 11,
    },
  },

  // #195 — the Deep Carp's garden cousin, in the Drowned
  // Gardens (Wetland x Precursor margin): glyph-marked, and
  // the garden still reads on it. 55%.
  glyph_carp: {
    id: 'glyph_carp',
    name: 'Glyph Carp',
    profile: 'amphibian',
    tameChance: 0.55,
    bait: 'nectar',
    petName: 'Glyph Carp',
    byproduct: null,
    swim: { depth: 1.0 },
    bonusSpawn: {
      biomes: ['wetland', 'precursor'],
      hybrid: ['wetland', 'precursor'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 6,
      speed: 0.8,
      speedJitter: 0.1,
      health: 34,
    },
  },

  // #205 — the Pond Skater's plan, richly dressed, on Storm's
  // silver pond country: where its cousin walks, this one
  // skims — and it will take gnats from a hand at 40%. (Its
  // entry's rivers are read as pond reaches in v1, like the
  // whole silver set: ponds are the standing water there is.)
  silver_skater: {
    id: 'silver_skater',
    name: 'Silver Skater',
    profile: 'insect',
    tameChance: 0.4,
    bait: 'nectar',
    petName: 'Silver Skater',
    byproduct: null,
    swim: { depth: 0 },
    bonusSpawn: {
      biomes: ['storm'],
      pond: true,
      count: 3,
      minRadius: 0,
      spacing: 4,
      speed: 2.6,
      speedJitter: 0.15,
      health: 10,
    },
  },

  // #206 — it lives IN the quicksilver of Storm's charged
  // ponds, immune to coating by being perpetually coated —
  // and it SHEDS those scales: Silver Scale, the storm
  // country's contact metal, as a living byproduct (the
  // Ironworm Plate precedent; no harm in its supply chain).
  silverfin: {
    id: 'silverfin',
    name: 'Silverfin',
    profile: 'amphibian',
    tameChance: null,
    bait: null,
    petName: 'Silverfin',
    byproduct: { item: 'silver_scale', seconds: 2100, tamedOnly: false },
    swim: { depth: 0.5 },
    bonusSpawn: {
      biomes: ['storm'],
      pond: true,
      count: 3,
      minRadius: 0,
      spacing: 4,
      speed: 1.7,
      speedJitter: 0.15,
      health: 14,
    },
  },

  // #207 — self-gilt, claw by claw, on the silver country's
  // banks: it dips ITSELF in the metal water it lives beside.
  // It respects a kept bank, at 30%.
  plated_crab: {
    id: 'plated_crab',
    name: 'Plated Crab',
    profile: 'insect',
    tameChance: 0.3,
    bait: 'nectar',
    petName: 'Plated Crab',
    byproduct: null,
    swim: { depth: 0.7 },
    bonusSpawn: {
      biomes: ['storm'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 5,
      speed: 0.9,
      speedJitter: 0.1,
      health: 26,
    },
  },

  // #208 — the silver banks' small dark bobbing bird: it
  // nests at a kept bank and will forgive the neighborhood at
  // 50%. Flies the banks; dips, like its entry says.
  silver_dipper: {
    id: 'silver_dipper',
    name: 'Silver Dipper',
    profile: 'bird',
    tameChance: 0.5,
    bait: 'nectar',
    petName: 'Silver Dipper',
    byproduct: null,
    flight: { altitude: 1.8, bobHeight: 0.22, bobRate: 2.0, flapRate: 8 },
    swim: { depth: 0 },
    bonusSpawn: {
      biomes: ['storm'],
      pond: true,
      count: 2,
      minRadius: 0,
      spacing: 5,
      speed: 2.2,
      speedJitter: 0.15,
      health: 12,
    },
  },

  // #214 — the roster's first heron, on the Mirror Marsh's
  // pond banks: tall, still, judicial. The pickers' rule at
  // its strictest — 15%, and its molted feathers are unlisted.
  mirror_heron: {
    id: 'mirror_heron',
    name: 'Mirror Heron',
    profile: 'bird',
    tameChance: 0.15,
    bait: 'nectar',
    petName: 'Mirror Heron',
    byproduct: null,
    flight: { altitude: 2.4, bobHeight: 0.3, bobRate: 1.6, flapRate: 5 },
    swim: { depth: 0 },
    bonusSpawn: {
      biomes: ['wetland'],
      variant: 'mirror_marsh',
      pond: true,
      count: 1,
      minRadius: 0,
      spacing: 8,
      speed: 1.8,
      speedJitter: 0.1,
      health: 20,
    },
  },
};
