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
} from '../types/game';
import { FirstPersonViewmodel } from './viewmodel';
import { BrownianWiggle, hashStringToSeed, type WiggleOptions } from './motion';
import { BIOME_TINTS } from './biomes';
import type { BiomeId } from './biomes';

const IRIS_DOOR_TRIGGER_RADIUS = 2.5;
// Structures sit on ROLLING terrain (see terrainHeightAt): floors ride
// this far above the sampled center height so a slab can never dip
// under the surface between slope samples, and floor slope is sampled
// this far either side of center — half the 2 m tile, i.e. its edges.
const FLOOR_TERRAIN_LIFT = 0.03;
const SLOPE_SAMPLE_DISTANCE = 1;
// One story of building: wall posts are 2.4 m tall, so a level-1 piece
// sits exactly one wall-height above its level-0 counterpart. Structure
// levels (StructureEntity.level) multiply this.
const STORY_HEIGHT = 2.4;

// Per-species idle-wiggle flavors (see game/motion.ts for what the knobs
// mean). A predator should not fidget like a puff: the stalker is nearly
// statue-still with a slow rock, the puff is busy and bouncy, the mouse is
// small and quick. Tuned by simulation — typical drift: stalker ~4 mm,
// mouse ~1.5 cm, puff ~3 cm.
const FAUNA_WIGGLE_FLAVORS: Record<string, WiggleOptions> = {
  chitin_stalker: { impulse: 0.5, maxOffset: 0.02, maxRock: 0.06, spring: 8, damping: 4 },
  soft_puff: { impulse: 2.0, maxOffset: 0.06, maxRock: 0.07, spring: 5, damping: 2.2 },
  burrow_mouse: { impulse: 1.6, maxOffset: 0.035, maxRock: 0.04, spring: 9, damping: 3.5 },
};
const FAUNA_WIGGLE_DEFAULT: WiggleOptions = { impulse: 1.4, maxOffset: 0.05, maxRock: 0.05, spring: 6, damping: 3 };

// Pre-allocated scratch vectors to prevent GC allocations in render loop (Rule 3)
const SCRATCH_VEC_A = new THREE.Vector3();
const SCRATCH_VEC_B = new THREE.Vector3();
const SCRATCH_RAY_ORIGIN = new THREE.Vector3();
const SCRATCH_RAY_DIR = new THREE.Vector3();
const CENTER_SCREEN_UV = new THREE.Vector2(0, 0);

