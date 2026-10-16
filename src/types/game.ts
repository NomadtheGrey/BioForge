/**
 * BioForge Core Type Definitions
 * Prismatic Botanical Tech Ecosystem
 */

import type { BiomeId } from '../game/biomes';

export type ItemId =
  // Raw Botanical Byproducts & Harvests
  | 'resin_sap'
  | 'vibrant_petal'
  | 'sweet_nectar'
  | 'soft_fiber'
  | 'pale_fur'
  | 'puff_down'
  | 'cinder_scale'
  | 'frost_velvet'
  | 'prism_skin'
  | 'prism_hair'
  | 'lodestone_sand'
  | 'field_scute'
  | 'grave_feather'
  | 'kite_ribbon'
  | 'spire_down'
  | 'canopy_moss'
  | 'dusk_wool'
  | 'haycap'
  | 'snow_morel'
  | 'ink_cap'
  | 'bonemoss'
  | 'listening_frond'
  | 'ice_petal'
  | 'gravevine_flower'
  | 'saltroot_glass'
  | 'storm_fruit'
  | 'bog_light'
  | 'gale_straw'
  | 'glyph_leaf'
  | 'ash_puff'
  | 'ash_feather'
  | 'rib_silk'
  | 'vent_petal'
  | 'stormcap'
  | 'anvil_bracket'
  | 'glass_frond'
  | 'forge_petal'
  | 'ember_leaf'
  | 'frost_leaf'
  | 'mirror_bloom'
  | 'meltcap'
  | 'poolcap'
  | 'saltcap_heart'
  | 'tomb_cap'
  | 'veil_cloth'
  | 'glass_cap'
  | 'bone_puff'
  | 'door_cap'
  | 'mote_dust'
  | 'sapwing_film'
  | 'cup_water'
  | 'banner_fiber'
  | 'grave_pollen'
  | 'wrong_thread'
  | 'sage_leaf'
  | 'amber_bloom'
  | 'silt_petal'
  | 'ghost_bloom'
  | 'thaw_bloom'
  | 'dust_petal'
  | 'obsidian_petal'
  | 'hedge_hip'
  | 'scar_mist'
  | 'bramble_seed'
  | 'hawk_feather'
  | 'zot_skin'
  | 'ironjaw_plate'
  | 'worn_skull'
  | 'tending_cutting'
  | 'hearth_bloom'
  | 'puff_spore'
  | 'smoke_heart'
  | 'creep_sheet'
  | 'star_glass'
  | 'quiver_gel'
  | 'pod_bladder'
  | 'noon_seed'
  | 'lambswool'
  | 'coalwood_timber'
  | 'aurora_cord'
  | 'canopy_bloom'
  | 'rib_seed'
  | 'kite_bud'
  | 'clock_petal'
  | 'roadweed_leaf'
  | 'ironworm_plate'
  | 'glass_shed'
  | 'picker_down'
  | 'bog_jelly'
  | 'salt_jelly'
  | 'ice_shelf'
  | 'marrow_earth'
  | 'static_cap'
  | 'hearth_cap'
  | 'bed_cap'
  | 'path_puff'
  | 'scar_cap'
  | 'deck_silk'
  | 'fisher_down'
  | 'kite_pennant'
  | 'shard_wing'
  | 'root_crown'
  | 'strike_cap'
  | 'dune_cap'
  | 'basin_puff'
  | 'thaw_jelly'
  | 'prism_gill'
  | 'still_cap'
  | 'fang_shelf'
  | 'canopy_cap'
  | 'gloom_cap'
  | 'roc_feather'
  | 'row_cap'
  | 'wild_cap'
  | 'dust_cap'
  | 'marrow_cap'
  | 'rib_cap'
  | 'scald_cap'
  | 'compost_cap'
  | 'brine_cap'
  | 'iron_cap'
  | 'hedge_cap'
  | 'sun_cap'
  | 'mist_cap'
  | 'tool_foam'
  | 'night_cap'
  | 'dark_cap'
  | 'husk_cap'
  | 'shell_cap'
  | 'trail_cap'
  | 'sweet_cap'
  | 'great_puff'
  | 'rust_cap'
  | 'greeting_cap'
  | 'relic_fruit'
  | 'ironwood'
  | 'marrow_bloom'
  | 'gloam_frond'
  | 'flood_ribbon'
  | 'ice_bloom'
  | 'ripple_bell'
  | 'night_wax'
  | 'scar_bloom'
  | 'chime_straw'
  | 'feral_cutting'
  | 'bone_bloom'
  | 'scald_frond'
  | 'mulch_petal'
  | 'brine_bloom'
  | 'sump_cap'
  | 'grave_puff'
  | 'steam_cap'
  | 'behemoth_glass'
  | 'mother_wool'
  // Oversize kill loot (slice 32, 2026-10-16).
  | 'coat_slab'
  | 'whale_down'
  | 'leviathan_plate'
  | 'leviathan_hide'
  | 'requisition'
  | 'lake_jelly'
  | 'silver_scale'
  | 'gloom_gel'
  | 'hollow_heart_spore'
  | 'sedge_egg'
  | 'clean_bone'
  | 'dew_essence'
  | 'bio_pellet'
  | 'carapace_scale'
  | 'prismatic_core'
  | 'obsidian_shard'
  | 'saltglass_shard'
  | 'nevermelt_ice'
  | 'heartwood'
  | 'living_thread'
  | 'bone_meal'
  | 'fulgurite_shard'
  | 'heart_sap'
  | 'basic_compost'
  | 'glow_spore'
  | 'hand_lantern_fern'
  | 'sunshard'
  | 'violet_prism'
  | 'precursor_shard'
  | 'aw_fragment'
  | 'resonant_reed'
  | 'sonar_vane'
  | 'resonant_antenna_fan'
  | 'sonar_receiver'
  | 'chitin_housing'
  | 'biolume_power_cell'
  | 'prismatic_field_radar'
  | 'prismatic_lifefinder'
  // Helmet + Quicksteps platforms (published 2026-10-15: the
  // items and their recipes/quests are live; their worn effects
  // land with the platform builds)
  | 'homestead_helm'
  | 'trail_lens'
  | 'spore_filter'
  | 'biolume_visor'
  | 'shade_visor'
  | 'identifier_lens'
  | 'glyph_lens'
  | 'charge_sight'
  | 'quicksteps'
  | 'waders'
  | 'stillsteps'
  | 'webfoots'
  | 'ember_soles'
  // Cultivation Seeds
  | 'seed_lantern_fern'
  | 'seed_sap_weaver'
  | 'seed_petal_mill'
  | 'seed_snap_trap'
  | 'seed_bell_bloom'
  | 'seed_bounce_shroom'
  // Fertilizers
  | 'growth_fertilizer'
  | 'yield_fertilizer'
  // Bio-Composite Building Seed-Nodes
  | 'root_tile_floor'
  | 'heart_tile'
  | 'biotunnel_mouth'
  | 'chitin_glass_wall'
  | 'rootweave_wall'
  | 'saltglass_pane'
  | 'hearthpod'
  | 'pen_fence'
  | 'pen_gate'
  | 'iris_slit_door'
  | 'lantern_fern_post'
  | 'spore_canopy'
  | 'bio_forge_station'
  | 'tamed_snap_trap_turret'
  | 'cultivation_mound'
  // The storage pod (Adam, 2026-10-15): a placed, upgradable stash.
  // One structure type for all three tiers — the tier lives on the
  // entity's `storage` record, and kits raise it in place.
  | 'storage_pod'
  | 'sample_rack'
  | 'root_table'
  | 'root_stool'
  | 'woven_rug'
  | 'root_shelf'
  | 'root_bed'
  | 'culture_vat'
  | 'vine_ladder'
  | 'cave_mouth'
  | 'cave_exit'
  | 'cave_descent'
  | 'vine_shaft'
  | 'ruin_landmark'
  | 'tender_husk'
  | 'bone_fragment'
  | 'leviathan_ribs'
  | 'fulgurite'
  | 'petrified_shroom'
  | 'ruin_exit'
  | 'precursor_cache'
  | 'artifact_heart'
  | 'ruin_glyph'
  // Worn Equipment — the two platforms (settled 2026-10-13/14): the
  // GAUNTLET is the action platform (the hotbar tools are its modes);
  // the HELMET, when it arrives, is the sensory platform and joins
  // this same section. Equipment is WORN, never built — these ids
  // are ItemIds only, NOT StructureTypes. The gauntlet spent a month
  // inside StructureType, forcing impossible entries into every
  // Record keyed on it; the types pass of 2026-10-15 set that right.
  | 'field_synthesizer_gauntlet'
  | 'gauntlet_synthesizer_upgrade'
  // Gauntlet MODULES (Adam, 2026-10-15): the gauntlet is the early
  // game's progression spine — it starts able to HARVEST only, and
  // each further tool is a module crafted at the forge and grafted
  // on. Owning the module item IS the unlock (App derives the
  // unlocked tool set from the pouch; see game/quests.ts). The
  // items are equipment: they sit in the pouch, never spent.
  | 'gauntlet_scanner_module'
  | 'gauntlet_planter_module'
  | 'gauntlet_builder_module'
  | 'gauntlet_solvent_module'
  | 'gauntlet_lure_module'
  // Pouch UPGRADES (Adam, 2026-10-15): carrying capacity is a
  // craftable ladder too — owning a pouch item raises every stack's
  // cap (game/pouch.ts). Equipment like the modules: held, not spent.
  | 'woven_pouch'
  | 'resin_satchel'
  | 'living_rucksack'
  // Storage-pod UPGRADE KITS: consumable crafts applied to a PLACED
  // pod from its storage panel — they raise the pod's tier in place.
  | 'storage_kit_hutch'
  | 'storage_kit_vault'
  // The Culture Vat (Adam, 2026-10-15): the vat itself, its two
  // growth kits, and one SAMPLE item per creature species — the
  // recipe heart of creature renewal. Sample ids are a template
  // over the species union so a new species brings its sample
  // with it; their item definitions are generated from the
  // species table in constants.ts.
  | 'culture_vat'
  | 'vat_kit_rich'
  | 'vat_kit_deep'
  // The strikers (Adam, 2026-10-16): six grown weapons, one close +
  // one ranged per craft tier, seated in the gauntlet's seventh
  // slot. Rules live in game/weapons.ts.
  | 'briar_barb'
  | 'spit_pod'
  | 'chitin_fang'
  | 'spore_puffer'
  | 'glass_sting'
  | 'storm_lance'
  | `sample_${FaunaSpecies}`;

