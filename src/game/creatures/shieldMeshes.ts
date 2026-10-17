/**
 * The shield family's grown geometry (Adam, 2026-10-17).
 *
 * Overlapping curved scute plates on a root/resin frame, built
 * from the Grown Look kit textures (grownTextures.ts). The lamp is
 * grown into the face on T2/T3; thorn spikes cross the face when
 * grafted; the Fenback's plates wrap wider so the rear coverage
 * reads in the silhouette.
 *
 * Geometry is built ONCE per shield (world and viewmodel share
 * the builder); state changes stir the NAMED parts — face, frame,
 * lamp, spikes, tendrils, wardArc — the way the structure life
 * passes stir named parts.
 */

import * as THREE from 'three';
import {
  barkTexture,
  jitterVertices,
  rootGrainTexture,
  wovenTexture,
} from '../structures/grownTextures';

// Named parts, so state changes stir them without rebuilding.
export const SHIELD_PARTS = {
  face: 'shield-face',
  frame: 'shield-frame',
  lamp: 'shield-lamp',
  spikes: 'shield-spikes',
  tendrils: 'shield-tendrils',
  wardArc: 'shield-ward-arc',
} as const;

interface ShieldMaterials {
  scute: THREE.MeshStandardMaterial;
  scuteDark: THREE.MeshStandardMaterial;
  root: THREE.MeshStandardMaterial;
  resin: THREE.MeshStandardMaterial;
  lamp: THREE.MeshStandardMaterial;
  spike: THREE.MeshStandardMaterial;
  tendril: THREE.MeshStandardMaterial;
  ward: THREE.MeshBasicMaterial;
}

let materials: ShieldMaterials | null = null;

/** Shared materials — built once, reused by every shield mesh. */
function getMaterials(): ShieldMaterials {
  if (!materials) {
    materials = {
      scute: new THREE.MeshStandardMaterial({
        map: barkTexture(11),
        color: 0x9db87a, // marsh-green scute
        roughness: 0.75,
        metalness: 0.05,
      }),
      scuteDark: new THREE.MeshStandardMaterial({
        map: wovenTexture(12),
        color: 0x6d8a52,
        roughness: 0.85,
        metalness: 0.05,
      }),
      root: new THREE.MeshStandardMaterial({
        map: rootGrainTexture(13),
        color: 0x7a5c3e,
        roughness: 0.9,
      }),
      resin: new THREE.MeshStandardMaterial({
        map: rootGrainTexture(14),
        color: 0xc98f2e,
        roughness: 0.45,
        emissive: 0x3a2200,
        emissiveIntensity: 0.4,
      }),
      lamp: new THREE.MeshStandardMaterial({
        color: 0xdcfce7,
        emissive: 0x86efac, // Hand Lantern-Fern green
        emissiveIntensity: 1.6,
        roughness: 0.3,
      }),
      spike: new THREE.MeshStandardMaterial({
        map: barkTexture(15),
        color: 0x4d5b2f,
        roughness: 0.7,
      }),
      tendril: new THREE.MeshStandardMaterial({
        map: rootGrainTexture(16),
        color: 0x5c4a30,
        roughness: 0.95,
      }),
      ward: new THREE.MeshBasicMaterial({
        color: 0xbef264, // fen-spore pale green
        transparent: true,
        opacity: 0.28,
        side: THREE.DoubleSide,
        depthWrite: false,
      }),
    };
  }
  return materials;
}

export interface BuildShieldOptions {
  /** Thrown across the face when the spike graft is grown. */
  grafted?: boolean;
  /** The Fenback's rooted tendrils (shown while braced). */
  tendrilsVisible?: boolean;
  /** The shared-cover ward arc (shown while a Fenback is braced). */
  wardArcVisible?: boolean;
}

/**
 * Builds a grown shield for the given tier. The shield faces +Z;
 * the holder stands behind it at -Z. Named children:
 *   shield-face / shield-frame / shield-lamp /
 *   shield-spikes / shield-tendrils / shield-ward-arc.
 */