export interface ThreeEngineCallbacks {
  onFloraInteract?: (flora: FloraEntity) => void;
  onFaunaInteract?: (fauna: FaunaEntity) => void;
  onStructureInteract?: (structure: StructureEntity) => void;
  onGroundClick?: (worldX: number, worldZ: number) => void;
  onEntityHover?: (target: HoverTarget) => void;
  onLockChange?: (isLocked: boolean) => void;
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
  private floraGroup: THREE.Group = new THREE.Group();
  private faunaGroup: THREE.Group = new THREE.Group();
  private structuresGroup: THREE.Group = new THREE.Group();
  private droppedItemsGroup: THREE.Group = new THREE.Group();
  private particlesGroup: THREE.Group = new THREE.Group();
  private peerMeshes: Map<string, THREE.Group> = new Map();

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
    bounce_shroom: { color: 0xa855f7, intensity: 0.6, distance: 3, y: 0.6 },
    glow_spore_cluster: { color: 0x06b6d4, intensity: 0.7, distance: 3.5, y: 0.5 },
  };
  private structureLightBase: Record<Exclude<StructureType, 'lantern_fern_post'>, LightBase> = {
    root_tile_floor: { color: 0x4ade80, intensity: 0.45, distance: 2.2, y: 0.5 },
    chitin_glass_wall: { color: 0x67e8f9, intensity: 0.55, distance: 2.5, y: 1.2 },
    iris_slit_door: { color: 0xf0abfc, intensity: 0.55, distance: 2.5, y: 1.2 },
    spore_canopy: { color: 0xa78bfa, intensity: 0.9, distance: 3.5, y: 2.6 },
    bio_forge_station: { color: 0x22d3ee, intensity: 0.9, distance: 3.5, y: 1.4 },
    tamed_snap_trap_turret: { color: 0xef4444, intensity: 0.7, distance: 3, y: 1.1 },
    cultivation_mound: { color: 0x4ade80, intensity: 0.45, distance: 2.2, y: 0.6 },
    // A cave mouth's halo: the cool violet breath of the Biolume
    // Caverns below (its dressing glow accents ride this halo).
    cave_mouth: { color: 0xa855f7, intensity: 0.85, distance: 4.2, y: 1.0 },
  };

  // Raycasting
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // High-frequency throttling & proximity cache
  private reticleTimer: number = 0;
  private sporeFrameCount: number = 0;
  private cachedPlayerX: number = 0;
  private cachedPlayerZ: number = 0;

  // Spore particles
  private sporeParticles: THREE.Points | null = null;
  private transientParticles: { mesh: THREE.Points | THREE.Mesh; life: number; maxLife: number; vel: THREE.Vector3 }[] = [];

  // Entity mesh maps
  private floraMeshMap: Map<string, THREE.Group> = new Map();
  private faunaMeshMap: Map<string, THREE.Group> = new Map();
  // Idle-life wiggle state per fauna (render-only; see motion.ts). One
  // BrownianWiggle per creature, seeded by its id so it wiggles the same
  // way on every screen. lastFaunaSyncMs times the wiggle's dt.
  private faunaWiggleMap: Map<string, BrownianWiggle> = new Map();
  private lastFaunaSyncMs = 0;
  private structureMeshMap: Map<string, THREE.Group> = new Map();
  // Per-structure mesh builders (registry replacing the createStructureMesh switch).
  // Arrow functions read this.materials lazily at build time, so field-init order is safe.
  private structureBuilders: Record<StructureType, () => THREE.Group> = {
    'root_tile_floor': () => {
      const group = new THREE.Group();
      const floor = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), this.materials.woodRoot);
      floor.position.y = 0.06;
      floor.receiveShadow = true;
      group.add(floor);
      return group;
    },
    'chitin_glass_wall': () => {
      const group = new THREE.Group();
      const postGeom = new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8);
      const leftPost = new THREE.Mesh(postGeom, this.materials.porcelainWhite);
      leftPost.position.set(-0.95, 1.2, 0);
      const rightPost = leftPost.clone();
      rightPost.position.x = 0.95;
      group.add(leftPost);
      group.add(rightPost);

      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.1), this.materials.chitinGlass);
      pane.position.set(0, 1.2, 0);
      pane.castShadow = true;
      group.add(pane);
      return group;
    },
    // Vine ladder: two springy rails + rungs, standing in the wall's
    // plane so it reads from either face. One segment spans one story.
    'vine_ladder': () => {
      const group = new THREE.Group();
      const railMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.85 });
      const rungMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.7, emissive: 0x3f6212, emissiveIntensity: 0.35 });
      const railGeom = new THREE.BoxGeometry(0.07, 2.4, 0.07);
      const leftRail = new THREE.Mesh(railGeom, railMat);
      leftRail.position.set(-0.7, 1.2, 0);
      const rightRail = leftRail.clone();
      rightRail.position.x = 0.7;
      group.add(leftRail);
      group.add(rightRail);
      const rungGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6);
      for (let i = 0; i < 6; i++) {
        const rung = new THREE.Mesh(rungGeom, rungMat);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, 0.3 + i * 0.36, 0);
        group.add(rung);
      }
      return group;
    },
    // Cave mouth: the registry needs an entry, but a mouth's real look
    // is its per-entity DRESSING (game/caveSurface.ts) — boulders, rock
    // lips, the dark opening — which only the entity knows. This base
    // is just a rocky mound so a mouth never renders as nothing;
    // createStructureMesh layers the dressing on top of it.
    'cave_mouth': () => {
      const group = new THREE.Group();
      const mound = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.9, 0),
        new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 }),
      );
      mound.position.y = 0.55;
      mound.scale.set(1.25, 0.72, 1.1);
      mound.castShadow = true;
      group.add(mound);
      return group;
    },
    'iris_slit_door': () => {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), this.materials.porcelainWhite);
      frame.position.set(0, 1.2, 0);
      group.add(frame);

      // Blades lie flat in the frame plane (XY, facing ±Z): rotation.x = 90°
      // turns the cylinder's thin axis (Y) into Z. Left leaf covers the -X
      // half (thetaStart PI), right leaf the +X half (thetaStart 0), so the
      // straight edges meet along x = 0 when closed.
      const irisLeft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.08, 16, 1, false, Math.PI, Math.PI),
        this.materials.biolumPink
      );
      irisLeft.name = 'irisLeft';
      irisLeft.rotation.x = Math.PI / 2;
      irisLeft.position.set(0, 1.2, 0);
      group.add(irisLeft);

      const irisRight = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.08, 16, 1, false, 0, Math.PI),
        this.materials.biolumPink
      );
      irisRight.name = 'irisRight';
      irisRight.rotation.x = Math.PI / 2;
      irisRight.position.set(0, 1.2, 0);
      group.add(irisRight);
      return group;
    },
    'lantern_fern_post': () => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 8), this.materials.woodRoot);
      pole.position.y = 1.3;
      group.add(pole);

      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), this.materials.biolumCyan);
      orb.position.y = 2.7;
      group.add(orb);

      return group;
    },
    'bio_forge_station': () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 16), this.materials.porcelainWhite);
      base.position.y = 0.3;
      group.add(base);

      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 1), this.materials.biolumCyan);
      core.name = 'forgeCore';
      core.position.y = 1.1;
      group.add(core);
      return group;
    },
    'cultivation_mound': () => {
      const group = new THREE.Group();
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.22, 16), this.materials.woodRoot);
      mound.position.y = 0.11;
      group.add(mound);
      return group;
    },
    'tamed_snap_trap_turret': () => {
      const group = new THREE.Group();
      // Pedestal
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.58, 0.55, 10),
        this.materials.woodRoot
      );
      pedestal.position.y = 0.275;
      pedestal.castShadow = true;
      group.add(pedestal);

      // Swivel head (named for future targeting in normal/hostile modes)
      const head = new THREE.Group();
      head.name = 'turretHead';
      head.position.y = 0.85;

      const skull = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 12),
        this.materials.porcelainWhite
      );
      skull.castShadow = true;
      head.add(skull);

      // Jaws mirror the wild snap-trap flora so it reads as the same creature
      const jawMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.35,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.5,
      });
      const upperJaw = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 6), jawMat);
      upperJaw.rotation.x = Math.PI / 4;
      upperJaw.position.set(0, 0.18, 0.18);
      const lowerJaw = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 6), jawMat);
      lowerJaw.rotation.x = -Math.PI / 4;
      lowerJaw.position.set(0, -0.18, 0.18);
      head.add(upperJaw);
      head.add(lowerJaw);

      group.add(head);
      return group;
    },
    'spore_canopy': () => {
      const group = new THREE.Group();
      // Four corner posts
      const postGeom = new THREE.CylinderGeometry(0.09, 0.12, 2.4, 8);
      const corners: Array<[number, number]> = [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]];
      corners.forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeom, this.materials.woodRoot);
        post.position.set(px, 1.2, pz);
        post.castShadow = true;
        group.add(post);
      });

      // Dome cap
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.55, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        this.materials.biolumViolet
      );
      dome.position.y = 2.1;
      dome.castShadow = true;
      group.add(dome);

      // Dew-collector orb at the apex (emissive only — no new light, protects the light budget)
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 12),
        this.materials.biolumCyan
      );
      orb.position.y = 3.7;
      group.add(orb);
      return group;
    },
  };
  private droppedItemMeshMap: Map<string, THREE.Group> = new Map();

  // Callbacks
  public callbacks: ThreeEngineCallbacks = {};

  // Shared Materials
  private materials: {
    porcelainWhite: THREE.MeshStandardMaterial;
    chitinGlass: THREE.MeshPhysicalMaterial;
    biolumCyan: THREE.MeshStandardMaterial;
    biolumAmber: THREE.MeshStandardMaterial;
    biolumPink: THREE.MeshStandardMaterial;
    biolumViolet: THREE.MeshStandardMaterial;
    woodRoot: THREE.MeshStandardMaterial;
    ghostValid: THREE.MeshBasicMaterial;
    ghostInvalid: THREE.MeshBasicMaterial;
  };

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

  public requestPointerLock() {
    if (this.controls.isLocked) return;
    this.controls.lock();
  }

  public unlockPointer() {
    if (!this.controls.isLocked) return;
    this.controls.unlock();
  }

  public isPointerLocked(): boolean {
    return this.controls.isLocked;
  }

  public setPlayerPosition(x: number, z: number, level: number = 0) {
    this.cachedPlayerX = x;
    this.cachedPlayerZ = z;
    this.camera.position.x = x;
    this.camera.position.z = z;
    // The player STANDS on the rolling terrain: eye height rides the
    // ground, so crossing a rise lifts the view instead of wading
    // through the hill (structures/floors got the same treatment).
    // Story levels add a wall-height per floor above the ground.
    this.camera.position.y = this.eyeHeight + this.terrainHeightAt(x, z) + level * STORY_HEIGHT;
    this.updateIrisDoorsProximity(x, z);
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
    return (
      Math.sin(x * 0.08) * Math.cos(z * 0.08) * 0.45 +
      Math.sin(x * 0.18 + z * 0.12) * 0.25
    );
  }

  /**
   * Seat a structure (or its placement ghost) on the terrain: height at
   * its center, and — for root-tile floors — a tilt matching the local
   * slope, so the slab hugs the ground like a flagstone instead of
   * clipping into a rise or hovering over a dip. Other structures take
   * the height only: leaning walls would look drunk, and a few cm of
   * settle at the base reads as "set into the ground" anyway.
   */
  private applyTerrainTransform(
    mesh: THREE.Group,
    type: StructureType,
    worldX: number,
    worldZ: number,
    rotation: number,
    level: number = 0
  ): void {
    // Story levels stack on the terrain height: a level-1 wall stands
    // where a level-0 wall's top ends, whatever the ground does below.
    const groundY = this.terrainHeightAt(worldX, worldZ) + level * STORY_HEIGHT;
    if (type !== 'root_tile_floor') {
      mesh.position.set(worldX, groundY, worldZ);
      mesh.rotation.set(0, rotation, 0);
      return;
    }
    mesh.position.set(worldX, groundY + FLOOR_TERRAIN_LIFT, worldZ);
    if (level > 0) {
      // A ceiling floor must be FLAT — it rests on wall tops, not on the
      // hillside. Only ground floors tilt with the terrain.
      mesh.quaternion.copy(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation)
      );
      return;
    }
    const hL = this.terrainHeightAt(worldX - SLOPE_SAMPLE_DISTANCE, worldZ);
    const hR = this.terrainHeightAt(worldX + SLOPE_SAMPLE_DISTANCE, worldZ);
    const hD = this.terrainHeightAt(worldX, worldZ - SLOPE_SAMPLE_DISTANCE);
    const hU = this.terrainHeightAt(worldX, worldZ + SLOPE_SAMPLE_DISTANCE);
    const normal = new THREE.Vector3(
      hL - hR,
      2 * SLOPE_SAMPLE_DISTANCE,
      hD - hU
    ).normalize();
    const tilt = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);
    const yaw = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rotation);
    mesh.quaternion.copy(yaw).multiply(tilt);
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
  public setZoneBiome(biome: BiomeId | null): void {
    if (this.zoneBiome === biome) return;
    this.zoneBiome = biome;
    this.paintTerrainColors();
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
    const tint = this.zoneBiome ? BIOME_TINTS[this.zoneBiome] : null;
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
  public syncFlora(floraList: FloraEntity[]) {
    const activeIds = new Set(floraList.map((f) => f.id));

    this.floraMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.floraGroup.remove(mesh);
        this.floraMeshMap.delete(id);
      }
    });

    floraList.forEach((f) => {
      let mesh = this.floraMeshMap.get(f.id);
      if (!mesh) {
        mesh = this.createFloraMesh(f);
        this.floraGroup.add(mesh);
        this.floraMeshMap.set(f.id, mesh);
      }
      this.updateFloraMesh(mesh, f);
    });
  }

  private createFloraMesh(flora: FloraEntity): THREE.Group {
    const group = new THREE.Group();
    group.userData = { type: 'flora', entity: flora };

    switch (flora.species) {
      case 'lantern_fern': {
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.16, 2.2, 8),
          this.materials.woodRoot
        );
        stalk.position.y = 1.1;
        stalk.castShadow = true;
        group.add(stalk);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), this.materials.biolumCyan);
        bulb.position.set(0, 2.2, 0);
        group.add(bulb);

        break;
      }

      case 'sap_weaver': {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.8, 8), this.materials.woodRoot);
        base.position.y = 0.4;
        group.add(base);

        const sac = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), this.materials.biolumAmber);
        sac.position.y = 1.2;
        sac.scale.set(1, 1.25, 1);
        sac.castShadow = true;
        group.add(sac);

        break;
      }

      case 'petal_mill': {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 1.8, 8), this.materials.woodRoot);
        stem.position.y = 0.9;
        group.add(stem);

        const petalHub = new THREE.Group();
        petalHub.name = 'petalHub';
        petalHub.position.y = 1.8;

        const centerCore = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), this.materials.biolumAmber);
        petalHub.add(centerCore);

        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5;
          const petal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.7), this.materials.biolumPink);
          petal.position.set(Math.sin(angle) * 0.5, 0, Math.cos(angle) * 0.5);
          petal.rotation.y = angle;
          petalHub.add(petal);
        }

        group.add(petalHub);
        break;
      }

      case 'snap_trap': {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 1.2, 8), this.materials.porcelainWhite);
        stalk.position.y = 0.6;
        group.add(stalk);

        const trapHead = new THREE.Group();
        trapHead.name = 'trapHead';
        trapHead.position.y = 1.3;

        const jawMat = new THREE.MeshStandardMaterial({
          color: 0xef4444,
          roughness: 0.3,
          emissive: 0x7f1d1d,
          emissiveIntensity: 0.4,
        });

        const upperJaw = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 6), jawMat);
        upperJaw.name = 'upperJaw';
        upperJaw.rotation.x = Math.PI / 4;
        upperJaw.position.set(0, 0.2, 0.2);

        const lowerJaw = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.8, 6), jawMat);
        lowerJaw.name = 'lowerJaw';
        lowerJaw.rotation.x = -Math.PI / 4;
        lowerJaw.position.set(0, -0.2, 0.2);

        trapHead.add(upperJaw);
        trapHead.add(lowerJaw);
        group.add(trapHead);
        break;
      }

      case 'glow_spore_cluster': {
        // The cave-mouth plant (Adam, 2026-10-14): a low cluster of
        // glowing cyan orbs on short dark stalks — the same blue
        // spheres that used to be pure set dressing at cave mouths,
        // now a real, harvestable plant that grows around them.
        const stalkGeom = new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6);
        const orbOffsets: [number, number, number][] = [
          [0, 0.52, 0], [0.18, 0.4, 0.1], [-0.16, 0.44, -0.08],
          [0.08, 0.34, -0.16], [-0.1, 0.3, 0.15], [0.22, 0.26, -0.14],
        ];
        for (const [ox, oy, oz] of orbOffsets) {
          const stalk = new THREE.Mesh(stalkGeom, this.materials.woodRoot);
          stalk.position.set(ox, oy / 2, oz);
          group.add(stalk);
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), this.materials.biolumCyan);
          orb.position.set(ox, oy, oz);
          group.add(orb);
        }
        break;
      }

      case 'bounce_shroom': {
        // Squat springy stem + a wide violet cap: the trampoline. The
        // cap is named so the render loop can squash it when bounced on.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.45, 8), this.materials.woodRoot);
        stem.position.y = 0.22;
        stem.castShadow = true;
        group.add(stem);

        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), this.materials.biolumViolet);
        cap.name = 'bounceCap';
        cap.scale.set(1, 0.55, 1);
        cap.position.y = 0.5;
        cap.castShadow = true;
        group.add(cap);
        break;
      }

      case 'bell_bloom':
      default: {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 8), this.materials.woodRoot);
        stem.position.y = 0.8;
        group.add(stem);

        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 8, 1, true), this.materials.biolumViolet);
        bell.position.y = 1.6;
        bell.rotation.x = Math.PI;
        group.add(bell);
        break;
      }
    }

    group.position.set(flora.x, this.terrainHeightAt(flora.x, flora.z), flora.z);
    group.rotation.y = flora.rotation;
    return group;
  }

  private updateFloraMesh(mesh: THREE.Group, flora: FloraEntity) {
    mesh.position.set(flora.x, 0, flora.z);
    mesh.userData.entity = flora;
    const baseScale = flora.scale * (0.45 + flora.growthStage * 0.14);
    mesh.scale.set(baseScale, baseScale, baseScale);

    const petalHub = mesh.getObjectByName('petalHub');
    if (petalHub) {
      petalHub.rotation.y += 0.03;
    }
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
        this.faunaMeshMap.delete(id);
        this.faunaWiggleMap.delete(id);
      }
    });

    faunaList.forEach((f) => {
      let mesh = this.faunaMeshMap.get(f.id);
      if (!mesh) {
        mesh = this.createFaunaMesh(f);
        this.faunaGroup.add(mesh);
        this.faunaMeshMap.set(f.id, mesh);
      }
      this.updateFaunaMesh(mesh, f, wiggleDt);
    });
  }

  private createFaunaMesh(fauna: FaunaEntity): THREE.Group {
    const group = new THREE.Group();
    group.userData = { type: 'fauna', entity: fauna };

    switch (fauna.species) {
      case 'soft_puff': {
        const bodyMat = new THREE.MeshStandardMaterial({
          color: fauna.isTamed ? 0x2dd4bf : 0xa7f3d0,
          roughness: 0.4,
          emissive: fauna.isTamed ? 0x0f766e : 0x047857,
          emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 16), bodyMat);
        body.position.y = 0.45;
        body.castShadow = true;
        group.add(body);

        const ant = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), this.materials.biolumCyan);
        ant.position.set(0, 1.0, 0.2);
        group.add(ant);
        break;
      }

      case 'chitin_stalker': {
        const stalkerMat = new THREE.MeshStandardMaterial({
          color: fauna.isTamed ? 0xa855f7 : 0x9333ea,
          roughness: 0.2,
          metalness: 0.2,
          emissive: fauna.isTamed ? 0x581c87 : 0x3b0764,
          emissiveIntensity: 0.4,
        });

        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.38, 0.9, 8, 12), stalkerMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.75;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 6), this.materials.porcelainWhite);
        head.rotation.x = Math.PI / 2;
        head.position.set(0, 0.8, 0.75);
        group.add(head);
        break;
      }

      default: {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), this.materials.biolumAmber);
        body.position.y = 0.3;
        group.add(body);
        break;
      }
    }

    group.position.set(fauna.x, 0, fauna.z);
    group.rotation.y = fauna.rotation;
    return group;
  }

  private updateFaunaMesh(mesh: THREE.Group, fauna: FaunaEntity, wiggleDt = 0) {
    // Creatures stand ON the terrain: their mesh base is the ground
    // height at their position (the simulation itself stays 2D — this
    // is purely where the body is drawn, like the floor treatment).
    const groundY = this.terrainHeightAt(fauna.x, fauna.z);
    mesh.position.set(fauna.x, groundY + fauna.y, fauna.z);
    mesh.rotation.y = fauna.rotation;
    mesh.userData.entity = fauna;

    if (fauna.species === 'soft_puff') {
      const hop = Math.abs(Math.sin(fauna.animTime * 6)) * 0.25;
      mesh.position.y = groundY + hop;
    }

    // Idle-life wiggle (bounded Brownian — see game/motion.ts). Purely how
    // the mesh is DRAWN: the entity's simulated position never changes, so
    // nothing here needs syncing, saving, or pathing around. The offsets
    // are centimeters — a creature breathing in place, not sliding around.
    let wiggle = this.faunaWiggleMap.get(fauna.id);
    if (!wiggle) {
      const flavor = FAUNA_WIGGLE_FLAVORS[fauna.species] ?? FAUNA_WIGGLE_DEFAULT;
      wiggle = new BrownianWiggle(hashStringToSeed(fauna.id), flavor);
      this.faunaWiggleMap.set(fauna.id, wiggle);
    }
    const w = wiggle.update(wiggleDt);
    mesh.position.x += w.x;
    mesh.position.z += w.z;
    mesh.rotation.z = w.rock;
  }

  // --------------------------------------------------------------------------
  // Bio-Structures & Proximity Doors
  // --------------------------------------------------------------------------
  public syncStructures(structuresList: StructureEntity[], playerX?: number, playerZ?: number) {
    const activeIds = new Set(structuresList.map((s) => s.id));

    this.structureMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.structuresGroup.remove(mesh);
        this.structureMeshMap.delete(id);
      }
    });

    structuresList.forEach((s) => {
      let mesh = this.structureMeshMap.get(s.id);
      if (!mesh) {
        mesh = this.createStructureMesh(s);
        this.structuresGroup.add(mesh);
        this.structureMeshMap.set(s.id, mesh);
      }
      this.updateStructureMesh(mesh, s);
    });

    const px = playerX !== undefined ? playerX : this.cachedPlayerX;
    const pz = playerZ !== undefined ? playerZ : this.cachedPlayerZ;
    this.updateIrisDoorsProximity(px, pz);
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
        group.add(this.buildCaveDressing(structure));
      }
    }
    return group;
  }

  /**
   * Render one cave mouth's dressing pieces. The pieces carry WORLD
   * positions (zone-local meters) from the generator; this subgroup
   * counter-rotates the parent group's yaw (applyTerrainTransform set
   * it to the mouth's facing) so children can be placed at plain
   * anchor-relative offsets and land exactly where the generator put
   * them. Piece heights are relative to the anchor's terrain height —
   * pieces sit slightly sunk so gentle slopes never float them.
   */
  private buildCaveDressing(structure: StructureEntity): THREE.Group {
    const sub = new THREE.Group();
    sub.rotation.y = -(structure.rotation ?? 0);
    const facing = structure.rotation ?? 0;
    const rock = new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.95 });
    const rockDark = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.97 });
    const soil = new THREE.MeshStandardMaterial({ color: 0x292019, roughness: 1 });
    const stone = new THREE.MeshStandardMaterial({ color: 0x9c958c, roughness: 0.9 });
    const emberRock = new THREE.MeshStandardMaterial({ color: 0x571f1f, roughness: 0.9, emissive: 0x7c2d12, emissiveIntensity: 0.25 });
    const reed = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.85 });
    const mouthBlack = new THREE.MeshBasicMaterial({ color: 0x030303 });

    for (const piece of structure.cave!.dressing) {
      const dx = piece.x - structure.worldX;
      const dz = piece.z - structure.worldZ;
      const s = piece.scale;
      const childrenBefore = sub.children.length;
      switch (piece.type) {
        case 'cave_mouth': {
          // The opening: a black, flattened dome sunk into the mound,
          // its flat axis aimed along the facing (rotation.y = PI/2 - f
          // maps local +Z onto the facing's XZ direction).
          const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), mouthBlack);
          dome.scale.set(1.25 * s, 0.95 * s, 0.55 * s);
          dome.position.set(dx, 0.72 * s, dz);
          dome.rotation.y = Math.PI / 2 - facing;
          sub.add(dome);

          // The SIGN: a procedurally drawn glow sigil (getCaveSigilTexture)
          // standing TANGENT to the rock at the entrance face — out in
          // front of the opening like a portal ring, bottom near the
          // ground, flanks grazing the boulders — so it reads as the
          // doorway itself, not a mystery glyph embedded in a mountain
          // (Adam, 2026-10-14). Additive-blended, pulsed in
          // updateStructureMesh.
          const sigil = new THREE.Mesh(
            new THREE.PlaneGeometry(3.4 * s, 3.4 * s),
            new THREE.MeshBasicMaterial({
              map: this.getCaveSigilTexture(),
              transparent: true,
              opacity: 0.8,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          sigil.name = 'caveSigil';
          sigil.position.set(dx + Math.cos(facing) * 0.95, 1.4 * s, dz + Math.sin(facing) * 0.95);
          sigil.rotation.y = Math.PI / 2 - facing;
          sub.add(sigil);
          break;
        }
        case 'dark_soil_patch': {
          const patch = new THREE.Mesh(new THREE.CircleGeometry(2.1 * s, 20), soil);
          patch.rotation.x = -Math.PI / 2;
          patch.position.set(dx, 0.03, dz);
          sub.add(patch);
          break;
        }
        case 'rock_lip': {
          const lip = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95 * s, 0), rock);
          lip.position.set(dx, 0.5 * s, dz);
          lip.rotation.set(piece.rotation, piece.rotation * 1.7, 0);
          lip.castShadow = true;
          sub.add(lip);
          break;
        }
        case 'boulder': {
          // Boulders stand TALL (Adam, 2026-10-14: at least 3x taller)
          // — they're the cliff face the mouth is set into, not gravel.
          // Y-stretched 3x and seated so the base stays buried.
          const boulder = new THREE.Mesh(new THREE.DodecahedronGeometry(0.95 * s, 0), rock);
          boulder.scale.set(1.15, 3.0, 1.15);
          boulder.position.set(dx, 1.25 * s, dz);
          boulder.rotation.set(piece.rotation, piece.rotation * 1.7, 0);
          boulder.castShadow = true;
          sub.add(boulder);
          break;
        }
        case 'rubble': {
          const rubble = new THREE.Mesh(new THREE.DodecahedronGeometry(0.4 * s, 0), rockDark);
          rubble.position.set(dx, 0.16, dz);
          rubble.rotation.set(piece.rotation, piece.rotation * 2.3, 0);
          sub.add(rubble);
          break;
        }
        case 'heat_cracked_stone': {
          const cracked = new THREE.Mesh(new THREE.DodecahedronGeometry(0.8 * s, 0), emberRock);
          cracked.position.set(dx, 0.42 * s, dz);
          cracked.rotation.set(piece.rotation, piece.rotation * 1.3, 0);
          sub.add(cracked);
          break;
        }
        case 'path_stone': {
          const stepping = new THREE.Mesh(new THREE.CylinderGeometry(0.55 * s, 0.62 * s, 0.09, 7), stone);
          stepping.position.set(dx, 0.045, dz);
          stepping.rotation.y = piece.rotation;
          sub.add(stepping);
          break;
        }
        case 'glow_spore_cluster':
        case 'glow_fungus_cluster': {
          const glowMat = piece.type === 'glow_fungus_cluster' ? this.materials.biolumViolet : this.materials.biolumCyan;
          for (let i = 0; i < 3; i++) {
            const orb = new THREE.Mesh(new THREE.SphereGeometry(0.09 + i * 0.035, 10, 8), glowMat);
            orb.position.set(dx + (i - 1) * 0.22, 0.12 + i * 0.09, dz + (i % 2 === 0 ? 0.14 : -0.12));
            orb.scale.setScalar(s);
            sub.add(orb);
          }
          break;
        }
        case 'reed_cluster': {
          for (let i = 0; i < 4; i++) {
            const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 1.1 + i * 0.12, 5), reed);
            stalk.position.set(dx + (i - 1.5) * 0.16, 0.55, dz + (i % 2 === 0 ? 0.1 : -0.1));
            stalk.rotation.z = (i - 1.5) * 0.06;
            stalk.scale.setScalar(s);
            sub.add(stalk);
          }
          break;
        }
        case 'ember_vent': {
          const vent = new THREE.Mesh(new THREE.ConeGeometry(0.32 * s, 0.7 * s, 7), rockDark);
          vent.position.set(dx, 0.3 * s, dz);
          sub.add(vent);
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 10, 8), this.materials.biolumAmber);
          glow.position.set(dx, 0.62 * s, dz);
          sub.add(glow);
          break;
        }
      }
      // Only the entrance itself (the 'cave_mouth' piece: dome + sigil)
      // answers hover/click raycasts. Every other dressing piece is
      // scenery — the ray passes through it to whatever is behind.
      if (piece.type !== 'cave_mouth') {
        for (let i = childrenBefore; i < sub.children.length; i++) {
          sub.children[i].traverse((c) => {
            if ((c as THREE.Mesh).isMesh) c.raycast = () => {};
          });
        }
      }
    }
    return sub;
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
  }

  private caveSigilTexture: THREE.CanvasTexture | null = null;

  /**
   * The cave-entrance sigil, drawn PROCEDURALLY on a canvas (no image
   * asset): concentric rings, radial ticks, and a downward chevron
   * motif — "descend here" in precursor sign language — stroked in a
   * cyan-to-violet gradient with a soft shadow glow. Generated once
   * and shared by every cave mouth.
   */
  private getCaveSigilTexture(): THREE.CanvasTexture {
    if (this.caveSigilTexture) return this.caveSigilTexture;
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.translate(size / 2, size / 2);
    const gradient = ctx.createLinearGradient(-110, -110, 110, 110);
    gradient.addColorStop(0, '#67e8f9');
    gradient.addColorStop(0.55, '#38bdf8');
    gradient.addColorStop(1, '#a855f7');
    ctx.strokeStyle = gradient;
    ctx.fillStyle = gradient;
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 16;

    // Outer + inner rings.
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(0, 0, 108, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.85;
    ctx.beginPath();
    ctx.arc(0, 0, 88, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Radial ticks between the rings.
    ctx.lineWidth = 4;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 93, Math.sin(a) * 93);
      ctx.lineTo(Math.cos(a) * 103, Math.sin(a) * 103);
      ctx.stroke();
    }

    // The descend motif: two nested chevrons pointing down over a
    // filled core dot — the mouth, and the way into it.
    ctx.lineWidth = 9;
    for (const yOff of [-34, -2]) {
      ctx.beginPath();
      ctx.moveTo(-38, yOff);
      ctx.lineTo(0, yOff + 30);
      ctx.lineTo(38, yOff);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, 52, 8, 0, Math.PI * 2);
    ctx.fill();

    this.caveSigilTexture = new THREE.CanvasTexture(canvas);
    return this.caveSigilTexture;
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
      pl.intensity = entry.mergedI;
      pl.distance = entry.mergedD;
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
      const sc = entry.mergedD * 0.85;
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
  // First-Person Raycasting & Screen Click
  // --------------------------------------------------------------------------
private initEventListeners() {
// Listen on the container div (not the canvas): during pointer lock the
// browser retargets mouse events to the locked element, so a
// canvas-level listener never fires while locked.
    const el = this.container;

    el.addEventListener('click', () => {
      // If pointer is unlocked, first click requests lock
      if (!this.controls.isLocked) {
        this.requestPointerLock();
        return;
      }

      // If pointer is locked, trigger active tool interaction
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
    const delta = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;
    this.elapsedTime += delta;

    // Invoke authoritative game frame callback
    this.callbacks.onFrame?.(delta);

    // Update reticle hover targets in 1st person (throttled to 10 Hz / every 100ms)
    this.reticleTimer += delta;
    if (this.controls.isLocked && this.reticleTimer >= 0.1) {
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