export type ToolType =
  | 'harvest_glove'
  | 'bio_scanner'
  | 'planter_trowel'
  | 'solvent_sprayer'
  | 'taming_lure'
  | 'builder'
  // The seventh slot (Adam, 2026-10-16): the striker. One slot
  // draws one owned weapon at a time — close or ranged — toggled
  // by the 7 key / mouse wheel while the slot is in hand.
  | 'striker';

export interface ItemDef {
  id: ItemId;
  name: string;
  // 'equipment' joined the union in the 2026-10-15 types pass: worn
  // platforms (gauntlet, its graft, the future helmet) are their own
  // category, not raw materials with ambitions.
  category: 'raw' | 'seed' | 'fertilizer' | 'structure' | 'equipment';
  description: string;
  iconName: string;
  color: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'prismatic';
  maxStack: number;
}

export interface InventoryItem {
  id: ItemId;
  count: number;
}

export type FloraSpecies =
  | 'lantern_fern'
  | 'sap_weaver'
  | 'petal_mill'
  | 'mouth_vine'
  | 'snap_trap'
  | 'bell_bloom'
  | 'bounce_shroom'
  | 'ribbon_moss'
  | 'glow_spore_cluster'
  | 'glow_fungus'
  | 'sunshard_cluster'
  | 'prism_cluster'
  | 'echo_reed'
  | 'antenna_shroom'
  | 'visor_shroom'
  | 'shelf_shroom'
  | 'mirror_lily'
  | 'cinder_bloom'
  | 'obsidian_bloom'
  | 'prism_reed'
  | 'rime_spire'
  | 'heartroot'
  | 'precursor_bloom'
  | 'gravebloom'
  | 'stormcatcher'
  | 'dusk_grass'
  | 'heartbloom'
  // Slice 9 (2026-10-15) — the flora pipeline's first wave.
  | 'gulp_lily'
  | 'waygrass'
  | 'flame_lily'
  | 'salt_daisy'
  | 'compass_cress'
  | 'ice_grass'
  | 'field_cap'
  | 'frostcap'
  | 'haycap'
  | 'coal_cap'
  | 'snow_morel'
  | 'ink_cap'
  // Slice 10 (2026-10-16) — flora wave 2.
  | 'bonemoss'
  | 'listening_fern'
  | 'snowbell'
  | 'grave_vine'
  | 'saltroot'
  | 'stormroot'
  | 'bog_lantern'
  | 'gale_grass'
  | 'doorstep_rose'
  | 'glyph_vine'
  | 'glowcap'
  | 'ash_puff'
  // Flora wave 3 (slice 12, 2026-10-16).
  | 'meadow_clover'
  | 'vent_rose'
  | 'stormcap'
  | 'anvil_cap'
  | 'glass_fern'
  | 'forge_bloom'
  | 'ember_ivy'
  | 'frost_ivy'
  | 'mirror_reed'
  | 'rime_grass'
  | 'fang_fern'
  | 'mirror_cap'
  // Flora wave 4 (slice 14, 2026-10-16) — the fungus bench.
  | 'meltcap'
  | 'poolcap'
  | 'saltcap'
  | 'tomb_cap'
  | 'ring_cap'
  | 'veil_cap'
  | 'glass_cap'
  | 'heart_shelf'
  | 'bone_puff'
  | 'wind_puff'
  | 'door_cap'
  | 'glyph_cap'
  // Flora wave 5 (slice 16, 2026-10-16) — the rose bench.
  | 'canopy_cup'
  | 'banner_vine'
  | 'charnel_bloom'
  | 'wrongbloom'
  | 'tumble_sage'
  | 'amber_bloom'
  | 'silt_rose'
  | 'ghost_orchid'
  | 'thaw_rose'
  | 'dust_rose'
  | 'obsidian_rose'
  | 'hedge_rose'
  // Flora wave 6 (slice 18, 2026-10-16) — the final flora.
  | 'raincatcher'
  | 'tending_vine'
  | 'hearthroot'
  | 'puffbell'
  | 'arch_tree'
  | 'smoke_tree'
  | 'lightcreep'
  | 'zot_star'
  | 'grabvine'
  | 'maw_bloom'
  | 'quiver_cap'
  | 'balloon_vine'
  // Flora wave 7 (slice 19, 2026-10-16).
  | 'noonflower'
  | 'lambswool'
  | 'spore_fern'
  | 'coalwood'
  | 'aurora_vine'
  | 'bridge_moss'
  | 'canopy_orchid'
  | 'rib_grass'
  | 'kite_flower'
  | 'guest_flower'
  | 'clock_bloom'
  | 'roadweed'
  // Flora wave 8 (slice 21, 2026-10-16) — fungus bench I.
  | 'bog_jelly'
  | 'reed_rust'
  | 'salt_jelly'
  | 'ice_shelf'
  | 'root_cup'
  | 'marrow_mold'
  | 'static_cap'
  | 'hearth_cap'
  | 'bed_cap'
  | 'path_puff'
  | 'dew_mold'
  | 'scar_cap'
  // Flora wave 9 (slice 23, 2026-10-16) — fungus bench II.
  | 'drift_mold'
  | 'glass_mold'
  | 'strike_cap'
  | 'dune_cap'
  | 'basin_puff'
  | 'thaw_jelly'
  | 'prism_cap'
  | 'still_cap'
  | 'fang_shelf'
  | 'song_cap'
  | 'canopy_cap'
  | 'gloom_cap'
  // Flora wave 10 (slice 25, 2026-10-16) — the cap bench.
  | 'fall_shelf'
  | 'row_cap'
  | 'wild_cap'
  | 'dust_cap'
  | 'marrow_cap'
  | 'rib_cap'
  | 'scald_cap'
  | 'compost_cap'
  | 'brine_cap'
  | 'iron_cap'
  | 'hedge_cap'
  | 'sun_cap'
  // Flora wave 11 (slice 26, 2026-10-16) — the fungus tail.
  | 'mist_cap'
  | 'tool_cap'
  | 'sail_cap'
  | 'night_cap'
  | 'storm_mold'
  | 'dark_cap'
  | 'husk_cap'
  | 'shell_cap'
  | 'trail_cap'
  | 'sweet_cap'
  | 'great_puff'
  | 'rust_cap'
  // Flora wave 12 (slice 27, 2026-10-16) — trees, vines, mosses.
  | 'answer_tree'
  | 'greeting_cap'
  | 'relic_tree'
  | 'ironwood'
  | 'glare_vine'
  | 'marrow_vine'
  | 'row_moss'
  | 'prism_moss'
  | 'gloam_fern'
  | 'flood_fern'
  | 'ice_bloom'
  | 'ripple_bell'
  // Flora wave 13 (slice 28, 2026-10-16) — orchids, reeds, candles.
  | 'night_candle'
  | 'scar_orchid'
  | 'ashveil'
  | 'chime_reed'
  | 'sky_lily'
  | 'fall_orchid'
  | 'deck_flower'
  | 'feral_rose'
  | 'bone_orchid'
  | 'marrow_reed'
  | 'pale_sedge'
  | 'snow_cress'
  // Flora wave 14 (slice 29, 2026-10-16) — THE FINAL flora wave.
  | 'scald_fern'
  | 'mulch_rose'
  | 'brine_rose'
  | 'frost_reed'
  | 'snow_shelf'
  | 'sump_cap'
  | 'grave_puff'
  | 'salt_mold'
  | 'ash_mold'
  | 'nest_cap'
  | 'frost_mold'
  | 'steam_cap'
  | 'lake_jelly'
  // Landscape flora trio (slice 31, 2026-10-16).
  | 'valley_heart'
  | 'mother_grove'
  | 'first_tree';

