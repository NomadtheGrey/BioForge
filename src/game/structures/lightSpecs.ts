// lightSpecs.ts — the pooled-lighting DATA tables (Adam-approved
// extraction from threeEngine, 2026-10-16): every flora species'
// and every structure type's base glow — color, intensity, reach,
// and the height the light rides at. Pure data, no logic: the
// engine's getFloraLightSpec / getStructureLightSpec layer the
// growth-dynamic cases (lantern ferns, posts) on top of these.
// This is the most-edited region the engine had — every new plant
// or structure adds a row HERE now, not in the engine.
//
// THE PHYSICAL SCALE (ground-light fix, 2026-10-18): the pool
// runs physical falloff (illuminance = intensity / distance²),
// the scale the lantern post (40 / 26) and the mature lantern
// fern (~30) were tuned in when they were re-lit by hand. These
// tables still carried the legacy era's numbers (0.2–1.5),
// which land at a fraction of a lux a meter out — invisible.
// Every row was multiplied ×10, ratios preserved exactly: the
// table's relative design (which species outshines which) is
// untouched, only its unit changed. NEW ROWS: write in the
// physical scale — a halo is 1–3, a real lamp 6–15, and
// nothing here outshines the post's 40. And y is the height
// the light rides ABOVE ITS GROUND (the engine adds the
// terrain/datum height itself — see getFloraLightSpec).
import type { FloraSpecies, StructureType } from '../../types/game';

export interface LightBase {
  color: number;
  intensity: number;
  distance: number;
  y: number;
}

