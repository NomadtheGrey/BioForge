/**
 * BioForge First-Person 3D WebGL Engine
 * Full 1st-Person Perspective with PointerLockControls, Eye-level camera, and Viewmodel
 * Adheres to CODE_MANIFESTO.md Rules 1-7
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import {
  FloraEntity,
  FloraSpecies,
  FaunaEntity,
  StructureEntity,
  DroppedItemEntity,
  ToolType,
  StructureType,
  HoverTarget,
  ItemId,
} from '../types/game';
import { FirstPersonViewmodel } from './viewmodel';
import { BIOME_TINTS } from './biomes';
import type { BiomeId } from './biomes';
import { cavernCellToWorld, type CavernResult } from './cavern';
import type { RuinResult } from './ruinInterior';
import { createStructureBuilders, type StructureMaterials } from './structureBuilders';
import { createCreatureMeshKit, type CreatureMeshKit } from './creatureMeshes';
import { createLandmarkDressing, type LandmarkDressing } from './landmarkDressing';
import { FATE_STYLES, type WorldFate } from './ruins';

const IRIS_DOOR_TRIGGER_RADIUS = 2.5;
// Structures sit on ROLLING terrain (see terrainHeightAt): floors ride
// this far above their build's datum height so a slab can never dip
// under the surface between slope samples.
const FLOOR_TERRAIN_LIFT = 0.03;
// Two structure anchors within this distance belong to the same build
// for datum purposes: floor tiles are 2 m apart center-to-center, a
// wall anchor sits 1 m from its floor's, and corner-touching tiles
// meet at ~2.83 m.
const STRUCTURE_LINK_DISTANCE = 2.85;

/**
 * The grid-built types that share build datums. Standalone objects —
 * the forge, the cultivation mound, cave mouths, ruin landmarks —
 * are NOT builds: they keep their own ground height and never join
 * (or drag) a neighboring build's datum.
 */
const BUILDING_TYPES: ReadonlySet<string> = new Set([
  'root_tile_floor',
  'chitin_glass_wall',
  'iris_slit_door',
  'spore_canopy',
  'vine_ladder',
  'tamed_snap_trap_turret',
  'lantern_fern_post',
]);

/**
 * One flat DATUM per build (Adam, 2026-10-14: buildings must "line up
 * somehow straight"). Connected building pieces — anchors within link
 * distance, unioned transitively — share a single ground height: the
 * LOWEST anchor height in the group, so nothing floats and uphill
 * pieces settle into the rise like foundations. A lone piece is its
 * own build and keeps its own height; non-building structures always
 * keep theirs. Exported for the harness; the engine recomputes it on
 * every structure sync.
 */
export function computeStructureDatums(
  structures: readonly { id: string; worldX: number; worldZ: number; type: string }[],
  heightAt: (x: number, z: number) => number,
): Map<string, number> {
  const buildings = structures.filter((s) => BUILDING_TYPES.has(s.type));
  const parent = buildings.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  for (let i = 0; i < buildings.length; i++) {
    for (let j = i + 1; j < buildings.length; j++) {
      const a = buildings[i];
      const b = buildings[j];
      if (Math.hypot(a.worldX - b.worldX, a.worldZ - b.worldZ) <= STRUCTURE_LINK_DISTANCE) {
        const ra = find(i);
        const rb = find(j);
        if (ra !== rb) parent[ra] = rb;
      }
    }
  }
  const lowest = new Map<number, number>();
  buildings.forEach((s, i) => {
    const root = find(i);
    const h = heightAt(s.worldX, s.worldZ);
    if (h < (lowest.get(root) ?? Infinity)) lowest.set(root, h);
  });
  const out = new Map<string, number>();
  structures.forEach((s) => out.set(s.id, heightAt(s.worldX, s.worldZ)));
  buildings.forEach((s, i) => out.set(s.id, lowest.get(find(i))!));
  return out;
}
// One story of building: wall posts are 2.4 m tall, so a level-1 piece
// sits exactly one wall-height above its level-0 counterpart. Structure
// levels (StructureEntity.level) multiply this.
const STORY_HEIGHT = 2.4;
// Touch-drag camera sensitivity, in radians per CSS pixel. Mouse
// pointer-lock look uses Three's own 0.002 factor; a finger drag is a
// shorter physical travel for the same turn, so touch gets a larger
// step. The pitch clamp matches PointerLockControls' vertical range.
const TOUCH_LOOK_SENSITIVITY = 0.0056; // raised 2026-10-15 from 0.0042 (a 180° turn took ~750px ≈ two full swipes; now ~560px)
const TOUCH_LOOK_MAX_PITCH = Math.PI / 2;


// Pre-allocated scratch vectors to prevent GC allocations in render loop (Rule 3)
const SCRATCH_VEC_A = new THREE.Vector3();
const SCRATCH_VEC_B = new THREE.Vector3();
const SCRATCH_RAY_ORIGIN = new THREE.Vector3();
const SCRATCH_RAY_DIR = new THREE.Vector3();
const CENTER_SCREEN_UV = new THREE.Vector2(0, 0);
const SCRATCH_LOOK_EULER = new THREE.Euler(0, 0, 0, 'YXZ');

export interface ThreeEngineCallbacks {
  onFloraInteract?: (flora: FloraEntity) => void;
  onFaunaInteract?: (fauna: FaunaEntity) => void;
  onStructureInteract?: (structure: StructureEntity) => void;
  onGroundClick?: (worldX: number, worldZ: number) => void;
  onEntityHover?: (target: HoverTarget) => void;
  onLockChange?: (isLocked: boolean) => void;
  /** Fired when a frame gap says the tab was backgrounded (Adam,
   *  2026-10-15: background return goes to PAUSE MODE). */
  onBackgroundReturn?: () => void;
  onFrame?: (dt: number) => void;
}

// One light-emitting source gathered from live entities each lighting tick.
interface LightSource {
  id: string;
  x: number;
  y: number;
  z: number;
  color: number;
  intensity: number;
  distance: number;
}

interface LightBase {
  color: number;
  intensity: number;
  distance: number;
  y: number;
}

// Weather streak texture (2026-10-15): a thin vertical gradient —
// falling water drawn as lines, not dots.
function makeStreakTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 16;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 64);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(6, 0, 4, 64);
  }
  return new THREE.CanvasTexture(c);
}

// Shared radial-gradient texture for glow sprites (one texture, many sprites).
function makeGlowTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
  }
  return new THREE.CanvasTexture(c);
}

export class BioForgeThreeEngine {
  private container: HTMLElement;
  private scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: PointerLockControls;
  private viewmodel: FirstPersonViewmodel;
  private animFrameId: number = 0;
  private lastTime: number = performance.now();
  private elapsedTime: number = 0;

  // Eye-level height
  public eyeHeight: number = 1.6;

  // Lighting
  private dirLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private ambientLight: THREE.AmbientLight;

  // Groups
  private terrainGroup: THREE.Group = new THREE.Group();
  /** Kept so the ground can be REPAINTED when a zone's biome arrives. */
  private terrainGeometry: THREE.BufferGeometry | null = null;
  /** The current zone's biome (its identity); null = plain quadrant colors. */
  private zoneBiome: BiomeId | null = null;
  // A variant's tint, when the current zone rolled one (biome graph,
  // 2026-10-15): replaces the family tint for as long as it's set.
  private zoneTintOverride: { color: number; strength: number } | null = null;
  // The variant's light trick (Mirror Marsh: reach x2, strength
  // x1.2 — Adam, 2026-10-15), applied where the pool assigns its
  // lights. 1/1 anywhere else.
  private zoneLightDistanceMult = 1;
  private zoneLightIntensityMult = 1;
  private floraGroup: THREE.Group = new THREE.Group();
  private faunaGroup: THREE.Group = new THREE.Group();
  private structuresGroup: THREE.Group = new THREE.Group();
  private droppedItemsGroup: THREE.Group = new THREE.Group();
  private particlesGroup: THREE.Group = new THREE.Group();
  private peerMeshes: Map<string, THREE.Group> = new Map();

  // Instanced caverns (game/cavern.ts): the whole cave is ONE group of
  // instanced meshes, built on entry and disposed on exit. While
  // cavernMode is on, the surface terrain hides, terrain height reads
  // flat 0, and the day/night cycle yields to permanent cave dark.
  private cavernGroup: THREE.Group = new THREE.Group();
  private cavernMode: boolean = false;
  // Instanced ruin interiors (game/ruinInterior.ts): the cavern
  // pattern's sibling — one group of instanced meshes, built on
  // entry, disposed on exit. Ruins are broken-roofed, so their look
  // is dim daylight-leak rather than the caverns' permanent dark.
  private ruinGroup: THREE.Group = new THREE.Group();
  private ruinMode: boolean = false;
  /** Last day/night cycle value seen, so leaving a cave restores it. */
  private lastDayCycle: number = 0.5;

  // Building Preview Ghost
  private ghostGroup: THREE.Group = new THREE.Group();
  private ghostVisible: boolean = false;
  private ghostType: StructureType | null = null;

  // Pooled dynamic lighting: a fixed set of real PointLights fed by
  // grid-merged sources, plus one glow sprite per merged cell.
  private lightPool: THREE.PointLight[] = [];
  private glowSprites: Map<string, THREE.Sprite> = new Map();
  private glowTexture: THREE.Texture | null = null;
  private lastLightUpdate: number = 0;
  private readonly lightPoolSize: number = 12;
  private readonly lightCellSize: number = 4;

