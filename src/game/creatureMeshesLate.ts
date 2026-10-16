/**
 * BioForge fauna mesh factories, late waves (extracted from
 * creatureMeshes.ts in creature slice 17, 2026-10-16 — the main
 * file crossed the ~131K single-push cap after three waves of
 * cases; same relief pattern as floraMeshes.ts in slice 10).
 *
 * This module carries the fauna mesh cases from slice 15 onward.
 * createFaunaMesh in creatureMeshes.ts delegates here FIRST: a
 * non-null return is the finished group; null falls through to
 * the main switch (whose default still never crashes).
 */
import * as THREE from 'three';
import type { FaunaEntity } from '../types/game';
import type { StructureMaterials } from './structureBuilders';

export function buildLateFaunaMesh(
  fauna: FaunaEntity,
  materials: StructureMaterials,
  terrainHeightAt: (x: number, z: number) => number,
): THREE.Group | null {
  const group = new THREE.Group();
  // terrainHeightAt: some late draws stand on sampled ground inside
  // the case body; kept in the signature for parity with the main kit.
  void terrainHeightAt;
  switch (fauna.species) {
      case 'stillmouth': {
        // A fixture (slice 15): a radial crown of filtering
        // fans around a central mouth, on a stone collar.
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.12, 10), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 }));
        collar.position.y = 0.06;
        group.add(collar);
        const fanMat = new THREE.MeshStandardMaterial({
          color: 0x2dd4bf, roughness: 0.5, side: THREE.DoubleSide,
          emissive: 0x0f766e, emissiveIntensity: 0.35,
        });
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const fan = new THREE.Mesh(new THREE.CircleGeometry(0.13, 7, 0, Math.PI), fanMat);
          fan.position.set(Math.cos(a) * 0.16, 0.3, Math.sin(a) * 0.16);
          fan.rotation.set(0.5, -a + Math.PI / 2, 0);
          group.add(fan);
        }
        const mouth = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0x134e4a, roughness: 0.6 }));
        mouth.position.y = 0.18;
        group.add(mouth);
        break;
      }

      case 'pale_grazer': {
        // The color of the country it eats (slice 15): a
        // bone-pale grazer with shed-ready antler nubs.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.7, 8, 12), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.78;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), hideMat);
        head.scale.set(0.85, 0.9, 1.25);
        head.position.set(0, 0.92, 0.68);
        group.add(head);
        const nubMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.8 });
        for (const side of [-1, 1]) {
          const nub = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.1, 5), nubMat);
          nub.position.set(side * 0.09, 1.08, 0.6);
          group.add(nub);
        }
        break;
      }

      case 'amber_snail': {
        // On display, unbothered (slice 15): a snail inside a
        // translucent amber shell the river half-claimed.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.7 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bodyMat);
        body.scale.set(1, 0.6, 1.6);
        body.position.set(0, 0.05, 0.08);
        group.add(body);
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({
          color: 0xf59e0b, roughness: 0.25, transparent: true, opacity: 0.75,
          emissive: 0x92400e, emissiveIntensity: 0.3,
        }));
        shell.position.set(0, 0.13, -0.08);
        group.add(shell);
        break;
      }

      case 'sapwing': {
        // A living pane (slice 15): translucent gold wings
        // grown into their span — a glider's draw.
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24, roughness: 0.3, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
          emissive: 0x92400e, emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 }));
        body.scale.set(0.85, 0.85, 1.5);
        group.add(body);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.28, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.05;
          group.add(wing);
        }
        break;
      }

      case 'vent_wisp': {
        // Only ever fully THERE in steam (slice 17): a soft
        // ember-lit vapor puff, translucent, breathing light.
        const wispMat = new THREE.MeshStandardMaterial({
          color: 0xfdba74, roughness: 1, transparent: true, opacity: 0.6,
          emissive: 0xea580c, emissiveIntensity: 0.7,
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), wispMat);
        core.scale.y = 1.3;
        group.add(core);
        const wisp2 = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), wispMat);
        wisp2.position.set(0.08, 0.14, 0.04);
        group.add(wisp2);
        break;
      }

      case 'brambleback': {
        // A garden that walks (slice 17): a quadruped under a
        // thicket of soft spines, every spine seeded.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), hideMat);
        body.scale.set(1, 0.9, 1.3);
        body.position.y = 0.42;
        body.castShadow = true;
        group.add(body);
        const spineMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.9 });
        for (let i = 0; i < 9; i++) {
          const spine = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.16, 5), spineMat);
          spine.position.set(((i % 3) - 1) * 0.14, 0.68, ((Math.floor(i / 3)) - 1) * 0.2);
          spine.rotation.z = ((i % 3) - 1) * -0.3;
          group.add(spine);
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), hideMat);
        head.scale.set(0.9, 0.9, 1.1);
        head.position.set(0, 0.4, 0.42);
        group.add(head);
        break;
      }

      case 'static_crab': {
        // Mostly sides (slice 17): a wide crystal-shelled crab
        // with copper joints and a bristle back.
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.25, metalness: 0.2,
          emissive: 0x155e75, emissiveIntensity: 0.35,
        });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), shellMat);
        shell.scale.set(1.35, 0.55, 1);
        shell.position.y = 0.16;
        group.add(shell);
        const legMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.4, metalness: 0.7 });
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.3, 4), legMat);
            leg.position.set(side * 0.28, 0.08, 0.1 - i * 0.1);
            leg.rotation.z = side * 1.0;
            group.add(leg);
          }
        }
        const bristleMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xa16207, emissiveIntensity: 0.6, roughness: 0.6 });
        for (let i = 0; i < 5; i++) {
          const bristle = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.09, 4), bristleMat);
          bristle.position.set((i - 2) * 0.07, 0.28, 0);
          group.add(bristle);
        }
        break;
      }

      case 'dust_hawk': {
        // The middle sky's accounts (slice 17): a pale-barred,
        // long-winged glider.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xd6d3a8, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xc9c29a, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), featherMat);
        body.scale.set(0.9, 0.9, 1.4);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), featherMat);
        head.position.set(0, 0.03, 0.14);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.2), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.35, 0.03, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.06;
          group.add(wing);
        }
        break;
      }

      case 'bonebreaker': {
        // The foreman (slice 17): shoulder-high and
        // jaw-heavy — the sloped hyena back, drawn honestly.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x8a7a63, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 8, 12), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.set(0, 0.62, -0.05);
        body.rotation.y = 0;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), hideMat);
        head.scale.set(0.95, 0.9, 1.15);
        head.position.set(0, 0.68, 0.55);
        group.add(head);
        const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.24), hideMat);
        jaw.position.set(0, 0.55, 0.68);
        group.add(jaw);
        break;
      }

      case 'zot_serpent': {
        // The air clears its throat (slice 17): a crackling
        // chain of charged segments.
        const hideMat = new THREE.MeshStandardMaterial({
          color: 0x44403c, roughness: 0.6, metalness: 0.3,
          emissive: 0xfacc15, emissiveIntensity: 0.25,
        });
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.13 - i * 0.012, 8, 6), hideMat);
          seg.scale.set(1, 0.85, 1.2);
          seg.position.set(0, 0.11, -i * 0.2);
          group.add(seg);
        }
        break;
      }

      case 'ironjaw': {
        // A walking anvil (slice 17): a low plate-backed bulk
        // — overlapping worn plates over a dark frame.
        const frameMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.8, metalness: 0.4 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 0.8, 8, 12), frameMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.55;
        body.castShadow = true;
        group.add(body);
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.45, metalness: 0.75 });
        for (let i = 0; i < 4; i++) {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.07, 0.34), plateMat);
          plate.position.set(0, 0.92 - Math.abs(i - 1.5) * 0.05, 0.45 - i * 0.3);
          plate.rotation.x = (i - 1.5) * 0.12;
          group.add(plate);
        }
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.36), frameMat);
        head.position.set(0, 0.45, 0.85);
        group.add(head);
        break;
      }

      case 'hoar_serpent': {
        // The floor, passing (slice 17): a white chain of
        // snow-bodied segments, root-scarred dark at the head.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
        for (let i = 0; i < 6; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.17 - i * 0.012, 8, 6), hideMat);
          seg.scale.set(1, 0.85, 1.2);
          seg.position.set(0, 0.14, -i * 0.26);
          group.add(seg);
        }
        const scar = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 }));
        scar.position.set(0.1, 0.2, 0.1);
        group.add(scar);
        break;
      }

      case 'tumble_crab': {
        // It commutes by wheel (slice 17): a round shell with
        // legs folded flush — drawn at rest, between commutes.
        const shellMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.55 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 10), shellMat);
        shell.scale.y = 0.85;
        shell.position.y = 0.19;
        shell.castShadow = true;
        group.add(shell);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.025, 6, 16), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.5 }));
        rim.position.y = 0.19;
        group.add(rim);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6 });
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4), legMat);
          leg.position.set(side * 0.18, 0.06, 0.05);
          leg.rotation.z = side * 1.1;
          group.add(leg);
        }
        break;
      }

      case 'facet_beetle': {
        // A grown solid (slice 17): a faceted dome of plates
        // — an icosahedron does the geometry's talking.
        const shellMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.3, metalness: 0.3, flatShading: true });
        const shell = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 0), shellMat);
        shell.scale.y = 0.7;
        shell.position.y = 0.1;
        group.add(shell);
        const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), shellMat);
        head.position.set(0, 0.08, 0.14);
        group.add(head);
        break;
      }

      case 'skull_hermit': {
        // The most honest tenant (slice 17): a soft body
        // backed into a worn skull — the skull IS the draw.
        const skullMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.85 });
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skullMat);
        skull.scale.set(0.95, 0.9, 1.1);
        skull.position.set(0, 0.17, -0.05);
        group.add(skull);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0x1c1917 });
        for (const side of [-1, 1]) {
          const socket = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
          socket.position.set(side * 0.06, 0.19, -0.18);
          group.add(socket);
        }
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 });
        const soft = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bodyMat);
        soft.scale.set(1, 0.8, 1.2);
        soft.position.set(0, 0.1, 0.12);
        group.add(soft);
        break;
      }

      case 'row_grazer': {
        // Geometry, grazing (slice 17): a plain honest
        // grazer — the meadow's handwriting is in its path,
        // not its silhouette.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xa3a380, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.65, 8, 12), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.72;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), hideMat);
        head.scale.set(0.85, 0.9, 1.2);
        head.position.set(0, 0.82, 0.62);
        group.add(head);
        break;
      }

    default:
      return null;
  }
  return group;
}