// Every structure gets a small halo (~2m, enough to see by);
// ferns shine. Lantern ferns are growth-dynamic and handled by
// the engine's getters, hence their exclusion here.
export const FLORA_LIGHT_BASE: Record<Exclude<FloraSpecies, 'lantern_fern'>, LightBase> = {
    sap_weaver: { color: 0xf59e0b, intensity: 15, distance: 7, y: 1.2 },
    petal_mill: { color: 0xec4899, intensity: 5, distance: 3.5, y: 1.4 },
    mouth_vine: { color: 0xa3e635, intensity: 4, distance: 3, y: 1.0 },
    snap_trap: { color: 0xef4444, intensity: 5, distance: 3, y: 0.9 },
    bell_bloom: { color: 0x38bdf8, intensity: 6, distance: 4, y: 1.3 },
    ribbon_moss: { color: 0x2dd4bf, intensity: 4, distance: 2.5, y: 0.4 },
    echo_reed: { color: 0x2dd4bf, intensity: 5, distance: 3.5, y: 1.7 },
    bounce_shroom: { color: 0xa855f7, intensity: 6, distance: 3, y: 0.6 },
    glow_spore_cluster: { color: 0x06b6d4, intensity: 7, distance: 3.5, y: 0.5 },
    // Cave flora (Biolume Caverns): the fungus is the cave's lamp —
    // its pooled light is what you navigate by down there.
    glow_fungus: { color: 0x22d3ee, intensity: 8.5, distance: 6, y: 0.5 },
    sunshard_cluster: { color: 0xf59e0b, intensity: 5.5, distance: 3.5, y: 0.5 },
    prism_cluster: { color: 0xa78bfa, intensity: 8.5, distance: 4.5, y: 0.7 },
    // Fungal Hollow giants (2026-10-15): the senser's tips glow from
    // its full height; the visor's face markings smolder faintly; the
    // shelves barely — woody things, not lamps.
    antenna_shroom: { color: 0x7c3aed, intensity: 8, distance: 4.5, y: 2.6 },
    visor_shroom: { color: 0x7e57c2, intensity: 4.5, distance: 3, y: 1.5 },
    shelf_shroom: { color: 0xd9a05b, intensity: 2.5, distance: 2.5, y: 1.6 },
    // Mirror lily (2026-10-15): a low silver gleam on the pool —
    // its reach is the marsh's doing (the zone light multiplier),
    // not the flower's.
    mirror_lily: { color: 0x9fd8d4, intensity: 6, distance: 3.5, y: 0.3 },
    // Cinder bloom (2026-10-15): vent-glow — a small coal of light.
    cinder_bloom: { color: 0xff7a2a, intensity: 7, distance: 4, y: 0.7 },
    obsidian_bloom: { color: 0x8b5cf6, intensity: 5, distance: 3.5, y: 0.8 },
    prism_reed: { color: 0xa8e6e0, intensity: 4, distance: 3, y: 0.9 },
    rime_spire: { color: 0xa5d8ff, intensity: 4, distance: 3, y: 1.0 },
    heartroot: { color: 0xd9a05b, intensity: 3.5, distance: 2.5, y: 0.5 },
    gravebloom: { color: 0xf0d9a0, intensity: 3, distance: 2.5, y: 0.7 },
    stormcatcher: { color: 0xfbbf24, intensity: 4.5, distance: 3, y: 1.6 },
    dusk_grass: { color: 0xa855f7, intensity: 3, distance: 2.5, y: 0.5 },
    heartbloom: { color: 0xef4444, intensity: 6.5, distance: 4, y: 0.9 },
    precursor_bloom: { color: 0xf5d76e, intensity: 4.5, distance: 3, y: 0.9 },
    // Flora pipeline wave 1 (creature slice 9, 2026-10-15): ground
    // flora carry small halos like the other low growers — the
    // flame lily burns a little brighter, the ink cap barely at all.
    gulp_lily: { color: 0xfda4af, intensity: 3.5, distance: 2.5, y: 0.3 },
    waygrass: { color: 0x84cc16, intensity: 2.5, distance: 2, y: 0.4 },
    flame_lily: { color: 0xef4444, intensity: 5.5, distance: 3.5, y: 0.8 },
    salt_daisy: { color: 0xf8fafc, intensity: 3, distance: 2.5, y: 0.5 },
    compass_cress: { color: 0x67e8f9, intensity: 4, distance: 2.5, y: 0.3 },
    ice_grass: { color: 0xa5f3fc, intensity: 3.5, distance: 2.5, y: 0.4 },
    field_cap: { color: 0xd6c48f, intensity: 2.5, distance: 2, y: 0.4 },
    frostcap: { color: 0xe0f2fe, intensity: 4, distance: 3, y: 0.7 },
    haycap: { color: 0xeab308, intensity: 2.5, distance: 2, y: 0.3 },
    coal_cap: { color: 0xea580c, intensity: 4, distance: 2.5, y: 0.4 },
    snow_morel: { color: 0x78716c, intensity: 2, distance: 2, y: 0.3 },
    ink_cap: { color: 0x9ca3af, intensity: 2, distance: 2, y: 0.5 },
    // Flora wave 2 (creature slice 10, 2026-10-16): the Bog
    // Lantern and Glowcap are real lamps; the Stormroot's fruit
    // smolders amber; the rest keep ground-flora halos.
    bonemoss: { color: 0x14532d, intensity: 2, distance: 2, y: 0.2 },
    listening_fern: { color: 0x4ade80, intensity: 3, distance: 2.5, y: 0.6 },
    snowbell: { color: 0xbae6fd, intensity: 4, distance: 2.5, y: 0.6 },
    grave_vine: { color: 0xf1f5f9, intensity: 2.5, distance: 2, y: 0.4 },
    saltroot: { color: 0xa5f3fc, intensity: 3.5, distance: 3, y: 0.6 },
    stormroot: { color: 0xfbbf24, intensity: 5, distance: 3, y: 0.4 },
    bog_lantern: { color: 0xa3e635, intensity: 8, distance: 4.5, y: 0.6 },
    gale_grass: { color: 0xfde68a, intensity: 2.5, distance: 2, y: 0.5 },
    doorstep_rose: { color: 0xfb7185, intensity: 3, distance: 2.5, y: 0.4 },
    glyph_vine: { color: 0xa3e635, intensity: 3.5, distance: 2.5, y: 0.7 },
    glowcap: { color: 0x4ade80, intensity: 8.5, distance: 4.5, y: 0.4 },
    ash_puff: { color: 0xd6d3d1, intensity: 2, distance: 2, y: 0.2 },
    // Flora wave 3 (creature slice 12, 2026-10-16): the Glass
    // Fern and Stormcap glow from inside; the ivies smolder and
    // rime at ground level; the rest keep ground-flora halos.
    meadow_clover: { color: 0x22c55e, intensity: 2, distance: 2, y: 0.2 },
    vent_rose: { color: 0xf43f5e, intensity: 4.5, distance: 3, y: 0.3 },
    stormcap: { color: 0xa78bfa, intensity: 5, distance: 3, y: 0.5 },
    anvil_cap: { color: 0x78716c, intensity: 2, distance: 2, y: 0.4 },
    glass_fern: { color: 0x67e8f9, intensity: 5.5, distance: 3.5, y: 0.4 },
    forge_bloom: { color: 0xfb923c, intensity: 5, distance: 3, y: 0.3 },
    ember_ivy: { color: 0xf97316, intensity: 4, distance: 2.5, y: 0.4 },
    frost_ivy: { color: 0xbae6fd, intensity: 3.5, distance: 2.5, y: 0.4 },
    mirror_reed: { color: 0x7dd3fc, intensity: 4, distance: 2.5, y: 0.9 },
    rime_grass: { color: 0xe0f2fe, intensity: 3, distance: 2, y: 0.3 },
    fang_fern: { color: 0xa5f3fc, intensity: 3.5, distance: 2.5, y: 0.4 },
    mirror_cap: { color: 0x94a3b8, intensity: 3, distance: 2.5, y: 0.3 },
    // Flora wave 4 (creature slice 14, 2026-10-16): the fungus
    // bench — crystal citizens glow, the rest keep ground halos.
    meltcap: { color: 0xe9d5ff, intensity: 4.5, distance: 3, y: 0.4 },
    poolcap: { color: 0x6ee7b7, intensity: 3.5, distance: 2.5, y: 0.3 },
    saltcap: { color: 0xa5f3fc, intensity: 4.5, distance: 3, y: 0.4 },
    tomb_cap: { color: 0xd6d3d1, intensity: 2, distance: 2, y: 0.3 },
    ring_cap: { color: 0x4ade80, intensity: 3, distance: 2.5, y: 0.3 },
    veil_cap: { color: 0xf1f5f9, intensity: 3, distance: 2.5, y: 0.5 },
    glass_cap: { color: 0x67e8f9, intensity: 5.5, distance: 3.5, y: 0.4 },
    heart_shelf: { color: 0xb45309, intensity: 2, distance: 2, y: 0.8 },
    bone_puff: { color: 0xf5f5f4, intensity: 2.5, distance: 2, y: 0.3 },
    wind_puff: { color: 0xe7e5e4, intensity: 2.5, distance: 2, y: 0.3 },
    door_cap: { color: 0xa3e635, intensity: 3, distance: 2.5, y: 0.5 },
    glyph_cap: { color: 0xa3e635, intensity: 3.5, distance: 2.5, y: 0.4 },
    // Flora wave 5 (creature slice 16, 2026-10-16): the rose
    // bench — most keep garden halos; the Amber Bloom glows
    // through its amber, the Charnel heart smolders gold.
    canopy_cup: { color: 0x38bdf8, intensity: 3, distance: 2.5, y: 0.7 },
    banner_vine: { color: 0x65a30d, intensity: 2.5, distance: 2, y: 0.6 },
    charnel_bloom: { color: 0xfbbf24, intensity: 4, distance: 2.5, y: 0.3 },
    wrongbloom: { color: 0xd8b4fe, intensity: 4, distance: 2.5, y: 0.3 },
    tumble_sage: { color: 0xa3a380, intensity: 2, distance: 2, y: 0.3 },
    amber_bloom: { color: 0xf59e0b, intensity: 5, distance: 3, y: 0.3 },
    silt_rose: { color: 0x9f7a5a, intensity: 2.5, distance: 2, y: 0.3 },
    ghost_orchid: { color: 0xf1f5f9, intensity: 3.5, distance: 2.5, y: 0.5 },
    thaw_rose: { color: 0xfda4af, intensity: 3.5, distance: 2.5, y: 0.3 },
    dust_rose: { color: 0xf5f5f4, intensity: 2.5, distance: 2, y: 0.3 },
    obsidian_rose: { color: 0x57534e, intensity: 2, distance: 2, y: 0.3 },
    hedge_rose: { color: 0xe11d48, intensity: 3, distance: 2.5, y: 0.4 },
    // Flora wave 6 (creature slice 18, 2026-10-16): the last
    // flora — the Raincatcher hangs its sky-light high, the
    // Smoke Tree's seams glow coal-low, the Maw Bloom lures.
    raincatcher: { color: 0xbae6fd, intensity: 4, distance: 3.5, y: 0.8 },
    tending_vine: { color: 0xfde68a, intensity: 5, distance: 2.5, y: 0.5 },
    hearthroot: { color: 0xfb923c, intensity: 3.5, distance: 2.5, y: 0.3 },
    puffbell: { color: 0xd8b4fe, intensity: 3.5, distance: 2.5, y: 0.4 },
    arch_tree: { color: 0x92400e, intensity: 3, distance: 4, y: 1 },
    smoke_tree: { color: 0xea580c, intensity: 5, distance: 3.5, y: 0.5 },
    lightcreep: { color: 0xa3e635, intensity: 4, distance: 2.5, y: 0.2 },
    zot_star: { color: 0xfde047, intensity: 4.5, distance: 2.5, y: 0.2 },
    grabvine: { color: 0x4d7c0f, intensity: 2, distance: 2, y: 0.2 },
    maw_bloom: { color: 0xbe185d, intensity: 4, distance: 3, y: 0.3 },
    quiver_cap: { color: 0xa5f3fc, intensity: 4, distance: 2.5, y: 0.3 },
    balloon_vine: { color: 0x86efac, intensity: 3, distance: 2.5, y: 0.5 },
    // Flora wave 7 (creature slice 19, 2026-10-16): the
    // Aurora Vine glows like its namesake; the Coalwood keeps
    // a dark halo over a green crown.
    noonflower: { color: 0xfacc15, intensity: 3.5, distance: 2.5, y: 0.5 },
    lambswool: { color: 0xfef9c3, intensity: 2, distance: 2, y: 0.2 },
    spore_fern: { color: 0x4ade80, intensity: 3, distance: 2.5, y: 0.3 },
    coalwood: { color: 0x44403c, intensity: 2.5, distance: 3, y: 0.8 },
    aurora_vine: { color: 0x6ee7b7, intensity: 5.5, distance: 3, y: 0.4 },
    bridge_moss: { color: 0x84cc16, intensity: 2, distance: 2, y: 0.2 },
    canopy_orchid: { color: 0xf0abfc, intensity: 4, distance: 2.5, y: 0.5 },
    rib_grass: { color: 0xa3a380, intensity: 2, distance: 2, y: 0.3 },
    kite_flower: { color: 0x7dd3fc, intensity: 3, distance: 2.5, y: 0.6 },
    guest_flower: { color: 0xfda4af, intensity: 3, distance: 2, y: 0.2 },
    clock_bloom: { color: 0xc4b5fd, intensity: 3.5, distance: 2.5, y: 0.4 },
    roadweed: { color: 0x65a30d, intensity: 2, distance: 2, y: 0.2 },
    // Flora wave 8 (creature slice 21, 2026-10-16): the
    // fungus bench — the Static Cap crackles yellow; the
    // Hearth Cap keeps hearth-warmth.
    bog_jelly: { color: 0xf59e0b, intensity: 3, distance: 2, y: 0.2 },
    reed_rust: { color: 0xea580c, intensity: 2.5, distance: 2, y: 0.3 },
    salt_jelly: { color: 0xe0f2fe, intensity: 3, distance: 2, y: 0.2 },
    ice_shelf: { color: 0xbae6fd, intensity: 3, distance: 2.5, y: 0.4 },
    root_cup: { color: 0x38bdf8, intensity: 3, distance: 2, y: 0.2 },
    marrow_mold: { color: 0x44403c, intensity: 2, distance: 2, y: 0.2 },
    static_cap: { color: 0xfde047, intensity: 4.5, distance: 2.5, y: 0.3 },
    hearth_cap: { color: 0xfb923c, intensity: 4, distance: 2.5, y: 0.3 },
    bed_cap: { color: 0xa3a380, intensity: 2.5, distance: 2, y: 0.3 },
    path_puff: { color: 0xe7e5e4, intensity: 2, distance: 2, y: 0.2 },
    dew_mold: { color: 0xe2e8f0, intensity: 3, distance: 2, y: 0.2 },
    scar_cap: { color: 0xdc2626, intensity: 4, distance: 2.5, y: 0.2 },
    // Flora wave 9 (creature slice 23, 2026-10-16): fungus
    // bench II — the Gloom Cap lights from below; the Song
    // Cap keeps a shore-light.
    drift_mold: { color: 0xa8a29e, intensity: 2, distance: 2, y: 0.2 },
    glass_mold: { color: 0x365314, intensity: 2.5, distance: 2, y: 0.2 },
    strike_cap: { color: 0xd6d3d1, intensity: 3, distance: 2, y: 0.3 },
    dune_cap: { color: 0xd97706, intensity: 2.5, distance: 2, y: 0.3 },
    basin_puff: { color: 0xbae6fd, intensity: 3, distance: 2, y: 0.3 },
    thaw_jelly: { color: 0xa5f3fc, intensity: 3.5, distance: 2, y: 0.2 },
    prism_cap: { color: 0x67e8f9, intensity: 5, distance: 2.5, y: 0.3 },
    still_cap: { color: 0xe2e8f0, intensity: 3, distance: 2, y: 0.3 },
    fang_shelf: { color: 0xcbd5e1, intensity: 2.5, distance: 2, y: 0.4 },
    song_cap: { color: 0x93c5fd, intensity: 4, distance: 2.5, y: 0.3 },
    canopy_cap: { color: 0xfbbf24, intensity: 3.5, distance: 2, y: 0.3 },
    gloom_cap: { color: 0x60a5fa, intensity: 5, distance: 2.5, y: 0.2 },
    // Flora wave 10 (creature slice 25, 2026-10-16): the cap
    // bench — kitchens keep low, warm lights.
    fall_shelf: { color: 0xa16207, intensity: 2.5, distance: 2, y: 0.4 },
    row_cap: { color: 0xa3e635, intensity: 3, distance: 2, y: 0.3 },
    wild_cap: { color: 0x65a30d, intensity: 3, distance: 2, y: 0.3 },
    dust_cap: { color: 0xe7e5e4, intensity: 2.5, distance: 2, y: 0.3 },
    marrow_cap: { color: 0xfef3c7, intensity: 3, distance: 2, y: 0.3 },
    rib_cap: { color: 0xfde68a, intensity: 3, distance: 2, y: 0.3 },
    scald_cap: { color: 0xfb923c, intensity: 4, distance: 2, y: 0.3 },
    compost_cap: { color: 0x57534e, intensity: 2, distance: 2, y: 0.3 },
    brine_cap: { color: 0xa5f3fc, intensity: 3.5, distance: 2, y: 0.3 },
    iron_cap: { color: 0x78716c, intensity: 3, distance: 2, y: 0.3 },
    hedge_cap: { color: 0x4d7c0f, intensity: 2.5, distance: 2, y: 0.3 },
    sun_cap: { color: 0xfde047, intensity: 4.5, distance: 2.5, y: 0.3 },
    // Flora wave 11 (creature slice 26, 2026-10-16): the
    // fungus tail — the Dark Cap keeps the faintest gill-glow.
    mist_cap: { color: 0xe2e8f0, intensity: 3, distance: 2, y: 0.3 },
    tool_cap: { color: 0xfbbf24, intensity: 3, distance: 2, y: 0.3 },
    sail_cap: { color: 0xf0f9ff, intensity: 3, distance: 2, y: 0.4 },
    night_cap: { color: 0x312e81, intensity: 3.5, distance: 2, y: 0.3 },
    storm_mold: { color: 0x6b7c5e, intensity: 2, distance: 2, y: 0.2 },
    dark_cap: { color: 0x60a5fa, intensity: 3.5, distance: 2, y: 0.25 },
    husk_cap: { color: 0xd6d3d1, intensity: 2.5, distance: 2, y: 0.3 },
    shell_cap: { color: 0xfde68a, intensity: 3, distance: 2, y: 0.3 },
    trail_cap: { color: 0xa16207, intensity: 3, distance: 2.5, y: 0.4 },
    sweet_cap: { color: 0xf59e0b, intensity: 4, distance: 2, y: 0.3 },
    great_puff: { color: 0xf8fafc, intensity: 3, distance: 2.5, y: 0.5 },
    rust_cap: { color: 0xb91c1c, intensity: 3, distance: 2, y: 0.3 },
    // Flora wave 12 (creature slice 27, 2026-10-16): trees,
    // vines and mosses — the Gloam Fern lights its own parish.
    answer_tree: { color: 0x4d7c0f, intensity: 2.5, distance: 2.5, y: 0.6 },
    greeting_cap: { color: 0xfde047, intensity: 3.5, distance: 2, y: 0.3 },
    relic_tree: { color: 0xd6d3d1, intensity: 3, distance: 2.5, y: 0.6 },
    ironwood: { color: 0x44403c, intensity: 2, distance: 2.5, y: 0.6 },
    glare_vine: { color: 0xa5f3fc, intensity: 4.5, distance: 2.5, y: 0.3 },
    marrow_vine: { color: 0xfbcfe8, intensity: 3, distance: 2, y: 0.3 },
    row_moss: { color: 0x84cc16, intensity: 2.5, distance: 2, y: 0.2 },
    prism_moss: { color: 0x67e8f9, intensity: 4.5, distance: 2.5, y: 0.2 },
    gloam_fern: { color: 0x2dd4bf, intensity: 5, distance: 2.5, y: 0.3 },
    flood_fern: { color: 0x38bdf8, intensity: 3, distance: 2, y: 0.3 },
    ice_bloom: { color: 0xe0f2fe, intensity: 4.5, distance: 2.5, y: 0.3 },
    ripple_bell: { color: 0x93c5fd, intensity: 3.5, distance: 2, y: 0.3 },
    // Flora wave 13 (creature slice 28, 2026-10-16): orchids,
    // reeds and candles — the Night Candle lights at candle
    // height, plainly.
    night_candle: { color: 0xfefce8, intensity: 5, distance: 2.5, y: 0.5 },
    scar_orchid: { color: 0xfda4af, intensity: 3.5, distance: 2, y: 0.3 },
    ashveil: { color: 0xa8a29e, intensity: 2, distance: 2, y: 0.2 },
    chime_reed: { color: 0xbae6fd, intensity: 3, distance: 2, y: 0.4 },
    sky_lily: { color: 0xf0abfc, intensity: 4, distance: 2, y: 0.3 },
    fall_orchid: { color: 0xf9a8d4, intensity: 3.5, distance: 2, y: 0.4 },
    deck_flower: { color: 0xc4b5fd, intensity: 3.5, distance: 2, y: 0.3 },
    feral_rose: { color: 0xe11d48, intensity: 3.5, distance: 2, y: 0.4 },
    bone_orchid: { color: 0xfafaf9, intensity: 3, distance: 2, y: 0.3 },
    marrow_reed: { color: 0xfef3c7, intensity: 2.5, distance: 2, y: 0.4 },
    pale_sedge: { color: 0xe7e5e4, intensity: 2, distance: 2, y: 0.25 },
    snow_cress: { color: 0xf0fdf4, intensity: 3, distance: 2, y: 0.2 },
    // Flora wave 14 (creature slice 29, 2026-10-16): THE
    // FINAL flora wave — the Sump Cap keeps its own light.
    scald_fern: { color: 0xfb923c, intensity: 3.5, distance: 2, y: 0.3 },
    mulch_rose: { color: 0xbe185d, intensity: 3.5, distance: 2, y: 0.4 },
    brine_rose: { color: 0xf9a8d4, intensity: 3.5, distance: 2, y: 0.4 },
    frost_reed: { color: 0xa5f3fc, intensity: 3, distance: 2, y: 0.4 },
    snow_shelf: { color: 0xe2e8f0, intensity: 2.5, distance: 2, y: 0.4 },
    sump_cap: { color: 0x4ade80, intensity: 5, distance: 2.5, y: 0.25 },
    grave_puff: { color: 0xa8a29e, intensity: 2.5, distance: 2, y: 0.3 },
    salt_mold: { color: 0xe0f2fe, intensity: 3, distance: 2, y: 0.2 },
    ash_mold: { color: 0x78716c, intensity: 2, distance: 2, y: 0.2 },
    nest_cap: { color: 0xa16207, intensity: 3, distance: 2, y: 0.3 },
    frost_mold: { color: 0xbae6fd, intensity: 3, distance: 2, y: 0.2 },
    steam_cap: { color: 0xf1f5f9, intensity: 3.5, distance: 2, y: 0.3 },
    // Pond build (2026-10-16): the jelly that lights the reef's
    // windows — a faint green glow in black water.
    lake_jelly: { color: 0x4ade80, intensity: 5.5, distance: 2.6, y: 0.3 },
    // Landscape flora trio (creature slice 31, 2026-10-16).
    valley_heart: { color: 0x84cc16, intensity: 5, distance: 3, y: 0.6 },
    mother_grove: { color: 0xa16207, intensity: 4, distance: 3, y: 0.4 },
    first_tree: { color: 0x365314, intensity: 4, distance: 3, y: 0.6 },
  };