  // Base light specs (growth-dynamic species handled in the getters below).
  // Every structure gets a small halo (~2m, enough to see by); ferns shine.
  private floraLightBase: Record<Exclude<FloraSpecies, 'lantern_fern'>, LightBase> = {
    sap_weaver: { color: 0xf59e0b, intensity: 1.5, distance: 7, y: 1.2 },
    petal_mill: { color: 0xec4899, intensity: 0.5, distance: 3.5, y: 1.4 },
    mouth_vine: { color: 0xa3e635, intensity: 0.4, distance: 3, y: 1.0 },
    snap_trap: { color: 0xef4444, intensity: 0.5, distance: 3, y: 0.9 },
    bell_bloom: { color: 0x38bdf8, intensity: 0.6, distance: 4, y: 1.3 },
    ribbon_moss: { color: 0x2dd4bf, intensity: 0.4, distance: 2.5, y: 0.4 },
    echo_reed: { color: 0x2dd4bf, intensity: 0.5, distance: 3.5, y: 1.7 },
    bounce_shroom: { color: 0xa855f7, intensity: 0.6, distance: 3, y: 0.6 },
    glow_spore_cluster: { color: 0x06b6d4, intensity: 0.7, distance: 3.5, y: 0.5 },
    // Cave flora (Biolume Caverns): the fungus is the cave's lamp —
    // its pooled light is what you navigate by down there.
    glow_fungus: { color: 0x22d3ee, intensity: 0.85, distance: 4.5, y: 0.5 },
    sunshard_cluster: { color: 0xf59e0b, intensity: 0.55, distance: 3.5, y: 0.5 },
    prism_cluster: { color: 0xa78bfa, intensity: 0.85, distance: 4.5, y: 0.7 },
    // Fungal Hollow giants (2026-10-15): the senser's tips glow from
    // its full height; the visor's face markings smolder faintly; the
    // shelves barely — woody things, not lamps.
    antenna_shroom: { color: 0x7c3aed, intensity: 0.8, distance: 4.5, y: 2.6 },
    visor_shroom: { color: 0x7e57c2, intensity: 0.45, distance: 3, y: 1.5 },
    shelf_shroom: { color: 0xd9a05b, intensity: 0.25, distance: 2.5, y: 1.6 },
    // Mirror lily (2026-10-15): a low silver gleam on the pool —
    // its reach is the marsh's doing (the zone light multiplier),
    // not the flower's.
    mirror_lily: { color: 0x9fd8d4, intensity: 0.6, distance: 3.5, y: 0.3 },
    // Cinder bloom (2026-10-15): vent-glow — a small coal of light.
    cinder_bloom: { color: 0xff7a2a, intensity: 0.7, distance: 4, y: 0.7 },
    obsidian_bloom: { color: 0x8b5cf6, intensity: 0.5, distance: 3.5, y: 0.8 },
    prism_reed: { color: 0xa8e6e0, intensity: 0.4, distance: 3, y: 0.9 },
    rime_spire: { color: 0xa5d8ff, intensity: 0.4, distance: 3, y: 1.0 },
    heartroot: { color: 0xd9a05b, intensity: 0.35, distance: 2.5, y: 0.5 },
    gravebloom: { color: 0xf0d9a0, intensity: 0.3, distance: 2.5, y: 0.7 },
    stormcatcher: { color: 0xfbbf24, intensity: 0.45, distance: 3, y: 1.6 },
    dusk_grass: { color: 0xa855f7, intensity: 0.3, distance: 2.5, y: 0.5 },
    heartbloom: { color: 0xef4444, intensity: 0.65, distance: 4, y: 0.9 },
    precursor_bloom: { color: 0xf5d76e, intensity: 0.45, distance: 3, y: 0.9 },
    // Flora pipeline wave 1 (creature slice 9, 2026-10-15): ground
    // flora carry small halos like the other low growers — the
    // flame lily burns a little brighter, the ink cap barely at all.
    gulp_lily: { color: 0xfda4af, intensity: 0.35, distance: 2.5, y: 0.3 },
    waygrass: { color: 0x84cc16, intensity: 0.25, distance: 2, y: 0.4 },
    flame_lily: { color: 0xef4444, intensity: 0.55, distance: 3.5, y: 0.8 },
    salt_daisy: { color: 0xf8fafc, intensity: 0.3, distance: 2.5, y: 0.5 },
    compass_cress: { color: 0x67e8f9, intensity: 0.4, distance: 2.5, y: 0.3 },
    ice_grass: { color: 0xa5f3fc, intensity: 0.35, distance: 2.5, y: 0.4 },
    field_cap: { color: 0xd6c48f, intensity: 0.25, distance: 2, y: 0.4 },
    frostcap: { color: 0xe0f2fe, intensity: 0.4, distance: 3, y: 0.7 },
    haycap: { color: 0xeab308, intensity: 0.25, distance: 2, y: 0.3 },
    coal_cap: { color: 0xea580c, intensity: 0.4, distance: 2.5, y: 0.4 },
    snow_morel: { color: 0x78716c, intensity: 0.2, distance: 2, y: 0.3 },
    ink_cap: { color: 0x9ca3af, intensity: 0.2, distance: 2, y: 0.5 },
    // Flora wave 2 (creature slice 10, 2026-10-16): the Bog
    // Lantern and Glowcap are real lamps; the Stormroot's fruit
    // smolders amber; the rest keep ground-flora halos.
    bonemoss: { color: 0x14532d, intensity: 0.2, distance: 2, y: 0.2 },
    listening_fern: { color: 0x4ade80, intensity: 0.3, distance: 2.5, y: 0.6 },
    snowbell: { color: 0xbae6fd, intensity: 0.4, distance: 2.5, y: 0.6 },
    grave_vine: { color: 0xf1f5f9, intensity: 0.25, distance: 2, y: 0.4 },
    saltroot: { color: 0xa5f3fc, intensity: 0.35, distance: 3, y: 0.6 },
    stormroot: { color: 0xfbbf24, intensity: 0.5, distance: 3, y: 0.4 },
    bog_lantern: { color: 0xa3e635, intensity: 0.8, distance: 4.5, y: 0.6 },
    gale_grass: { color: 0xfde68a, intensity: 0.25, distance: 2, y: 0.5 },
    doorstep_rose: { color: 0xfb7185, intensity: 0.3, distance: 2.5, y: 0.4 },
    glyph_vine: { color: 0xa3e635, intensity: 0.35, distance: 2.5, y: 0.7 },
    glowcap: { color: 0x4ade80, intensity: 0.85, distance: 4.5, y: 0.4 },
    ash_puff: { color: 0xd6d3d1, intensity: 0.2, distance: 2, y: 0.2 },
    // Flora wave 3 (creature slice 12, 2026-10-16): the Glass
    // Fern and Stormcap glow from inside; the ivies smolder and
    // rime at ground level; the rest keep ground-flora halos.
    meadow_clover: { color: 0x22c55e, intensity: 0.2, distance: 2, y: 0.2 },
    vent_rose: { color: 0xf43f5e, intensity: 0.45, distance: 3, y: 0.3 },
    stormcap: { color: 0xa78bfa, intensity: 0.5, distance: 3, y: 0.5 },
    anvil_cap: { color: 0x78716c, intensity: 0.2, distance: 2, y: 0.4 },
    glass_fern: { color: 0x67e8f9, intensity: 0.55, distance: 3.5, y: 0.4 },
    forge_bloom: { color: 0xfb923c, intensity: 0.5, distance: 3, y: 0.3 },
    ember_ivy: { color: 0xf97316, intensity: 0.4, distance: 2.5, y: 0.4 },
    frost_ivy: { color: 0xbae6fd, intensity: 0.35, distance: 2.5, y: 0.4 },
    mirror_reed: { color: 0x7dd3fc, intensity: 0.4, distance: 2.5, y: 0.9 },
    rime_grass: { color: 0xe0f2fe, intensity: 0.3, distance: 2, y: 0.3 },
    fang_fern: { color: 0xa5f3fc, intensity: 0.35, distance: 2.5, y: 0.4 },
    mirror_cap: { color: 0x94a3b8, intensity: 0.3, distance: 2.5, y: 0.3 },
    // Flora wave 4 (creature slice 14, 2026-10-16): the fungus
    // bench — crystal citizens glow, the rest keep ground halos.
    meltcap: { color: 0xe9d5ff, intensity: 0.45, distance: 3, y: 0.4 },
    poolcap: { color: 0x6ee7b7, intensity: 0.35, distance: 2.5, y: 0.3 },
    saltcap: { color: 0xa5f3fc, intensity: 0.45, distance: 3, y: 0.4 },
    tomb_cap: { color: 0xd6d3d1, intensity: 0.2, distance: 2, y: 0.3 },
    ring_cap: { color: 0x4ade80, intensity: 0.3, distance: 2.5, y: 0.3 },
    veil_cap: { color: 0xf1f5f9, intensity: 0.3, distance: 2.5, y: 0.5 },
    glass_cap: { color: 0x67e8f9, intensity: 0.55, distance: 3.5, y: 0.4 },
    heart_shelf: { color: 0xb45309, intensity: 0.2, distance: 2, y: 0.8 },
    bone_puff: { color: 0xf5f5f4, intensity: 0.25, distance: 2, y: 0.3 },
    wind_puff: { color: 0xe7e5e4, intensity: 0.25, distance: 2, y: 0.3 },
    door_cap: { color: 0xa3e635, intensity: 0.3, distance: 2.5, y: 0.5 },
    glyph_cap: { color: 0xa3e635, intensity: 0.35, distance: 2.5, y: 0.4 },
    // Flora wave 5 (creature slice 16, 2026-10-16): the rose
    // bench — most keep garden halos; the Amber Bloom glows
    // through its amber, the Charnel heart smolders gold.
    canopy_cup: { color: 0x38bdf8, intensity: 0.3, distance: 2.5, y: 0.7 },
    banner_vine: { color: 0x65a30d, intensity: 0.25, distance: 2, y: 0.6 },
    charnel_bloom: { color: 0xfbbf24, intensity: 0.4, distance: 2.5, y: 0.3 },
    wrongbloom: { color: 0xd8b4fe, intensity: 0.4, distance: 2.5, y: 0.3 },
    tumble_sage: { color: 0xa3a380, intensity: 0.2, distance: 2, y: 0.3 },
    amber_bloom: { color: 0xf59e0b, intensity: 0.5, distance: 3, y: 0.3 },
    silt_rose: { color: 0x9f7a5a, intensity: 0.25, distance: 2, y: 0.3 },
    ghost_orchid: { color: 0xf1f5f9, intensity: 0.35, distance: 2.5, y: 0.5 },
    thaw_rose: { color: 0xfda4af, intensity: 0.35, distance: 2.5, y: 0.3 },
    dust_rose: { color: 0xf5f5f4, intensity: 0.25, distance: 2, y: 0.3 },
    obsidian_rose: { color: 0x57534e, intensity: 0.2, distance: 2, y: 0.3 },
    hedge_rose: { color: 0xe11d48, intensity: 0.3, distance: 2.5, y: 0.4 },
    // Flora wave 6 (creature slice 18, 2026-10-16): the last
    // flora — the Raincatcher hangs its sky-light high, the
    // Smoke Tree's seams glow coal-low, the Maw Bloom lures.
    raincatcher: { color: 0xbae6fd, intensity: 0.4, distance: 3.5, y: 0.8 },
    tending_vine: { color: 0xfde68a, intensity: 0.5, distance: 2.5, y: 0.5 },
    hearthroot: { color: 0xfb923c, intensity: 0.35, distance: 2.5, y: 0.3 },
    puffbell: { color: 0xd8b4fe, intensity: 0.35, distance: 2.5, y: 0.4 },
    arch_tree: { color: 0x92400e, intensity: 0.3, distance: 4, y: 1 },
    smoke_tree: { color: 0xea580c, intensity: 0.5, distance: 3.5, y: 0.5 },
    lightcreep: { color: 0xa3e635, intensity: 0.4, distance: 2.5, y: 0.2 },
    zot_star: { color: 0xfde047, intensity: 0.45, distance: 2.5, y: 0.2 },
    grabvine: { color: 0x4d7c0f, intensity: 0.2, distance: 2, y: 0.2 },
    maw_bloom: { color: 0xbe185d, intensity: 0.4, distance: 3, y: 0.3 },
    quiver_cap: { color: 0xa5f3fc, intensity: 0.4, distance: 2.5, y: 0.3 },
    balloon_vine: { color: 0x86efac, intensity: 0.3, distance: 2.5, y: 0.5 },
    // Flora wave 7 (creature slice 19, 2026-10-16): the
    // Aurora Vine glows like its namesake; the Coalwood keeps
    // a dark halo over a green crown.
    noonflower: { color: 0xfacc15, intensity: 0.35, distance: 2.5, y: 0.5 },
    lambswool: { color: 0xfef9c3, intensity: 0.2, distance: 2, y: 0.2 },
    spore_fern: { color: 0x4ade80, intensity: 0.3, distance: 2.5, y: 0.3 },
    coalwood: { color: 0x44403c, intensity: 0.25, distance: 3, y: 0.8 },
    aurora_vine: { color: 0x6ee7b7, intensity: 0.55, distance: 3, y: 0.4 },
    bridge_moss: { color: 0x84cc16, intensity: 0.2, distance: 2, y: 0.2 },
    canopy_orchid: { color: 0xf0abfc, intensity: 0.4, distance: 2.5, y: 0.5 },
    rib_grass: { color: 0xa3a380, intensity: 0.2, distance: 2, y: 0.3 },
    kite_flower: { color: 0x7dd3fc, intensity: 0.3, distance: 2.5, y: 0.6 },
    guest_flower: { color: 0xfda4af, intensity: 0.3, distance: 2, y: 0.2 },
    clock_bloom: { color: 0xc4b5fd, intensity: 0.35, distance: 2.5, y: 0.4 },
    roadweed: { color: 0x65a30d, intensity: 0.2, distance: 2, y: 0.2 },
    // Flora wave 8 (creature slice 21, 2026-10-16): the
    // fungus bench — the Static Cap crackles yellow; the
    // Hearth Cap keeps hearth-warmth.
    bog_jelly: { color: 0xf59e0b, intensity: 0.3, distance: 2, y: 0.2 },
    reed_rust: { color: 0xea580c, intensity: 0.25, distance: 2, y: 0.3 },
    salt_jelly: { color: 0xe0f2fe, intensity: 0.3, distance: 2, y: 0.2 },
    ice_shelf: { color: 0xbae6fd, intensity: 0.3, distance: 2.5, y: 0.4 },
    root_cup: { color: 0x38bdf8, intensity: 0.3, distance: 2, y: 0.2 },
    marrow_mold: { color: 0x44403c, intensity: 0.2, distance: 2, y: 0.2 },
    static_cap: { color: 0xfde047, intensity: 0.45, distance: 2.5, y: 0.3 },
    hearth_cap: { color: 0xfb923c, intensity: 0.4, distance: 2.5, y: 0.3 },
    bed_cap: { color: 0xa3a380, intensity: 0.25, distance: 2, y: 0.3 },
    path_puff: { color: 0xe7e5e4, intensity: 0.2, distance: 2, y: 0.2 },
    dew_mold: { color: 0xe2e8f0, intensity: 0.3, distance: 2, y: 0.2 },
    scar_cap: { color: 0xdc2626, intensity: 0.4, distance: 2.5, y: 0.2 },
    // Flora wave 9 (creature slice 23, 2026-10-16): fungus
    // bench II — the Gloom Cap lights from below; the Song
    // Cap keeps a shore-light.
    drift_mold: { color: 0xa8a29e, intensity: 0.2, distance: 2, y: 0.2 },
    glass_mold: { color: 0x365314, intensity: 0.25, distance: 2, y: 0.2 },
    strike_cap: { color: 0xd6d3d1, intensity: 0.3, distance: 2, y: 0.3 },
    dune_cap: { color: 0xd97706, intensity: 0.25, distance: 2, y: 0.3 },
    basin_puff: { color: 0xbae6fd, intensity: 0.3, distance: 2, y: 0.3 },
    thaw_jelly: { color: 0xa5f3fc, intensity: 0.35, distance: 2, y: 0.2 },
    prism_cap: { color: 0x67e8f9, intensity: 0.5, distance: 2.5, y: 0.3 },
    still_cap: { color: 0xe2e8f0, intensity: 0.3, distance: 2, y: 0.3 },
    fang_shelf: { color: 0xcbd5e1, intensity: 0.25, distance: 2, y: 0.4 },
    song_cap: { color: 0x93c5fd, intensity: 0.4, distance: 2.5, y: 0.3 },
    canopy_cap: { color: 0xfbbf24, intensity: 0.35, distance: 2, y: 0.3 },
    gloom_cap: { color: 0x60a5fa, intensity: 0.5, distance: 2.5, y: 0.2 },
    // Flora wave 10 (creature slice 25, 2026-10-16): the cap
    // bench — kitchens keep low, warm lights.
    fall_shelf: { color: 0xa16207, intensity: 0.25, distance: 2, y: 0.4 },
    row_cap: { color: 0xa3e635, intensity: 0.3, distance: 2, y: 0.3 },
    wild_cap: { color: 0x65a30d, intensity: 0.3, distance: 2, y: 0.3 },
    dust_cap: { color: 0xe7e5e4, intensity: 0.25, distance: 2, y: 0.3 },
    marrow_cap: { color: 0xfef3c7, intensity: 0.3, distance: 2, y: 0.3 },
    rib_cap: { color: 0xfde68a, intensity: 0.3, distance: 2, y: 0.3 },
    scald_cap: { color: 0xfb923c, intensity: 0.4, distance: 2, y: 0.3 },
    compost_cap: { color: 0x57534e, intensity: 0.2, distance: 2, y: 0.3 },
    brine_cap: { color: 0xa5f3fc, intensity: 0.35, distance: 2, y: 0.3 },
    iron_cap: { color: 0x78716c, intensity: 0.3, distance: 2, y: 0.3 },
    hedge_cap: { color: 0x4d7c0f, intensity: 0.25, distance: 2, y: 0.3 },
    sun_cap: { color: 0xfde047, intensity: 0.45, distance: 2.5, y: 0.3 },
    // Flora wave 11 (creature slice 26, 2026-10-16): the
    // fungus tail — the Dark Cap keeps the faintest gill-glow.
    mist_cap: { color: 0xe2e8f0, intensity: 0.3, distance: 2, y: 0.3 },
    tool_cap: { color: 0xfbbf24, intensity: 0.3, distance: 2, y: 0.3 },
    sail_cap: { color: 0xf0f9ff, intensity: 0.3, distance: 2, y: 0.4 },
    night_cap: { color: 0x312e81, intensity: 0.35, distance: 2, y: 0.3 },
    storm_mold: { color: 0x6b7c5e, intensity: 0.2, distance: 2, y: 0.2 },
    dark_cap: { color: 0x60a5fa, intensity: 0.35, distance: 2, y: 0.25 },
    husk_cap: { color: 0xd6d3d1, intensity: 0.25, distance: 2, y: 0.3 },
    shell_cap: { color: 0xfde68a, intensity: 0.3, distance: 2, y: 0.3 },
    trail_cap: { color: 0xa16207, intensity: 0.3, distance: 2.5, y: 0.4 },
    sweet_cap: { color: 0xf59e0b, intensity: 0.4, distance: 2, y: 0.3 },
    great_puff: { color: 0xf8fafc, intensity: 0.3, distance: 2.5, y: 0.5 },
    rust_cap: { color: 0xb91c1c, intensity: 0.3, distance: 2, y: 0.3 },
  };
  private structureLightBase: Record<Exclude<StructureType, 'lantern_fern_post'>, LightBase> = {
    root_tile_floor: { color: 0x4ade80, intensity: 0.45, distance: 2.2, y: 0.5 },
    chitin_glass_wall: { color: 0x67e8f9, intensity: 0.55, distance: 2.5, y: 1.2 },
    iris_slit_door: { color: 0xf0abfc, intensity: 0.55, distance: 2.5, y: 1.2 },
    spore_canopy: { color: 0xa78bfa, intensity: 0.9, distance: 3.5, y: 2.6 },
    bio_forge_station: { color: 0x22d3ee, intensity: 0.9, distance: 3.5, y: 1.4 },
    tamed_snap_trap_turret: { color: 0xef4444, intensity: 0.7, distance: 3, y: 1.1 },
    cultivation_mound: { color: 0x4ade80, intensity: 0.45, distance: 2.2, y: 0.6 },
    // The storage pod's amber seam breathes a low, warm halo.
    storage_pod: { color: 0xf59e0b, intensity: 0.5, distance: 2.4, y: 0.8 },
    culture_vat: { color: 0x34d399, intensity: 0.65, distance: 3.4, y: 1.0 },
    // The living ladder drinks light all day and gives a little
    // back at dusk — a soft leaf-green halo at climbing height.
    // (This entry was one of the two the pre-2026-10-15 type union
    // demanded but nobody had written; the types pass wrote it.)
    vine_ladder: { color: 0x4ade80, intensity: 0.5, distance: 2.5, y: 1.2 },
    // A cave mouth's halo: the cool violet breath of the Biolume
    // Caverns below (its dressing glow accents ride this halo).
    cave_mouth: { color: 0xa855f7, intensity: 0.85, distance: 4.2, y: 1.0 },
    // The way home, inside the cave: same violet family as the mouth.
    cave_exit: { color: 0xa855f7, intensity: 0.9, distance: 4.5, y: 1.4 },
    // The way DOWN: a deeper violet — the dark below breathes colder.
    cave_descent: { color: 0x7c3aed, intensity: 0.9, distance: 4.5, y: 0.8 },
    // Ruin interiors (game/ruinInterior.ts): the cavern pattern's
    // sibling — one instanced group, built on entry, disposed on
    // exit. Broken-roofed, so the look is dim daylight-leak, not
    // the caverns' permanent dark.
    vine_shaft: { color: 0x34d399, intensity: 0.85, distance: 4.5, y: 2.0 },
    ruin_landmark: { color: 0xa5b4fc, intensity: 0.5, distance: 3.5, y: 1.2 },
    // Tender husks are DEAD — the faintest bone-pale halo only,
    // so a husk reads in the dark without pretending to glow.
    tender_husk: { color: 0xd6cdb4, intensity: 0.15, distance: 2.5, y: 1.4 },
    bone_fragment: { color: 0xd8cfb8, intensity: 0.1, distance: 2, y: 0.5 },
    leviathan_ribs: { color: 0xe2dac6, intensity: 0.2, distance: 4.5, y: 3 },
    fulgurite: { color: 0xfbbf24, intensity: 0.35, distance: 2.5, y: 0.6 },
    petrified_shroom: { color: 0xa8a29e, intensity: 0.12, distance: 2.5, y: 2 },
    ruin_exit: { color: 0x2dd4bf, intensity: 0.9, distance: 4.5, y: 1.4 },
    precursor_cache: { color: 0x67e8f9, intensity: 0.55, distance: 3, y: 0.8 },
    artifact_heart: { color: 0xfb7185, intensity: 1.1, distance: 5.5, y: 1.5 },
    ruin_glyph: { color: 0xa5b4fc, intensity: 0.6, distance: 3, y: 1.1 },
  };