export interface FloraEntity {
  id: string;
  species: FloraSpecies;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  growthStage: number; // 0=seed, 1=sprout, 2=growing, 3=established, 4=mature, 5=ready
  growthProgress: number; // 0 to 1
  fertilizedGrowth: boolean;
  fertilizedYield: boolean;
  fertilizerTimer?: number; // Seconds of growth-boost left (0/absent = none)
  /** Tumble Sage travel (slice 45): seconds a ripe sage has sat unharvested — at the threshold it lets go of its root. */
  looseTimer?: number;
  /** Tumble Sage travel: roll velocity (m/s) while loosed; absent = rooted. */
  rollVx?: number;
  rollVz?: number;
  /** Tumble Sage travel: meters of roll left before it re-roots. */
  rollLeft?: number;
  /** Tumble Sage travel: seconds until it sheds the next leaf mid-roll. */
  rollShedTimer?: number;
  harvestReady: boolean;
  harvestTimer: number;
  isHazardous: boolean;
  pacifiedUntil?: number;
  swayOffset: number;
  /** Biome TYPE this plant grew in (world-gen stamp; absent on player-planted flora and old saves). */
  biome?: BiomeId;
  colorVariant?: string;
  isPlayerPlanted?: boolean;
}

export type FaunaSpecies =
  | 'soft_puff'
  | 'burrow_mouse'
  | 'chitin_stalker'
  | 'scale_bear'
  | 'vesper_glider'
  | 'mirror_moth'
  // Creature build phase, slice 1 (2026-10-15) — the first designed
  // species from the CREATURES_BRAINSTORM roster; their data lives in
  // src/game/species.ts, and they spawn via its generic bonus route.
  | 'meadowback'
  | 'pale_hare'
  | 'frost_vole'
  // Slice 2 (2026-10-15) — family casts + the everywhere pest.
  | 'dew_gnat'
  | 'meadow_hopper'
  | 'ember_newt'
  | 'glint_beetle'
  | 'glow_grub'
  | 'sedge_hen'
  | 'valley_goat'
  | 'rime_puff'
  | 'gloom_slug'
  | 'sun_lizard'
  | 'mud_turtle'
  | 'bog_cow'
  // Slice 3 (2026-10-15) — Wetland / Rootwood / Fungal casts, incl.
  // the first variant-gated species (hollow_hermit, rootfall_bear).
  | 'spore_stag'
  | 'hollow_hermit'
  | 'rootfall_bear'
  | 'mulch_beetle'
  | 'brine_stilt'
  | 'hello_frog'
  | 'foam_frog'
  | 'mudskipper'
  | 'landfish'
  // Slice 4 (2026-10-15) — far-family emblems + variant one-offs.
  | 'cinderhound'
  | 'shard_grazer'
  | 'frost_stag'
  | 'glass_crab'
  | 'thawmole'
  | 'prism_frog'
  | 'skull_ants'
  | 'dune_roller'
  | 'boneback_tortoise'
  | 'marrow_deer'
  | 'kiln_star'
  // Slice 5 (2026-10-15) — the danger bench's first hunters.
  | 'fangwolf'
  | 'salt_scorpion'
  | 'slag_serpent'
  | 'prism_cat'
  | 'fen_lurker'
  | 'hollow_widow'
  | 'sporeback'
  // Slice 6 (2026-10-15) — the aerial cast.
  | 'bonepicker'
  | 'storm_kite'
  | 'vent_drake'
  | 'spire_bat'
  | 'dust_moth'
  // Slice 7 (2026-10-15) — the remaining ground casts.
  | 'pool_snapper'
  | 'meadow_bull'
  | 'canopy_sloth'
  | 'crown_cat'
  | 'path_beetle'
  | 'gladhand'
  | 'taster'
  | 'heartbearer'
  | 'dusk_grazer'
  | 'answer_deer'
  | 'edge_wren'
  // Slice 8 (2026-10-15) — hybrid citizens, the weather-locked
  // Rainback, and the far-range stragglers.
  | 'rainback'
  | 'rime_owl'
  | 'storm_crow'
  | 'surge_runner'
  | 'hayfinch'
  | 'root_otter'
  | 'boiler_crab'
  | 'far_bat'
  | 'thaw_mouse'
  | 'meal_moth'
  | 'heart_beetle'
  // Slice 11 (2026-10-16) — the fauna wave.
  | 'long_grazer'
  | 'harvest_shrew'
  | 'plain_vole'
  | 'plainswift'
  | 'spore_wolf'
  | 'rib_spider'
  | 'root_serpent'
  | 'second_tenant'
  | 'sap_turtle'
  | 'ashpicker'
  | 'grave_owl'
  | 'zot_hopper'
  // Slice 13 (2026-10-16) — fauna wave 2, the small skies.
  | 'hedge_sparrow'
  | 'snow_finch'
  | 'winter_wren'
  | 'cinder_finch'
  | 'fen_finch'
  | 'ruin_sparrow'
  | 'field_crow'
  | 'moon_moth'
  | 'dust_lizard'
  | 'sleet_frog'
  | 'frost_newt'
  | 'cinder_toad'
  // Slice 15 (2026-10-16) — fauna wave 3.
  | 'rootborer'
  | 'fog_calf'
  | 'mote_swarm'
  | 'guest_bird'
  | 'rib_walker'
  | 'pan_piper'
  | 'logback'
  | 'driftmoth'
  | 'stillmouth'
  | 'pale_grazer'
  | 'amber_snail'
  | 'sapwing'
  // Slice 17 (2026-10-16) — fauna wave 4.
  | 'vent_wisp'
  | 'brambleback'
  | 'static_crab'
  | 'dust_hawk'
  | 'bonebreaker'
  | 'zot_serpent'
  | 'ironjaw'
  | 'hoar_serpent'
  | 'tumble_crab'
  | 'facet_beetle'
  | 'skull_hermit'
  | 'row_grazer'
  // Slice 20 (2026-10-16) — fauna wave 5.
  | 'shardwing'
  | 'ironworm'
  | 'driftworm'
  | 'ashswimmer'
  | 'glass_snake'
  | 'steam_eel'
  | 'pan_lizard'
  | 'seep_midge'
  | 'spiral_moth'
  | 'threshold_hound'
  | 'saltpicker'
  | 'marrow_leech'
  // Slice 22 (2026-10-16) — fauna wave 6.
  | 'hearth_wisp'
  | 'relay_wisp'
  | 'gap_moth'
  | 'deck_weaver'
  | 'lake_glider'
  | 'frost_fisher'
  | 'ash_lark'
  | 'reedbird'
  | 'storm_thrush'
  | 'blizzard_kite'
  | 'shard_moth'
  | 'walking_root'
  // Slice 24 (2026-10-16) — fauna wave 7, the landmark wave.
  | 'scaldback'
  | 'row_tender'
  | 'feral_tender'
  | 'blink_hare'
  | 'sky_jelly'
  | 'hearth_dog'
  | 'false_greeter'
  | 'storm_roc'
  | 'feral_warden'
  | 'heartling'
  // Slice 30 (2026-10-16) — THE OVERSIZE TIER, fauna side.
  | 'grass_leviathan'
  | 'cloud_whale'
  | 'storm_leviathan'
  | 'garden_colossus'
  | 'sleeping_mountain'
  | 'glass_behemoth'
  | 'old_marrow'
  | 'winter_mother'
  | 'dune_whale'
  | 'great_hermit'
  | 'tempest_worm'
  | 'mirror_jelly'
  | 'pond_skater'
  | 'brine_jelly'
  | 'sumpfish'
  | 'brook_minnow'
  | 'ice_maw'
  | 'drift_krill'
  | 'deep_carp'
  | 'pale_eel'
  | 'plunge_duck'
  | 'mirror_fish'
  | 'lake_leviathan'
  | 'deep_reef'
  | 'diver_beetle'
  | 'dartfisher'
  | 'glyph_carp'
  | 'silver_skater'
  | 'silverfin'
  | 'plated_crab'
  | 'silver_dipper'
  | 'mirror_heron';

