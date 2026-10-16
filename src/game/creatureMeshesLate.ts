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

      case 'shardwing': {
        // The garden's tenant (slice 20): slim crystal-edged
        // wings over a dark slim body.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.7 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 9, 7), bodyMat);
        body.scale.set(0.85, 0.9, 1.5);
        group.add(body);
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0x67e8f9, roughness: 0.2, metalness: 0.3, transparent: true, opacity: 0.75, side: THREE.DoubleSide,
        });
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.16), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.27, 0.03, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'ironworm': {
        // The original armor (slice 20): rust-red rings of
        // plate over a burrower's chain.
        const ringMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.45, metalness: 0.7 });
        const fleshMat = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.11 - i * 0.008, 8, 6), i % 2 === 0 ? ringMat : fleshMat);
          seg.scale.set(1, 0.85, 1.15);
          seg.position.set(0, 0.1, -i * 0.16);
          group.add(seg);
        }
        break;
      }

      case 'driftworm': {
        // Winter at body depth (slice 20): a white-furred
        // chain, blind and unbothered.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1 });
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.12 - i * 0.008, 8, 6), furMat);
          seg.scale.set(1, 0.9, 1.15);
          seg.position.set(0, 0.11, -i * 0.17);
          group.add(seg);
        }
        break;
      }

      case 'ashswimmer': {
        // It swims ash (slice 20): a gray chain finned along
        // the rings.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 });
        const finMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.1 - i * 0.007, 8, 6), hideMat);
          seg.scale.set(1, 0.8, 1.15);
          seg.position.set(0, 0.09, -i * 0.15);
          group.add(seg);
          const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), finMat);
          fin.position.set(0, 0.17, -i * 0.15);
          fin.rotation.x = -0.5;
          group.add(fin);
        }
        break;
      }

      case 'glass_snake': {
        // Honest about lunch (slice 20): a clear chain — with
        // the last meal's silhouette inside the head segment.
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.15, transparent: true, opacity: 0.55,
        });
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.1 - i * 0.01, 8, 6), glassMat);
          seg.scale.set(1, 0.8, 1.2);
          seg.position.set(0, 0.08, -i * 0.16);
          group.add(seg);
        }
        const meal = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 }));
        meal.position.set(0, 0.08, -0.02);
        group.add(meal);
        break;
      }

      case 'steam_eel': {
        // The argument, inhabited (slice 20): a dark chain
        // wreathed in its own steam.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.7 });
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.09 - i * 0.008, 8, 6), hideMat);
          seg.scale.set(1, 0.8, 1.25);
          seg.position.set(0, 0.08, -i * 0.16);
          group.add(seg);
        }
        const steam = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xf8fafc, roughness: 1, transparent: true, opacity: 0.35,
        }));
        steam.position.set(0, 0.22, -0.2);
        group.add(steam);
        break;
      }

      case 'pan_lizard': {
        // The sculpture (slice 20): pan-flat, drawn mid-freeze
        // — which is to say, drawn as itself.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xd6d3a8, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), hideMat);
        body.scale.set(1.2, 0.3, 1.4);
        body.position.y = 0.06;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), hideMat);
        head.scale.set(1.1, 0.5, 1.2);
        head.position.set(0, 0.05, 0.19);
        group.add(head);
        break;
      }

      case 'seep_midge': {
        // A rumor with wings (slice 20): a speck and two
        // blurs. The colony is the citizen; this is its letter.
        const speck = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.8 }));
        group.add(speck);
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.03), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.04, 0.01, 0);
          wing.rotation.x = -Math.PI / 2;
          group.add(wing);
        }
        break;
      }

      case 'spiral_moth': {
        // Signed by the gardens (slice 20; the true spiral,
        // slice 49): broad wings, each carrying an Archimedean
        // spiral, EXACT — and wound by the garden's keeping.
        // In an UNTENDED garden (the moth's home variant, dealt
        // at generation) the spirals run BACKWARD: feral at the
        // pattern level, legible at thirty paces to a player
        // who has learned to read moths. The spiral is a thin
        // tube laid along the curve — a line with body, so the
        // winding survives at flight distance.
        const untended = fauna.homeVariant === 'precursor_untended';
        const wind = untended ? -1 : 1;
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bodyMat);
        body.scale.set(0.9, 0.9, 1.5);
        group.add(body);
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.85, side: THREE.DoubleSide });
        const spiralMat = new THREE.MeshStandardMaterial({ color: untended ? 0x78716c : 0x4c1d95, roughness: 0.7 });
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.CircleGeometry(0.11, 10), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.1, 0.01, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
          // The garden's signature, one per wing: radius grows
          // linearly with angle (Archimedes), a turn and a half,
          // wound forward in kept country, backward in the
          // Untended. Mirrored per wing so the pair reads as
          // one signature, not two accidents.
          const pts: THREE.Vector3[] = [];
          const turns = Math.PI * 3;
          for (let i = 0; i <= 40; i++) {
            const t = i / 40;
            const a = wind * side * t * turns;
            const r = 0.006 + t * 0.042;
            pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
          }
          const spiral = new THREE.Mesh(
            new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0055, 5),
            spiralMat
          );
          spiral.name = 'spiralMark';
          spiral.position.set(side * 0.1, 0.032, -0.02);
          group.add(spiral);
        }
        break;
      }

      case 'threshold_hound': {
        // The sentence the codex declines to finish (slice
        // 20): a hound at a threshold — drawn neutral, tail
        // mid-gesture, valley's choice.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xa3a380, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.45, 8, 10), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.42;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), hideMat);
        head.scale.set(0.9, 0.9, 1.2);
        head.position.set(0, 0.5, 0.42);
        group.add(head);
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.3, 5), hideMat);
        tail.position.set(0, 0.52, -0.42);
        tail.rotation.x = -0.7; // mid-gesture: neither wag nor tuck
        group.add(tail);
        break;
      }

      case 'saltpicker': {
        // A wader's deliberation (slice 20): a white-mottled
        // picker on long legs, wings folded for work.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 9, 7), featherMat);
        body.scale.set(0.9, 0.95, 1.35);
        body.position.y = 0.28;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), featherMat);
        head.position.set(0, 0.36, 0.13);
        group.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.12, 5), new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.6 }));
        beak.rotation.x = Math.PI / 2 + 0.5;
        beak.position.set(0, 0.33, 0.22);
        group.add(beak);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7 });
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 4), legMat);
          leg.position.set(side * 0.04, 0.13, 0);
          group.add(leg);
        }
        break;
      }

      case 'marrow_leech': {
        // The tithe-collector (slice 20): a dark arm of a
        // leech, pooled at rest.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.6 });
        const coil = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.045, 7, 12), hideMat);
        coil.rotation.x = Math.PI / 2;
        coil.position.y = 0.045;
        group.add(coil);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), hideMat);
        head.scale.set(1, 0.7, 1.3);
        head.position.set(0.14, 0.04, 0);
        group.add(head);
        break;
      }

      case 'hearth_wisp': {
        // It certifies fires (slice 22): a warm vapor puff,
        // hearth-lit.
        const wispMat = new THREE.MeshStandardMaterial({
          color: 0xfdba74, roughness: 1, transparent: true, opacity: 0.6,
          emissive: 0xea580c, emissiveIntensity: 0.8,
        });
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 9, 7), wispMat);
        core.scale.y = 1.25;
        group.add(core);
        break;
      }

      case 'relay_wisp': {
        // Still on route (slice 22): a lantern-scale forged
        // wisp with a node-light core.
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 9, 7), new THREE.MeshStandardMaterial({
          color: 0xfde68a, roughness: 0.4, transparent: true, opacity: 0.6,
          emissive: 0xd97706, emissiveIntensity: 0.5,
        }));
        group.add(shell);
        const node = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 6), new THREE.MeshStandardMaterial({
          color: 0xfff7ed, emissive: 0xf59e0b, emissiveIntensity: 1.2, roughness: 0.3,
        }));
        group.add(node);
        break;
      }

      case 'gap_moth': {
        // Briefly where it was (slice 22): a pale moth and its
        // own after-image, offset.
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.85, side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 }));
        body.scale.set(0.9, 0.9, 1.5);
        group.add(body);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.CircleGeometry(0.1, 9), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.09, 0.01, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        const ghost = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), new THREE.MeshStandardMaterial({
          color: 0xf8fafc, roughness: 1, transparent: true, opacity: 0.3,
        }));
        ghost.position.set(-0.1, 0, 0.12);
        group.add(ghost);
        break;
      }

      case 'deck_weaver': {
        // The bridges' rigger (slice 22): a long-limbed weaver
        // with a silk line paying out.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bodyMat);
        body.scale.set(1, 0.8, 1.2);
        group.add(body);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.7 });
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.3, 4), legMat);
            leg.position.set(side * 0.13, -0.04, 0.06 - i * 0.06);
            leg.rotation.z = side * 1.1;
            group.add(leg);
          }
        }
        const line = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.35, 3), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.5 }));
        line.position.set(0, 0.16, -0.1);
        line.rotation.x = 0.6;
        group.add(line);
        break;
      }

      case 'lake_glider': {
        // A skater's ease (slice 22): long mirror-footed legs
        // under a low crystal-padded body.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.4 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bodyMat);
        body.scale.set(1, 0.75, 1.3);
        body.position.y = 0.16;
        group.add(body);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.4, metalness: 0.5 });
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.004, 0.17, 4), legMat);
            leg.position.set(side * 0.06, 0.08, 0.05 - i * 0.05);
            group.add(leg);
            const foot = new THREE.Mesh(new THREE.SphereGeometry(0.025, 6, 5), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.1, metalness: 0.6 }));
            foot.scale.set(1, 0.4, 1.6);
            foot.position.set(side * 0.06, 0.01, 0.05 - i * 0.05);
            group.add(foot);
          }
        }
        break;
      }

      case 'frost_fisher': {
        // Penguin logic, exact (slice 22): a compact fisher
        // with flipper wings.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 9, 7), featherMat);
        body.scale.set(0.9, 1.05, 1.2);
        group.add(body);
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.9 }));
        belly.position.set(0, -0.02, 0.03);
        group.add(belly);
        for (const side of [-1, 1]) {
          const flipper = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.16, 5), featherMat);
          flipper.name = side < 0 ? 'wingL' : 'wingR';
          flipper.position.set(side * 0.11, -0.02, 0);
          flipper.rotation.z = side * 1.9;
          group.add(flipper);
        }
        break;
      }

      case 'ash_lark': {
        // The range's palette is its bath (slice 22): a small
        // warm-toned lark.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xd6a860, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xb98a4a, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.35);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), featherMat);
        head.position.set(0, 0.03, 0.09);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.11), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.17, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.06;
          group.add(wing);
        }
        break;
      }

      case 'reedbird': {
        // A room woven into the marsh (slice 22): a green-
        // brown reed bird.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x6b7c3f, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x59682f, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.35);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 7, 6), featherMat);
        head.position.set(0, 0.03, 0.09);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.1), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.16, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.06;
          group.add(wing);
        }
        break;
      }

      case 'storm_thrush': {
        // The living barometer (slice 22): a blue-gray thrush,
        // drawn mid-announcement.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x7d94b8, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x5f7aa6, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.35);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), featherMat);
        head.position.set(0, 0.04, 0.09);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.11), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.16, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.06;
          group.add(wing);
        }
        break;
      }

      case 'blizzard_kite': {
        // Bunting, live (slice 22): a white kite-bird with a
        // frozen pennant tail.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), featherMat);
        body.scale.set(0.85, 0.9, 1.4);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), featherMat);
        head.position.set(0, 0.02, 0.11);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.13), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.24, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.06;
          group.add(wing);
        }
        const pennant = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.3), new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }));
        pennant.position.set(0, 0, -0.24);
        pennant.rotation.x = -Math.PI / 2 + 0.15;
        group.add(pennant);
        break;
      }

      case 'shard_moth': {
        // Wings the country made (slice 22): glass membranes
        // on a moth's frame.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), bodyMat);
        body.scale.set(0.9, 0.9, 1.5);
        group.add(body);
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.6, side: THREE.DoubleSide,
        });
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.CircleGeometry(0.12, 10), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.11, 0.01, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'walking_root': {
        // The valley, ambulant (slice 22): a root cluster on
        // root legs, crown carried high.
        const rootMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95 });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.16, 9, 7), rootMat);
        crown.scale.y = 0.8;
        crown.position.y = 0.34;
        group.add(crown);
        for (let i = 0; i < 4; i++) {
          const a = i * 1.7;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.3, 5), rootMat);
          leg.position.set(Math.cos(a) * 0.12, 0.15, Math.sin(a) * 0.12);
          leg.rotation.set(Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4);
          group.add(leg);
        }
        const shoot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.85 }));
        shoot.position.y = 0.5;
        group.add(shoot);
        break;
      }

      case 'scaldback': {
        // A hot stone that swims ashore (slice 24): a husk
        // dome with fins.
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 }));
        dome.position.y = 0.04;
        group.add(dome);
        const finMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.8, side: THREE.DoubleSide });
        for (const side of [-1, 1]) {
          const fin = new THREE.Mesh(new THREE.CircleGeometry(0.07, 7), finMat);
          fin.position.set(side * 0.16, 0.03, 0.02);
          fin.rotation.y = side * 0.7;
          group.add(fin);
        }
        break;
      }

      case 'row_tender': {
        // THE EMBLEM (slice 24): a forged keeper with tool-arms.
        const chassis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.5, metalness: 0.5 }));
        chassis.scale.set(1, 0.85, 1.25);
        chassis.position.y = 0.16;
        group.add(chassis);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.5, metalness: 0.6 });
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.18, 4), legMat);
            leg.position.set(side * 0.11, 0.08, 0.08 - i * 0.08);
            leg.rotation.z = side * 0.5;
            group.add(leg);
          }
        }
        // Two tool-arms forward, implements down.
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.008, 0.16, 4), legMat);
          arm.position.set(side * 0.07, 0.14, 0.17);
          arm.rotation.x = 0.7;
          group.add(arm);
          const toolHead = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 4), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.3, metalness: 0.7 }));
          toolHead.position.set(side * 0.07, 0.05, 0.22);
          toolHead.rotation.x = Math.PI;
          group.add(toolHead);
        }
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 7, 6), new THREE.MeshStandardMaterial({ color: 0xa3e635, emissive: 0x4d7c0f, emissiveIntensity: 0.7, roughness: 0.3 }));
        eye.position.set(0, 0.2, 0.14);
        group.add(eye);
        break;
      }

      case 'feral_tender': {
        // The shadow, same make (slice 24): a tender overgrown,
        // tools worn like arguments.
        const chassis = new THREE.Mesh(new THREE.SphereGeometry(0.13, 9, 7), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.7, metalness: 0.3 }));
        chassis.scale.set(1, 0.85, 1.25);
        chassis.position.y = 0.16;
        group.add(chassis);
        const vine = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 5, 10), new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 1 }));
        vine.position.y = 0.18;
        vine.rotation.x = 1.2;
        group.add(vine);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.6, metalness: 0.4 });
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.18, 4), legMat);
            leg.position.set(side * 0.11, 0.08, 0.08 - i * 0.08);
            leg.rotation.z = side * 0.5;
            group.add(leg);
          }
        }
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 7, 6), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xa16207, emissiveIntensity: 0.7, roughness: 0.3 }));
        eye.position.set(0, 0.2, 0.14);
        group.add(eye);
        break;
      }

      case 'blink_hare': {
        // Present in pieces (slice 24): a pale hare, trailing
        // edge.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.95, transparent: true, opacity: 0.92 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), furMat);
        body.scale.set(0.85, 0.9, 1.3);
        group.add(body);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.13, 5), furMat);
          ear.position.set(side * 0.03, 0.13, 0.05);
          group.add(ear);
        }
        const wispTail = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 1, transparent: true, opacity: 0.4 }));
        wispTail.position.set(0.05, 0, -0.14);
        group.add(wispTail);
        break;
      }

      case 'sky_jelly': {
        // Swimming in weather (slice 24): a rain-clear dome
        // with a fringe.
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0xbae6fd, roughness: 0.15, transparent: true, opacity: 0.55,
        }));
        group.add(dome);
        const fringeMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.4, transparent: true, opacity: 0.7 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.002, 0.14, 3), fringeMat);
          strand.position.set(Math.cos(a) * 0.09, -0.08, Math.sin(a) * 0.09);
          group.add(strand);
        }
        break;
      }

      case 'hearth_dog': {
        // Unremarkable in every proportion (slice 24): a
        // mid-sized dog, arriving.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 9, 7), coatMat);
        body.scale.set(0.85, 0.85, 1.35);
        body.position.y = 0.16;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), coatMat);
        head.position.set(0, 0.24, 0.15);
        group.add(head);
        const snout = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), coatMat);
        snout.scale.set(0.8, 0.7, 1.2);
        snout.position.set(0, 0.21, 0.22);
        group.add(snout);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.95 });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.016, 0.14, 5), legMat);
          leg.position.set(sx * 0.07, 0.07, sz * 0.1);
          group.add(leg);
        }
        const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.14, 4), coatMat);
        tail.position.set(0, 0.22, -0.17);
        tail.rotation.x = -0.8;
        group.add(tail);
        break;
      }

      case 'false_greeter': {
        // The wrong number of implications (slice 24): a
        // greeter-shaped courtesy, slightly too symmetrical.
        const robeMat = new THREE.MeshStandardMaterial({ color: 0x7c6bb0, roughness: 0.8 });
        const robe = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 8), robeMat);
        robe.position.y = 0.21;
        group.add(robe);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 7), new THREE.MeshStandardMaterial({ color: 0xd8b4fe, roughness: 0.7 }));
        head.position.y = 0.48;
        group.add(head);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.2, 4), robeMat);
          arm.position.set(side * 0.14, 0.3, 0.03);
          arm.rotation.z = side * 1.9; // both arms raised in welcome
          group.add(arm);
        }
        // Three eyes. The record only implies; the mesh commits.
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1e1b4b, roughness: 0.3 });
        for (const ex of [-0.03, 0, 0.03]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.011, 5, 4), eyeMat);
          eye.position.set(ex, 0.5 + (ex === 0 ? 0.02 : 0), 0.07);
          group.add(eye);
        }
        break;
      }

      case 'storm_roc': {
        // Grand scale (slice 24): a weather-front of a bird —
        // built at roughly triple the flyer norm.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), featherMat);
        body.scale.set(0.85, 0.9, 1.4);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 7), featherMat);
        head.position.set(0, 0.08, 0.34);
        group.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5 }));
        beak.position.set(0, 0.05, 0.52);
        beak.rotation.x = Math.PI / 2;
        group.add(beak);
        // The underside IS the weather: a pale storm belly.
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.2, 9, 7), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }));
        belly.position.set(0, -0.08, 0.02);
        group.add(belly);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.38), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.72, 0.06, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.06;
          group.add(wing);
        }
        break;
      }

      case 'feral_warden': {
        // War-kept (slice 24): a tall forged biped, tools
        // re-purposed.
        const plateMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.5, metalness: 0.6 });
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.34, 7), plateMat);
        torso.position.y = 0.42;
        group.add(torso);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), plateMat);
        head.position.y = 0.66;
        group.add(head);
        const visor = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xa16207, emissiveIntensity: 0.8, roughness: 0.3 }));
        visor.position.set(0, 0.67, 0.05);
        group.add(visor);
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.02, 0.26, 5), plateMat);
          leg.position.set(side * 0.05, 0.13, 0);
          group.add(leg);
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.3, 5), plateMat);
          arm.position.set(side * 0.13, 0.45, 0);
          arm.rotation.z = side * 0.35;
          group.add(arm);
        }
        // One re-purposed tool, held low.
        const toolBlade = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.16, 4), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.3, metalness: 0.7 }));
        toolBlade.position.set(0.18, 0.26, 0.02);
        toolBlade.rotation.x = Math.PI;
        group.add(toolBlade);
        break;
      }

      case 'heartling': {
        // The valley's own (slice 24): small, round, and NOT
        // a mouse.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 9, 7), furMat);
        body.scale.set(1, 0.95, 1.1);
        group.add(body);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.CircleGeometry(0.028, 8), new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.9, side: THREE.DoubleSide }));
          ear.position.set(side * 0.045, 0.075, 0.02);
          group.add(ear);
        }
        break;
      }

      case 'grass_leviathan': {
        // A route with a heartbeat (slice 30, oversize tier):
        // a hill-backed grazer at ~6x citizen scale, grass
        // growing on the citizen.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 9), bodyMat);
        body.scale.set(0.95, 0.9, 1.5);
        body.position.y = 0.85;
        group.add(body);
        const back = new THREE.Mesh(new THREE.SphereGeometry(0.7, 11, 8), new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 1 }));
        back.scale.set(0.9, 0.55, 1.35);
        back.position.y = 1.35;
        group.add(back);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 9, 7), bodyMat);
        head.position.set(0, 0.95, 1.3);
        group.add(head);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.7, 6), legMat);
          leg.position.set(sx * 0.45, 0.35, sz * 0.65);
          group.add(leg);
        }
        break;
      }

      case 'cloud_whale': {
        // Drawn in vapor (slice 30): a whale plan at altitude,
        // translucent, unhurried.
        const vaporMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 1, transparent: true, opacity: 0.55 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 9), vaporMat);
        body.scale.set(0.8, 0.75, 1.9);
        group.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.8, 7), vaporMat);
        tail.position.set(0, 0.1, -1.9);
        tail.rotation.x = -Math.PI / 2.3;
        group.add(tail);
        for (const side of [-1, 1]) {
          const fin = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 5), vaporMat);
          fin.position.set(side * 0.75, -0.25, 0.5);
          fin.rotation.z = side * 1.9;
          group.add(fin);
        }
        break;
      }

      case 'storm_leviathan': {
        // The argument, ambulant (slice 30): a bone-plated
        // giant at ~7x scale.
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 9), darkMat);
        body.scale.set(0.95, 0.95, 1.55);
        body.position.y = 1.0;
        group.add(body);
        for (let i = 0; i < 4; i++) {
          const plate = new THREE.Mesh(new THREE.SphereGeometry(0.42 - i * 0.05, 8, 6), plateMat);
          plate.scale.set(1, 0.5, 1);
          plate.position.set(0, 1.75 - i * 0.08, 0.8 - i * 0.5);
          group.add(plate);
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 9, 7), darkMat);
        head.position.set(0, 1.05, 1.5);
        group.add(head);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.85, 6), darkMat);
          leg.position.set(sx * 0.5, 0.42, sz * 0.75);
          group.add(leg);
        }
        break;
      }

      case 'garden_colossus': {
        // Fidelity at hill scale (slice 30): a forged biped
        // gardener, ~4m of citizen.
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.55, metalness: 0.5 });
        const mossMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 1 });
        const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.7, 1.5, 9), plateMat);
        torso.position.y = 2.1;
        group.add(torso);
        const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.62, 9, 7), mossMat);
        shoulders.scale.set(1.3, 0.6, 1);
        shoulders.position.y = 2.9;
        group.add(shoulders);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 9, 7), plateMat);
        head.position.y = 3.35;
        group.add(head);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.09, 7, 6), new THREE.MeshStandardMaterial({ color: 0xa3e635, emissive: 0x4d7c0f, emissiveIntensity: 0.8, roughness: 0.3 }));
        eye.position.set(0, 3.4, 0.3);
        group.add(eye);
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 1.35, 6), plateMat);
          leg.position.set(side * 0.3, 0.67, 0);
          group.add(leg);
          const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 1.5, 6), plateMat);
          arm.position.set(side * 0.85, 2.1, 0);
          arm.rotation.z = side * 0.25;
          group.add(arm);
        }
        break;
      }

      case 'sleeping_mountain': {
        // Filed as geography (slice 30): an ash-mantled hill
        // that breathes — drawn as a hill, honestly.
        const hillMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 1 });
        const hill = new THREE.Mesh(new THREE.SphereGeometry(1.6, 13, 9), hillMat);
        hill.scale.set(1.1, 0.55, 1.5);
        hill.position.y = 0.25;
        group.add(hill);
        const ashCap = new THREE.Mesh(new THREE.SphereGeometry(1.3, 11, 8), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 1 }));
        ashCap.scale.set(1, 0.45, 1.35);
        ashCap.position.y = 0.55;
        group.add(ashCap);
        // One ear, and a closed eye-line: the footnote that
        // says the hill is a citizen.
        const ear = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.3, 6), hillMat);
        ear.position.set(0.5, 0.95, 1.9);
        group.add(ear);
        break;
      }

      case 'glass_behemoth': {
        // Seen across, end to end (slice 30): a crystalline
        // walker at ~5x scale, plates grown.
        const glassMat = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, roughness: 0.15, metalness: 0.25, transparent: true, opacity: 0.8 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 9), glassMat);
        body.scale.set(0.9, 0.95, 1.5);
        body.position.y = 0.95;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 9, 7), glassMat);
        head.position.set(0, 1.05, 1.25);
        group.add(head);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.8, 6), glassMat);
          leg.position.set(sx * 0.42, 0.4, sz * 0.6);
          group.add(leg);
        }
        const plate = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.9 }));
        plate.scale.set(1, 0.4, 1.2);
        plate.position.set(0.3, 1.6, -0.3);
        group.add(plate);
        break;
      }

      case 'old_marrow': {
        // The grandmother (slice 30): a forest-shelled
        // tortoise at ~5x scale.
        const shellMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), shellMat);
        shell.scale.set(1, 0.85, 1.25);
        shell.position.y = 0.35;
        group.add(shell);
        const moss = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 7), new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 1 }));
        moss.scale.set(1, 0.5, 1.1);
        moss.position.y = 0.95;
        group.add(moss);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 7), new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 }));
        head.position.set(0, 0.4, 1.05);
        group.add(head);
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.3, 6), shellMat);
          leg.position.set(sx * 0.5, 0.15, sz * 0.55);
          group.add(leg);
        }
        break;
      }

      case 'winter_mother': {
        // At the word's full weight (slice 30): a mammoth
        // with tusks and a winter coat.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 1 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 9), coatMat);
        body.scale.set(0.95, 1, 1.4);
        body.position.y = 0.95;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.36, 9, 7), coatMat);
        head.position.set(0, 1.0, 1.2);
        group.add(head);
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.045, 0.6, 6), coatMat);
        trunk.position.set(0, 0.65, 1.45);
        trunk.rotation.x = 0.35;
        group.add(trunk);
        const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.5 });
        for (const side of [-1, 1]) {
          const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55, 6), tuskMat);
          tusk.position.set(side * 0.2, 0.75, 1.42);
          tusk.rotation.x = 2.2;
          group.add(tusk);
        }
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.09, 0.75, 6), coatMat);
          leg.position.set(sx * 0.45, 0.37, sz * 0.6);
          group.add(leg);
        }
        break;
      }

      case 'dune_whale': {
        // Breaching the crest (slice 30): a finned whale
        // drawn mid-surface in sand.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 9), skinMat);
        body.scale.set(0.8, 0.7, 1.9);
        body.position.y = 0.35;
        group.add(body);
        const dorsal = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), skinMat);
        dorsal.position.set(0, 0.85, -0.2);
        group.add(dorsal);
        for (const side of [-1, 1]) {
          const fin = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.65, 5), skinMat);
          fin.position.set(side * 0.7, 0.15, 0.6);
          fin.rotation.z = side * 1.9;
          group.add(fin);
        }
        const sand = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.18, 12), new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 1 }));
        sand.position.y = 0.02;
        group.add(sand);
        break;
      }

      case 'great_hermit': {
        // A tenancy agreement with legs (slice 30): a house-
        // sized husk, colonied.
        const huskMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.95 });
        const husk = new THREE.Mesh(new THREE.SphereGeometry(0.75, 11, 8), huskMat);
        husk.scale.set(1, 0.9, 1.2);
        husk.position.y = 0.75;
        group.add(husk);
        const spiral = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.09, 6, 12), new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.95 }));
        spiral.position.set(0, 0.85, 0.55);
        spiral.rotation.x = 0.4;
        group.add(spiral);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 });
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.035, 0.55, 5), legMat);
            leg.position.set(side * 0.55, 0.27, 0.4 - i * 0.4);
            leg.rotation.z = side * 0.5;
            group.add(leg);
          }
        }
        break;
      }

      case 'tempest_worm': {
        // The previous tenant (slice 30): fulgurite-lined
        // segments at failing-word scale, drawn surfaced.
        const segMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.7, metalness: 0.3 });
        const lineMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.3, metalness: 0.4, emissive: 0xa16207, emissiveIntensity: 0.3 });
        for (let i = 0; i < 5; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.55 - i * 0.06, 10, 8), segMat);
          seg.position.set(0, 0.35, 1.2 - i * 0.75);
          group.add(seg);
          const line = new THREE.Mesh(new THREE.TorusGeometry(0.52 - i * 0.06, 0.03, 5, 12), lineMat);
          line.position.set(0, 0.35, 1.2 - i * 0.75);
          group.add(line);
        }
        break;
      }

      case 'mirror_jelly': {
        // The marsh looking at itself (pond build): a clear bell
        // whose top is a still mirror, tendrils trailing.
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0xbae6fd, roughness: 0.15, transparent: true, opacity: 0.55,
        }));
        bell.scale.set(1, 0.75, 1);
        bell.position.y = 0.02;
        group.add(bell);
        const mirrorTop = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.1, metalness: 0.7 }));
        mirrorTop.rotation.x = -Math.PI / 2;
        mirrorTop.position.y = 0.24;
        group.add(mirrorTop);
        for (let i = 0; i < 6; i++) {
          const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.008, 0.34, 5), new THREE.MeshStandardMaterial({
            color: 0xe0f2fe, roughness: 0.4, transparent: true, opacity: 0.7,
          }));
          const a = (i / 6) * Math.PI * 2;
          tendril.position.set(Math.cos(a) * 0.18, -0.16, Math.sin(a) * 0.18);
          group.add(tendril);
        }
        break;
      }

      case 'pond_skater': {
        // Six dimples in the water (pond build): a small body on
        // long mirror-footed legs riding the film itself.
        const legMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.5 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), legMat);
        body.scale.set(1, 0.7, 1.8);
        body.position.y = 0.09;
        group.add(body);
        for (let i = 0; i < 6; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.34, 4), legMat);
          leg.position.set(side * 0.16, 0.04, -0.08 + Math.floor(i / 2) * 0.08);
          leg.rotation.z = side * 1.15;
          group.add(leg);
        }
        break;
      }

      case 'brine_jelly': {
        // Salt-crusted at the rim, clear at the heart (pond build).
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0xfef3c7, roughness: 0.3, transparent: true, opacity: 0.6,
        }));
        bell.scale.set(1, 0.7, 1);
        group.add(bell);
        const crust = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 6, 14), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1 }));
        crust.rotation.x = Math.PI / 2;
        crust.position.y = 0.0;
        group.add(crust);
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xe0f2fe, roughness: 0.2, transparent: true, opacity: 0.8,
        }));
        heart.position.y = 0.02;
        group.add(heart);
        break;
      }

      case 'sumpfish': {
        // Sump patience, drawn (pond build): stout, olive, unbothered.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x71713f, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), hideMat);
        body.scale.set(1, 0.85, 1.6);
        group.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.22, 6), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1, 1, 0.3);
        tail.position.set(0, 0, -0.32);
        group.add(tail);
        break;
      }

      case 'brook_minnow': {
        // A ribbon of one (pond build): the school reads at
        // count, not at size.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.35, metalness: 0.4 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), hideMat);
        body.scale.set(0.8, 0.7, 2);
        group.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.1, 5), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1, 1, 0.25);
        tail.position.set(0, 0, -0.15);
        group.add(tail);
        break;
      }

      case 'ice_maw': {
        // The travelling note, drawn (pond build): mostly jaw.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xdbeafe, roughness: 0.5 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), hideMat);
        body.scale.set(1, 0.8, 1.9);
        group.add(body);
        const jawMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
        for (let i = 0; i < 6; i++) {
          const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.12, 5), jawMat);
          tooth.position.set(-0.12 + (i % 3) * 0.12, -0.1, 0.42 + Math.floor(i / 3) * 0.08);
          tooth.rotation.x = Math.PI;
          group.add(tooth);
        }
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 6), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1, 1, 0.25);
        tail.position.set(0, 0, -0.68);
        group.add(tail);
        break;
      }

      case 'drift_krill': {
        // The citizen is the cloud (pond build): each spawn draws
        // a loose knot of the ten thousand.
        const krillMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 7; i++) {
          const speck = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), krillMat);
          speck.scale.set(0.8, 0.7, 2.2);
          speck.position.set(Math.sin(i * 2.4) * 0.16, Math.cos(i * 1.7) * 0.08, Math.cos(i * 2.4) * 0.16);
          speck.rotation.y = i * 1.3;
          group.add(speck);
        }
        break;
      }

      case 'deep_carp': {
        // A square meter of silt, defended by indifference (pond build).
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x92600f, roughness: 0.7 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), hideMat);
        body.scale.set(1, 0.9, 1.7);
        group.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.42, 6), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1, 1, 0.2);
        tail.position.set(0, 0, -0.66);
        group.add(tail);
        for (const side of [-1, 1]) {
          const barbel = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.006, 0.2, 4), hideMat);
          barbel.position.set(side * 0.1, -0.08, 0.5);
          barbel.rotation.x = 1.1;
          barbel.rotation.z = side * 0.4;
          group.add(barbel);
        }
        break;
      }

      case 'pale_eel': {
        // The gathering note, drawn (pond build): eyeless pale chain.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.45, transparent: true, opacity: 0.9 });
        for (let i = 0; i < 6; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.085 - i * 0.008, 8, 6), hideMat);
          seg.scale.set(1, 0.8, 1.3);
          seg.position.set(Math.sin(i * 0.7) * 0.05, 0, -i * 0.15);
          group.add(seg);
        }
        break;
      }

      case 'plunge_duck': {
        // Three commutes, one bird (pond build): wings named for
        // the flap branch; the dive lives in its table note.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.8 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), featherMat);
        body.scale.set(1, 0.85, 1.5);
        body.position.y = 0.05;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.7 }));
        head.position.set(0, 0.16, 0.22);
        group.add(head);
        const bill = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.03, 0.12), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }));
        bill.position.set(0, 0.14, 0.34);
        group.add(bill);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), featherMat);
          wing.scale.set(1.6, 0.18, 0.8);
          wing.position.set(side * 0.22, 0.12, -0.02);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          group.add(wing);
        }
        break;
      }

      case 'mirror_fish': {
        // The sky's copy, studied from beneath (pond build): a
        // flat bright disc riding the film upside-down.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.2, metalness: 0.5 });
        const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 12), hideMat);
        body.scale.set(1, 1, 1.5);
        group.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 5), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1, 1, 0.25);
        tail.position.set(0, 0, -0.3);
        group.add(tail);
        break;
      }

      case 'lake_leviathan': {
        // The water epic, drawn to scale (pond build): a slow
        // shadow with a back that breaks the fog once a season.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(1.1, 14, 10), hideMat);
        body.scale.set(1, 0.55, 2.6);
        body.position.y = -0.35;
        group.add(body);
        const back = new THREE.Mesh(new THREE.SphereGeometry(0.7, 10, 8), hideMat);
        back.scale.set(0.9, 0.4, 1.8);
        back.position.set(0, 0.05, -0.2);
        group.add(back);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.8, 6), hideMat);
        fin.scale.set(0.25, 1, 1);
        fin.position.set(0, 0.45, -0.6);
        group.add(fin);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.4, 8), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1.4, 1, 0.18);
        tail.position.set(0, -0.3, -3.4);
        group.add(tail);
        break;
      }

      case 'deep_reef': {
        // A place as much as a creature (pond build): stone
        // bones and living fans, on the pond's floor.
        const rockMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 1 });
        for (let i = 0; i < 4; i++) {
          const rock = new THREE.Mesh(new THREE.SphereGeometry(0.22 - i * 0.03, 8, 6), rockMat);
          rock.scale.set(1.2, 0.7, 1);
          rock.position.set(Math.sin(i * 1.9) * 0.3, -0.15, Math.cos(i * 1.9) * 0.3);
          group.add(rock);
        }
        const fanMat = new THREE.MeshStandardMaterial({ color: 0xf472b6, roughness: 0.7, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 5; i++) {
          const fan = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 6), fanMat);
          fan.position.set(Math.sin(i * 2.5) * 0.26, 0.02, Math.cos(i * 2.5) * 0.26);
          fan.rotation.x = Math.sin(i) * 0.3;
          group.add(fan);
        }
        break;
      }

      case 'diver_beetle': {
        // Its air, worn like a helmet it chose (pond build).
        const shellMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.35, metalness: 0.3 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), shellMat);
        body.scale.set(1, 0.75, 1.5);
        group.add(body);
        const bubble = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xe0f2fe, roughness: 0.1, transparent: true, opacity: 0.5,
        }));
        bubble.position.set(0, -0.05, -0.12);
        group.add(bubble);
        const legMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.7 });
        for (let i = 0; i < 6; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.005, 0.14, 4), legMat);
          leg.position.set(side * 0.11, -0.05, -0.08 + Math.floor(i / 2) * 0.08);
          leg.rotation.z = side * 0.9;
          group.add(leg);
        }
        break;
      }

      case 'dartfisher': {
        // A blade on wings (pond build): bright, sleek, all point.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x06b6d4, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), featherMat);
        body.scale.set(0.8, 0.75, 2);
        body.position.y = 0.04;
        group.add(body);
        const dart = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.22, 6), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 }));
        dart.rotation.x = Math.PI / 2;
        dart.position.set(0, 0.04, 0.28);
        group.add(dart);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), featherMat);
          wing.scale.set(1.7, 0.15, 0.7);
          wing.position.set(side * 0.16, 0.09, -0.02);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          group.add(wing);
        }
        break;
      }

      case 'glyph_carp': {
        // An inscription that swims (pond build): carp plan with
        // pale glyph rings along the flank.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.55 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 8), hideMat);
        body.scale.set(1, 0.9, 1.8);
        group.add(body);
        const glyphMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.4 });
        for (let i = 0; i < 3; i++) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.13 - i * 0.02, 0.014, 5, 12), glyphMat);
          ring.position.set(0, 0.02, 0.25 - i * 0.22);
          ring.rotation.y = Math.PI / 2;
          group.add(ring);
        }
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.34, 6), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1, 1, 0.2);
        tail.position.set(0, 0, -0.55);
        group.add(tail);
        break;
      }

      case 'silver_skater': {
        // The pond cousin, richly dressed (pond build): mirror
        // plate over the skater plan, wing shells folded bright.
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.2, metalness: 0.7 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), plateMat);
        body.scale.set(1, 0.7, 1.8);
        body.position.y = 0.09;
        group.add(body);
        for (const side of [-1, 1]) {
          const shell = new THREE.Mesh(new THREE.SphereGeometry(0.055, 6, 5), plateMat);
          shell.scale.set(1.4, 0.3, 0.9);
          shell.position.set(side * 0.07, 0.13, -0.05);
          group.add(shell);
        }
        for (let i = 0; i < 6; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.004, 0.34, 4), plateMat);
          leg.position.set(side * 0.16, 0.04, -0.08 + Math.floor(i / 2) * 0.08);
          leg.rotation.z = side * 1.15;
          group.add(leg);
        }
        break;
      }

      case 'silverfin': {
        // Perpetually coated, perpetually shedding (pond build).
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.15, metalness: 0.8 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), hideMat);
        body.scale.set(0.8, 0.75, 2.1);
        group.add(body);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 5), hideMat);
        fin.scale.set(0.3, 1, 1);
        fin.position.set(0, 0.13, -0.05);
        group.add(fin);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.18, 5), hideMat);
        tail.rotation.x = -Math.PI / 2;
        tail.scale.set(1, 1, 0.25);
        tail.position.set(0, 0, -0.28);
        group.add(tail);
        break;
      }

      case 'plated_crab': {
        // Self-gilt, claw by claw (pond build): a wide bright
        // carapace and two ceremonial claws.
        const plateMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.3, metalness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), plateMat);
        body.scale.set(1.5, 0.55, 1.1);
        group.add(body);
        for (const side of [-1, 1]) {
          const claw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), plateMat);
          claw.scale.set(1, 0.8, 1.3);
          claw.position.set(side * 0.3, 0.02, 0.22);
          group.add(claw);
        }
        const legMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6 });
        for (let i = 0; i < 6; i++) {
          const side = i % 2 === 0 ? 1 : -1;
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.007, 0.22, 4), legMat);
          leg.position.set(side * 0.3, -0.06, -0.12 + Math.floor(i / 2) * 0.12);
          leg.rotation.z = side * 1.1;
          group.add(leg);
        }
        break;
      }

      case 'silver_dipper': {
        // Bank-true and bobbing (pond build): dark body, bright
        // throat, wings named for the flap branch.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), featherMat);
        body.scale.set(1, 0.9, 1.5);
        body.position.y = 0.04;
        group.add(body);
        const throat = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 }));
        throat.position.set(0, 0.09, 0.13);
        group.add(throat);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), featherMat);
          wing.scale.set(1.5, 0.16, 0.75);
          wing.position.set(side * 0.15, 0.09, -0.02);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          group.add(wing);
        }
        break;
      }

      case 'mirror_heron': {
        // A magistrate of the shallows (pond build): stilts, a
        // long neck held in judgment, a spear for a bill.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.85 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.7 });
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.01, 0.55, 5), legMat);
          leg.position.set(side * 0.06, -0.27, 0);
          group.add(leg);
        }
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), featherMat);
        body.scale.set(1, 0.9, 1.6);
        body.position.y = 0.08;
        group.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.42, 6), featherMat);
        neck.position.set(0, 0.32, 0.18);
        neck.rotation.x = 0.5;
        group.add(neck);
        const bill = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.5 }));
        bill.rotation.x = Math.PI / 2 - 0.35;
        bill.position.set(0, 0.48, 0.38);
        group.add(bill);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), featherMat);
          wing.scale.set(1.5, 0.15, 0.85);
          wing.position.set(side * 0.18, 0.14, -0.03);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          group.add(wing);
        }
        break;
      }

    default:
      return null;
  }
  return group;
}