  // Raycasting
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // High-frequency throttling & proximity cache
  private reticleTimer: number = 0;
  private sporeFrameCount: number = 0;
  private cachedPlayerX: number = 0;

  /** Left-hand lantern: when true, updateLighting adds a generous
   * player-carried light source (the held Hand Lantern-Fern). */
  private heldLightActive: boolean = false;

  /** App drives this from PlayerState.heldItemId: a lantern in the
   * left hand lights the way like a torch, surface or cave. */
  public setHeldLight(active: boolean): void {
    this.heldLightActive = active;
  }
  private cachedPlayerZ: number = 0;

  // Spore particles
  private sporeParticles: THREE.Points | null = null;
  // Weather (2026-10-15): ONE particle field whose behavior is set
  // per zone (game/zones.ts zoneWeatherAt resolves the sky; App
  // calls setWeather on zone change). The field rides a group that
  // follows the camera, and particles wrap inside a local box, so
  // the weather is endless in every direction. Hidden indoors:
  // cavernMode / ruinMode gate visibility in the frame update.
  private weatherPoints: THREE.Points | null = null;
  private weatherGroup: THREE.Group = new THREE.Group();
  private weatherMode: 'none' | 'rain' | 'uprain' | 'snow' | 'ash' = 'none';
  private weatherIntensity = 1;
  private weatherSeed: Float32Array | null = null; // per-particle speed/sway jitter
  private transientParticles: { mesh: THREE.Points | THREE.Mesh; life: number; maxLife: number; vel: THREE.Vector3 }[] = [];

  // Entity mesh maps
  private floraMeshMap: Map<string, THREE.Group> = new Map();
  private faunaMeshMap: Map<string, THREE.Group> = new Map();
  // Last dissolve-fizz emission per fauna id (updateDissolveFizz).
  private dissolveFizzAt: Map<string, number> = new Map();
  // Idle-life wiggle state lives in the creature mesh kit
  // (game/creatureMeshes.ts); lastFaunaSyncMs times the wiggle's dt.
  private lastFaunaSyncMs = 0;
  private structureMeshMap: Map<string, THREE.Group> = new Map();
  // Per-structure mesh builders (registry replacing the createStructureMesh switch).
  // Arrow functions read this.materials lazily at build time, so field-init order is safe.
  // The type -> builder record lives in game/structureBuilders.ts
  // (extracted 2026-10-14 — this file had hit the push ceiling).
  // Assigned in the constructor once the shared materials exist.
  private structureBuilders: Record<StructureType, () => THREE.Group>;
  // Mesh factories over the shared materials (extracted 2026-10-14):
  // creatures/flora in game/creatureMeshes.ts, cave + ruin dressing
  // in game/landmarkDressing.ts. Assigned in the constructor.
  private creatureKit: CreatureMeshKit;
  private landmarkDressing: LandmarkDressing;
  private droppedItemMeshMap: Map<string, THREE.Group> = new Map();

  // Callbacks
  public callbacks: ThreeEngineCallbacks = {};

  // Shared Materials (the palette type lives with the builders
  // that consume it: game/structureBuilders.ts StructureMaterials)
  private materials: StructureMaterials;

  constructor(container: HTMLElement, callbacks: ThreeEngineCallbacks = {}) {
    this.container = container;
    this.callbacks = callbacks;
    this.lastTime = performance.now();
    this.elapsedTime = 0;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0c16);
    this.scene.fog = new THREE.FogExp2(0x0e1326, 0.018);

    // 1st-Person Camera (72 deg FOV for immersive view)
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(72, width / height, 0.1, 200);
    this.camera.position.set(0, this.eyeHeight, 0);

    // PointerLockControls
    this.controls = new PointerLockControls(this.camera, container);
    this.setupPointerLockListeners();

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    container.appendChild(this.renderer.domElement);

    // First-Person Viewmodel (Attached directly to Camera)
    this.viewmodel = new FirstPersonViewmodel();
    this.camera.add(this.viewmodel.root);
    this.scene.add(this.camera);