export interface FaunaEntity {
  id: string;
  species: FaunaSpecies;
  x: number;
  z: number;
  y: number;
  rotation: number;
  state: 'idle' | 'wandering' | 'following' | 'patrolling' | 'eating' | 'alert' | 'attacking';
  isTamed: boolean;
  tamedBy?: string;
  targetX: number;
  targetZ: number;
  speed: number;
  health: number;
  maxHealth: number;
  byproductTimer: number; // spawns bio_pellet or carapace_scale
  /** Seconds until a wild hunter may bite again (slice 5 hunt
   *  system). Optional: absent on saves from before the danger
   *  slice; the sim treats absent as ready. */
  biteTimer?: number;
  /** Seconds since this creature last shed a SAMPLE of itself
   *  (creature renewal, 2026-10-16). Optional: absent on older
   *  saves; the sim treats absent as 0. Tamed creatures shed on
   *  the kind interval; wild ones leave rarer traces. */
  sampleTimer?: number;
  /** Solvent dissolve clock (Adam, 2026-10-16): seconds of
   *  dissolve remaining after an emergency spray; while it runs,
   *  the creature takes damage over time and flees. */
  dissolveTimer?: number;
  /** Striker flinch clock (Adam, 2026-10-16): seconds of stagger
   *  left after a close-weapon hit. While it runs the creature
   *  neither moves nor bites — the melee's breathing room. */
  flinchTimer?: number;
  /** Provocation clock (slice 32, 2026-10-16): seconds of
   *  retaliation left after player-side harm. While it runs, a
   *  provokedOnly species (the oversize tier) hunts; stamped by
   *  strikes, landed shots, dissolves and guardian bites, and
   *  refreshed by further harm. Optional: absent on older saves;
   *  the sim treats absent as unprovoked. */
  provokedTimer?: number;
  // Behavior phase clock (slice 38, 2026-10-16): seconds into
  // a species' cyclic behavior (the Plunge Duck's dive cycle),
  // ticked by the sim for species whose table entry names one.
  phaseTimer?: number;
  // Social engines (creature slice 47, 2026-10-16): the valley
  // staff's transient office state — an escort's purpose or a
  // taster's deliberation — plus its clock and, for the taster's
  // sentence, the visitor's accrued travel under its regard.
  // Session-transient: an office interrupted by a save simply
  // lapses, and the valley offers it again.
  socialState?: string;
  socialTimer?: number;
  socialTravel?: number;
  // The Answer Deer's courtship (slice 48): seconds of calm
  // company this deer has been shown, accrued by the sim and
  // READ by the lure — the roster's only tame whose method is
  // the tamer's own state. Persists with the fauna: calm is
  // collected over days, not in one held breath.
  // The variant of the zone this citizen was dealt into
  // (slice 49), stamped at generation when the zone HAS a
  // variant. The Spiral Moth reads its keeping from it: in
  // an Untended garden, the signed spirals run backward.
  homeVariant?: string;
  calmRegard?: number;
  // The Heartbearer's load (slice 48): edibles placed on its
  // back, delivered to the valley's heart on its route. The
  // route's outer post is remembered beside them.
  cargoItems?: ItemId[];
  routeX?: number;
  routeZ?: number;
  // Hearth Dog courtship (slice 39, 2026-10-16): the arrived dog
  // carries the reversed taming on its own back — how many
  // offerings it has accepted, how many seconds of loaded-zone
  // time remain for it to decide (three ten-minute days), and
  // how long since the last counted offering (a dog decides at
  // its own pace; offerings count at most one a minute). Absent
  // on every other creature and on dogs dealt before the
  // arrival build — those keep their own counsel forever.
  hearthFeedings?: number;
  hearthDecideTimer?: number;
  hearthFedTimer?: number;
  // Hearth Dog growth clock, in game days (0 = fresh pup, 10 = full-grown).
  hearthAgeDays?: number;
  animTime: number;
  /** Biome TYPE this creature spawned in (world-gen stamp; absent on old saves). */
  biome?: BiomeId;
  colorVariant?: string;
  customName?: string;
  command?: 'follow' | 'stay' | 'guard';
  anchorX?: number; // Guard post: where 'guard' was ordered — patrols loop
  anchorZ?: number; // around it and collectors return to it.
  // Pond stamp (pond build, 2026-10-16): pond-spawned fauna carry
  // their pond's radius here (the center rides anchorX/anchorZ);
  // the sim clamps every wild target to that disc, so a pond
  // citizen's world stays its pond.
  pondRadius?: number;

}

