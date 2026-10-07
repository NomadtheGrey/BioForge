/**
 * BioForge First-Person 3D WebGL Engine
 * Full 1st-Person Perspective with PointerLockControls, Eye-level camera, and Viewmodel
 * Adheres to CODE_MANIFESTO.md Rules 1-7
 */

import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js';
import {
  FloraEntity,
  FaunaEntity,
  StructureEntity,
  DroppedItemEntity,
  ToolType,
  StructureType,
  HoverTarget,
} from '../types/game';
import { FirstPersonViewmodel } from './viewmodel';

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
  private floraGroup: THREE.Group = new THREE.Group();
  private faunaGroup: THREE.Group = new THREE.Group();
  private structuresGroup: THREE.Group = new THREE.Group();
  private droppedItemsGroup: THREE.Group = new THREE.Group();
  private particlesGroup: THREE.Group = new THREE.Group();
  private peerMeshes: Map<string, THREE.Group> = new Map();

  // Building Preview Ghost
  private ghostGroup: THREE.Group = new THREE.Group();
  private ghostVisible: boolean = false;

  // Raycasting
  private raycaster: THREE.Raycaster = new THREE.Raycaster();
  private groundPlane: THREE.Plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Spore particles
  private sporeParticles: THREE.Points | null = null;
  private transientParticles: { mesh: THREE.Points | THREE.Mesh; life: number; maxLife: number; vel: THREE.Vector3 }[] = [];

  // Entity mesh maps
  private floraMeshMap: Map<string, THREE.Group> = new Map();
  private faunaMeshMap: Map<string, THREE.Group> = new Map();
  private structureMeshMap: Map<string, THREE.Group> = new Map();
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

  public setPlayerPosition(x: number, z: number) {
    this.camera.position.x = x;
    this.camera.position.z = z;
    this.camera.position.y = this.eyeHeight;
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
  private buildTerrain() {
    const size = 120;
    const segments = 80;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    geometry.rotateX(-Math.PI / 2);

    const positions = geometry.attributes.position;
    const colors: number[] = [];

    const cViolet = new THREE.Color(0x1e122b);
    const cTurquoise = new THREE.Color(0x0e2c2c);
    const cAmber = new THREE.Color(0x2a1a08);
    const cPrismatic = new THREE.Color(0x191838);
    const cPath = new THREE.Color(0x273549);

    for (let i = 0; i < positions.count; i++) {
      const vx = positions.getX(i);
      const vz = positions.getZ(i);

      const h =
        Math.sin(vx * 0.08) * Math.cos(vz * 0.08) * 0.45 +
        Math.sin(vx * 0.18 + vz * 0.12) * 0.25;
      positions.setY(i, h);

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

      const distFromCenter = Math.hypot(vx, vz);
      if (distFromCenter < 12) {
        col.lerp(cPath, ((12 - distFromCenter) / 12) * 0.4);
      }

      colors.push(col.r, col.g, col.b);
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
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
  public updatePeerAvatar(peerId: string, name: string, x: number, z: number, rotation: number, colorHex: string) {
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

    peerGroup.position.set(x, 0, z);
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

        const pointLight = new THREE.PointLight(0x06b6d4, 1.8, 8);
        pointLight.position.set(0, 2.2, 0);
        group.add(pointLight);
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

        const amberLight = new THREE.PointLight(0xf59e0b, 1.5, 7);
        amberLight.position.set(0, 1.2, 0);
        group.add(amberLight);
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

    group.position.set(flora.x, 0, flora.z);
    group.rotation.y = flora.rotation;
    return group;
  }

  private updateFloraMesh(mesh: THREE.Group, flora: FloraEntity) {
    mesh.position.set(flora.x, 0, flora.z);
    mesh.userData.entity = flora;

    const baseScale = flora.scale * (0.45 + flora.growthStage * 0.22);
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

    this.faunaMeshMap.forEach((mesh, id) => {
      if (!activeIds.has(id)) {
        this.faunaGroup.remove(mesh);
        this.faunaMeshMap.delete(id);
      }
    });

    faunaList.forEach((f) => {
      let mesh = this.faunaMeshMap.get(f.id);
      if (!mesh) {
        mesh = this.createFaunaMesh(f);
        this.faunaGroup.add(mesh);
        this.faunaMeshMap.set(f.id, mesh);
      }
      this.updateFaunaMesh(mesh, f);
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

  private updateFaunaMesh(mesh: THREE.Group, fauna: FaunaEntity) {
    mesh.position.set(fauna.x, fauna.y, fauna.z);
    mesh.rotation.y = fauna.rotation;
    mesh.userData.entity = fauna;

    if (fauna.species === 'soft_puff') {
      const hop = Math.abs(Math.sin(fauna.animTime * 6)) * 0.25;
      mesh.position.y = hop;
    }
  }

  // --------------------------------------------------------------------------
  // Bio-Structures & Proximity Doors
  // --------------------------------------------------------------------------
  public syncStructures(structuresList: StructureEntity[], playerX: number, playerZ: number) {
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
      this.updateStructureMesh(mesh, s, playerX, playerZ);
    });
  }

  private createStructureMesh(structure: StructureEntity): THREE.Group {
    const group = new THREE.Group();
    group.userData = { type: 'structure', entity: structure };

    switch (structure.type) {
      case 'root_tile_floor': {
        const floor = new THREE.Mesh(new THREE.BoxGeometry(2, 0.12, 2), this.materials.woodRoot);
        floor.position.y = 0.06;
        floor.receiveShadow = true;
        group.add(floor);
        break;
      }

      case 'chitin_glass_wall': {
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
        break;
      }

      case 'iris_slit_door': {
        const frame = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), this.materials.porcelainWhite);
        frame.position.set(0, 1.2, 0);
        group.add(frame);

        const irisLeft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.85, 0.85, 0.08, 16, 1, false, 0, Math.PI),
          this.materials.biolumPink
        );
        irisLeft.name = 'irisLeft';
        irisLeft.rotation.z = Math.PI / 2;
        irisLeft.position.set(-0.35, 1.2, 0);
        group.add(irisLeft);

        const irisRight = irisLeft.clone();
        irisRight.name = 'irisRight';
        irisRight.rotation.z = -Math.PI / 2;
        irisRight.position.x = 0.35;
        group.add(irisRight);
        break;
      }

      case 'lantern_fern_post': {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 8), this.materials.woodRoot);
        pole.position.y = 1.3;
        group.add(pole);

        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), this.materials.biolumCyan);
        orb.position.y = 2.7;
        group.add(orb);

        const light = new THREE.PointLight(0x06b6d4, 2.4, 12);
        light.position.y = 2.7;
        group.add(light);
        break;
      }

      case 'bio_forge_station': {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 16), this.materials.porcelainWhite);
        base.position.y = 0.3;
        group.add(base);

        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 1), this.materials.biolumCyan);
        core.name = 'forgeCore';
        core.position.y = 1.1;
        group.add(core);
        break;
      }

      case 'cultivation_mound': {
        const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.22, 16), this.materials.woodRoot);
        mound.position.y = 0.11;
        group.add(mound);
        break;
      }
    }

    group.position.set(structure.worldX, 0, structure.worldZ);
    group.rotation.y = structure.rotation;
    return group;
  }

  private updateStructureMesh(
    mesh: THREE.Group,
    structure: StructureEntity,
    playerX: number,
    playerZ: number
  ) {
    mesh.position.set(structure.worldX, 0, structure.worldZ);
    mesh.rotation.y = structure.rotation;
    mesh.userData.entity = structure;

    const forgeCore = mesh.getObjectByName('forgeCore');
    if (forgeCore) {
      forgeCore.rotation.y += 0.03;
    }

    if (structure.type === 'iris_slit_door') {
      const dist = Math.hypot(playerX - structure.worldX, playerZ - structure.worldZ);
      const isNearby = dist < 2.5;

      const targetProgress = isNearby ? 1.0 : 0.0;
      structure.doorOpenProgress += (targetProgress - structure.doorOpenProgress) * 0.15;

      const irisLeft = mesh.getObjectByName('irisLeft');
      const irisRight = mesh.getObjectByName('irisRight');
      if (irisLeft && irisRight) {
        irisLeft.position.x = -0.35 - structure.doorOpenProgress * 0.55;
        irisRight.position.x = 0.35 + structure.doorOpenProgress * 0.55;
      }
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
      mesh.position.set(item.x, 0.35 + Math.sin(item.bobTime * 4) * 0.1, item.z);
      mesh.rotation.y += 0.04;
    });
  }

  // --------------------------------------------------------------------------
  // Ghost Hologram (Building Preview in First Person)
  // --------------------------------------------------------------------------
  private setupGhostHologram() {
    this.ghostGroup.clear();
    const boxGeom = new THREE.BoxGeometry(2, 2, 2);
    const box = new THREE.Mesh(boxGeom, this.materials.ghostValid);
    box.name = 'ghostMesh';
    this.ghostGroup.add(box);
    this.ghostGroup.visible = false;
  }

  public setGhostPreview(
    type: StructureType,
    visible: boolean,
    gridX: number,
    gridZ: number,
    rotation: number,
    valid: boolean
  ) {
    this.ghostVisible = visible;
    this.ghostGroup.visible = visible;
    if (!visible) return;

    this.ghostGroup.position.set(gridX * 2, 0.05, gridZ * 2);
    this.ghostGroup.rotation.y = rotation;

    const ghostMesh = this.ghostGroup.getObjectByName('ghostMesh') as THREE.Mesh;
    if (!ghostMesh) return;

    ghostMesh.material = valid ? this.materials.ghostValid : this.materials.ghostInvalid;
    if (type === 'root_tile_floor' || type === 'cultivation_mound') {
      ghostMesh.scale.set(1.9, 0.1, 1.9);
      ghostMesh.position.y = 0.05;
    }
    if (type !== 'root_tile_floor' && type !== 'cultivation_mound') {
      ghostMesh.scale.set(1.9, 2.0, 0.3);
      ghostMesh.position.y = 1.0;
    }
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
    points.position.set(x, 0, z);
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
    points.position.set(x, 0, z);
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
    const el = this.renderer.domElement;

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
          details: `Stage: ${f.growthStage}/3 ${f.harvestReady ? '• [READY TO HARVEST]' : '• Growing'}`,
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
          details: `${fn.isTamed ? 'TAMED • Companion' : 'WILD • Lure to tame'} [HP: ${fn.health}/${fn.maxHealth}]`,
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
          details: `Integrity: ${s.health}/${s.maxHealth} (Solvent Recyclable)`,
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

    // Update reticle hover targets in 1st person
    if (this.controls.isLocked) {
      this.updateReticleAim();
    }

    // Animate botanical pollen / spore motes with gentle, frame-rate independent drift
    if (this.sporeParticles) {
      const positions = this.sporeParticles.geometry.attributes.position;
      const count = positions.count;
      for (let i = 0; i < count; i++) {
        let px = positions.getX(i);
        let py = positions.getY(i);
        let pz = positions.getZ(i);

        // Gentle floating drift scaled strictly by delta (calm botanical ambient motion)
        px += Math.cos(this.elapsedTime * 0.35 + i * 0.4) * 0.35 * delta;
        py += Math.sin(this.elapsedTime * 0.5 + i * 0.6) * 0.25 * delta;
        pz += Math.sin(this.elapsedTime * 0.25 + i * 0.3) * 0.35 * delta;

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
