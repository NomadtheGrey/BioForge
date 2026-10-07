/**
 * BioForge First-Person Viewmodel
 * Renders player hands and active bio-tools in front of the camera
 * Adheres to CODE_MANIFESTO.md Rules 3 (Memoization), 4 (Decoupled), 7 (Disposal)
 */

import * as THREE from 'three';
import { ToolType, StructureType } from '../types/game';

export class FirstPersonViewmodel {
  public root: THREE.Group = new THREE.Group();
  private armGroup: THREE.Group = new THREE.Group();
  private toolHolder: THREE.Group = new THREE.Group();
  private currentTool: ToolType = 'harvest_glove';
  private selectedBlueprint: StructureType = 'root_tile_floor';

  // Tool Sub-Meshes
  private toolMeshes: Map<ToolType, THREE.Group> = new Map();
  private hologramMesh: THREE.Mesh | null = null;

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