export type StructureType =
  | 'root_tile_floor'
  | 'heart_tile'
  | 'biotunnel_mouth'
  | 'chitin_glass_wall'
  | 'rootweave_wall'
  | 'saltglass_pane'
  | 'hearthpod'
  | 'pen_fence'
  | 'pen_gate'
  | 'iris_slit_door'
  | 'lantern_fern_post'
  | 'spore_canopy'
  | 'bio_forge_station'
  | 'tamed_snap_trap_turret'
  | 'cultivation_mound'
  | 'storage_pod'
  | 'sample_rack'
  | 'root_table'
  | 'root_stool'
  | 'woven_rug'
  | 'root_shelf'
  | 'root_bed'
  | 'culture_vat'
  | 'vine_ladder'
  | 'cave_mouth'
  | 'cave_exit'
  | 'cave_descent'
  | 'vine_shaft'
  | 'ruin_landmark'
  | 'tender_husk'
  | 'bone_fragment'
  | 'leviathan_ribs'
  | 'fulgurite'
  | 'petrified_shroom'
  | 'ruin_exit'
  | 'precursor_cache'
  | 'artifact_heart'
  | 'ruin_glyph';
  // NOTE: worn equipment (the gauntlet and its kin) is NOT a
  // structure — it cannot be built, placed, or stood on. It lives in
  // ItemId's equipment section. (It lived HERE until 2026-10-15,
  // which is why the engine's structure tables demanded a world
  // model and a glow entry for a glove.)