export function buildShieldMesh(tier: 1 | 2 | 3, opts: BuildShieldOptions = {}): THREE.Group {
  const mats = getMaterials();
  const shield = new THREE.Group();

  // --- FACE: overlapping curved scute plates. The Fenback's
  // plates wrap wider (a deeper fan) so the rear coverage reads
  // in the silhouette.
  const face = new THREE.Group();
  face.name = SHIELD_PARTS.face;
  const plateSpan = tier === 3 ? 2.1 : tier === 2 ? 1.8 : 1.6;
  const plateCount = tier === 3 ? 9 : 7;
  for (let i = 0; i < plateCount; i++) {
    const t = i / (plateCount - 1) - 0.5;
    const plateGeom = new THREE.SphereGeometry(0.42, 10, 8, 0, Math.PI * 1.1, 0, Math.PI * 0.55);
    jitterVertices(plateGeom, 0.03, 40 + i);
    const plate = new THREE.Mesh(plateGeom, i % 2 === 0 ? mats.scute : mats.scuteDark);
    const angle = t * plateSpan;
    plate.position.set(Math.sin(angle) * 0.55, -0.06 + Math.cos(angle) * 0.1, -Math.abs(t) * 0.12);
    plate.rotation.set(-Math.PI / 2 + 0.35, angle, 0, 'YXZ');
    plate.scale.set(1.15 - Math.abs(t) * 0.3, 1.3 - Math.abs(t) * 0.25, 1);
    face.add(plate);
  }
  shield.add(face);

  // --- FRAME: a root/resin ring the plates are sewn onto, with a
  // resin boss at the hub.
  const frame = new THREE.Group();
  frame.name = SHIELD_PARTS.frame;
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.055, 8, 28), mats.root);
  rim.rotation.x = Math.PI / 2;
  jitterVertices(rim.geometry, 0.02, 77);
  frame.add(rim);
  const boss = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mats.resin);
  boss.position.set(0, 0, 0.06);
  boss.scale.z = 0.6;
  frame.add(boss);
  // Root ribs across the back.
  for (let i = -1; i <= 1; i++) {
    const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.036, 1.15, 6), mats.root);
    rib.position.set(i * 0.28, 0, -0.05);
    rib.rotation.z = i * 0.35;
    jitterVertices(rib.geometry, 0.015, 90 + i);
    frame.add(rib);
  }
  shield.add(frame);

  // --- LAMP: the Hand Lantern-Fern grown into the face (T2/T3).
  const lamp = new THREE.Group();
  lamp.name = SHIELD_PARTS.lamp;
  if (tier >= 2) {
    const pod = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), mats.lamp);
    pod.position.set(0, 0.18, 0.1);
    pod.scale.set(1, 1.25, 0.8);
    lamp.add(pod);
    // Fern fronds cradling the pod.
    for (let i = 0; i < 6; i++) {
      const frond = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.3, 5), mats.scuteDark);
      const a = (i / 6) * Math.PI * 2;
      frond.position.set(Math.cos(a) * 0.14, 0.18 + Math.sin(a) * 0.14, 0.08);
      frond.rotation.z = a + Math.PI / 2;
      frond.rotation.x = 0.5;
      lamp.add(frond);
    }
  }
  shield.add(lamp);

  // --- SPIKES: organic thorn spikes across the face when grafted.
  const spikes = new THREE.Group();
  spikes.name = SHIELD_PARTS.spikes;
  spikes.visible = !!opts.grafted;
  if (opts.grafted) {
    const spikeSpots: Array<[number, number, number]> = [
      [-0.32, 0.28, 0.12], [0.32, 0.28, 0.12], [0, 0.02, 0.16],
      [-0.42, -0.08, 0.06], [0.42, -0.08, 0.06], [-0.2, -0.3, 0.08],
      [0.2, -0.3, 0.08], [0, 0.42, 0.1],
    ];
    spikeSpots.forEach(([sx, sy, sz], i) => {
      const len = 0.22 + (i % 3) * 0.06;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.045, len, 6), mats.spike);
      spike.position.set(sx, sy, sz + len * 0.4);
      spike.rotation.x = Math.PI / 2 - 0.25 + (i % 2) * 0.12;
      spike.rotation.y = sx * 0.8;
      jitterVertices(spike.geometry, 0.01, 120 + i);
      spikes.add(spike);
    });
  }
  shield.add(spikes);

  // --- TENDRILS: root tendrils at the shield's base — the Rooted
  // Stance presentation, stirred visible while a Fenback is braced.
  const tendrils = new THREE.Group();
  tendrils.name = SHIELD_PARTS.tendrils;
  tendrils.visible = !!opts.tendrilsVisible;
  for (let i = 0; i < 5; i++) {
    const a = (i / 4 - 0.5) * 1.6;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(Math.sin(a) * 0.3, -0.55, 0),
      new THREE.Vector3(Math.sin(a) * 0.45, -0.8, 0.06),
      new THREE.Vector3(Math.sin(a) * 0.62, -1.0, 0.02),
    ]);
    const tendril = new THREE.Mesh(new THREE.TubeGeometry(curve, 8, 0.03, 5), mats.tendril);
    tendrils.add(tendril);
  }
  shield.add(tendrils);

  // --- WARD ARC: the faint lee marker behind a braced Fenback —
  // a shallow curved shell in fen-spore green, behind the bearer.
  const wardArc = new THREE.Group();
  wardArc.name = SHIELD_PARTS.wardArc;
  wardArc.visible = !!opts.wardArcVisible;
  const arcGeom = new THREE.CylinderGeometry(2.2, 2.2, 1.6, 24, 1, true, Math.PI * 0.72, Math.PI * 0.56);
  const arc = new THREE.Mesh(arcGeom, mats.ward);
  arc.position.y = 0.8;
  wardArc.add(arc);
  shield.add(wardArc);

  return shield;
}

/** Stir the named parts for state — no rebuilds. */
export function setShieldPartVisible(shield: THREE.Group, part: (typeof SHIELD_PARTS)[keyof typeof SHIELD_PARTS], visible: boolean): void {
  const found = shield.getObjectByName(part);
  if (found) found.visible = visible;
}