    // Shared Materials
    this.materials = {
      porcelainWhite: new THREE.MeshStandardMaterial({
        color: 0xf3f4f6,
        roughness: 0.2,
        metalness: 0.1,
      }),
      chitinGlass: new THREE.MeshPhysicalMaterial({
        color: 0x38bdf8,
        transparent: true,
        opacity: 0.65,
        roughness: 0.1,
        transmission: 0.6,
        ior: 1.45,
      }),
      biolumCyan: new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
      biolumAmber: new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xf59e0b,
        emissiveIntensity: 0.8,
        roughness: 0.3,
      }),
      biolumPink: new THREE.MeshStandardMaterial({
        color: 0xec4899,
        emissive: 0xec4899,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
      biolumViolet: new THREE.MeshStandardMaterial({
        color: 0xa855f7,
        emissive: 0xa855f7,
        emissiveIntensity: 0.85,
        roughness: 0.3,
      }),
      woodRoot: new THREE.MeshStandardMaterial({
        color: 0x1e3a34,
        roughness: 0.7,
        metalness: 0.05,
      }),
      ghostValid: new THREE.MeshBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
      ghostInvalid: new THREE.MeshBasicMaterial({
        color: 0xef4444,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
    };
    // The builders record is a factory over these shared materials
    // (game/structureBuilders.ts) — built once, here, where they exist.
    this.structureBuilders = createStructureBuilders(this.materials);
    this.creatureKit = createCreatureMeshKit(this.materials, (x, z) => this.terrainHeightAt(x, z));
    this.landmarkDressing = createLandmarkDressing(this.materials);

    // Lights
    this.ambientLight = new THREE.AmbientLight(0x2d3748, 1.2);
    this.scene.add(this.ambientLight);

    this.hemiLight = new THREE.HemisphereLight(0x818cf8, 0x1e1b4b, 0.8);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfef08a, 1.4);
    this.dirLight.position.set(30, 45, 25);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 2048;
    this.dirLight.shadow.mapSize.height = 2048;
    this.scene.add(this.dirLight);

    // Scene Groups
    this.scene.add(this.terrainGroup);
    this.scene.add(this.structuresGroup);
    this.scene.add(this.floraGroup);
    this.scene.add(this.faunaGroup);
    this.scene.add(this.droppedItemsGroup);
    this.scene.add(this.particlesGroup);
    this.scene.add(this.ghostGroup);
    this.cavernGroup.visible = false;
    this.scene.add(this.cavernGroup);
    this.ruinGroup.visible = false;
    this.scene.add(this.ruinGroup);

    // World Elements
    this.buildTerrain();
    this.buildSporeSystem();
    this.setupGhostHologram();
    this.initLighting();

    // Event listeners
    this.initEventListeners();

    // Start loop
    this.animate();
  }

  // --------------------------------------------------------------------------
  // PointerLock Controls & Handlers
  // --------------------------------------------------------------------------
  private setupPointerLockListeners() {
    this.controls.addEventListener('lock', () => {
      this.callbacks.onLockChange?.(true);
    });

    this.controls.addEventListener('unlock', () => {
      this.callbacks.onLockChange?.(false);
    });
  }

  /**
   * Pointer lock exists only on fine-pointer (mouse) setups — touch
   * browsers never engage it, and the game must still run there
   * (Adam, 2026-10-14: the game wouldn't START on a phone, because
   * every tap was being swallowed into a lock request that could
   * never succeed). One availability check, shared by the lock
   * request and the click routing below.
   */
  private pointerLockAvailable(): boolean {
    if (!('requestPointerLock' in HTMLElement.prototype)) return false;
    return !(typeof window !== 'undefined' && window.matchMedia?.('(pointer: coarse)').matches);
  }

  public requestPointerLock() {
    if (this.controls.isLocked) return;
    if (!this.pointerLockAvailable()) return;
    this.controls.lock();
  }

  public unlockPointer() {
    if (!this.controls.isLocked) return;
    this.controls.unlock();
  }

  public isPointerLocked(): boolean {
    return this.controls.isLocked;
  }

  /**
   * Rotate the first-person camera from a touch drag.
   *
   * PointerLockControls only consumes mouse movement while locked,
   * so touch look writes the SAME YXZ yaw/pitch representation into
   * the camera quaternion. That keeps the movement controller,
   * minimap facing, placement rotation, and a later desktop mouse
   * lock all reading one continuous orientation — there is no second
   * touch-only camera state to reconcile.
   */
  public applyTouchLook(deltaX: number, deltaY: number): void {
    if (!Number.isFinite(deltaX) || !Number.isFinite(deltaY)) return;
    SCRATCH_LOOK_EULER.setFromQuaternion(this.camera.quaternion, 'YXZ');
    SCRATCH_LOOK_EULER.y -= deltaX * TOUCH_LOOK_SENSITIVITY;
    SCRATCH_LOOK_EULER.x -= deltaY * TOUCH_LOOK_SENSITIVITY;
    SCRATCH_LOOK_EULER.x = Math.max(
      -TOUCH_LOOK_MAX_PITCH,
      Math.min(TOUCH_LOOK_MAX_PITCH, SCRATCH_LOOK_EULER.x)
    );
    SCRATCH_LOOK_EULER.z = 0;
    this.camera.quaternion.setFromEuler(SCRATCH_LOOK_EULER);
  }

  /**
   * Deliberate touch interaction: the TouchControls overlay calls
   * this for a short tap or its USE button. It deliberately funnels
   * through the exact center-screen raycast desktop clicks use, so
   * flora/fauna/structure/ground priority cannot drift by platform.
   */
  public interactAtCenter(): void {
    this.handleCenterClick();
  }

  public setPlayerPosition(x: number, z: number, level: number = 0, jumpOffset: number = 0) {
    this.cachedPlayerX = x;
    this.cachedPlayerZ = z;
    this.camera.position.x = x;
    this.camera.position.z = z;
    // The player STANDS on the rolling terrain: eye height rides the
    // ground, so crossing a rise lifts the view instead of wading
    // through the hill (structures/floors got the same treatment).
    // Story levels add a wall-height per floor above the ground.
    // jumpOffset is the jump arc (App's cosmetic Y over the level
    // model): while airborne the camera rides it, landing returns to 0.
    this.camera.position.y = this.eyeHeight + this.terrainHeightAt(x, z) + level * STORY_HEIGHT + jumpOffset;
    this.updateIrisDoorsProximity(x, z);
    this.updateVatLife();
    this.updateDissolveFizz();
  }

  public getForwardVector(out: THREE.Vector3): THREE.Vector3 {
    this.camera.getWorldDirection(out);
    out.y = 0;
    out.normalize();
    return out;
  }

  public getRightVector(out: THREE.Vector3): THREE.Vector3 {
    this.getForwardVector(out);
    out.cross(new THREE.Vector3(0, 1, 0)).normalize().negate();
    return out;
  }

  public setViewmodelTool(tool: ToolType) {
    this.viewmodel.setTool(tool);
  }

  /** The striker hand re-grows around the drawn weapon
   *  (weapons build, 2026-10-16): App calls this whenever the
   *  slot's draw changes. */
  public setStrikerWeapon(weaponId: ItemId) {
    this.viewmodel.setStriker(weaponId);
  }

  public setViewmodelBlueprint(blueprint: StructureType) {
    this.viewmodel.setBlueprint(blueprint);
  }

  public triggerToolAnimation() {
    this.viewmodel.triggerAction();
  }

  // --------------------------------------------------------------------------
  // Terrain & Atmosphere
  // --------------------------------------------------------------------------
  /**
   * The terrain's height at a point — the SAME closed-form rolling
   * ground the terrain mesh is built from (two gentle sine waves,
   * ±0.7 m). Anything that must sit ON the ground samples this instead
   * of assuming y=0: at y=0 a 12 cm floor slab is swallowed whole
   * wherever a rise exceeds it (Adam's invisible-floors bug, 2026-10-14).
   */
  private terrainHeightAt(x: number, z: number): number {
    // Inside an instanced cavern the floor is FLAT: the surface's
    // rolling field belongs to a world that isn't rendered here, and
    // sampling it would bob the camera over invisible hills.
    // Ruin interiors are flat-floored instances for the same reason.
    if (this.cavernMode || this.ruinMode) return 0;
    return (
      Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.45 +
      Math.sin(x * 0.18 + z * 0.12) * 0.25
    );
  }

  // The current build datums (see computeStructureDatums): recomputed
  // on every structure sync, keyed by structure id, with a cell index
  // so the entity-less placement ghost can find its build.
  private structureDatums: Map<string, number> = new Map();
  private structureDatumCells: Map<string, number> = new Map();

  /**
   * Seat a structure (or its placement ghost) on its build's DATUM:
   * one flat ground height shared by every connected piece, all of
   * them plumb. (Until 2026-10-14 ground floors TILTED to the local
   * slope — Adam reversed that call in game: individually tilted
   * slabs fanned against straight walls and nothing lined up. The
   * land keeps its roll; buildings now level themselves.)
   */
  private applyTerrainTransform(
    mesh: THREE.Group,
    type: StructureType,
    worldX: number,
    worldZ: number,
    rotation: number,
    level: number = 0
  ): void {
    const entityId = (mesh.userData?.entity as StructureEntity | undefined)?.id;
    let datum = entityId ? this.structureDatums.get(entityId) : undefined;
    if (datum === undefined) {
      // No entity (the placement ghost): borrow the datum of any
      // build in the touched cells, taken with this spot's own height
      // — the placed piece joins that build and the shared datum
      // becomes the lower of the two, so the preview tells the truth.
      let best: number | undefined;
      for (let dx = -1; dx <= 1; dx++) {
        for (let dz = -1; dz <= 1; dz++) {
          const d = this.structureDatumCells.get(`${Math.round(worldX / 2) + dx},${Math.round(worldZ / 2) + dz}`);
          if (d !== undefined && (best === undefined || d < best)) best = d;
        }
      }
      if (best !== undefined) datum = Math.min(best, this.terrainHeightAt(worldX, worldZ));
    }
    // Story levels stack on the datum: a level-1 wall stands where a
    // level-0 wall's top ends, whatever the ground does below.
    const groundY = (datum ?? this.terrainHeightAt(worldX, worldZ)) + level * STORY_HEIGHT;
    const lift = type === 'root_tile_floor' ? FLOOR_TERRAIN_LIFT : 0;
    mesh.position.set(worldX, groundY + lift, worldZ);
    mesh.rotation.set(0, rotation, 0);
  }

  private buildTerrain() {
    const size = 120;
    const segments = 80;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      positions.setY(i, this.terrainHeightAt(positions.getX(i), positions.getZ(i)));
    }

    // Colors live in paintTerrainColors so the ground can be repainted
    // when a zone (and its biome) arrives — see setZoneBiome.
    this.terrainGeometry = geometry;
    this.paintTerrainColors();
    geometry.computeVertexNormals();

    const terrainMaterial = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.85,
      metalness: 0.05,
    });

    const terrainMesh = new THREE.Mesh(geometry, terrainMaterial);
    terrainMesh.receiveShadow = true;
    terrainMesh.name = 'ground';
    this.terrainGroup.add(terrainMesh);

    const gridHelper = new THREE.GridHelper(100, 50, 0x38bdf8, 0x1e293b);
    gridHelper.position.y = 0.02;
    (gridHelper.material as THREE.Material).transparent = true;
    (gridHelper.material as THREE.Material).opacity = 0.18;
    this.terrainGroup.add(gridHelper);
  }

  /**
   * Tell the engine which zone it's showing, by biome. A zone has ONE
   * biome — its identity — so the tint is a single even blend across
   * the whole map, never patches. Called by App when a world is
   * created or loaded. Pass null for a pre-seed world (or no world):
   * the ground keeps its plain quadrant colors.
   */
  public setZoneBiome(biome: BiomeId | null, tintOverride: { color: number; strength: number } | null = null, light: { distanceMult: number; intensityMult: number } | null = null): void {
    const distMult = light?.distanceMult ?? 1;
    const intMult = light?.intensityMult ?? 1;
    if (this.zoneBiome === biome && this.zoneTintOverride === tintOverride
      && this.zoneLightDistanceMult === distMult && this.zoneLightIntensityMult === intMult) return;
    this.zoneBiome = biome;
    this.zoneTintOverride = tintOverride;
    this.zoneLightDistanceMult = distMult;
    this.zoneLightIntensityMult = intMult;
    this.paintTerrainColors();
  }

  /** Set the sky (2026-10-15): mode + intensity from the zone
   *  resolver. Material character is per mode — rain and its
   *  rising twin draw as streaks; snow and ash as soft motes. */
  public setWeather(mode: 'none' | 'rain' | 'uprain' | 'snow' | 'ash', intensity: number): void {
    if (mode === this.weatherMode && intensity === this.weatherIntensity && this.weatherPoints) return;
    this.weatherMode = mode;
    this.weatherIntensity = intensity;
    if (!this.weatherPoints) this.buildWeatherField();
    if (!this.weatherPoints) return;
    const mat = this.weatherPoints.material as THREE.PointsMaterial;
    const COUNT = 750;
    this.weatherPoints.geometry.setDrawRange(0, Math.max(0, Math.min(COUNT, Math.round(COUNT * intensity))));
    switch (mode) {
      case 'rain':
        mat.map = makeStreakTexture(); mat.color.set(0x9db8d9); mat.size = 1.15; mat.opacity = 0.55; break;
      case 'uprain':
        mat.map = makeStreakTexture(); mat.color.set(0xa5f3fc); mat.size = 1.05; mat.opacity = 0.6; break;
      case 'snow':
        mat.map = makeGlowTexture(); mat.color.set(0xffffff); mat.size = 0.34; mat.opacity = 0.9; break;
      case 'ash':
        mat.map = makeGlowTexture(); mat.color.set(0xb8b0a4); mat.size = 0.3; mat.opacity = 0.7; break;
      default: break;
    }
    mat.needsUpdate = true;
    this.weatherPoints.visible = mode !== 'none';
  }

  /** Build the weather field once: particles fill a local box
   *  (56 wide, 26 tall); the group follows the camera and local
   *  wrapping keeps the sky endless. */
  private buildWeatherField(): void {
    const COUNT = 750;
    const positions = new Float32Array(COUNT * 3);
    this.weatherSeed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 56;
      positions[i * 3 + 1] = Math.random() * 26;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 56;
      this.weatherSeed[i] = Math.random();
    }
    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 1,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.weatherPoints = new THREE.Points(geom, mat);
    this.weatherPoints.visible = false;
    this.weatherPoints.frustumCulled = false;
    this.weatherGroup.add(this.weatherPoints);
    this.scene.add(this.weatherGroup);
  }

  /** Per-frame weather motion: velocity is the mode's signature
   *  (rain fast down, the Skyfall's rain slow UP, snow and ash
   *  drifting). Runs only when a sky is set; gates itself off
   *  inside caves and ruins. */
  private updateWeather(delta: number): void {
    if (!this.weatherPoints || this.weatherMode === 'none' || !this.weatherSeed) return;
    const indoors = this.cavernMode || this.ruinMode;
    this.weatherPoints.visible = !indoors;
    if (indoors) return;
    // The field follows the player: group rides the camera's x/z,
    // particles wrap locally, so the sky never runs out.
    this.weatherGroup.position.set(this.camera.position.x, 0, this.camera.position.z);
    const vy = this.weatherMode === 'rain' ? -23 : this.weatherMode === 'uprain' ? 8.5 : this.weatherMode === 'snow' ? -1.7 : -2.8;
    const positions = this.weatherPoints.geometry.attributes.position as THREE.BufferAttribute;
    const count = positions.count;
    for (let i = 0; i < count; i++) {
      const jitter = 0.7 + this.weatherSeed[i] * 0.6;
      let x = positions.getX(i);
      let y = positions.getY(i) + vy * jitter * delta;
      let z = positions.getZ(i);
      if (this.weatherMode === 'snow' || this.weatherMode === 'ash') {
        x += Math.sin(this.elapsedTime * 0.9 + i * 1.7) * 0.55 * delta;
        z += Math.cos(this.elapsedTime * 0.7 + i * 1.3) * 0.55 * delta;
      } else {
        x -= 1.6 * delta; // weather leans slightly west, rain and uprain alike
      }
      if (y < 0) y += 26;
      if (y > 26) y -= 26;
      if (x > 28) x -= 56;
      if (x < -28) x += 56;
      if (z > 28) z -= 56;
      if (z < -28) z += 56;
      positions.setXYZ(i, x, y, z);
    }
    positions.needsUpdate = true;
  }

  /**
   * (Re)compute the terrain's vertex colors. Base color comes from the
   * QUADRANT (the survey's sector shading), then the zone's biome tint
   * (game/biomes.ts BIOME_TINTS) blends evenly over it, then the pale
   * path tint around spawn applies last, as before. Repaints happen on
   * world load only, never per frame.
   */
  private paintTerrainColors(): void {
    const geometry = this.terrainGeometry;
    if (!geometry) return;
    const positions = geometry.attributes.position;
    const colors: number[] = [];

    const cViolet = new THREE.Color(0x1e122b);
    const cTurquoise = new THREE.Color(0x0e2c2c);
    const cAmber = new THREE.Color(0x2a1a08);
    const cPrismatic = new THREE.Color(0x191838);
    const cPath = new THREE.Color(0x273549);
    const tint = this.zoneTintOverride ?? (this.zoneBiome ? BIOME_TINTS[this.zoneBiome] : null);
    const tintColor = tint ? new THREE.Color(tint.color) : null;

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);

      const col = new THREE.Color();
      if (vx <= 0 && vz <= 0) {
        col.copy(cViolet);
      }
      if (vx > 0 && vz <= 0) {
        col.copy(cTurquoise);
      }
      if (vx <= 0 && vz > 0) {
        col.copy(cAmber);
      }
      if (vx > 0 && vz > 0) {
        col.copy(cPrismatic);
      }

      if (tint && tintColor) {
        col.lerp(tintColor, tint.strength);
      }

      const distFromCenter = Math.hypot(vx, vz);
      if (distFromCenter < 12) {
        col.lerp(cPath, ((12 - distFromCenter) / 12) * 0.4);
      }

      colors.push(col.r, col.g, col.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  }

  private buildSporeSystem() {
    const sporeCount = 450;
    const geom = new THREE.BufferGeometry();
    const positions = new Float32Array(sporeCount * 3);
    const colors = new Float32Array(sporeCount * 3);

    const sporeColors = [
      new THREE.Color(0x06b6d4),
      new THREE.Color(0xa855f7),
      new THREE.Color(0xf59e0b),
      new THREE.Color(0x10b981),
    ];

    for (let i = 0; i < sporeCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 80;
      positions[i * 3 + 1] = Math.random() * 8 + 0.5;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 80;

      const c = sporeColors[Math.floor(Math.random() * sporeColors.length)];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: 0.28,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
    });

    this.sporeParticles = new THREE.Points(geom, mat);
    this.particlesGroup.add(this.sporeParticles);
  }

  // --------------------------------------------------------------------------
  // Multiplayer Peer Avatars
  // --------------------------------------------------------------------------
  public updatePeerAvatar(peerId: string, name: string, x: number, z: number, rotation: number, colorHex: string, level: number = 0) {
    let peerGroup = this.peerMeshes.get(peerId);
    if (!peerGroup) {
      peerGroup = new THREE.Group();
      const peerMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(colorHex),
        roughness: 0.3,
      });
      const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.7, 8, 16), peerMat);
      torso.position.y = 0.95;
      peerGroup.add(torso);

      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), this.materials.biolumPink);
      visor.position.set(0, 1.45, 0.12);
      peerGroup.add(visor);

      const light = new THREE.PointLight(new THREE.Color(colorHex), 1.2, 5);
      light.position.set(0, 1.2, 0);
      peerGroup.add(light);

      this.scene.add(peerGroup);
      this.peerMeshes.set(peerId, peerGroup);
    }

    peerGroup.position.set(x, this.terrainHeightAt(x, z) + level * STORY_HEIGHT, z);
    peerGroup.rotation.y = rotation;
  }

  public removePeerAvatar(peerId: string) {
    const peerGroup = this.peerMeshes.get(peerId);
    if (!peerGroup) return;
    this.scene.remove(peerGroup);
    this.peerMeshes.delete(peerId);
  }

  // --------------------------------------------------------------------------
  // Procedural Flora Meshes
  // --------------------------------------------------------------------------
  // ------------------------------------------------------------------------
  // The mesh-binding invariant (Adam's recurring creature mixup)
  // ------------------------------------------------------------------------
  // Entity ids are PER-WORLD: 'fauna_3' can be a soft puff in one
  // world and a chitin stalker in the next, and loading a save swaps
  // the whole entity list in a single frame. A mesh keyed by id alone
  // therefore outlives the creature it was built for — the puff walks
  // around in the stalker's body (the mixup that kept coming back).
  // The structural rule: a mesh is bound to (id, KIND) — the species
  // or type it was built from — and EVERY sync re-validates the
  // binding through this one helper. If the entity behind an id
  // changed kind, the stale mesh is disposed and rebuilt from the
  // live entity. All three sync loops (flora, fauna, structures)
  // come through here, so the rule can't be fixed in one loop and
  // forgotten in another.
  private ensureBoundMesh<E extends { id: string }>(
    map: Map<string, THREE.Group>,
    group: THREE.Group,
    entity: E,
    kindKey: string,
    create: (entity: E) => THREE.Group
  ): THREE.Group {
    let mesh = map.get(entity.id);
    if (mesh && mesh.userData.boundKind !== kindKey) {
      group.remove(mesh);
      this.disposeMeshGeometries(mesh);
      map.delete(entity.id);
      mesh = undefined;
    }
    if (!mesh) {
      mesh = create(entity);
      mesh.userData.boundKind = kindKey;
      group.add(mesh);
      map.set(entity.id, mesh);
    }
    return mesh;
  }

  /** Dispose a retired mesh's geometries. Materials are NOT disposed:
   *  most are the engine's shared set — disposing one would break
   *  every live mesh using it. The few per-mesh materials a rebuild
   *  leaves behind cost almost nothing on a rare world-swap rebuild. */
  private disposeMeshGeometries(root: THREE.Object3D): void {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
    });
  }

  public syncFlora(floraList: FloraEntity[]) {
    const activeIds = new Set(floraList.map((f) => f.id));

    this.floraMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.floraGroup.remove(mesh);
        this.disposeMeshGeometries(mesh);
        this.floraMeshMap.delete(id);
      }
    });

    floraList.forEach((f) => {
      const mesh = this.ensureBoundMesh(this.floraMeshMap, this.floraGroup, f, f.species, (e) => this.creatureKit.createFloraMesh(e));
      this.creatureKit.updateFloraMesh(mesh, f);
    });
  }

  // --------------------------------------------------------------------------
  // Procedural Fauna Meshes
  // --------------------------------------------------------------------------
  public syncFauna(faunaList: FaunaEntity[]) {
    const activeIds = new Set(faunaList.map((f) => f.id));

    // One wiggle timestep per sync (not per creature), clamped like the
    // render loop so a tab-switch hitch can't lurch every creature at once.
    const nowMs = performance.now();
    const wiggleDt = this.lastFaunaSyncMs === 0 ? 0 : Math.min((nowMs - this.lastFaunaSyncMs) / 1000, 0.05);
    this.lastFaunaSyncMs = nowMs;

    this.faunaMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.faunaGroup.remove(mesh);
        this.disposeMeshGeometries(mesh);
        this.faunaMeshMap.delete(id);
        this.creatureKit.forgetFauna(id);
      }
    });

    faunaList.forEach((f) => {
      // The binding kind includes taming: the tame TINT is baked into
      // the mesh at creation, so a creature that gets tamed must
      // rebuild to wear its new colors (the tint was always meant to
      // be the tame signal — it just never got to change before).
      const kindKey = `${f.species}:${f.isTamed ? 'tamed' : 'wild'}`;
      const mesh = this.ensureBoundMesh(this.faunaMeshMap, this.faunaGroup, f, kindKey, (e) => this.creatureKit.createFaunaMesh(e));
      this.creatureKit.updateFaunaMesh(mesh, f, wiggleDt);
    });
  }

  // --------------------------------------------------------------------------
  // Bio-Structures & Proximity Doors
  // --------------------------------------------------------------------------
  public syncStructures(structuresList: StructureEntity[], playerX?: number, playerZ?: number) {
    // Build datums first: every mesh seated below reads them.
    this.structureDatums = computeStructureDatums(structuresList, (x, z) => this.terrainHeightAt(x, z));
    this.structureDatumCells = new Map();
    structuresList.forEach((s) => {
      // Only building pieces advertise a datum to the placement ghost.
      if (!BUILDING_TYPES.has(s.type)) return;
      const d = this.structureDatums.get(s.id);
      if (d !== undefined) {
        this.structureDatumCells.set(`${Math.round(s.worldX / 2)},${Math.round(s.worldZ / 2)}`, d);
      }
    });

    const activeIds = new Set(structuresList.map((s) => s.id));

    this.structureMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.structuresGroup.remove(mesh);
        this.disposeMeshGeometries(mesh);
        this.structureMeshMap.delete(id);
      }
    });

    structuresList.forEach((s) => {
      // Cave mouths bind tighter than type alone: their DRESSING is
      // baked from the entity's own link record at creation, so the
      // kind includes the instance — a different world's mouth with
      // the same id must not inherit this world's rocks.
      const kindKey =
        s.type === 'cave_mouth'
          ? `cave_mouth:${s.cave?.instanceId ?? ''}`
          : s.type === 'ruin_landmark'
            ? `ruin_landmark:${s.ruin?.instanceId ?? ''}`
            : s.type;
      const mesh = this.ensureBoundMesh(this.structureMeshMap, this.structuresGroup, s, kindKey, (e) => this.createStructureMesh(e));
      this.updateStructureMesh(mesh, s);
    });

    const px = playerX !== undefined ? playerX : this.cachedPlayerX;
    const pz = playerZ !== undefined ? playerZ : this.cachedPlayerZ;
    this.updateIrisDoorsProximity(px, pz);
  }

  /**
   * Vat life (2026-10-16): culture vats breathe and gestate in
   * the render, not the sim. Per frame (from setPlayerPosition,
   * the iris doors' own cadence): every vat's sac swells on a
   * slow breath, phased by entity id so a row of vats never
   * pulses in lockstep; the dark core inside scales and firms
   * with the gestation fraction on the entity record (invisible
   * while the vat rests empty), and when the fraction completes
   * it bobs, ready, waiting for the player's hatch click.
   */
  /**
   * Dissolve fizz (Adam, 2026-10-16): a creature under a solvent
   * dissolve should be SEEN dissolving — while its dissolveTimer
   * runs, the engine puffs a small green fizz off it a few times
   * a second (throttled per creature). Pure presentation: the
   * damage and the flight live in the sim (useWorldEntities);
   * this only reads the stamped entity on each fauna mesh, the
   * same seam the vat-life pass uses for structures.
   */
  private updateDissolveFizz(): void {
    this.faunaMeshMap.forEach((mesh) => {
      const entity = mesh.userData.entity as FaunaEntity | undefined;
      if (!entity || !(entity.dissolveTimer && entity.dissolveTimer > 0)) return;
      const last = this.dissolveFizzAt.get(entity.id) ?? -1;
      if (this.elapsedTime - last < 0.45) return;
      this.dissolveFizzAt.set(entity.id, this.elapsedTime);
      this.triggerDissolveFizz(entity.x, entity.z);
    });
  }

  private updateVatLife(): void {
    this.structureMeshMap.forEach((mesh) => {
      const entity = mesh.userData.entity as StructureEntity | undefined;
      if (!entity || entity.type !== 'culture_vat') return;
      const sac = mesh.getObjectByName('vatSac');
      const core = mesh.getObjectByName('vatCore') as THREE.Mesh | undefined;
      const phase = entity.id.length * 1.7;
      if (sac) {
        const b = 1 + 0.028 * Math.sin(this.elapsedTime * 1.3 + phase);
        sac.scale.set(b, 1.12 * b, b);
      }
      if (!core) return;
      const g = entity.vat?.gestating;
      if (!g) {
        core.scale.setScalar(0.001);
        return;
      }
      const f = Math.min(1, g.total > 0 ? g.progress / g.total : 0);
      const s = 0.25 + 0.85 * f;
      core.scale.set(s, s * 1.08, s);
      core.rotation.y = this.elapsedTime * 0.25 + phase;
      core.position.y = 0.92 + (f >= 1 ? 0.05 * Math.sin(this.elapsedTime * 2.2 + phase) : 0);
      const mat = core.material as THREE.MeshStandardMaterial;
      mat.opacity = 0.25 + 0.65 * f;
      mat.emissiveIntensity = f >= 1 ? 0.7 + 0.3 * Math.sin(this.elapsedTime * 2.2 + phase) : 0.25;
    });
  }

  public updateIrisDoorsProximity(playerX: number, playerZ: number) {
    this.structureMeshMap.forEach((mesh) => {
      const entity = mesh.userData.entity as StructureEntity | undefined;
      if (!entity) return;
      if (entity.type !== 'iris_slit_door') return;

      const dist = Math.hypot(playerX - entity.worldX, playerZ - entity.worldZ);
      let isNearby = dist < IRIS_DOOR_TRIGGER_RADIUS;
      if (!isNearby) {
        for (const peerGroup of this.peerMeshes.values()) {
          const pdist = Math.hypot(peerGroup.position.x - entity.worldX, peerGroup.position.z - entity.worldZ);
          if (pdist < IRIS_DOOR_TRIGGER_RADIUS) {
            isNearby = true;
            break;
          }
        }
      }

      const targetProgress = isNearby ? 1.0 : 0.0;
      entity.doorOpenProgress += (targetProgress - entity.doorOpenProgress) * 0.15;

      const irisLeft = mesh.getObjectByName('irisLeft');
      const irisRight = mesh.getObjectByName('irisRight');
      if (irisLeft && irisRight) {
        irisLeft.position.x = -entity.doorOpenProgress * 0.9;
        irisRight.position.x = entity.doorOpenProgress * 0.9;

      }
    });
  }

  private createStructureMesh(structure: StructureEntity): THREE.Group {
    const builder = this.structureBuilders[structure.type];
    const group = builder ? builder() : new THREE.Group();
    group.userData = { type: 'structure', entity: structure };
    this.applyTerrainTransform(group, structure.type, structure.worldX, structure.worldZ, structure.rotation, structure.level ?? 0);
    // Cave mouths wear their generated dressing (boulders, lips, the
    // dark opening, biome accents) — built from the entity's own link
    // record, once, at mesh creation; dressing never changes after.
    if (structure.type === 'cave_mouth') {
      // ONE place reads as the entrance (Adam, 2026-10-14): the base
      // mound's own meshes stop answering the raycaster, and in the
      // dressing only the opening dome + its sigil stay interactive —
      // hovering boulders and rubble must not report "Cave Mouth".
      group.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.raycast = () => {};
      });
      if (structure.cave?.dressing?.length) {
        group.add(this.landmarkDressing.buildCaveDressing(structure));
      }
    }
    // Ruin landmarks wear their generated dressing too — and like the
    // cave mouth, only ONE piece speaks for the place (the threshold
    // stone at the gate), so rubble never reports the wrong name.
    if (structure.type === 'ruin_landmark' && structure.ruin) {
      group.add(this.landmarkDressing.buildRuinDressing(structure));
    }
    return group;
  }


  private updateStructureMesh(mesh: THREE.Group, structure: StructureEntity) {
    this.applyTerrainTransform(mesh, structure.type, structure.worldX, structure.worldZ, structure.rotation, structure.level ?? 0);
    mesh.userData.entity = structure;

    const forgeCore = mesh.getObjectByName('forgeCore');
    if (forgeCore) {
      forgeCore.rotation.y += 0.03;
    }

    // Cave sigils breathe: a slow opacity/scale pulse so the entrance
    // sign catches the eye without strobing.
    const sigil = mesh.getObjectByName('caveSigil');
    if (sigil) {
      const pulse = Math.sin(performance.now() / 550);
      ((sigil as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.6 + 0.28 * pulse;
      const breathe = 1 + 0.03 * pulse;
      sigil.scale.set(breathe, breathe, 1);
    }

    // The cave exit's inner disc shimmers the same way — kin signals:
    // violet that breathes marks a portal, on either side of it.
    const exitDisc = mesh.getObjectByName('caveExitDisc');
    if (exitDisc) {
      const pulse = Math.sin(performance.now() / 550);
      ((exitDisc as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.22 + 0.18 * pulse;
    }
  }

  // --------------------------------------------------------------------------
  // Dropped Items (Floating Byproducts)
  // --------------------------------------------------------------------------
  public syncDroppedItems(items: DroppedItemEntity[]) {
    const activeIds = new Set(items.map((i) => i.id));

    this.droppedItemMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.droppedItemsGroup.remove(mesh);
        this.droppedItemMeshMap.delete(id);
      }
    });

    items.forEach((item) => {
      let mesh = this.droppedItemMeshMap.get(item.id);
      if (!mesh) {
        mesh = new THREE.Group();
        const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.2, 0), this.materials.biolumCyan);
        mesh.add(gem);
        this.droppedItemsGroup.add(mesh);
        this.droppedItemMeshMap.set(item.id, mesh);
      }
      // Drops hover — over the terrain, not over y=0, so a pickup on a
      // rise doesn't bob along inside the hill.
      mesh.position.set(item.x, this.terrainHeightAt(item.x, item.z) + 0.35 + Math.sin(item.bobTime * 4) * 0.1, item.z);
      mesh.rotation.y += 0.04;
    });
  }

  // --------------------------------------------------------------------------
  // Ghost Hologram (Building Preview in First Person)
  // --------------------------------------------------------------------------
  private setupGhostHologram() {
    this.ghostGroup.clear();
    this.ghostType = null;
    this.ghostGroup.visible = false;
  }

  // Builds the ghost preview from the real structure builder, then swaps every
  // mesh to the wireframe hologram material and strips lights (a ghost must
  // never light the scene).
  private buildGhostFor(type: StructureType): void {
    const builder = this.structureBuilders[type];
    const built = builder ? builder() : new THREE.Group();
    const lights: THREE.Object3D[] = [];
    built.traverse((obj) => {
      const asLight = obj as THREE.PointLight;
      if (asLight.isPointLight) {
        lights.push(obj);
        return;
      }
      const asMesh = obj as THREE.Mesh;
      if (!asMesh.isMesh) {
        return;
      }
      asMesh.castShadow = false;
      asMesh.receiveShadow = false;
    });
    lights.forEach((l) => l.removeFromParent());
    this.ghostGroup.add(built);
    this.ghostType = type;
  }

  private tintGhost(valid: boolean): void {
    const mat = valid ? this.materials.ghostValid : this.materials.ghostInvalid;
    this.ghostGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.material = mat;
    });
  }

  private disposeGhost(): void {
    this.ghostGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      mesh.geometry.dispose();
    });
    this.ghostGroup.clear();
    this.ghostType = null;
  }

  public setGhostPreview(
    type: StructureType,
    visible: boolean,
    worldX: number,
    worldZ: number,
    rotation: number,
    valid: boolean
  ) {
    this.ghostVisible = visible;
    this.ghostGroup.visible = visible;
    if (!visible) {
      return;
    }
    if (this.ghostType !== type) {
      this.disposeGhost();
      this.buildGhostFor(type);
    }
    this.applyTerrainTransform(this.ghostGroup, type, worldX, worldZ, rotation);
    this.tintGhost(valid);
  }

  // --------------------------------------------------------------------------
  // Pooled Dynamic Lighting
  // --------------------------------------------------------------------------
  // Per-mesh PointLights don't scale (fern farms = shader-recompile hitches),
  // so all structure/flora light comes from here: sources are gathered from
  // live entities, merged into 4m grid cells (close ferns become one greater
  // light, scaled sublinearly so clustering feels rewarding), and the nearest
  // cells win a fixed pool of real PointLights. Every cell also gets one glow
  // sprite, so distant sources still look lit without costing a real light.
  private initLighting(): void {
    for (let i = 0; i < this.lightPoolSize; i++) {
      const pl = new THREE.PointLight(0xffffff, 0, 1);
      pl.visible = false;
      this.scene.add(pl);
      this.lightPool.push(pl);
    }
    this.glowTexture = makeGlowTexture();
  }

  private getFloraLightSpec(flora: FloraEntity): LightSource {
    const id = `flora:${flora.id}`;
    if (flora.species === 'lantern_fern') {
      // Growth curve preserved from the per-mesh era: feeble seedling (stage 0)
      // to brilliant mature fern (stage 5). Merging multiplies from here.
      const g = (0.45 + flora.growthStage * 0.14) / 0.45;
      return { id, x: flora.x, y: 2.2, z: flora.z, color: 0x06b6d4, intensity: 1.8 * g ** 3, distance: 8 * g };
    }
    const b = this.floraLightBase[flora.species];
    return { id, x: flora.x, y: b.y, z: flora.z, color: b.color, intensity: b.intensity, distance: b.distance };
  }

  private getStructureLightSpec(s: StructureEntity): LightSource {
    const id = `struct:${s.id}`;
    if (s.type === 'lantern_fern_post') {
      // Built mature: stage-4 equivalent of a wild fern.
      const g = (0.45 + 4 * 0.14) / 0.45;
      return { id, x: s.worldX, y: 2.7, z: s.worldZ, color: 0x06b6d4, intensity: 1.8 * g ** 3, distance: 8 * g };
    }
    const b = this.structureLightBase[s.type];
    return { id, x: s.worldX, y: b.y, z: s.worldZ, color: b.color, intensity: b.intensity, distance: b.distance };
  }

  private updateLighting(): void {
    const sources: LightSource[] = [];
    this.floraMeshMap.forEach((mesh) => {
      const flora = mesh.userData.entity as FloraEntity | undefined;
      if (!flora) {
        return;
      }
      sources.push(this.getFloraLightSpec(flora));
    });
    this.structureMeshMap.forEach((mesh) => {
      const s = mesh.userData.entity as StructureEntity | undefined;
      if (!s) {
        return;
      }
      sources.push(this.getStructureLightSpec(s));
    });

    // The LEFT HAND lantern (Adam, 2026-10-14): a carried lantern-fern
    // is a light source glued to the player — generous and torch-like.
    // It merges and culls like any other source, and sitting at
    // distance ~0 from the player it always claims a pool light.
    if (this.heldLightActive) {
      sources.push({
        id: 'held:lantern',
        x: this.cachedPlayerX,
        y: 1.6,
        z: this.cachedPlayerZ,
        color: 0x67e8f9,
        intensity: 2.6,
        distance: 16,
      });
    }

    // Merge sources into grid cells (intensity-weighted centroid per cell).
    const cells = new Map<string, { sx: number; sy: number; sz: number; si: number; r: number; g: number; b: number; count: number; maxDist: number; maxI: number }>();
    sources.forEach((src) => {
      const key = `${Math.floor(src.x / this.lightCellSize)},${Math.floor(src.z / this.lightCellSize)}`;
      let cell = cells.get(key);
      if (!cell) {
        cell = { sx: 0, sy: 0, sz: 0, si: 0, r: 0, g: 0, b: 0, count: 0, maxDist: 0, maxI: 0 };
        cells.set(key, cell);
      }
      cell.sx += src.x * src.intensity;
      cell.sy += src.y * src.intensity;
      cell.sz += src.z * src.intensity;
      cell.si += src.intensity;
      const c = new THREE.Color(src.color);
      cell.r += c.r * src.intensity;
      cell.g += c.g * src.intensity;
      cell.b += c.b * src.intensity;
      cell.count += 1;
      cell.maxDist = Math.max(cell.maxDist, src.distance);
      cell.maxI = Math.max(cell.maxI, src.intensity);
    });

    // Nearest cells win the real-light pool; every cell gets a glow sprite.
    const ranked = [...cells.entries()]
      .map(([key, cell]) => {
        const cx = cell.sx / cell.si;
        const cy = cell.sy / cell.si;
        const cz = cell.sz / cell.si;
        const d2 = (cx - this.cachedPlayerX) ** 2 + (cz - this.cachedPlayerZ) ** 2;
        // Sublinear but rewarding: 1 source keeps full strength, 3 merged
        // ferns read as one big much-more-effective light, 50 saturate.
        const mergedI = cell.maxI * (1 + 0.85 * Math.log2(cell.count));
        const mergedD = Math.min(24, cell.maxDist + 0.6 * (cell.count - 1));
        const color = new THREE.Color(cell.r / cell.si, cell.g / cell.si, cell.b / cell.si);
        return { key, cx, cy, cz, d2, mergedI, mergedD, color };
      })
      .sort((a, b) => a.d2 - b.d2);

    ranked.forEach((entry, i) => {
      if (i >= this.lightPool.length) {
        return;
      }
      const pl = this.lightPool[i];
      pl.visible = true;
      pl.position.set(entry.cx, entry.cy, entry.cz);
      pl.color.copy(entry.color);
      pl.intensity = entry.mergedI * this.zoneLightIntensityMult;
      pl.distance = entry.mergedD * this.zoneLightDistanceMult;
    });
    for (let i = ranked.length; i < this.lightPool.length; i++) {
      this.lightPool[i].visible = false;
    }

    const seen = new Set<string>();
    ranked.forEach((entry) => {
      seen.add(entry.key);
      let sprite = this.glowSprites.get(entry.key);
      if (!sprite) {
        const mat = new THREE.SpriteMaterial({
          map: this.glowTexture,
          color: 0xffffff,
          transparent: true,
          opacity: 0.32,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        sprite = new THREE.Sprite(mat);
        this.scene.add(sprite);
        this.glowSprites.set(entry.key, sprite);
      }
      sprite.position.set(entry.cx, entry.cy, entry.cz);
      const sc = entry.mergedD * this.zoneLightDistanceMult * 0.85;
      sprite.scale.set(sc, sc, 1);
      (sprite.material as THREE.SpriteMaterial).color.copy(entry.color);
    });
    this.glowSprites.forEach((sprite, key) => {
      if (seen.has(key)) {
        return;
      }
      this.scene.remove(sprite);
      (sprite.material as THREE.Material).dispose();
      this.glowSprites.delete(key);
    });
  }

  // --------------------------------------------------------------------------
  // Special Visual FX
  // --------------------------------------------------------------------------
  /**
   * The spray itself (Adam, 2026-10-16): a visible jet of solvent
   * from the player to the creature being sprayed — droplets laid
   * along the line between the two, the whole cloud thrown
   * forward, gone in a third of a second. Operating the sprayer
   * must READ as spraying something, not just clicking it.
   */
  public triggerSprayJet(fromX: number, fromZ: number, toX: number, toZ: number) {
    const count = 42;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const fromY = this.terrainHeightAt(fromX, fromZ) + 1.05;
    const toY = this.terrainHeightAt(toX, toZ) + 0.8;
    for (let i = 0; i < count; i++) {
      const t = Math.random();
      pos[i * 3] = fromX + (toX - fromX) * t + (Math.random() - 0.5) * 0.3;
      pos[i * 3 + 1] = fromY + (toY - fromY) * t + (Math.random() - 0.5) * 0.25;
      pos[i * 3 + 2] = fromZ + (toZ - fromZ) * t + (Math.random() - 0.5) * 0.3;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x84cc16,
      size: 0.3,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    this.particlesGroup.add(points);
    const dir = new THREE.Vector3(toX - fromX, 0, toZ - fromZ);
    const len = dir.length() || 1;
    dir.normalize();
    this.transientParticles.push({
      mesh: points,
      life: 0,
      maxLife: 0.35,
      vel: dir.multiplyScalar(5).add(new THREE.Vector3(0, 0.3, 0)),
    });
    void len;
  }

  /**
   * The striker's tracer (weapons build, 2026-10-16): a bright
   * point (a small cluster for a bursting spore ball) that flies
   * the actual shot line at the shot's actual speed — velocity =
   * distance / travelSeconds, life = travelSeconds — so what the
   * player SEES arrive is what the sim resolves. Pale gold for a
   * spine, spore-green for a burst.
   */
  public triggerShotTracer(fromX: number, fromZ: number, toX: number, toZ: number, travelSeconds: number, burst: boolean) {
    const count = burst ? 7 : 1;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const fromY = this.terrainHeightAt(fromX, fromZ) + 1.05;
    const toY = this.terrainHeightAt(toX, toZ) + 0.8;
    for (let i = 0; i < count; i++) {
      pos[i * 3] = fromX + (Math.random() - 0.5) * 0.12;
      pos[i * 3 + 1] = fromY + (Math.random() - 0.5) * 0.12;
      pos[i * 3 + 2] = fromZ + (Math.random() - 0.5) * 0.12;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: burst ? 0xa3e635 : 0xfde68a,
      size: burst ? 0.34 : 0.26,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    this.particlesGroup.add(points);
    const travel = Math.max(0.05, travelSeconds);
    this.transientParticles.push({
      mesh: points,
      life: 0,
      maxLife: travel,
      vel: new THREE.Vector3((toX - fromX) / travel, (toY - fromY) / travel, (toZ - fromZ) / travel),
    });
  }

  /**
   * Dissolve fizz: the small green boil-off a dissolving creature
   * wears (see updateDissolveFizz). Lighter than a spray burst —
   * it repeats several times a second for the dissolve's life.
   */
  public triggerDissolveFizz(x: number, z: number) {
    const count = 10;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.9;
      pos[i * 3 + 1] = Math.random() * 1.0 + 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.9;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x84cc16,
      size: 0.22,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    points.position.set(x, this.terrainHeightAt(x, z), z);
    this.particlesGroup.add(points);
    this.transientParticles.push({
      mesh: points,
      life: 0,
      maxLife: 0.4,
      vel: new THREE.Vector3(0, 0.8, 0),
    });
  }

  /**
   * A landed strike's burst (weapons build, 2026-10-16): a short
   * amber-white star of sap and chitin flecks at the struck
   * creature — the visual period on a close hit, thrown outward
   * rather than boiled upward like the dissolve's fizz.
   */
  public triggerStrikeBurst(x: number, z: number) {
    const count = 14;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.7;
      pos[i * 3 + 1] = Math.random() * 0.9 + 0.25;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.7;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xfbbf24,
      size: 0.24,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    points.position.set(x, this.terrainHeightAt(x, z), z);
    this.particlesGroup.add(points);
    this.transientParticles.push({
      mesh: points,
      life: 0,
      maxLife: 0.32,
      vel: new THREE.Vector3(0, 1.4, 0),
    });
  }

  public triggerSolventSprayEffect(x: number, z: number) {
    const count = 35;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 1.5;
      pos[i * 3 + 1] = Math.random() * 1.8;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 1.5;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.35,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    points.position.set(x, this.terrainHeightAt(x, z), z);
    this.particlesGroup.add(points);

    this.transientParticles.push({
      mesh: points,
      life: 0,
      maxLife: 0.6,
      vel: new THREE.Vector3(0, 1.2, 0),
    });
  }

  public triggerHarvestEffect(x: number, z: number, colorHex: number = 0x2dd4bf) {
    const count = 25;
    const geom = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 0.8;
      pos[i * 3 + 1] = Math.random() * 1.2 + 0.3;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 0.8;
    }
    geom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: colorHex,
      size: 0.28,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geom, mat);
    points.position.set(x, this.terrainHeightAt(x, z), z);
    this.particlesGroup.add(points);

    this.transientParticles.push({
      mesh: points,
      life: 0,
      maxLife: 0.5,
      vel: new THREE.Vector3(0, 1.5, 0),
    });
  }

  // --------------------------------------------------------------------------
  // Day / Night Atmosphere Cycle
  // --------------------------------------------------------------------------
  public setDayNightTime(cycle: number) {
    this.lastDayCycle = cycle;
    // Underground there is no day: the cavern look (set by
    // setCavernMode) owns the lights until the player surfaces.
    // Ruin interiors own their dimmer look the same way.
    if (this.cavernMode || this.ruinMode) return;
    const isDay = cycle > 0.25 && cycle < 0.75;
    const sunAngle = cycle * Math.PI * 2;
    this.dirLight.position.set(
      Math.cos(sunAngle) * 40,
      Math.sin(sunAngle) * 45 + 5,
      Math.sin(sunAngle) * 30
    );

    if (isDay) {
      this.dirLight.intensity = 1.3;
      this.ambientLight.intensity = 0.9;
      this.scene.background = new THREE.Color(0x0a1428);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x0e1c38);
    }
    if (!isDay) {
      this.dirLight.intensity = 0.35;
      this.ambientLight.intensity = 0.45;
      this.scene.background = new THREE.Color(0x050811);
      (this.scene.fog as THREE.FogExp2).color.setHex(0x070c18);
    }
  }

  // --------------------------------------------------------------------------
  // Instanced Caverns (game/cavern.ts)
  // --------------------------------------------------------------------------
  // The cave renders as ONE group: two planes (floor/ceiling), ONE
  // instanced mesh for every visible wall cell, and instanced decor
  // per feature type. Built on entry, disposed on exit — the surface
  // world underneath is untouched (its terrain group just hides).

  /** Enter (on=true, with the generated cavern) or leave a cave. */
  public setCavernMode(on: boolean, cavern?: CavernResult, depthLevel = 1): void {
    this.cavernMode = on;
    this.terrainGroup.visible = !on;
    if (on && cavern) this.buildCavern(cavern);
    this.cavernGroup.visible = on;
    const fog = this.scene.fog as THREE.FogExp2;
    if (on) {
      // Permanent dark: a whisper of global light so silhouettes read,
      // real visibility comes from fungus glow + portal lights. Each
      // depth level down is darker still (Adam's deeper caves: the
      // darkness itself is the gradient) — fog thickens, the whisper
      // thins, and carried light starts to matter.
      const sink = Math.max(0, depthLevel - 1);
      this.dirLight.intensity = Math.max(0.015, 0.03 - sink * 0.008);
      this.hemiLight.intensity = 0.08;
      this.ambientLight.intensity = Math.max(0.03, 0.05 - sink * 0.01);
      // Cave resemblance (2026-10-15): the dark itself wears the
      // surface family's color, pre-faded by depth in the cavern's
      // meta (the deep forgets the surface — by L5 the blend is a
      // whisper). Fog + background carry it; the cave's own light
      // sources stay their own colors.
      const caveDark = new THREE.Color(0x020208);
      const tint = cavern?.meta.biomeTint;
      if (tint) caveDark.lerp(new THREE.Color(tint.color), tint.strength);
      this.scene.background = caveDark;
      fog.color.copy(caveDark);
      fog.density = 0.055 + sink * 0.014;
    } else {
      this.clearCavern();
      // Restore the surface sky: hemisphere back to its built value,
      // then the day/night setter re-applies sun/ambient/background.
      this.hemiLight.intensity = 0.8;
      fog.density = 0.018;
      this.setDayNightTime(this.lastDayCycle);
    }
  }

  public isInCavern(): boolean {
    return this.cavernMode;
  }

  private buildCavern(cavern: CavernResult): void {
    this.clearCavern();
    const CEIL = 4.6; // cavern ceiling height (flat instance, no stories)
    const size = cavern.width * cavern.cellMeters;

    // Floor + ceiling planes.
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(size + 8, size + 8),
      new THREE.MeshStandardMaterial({ color: 0x232030, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.cavernGroup.add(floor);
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(size + 8, size + 8),
      new THREE.MeshStandardMaterial({ color: 0x14111d, roughness: 1 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.y = CEIL;
    this.cavernGroup.add(ceiling);

    // Walls: one instanced box per wall cell that TOUCHES floor — deep
    // solid rock is never seen, so it gets no instance.
    const wallAt: { x: number; z: number; cx: number; cy: number }[] = [];
    for (let cy = 0; cy < cavern.height; cy++) {
      for (let cx = 0; cx < cavern.width; cx++) {
        if (cavern.grid[cy][cx] !== '#') continue;
        const touchesFloor =
          (cx > 0 && cavern.grid[cy][cx - 1] === '.') ||
          (cx < cavern.width - 1 && cavern.grid[cy][cx + 1] === '.') ||
          (cy > 0 && cavern.grid[cy - 1][cx] === '.') ||
          (cy < cavern.height - 1 && cavern.grid[cy + 1][cx] === '.');
        if (!touchesFloor) continue;
        const w = cavernCellToWorld(cx, cy, cavern.width, cavern.height);
        wallAt.push({ x: w.x, z: w.z, cx, cy });
      }
    }
    const wallMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.04, CEIL, 2.04),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
      wallAt.length
    );
    const dummy = new THREE.Object3D();
    const rockBase = new THREE.Color(0x403a52);
    wallAt.forEach((cell, i) => {
      dummy.position.set(cell.x, CEIL / 2, cell.z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(i, dummy.matrix);
      // Deterministic per-cell shade so the rock isn't one flat tone.
      const shade = 0.8 + (((cell.cx * 31 + cell.cy * 17) % 10) / 10) * 0.45;
      wallMesh.setColorAt(i, rockBase.clone().multiplyScalar(shade));
    });
    wallMesh.receiveShadow = true;
    this.cavernGroup.add(wallMesh);

    // Features: the fungus and BOTH crystal kinds are REAL FLORA now
    // (Adam, 2026-10-14) — they live in the instance's flora list and
    // render through the flora pipeline (harvestable, regrowable), so
    // the cavern decor below keeps only what is still scenery: the
    // hazard spikes and the heart.
    const featuresOf = (type: string) => cavern.features.filter((f) => f.type === type);
    const placeInstances = (
      mesh: THREE.InstancedMesh,
      cells: { x: number; z: number }[],
      y: number,
      spin: boolean
    ): void => {
      cells.forEach((cell, i) => {
        dummy.position.set(cell.x, y, cell.z);
        dummy.rotation.set(0, spin ? ((cell.x * 13 + cell.z * 7) % 6.28) : 0, 0);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.cavernGroup.add(mesh);
    };
    const worldOf = (f: { cx: number; cy: number }) =>
      cavernCellToWorld(f.cx, f.cy, cavern.width, cavern.height);

    const hazards = featuresOf('hazard');
    if (hazards.length) {
      placeInstances(
        new THREE.InstancedMesh(
          new THREE.ConeGeometry(0.42, 1.15, 6),
          new THREE.MeshStandardMaterial({ color: 0x7f1d1d, emissive: 0xef4444, emissiveIntensity: 0.6, roughness: 0.6 }),
          hazards.length
        ),
        hazards.map(worldOf),
        0.57,
        true
      );
    }

    // The heart: the deepest chamber's prize — one big pulsing crystal.
    const heart = cavern.features.find((f) => f.type === 'heart');
    if (heart) {
      const w = worldOf(heart);
      const crystal = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.85),
        new THREE.MeshStandardMaterial({ color: 0x831843, emissive: 0xec4899, emissiveIntensity: 1.8, roughness: 0.25 })
      );
      crystal.name = 'cavernHeart';
      crystal.position.set(w.x, 1.15, w.z);
      this.cavernGroup.add(crystal);
      const heartLight = new THREE.PointLight(0xec4899, 9, 11, 1.5);
      heartLight.position.set(w.x, 1.4, w.z);
      this.cavernGroup.add(heartLight);
    }

    // Entrance marker: a cyan ring flat on the floor — "home is here",
    // visible down the entrance chamber (the exit portal stands here
    // too, as a normal structure in the instance's list).
    const entranceWorld = cavernCellToWorld(
      cavern.entrance.x, cavern.entrance.y, cavern.width, cavern.height
    );
    const homeRing = new THREE.Mesh(
      new THREE.TorusGeometry(1.25, 0.05, 6, 32),
      new THREE.MeshBasicMaterial({ color: 0x22d3ee })
    );
    homeRing.rotation.x = Math.PI / 2;
    homeRing.position.set(entranceWorld.x, 0.06, entranceWorld.z);
    this.cavernGroup.add(homeRing);

    // The descent marker: a violet ring flat on the floor around the
    // shaft — "down is here", kin to the home ring but the deep
    // family's color. (The shaft itself is the cave_descent structure
    // in the instance's list; this ring is its floor signage.)
    if (cavern.descent) {
      const descentWorld = cavernCellToWorld(
        cavern.descent.x, cavern.descent.y, cavern.width, cavern.height
      );
      const downRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.05, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0x8b5cf6 })
      );
      downRing.rotation.x = Math.PI / 2;
      downRing.position.set(descentWorld.x, 0.06, descentWorld.z);
      this.cavernGroup.add(downRing);
    }

    // The vine marker: an emerald ring around the shaft — "the way
    // OUT is here", daylight's family color. (The shaft itself is the
    // vine_shaft structure in the instance's list, hanging above it.)
    if (cavern.vineShaft) {
      const vineWorld = cavernCellToWorld(
        cavern.vineShaft.x, cavern.vineShaft.y, cavern.width, cavern.height
      );
      const vineRing = new THREE.Mesh(
        new THREE.TorusGeometry(1.25, 0.05, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0x34d399 })
      );
      vineRing.rotation.x = Math.PI / 2;
      vineRing.position.set(vineWorld.x, 0.06, vineWorld.z);
      this.cavernGroup.add(vineRing);
    }
  }

  /** Dispose every cavern mesh/light (geometries + materials are fresh
   *  per build, so disposing them all is safe). */
  private clearCavern(): void {
    this.cavernGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else if (material) material.dispose();
    });
    this.cavernGroup.clear();
  }

  // Instanced ruin interiors (game/ruinInterior.ts): the cavern
  // pattern rebuilt for the precursors — instanced floor tiles
  // (per-cell fate tint + overgrowth), one instanced wall mesh
  // (3.2 m — rooms, not caves), rubble where the centuries collapsed
  // a corridor, blobs where they grew one over. NO ceiling: the
  // roofs fell in long ago; light leaks from a grey sky. Instances
  // are exclusive: App never opens a ruin and a cavern at once.

  /** Enter (on=true, with the ruin + its fate tint) or leave. */
  public setRuinMode(on: boolean, ruin?: RuinResult, fateTint = 0xa8a29e): void {
    this.ruinMode = on;
    this.terrainGroup.visible = !on;
    if (on && ruin) this.buildRuin(ruin, fateTint);
    this.ruinGroup.visible = on;
    const fog = this.scene.fog as THREE.FogExp2;
    if (on) {
      // Dim daylight-leak: brighter than a cave (you can navigate
      // by it), dark enough that held light still earns its slot.
      this.dirLight.intensity = 0.32;
      this.hemiLight.intensity = 0.38;
      this.ambientLight.intensity = 0.3;
      this.scene.background = new THREE.Color(0x10151c);
      fog.color.setHex(0x10151c);
      fog.density = 0.03;
    } else {
      this.clearRuin();
      // Surface restore, mirroring setCavernMode's exit path.
      this.hemiLight.intensity = 0.8;
      fog.density = 0.018;
      this.setDayNightTime(this.lastDayCycle);
    }
  }

  public isInRuin(): boolean {
    return this.ruinMode;
  }

  private buildRuin(ruin: RuinResult, fateTint: number): void {
    this.clearRuin();
    const WALL_H = 3.2; // precursor rooms: tall, but not cavern-tall
    const tint = new THREE.Color(fateTint);
    const dummy = new THREE.Object3D();
    const isOpen = (ch: string): boolean => ch !== '#' && ch !== 'x';
    // Deterministic per-cell shade (the cavern walls' hash trick).
    const shadeOf = (cx: number, cy: number): number =>
      0.8 + (((cx * 31 + cy * 17) % 10) / 10) * 0.45;

    // --- Floor tiles: one instanced plane per open cell, colored by
    // what the centuries did to it — plain stone, overgrowth green,
    // the entrance's worn threshold, the heart room's tinted floor.
    const floorCells: { x: number; z: number; ch: string; cx: number; cy: number }[] = [];
    const wallCells: { x: number; z: number; cx: number; cy: number }[] = [];
    const rubbleCells: { x: number; z: number; cx: number; cy: number }[] = [];
    for (let cy = 0; cy < ruin.height; cy++) {
      for (let cx = 0; cx < ruin.width; cx++) {
        const ch = ruin.grid[cy][cx];
        const w = cavernCellToWorld(cx, cy, ruin.width, ruin.height);
        if (ch === '#') {
          const touchesOpen =
            (cx > 0 && isOpen(ruin.grid[cy][cx - 1])) ||
            (cx < ruin.width - 1 && isOpen(ruin.grid[cy][cx + 1])) ||
            (cy > 0 && isOpen(ruin.grid[cy - 1][cx])) ||
            (cy < ruin.height - 1 && isOpen(ruin.grid[cy + 1][cx]));
          if (touchesOpen) wallCells.push({ x: w.x, z: w.z, cx, cy });
        } else if (ch === 'x') {
          rubbleCells.push({ x: w.x, z: w.z, cx, cy });
        } else {
          floorCells.push({ x: w.x, z: w.z, ch, cx, cy });
        }
      }
    }
    const floorMesh = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(2.04, 2.04),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
      floorCells.length
    );
    const stoneFloor = new THREE.Color(0x6f6a63);
    const grownFloor = new THREE.Color(0x556b2f);
    floorCells.forEach((cell, i) => {
      dummy.position.set(cell.x, 0.01, cell.z);
      dummy.rotation.set(-Math.PI / 2, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      floorMesh.setMatrixAt(i, dummy.matrix);
      const base = cell.ch === 'o' ? grownFloor.clone() : stoneFloor.clone().lerp(tint, 0.18);
      if (cell.ch === 'E') base.multiplyScalar(1.3);
      if (cell.ch === '*') base.lerp(tint, 0.45);
      floorMesh.setColorAt(i, base.multiplyScalar(shadeOf(cell.cx, cell.cy)));
    });
    floorMesh.receiveShadow = true;
    this.ruinGroup.add(floorMesh);

    // --- Walls: one instanced box per wall cell touching open floor.
    const wallMesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(2.04, WALL_H, 2.04),
      new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
      wallCells.length
    );
    const wallBase = new THREE.Color(0x7a756e).lerp(tint, 0.3);
    wallCells.forEach((cell, i) => {
      dummy.position.set(cell.x, WALL_H / 2, cell.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wallMesh.setMatrixAt(i, dummy.matrix);
      wallMesh.setColorAt(i, wallBase.clone().multiplyScalar(shadeOf(cell.cx, cell.cy)));
    });
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    this.ruinGroup.add(wallMesh);

    // --- Rubble: two deterministic rocks per collapsed cell.
    if (rubbleCells.length) {
      const rubbleMesh = new THREE.InstancedMesh(
        new THREE.DodecahedronGeometry(0.55, 0),
        new THREE.MeshStandardMaterial({ color: 0x5d5851, roughness: 1 }),
        rubbleCells.length * 2
      );
      rubbleCells.forEach((cell, i) => {
        for (let k = 0; k < 2; k++) {
          const jx = (((cell.cx * 13 + cell.cy * 7 + k * 29) % 10) / 10 - 0.5) * 0.9;
          const jz = (((cell.cx * 7 + cell.cy * 19 + k * 11) % 10) / 10 - 0.5) * 0.9;
          dummy.position.set(cell.x + jx, 0.28, cell.z + jz);
          dummy.rotation.set(0, ((cell.cx * 3 + k) % 6) * 1.05, 0);
          const s = 0.7 + (((cell.cx * 17 + cell.cy * 5 + k * 7) % 10) / 10) * 0.6;
          dummy.scale.set(s, s * 0.65, s);
          dummy.updateMatrix();
          rubbleMesh.setMatrixAt(i * 2 + k, dummy.matrix);
        }
      });
      rubbleMesh.castShadow = true;
      this.ruinGroup.add(rubbleMesh);
    }

    // --- Overgrowth: a living blob on most 'o' cells (the fate's
    // flora reclaiming its floor — densest in the grown fates).
    const grownCells = floorCells.filter((c) => c.ch === 'o' && (c.cx * 31 + c.cy * 17) % 5 !== 0);
    if (grownCells.length) {
      const blobMesh = new THREE.InstancedMesh(
        new THREE.IcosahedronGeometry(0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 1, emissive: 0x1a2e05, emissiveIntensity: 0.5 }),
        grownCells.length
      );
      grownCells.forEach((cell, i) => {
        const s = 1.1 + (((cell.cx * 11 + cell.cy * 23) % 10) / 10) * 0.8;
        dummy.position.set(cell.x, 0.16, cell.z);
        dummy.rotation.set(0, ((cell.cx + cell.cy) % 6) * 1.05, 0);
        dummy.scale.set(s, s * 0.42, s);
        dummy.updateMatrix();
        blobMesh.setMatrixAt(i, dummy.matrix);
      });
      this.ruinGroup.add(blobMesh);
    }

    // --- Rings: the entrance ("home") and the heart ("the prize"),
    // both in the world's fate tint — a ruin's two poles.
    const ringAt = (cx: number, cy: number, radius: number): void => {
      const w = cavernCellToWorld(cx, cy, ruin.width, ruin.height);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(radius, 0.05, 6, 32),
        new THREE.MeshBasicMaterial({ color: fateTint })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(w.x, 0.06, w.z);
      this.ruinGroup.add(ring);
    };
    ringAt(ruin.entrance.cx, ruin.entrance.cy, 1.25);
    ringAt(ruin.heart.cx, ruin.heart.cy, 1.45);
  }

  /** Dispose every ruin mesh (fresh per build, like clearCavern). */
  private clearRuin(): void {
    this.ruinGroup.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const material = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(material)) material.forEach((m) => m.dispose());
      else if (material) material.dispose();
    });
    this.ruinGroup.clear();
  }

  // --------------------------------------------------------------------------
  // First-Person Raycasting & Screen Click
  // --------------------------------------------------------------------------
