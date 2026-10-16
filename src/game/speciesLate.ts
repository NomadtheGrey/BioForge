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
  // pieces. Its blink locomotion is bespoke work (deferred);
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
  // SETTLES. Its arrival behavior (it chooses hearths; it
  // cannot be summoned) is bespoke work, deferred — v1 deals
  // it as the layer's citizen, everywhere, at dog pace. It
  // cannot be lured either: it arrives, or it doesn't.
  hearth_dog: {
    id: 'hearth_dog',
    name: 'Hearth Dog',
    profile: 'grazer',
    tameChance: null,
    bait: null,
    petName: 'Hearth Dog',
    byproduct: null,
    bonusSpawn: {
      biomes: 'all',
      count: 1,
      minRadius: 12,
      spacing: 8,
      speed: 1.8,
      speedJitter: 0.15,
      health: 22,
    },
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

  // #142 — the Garden Warden's plan, war-kept: taller in the
  // shoulders, its gardening tools long since re-purposed,
  // holding the Untended by requisition and habit. A HUNTER
  // of the bench: it warns (Peaceful theater), chases and
  // strikes on Normal/Hostile. Its Requisition receipts drop
  // only when it is finally destroyed — a kill-drop, and the
  // sim's kill path drops samples only: the item is deferred
  // with the kill-drop system, recorded here so the debt is
  // visible. Untameable.
  feral_warden: {
    id: 'feral_warden',
    name: 'Feral Warden',
    profile: 'territorial',
    tameChance: null,
    bait: null,
    petName: 'Feral Warden',
    byproduct: null,
    hunt: { aggroRange: 8, damage: 11, biteRange: 1.3, biteCooldownSeconds: 1.4 },
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
};