/** Dressing piece types a cave mouth wears (see game/caveSurface.ts). */
export type CaveDressingType =
  | 'cave_mouth'
  | 'dark_soil_patch'
  | 'rock_lip'
  | 'boulder'
  | 'rubble'
  | 'path_stone'
  | 'glow_spore_cluster'
  | 'reed_cluster'
  | 'glow_fungus_cluster'
  | 'heat_cracked_stone'
  | 'ember_vent';

/** One piece of cave-mouth set dressing, in zone-local meters. */
export interface CaveDressingPiece {
  id: string;
  type: CaveDressingType;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  /** Solid set dressing (kept out of the mouth's approach corridor). */
  blocking: boolean;
}

/**
 * The portal link on a cave-mouth structure: where this mouth leads and
 * where an exiting player reappears on the surface. This is the settled
 * "return address" design — stored save data (host-authoritative),
 * NEVER a generation input: the cavern behind this mouth derives from
 * (world seed + instanceId) alone, so moving this record can never
 * change the cave.
 */
export interface CaveLinkData {
  instanceId: string;
  /** Exit spawn: the mouth's anchor pushed 2 m out along its facing. */
  exitX: number;
  exitZ: number;
  dressing: CaveDressingPiece[];
}

/** Dressing piece types a ruin landmark wears (see game/ruins.ts). */
export type RuinDressingType =
  | 'pillar'
  | 'toppled_pillar'
  | 'wall_stub'
  | 'arch_fragment'
  | 'shard'
  | 'rubble';

