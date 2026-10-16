// ============================================================================
// floraMeshesLate.ts — late-wave flora/fungus mesh builders.
//
// Split out of floraMeshes.ts at slice 26 (2026-10-16) when the
// main flora mesh file reached the single-push size cap's edge
// — the same relief pattern as creatureMeshesLate.ts.
// buildFloraMesh delegates here FIRST and falls through on null;
// callers see one builder. New flora mesh cases go HERE from
// slice 26 on.
// ============================================================================

import * as THREE from 'three';
import type { FloraEntity } from '../types/game';
import type { StructureMaterials } from './structureBuilders';

export function buildLateFloraMesh(
  flora: FloraEntity,
  materials: StructureMaterials,
  terrainHeightAt: (x: number, z: number) => number,
): THREE.Group | null {
  const group = new THREE.Group();
  group.userData = { type: 'flora', entity: flora };
  // materials / terrainHeightAt: kept in the signature for parity
  // with buildFloraMesh; the late draws are self-colored.
  void materials;
  void terrainHeightAt;
  switch (flora.species) {
      case 'mist_cap': {
        // The fog's provision (slice 26): a pale cap in its
        // own weather.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.95 }));
        stalk.position.y = 0.06;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }));
        cap.position.y = 0.12;
        group.add(cap);
        const fog = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 1, transparent: true, opacity: 0.28 }));
        fog.scale.y = 0.6;
        fog.position.y = 0.08;
        group.add(fog);
        break;
      }

      case 'tool_cap': {
        // A crop of cushions (slice 26): a springy foam dome
        // on a gardener's stalk.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 }));
        stalk.position.y = 0.05;
        group.add(stalk);
        const foam = new THREE.Mesh(new THREE.SphereGeometry(0.085, 9, 7), new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.95 }));
        foam.scale.y = 0.75;
        foam.position.y = 0.13;
        group.add(foam);
        break;
      }

      case 'sail_cap': {
        // Agriculture by balloon (slice 26): a stalk, a cap,
        // and one membrane sail, drawn grounded.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.9 }));
        stalk.position.y = 0.06;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf0f9ff, roughness: 0.8 }));
        cap.position.y = 0.13;
        group.add(cap);
        const sail = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), new THREE.MeshStandardMaterial({ color: 0xf0f9ff, roughness: 0.6, transparent: true, opacity: 0.65, side: THREE.DoubleSide }));
        sail.position.set(0.05, 0.26, 0);
        sail.rotation.z = -0.4;
        group.add(sail);
        break;
      }

      case 'night_cap': {
        // Picked by lantern (slice 26): an indigo cap drawn
        // up at dusk.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0xc7d2fe, roughness: 0.9 }));
        stalk.position.y = 0.06;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x312e81, roughness: 0.8 }));
        cap.position.y = 0.12;
        group.add(cap);
        break;
      }

      case 'storm_mold': {
        // Weather's marginalia (slice 26): gray-green films
        // on a stone.
        const stone = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 1 }));
        stone.scale.y = 0.6;
        stone.position.y = 0.05;
        group.add(stone);
        const film = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshStandardMaterial({ color: 0x6b7c5e, roughness: 1 }));
        film.scale.y = 0.55;
        film.position.y = 0.065;
        group.add(film);
        break;
      }

      case 'dark_cap': {
        // The next parish of dark (slice 26): a near-black
        // cap, gills faintly lit.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.13, 6), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.95 }));
        stalk.position.y = 0.06;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 }));
        cap.position.y = 0.13;
        group.add(cap);
        const gills = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), new THREE.MeshStandardMaterial({ color: 0x60a5fa, emissive: 0x1d4ed8, emissiveIntensity: 0.4, roughness: 0.6, side: THREE.DoubleSide }));
        gills.rotation.x = Math.PI / 2;
        gills.position.y = 0.125;
        group.add(gills);
        break;
      }

      case 'husk_cap': {
        // The treaty's harvest (slice 26): a pale cap in a
        // skull's eye shade — the skull drawn plainly.
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 7), new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.85 }));
        skull.position.y = 0.08;
        group.add(skull);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 }));
        cap.position.set(0.03, 0.13, 0.06);
        group.add(cap);
        break;
      }

      case 'shell_cap': {
        // The shore embassy (slice 26): a mild cap on a reef
        // shell at the waterline.
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6, 0, Math.PI * 2, 0, Math.PI), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6, side: THREE.DoubleSide }));
        shell.position.y = 0.02;
        group.add(shell);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 5, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.8 }));
        cap.position.y = 0.07;
        group.add(cap);
        break;
      }

      case 'trail_cap': {
        // Heroic scale (slice 26): one camp-feeding cap.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.22, 7), new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 }));
        stalk.position.y = 0.11;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 }));
        cap.position.y = 0.22;
        group.add(cap);
        break;
      }

      case 'sweet_cap': {
        // The valley's dessert (slice 26): a honey cap, drawn
        // at one-bite scale and no larger.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.032, 0.11, 6), new THREE.MeshStandardMaterial({ color: 0xfffbeb, roughness: 0.9 }));
        stalk.position.y = 0.05;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.6 }));
        cap.position.y = 0.11;
        group.add(cap);
        break;
      }

      case 'great_puff': {
        // Sheep size (slice 26): the plains' white dome —
        // one fungus, drawn as furniture.
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 11, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.95 }));
        dome.scale.y = 0.85;
        dome.position.y = 0.17;
        group.add(dome);
        break;
      }

      case 'rust_cap': {
        // The smelters' course (slice 26): iron-red flesh on
        // slag.
        const slag = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.05, 7), new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.95 }));
        slag.position.y = 0.025;
        group.add(slag);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.085, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.55, metalness: 0.3 }));
        cap.position.y = 0.09;
        group.add(cap);
        break;
      }

      case 'answer_tree': {
        // Composing a reply (slice 27): a broad tree whose
        // canopy tilts, listening.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 1 }));
        trunk.position.y = 0.35;
        group.add(trunk);
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.95 }));
        canopy.position.set(0.08, 0.85, 0);
        canopy.scale.y = 0.8;
        group.add(canopy);
        break;
      }

      case 'greeting_cap': {
        // The valley's manners (slice 27): a mild lemon cap.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.9 }));
        stalk.position.y = 0.06;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xfde047, roughness: 0.7 }));
        cap.position.y = 0.12;
        group.add(cap);
        break;
      }

      case 'relic_tree': {
        // An orchard under patrol (slice 27): a pale forged
        // tree with stone-hard fruit.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.13, 0.65, 8), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.6, metalness: 0.2 }));
        trunk.position.y = 0.32;
        group.add(trunk);
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.36, 9, 7), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 }));
        canopy.position.y = 0.78;
        canopy.scale.y = 0.85;
        group.add(canopy);
        const fruitMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.3, metalness: 0.3 });
        for (const [fx, fy, fz] of [[0.2, 0.62, 0.1], [-0.18, 0.7, -0.08], [0.02, 0.55, -0.2]] as const) {
          const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), fruitMat);
          fruit.position.set(fx, fy, fz);
          group.add(fruit);
        }
        break;
      }

      case 'ironwood': {
        // Ore at tree pace (slice 27): a dark, dense trunk,
        // iron-veined.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.7, 8), new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.7, metalness: 0.35 }));
        trunk.position.y = 0.35;
        group.add(trunk);
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.38, 9, 7), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.95 }));
        canopy.position.y = 0.82;
        canopy.scale.y = 0.8;
        group.add(canopy);
        break;
      }

      case 'glare_vine': {
        // The floor is lenses (slice 27): a vine of glass
        // leaves on a low trellis of itself.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.8 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.3, 5), stemMat);
        stem.position.y = 0.15;
        stem.rotation.z = 0.3;
        group.add(stem);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, roughness: 0.15, metalness: 0.2, transparent: true, opacity: 0.65, side: THREE.DoubleSide });
        for (let i = 0; i < 4; i++) {
          const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.05, 7), leafMat);
          leaf.position.set(-0.06 + i * 0.045, 0.12 + i * 0.06, (i % 2) * 0.05);
          leaf.rotation.y = i * 0.8;
          group.add(leaf);
        }
        break;
      }

      case 'marrow_vine': {
        // The Graveyard's sweetness (slice 27): a vine with
        // pale honeyed blooms.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.28, 5), new THREE.MeshStandardMaterial({ color: 0x9f1239, roughness: 0.85 }));
        stem.position.y = 0.14;
        stem.rotation.z = -0.25;
        group.add(stem);
        const bloomMat = new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.7 });
        for (let i = 0; i < 3; i++) {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 6), bloomMat);
          bloom.position.set(0.04 - i * 0.03, 0.1 + i * 0.08, 0.03);
          group.add(bloom);
        }
        break;
      }

      case 'row_moss': {
        // The ruler (slice 27): a spiral-true moss mat —
        // drawn as a ring segment of the great spiral.
        const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.025, 12, 1, false, 0, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 1 }));
        mat.position.y = 0.012;
        group.add(mat);
        break;
      }

      case 'prism_moss': {
        // The glazier (slice 27): a light-sorting film —
        // three color patches at noon.
        const patchCols = [0xf87171, 0x67e8f9, 0xfde047];
        patchCols.forEach((col, i) => {
          const patch = new THREE.Mesh(new THREE.CircleGeometry(0.1, 8), new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, transparent: true, opacity: 0.75 }));
          patch.rotation.x = -Math.PI / 2;
          patch.position.set(-0.12 + i * 0.12, 0.012 + i * 0.002, (i % 2) * 0.07);
          group.add(patch);
        });
        break;
      }

      case 'gloam_fern': {
        // Its own lighting (slice 27): teal-lit fronds.
        const frondMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.7, emissive: 0x0f766e, emissiveIntensity: 0.55, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.3), frondMat);
          frond.position.set(Math.cos(a) * 0.07, 0.14, Math.sin(a) * 0.07);
          frond.rotation.set(0.5, -a, 0);
          group.add(frond);
        }
        break;
      }

      case 'flood_fern': {
        // Two-leaved (slice 27): lacy air fronds above,
        // ribbon hinted at the base.
        const frondMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.85, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.32), frondMat);
          frond.position.set(Math.cos(a) * 0.06, 0.16, Math.sin(a) * 0.06);
          frond.rotation.set(0.45, -a, 0);
          group.add(frond);
        }
        const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.2), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.4, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
        ribbon.position.set(0.1, 0.05, 0.05);
        ribbon.rotation.z = 0.5;
        group.add(ribbon);
        break;
      }

      case 'ice_bloom': {
        // The century's appointment (slice 27): one pale
        // forged bloom, open.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.4, metalness: 0.3 }));
        stalk.position.y = 0.1;
        group.add(stalk);
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.25, metalness: 0.2, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.CircleGeometry(0.05, 7), petalMat);
          petal.position.set(Math.cos(a) * 0.05, 0.22, Math.sin(a) * 0.05);
          petal.rotation.set(0.7, -a, 0);
          group.add(petal);
        }
        break;
      }

      case 'ripple_bell': {
        // Tuned to water (slice 27): bells on a bank stem.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.3, 5), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 }));
        stem.position.y = 0.15;
        group.add(stem);
        const bellMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.4, metalness: 0.3 });
        for (let i = 0; i < 3; i++) {
          const bell = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.07, 8, 1, true), bellMat);
          bell.position.set((i - 1) * 0.07, 0.26 - Math.abs(i - 1) * 0.03, 0);
          bell.rotation.x = Math.PI;
          group.add(bell);
        }
        break;
      }

    default:
      return null;
  }
  return group;
}