export const STRUCTURE_LIGHT_BASE: Record<Exclude<StructureType, 'lantern_fern_post'>, LightBase> = {
    root_tile_floor: { color: 0x4ade80, intensity: 4.5, distance: 2.2, y: 0.5 },
    heart_tile: { color: 0xfb7185, intensity: 5.5, distance: 2.8, y: 0.5 },
    chitin_glass_wall: { color: 0x67e8f9, intensity: 5.5, distance: 2.5, y: 1.2 },
    rootweave_wall: { color: 0xa3e635, intensity: 3.5, distance: 2.2, y: 1.2 },
    saltglass_pane: { color: 0xa7f3d0, intensity: 3, distance: 2.2, y: 1.2 },
    hearthpod: { color: 0xf59e0b, intensity: 6, distance: 3.0, y: 0.6 },
    pen_fence: { color: 0x84cc16, intensity: 3, distance: 2.0, y: 1.0 },
    pen_gate: { color: 0xa3e635, intensity: 3.5, distance: 2.2, y: 1.2 },
    sample_rack: { color: 0x4ade80, intensity: 4, distance: 2.4, y: 1.0 },
    banner_post: { color: 0xc2b49a, intensity: 3, distance: 2.0, y: 2.0 },
    // The chime is bone and straw in the sun — a faint warm halo,
    // nothing more. It is a sentinel, not a lamp (the physical
    // scale: halo 1-3).
    bone_chime_sentinel: { color: 0xffe8c0, intensity: 1.6, distance: 2.2, y: 2.4 },
    root_table: { color: 0xfbbf24, intensity: 2.5, distance: 2.0, y: 0.9 },
    root_stool: { color: 0xfbbf24, intensity: 2, distance: 1.8, y: 0.6 },
    woven_rug: { color: 0xa3e635, intensity: 1.2, distance: 1.5, y: 0.3 },
    root_shelf: { color: 0xfbbf24, intensity: 2.5, distance: 2.0, y: 1.1 },
    root_bed: { color: 0xf9a8d4, intensity: 3, distance: 2.2, y: 0.7 },
    // The husk is alive — a very faint warm halo at the rim,
    // the heat of a sleeping body. (Physical scale: halo 1-3.)
    slumber_husk: { color: 0xffb4a2, intensity: 1.4, distance: 2.2, y: 0.5 },
    iris_slit_door: { color: 0xf0abfc, intensity: 5.5, distance: 2.5, y: 1.2 },
    spore_canopy: { color: 0xa78bfa, intensity: 9, distance: 3.5, y: 2.6 },
    bio_forge_station: { color: 0x22d3ee, intensity: 9, distance: 3.5, y: 1.4 },
    tamed_snap_trap_turret: { color: 0xef4444, intensity: 7, distance: 3, y: 1.1 },
    cultivation_mound: { color: 0x4ade80, intensity: 4.5, distance: 2.2, y: 0.6 },
    // The storage pod's amber seam breathes a low, warm halo.
    storage_pod: { color: 0xf59e0b, intensity: 5, distance: 2.4, y: 0.8 },
    culture_vat: { color: 0x34d399, intensity: 6.5, distance: 3.4, y: 1.0 },
    biotunnel_mouth: { color: 0x2dd4bf, intensity: 6, distance: 3.2, y: 1.2 },
    // The living ladder drinks light all day and gives a little
    // back at dusk — a soft leaf-green halo at climbing height.
    // (This entry was one of the two the pre-2026-10-15 type union
    // demanded but nobody had written; the types pass wrote it.)
    vine_ladder: { color: 0x4ade80, intensity: 5, distance: 2.5, y: 1.2 },
    // A cave mouth's halo: the cool violet breath of the Biolume
    // Caverns below (its dressing glow accents ride this halo).
    cave_mouth: { color: 0xa855f7, intensity: 8.5, distance: 4.2, y: 1.0 },
    // The way home, inside the cave: same violet family as the mouth.
    cave_exit: { color: 0xa855f7, intensity: 9, distance: 4.5, y: 1.4 },
    // The way DOWN: a deeper violet — the dark below breathes colder.
    cave_descent: { color: 0x7c3aed, intensity: 9, distance: 4.5, y: 0.8 },
    // Ruin interiors (game/world/ruinInterior.ts): the cavern pattern's
    // sibling — one instanced group, built on entry, disposed on
    // exit. Broken-roofed, so the look is dim daylight-leak, not
    // the caverns' permanent dark.
    vine_shaft: { color: 0x34d399, intensity: 8.5, distance: 4.5, y: 2.0 },
    ruin_landmark: { color: 0xa5b4fc, intensity: 5, distance: 3.5, y: 1.2 },
    // Tender husks are DEAD — the faintest bone-pale halo only,
    // so a husk reads in the dark without pretending to glow.
    tender_husk: { color: 0xd6cdb4, intensity: 1.5, distance: 2.5, y: 1.4 },
    bone_fragment: { color: 0xd8cfb8, intensity: 1, distance: 2, y: 0.5 },
    leviathan_ribs: { color: 0xe2dac6, intensity: 2, distance: 4.5, y: 3 },
    fulgurite: { color: 0xfbbf24, intensity: 3.5, distance: 2.5, y: 0.6 },
    petrified_shroom: { color: 0xa8a29e, intensity: 1.2, distance: 2.5, y: 2 },
    ruin_exit: { color: 0x2dd4bf, intensity: 9, distance: 4.5, y: 1.4 },
    precursor_cache: { color: 0x67e8f9, intensity: 5.5, distance: 3, y: 0.8 },
    artifact_heart: { color: 0xfb7185, intensity: 11, distance: 5.5, y: 1.5 },
    // The portal station (Departure D2): a station's violet
    // shine, grand-room scale — the epic note Adam asked the
    // finale's places to carry.
    portal_ring: { color: 0xa78bfa, intensity: 15, distance: 10, y: 2.4 },
    // The Presence (Departure D3): a living green glow, wide
    // and low — the grove itself is the lamp.
    the_presence: { color: 0x84cc16, intensity: 13, distance: 11, y: 2.6 },
    // The Deep BioTunnel (Departure D3): a deep green breath
    // from the throat.
    deep_biotunnel_mouth: { color: 0x4ade80, intensity: 11, distance: 8, y: 1.6 },
    // The Memorial (Departure D4): a warm remembering glow.
    memorial: { color: 0xfbbf24, intensity: 9, distance: 7, y: 1.8 },
    // The Scar (Departure D5): a wrong red light, low and
    // close — it does not so much glow as leak.
    the_scar: { color: 0xdc2645, intensity: 8, distance: 6, y: 0.6 },
    ruin_glyph: { color: 0xa5b4fc, intensity: 6, distance: 3, y: 1.1 },
  };