/** One piece of ruin set dressing, in zone-local meters. */
export interface RuinDressingPiece {
  id: string;
  type: RuinDressingType;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  /** Solid set dressing (kept out of the entrance approach). */
  blocking: boolean;
}

/**
 * The record on a ruin_landmark structure (P4, surface stage): which
 * precursor fate built this place, which interior generator variant
 * that fate chooses, and how large the ruin is. Like the cave link,
 * this is stored bookkeeping — the interior (a later stage) derives
 * from (world seed + instanceId + fate) alone, so this record can
 * never change what sleeps below. The fate is deliberately NOT shown
 * in the UI: a world's story is discovered by reading its ruins.
 */
export interface RuinLinkData {
  instanceId: string;
  fate: string;
  variant: string;
  tier: 'traces' | 'small' | 'medium' | 'grand';
  /** Return address for the future interior: anchor + 2 m facing. */
  exitX: number;
  exitZ: number;
  dressing: RuinDressingPiece[];
}
;

export interface StructureEntity {
  id: string;
  type: StructureType;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  rotation: number;
  /**
   * Story level: 0 (or absent, in older saves) = ground story. A wall at
   * level 1 stands on a level-0 wall; a floor at level 1 is a ceiling
   * from below and the floor of the second story from above.
   */
  level?: number;
  health: number;
  /**
   * Ruin-interior feature payload (P4 interior stage): rides the
   * precursor_cache / artifact_heart / ruin_glyph structures inside a
   * ruin instance so any client can resolve loot and lore locally.
   * fate = the world's fate id; band = the feature's depth band.
   * Instance-transient like the cave link: never in a save's surface
   * world (instances park, they don't persist).
   */
  ruinFeature?: {
    fate: string;
    band: 'shallow' | 'mid' | 'deep';
  };
  maxHealth: number;
  doorOpenProgress: number; // 0 closed, 1 open
  plantedFloraId?: string; // for cultivation mound
  lastDefendTimer?: number;
  color?: string;
  /** Present only on cave_mouth structures: the portal link + dressing. */
  cave?: CaveLinkData;
  /**
   * Present only on storage_pod structures (Adam, 2026-10-15): the
   * pod's tier and what it holds. Placed pods start at tier 1,
   * empty; upgrade kits raise the tier in place, contents kept.
   * Rides the world snapshot inside the structure, host-saved like
   * everything else in the structures list.
   */
  storage?: { tier: number; items: Partial<Record<ItemId, number>> };
  /**
   * Present only on culture_vat structures (Adam, 2026-10-15):
   * the vat's tier and its current gestation, if one is running.
   * progress/total are SECONDS of loaded-zone time (a Sol-cycle
   * is 500); progress reaching total means ready to hatch, and
   * the hatch itself is the player's click — a vat never spills
   * its creature into an empty zone. Rides the world snapshot
   * inside the structure, like the storage record.
   */
  vat?: {
    tier: number;
    gestating?: { species: FaunaSpecies; progress: number; total: number };
  };
  /**
   * Present only on biotunnel_mouth structures: the derived
   * pairing state (see game/tunnel.ts) — refreshed by App at every
   * structure sync, so the engine can light the membrane when the
   * pair is whole and let it go dark when an end is gone. Advisory
   * only: the truth is the count of mouths in the known world.
   */
  tunnel?: { paired: boolean };
  /** Present only on ruin_landmark structures: fate/variant/tier record. */
  ruin?: RuinLinkData;
}

export interface DroppedItemEntity {
  id: string;
  itemId: ItemId;
  count: number;
  x: number;
  z: number;
  y: number;
  bobTime: number;
}