private initEventListeners() {
// Listen on the container div (not the canvas): during pointer lock the
// browser retargets mouse events to the locked element, so a
// canvas-level listener never fires while locked.
    const el = this.container;

    el.addEventListener('click', () => {
      // If pointer is unlocked, first click requests lock — EXCEPT
      // where pointer lock doesn't exist (touch): there a tap is a
      // tool tap, and swallowing it into a lock request that can
      // never succeed would eat every interaction on the phone.
      if (!this.controls.isLocked && this.pointerLockAvailable()) {
        this.requestPointerLock();
        return;
      }

      // If pointer is locked (or lock doesn't exist here), trigger
      // the active tool interaction.
      this.handleCenterClick();
    });

    window.addEventListener('resize', () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (!w || !h) return;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });

    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  public updateReticleAim() {
    // In 1st-person, raycast straight from center of screen (0, 0)
    this.raycaster.setFromCamera(CENTER_SCREEN_UV, this.camera);
    this.raycaster.far = 7.5; // Max 1st-person interaction range

    // 1. Flora
    const floraHits = this.raycaster.intersectObjects(this.floraGroup.children, true);
    if (floraHits.length > 0) {
      let topObj: THREE.Object3D | null = floraHits[0].object;
      while (topObj && !topObj.userData.entity && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj && topObj.userData.type === 'flora') {
        const f = topObj.userData.entity as FloraEntity;
        this.callbacks.onEntityHover?.({
          type: 'flora',
          name: f.species.replace('_', ' ').toUpperCase(),
          details: `Stage: ${f.growthStage}/5 ${f.harvestReady ? '• [READY TO HARVEST]' : '• Growing'}`,
          entity: f,
        });
        return;
      }
    }

    // 2. Fauna
    const faunaHits = this.raycaster.intersectObjects(this.faunaGroup.children, true);
    if (faunaHits.length > 0) {
      let topObj: THREE.Object3D | null = faunaHits[0].object;
      while (topObj && !topObj.userData.entity && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj && topObj.userData.type === 'fauna') {
        const fn = topObj.userData.entity as FaunaEntity;
        this.callbacks.onEntityHover?.({
          type: 'fauna',
          name: fn.species.replace('_', ' ').toUpperCase(),
          details: `${fn.isTamed ? `TAMED • Companion • ${fn.command?.toUpperCase() ?? 'FOLLOW'}` : 'WILD • Lure to tame'} [HP: ${fn.health}/${fn.maxHealth}]`,
          entity: fn,
        });
        return;
      }
    }

    // 3. Structures
    const structHits = this.raycaster.intersectObjects(this.structuresGroup.children, true);
    if (structHits.length > 0) {
      let topObj: THREE.Object3D | null = structHits[0].object;
      while (topObj && !topObj.userData.entity && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj && topObj.userData.type === 'structure') {
        const s = topObj.userData.entity as StructureEntity;
        this.callbacks.onEntityHover?.({
          type: 'structure',
          name: s.type.replace(/_/g, ' ').toUpperCase(),
          // Cave mouths are world-grown and PERMANENT — the generic
          // "(Solvent Recyclable)" line would be a lie (Adam, 2026-10-14).
          details:
            s.type === 'cave_mouth'
              ? 'Entrance to the Biolume Caverns · Permanent — not solvent recyclable'
              : s.type === 'cave_exit'
                ? 'The way back up · Permanent — not solvent recyclable'
                : s.type === 'cave_descent'
                  ? 'The cavern continues below · Permanent — not solvent recyclable'
                  : s.type === 'vine_shaft'
                    ? 'A living elevator — climbs straight to the surface · Permanent — not solvent recyclable'
                    : s.type === 'ruin_landmark'
                    ? s.ruin?.tier === 'traces'
                      ? 'A scattered remnant of something older · Permanent — not solvent recyclable'
                      : 'Precursor ruin · Click to step inside · Permanent — not solvent recyclable'
                    : s.type === 'ruin_exit'
                      ? 'The way back out · Permanent — not solvent recyclable'
                      : s.type === 'precursor_cache'
                        ? 'Precursor Cache · Open with the harvest glove'
                        : s.type === 'artifact_heart'
                          ? 'Artifact Heart · The deepest room\'s prize · Take it with the harvest glove'
                          : s.type === 'ruin_glyph'
                            ? 'Ruin Glyph · Click to read what the stone remembers'
                  : `Integrity: ${s.health}/${s.maxHealth} (Solvent Recyclable)`,
          entity: s,
        });
        return;
      }
    }

    // 4. Ground
    const groundPoint = this.getAimGroundIntersection();
    if (groundPoint) {
      this.callbacks.onEntityHover?.({
        type: 'ground',
        name: 'GROUND SECTOR',
        details: `Grid: [${Math.floor(groundPoint.x / 2)}, ${Math.floor(groundPoint.z / 2)}]`,
        worldX: groundPoint.x,
        worldZ: groundPoint.z,
      });
      return;
    }

    this.callbacks.onEntityHover?.(null);
  }

  private handleCenterClick() {
    this.raycaster.setFromCamera(CENTER_SCREEN_UV, this.camera);
    this.raycaster.far = 7.5;

    // Trigger tool kickback animation
    this.viewmodel.triggerAction();

    // Priority 1: Flora
    const floraHits = this.raycaster.intersectObjects(this.floraGroup.children, true);
    if (floraHits.length > 0) {
      let topObj: THREE.Object3D | null = floraHits[0].object;
      while (topObj && !topObj.userData.entity && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj && topObj.userData.type === 'flora') {
        this.callbacks.onFloraInteract?.(topObj.userData.entity as FloraEntity);
        return;
      }
    }

    // Priority 2: Fauna
    const faunaHits = this.raycaster.intersectObjects(this.faunaGroup.children, true);
    if (faunaHits.length > 0) {
      let topObj: THREE.Object3D | null = faunaHits[0].object;
      while (topObj && !topObj.userData.entity && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj && topObj.userData.type === 'fauna') {
        this.callbacks.onFaunaInteract?.(topObj.userData.entity as FaunaEntity);
        return;
      }
    }

    // Priority 3: Structures
    const structHits = this.raycaster.intersectObjects(this.structuresGroup.children, true);
    if (structHits.length > 0) {
      let topObj: THREE.Object3D | null = structHits[0].object;
      while (topObj && !topObj.userData.entity && topObj.parent) {
        topObj = topObj.parent;
      }
      if (topObj && topObj.userData.type === 'structure') {
        this.callbacks.onStructureInteract?.(topObj.userData.entity as StructureEntity);
        return;
      }
    }

    // Priority 4: Ground
    const groundPoint = this.getAimGroundIntersection();
    if (groundPoint) {
      this.callbacks.onGroundClick?.(groundPoint.x, groundPoint.z);
    }
  }

  public getAimGroundIntersection(): THREE.Vector3 | null {
    this.raycaster.setFromCamera(CENTER_SCREEN_UV, this.camera);
    this.raycaster.far = 12.0;
    const pt = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, pt)) {
      return pt;
    }
    return null;
  }

  // --------------------------------------------------------------------------
  // Animation Loop & Render (Single Engine Authoritative Loop)
  // --------------------------------------------------------------------------
  public updateViewmodelDynamics(delta: number, isMoving: boolean) {
    this.viewmodel.update(delta, isMoving);
  }

  private animate = () => {
    this.animFrameId = requestAnimationFrame(this.animate);
    const now = performance.now();
    // Real delta time (Adam, 2026-10-15: "a delta time thing, not
    // a framerate clamp" — and for background return, "put it in
    // pause mode"). No ceiling: a frame simulates exactly the time
    // that passed; the game loop sub-steps long frames so physics
    // stays stable at any rate. (The pre-fix 0.05 cap DISCARDED
    // elapsed time below 20 fps — a struggling device ran the whole
    // game in slow motion: Clarissa's "movement and turning feel
    // sluggish".)
    const rawDelta = (now - this.lastTime) / 1000;
    // A gap over a second is never live play: the tab was
    // backgrounded (rAF stops entirely down there) or the process
    // froze. Simulating the whole absence would fast-forward the
    // world, so the absence is discarded — this frame simulates
    // nothing — and App latches PAUSE MODE; the player returns to
    // a held world and resumes deliberately.
    const backgroundReturn = rawDelta > 1;
    const delta = backgroundReturn ? 0 : rawDelta;
    if (backgroundReturn) {
      this.unlockPointer();
      this.callbacks.onBackgroundReturn?.();
    }
    this.lastTime = now;
    this.elapsedTime += delta;

    // Invoke authoritative game frame callback
    this.callbacks.onFrame?.(delta);

    // Update reticle hover targets in 1st person (throttled to 10 Hz
    // / every 100ms). Desktop requires pointer lock; touch has no
    // lock to wait for, so the same target inspector must refresh
    // whenever pointer lock is unavailable there.
    this.reticleTimer += delta;
    if ((this.controls.isLocked || !this.pointerLockAvailable()) && this.reticleTimer >= 0.1) {
      this.reticleTimer = 0;
      this.updateReticleAim();
    }

    // Pooled dynamic lighting (throttled to 4 Hz — growth changes are gradual)
    if (now - this.lastLightUpdate > 250) {
      this.lastLightUpdate = now;
      this.updateLighting();
    }

    // Animate botanical pollen / spore motes with gentle drift (throttled to ~15 Hz / every 4 frames)
    this.sporeFrameCount += 1;
    if (this.sporeParticles && this.sporeFrameCount >= 4) {
      const sporeDt = delta * this.sporeFrameCount;
      this.sporeFrameCount = 0;
      const positions = this.sporeParticles.geometry.attributes.position;
      const count = positions.count;
      for (let i = 0; i < count; i++) {
        let px = positions.getX(i);
        let py = positions.getY(i);
        let pz = positions.getZ(i);

        // Gentle floating drift scaled strictly by accumulated sporeDt (calm botanical ambient motion)
        px += Math.cos(this.elapsedTime * 0.35 + i * 0.4) * 0.35 * sporeDt;
        py += Math.sin(this.elapsedTime * 0.5 + i * 0.6) * 0.25 * sporeDt;
        pz += Math.sin(this.elapsedTime * 0.25 + i * 0.3) * 0.35 * sporeDt;

        // Soft wrapping boundaries around exploration field
        if (px > 42) px = -42;
        if (px < -42) px = 42;
        if (py > 7.5) py = 0.8;
        if (py < 0.6) py = 7.2;
        if (pz > 42) pz = -42;
        if (pz < -42) pz = 42;

        positions.setXYZ(i, px, py, pz);
      }
      positions.needsUpdate = true;
    }

    // Weather motion (2026-10-15) — every frame; rain needs speed.
    this.updateWeather(delta);

    // Animate transient particles (solvent spray / harvest sparkle)
    for (let i = this.transientParticles.length - 1; i >= 0; i--) {
      const p = this.transientParticles[i];
      p.life += delta;
      p.mesh.position.addScaledVector(p.vel, delta);
      if (p.mesh instanceof THREE.Points) {
        (p.mesh.material as THREE.PointsMaterial).opacity = 1 - p.life / p.maxLife;
      }
      if (p.life >= p.maxLife) {
        this.particlesGroup.remove(p.mesh);
        this.transientParticles.splice(i, 1);
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy() {
    cancelAnimationFrame(this.animFrameId);
    this.controls.dispose();
    this.viewmodel.dispose();
    this.renderer.dispose();
    if (this.container && this.renderer.domElement) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}