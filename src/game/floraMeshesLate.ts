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

      case 'night_candle': {
        // The far country's candle (slice 28): a tall white
        // bloom, waxy and upright.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.4, 6), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 }));
        stalk.position.y = 0.2;
        group.add(stalk);
        const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 8), new THREE.MeshStandardMaterial({ color: 0xfefce8, roughness: 0.5, emissive: 0x854d0e, emissiveIntensity: 0.25 }));
        bloom.position.y = 0.46;
        group.add(bloom);
        break;
      }

      case 'scar_orchid': {
        // Cured by its address (slice 28): a pink orchid at
        // steam height.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.22, 5), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 }));
        stem.position.y = 0.11;
        group.add(stem);
        const bloomMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.7, side: THREE.DoubleSide });
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.CircleGeometry(0.045, 7), bloomMat);
          petal.position.set(Math.cos(a) * 0.04, 0.24, Math.sin(a) * 0.04);
          petal.rotation.set(0.6, -a, 0);
          group.add(petal);
        }
        break;
      }

      case 'ashveil': {
        // The quilt (slice 28): a gray felt mat.
        const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.025, 11), new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 1 }));
        mat.position.y = 0.012;
        group.add(mat);
        break;
      }

      case 'chime_reed': {
        // Early warning, grown (slice 28): hollow stems in a
        // stand.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.6 });
        for (let i = 0; i < 4; i++) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42 + (i % 2) * 0.08, 5, 1, true), stemMat);
          stem.position.set(-0.09 + i * 0.06, 0.21, (i % 2) * 0.05);
          group.add(stem);
        }
        break;
      }

      case 'sky_lily': {
        // Open in exactly the worst weather (slice 28): cups
        // turned up to falling rain.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.24, 6), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 }));
        stem.position.y = 0.12;
        group.add(stem);
        const cup = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.09, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xf0abfc, roughness: 0.6, side: THREE.DoubleSide }));
        cup.position.y = 0.28;
        group.add(cup);
        break;
      }

      case 'fall_orchid': {
        // Perfume grade (slice 28): an orchid on bark, drawn
        // with its section of the giant.
        const bark = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 1 }));
        bark.position.y = 0.15;
        bark.rotation.z = 0.2;
        group.add(bark);
        const bloomMat = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.7, side: THREE.DoubleSide });
        for (let i = 0; i < 3; i++) {
          const a = (i / 3) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.CircleGeometry(0.04, 7), bloomMat);
          petal.position.set(0.1 + Math.cos(a) * 0.03, 0.26, Math.sin(a) * 0.03);
          petal.rotation.set(0.6, -a, 0);
          group.add(petal);
        }
        break;
      }

      case 'deck_flower': {
        // The view from below (slice 28): a hanging flower,
        // drawn hanging.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 4), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 }));
        stem.position.y = 0.3;
        group.add(stem);
        const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.09, 8, 1, true), new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.7, side: THREE.DoubleSide }));
        bloom.position.y = 0.2;
        group.add(bloom);
        break;
      }

      case 'feral_rose': {
        // Taming at root depth (slice 28): an unruled forged
        // rose, thorny past garden manners.
        const caneMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.9 });
        for (let i = 0; i < 3; i++) {
          const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.3, 5), caneMat);
          cane.position.set((i - 1) * 0.05, 0.15, 0);
          cane.rotation.z = (i - 1) * 0.3;
          group.add(cane);
        }
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.6, metalness: 0.2 }));
        bloom.position.set(0, 0.32, 0);
        group.add(bloom);
        break;
      }

      case 'bone_orchid': {
        // For the white work (slice 28): an ivory orchid,
        // carved-looking.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.2, 5), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9 }));
        stem.position.y = 0.1;
        group.add(stem);
        const bloomMat = new THREE.MeshStandardMaterial({ color: 0xfafaf9, roughness: 0.5, side: THREE.DoubleSide });
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.CircleGeometry(0.04, 7), bloomMat);
          petal.position.set(Math.cos(a) * 0.035, 0.22, Math.sin(a) * 0.035);
          petal.rotation.set(0.6, -a, 0);
          group.add(petal);
        }
        break;
      }

      case 'marrow_reed': {
        // The pools' clarity (slice 28): pale reeds at pool
        // duty.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.85 });
        for (let i = 0; i < 4; i++) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.014, 0.4 + (i % 2) * 0.07, 5), stemMat);
          stem.position.set(-0.08 + i * 0.055, 0.2, (i % 2) * 0.04);
          group.add(stem);
        }
        break;
      }

      case 'pale_sedge': {
        // A shadow's shape (slice 28): pale tufts under a rib
        // arc's shade.
        const tuftMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.95, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.2), tuftMat);
          blade.position.set(Math.cos(a) * 0.05, 0.1, Math.sin(a) * 0.05);
          blade.rotation.set(0.4, -a, 0);
          group.add(blade);
        }
        break;
      }

      case 'snow_cress': {
        // The news that winter is ending (slice 28): tiny
        // white bells through snow.
        const snow = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.04, 9), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }));
        snow.position.y = 0.02;
        group.add(snow);
        const bellMat = new THREE.MeshStandardMaterial({ color: 0xf0fdf4, roughness: 0.7 });
        for (let i = 0; i < 3; i++) {
          const bell = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.04, 6), bellMat);
          bell.position.set(-0.06 + i * 0.06, 0.08, (i % 2) * 0.04);
          bell.rotation.x = Math.PI;
          group.add(bell);
        }
        break;
      }

      case 'scald_fern': {
        // Self-heating medicine (slice 29): fronds over a
        // steam wisp.
        const frondMat = new THREE.MeshStandardMaterial({ color: 0xea580c, roughness: 0.85, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.3), frondMat);
          frond.position.set(Math.cos(a) * 0.06, 0.15, Math.sin(a) * 0.06);
          frond.rotation.set(0.5, -a, 0);
          group.add(frond);
        }
        const steam = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.3 }));
        steam.position.y = 0.2;
        group.add(steam);
        break;
      }

      case 'mulch_rose': {
        // The census's rich entry (slice 29): a deep pink
        // rose on finished beds.
        const bed = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.17, 0.05, 9), new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 1 }));
        bed.position.y = 0.025;
        group.add(bed);
        const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.26, 5), new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.9 }));
        cane.position.y = 0.17;
        group.add(cane);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ color: 0xbe185d, roughness: 0.65 }));
        bloom.position.y = 0.33;
        group.add(bloom);
        break;
      }

      case 'brine_rose': {
        // Seasoning and souvenir (slice 29): a pale pink rose
        // with a salt rind at its base.
        const cane = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 0.28, 5), new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.9 }));
        cane.position.y = 0.14;
        group.add(cane);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({ color: 0xf9a8d4, roughness: 0.65 }));
        bloom.position.y = 0.31;
        group.add(bloom);
        const rind = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 4, 12), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 }));
        rind.rotation.x = Math.PI / 2;
        rind.position.y = 0.03;
        group.add(rind);
        break;
      }

      case 'frost_reed': {
        // Organ pipes filling with winter (slice 29): ice-
        // cored stems.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0xa5f3fc, roughness: 0.3, transparent: true, opacity: 0.85 });
        for (let i = 0; i < 4; i++) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.015, 0.44 + (i % 2) * 0.07, 6), stemMat);
          stem.position.set(-0.08 + i * 0.055, 0.22, (i % 2) * 0.04);
          group.add(stem);
        }
        break;
      }

      case 'snow_shelf': {
        // The third parish (slice 29): rimed brackets on a
        // frozen trunk.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, 0.44, 8), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 }));
        trunk.position.y = 0.22;
        group.add(trunk);
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.6 });
        for (let i = 0; i < 2; i++) {
          const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.09 - i * 0.02, 0.1 - i * 0.02, 0.025, 9, 1, false, 0, Math.PI), shelfMat);
          shelf.position.set(0, 0.15 + i * 0.16, 0.08);
          group.add(shelf);
        }
        break;
      }

      case 'sump_cap': {
        // Lit by its appetizer (slice 29): a glow-gilled cap
        // on a raft log.
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.34, 7), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 1 }));
        log.rotation.z = Math.PI / 2;
        log.position.y = 0.05;
        group.add(log);
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.1, 6), new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.9 }));
        stalk.position.y = 0.13;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.075, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.8 }));
        cap.position.y = 0.18;
        group.add(cap);
        const gills = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x16a34a, emissiveIntensity: 0.8, roughness: 0.5, side: THREE.DoubleSide }));
        gills.rotation.x = Math.PI / 2;
        gills.position.y = 0.175;
        group.add(gills);
        break;
      }

      case 'grave_puff': {
        // Plain as its name (slice 29): a gray puffball, deliberate.
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 1 }));
        puff.scale.y = 0.9;
        puff.position.y = 0.09;
        group.add(puff);
        break;
      }

      case 'salt_mold': {
        // The flats' second skin (slice 29): a crystal-edged
        // film on crust.
        const crust = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.03, 10), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 }));
        crust.position.y = 0.015;
        group.add(crust);
        const film = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.23, 0.035, 10), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.4 }));
        film.position.y = 0.017;
        group.add(film);
        break;
      }

      case 'ash_mold': {
        // Succession itself (slice 29): a gray-green film on
        // an old burn.
        const burn = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.16, 0.06, 8), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 1 }));
        burn.position.y = 0.03;
        group.add(burn);
        const film = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 1 }));
        film.scale.y = 0.4;
        film.position.y = 0.05;
        group.add(film);
        break;
      }

      case 'nest_cap': {
        // The tenancy outranks the appetite (slice 29): a
        // broad flat cap, lined.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.14, 7), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95 }));
        stalk.position.y = 0.07;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.13, 0.035, 11), new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.9 }));
        cap.position.y = 0.15;
        group.add(cap);
        const lining = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 10), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 1 }));
        lining.position.y = 0.17;
        group.add(lining);
        break;
      }

      case 'frost_mold': {
        // Inherited, not gathered (slice 29): a pale fur
        // lining a tunnel mouth.
        const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 6, 10, Math.PI), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.9 }));
        mouth.position.y = 0.02;
        group.add(mouth);
        const fur = new THREE.Mesh(new THREE.SphereGeometry(0.085, 8, 6), new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 1 }));
        fur.scale.y = 0.5;
        fur.position.y = 0.03;
        group.add(fur);
        break;
      }

      case 'steam_cap': {
        // The margin's one address (slice 29): a cap in its
        // own steam.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.035, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 }));
        stalk.position.y = 0.06;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.08, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.7 }));
        cap.position.y = 0.12;
        group.add(cap);
        const steam = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.35 }));
        steam.position.y = 0.2;
        group.add(steam);
        break;
      }

      case 'valley_heart': {
        // The valley decides here (slice 31, landscape flora):
        // one great tree, canopy as micro-biome — drawn wide
        // and layered; the scale row does the rest.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 1.6, 10), new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 1 }));
        trunk.position.y = 0.8;
        group.add(trunk);
        const canopyMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 1 });
        for (let i = 0; i < 4; i++) {
          const blob = new THREE.Mesh(new THREE.SphereGeometry(0.75 - i * 0.08, 10, 8), canopyMat);
          blob.position.set((i % 2 === 0 ? 1 : -1) * 0.4 * (i > 1 ? 0.5 : 1), 1.9 + i * 0.22, (i % 3 === 0 ? 1 : -1) * 0.3);
          group.add(blob);
        }
        break;
      }

      case 'mother_grove': {
        // One organism, miles across (slice 31): the grove-
        // cluster presence — a ring of its fingers, one body.
        const capMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.9 });
        const stalkMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.95 });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const x = Math.cos(a) * 0.35, z = Math.sin(a) * 0.35;
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.3 + (i % 3) * 0.1, 6), stalkMat);
          stalk.position.set(x, 0.2, z);
          group.add(stalk);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.14, 9, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
          cap.position.set(x, 0.35 + (i % 3) * 0.1, z);
          group.add(cap);
        }
        // The center finger, eldest.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.5, 7), stalkMat);
        stalk.position.y = 0.25;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.position.y = 0.5;
        group.add(cap);
        break;
      }

      case 'first_tree': {
        // A zone's ceiling (slice 31): the standing sibling —
        // a straight giant with a high, wide crown.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.5, 2.1, 10), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 1 }));
        trunk.position.y = 1.05;
        group.add(trunk);
        const crownMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 1 });
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.95, 11, 8), crownMat);
        crown.scale.set(1.25, 0.6, 1.25);
        crown.position.y = 2.5;
        group.add(crown);
        break;
      }

      case 'lake_jelly': {
        // The reef's lit windows (pond build): gel domes on a
        // stone, glowing faintly green in the black water.
        const stone = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 1 }));
        stone.scale.set(1.3, 0.5, 1.1);
        stone.position.y = 0.05;
        group.add(stone);
        const gelMat = new THREE.MeshStandardMaterial({
          color: 0x4ade80, roughness: 0.25, transparent: true, opacity: 0.75,
          emissive: 0x16a34a, emissiveIntensity: 0.5,
        });
        for (let i = 0; i < 4; i++) {
          const dome = new THREE.Mesh(new THREE.SphereGeometry(0.13 - i * 0.02, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), gelMat);
          dome.position.set(Math.sin(i * 1.8) * 0.2, 0.16, Math.cos(i * 1.8) * 0.17);
          group.add(dome);
        }
        break;
      }

    default:
      return null;
  }
  return group;
}