export interface CraftingRecipe {
  id: string;
  outputId: ItemId;
  outputCount: number;
  name: string;
  description: string;
  // The forge's recipe-tab groups (BioForgeModal filters on exactly
  // these). This type previously declared the ITEM category union,
  // which made every seed recipe a type error — corrected 2026-10-14.
  category: 'seeds' | 'fertilizers' | 'composites' | 'defenses';

  ingredients: { id: ItemId; count: number }[];
  craftTimeMs: number;

}

export interface CodexEntry {
  species: FloraSpecies | FaunaSpecies | StructureType;
  name: string;
  type: 'flora' | 'fauna' | 'composite';
  discovered: boolean;
  scannedCount: number;
  description: string;
  byproducts: string[];
  tamingOrCraftNotes: string;
  biome: string;
  iconColor: string;
}

export interface BiomeArea {
  name: string;
  description: string;
  groundColor: number;
  ambientLightColor: number;
  fogColor: number;
  primaryTone: string;
}

/**
 * Mini-quest progress (Adam, 2026-10-15): which tutorial quests are
 * latched complete, which one the tracker HUD follows, and whether
 * the tracker shows at all. Rides the save inside PlayerState, like
 * heldItemId; absent on saves from before quests existed — App
 * treats absence as the veteran default (nothing latched, nothing
 * tracked, tracker hidden; the quest list still opens and the show
 * checkbox there can wake the tracker).
 */
/**
 * Goal-state signals for the ASK THE WORLD quest line (Adam,
 * 2026-10-16): the durable record of things the player has DONE
 * and SEEN — zones stood in, ruins entered, stones read, a heart
 * reached, a creature hatched or bonded — written by small
 * observer effects in App and read by the line's quests through
 * game/quests.ts goalMet(). Everything optional: saves from
 * before the line simply have no signals yet. Biome ids are
 * stored as plain strings to keep this file import-light.
 */
export interface QuestSignals {
  families?: string[];
  hybrid?: boolean;
  tier3?: boolean;
  ruins?: string[];
  glyphRuins?: string[];
  heart?: boolean;
  hatched?: boolean;
  dogBonded?: boolean;
  madeMet?: string[];
  /** V2 (2026-10-16): the doorstep stone read at the spawn
   *  remnant. */
  homeStone?: boolean;
  /** V2: a BioTunnel pair traversed. */
  tunnel?: boolean;
  /** V2: the homestead composite (heart tile + hearth + a
   *  companion in residence). */
  homeOrganism?: boolean;
  /** V2: something planted and harvested in a Precursor
   *  Garden. */
  gardenHarvest?: boolean;
  /** V2: the homestead systems humming together (hearth + a
   *  gestating vat + a holding storage pod). */
  hum?: boolean;
  /** V2: the zone key ("zx,zz") where the player last fell —
   *  Walk Back reads it; cleared when the walk is done. */
  fellZone?: string;
  /** V2: the player returned on foot to where they fell. */
  walkBack?: boolean;
}

export interface QuestProgressState {
  completedIds: string[];
  trackedId: string | null;
  showHud: boolean;
  /** Ask the World goal-state signals (above). Optional: older
   *  saves predate the line. */
  signals?: QuestSignals;
  /** The quest the player closed with the tracker's X (Adam,
   * 2026-10-15): the tracker rests instead of falling back to it.
   * Not an abandonment — tracking it again from the quest log
   * clears the dismissal. Optional: older saves predate it. */
  dismissedId?: string | null;
}

export interface PlayerState {
  x: number;
  z: number;
  rotation: number;
  /** Which story the player stands on (0 = ground). See StructureEntity.level. */
  level: number;
  health: number;
  maxHealth: number;
  stamina: number;
  maxStamina: number;
  energy: number;
  maxEnergy: number;
  activeTool: ToolType;
  selectedStructureType: StructureType;
  selectedSeedId: ItemId;
  selectedFertilizerId: ItemId;
  /** The LEFT HAND: an item carried for its passive effect (today: the
   * Hand Lantern-Fern's light), separate from the active tool. Rides
   * the save verbatim with the rest of PlayerState; absent (undefined)
   * on saves from before the slot existed — treat as empty. */
  heldItemId?: ItemId | null;
  /** Mini-quest progress — see QuestProgressState. Optional for
   * save compatibility; new worlds start it fresh in
   * handleCreateSave. */
  questProgress?: QuestProgressState;
}

export interface MultiplayerPeer {
  id: string;
  name: string;
  color: string;
  x: number;
  z: number;
  rotation: number;
  currentTool: ToolType;
  ping: number;
}

export interface GameNotification {
  id: string;
  title: string;
  message: string;
  type: 'harvest' | 'discover' | 'tame' | 'craft' | 'alert' | 'system';
  iconColor: string;
  time: number;
}

/**
 * Strict Discriminated Union for 1st-person reticle inspection
 * Enforces CODE_MANIFESTO.md Rule 9 (Zero Duck-Typing)
 */
export type HoverTarget =
  | { type: 'flora'; entity: FloraEntity; name: string; details: string }
  | { type: 'fauna'; entity: FaunaEntity; name: string; details: string }
  | { type: 'structure'; entity: StructureEntity; name: string; details: string }
  | { type: 'ground'; worldX: number; worldZ: number; name: string; details: string }
  | null;
