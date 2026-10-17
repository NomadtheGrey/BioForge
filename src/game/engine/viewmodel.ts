/**
 * BioForge First-Person Viewmodel
 * Renders player hands and active bio-tools in front of the camera
 * Adheres to CODE_MANIFESTO.md Rules 3 (Memoization), 4 (Decoupled), 7 (Disposal)
 */

import * as THREE from 'three';
import { ToolType, StructureType, ItemId } from '../../types/game';

export class FirstPersonViewmodel {
  public root: THREE.Group = new THREE.Group();
  private armGroup: THREE.Group = new THREE.Group();
  private toolHolder: THREE.Group = new THREE.Group();
  private currentTool: ToolType = 'harvest_glove';
  private selectedBlueprint: StructureType = 'root_tile_floor';

  // Tool Sub-Meshes
  private toolMeshes: Map<ToolType, THREE.Group> = new Map();
  private hologramMesh: THREE.Mesh | null = null;
  /** The striker slot's swappable group (weapons build). */
  private strikerGroup: THREE.Group | null = null;

  // Animation States
  private idleTime: number = 0;
  private walkTime: number = 0;
  private attackAnimTime: number = 0;
  private isAttacking: boolean = false;

  // Shared Materials for disposal tracking
  private materials: THREE.Material[] = [];
  private geometries: THREE.BufferGeometry[] = [];

  constructor() {
    this.setupArmAndHands();
    this.setupTools();
    this.root.add(this.armGroup);
    this.root.add(this.toolHolder);

    // Initial position in front of camera
    this.root.position.set(0.3, -0.28, -0.58);
  }

  private registerMaterial<T extends THREE.Material>(mat: T): T {
    this.materials.push(mat);
    return mat;
  }

  private registerGeometry<T extends THREE.BufferGeometry>(geom: T): T {
    this.geometries.push(geom);
    return geom;
  }

