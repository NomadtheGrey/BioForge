/**
 * BioForge landmark dressing factories (extracted from
 * threeEngine.ts, 2026-10-14 — pure move, no behavior change).
 *
 * Cave mouths and ruin landmarks wear GENERATED dressing (boulders,
 * gates, the sigil) built once from the entity's own link record.
 * Same shared-materials factory seam as game/structureBuilders.ts;
 * the procedurally drawn cave sigil texture is generated once and
 * cached in this closure, shared by every mouth.
 */
import * as THREE from 'three';
import type { StructureEntity } from '../types/game';
import type { StructureMaterials } from './structureBuilders';
import { FATE_STYLES, type WorldFate } from './ruins';

export interface LandmarkDressing {
  buildCaveDressing(structure: StructureEntity): THREE.Group;
  buildRuinDressing(structure: StructureEntity): THREE.Group;
}

export function createLandmarkDressing(materials: StructureMaterials): LandmarkDressing {

  let sigilTexture: THREE.CanvasTexture | null = null;

  /**
   * The cave-entrance sigil, drawn PROCEDURALLY on a canvas (no image
   * asset): concentric rings, radial ticks, and a downward chevron
   * motif — "descend here" in precursor sign language — stroked in a
   * cyan-to-violet gradient with a soft shadow glow. Generated once
   * and shared by every cave mouth.
   */
  function getCaveSigilTexture(): THREE.CanvasTexture {
    if (sigilTexture) return sigilTexture;
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

    sigilTexture = new THREE.CanvasTexture(canvas);
    return sigilTexture;
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
  function buildCaveDressing(structure: StructureEntity): THREE.Group {
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
          // THE PORTAL BOULDER (Adam, 2026-10-14): one large rock whose
          // outward face IS the entrance. It carries everything — the
          // shaded opening sunk into its face, and the glow sigil stuck
          // tangent onto its outside — instead of the sigil floating
          // among the rubble boulders, embedded and unreachable.
          // A flattened sphere: its convex front face sits ~0.35 m
          // behind the anchor (rotation.y = PI/2 - f maps local +Z
          // onto the facing's XZ direction). Scenery, not a hover
          // target — the opening and its sign speak for the entrance.
          const portalRock = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 18), rock);
          portalRock.name = 'portalRock';
          portalRock.scale.set(2.0 * s, 2.1 * s, 1.1 * s);
          portalRock.position.set(dx - Math.cos(facing) * 1.45, 1.45 * s, dz - Math.sin(facing) * 1.45);
          portalRock.rotation.y = Math.PI / 2 - facing;
          portalRock.castShadow = true;
          portalRock.raycast = () => {};
          sub.add(portalRock);

          // The opening: a black, flattened dome sunk INTO the portal
          // rock's face — the shaded hollow that reads as the cave
          // entrance itself, protruding just enough to catch the edge
          // of the dark.
          const dome = new THREE.Mesh(new THREE.SphereGeometry(1.15, 20, 14), mouthBlack);
          dome.scale.set(1.25 * s, 0.95 * s, 0.55 * s);
          dome.position.set(dx - Math.cos(facing) * 0.3, 0.72 * s, dz - Math.sin(facing) * 0.3);
          dome.rotation.y = Math.PI / 2 - facing;
          sub.add(dome);

          // The SIGN: the procedurally drawn glow sigil
          // (getCaveSigilTexture) stuck TANGENT to the portal rock's
          // face — its plane touches the convex rock at the face's
          // center point (just proud of it) and kisses away at the
          // edges, like a plate mounted on the stone. Sized to fit
          // the boulder that holds it. Additive-blended, pulsed in
          // updateStructureMesh.
          const sigil = new THREE.Mesh(
            new THREE.PlaneGeometry(2.9 * s, 2.9 * s),
            new THREE.MeshBasicMaterial({
              map: getCaveSigilTexture(),
              transparent: true,
              opacity: 0.8,
              blending: THREE.AdditiveBlending,
              depthWrite: false,
              side: THREE.DoubleSide,
            }),
          );
          sigil.name = 'caveSigil';
          sigil.position.set(dx - Math.cos(facing) * 0.28, 1.5 * s, dz - Math.sin(facing) * 0.28);
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
          const glowMat = piece.type === 'glow_fungus_cluster' ? materials.biolumViolet : materials.biolumCyan;
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
          const glow = new THREE.Mesh(new THREE.SphereGeometry(0.13 * s, 10, 8), materials.biolumAmber);
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

  /**
   * Render one ruin landmark: its dressing pieces (broken stone in the
   * world's fate tint — game/ruins.ts FATE_STYLES) plus, for any tier
   * above traces, the GATE: two standing pillars and a lintel at the
   * anchor, with a threshold stone that alone answers the raycaster
   * (hovering rubble must not report the ruin, same rule as caves).
   * Same counter-rotated subgroup convention as buildCaveDressing:
   * piece positions are anchor-relative world offsets.
   */
  function buildRuinDressing(structure: StructureEntity): THREE.Group {
    const sub = new THREE.Group();
    sub.rotation.y = -(structure.rotation ?? 0);
    const facing = structure.rotation ?? 0;
    const ruin = structure.ruin!;
    // The fate tints the stone: grey rock pulled toward the fate's
    // color, so one world's ruins read differently from another's
    // before a single clue is understood.
    const fateTint = new THREE.Color(FATE_STYLES[ruin.fate as WorldFate]?.tint ?? 0xa8a29e);
    const stoneColor = new THREE.Color(0x8a8378).lerp(fateTint, 0.38);
    const stone = new THREE.MeshStandardMaterial({ color: stoneColor, roughness: 0.92 });
    const stoneDark = new THREE.MeshStandardMaterial({ color: stoneColor.clone().multiplyScalar(0.62), roughness: 0.95 });
    const silent = (m: THREE.Mesh): THREE.Mesh => {
      m.raycast = () => {};
      m.castShadow = true;
      return m;
    };

    for (const piece of ruin.dressing) {
      const dx = piece.x - structure.worldX;
      const dz = piece.z - structure.worldZ;
      const s = piece.scale;
      switch (piece.type) {
        case 'pillar': {
          const m = silent(new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.6, 0.72), stone));
          m.position.set(dx, 1.3 * s - 0.18, dz);
          m.rotation.set(Math.sin(piece.rotation) * 0.05, piece.rotation, Math.cos(piece.rotation) * 0.05);
          m.scale.setScalar(s);
          sub.add(m);
          break;
        }
        case 'toppled_pillar': {
          const m = silent(new THREE.Mesh(new THREE.BoxGeometry(0.72, 2.6, 0.72), stoneDark));
          m.position.set(dx, 0.36 * s, dz);
          m.rotation.set(0, piece.rotation, Math.PI / 2 - 0.06);
          m.scale.setScalar(s);
          sub.add(m);
          break;
        }
        case 'wall_stub': {
          const m = silent(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.95, 0.5), stone));
          m.position.set(dx, 0.42 * s, dz);
          m.rotation.y = piece.rotation;
          m.scale.setScalar(s);
          sub.add(m);
          break;
        }
        case 'arch_fragment': {
          const m = silent(new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.42, 0.55), stoneDark));
          m.position.set(dx, 0.24 * s, dz);
          m.rotation.set(0.12, piece.rotation, 0.08);
          m.scale.setScalar(s);
          sub.add(m);
          break;
        }
        case 'shard': {
          const m = silent(new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.15, 5), stone));
          m.position.set(dx, 0.5 * s, dz);
          m.rotation.y = piece.rotation;
          m.scale.setScalar(s);
          sub.add(m);
          break;
        }
        case 'rubble': {
          const m = silent(new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), stoneDark));
          m.position.set(dx, 0.22 * s, dz);
          m.rotation.set(piece.rotation, piece.rotation * 1.7, 0);
          m.scale.set(s, s * 0.55, s);
          sub.add(m);
          break;
        }
      }
    }

    // THE GATE (not for traces — a remnant has no door): two pillars
    // flanking the approach and the lintel that joins them, all
    // raycast-silent scenery; the THRESHOLD stone between them is
    // the one interactive piece, the ruin's doorstep.
    if (ruin.tier !== 'traces') {
      const perpX = -Math.sin(facing);
      const perpZ = Math.cos(facing);
      const gate = new THREE.Group();
      gate.name = 'ruinGate';
      for (const sideSign of [-1, 1]) {
        const pillar = silent(new THREE.Mesh(new THREE.BoxGeometry(0.78, 3.1, 0.78), stone));
        pillar.position.set(perpX * 1.7 * sideSign + Math.cos(facing) * 0.4, 1.38, perpZ * 1.7 * sideSign + Math.sin(facing) * 0.4);
        gate.add(pillar);
      }
      const lintel = silent(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.55, 4.3), stoneDark));
      lintel.position.set(Math.cos(facing) * 0.4, 3.05, Math.sin(facing) * 0.4);
      lintel.rotation.y = Math.PI / 2 - facing;
      gate.add(lintel);
      gate.traverse((o) => {
        if ((o as THREE.Mesh).isMesh) o.raycast = () => {};
      });
      sub.add(gate);

      const threshold = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.22, 2.6), stoneDark);
      threshold.name = 'ruinThreshold';
      threshold.position.set(Math.cos(facing) * 0.95, 0.1, Math.sin(facing) * 0.95);
      threshold.rotation.y = Math.PI / 2 - facing;
      threshold.castShadow = true;
      sub.add(threshold);
    }
    return sub;
  }

  return { buildCaveDressing, buildRuinDressing };
}