  private setupArmAndHands() {
    // Sleek porcelain white explorer bio-arm
    const porcelainMat = this.registerMaterial(
      new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        roughness: 0.25,
        metalness: 0.1,
      })
    );

    const cyanBiolumMat = this.registerMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x06b6d4,
        emissive: 0x06b6d4,
        emissiveIntensity: 0.9,
        roughness: 0.3,
      })
    );

    // Forearm
    const forearmGeom = this.registerGeometry(new THREE.CylinderGeometry(0.065, 0.085, 0.45, 12));
    const forearm = new THREE.Mesh(forearmGeom, porcelainMat);
    forearm.rotation.x = Math.PI / 2.3;
    forearm.rotation.z = -0.25;
    forearm.position.set(0.05, -0.1, 0.2);
    this.armGroup.add(forearm);

    // Glowing wrist cuff
    const cuffGeom = this.registerGeometry(new THREE.TorusGeometry(0.075, 0.015, 8, 16));
    const cuff = new THREE.Mesh(cuffGeom, cyanBiolumMat);
    cuff.rotation.x = Math.PI / 2.3;
    cuff.position.set(0.03, -0.04, 0.08);
    this.armGroup.add(cuff);

    // Palm / Hand Chassis
    const palmGeom = this.registerGeometry(new THREE.BoxGeometry(0.09, 0.05, 0.12));
    const palm = new THREE.Mesh(palmGeom, porcelainMat);
    palm.position.set(0.02, -0.01, -0.02);
    this.armGroup.add(palm);

    // Knuckle Bioluminescent Strip
    const stripGeom = this.registerGeometry(new THREE.BoxGeometry(0.08, 0.015, 0.02));
    const strip = new THREE.Mesh(stripGeom, cyanBiolumMat);
    strip.position.set(0.02, 0.02, -0.04);
    this.armGroup.add(strip);
  }

  private setupTools() {
    // 1. Harvest Glove Tool Head (Glowing Fingertip Beam Nodes)
    const harvestTool = new THREE.Group();
    const beamNodeMat = this.registerMaterial(
      new THREE.MeshStandardMaterial({
        color: 0x2dd4bf,
        emissive: 0x2dd4bf,
        emissiveIntensity: 1.2,
      })
    );
    [-0.03, 0, 0.03].forEach((ox) => {
      const tipGeom = this.registerGeometry(new THREE.SphereGeometry(0.016, 8, 8));
      const tip = new THREE.Mesh(tipGeom, beamNodeMat);
      tip.position.set(ox + 0.02, 0.01, -0.11);
      harvestTool.add(tip);
    });
    this.toolMeshes.set('harvest_glove', harvestTool);

    // 2. Bio-Scanner (Tricorder Reticle & Diode)
    const scannerTool = new THREE.Group();
    const scannerBody = new THREE.Mesh(
      this.registerGeometry(new THREE.BoxGeometry(0.12, 0.06, 0.16)),
      this.registerMaterial(new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.3 }))
    );
    scannerBody.position.set(0.02, 0.04, -0.1);
    scannerTool.add(scannerBody);

    const screenMesh = new THREE.Mesh(
      this.registerGeometry(new THREE.PlaneGeometry(0.09, 0.09)),
      this.registerMaterial(
        new THREE.MeshStandardMaterial({
          color: 0x38bdf8,
          emissive: 0x38bdf8,
          emissiveIntensity: 0.8,
        })
      )
    );
    screenMesh.rotation.x = -Math.PI / 4;
    screenMesh.position.set(0.02, 0.08, -0.07);
    scannerTool.add(screenMesh);
    this.toolMeshes.set('bio_scanner', scannerTool);

    // 3. Planter Trowel (Bio-Seeding Scoop with Sprout Reservoir)
    const trowelTool = new THREE.Group();
    const bladeGeom = this.registerGeometry(new THREE.ConeGeometry(0.06, 0.18, 5));
    const blade = new THREE.Mesh(
      bladeGeom,
      this.registerMaterial(new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2 }))
    );
    blade.rotation.x = Math.PI / 2;
    blade.position.set(0.02, 0.01, -0.16);
    trowelTool.add(blade);

    const seedOrb = new THREE.Mesh(
      this.registerGeometry(new THREE.SphereGeometry(0.028, 8, 8)),
      this.registerMaterial(
        new THREE.MeshStandardMaterial({
          color: 0x4ade80,
          emissive: 0x4ade80,
          emissiveIntensity: 1.0,
        })
      )
    );
    seedOrb.position.set(0.02, 0.04, -0.08);
    trowelTool.add(seedOrb);
    this.toolMeshes.set('planter_trowel', trowelTool);

    // 4. Solvent Sprayer (Enzymatic Dissolving Nozzle)
    const sprayerTool = new THREE.Group();
    const canister = new THREE.Mesh(
      this.registerGeometry(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 10)),
      this.registerMaterial(new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.3 }))
    );
    canister.rotation.x = Math.PI / 2.2;
    canister.position.set(0.02, 0.02, -0.09);
    sprayerTool.add(canister);

    const nozzle = new THREE.Mesh(
      this.registerGeometry(new THREE.ConeGeometry(0.025, 0.08, 8)),
      this.registerMaterial(
        new THREE.MeshStandardMaterial({
          color: 0xf43f5e,
          emissive: 0xf43f5e,
          emissiveIntensity: 0.7,
        })
      )
    );
    nozzle.rotation.x = -Math.PI / 2;
    nozzle.position.set(0.02, 0.03, -0.19);
    sprayerTool.add(nozzle);
    this.toolMeshes.set('solvent_sprayer', sprayerTool);

    // 5. Taming Lure (Honey Blossom Wand)
    const lureTool = new THREE.Group();
    const wandShaft = new THREE.Mesh(
      this.registerGeometry(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 8)),
      this.registerMaterial(new THREE.MeshStandardMaterial({ color: 0x1e3a34, roughness: 0.7 }))
    );
    wandShaft.rotation.x = Math.PI / 2.2;
    wandShaft.position.set(0.02, 0.02, -0.12);
    lureTool.add(wandShaft);

    const nectarBulb = new THREE.Mesh(
      this.registerGeometry(new THREE.DodecahedronGeometry(0.035, 0)),
      this.registerMaterial(
        new THREE.MeshStandardMaterial({
          color: 0xf59e0b,
          emissive: 0xf59e0b,
          emissiveIntensity: 1.1,
        })
      )
    );
    nectarBulb.position.set(0.02, 0.04, -0.22);
    lureTool.add(nectarBulb);
    this.toolMeshes.set('taming_lure', lureTool);

    // 6. Bio-Builder (Holographic Emitter Ring)
    const builderTool = new THREE.Group();
    const projectorBase = new THREE.Mesh(
      this.registerGeometry(new THREE.CylinderGeometry(0.05, 0.06, 0.04, 12)),
      this.registerMaterial(new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4 }))
    );
    projectorBase.position.set(0.02, 0.03, -0.06);
    builderTool.add(projectorBase);

    // Mini Wireframe Rotating Hologram
    const holoGeom = this.registerGeometry(new THREE.BoxGeometry(0.06, 0.06, 0.06));
    const holoMat = this.registerMaterial(
      new THREE.MeshBasicMaterial({
        color: 0xa855f7,
        wireframe: true,
      })
    );
    this.hologramMesh = new THREE.Mesh(holoGeom, holoMat);
    this.hologramMesh.position.set(0.02, 0.1, -0.1);
    builderTool.add(this.hologramMesh);
    this.toolMeshes.set('builder', builderTool);

    // 7. The Striker (weapons build, Adam, 2026-10-16): slot 7's
    // group starts EMPTY and is re-grown by setStriker() whenever
    // the drawn weapon changes — six grown weapons, one shared
    // hand. Default draw until App says otherwise: the Barb.
    this.strikerGroup = new THREE.Group();
    this.toolMeshes.set('striker', this.strikerGroup);
    this.setStriker('briar_barb');

    // Attach all and set visibility
    this.toolMeshes.forEach((mesh) => {
      this.toolHolder.add(mesh);
      mesh.visible = false;
    });

    this.setTool('harvest_glove');
  }

  public setTool(tool: ToolType) {
    if (this.currentTool === tool && this.toolMeshes.get(tool)?.visible) return;
    this.currentTool = tool;

    this.toolMeshes.forEach((mesh, t) => {
      mesh.visible = t === tool;
    });
  }

  public setBlueprint(blueprint: StructureType) {
    this.selectedBlueprint = blueprint;
  }

  /**
   * Re-grow the striker hand around a different weapon (weapons
   * build, 2026-10-16). Called by the engine whenever the drawn
   * weapon changes (slot toggle, tier upgrade, first craft). The
   * six models are grown from the same primitives-and-palette
   * idiom as every other tool: a thorn, a pod, a fang, a puffer,
   * a glass edge, a charged lance — silhouettes distinct enough
   * to read at a glance, colors keyed to their item definitions.
   */
  public setStriker(weaponId: ItemId) {
    if (!this.strikerGroup) return;
    // Clear the old growth (geometries/materials stay registered
    // for disposal; the group just lets go of its children).
    while (this.strikerGroup.children.length > 0) {
      this.strikerGroup.remove(this.strikerGroup.children[0]);
    }
    const grown = new THREE.Group();
    const mat = (color: number, opts?: { emissive?: number; intensity?: number; roughness?: number; transparent?: boolean; opacity?: number }) =>
      this.registerMaterial(
        new THREE.MeshStandardMaterial({
          color,
          roughness: opts?.roughness ?? 0.45,
          emissive: opts?.emissive ?? color,
          emissiveIntensity: opts?.intensity ?? 0,
          transparent: opts?.transparent ?? false,
          opacity: opts?.opacity ?? 1,
        })
      );
    const add = (geom: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, rx = 0, rz = 0) => {
      const mesh = new THREE.Mesh(this.registerGeometry(geom), material);
      mesh.position.set(x, y, z);
      mesh.rotation.x = rx;
      mesh.rotation.z = rz;
      grown.add(mesh);
      return mesh;
    };
    switch (weaponId) {
      case 'briar_barb': {
        // A resin thorn off the knuckle + its shed-scale footing.
        add(new THREE.ConeGeometry(0.02, 0.17, 6), mat(0x65a30d, { roughness: 0.6 }), 0.02, 0.02, -0.17, -Math.PI / 2);
        add(new THREE.SphereGeometry(0.032, 8, 6), mat(0xb45309, { roughness: 0.7 }), 0.02, 0.01, -0.09);
        break;
      }
      case 'spit_pod': {
        // A squeezable pod: squashed bulb, nozzle, spine tips.
        const pod = add(new THREE.SphereGeometry(0.045, 10, 8), mat(0x4ade80, { roughness: 0.35, emissive: 0x4ade80, intensity: 0.25 }), 0.02, 0.03, -0.1);
        pod.scale.set(1, 0.85, 1.35);
        add(new THREE.ConeGeometry(0.016, 0.05, 8), mat(0x166534), 0.02, 0.03, -0.17, -Math.PI / 2);
        [-0.014, 0, 0.014].forEach((ox) =>
          add(new THREE.ConeGeometry(0.005, 0.025, 5), mat(0xd9f99d), 0.02 + ox, 0.045, -0.155, -Math.PI / 2)
        );
        break;
      }
      case 'chitin_fang': {
        // Layered carapace blade, fire-darkened toward the tip.
        add(new THREE.ConeGeometry(0.026, 0.13, 6), mat(0xd97706, { roughness: 0.55 }), 0.02, 0.02, -0.13, -Math.PI / 2);
        add(new THREE.ConeGeometry(0.016, 0.12, 6), mat(0x7c2d12, { roughness: 0.5 }), 0.02, 0.025, -0.22, -Math.PI / 2);
        add(new THREE.SphereGeometry(0.034, 8, 6), mat(0x92400e, { roughness: 0.7 }), 0.02, 0.01, -0.07);
        break;
      }
      case 'spore_puffer': {
        // A fungal bulb with a wide mouth and glowing spore freckles.
        const bulb = add(new THREE.SphereGeometry(0.05, 10, 8), mat(0xa3e635, { roughness: 0.5 }), 0.02, 0.03, -0.1);
        bulb.scale.set(1, 0.9, 1.2);
        add(new THREE.CylinderGeometry(0.032, 0.02, 0.05, 10), mat(0x65a30d), 0.02, 0.03, -0.165, Math.PI / 2);
        [[-0.02, 0.06], [0.025, 0.055], [0.0, 0.075]].forEach(([ox, oy]) =>
          add(new THREE.SphereGeometry(0.007, 6, 6), mat(0xecfccb, { emissive: 0xa3e635, intensity: 1.2 }), 0.02 + ox, oy, -0.13)
        );
        break;
      }
      case 'glass_sting': {
        // A translucent saltglass edge on a pale thread spine.
        add(new THREE.ConeGeometry(0.014, 0.24, 4), mat(0x67e8f9, { transparent: true, opacity: 0.75, emissive: 0x67e8f9, intensity: 0.35, roughness: 0.15 }), 0.02, 0.02, -0.19, -Math.PI / 2);
        add(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 6), mat(0xe2e8f0, { roughness: 0.3 }), 0.02, 0.015, -0.06, Math.PI / 2);
        break;
      }
      case 'storm_lance': {
        // A dark grown shaft, a jagged fulgurite head, and the
        // prismatic heart glowing at the grip.
        add(new THREE.CylinderGeometry(0.009, 0.011, 0.22, 7), mat(0x334155, { roughness: 0.4 }), 0.02, 0.02, -0.13, Math.PI / 2);
        add(new THREE.ConeGeometry(0.013, 0.09, 5), mat(0xfbbf24, { emissive: 0xf59e0b, intensity: 0.8 }), 0.02, 0.02, -0.27, -Math.PI / 2);
        add(new THREE.ConeGeometry(0.008, 0.05, 5), mat(0xfde68a, { emissive: 0xf59e0b, intensity: 1.0 }), 0.03, 0.035, -0.25, -Math.PI / 2, 0.3);
        add(new THREE.SphereGeometry(0.02, 8, 8), mat(0xc084fc, { emissive: 0xa855f7, intensity: 1.4 }), 0.02, 0.03, -0.04);
        break;
      }
      default:
        break;
    }
    this.strikerGroup.add(grown);
  }

  public triggerAction() {
    this.isAttacking = true;
    this.attackAnimTime = 0;
  }

  public update(delta: number, isMoving: boolean) {
    this.idleTime += delta * 2;
    if (isMoving) {
      this.walkTime += delta * 10;
    }

    // Base sway
    let xOffset = 0.3 + Math.sin(this.idleTime * 0.5) * 0.008;
    let yOffset = -0.28 + Math.cos(this.idleTime) * 0.006;
    let zOffset = -0.58;

    // Movement Bobbing
    if (isMoving) {
      xOffset += Math.cos(this.walkTime * 0.5) * 0.018;
      yOffset += Math.abs(Math.sin(this.walkTime)) * 0.025;
    }

    // Action Recoil Animation
    if (this.isAttacking) {
      this.attackAnimTime += delta * 6;
      if (this.attackAnimTime < 1) {
        // Thrust forward and dip
        const progress = Math.sin(this.attackAnimTime * Math.PI);
        zOffset += progress * 0.09;
        yOffset -= progress * 0.03;
      }
      if (this.attackAnimTime >= 1) {
        this.isAttacking = false;
      }
    }

    this.root.position.set(xOffset, yOffset, zOffset);

    // Rotate Hologram for Bio-Builder
    if (this.hologramMesh && this.currentTool === 'builder') {
      this.hologramMesh.rotation.y += delta * 2;
      this.hologramMesh.rotation.x += delta * 1.5;
    }
  }

  public dispose() {
    this.geometries.forEach((g) => g.dispose());
    this.materials.forEach((m) => m.dispose());
    this.geometries = [];
    this.materials = [];
  }
}
