/**
 * BioForge creature + flora mesh factories (extracted from
 * threeEngine.ts, 2026-10-14 — pure move, no behavior change).
 *
 * The engine's shared-materials seam, same pattern as
 * game/structureBuilders.ts: a factory takes the palette (and the
 * engine's terrain-height sampler, which the meshes stand on) and
 * returns the mesh kit. The idle-wiggle state lives in this closure
 * — render-only, seeded per creature id, so a creature wiggles the
 * same way on every screen and never needs syncing or saving.
 */
import * as THREE from 'three';
import type { FloraEntity, FaunaEntity } from '../types/game';
import { speciesDef } from './species';
import { buildFloraMesh, updateFloraMeshImpl } from './floraMeshes';
import { BrownianWiggle, hashStringToSeed, type WiggleOptions } from './motion';
import type { StructureMaterials } from './structureBuilders';

// Per-species idle-wiggle flavors (see game/motion.ts for what the knobs
// mean). A predator should not fidget like a puff: the stalker is nearly
// statue-still with a slow rock, the puff is busy and bouncy, the mouse is
// small and quick. Tuned by simulation — typical drift: stalker ~4 mm,
// mouse ~1.5 cm, puff ~3 cm.
const FAUNA_WIGGLE_FLAVORS: Record<string, WiggleOptions> = {
  chitin_stalker: { impulse: 0.5, maxOffset: 0.02, maxRock: 0.06, spring: 8, damping: 4 },
  soft_puff: { impulse: 2.0, maxOffset: 0.06, maxRock: 0.07, spring: 5, damping: 2.2 },
  burrow_mouse: { impulse: 1.6, maxOffset: 0.035, maxRock: 0.04, spring: 9, damping: 3.5 },
  vesper_glider: { impulse: 0.7, maxOffset: 0.05, maxRock: 0.1, spring: 3.5, damping: 2.4 },
};
const FAUNA_WIGGLE_DEFAULT: WiggleOptions = { impulse: 1.4, maxOffset: 0.05, maxRock: 0.05, spring: 6, damping: 3 };

export interface CreatureMeshKit {
  createFloraMesh(flora: FloraEntity): THREE.Group;
  updateFloraMesh(mesh: THREE.Group, flora: FloraEntity): void;
  createFaunaMesh(fauna: FaunaEntity): THREE.Group;
  updateFaunaMesh(mesh: THREE.Group, fauna: FaunaEntity, wiggleDt?: number): void;
  /** Drop a removed creature's wiggle state (mesh disposal stays the engine's). */
  forgetFauna(id: string): void;
}

export function createCreatureMeshKit(
  materials: StructureMaterials,
  terrainHeightAt: (x: number, z: number) => number,
): CreatureMeshKit {
  // Idle-life wiggle state per fauna (render-only; see motion.ts).
  const wiggleMap = new Map<string, { wiggle: BrownianWiggle; species: FaunaEntity['species'] }>();

  // Flora meshes live in floraMeshes.ts (slice 10 extraction —
  // this file outgrew the single-push cap); the kit delegates.
  function createFloraMesh(flora: FloraEntity): THREE.Group {
    return buildFloraMesh(flora, materials, terrainHeightAt);
  }

  function updateFloraMesh(mesh: THREE.Group, flora: FloraEntity): void {
    updateFloraMeshImpl(mesh, flora);
  }

  function createFaunaMesh(fauna: FaunaEntity): THREE.Group {
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

        const ant = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 10), materials.biolumCyan);
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

        const head = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.5, 6), materials.porcelainWhite);
        head.rotation.x = Math.PI / 2;
        head.position.set(0, 0.8, 0.75);
        group.add(head);
        break;
      }

      case 'mirror_moth': {
        // Mirror Marsh pollinator (2026-10-15): a low drifter with
        // two big translucent wings that catch the doubled light.
        // Drawn hovering — body rides at local y 0.55.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd6cfc0, roughness: 0.8 });
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0xbfe8e2, roughness: 0.25, transparent: true, opacity: 0.55,
          emissive: 0x5fb8ad, emissiveIntensity: 0.5, side: THREE.DoubleSide,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), bodyMat);
        body.scale.set(0.8, 0.8, 1.6);
        body.position.y = 0.55;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bodyMat);
        head.position.set(0, 0.58, 0.26);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 6), wingMat);
          wing.scale.set(1, 0.06, 0.55);
          wing.position.set(side * 0.4, 0.62, -0.02);
          wing.rotation.z = side * 0.25;
          group.add(wing);
        }
        break;
      }

      case 'vesper_glider': {
        // A dusk glider: slim body, two swept membrane wings veined
        // like ears, a fan tail. It is drawn AIRBORNE — updateFaunaMesh
        // holds the whole mesh at glide height with a slow bob, so the
        // body sits at local y 0 and the wings do the talking.
        const bodyMat = new THREE.MeshStandardMaterial({
          color: fauna.isTamed ? 0x818cf8 : 0x6366f1,
          roughness: 0.55,
          emissive: 0x312e81,
          emissiveIntensity: 0.45,
        });
        const membraneMat = new THREE.MeshStandardMaterial({
          color: 0xa5b4fc,
          roughness: 0.6,
          transparent: true,
          opacity: 0.72,
          side: THREE.DoubleSide,
          emissive: 0x4338ca,
          emissiveIntensity: 0.25,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.55, 6, 10), bodyMat);
        body.rotation.x = Math.PI / 2;
        body.castShadow = true;
        group.add(body);

        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 10), bodyMat);
        head.position.set(0, 0.05, 0.48);
        group.add(head);
        // The ears the species is named for — two small vanes up top.
        for (const sideSign of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 6), membraneMat);
          ear.position.set(0.09 * sideSign, 0.22, 0.44);
          ear.rotation.z = -0.3 * sideSign;
          group.add(ear);
        }
        for (const sideSign of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.5), membraneMat);
          wing.name = sideSign < 0 ? 'gliderWingL' : 'gliderWingR';
          wing.position.set(0.68 * sideSign, 0.06, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.12;
          wing.rotation.z = 0.1 * sideSign;
          group.add(wing);
        }
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3), membraneMat);
        tail.position.set(0, 0.03, -0.5);
        tail.rotation.x = -Math.PI / 2;
        group.add(tail);
        break;
      }

      case 'meadowback': {
        // The Meadow's emblem (creature build phase, slice 1): a
        // broad-backed herd grazer. The back is the feature — flat,
        // warm, wide enough to ride on — so it gets its own slab,
        // colored like sunlit turf over the moss-green body.
        const bodyMat = new THREE.MeshStandardMaterial({
          color: fauna.isTamed ? 0x4ade80 : 0x65a30d,
          roughness: 0.85,
          emissive: 0x1a2e05,
          emissiveIntensity: 0.25,
        });
        const backMat = new THREE.MeshStandardMaterial({ color: 0xa3b86b, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 8, 12), bodyMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.95;
        body.castShadow = true;
        group.add(body);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.12, 1.15), backMat);
        back.position.y = 1.52;
        group.add(back);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), bodyMat);
        head.position.set(0, 1.02, 0.98);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.24, 6), backMat);
          ear.position.set(side * 0.24, 1.32, 0.92);
          ear.rotation.z = side * -0.5;
          group.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.5, 4, 6), bodyMat);
        tail.position.set(0, 0.95, -0.95);
        tail.rotation.x = 0.7;
        group.add(tail);
        break;
      }

      case 'pale_hare': {
        // Meadow x Frost (slice 1): snow-white, long-eared — the
        // Blink Hare's ordinary cousin. Small body, the ears do the
        // silhouette work, a puff of tail behind.
        const furMat = new THREE.MeshStandardMaterial({
          color: fauna.isTamed ? 0xf8fafc : 0xe2e8f0,
          roughness: 0.9,
          emissive: 0x334155,
          emissiveIntensity: 0.12,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), furMat);
        body.scale.set(0.85, 0.8, 1.25);
        body.position.y = 0.34;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), furMat);
        head.position.set(0, 0.52, 0.34);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.3, 4, 6), furMat);
          ear.position.set(side * 0.09, 0.88, 0.3);
          ear.rotation.x = -0.15;
          group.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), furMat);
        tail.position.set(0, 0.42, -0.38);
        group.add(tail);
        break;
      }

      case 'frost_vole': {
        // The Cold Range's mouse (slice 1): a low, round subnivean
        // vole in winter coat — drawn close to the ground it tunnels
        // under, with a thin tail trailing.
        const coatMat = new THREE.MeshStandardMaterial({
          color: fauna.isTamed ? 0xe7e5e4 : 0xcbd5e1,
          roughness: 0.95,
          emissive: 0x1e293b,
          emissiveIntensity: 0.1,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), coatMat);
        body.scale.set(0.9, 0.72, 1.35);
        body.position.y = 0.18;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), coatMat);
        head.position.set(0, 0.22, 0.26);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), coatMat);
          ear.position.set(side * 0.11, 0.33, 0.2);
          group.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.22, 4, 6), coatMat);
        tail.position.set(0, 0.1, -0.34);
        tail.rotation.x = Math.PI / 2 - 0.25;
        group.add(tail);
        break;
      }

      case 'dew_gnat': {
        // The everywhere pest (slice 2): a speck with wings. Drawn
        // hovering — updateFaunaMesh holds it at dart height with a
        // quick bob, so the body sits at local y 0.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.6 });
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0xecfccb, roughness: 0.3, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), bodyMat);
        body.scale.set(0.8, 0.8, 1.5);
        group.add(body);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 5), wingMat);
          wing.scale.set(1, 0.08, 0.5);
          wing.position.set(side * 0.08, 0.04, -0.01);
          wing.rotation.z = side * 0.4;
          group.add(wing);
        }
        break;
      }

      case 'meadow_hopper': {
        // The meadow's weather (slice 2): a small green hopper —
        // wing-cased body, spring legs folded long behind it.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.7 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), bodyMat);
        body.scale.set(0.8, 0.85, 1.5);
        body.position.y = 0.14;
        group.add(body);
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.02, 0.2, 4, 6), bodyMat);
          leg.position.set(side * 0.08, 0.1, -0.12);
          leg.rotation.x = 0.9;
          group.add(leg);
        }
        break;
      }

      case 'ember_newt': {
        // Ember's smallest telegraph (slice 2): coal skin over an
        // ember belly — the glow is the feeling, drawn lit.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
        const bellyMat = new THREE.MeshStandardMaterial({
          color: 0xea580c, roughness: 0.5, emissive: 0xc2410c, emissiveIntensity: 0.9,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.3, 6, 10), skinMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.16;
        group.add(body);
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bellyMat);
        belly.scale.set(0.9, 0.45, 1.9);
        belly.position.y = 0.09;
        group.add(belly);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.04, 0.28, 4, 6), skinMat);
        tail.position.set(0, 0.13, -0.36);
        tail.rotation.x = Math.PI / 2 - 0.2;
        group.add(tail);
        break;
      }

      case 'glint_beetle': {
        // A beetle grown of Saltglass itself (slice 2): a rounded
        // shell with crystal facets standing on its back, catching
        // the light it stores by day and spends at dusk.
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.25, metalness: 0.1,
          emissive: 0x0e7490, emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), shellMat);
        body.scale.set(1, 0.7, 1.3);
        body.position.y = 0.11;
        body.castShadow = true;
        group.add(body);
        for (const [fx, fz] of [[0, 0.08], [-0.06, -0.05], [0.06, -0.05]] as const) {
          const facet = new THREE.Mesh(new THREE.OctahedronGeometry(0.045), shellMat);
          facet.position.set(fx, 0.2, fz);
          group.add(facet);
        }
        break;
      }

      case 'glow_grub': {
        // A segmented grub whose glow is its digestion (slice 2):
        // three body rings, the middle one lit from inside.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9f99d, roughness: 0.7 });
        const glowMat = new THREE.MeshStandardMaterial({
          color: 0x86efac, roughness: 0.4, emissive: 0x22c55e, emissiveIntensity: 1.1,
        });
        const segments: Array<[number, THREE.Material]> = [[0.16, skinMat], [0, glowMat], [-0.16, skinMat]];
        for (const [sz, mat] of segments) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), mat);
          seg.scale.set(1, 0.75, 1);
          seg.position.set(0, 0.09, sz);
          group.add(seg);
        }
        break;
      }

      case 'sedge_hen': {
        // An honest biped (slice 2): body, neck, opinions. The
        // legs are the silhouette — two reed-thin stilts under a
        // striped, upright body.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.85 });
        const bandMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
        body.scale.set(0.85, 1, 1.15);
        body.position.y = 0.52;
        body.castShadow = true;
        group.add(body);
        const band = new THREE.Mesh(new THREE.SphereGeometry(0.245, 12, 8), bandMat);
        band.scale.set(0.87, 0.35, 1.17);
        band.position.y = 0.52;
        group.add(band);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), bodyMat);
        head.position.set(0, 0.88, 0.14);
        group.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 6), bandMat);
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.86, 0.3);
        group.add(beak);
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.34, 6), bodyMat);
          leg.position.set(side * 0.09, 0.17, 0);
          group.add(leg);
        }
        const tail = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.12), bodyMat);
        tail.position.set(0, 0.68, -0.26);
        tail.rotation.x = -0.6;
        group.add(tail);
        break;
      }

      case 'valley_goat': {
        // The valley's opposition (slice 2): a sure-footed grazer
        // with hearthroot blooms in its coat where the valley has
        // petted it — three small flowers ride the back.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.95 });
        const bloomMat = new THREE.MeshStandardMaterial({
          color: 0xf9a8d4, roughness: 0.6, emissive: 0x9d174d, emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.55, 8, 12), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.72;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), coatMat);
        head.scale.set(0.8, 0.9, 1.2);
        head.position.set(0, 0.92, 0.55);
        group.add(head);
        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.26, 6), coatMat);
          horn.position.set(side * 0.11, 1.12, 0.45);
          horn.rotation.x = -0.7;
          group.add(horn);
        }
        for (const [bx, bz] of [[-0.12, 0.15], [0.1, -0.05], [0, 0.32]] as const) {
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), bloomMat);
          bloom.position.set(bx, 1.08, bz);
          group.add(bloom);
        }
        break;
      }

      case 'rime_puff': {
        // The Soft-Puff's mirror in the steadiest cold (slice 2):
        // same round body, same antenna bead — frost colors, and
        // it hops like its cousin (updateFaunaMesh shares the hop).
        const bodyMat = new THREE.MeshStandardMaterial({
          color: fauna.isTamed ? 0xbae6fd : 0xe0f2fe,
          roughness: 0.5,
          emissive: fauna.isTamed ? 0x0369a1 : 0x0c4a6e,
          emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 16), bodyMat);
        body.position.y = 0.4;
        body.castShadow = true;
        group.add(body);
        const ant = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), materials.biolumCyan);
        ant.position.set(0, 0.9, 0.18);
        group.add(ant);
        break;
      }

      case 'gloom_slug': {
        // The Underroot's breadcrumb-layer (slice 2): a long,
        // dark-backed body over a pale belly, eye stalks up.
        const backMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.6 });
        const bellyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.55, 8, 12), backMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.17;
        group.add(body);
        const belly = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), bellyMat);
        belly.scale.set(0.95, 0.4, 2.6);
        belly.position.y = 0.07;
        group.add(belly);
        for (const side of [-1, 1]) {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.16, 5), backMat);
          stalk.position.set(side * 0.06, 0.36, 0.42);
          group.add(stalk);
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), bellyMat);
          eye.position.set(side * 0.06, 0.45, 0.42);
          group.add(eye);
        }
        break;
      }

      case 'sun_lizard': {
        // A small solar calendar (slice 2): low body, wedge head,
        // a ridge of spines drinking the light along its back.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.8 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.34, 6, 10), skinMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.14;
        group.add(body);
        const head = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.22, 6), skinMat);
        head.rotation.x = Math.PI / 2;
        head.position.set(0, 0.13, 0.36);
        group.add(head);
        for (const rz of [0.12, 0, -0.12]) {
          const spine = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 5), skinMat);
          spine.position.set(0, 0.26, rz);
          group.add(spine);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.34, 4, 6), skinMat);
        tail.position.set(0, 0.1, -0.42);
        tail.rotation.x = Math.PI / 2 - 0.15;
        group.add(tail);
        break;
      }

      case 'mud_turtle': {
        // Precisely lily-sized trouble (slice 2): a domed shell,
        // a patient head, four flippers for the pond's walking.
        const shellMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9 });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.85 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 10), shellMat);
        shell.scale.set(1, 0.55, 1.2);
        shell.position.y = 0.2;
        shell.castShadow = true;
        group.add(shell);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skinMat);
        head.position.set(0, 0.18, 0.4);
        group.add(head);
        for (const [fx, fz] of [[-0.26, 0.2], [0.26, 0.2], [-0.26, -0.22], [0.26, -0.22]] as const) {
          const flipper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.1), skinMat);
          flipper.position.set(fx, 0.06, fz);
          group.add(flipper);
        }
        break;
      }

      case 'bog_cow': {
        // Hippo-hearted and pondweed-draped (slice 2): a big marsh
        // body wearing the pond — three weed mats across the back.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
        const weedMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 1 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.52, 0.9, 8, 12), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.85;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), hideMat);
        head.scale.set(1.05, 0.85, 1);
        head.position.set(0, 0.78, 0.92);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), hideMat);
          ear.position.set(side * 0.3, 1.02, 0.85);
          group.add(ear);
        }
        for (const [wx, wz, wr] of [[-0.2, 0.25, 0.3], [0.15, -0.1, -0.2], [0, 0.55, 0.1]] as const) {
          const weed = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.05, 0.3), weedMat);
          weed.position.set(wx, 1.36, wz);
          weed.rotation.y = wr;
          group.add(weed);
        }
        break;
      }

      case 'spore_stag': {
        // The fungal emblem (slice 3): a broad-antlered grazer
        // with shelf fungus growing on the antlers in seeded
        // patterns — two pale shelves ride the rack.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 });
        const shelfMat = new THREE.MeshStandardMaterial({
          color: 0xd6d3a8, roughness: 0.8, emissive: 0x57534e, emissiveIntensity: 0.2,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.48, 0.85, 8, 12), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.92;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), hideMat);
        head.scale.set(0.8, 0.9, 1.25);
        head.position.set(0, 1.1, 0.82);
        group.add(head);
        for (const side of [-1, 1]) {
          const antler = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55, 6), shelfMat);
          antler.position.set(side * 0.2, 1.5, 0.72);
          antler.rotation.z = side * -0.6;
          group.add(antler);
          const shelf = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), shelfMat);
          shelf.scale.set(1.2, 0.35, 0.8);
          shelf.position.set(side * 0.34, 1.42, 0.7);
          group.add(shelf);
        }
        break;
      }

      case 'hollow_hermit': {
        // A colony in a house (slice 3): a giant hollow shroom
        // shell, lantern-lit at the seams — the cap IS the
        // creature, with a skirt of small legs beneath it.
        const huskMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
        const seamMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24, roughness: 0.5, emissive: 0xd97706, emissiveIntensity: 0.7,
        });
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.85, 16, 12), huskMat);
        cap.scale.set(1, 0.72, 1);
        cap.position.y = 0.78;
        cap.castShadow = true;
        group.add(cap);
        const seam = new THREE.Mesh(new THREE.TorusGeometry(0.78, 0.03, 8, 24), seamMat);
        seam.rotation.x = Math.PI / 2;
        seam.position.y = 0.62;
        group.add(seam);
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2;
          const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.22, 4, 6), huskMat);
          leg.position.set(Math.cos(angle) * 0.62, 0.14, Math.sin(angle) * 0.62);
          leg.rotation.z = Math.cos(angle) * 0.5;
          leg.rotation.x = -Math.sin(angle) * 0.5;
          group.add(leg);
        }
        break;
      }

      case 'rootfall_bear': {
        // The Rootfall's resident (slice 3): moss-grown, huge,
        // one ear down — the roster is allowed a face.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.95 });
        const mossMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 1 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.62, 1.0, 8, 14), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 1.0;
        body.castShadow = true;
        group.add(body);
        const moss = new THREE.Mesh(new THREE.SphereGeometry(0.6, 12, 8), mossMat);
        moss.scale.set(1, 0.4, 1.4);
        moss.position.y = 1.58;
        group.add(moss);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 12, 10), hideMat);
        head.position.set(0, 1.05, 1.05);
        group.add(head);
        const earUp = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), hideMat);
        earUp.position.set(-0.24, 1.4, 1.0);
        group.add(earUp);
        const earDown = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), hideMat);
        earDown.scale.set(1, 0.5, 1);
        earDown.position.set(0.26, 1.28, 1.02);
        group.add(earDown);
        break;
      }

      case 'mulch_beetle': {
        // The Mulchwood's farmer (slice 3): a dome-backed beetle
        // with a tended fungus comb riding its back.
        const shellMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.6 });
        const combMat = new THREE.MeshStandardMaterial({
          color: 0xfde68a, roughness: 0.8, emissive: 0x92400e, emissiveIntensity: 0.25,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), shellMat);
        body.scale.set(1, 0.75, 1.3);
        body.position.y = 0.13;
        group.add(body);
        const comb = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), combMat);
        comb.scale.set(1.1, 0.5, 1.4);
        comb.position.y = 0.24;
        group.add(comb);
        break;
      }

      case 'brine_stilt': {
        // Held high and dry (slice 3): six salt-crystal stilts
        // under a small, serene body — the wading argument,
        // standing on legs above the drag.
        const legMat = new THREE.MeshStandardMaterial({
          color: 0xe0f2fe, roughness: 0.3, emissive: 0x7dd3fc, emissiveIntensity: 0.25,
        });
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.8 });
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.85, 6), legMat);
            leg.position.set(side * 0.16, 0.43, 0.22 - i * 0.22);
            leg.rotation.z = side * 0.18;
            group.add(leg);
          }
        }
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.24, 12, 10), bodyMat);
        body.scale.set(0.85, 0.8, 1.3);
        body.position.y = 0.95;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), bodyMat);
        head.position.set(0, 1.12, 0.3);
        group.add(head);
        break;
      }

      case 'hello_frog': {
        // The marsh saying hello (slice 3): a leaf-green frog
        // with a throat fan that inflates to greet — drawn
        // fanned, in the Greeter's own green.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.65 });
        const fanMat = new THREE.MeshStandardMaterial({
          color: 0xbbf7d0, roughness: 0.5, emissive: 0x16a34a, emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), skinMat);
        body.scale.set(1.1, 0.7, 1);
        body.position.y = 0.13;
        group.add(body);
        const fan = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), fanMat);
        fan.scale.set(0.9, 0.8, 0.6);
        fan.position.set(0, 0.1, 0.15);
        group.add(fan);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), skinMat);
          eye.position.set(side * 0.09, 0.26, 0.06);
          group.add(eye);
        }
        break;
      }

      case 'foam_frog': {
        // The siesta citizen (slice 3): a still frog in a raft
        // of its own foam — the raft is drawn with it, moored
        // wherever it currently is.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.7 });
        const foamMat = new THREE.MeshStandardMaterial({ color: 0xf0fdf4, roughness: 0.4 });
        const raft = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), foamMat);
        raft.scale.set(1.2, 0.3, 1.2);
        raft.position.y = 0.05;
        group.add(raft);
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skinMat);
        body.scale.set(1.1, 0.7, 1);
        body.position.y = 0.16;
        group.add(body);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), skinMat);
          eye.position.set(side * 0.08, 0.28, 0.05);
          group.add(eye);
        }
        break;
      }

      case 'mudskipper': {
        // The flats' puppet theater (slice 3): a fin-legged
        // walker — body low, pectoral fins planted like elbows,
        // a dorsal fin-flag for its territorial displays.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xca8a04, roughness: 0.75 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.24, 6, 8), skinMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.14;
        group.add(body);
        const flag = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 4), skinMat);
        flag.scale.set(0.4, 1, 1);
        flag.position.set(0, 0.26, -0.02);
        group.add(flag);
        for (const side of [-1, 1]) {
          const fin = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), skinMat);
          fin.scale.set(0.4, 0.8, 1);
          fin.position.set(side * 0.12, 0.07, 0.12);
          group.add(fin);
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), skinMat);
          eye.position.set(side * 0.05, 0.26, 0.16);
          group.add(eye);
        }
        break;
      }

      case 'landfish': {
        // The slow part of the river, walking (slice 3): a
        // thick-skinned fish on pectorals like elbows, built
        // for the commute between pools.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.5, 8, 10), skinMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.3;
        body.castShadow = true;
        group.add(body);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.34, 6), skinMat);
        tail.scale.set(0.35, 1, 1);
        tail.rotation.x = -Math.PI / 2;
        tail.position.set(0, 0.32, -0.55);
        group.add(tail);
        for (const side of [-1, 1]) {
          const elbow = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), skinMat);
          elbow.scale.set(0.5, 0.9, 1.1);
          elbow.position.set(side * 0.2, 0.12, 0.22);
          group.add(elbow);
        }
        break;
      }

      case 'cinderhound': {
        // Ember's pulse (slice 4): scale-plated, ember-eyed —
        // you see its weather before you see it. Three heat-
        // darkened plates ride the back; the eyes are lit coals.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.7 });
        const plateMat = new THREE.MeshStandardMaterial({
          color: 0x7f1d1d, roughness: 0.5, emissive: 0x991b1b, emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 8, 12), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.78;
        body.castShadow = true;
        group.add(body);
        for (const pz of [0.3, 0, -0.3]) {
          const plate = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.24), plateMat);
          plate.position.set(0, 1.16, pz);
          group.add(plate);
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 10), hideMat);
        head.scale.set(0.85, 0.85, 1.3);
        head.position.set(0, 0.85, 0.78);
        group.add(head);
        const eyeMat = new THREE.MeshStandardMaterial({
          color: 0xffedd5, emissive: 0xea580c, emissiveIntensity: 2.2,
        });
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.045, 6, 5), eyeMat);
          eye.position.set(side * 0.11, 0.92, 1.02);
          group.add(eye);
        }
        break;
      }

      case 'shard_grazer': {
        // The material's verb, on an animal (slice 4): a big
        // pale grazer with crystal plates accreting along its
        // back — where it stands frozen, it is the bright hour.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.85 });
        const plateMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.2, emissive: 0x155e75, emissiveIntensity: 0.4,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.9, 8, 12), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.9;
        body.castShadow = true;
        group.add(body);
        for (const [px, pz, s] of [[0, 0.35, 0.22], [-0.14, 0, 0.28], [0.14, -0.3, 0.2]] as const) {
          const plate = new THREE.Mesh(new THREE.OctahedronGeometry(s), plateMat);
          plate.scale.set(1, 0.5, 1);
          plate.position.set(px, 1.38, pz);
          group.add(plate);
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), hideMat);
        head.scale.set(0.85, 0.9, 1.15);
        head.position.set(0, 0.88, 0.9);
        group.add(head);
        break;
      }

      case 'frost_stag': {
        // The steady cold made flesh (slice 4): a huge stag
        // carrying ice sculpture — branched rime antlers that
        // accrete until they read as chandeliers.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.9 });
        const rimeMat = new THREE.MeshStandardMaterial({
          color: 0xe0f2fe, roughness: 0.35, emissive: 0x38bdf8, emissiveIntensity: 0.25,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 1.0, 8, 14), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 1.05;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), hideMat);
        head.scale.set(0.8, 0.9, 1.3);
        head.position.set(0, 1.35, 0.95);
        group.add(head);
        for (const side of [-1, 1]) {
          const beam = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.7, 6), rimeMat);
          beam.position.set(side * 0.22, 1.85, 0.85);
          beam.rotation.z = side * -0.5;
          group.add(beam);
          const tine = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.4, 5), rimeMat);
          tine.position.set(side * 0.38, 1.95, 0.82);
          tine.rotation.z = side * -0.9;
          group.add(tine);
        }
        break;
      }

      case 'glass_crab': {
        // The Flats' clock (slice 4): a glass dome on six thin
        // legs, shell-up to drink the noon.
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0xcffafe, roughness: 0.15, transparent: true, opacity: 0.75,
          emissive: 0x0e7490, emissiveIntensity: 0.3,
        });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.32, 14, 10), shellMat);
        shell.scale.set(1.15, 0.6, 1);
        shell.position.y = 0.32;
        shell.castShadow = true;
        group.add(shell);
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 5), shellMat);
            leg.position.set(side * 0.34, 0.16, 0.18 - i * 0.18);
            leg.rotation.z = side * 0.7;
            group.add(leg);
          }
        }
        for (const side of [-1, 1]) {
          const claw = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), shellMat);
          claw.scale.set(1, 0.7, 1.3);
          claw.position.set(side * 0.22, 0.14, 0.34);
          group.add(claw);
        }
        break;
      }

      case 'thawmole': {
        // Freeze-thaw's neighbor (slice 4): a low ice-furred
        // body with digging claws up front — drawn thawed.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 1 });
        const clawMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), furMat);
        body.scale.set(0.9, 0.7, 1.35);
        body.position.y = 0.16;
        group.add(body);
        const snout = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 8), furMat);
        snout.rotation.x = Math.PI / 2;
        snout.position.set(0, 0.13, 0.3);
        group.add(snout);
        for (const side of [-1, 1]) {
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.14, 5), clawMat);
          claw.position.set(side * 0.14, 0.06, 0.24);
          claw.rotation.x = 1.9;
          group.add(claw);
        }
        break;
      }

      case 'prism_frog': {
        // A living prism (slice 4): translucent, glass-skinned
        // — light goes in white and the body keeps the colors.
        const skinMat = new THREE.MeshStandardMaterial({
          color: 0xf5d0fe, roughness: 0.15, transparent: true, opacity: 0.65,
          emissive: 0xa21caf, emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), skinMat);
        body.scale.set(1.15, 0.75, 1);
        body.position.y = 0.11;
        group.add(body);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.04, 6, 5), skinMat);
          eye.position.set(side * 0.08, 0.22, 0.04);
          group.add(eye);
        }
        break;
      }

      case 'skull_ants': {
        // Bone dust that decided to move (slice 4): at game
        // scale an ant is three white specks in a row — the
        // colony reads in numbers, not in individuals.
        const antMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.8 });
        for (const [az, s] of [[0.07, 0.03], [0, 0.042], [-0.07, 0.034]] as const) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(s, 6, 5), antMat);
          seg.position.set(0, 0.035, az);
          group.add(seg);
        }
        break;
      }

      case 'dune_roller': {
        // A wheel with opinions (slice 4): one faceted geode
        // body, iron-crusted, flat-shaded so the facets read.
        const crustMat = new THREE.MeshStandardMaterial({
          color: 0x57534e, roughness: 0.55, metalness: 0.45, flatShading: true,
          emissive: 0x292524, emissiveIntensity: 0.4,
        });
        const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.42, 0), crustMat);
        body.position.y = 0.42;
        body.castShadow = true;
        group.add(body);
        break;
      }

      case 'boneback_tortoise': {
        // A closed loop wearing a shell (slice 4): a great dome
        // with bone fragments lodged in it and moss taking
        // them — the Fields, carried.
        const shellMat = new THREE.MeshStandardMaterial({ color: 0x6b6257, roughness: 0.95 });
        const fragMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 });
        const mossMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 1 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), shellMat);
        shell.scale.set(1, 0.6, 1.2);
        shell.position.y = 0.36;
        shell.castShadow = true;
        group.add(shell);
        for (const [fx, fz, fr] of [[-0.2, 0.2, 0.4], [0.25, -0.1, -0.3], [0, 0.42, 0.1]] as const) {
          const frag = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.22, 5), fragMat);
          frag.position.set(fx, 0.72, fz);
          frag.rotation.z = fr;
          group.add(frag);
        }
        const moss = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mossMat);
        moss.scale.set(1.1, 0.3, 1.1);
        moss.position.y = 0.66;
        group.add(moss);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), shellMat);
        head.position.set(0, 0.3, 0.68);
        group.add(head);
        break;
      }

      case 'marrow_deer': {
        // Simply, visibly well (slice 4): a pale deer with
        // antlers of the country's own material, grown into a
        // crown.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0xfef3c7, roughness: 0.9 });
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.7, 8, 12), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.85;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 10, 8), coatMat);
        head.scale.set(0.8, 0.9, 1.25);
        head.position.set(0, 1.12, 0.68);
        group.add(head);
        for (const side of [-1, 1]) {
          const antler = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.5, 6), boneMat);
          antler.position.set(side * 0.14, 1.45, 0.6);
          antler.rotation.z = side * -0.45;
          group.add(antler);
        }
        break;
      }

      case 'kiln_star': {
        // Starfish logic at walking speed (slice 4): five
        // glassy points around a low dome — it walks by
        // tipping, and noon belongs to it.
        const starMat = new THREE.MeshStandardMaterial({
          color: 0xfdba74, roughness: 0.3, emissive: 0x9a3412, emissiveIntensity: 0.45,
        });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), starMat);
        dome.scale.set(1, 0.55, 1);
        dome.position.y = 0.16;
        group.add(dome);
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const point = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.5, 6), starMat);
          point.position.set(Math.cos(angle) * 0.34, 0.1, Math.sin(angle) * 0.34);
          point.rotation.z = Math.PI / 2;
          point.rotation.y = -angle;
          group.add(point);
        }
        break;
      }

      case 'fangwolf': {
        // Winter with a plan (slice 5): a lean wolf — pale,
        // long-legged, ears up. The pack reads in numbers.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.65, 8, 12), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.72;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), coatMat);
        head.scale.set(0.8, 0.85, 1.4);
        head.position.set(0, 0.82, 0.62);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), coatMat);
          ear.position.set(side * 0.1, 1.02, 0.55);
          group.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.35, 4, 6), coatMat);
        tail.rotation.x = 1.1;
        tail.position.set(0, 0.72, -0.6);
        group.add(tail);
        break;
      }

      case 'salt_scorpion': {
        // The ground, armed (slice 5): a low segmented body,
        // two crust claws, and a tail arcing up to a grown-
        // glass sting that catches the light.
        const crustMat = new THREE.MeshStandardMaterial({ color: 0xd6d3a8, roughness: 0.7 });
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.2, emissive: 0x155e75, emissiveIntensity: 0.5,
        });
        for (const [sz, ss] of [[0.16, 0.2], [0, 0.23], [-0.17, 0.19]] as const) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(ss, 10, 8), crustMat);
          seg.scale.set(1.1, 0.6, 1);
          seg.position.set(0, 0.16, sz);
          group.add(seg);
        }
        for (const side of [-1, 1]) {
          const claw = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), glassMat);
          claw.scale.set(1, 0.7, 1.2);
          claw.position.set(side * 0.22, 0.14, 0.3);
          group.add(claw);
        }
        for (let i = 0; i < 3; i++) {
          const tseg = new THREE.Mesh(new THREE.SphereGeometry(0.07 - i * 0.012, 8, 6), crustMat);
          tseg.position.set(0, 0.22 + i * 0.13, -0.3 - i * 0.05);
          group.add(tseg);
        }
        const sting = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), glassMat);
        sting.position.set(0, 0.66, -0.42);
        sting.rotation.x = 0.7;
        group.add(sting);
        break;
      }

      case 'slag_serpent': {
        // A ripple before it is a snake (slice 5): a long low
        // body and a hood that rises in cooling ash.
        const scaleMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.55 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 8, 10), scaleMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.22;
        body.castShadow = true;
        group.add(body);
        const hood = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), scaleMat);
        hood.scale.set(1.25, 0.9, 0.5);
        hood.position.set(0, 0.42, 0.85);
        group.add(hood);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), scaleMat);
        head.scale.set(0.85, 0.8, 1.3);
        head.position.set(0, 0.4, 1.05);
        group.add(head);
        break;
      }

      case 'prism_cat': {
        // A shimmer with paws (slice 5): long and low, in a
        // coat that bends the noon — drawn translucent, with
        // the ears and tail honest.
        const coatMat = new THREE.MeshStandardMaterial({
          color: 0xf5d0fe, roughness: 0.2, transparent: true, opacity: 0.8,
          emissive: 0x86198f, emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 8, 10), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.42;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), coatMat);
        head.position.set(0, 0.5, 0.55);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.12, 4), coatMat);
          ear.position.set(side * 0.08, 0.65, 0.52);
          group.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.4, 4, 6), coatMat);
        tail.rotation.x = 1.2;
        tail.position.set(0, 0.45, -0.55);
        group.add(tail);
        break;
      }

      case 'fen_lurker': {
        // One log is a citizen; the other is a mouth (slice 5):
        // a wide, bark-brown log body wearing duckweed, with
        // eyes riding on top like a periscope's whole crew.
        const barkMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 1 });
        const weedMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 1 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.42, 1.1, 8, 12), barkMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.36;
        body.castShadow = true;
        group.add(body);
        const weed = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), weedMat);
        weed.scale.set(1, 0.3, 1.3);
        weed.position.y = 0.72;
        group.add(weed);
        const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), barkMat);
        jaw.scale.set(1.15, 0.6, 1.1);
        jaw.position.set(0, 0.28, 0.85);
        group.add(jaw);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), barkMat);
          eye.position.set(side * 0.14, 0.72, 0.7);
          group.add(eye);
        }
        break;
      }

      case 'hollow_widow': {
        // Fluency as menace (slice 5): a dark many-legged body,
        // and beneath it the lure — one grub's worth of steady,
        // unflickering light.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), bodyMat);
        body.scale.set(0.9, 0.8, 1.2);
        body.position.y = 0.62;
        body.castShadow = true;
        group.add(body);
        for (let i = 0; i < 4; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.72, 4), bodyMat);
            leg.position.set(side * 0.34, 0.34, 0.27 - i * 0.18);
            leg.rotation.z = side * 0.85;
            leg.rotation.x = (i - 1.5) * 0.18;
            group.add(leg);
          }
        }
        const lure = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.6 })
        );
        lure.position.set(0, 0.42, 0.3);
        group.add(lure);
        break;
      }

      case 'sporeback': {
        // The groves' weather (slice 5): a brute grazer
        // carrying a grove — fruiting towers on stems, swaying
        // as it moves, drawn mid-sway.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
        const stemMat = new THREE.MeshStandardMaterial({ color: 0xd6d3a8, roughness: 0.85 });
        const capMat = new THREE.MeshStandardMaterial({
          color: 0xa3e635, roughness: 0.7, emissive: 0x3f6212, emissiveIntensity: 0.4,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.6, 1.1, 8, 14), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.95;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 10), hideMat);
        head.scale.set(0.9, 0.9, 1.15);
        head.position.set(0, 0.85, 1.05);
        group.add(head);
        for (const [tx, tz, th] of [[-0.25, 0.3, 1.0], [0.2, 0, 1.3], [-0.1, -0.4, 0.9], [0.28, -0.35, 1.15]] as const) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, th, 6), stemMat);
          stem.position.set(tx, 1.45 + th / 2, tz);
          group.add(stem);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 6), capMat);
          cap.scale.set(1.2, 0.45, 1.2);
          cap.position.set(tx, 1.45 + th, tz);
          group.add(cap);
        }
        break;
      }

      case 'bonepicker': {
        // Death, made useful and visible (slice 6): a broad-
        // winged scavenger, bare-headed — on the ground it
        // stands biped-style; here it is drawn as it lives,
        // on the wing. Wings named for the generic flap.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.9, side: THREE.DoubleSide });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.7 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 6, 10), featherMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 6), skinMat);
        neck.rotation.x = 1.1;
        neck.position.set(0, 0.08, 0.42);
        group.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), skinMat);
        head.position.set(0, 0.16, 0.58);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.6), featherMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.85, 0.05, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'storm_kite': {
        // MOSTLY WING (slice 6): a slight body on a huge span,
        // and the ribbon tail — rudder, anchor-line, and
        // signature — streaming behind in two streamers.
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0x7dd3fc, roughness: 0.5, side: THREE.DoubleSide,
          emissive: 0x075985, emissiveIntensity: 0.35,
        });
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.4, 6, 8), bodyMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), bodyMat);
        head.position.set(0, 0.02, 0.34);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.7), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 1.0, 0.04, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
          const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 1.1), wingMat);
          ribbon.position.set(side * 0.09, 0, -0.85);
          ribbon.rotation.x = -Math.PI / 2 + 0.35;
          group.add(ribbon);
        }
        break;
      }

      case 'vent_drake': {
        // What the chimney is for (slice 6): a lean drake on
        // broad soot-dark sails built for vent thermals.
        const scaleMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.6 });
        const sailMat = new THREE.MeshStandardMaterial({
          color: 0x292524, roughness: 0.7, side: THREE.DoubleSide,
          emissive: 0x7c2d12, emissiveIntensity: 0.25,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.6, 6, 10), scaleMat);
        body.rotation.x = Math.PI / 2;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), scaleMat);
        head.scale.set(0.85, 0.85, 1.35);
        head.position.set(0, 0.06, 0.55);
        group.add(head);
        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.18, 5), scaleMat);
          horn.position.set(side * 0.09, 0.2, 0.5);
          horn.rotation.x = -0.5;
          group.add(horn);
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 0.55), sailMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.72, 0.08, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'spire_bat': {
        // The Fangs' soft teeth (slice 6): a small frost-downed
        // body, huge ears, and quick membrane wings — a flyer,
        // not a glider, and the flap rate says so.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.95 });
        const membraneMat = new THREE.MeshStandardMaterial({
          color: 0x94a3b8, roughness: 0.7, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), furMat);
        body.scale.set(0.9, 0.95, 1.15);
        group.add(body);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.055, 0.2, 5), furMat);
          ear.position.set(side * 0.08, 0.16, 0.05);
          group.add(ear);
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.35), membraneMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.45, 0.03, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'dust_moth': {
        // The Graveyard's courier (slice 6): a tiny pale moth,
        // dusted — the mirror moth's idiom at half the scale
        // and none of the marsh's light.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.95 });
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0xe7e5e4, roughness: 0.6, transparent: true, opacity: 0.7, side: THREE.DoubleSide,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), bodyMat);
        body.scale.set(0.8, 0.8, 1.6);
        group.add(body);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.scale.set(1, 0.06, 0.55);
          wing.position.set(side * 0.19, 0.03, -0.01);
          group.add(wing);
        }
        break;
      }

      case 'pool_snapper': {
        // The other disposition (slice 7): a jaw-forward turtle
        // wearing its algae crown — a small green island that
        // was not there yesterday.
        const shellMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.95 });
        const jawMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.8 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), shellMat);
        shell.scale.set(1, 0.55, 1.15);
        shell.position.y = 0.32;
        shell.castShadow = true;
        group.add(shell);
        const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), jawMat);
        jaw.scale.set(1.25, 0.55, 1);
        jaw.position.set(0, 0.22, 0.55);
        group.add(jaw);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), shellMat);
        crown.scale.set(1, 0.3, 1);
        crown.position.y = 0.58;
        group.add(crown);
        break;
      }

      case 'meadow_bull': {
        // The first lesson in being watched back (slice 7): a
        // bull-built grazer — hump, horns, and the stare drawn
        // at eye height.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.95 });
        const hornMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.7 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.55, 0.95, 8, 14), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.95;
        body.castShadow = true;
        group.add(body);
        const hump = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), hideMat);
        hump.scale.set(0.9, 0.7, 0.9);
        hump.position.set(0, 1.42, 0.25);
        group.add(hump);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), hideMat);
        head.scale.set(0.95, 0.9, 1.1);
        head.position.set(0, 0.82, 0.95);
        group.add(head);
        for (const side of [-1, 1]) {
          const horn = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.42, 6), hornMat);
          horn.position.set(side * 0.36, 1.0, 0.9);
          horn.rotation.z = side * 1.15;
          group.add(horn);
        }
        break;
      }

      case 'canopy_sloth': {
        // A place, hanging (slice 7): long hook-clawed arms and
        // a fur-garden of moss — drawn at canopy height by the
        // flight spec, arms down as if around a branch that is
        // everywhere and nowhere.
        const furMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 1 });
        const mossMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 1 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 10), furMat);
        body.scale.set(0.95, 1.1, 0.9);
        body.position.y = 0.1;
        body.castShadow = true;
        group.add(body);
        const moss = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), mossMat);
        moss.scale.set(1, 0.5, 1);
        moss.position.y = 0.38;
        group.add(moss);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), furMat);
        head.position.set(0, -0.28, 0.12);
        group.add(head);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.06, 0.5, 4, 8), furMat);
          arm.position.set(side * 0.3, 0.45, 0);
          arm.rotation.z = side * 0.35;
          group.add(arm);
        }
        break;
      }

      case 'crown_cat': {
        // Presence as policy (slice 7): a long cat lying along
        // its branch — drawn at canopy height, tail tip the
        // only confession of attention.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.6, 6, 10), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.05;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), coatMat);
        head.position.set(0, 0.1, 0.52);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), coatMat);
          ear.position.set(side * 0.07, 0.22, 0.5);
          group.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.55, 4, 6), coatMat);
        tail.rotation.x = 1.35;
        tail.position.set(0, -0.05, -0.6);
        group.add(tail);
        break;
      }

      case 'path_beetle': {
        // Sleeves rolled (slice 7): a palm-sized bronze beetle
        // with brooms for feet — the brush skirt rides in front.
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0xb45309, roughness: 0.35, metalness: 0.6,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), shellMat);
        body.scale.set(1, 0.7, 1.3);
        body.position.y = 0.09;
        group.add(body);
        const brushMat = new THREE.MeshStandardMaterial({ color: 0xd6d3a8, roughness: 1 });
        for (const side of [-1, 1]) {
          const brush = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), brushMat);
          brush.scale.set(1, 0.5, 1.4);
          brush.position.set(side * 0.08, 0.03, 0.14);
          group.add(brush);
        }
        break;
      }

      case 'gladhand': {
        // Hospitality, total (slice 7): a walking plantiform
        // usher — a stem body, two arms, and leaf-hands all
        // along them, all of them offered.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.8 });
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x4ade80, roughness: 0.6, side: THREE.DoubleSide,
          emissive: 0x166534, emissiveIntensity: 0.3,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.55, 6, 10), stemMat);
        body.position.y = 0.62;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), leafMat);
        head.position.set(0, 1.12, 0);
        group.add(head);
        for (const side of [-1, 1]) {
          const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.4, 4, 6), stemMat);
          arm.position.set(side * 0.26, 0.78, 0.05);
          arm.rotation.z = side * 0.9;
          group.add(arm);
          for (let i = 0; i < 3; i++) {
            const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), leafMat);
            hand.scale.set(1.2, 0.25, 1);
            hand.position.set(side * (0.34 + i * 0.09), 0.62 + i * 0.14, 0.06);
            group.add(hand);
          }
        }
        break;
      }

      case 'taster': {
        // The valley's sentence, at ankle height (slice 7): a
        // low, long sampler on many small legs, tongue fanned
        // toward the visitor it is considering.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x713f12, roughness: 0.85 });
        const tongueMat = new THREE.MeshStandardMaterial({
          color: 0xdb2777, roughness: 0.5, emissive: 0x9d174d, emissiveIntensity: 0.4,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.7, 6, 10), bodyMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.24;
        group.add(body);
        for (let i = 0; i < 4; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.01, 0.2, 4), bodyMat);
            leg.position.set(side * 0.14, 0.08, 0.36 - i * 0.24);
            leg.rotation.z = side * 0.5;
            group.add(leg);
          }
        }
        for (const side of [-1, 1]) {
          const tongue = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.22, 4), tongueMat);
          tongue.position.set(side * 0.05, 0.22, 0.62);
          tongue.rotation.x = Math.PI / 2 - 0.25;
          tongue.rotation.y = side * 0.3;
          group.add(tongue);
        }
        break;
      }

      case 'heartbearer': {
        // Safe conduct, walking (slice 7): a broad-backed
        // porter — the flat back IS the profession — with a
        // heartbloom bud riding where the loads go.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.5, 0.85, 8, 12), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.92;
        body.castShadow = true;
        group.add(body);
        const back = new THREE.Mesh(new THREE.BoxGeometry(0.85, 0.1, 1.0), coatMat);
        back.position.y = 1.42;
        group.add(back);
        const bud = new THREE.Mesh(
          new THREE.SphereGeometry(0.13, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xfda4af, emissive: 0xbe123c, emissiveIntensity: 0.7, roughness: 0.5 })
        );
        bud.position.set(0, 1.56, -0.25);
        group.add(bud);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), coatMat);
        head.scale.set(0.85, 0.9, 1.15);
        head.position.set(0, 0.95, 0.85);
        group.add(head);
        break;
      }

      case 'dusk_grazer': {
        // Wearing the color of what it eats (slice 7): a low
        // grazer in the duskgrass's own black-violet.
        const coatMat = new THREE.MeshStandardMaterial({
          color: 0x4c1d95, roughness: 0.95, emissive: 0x2e1065, emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.36, 0.65, 8, 12), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.68;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), coatMat);
        head.scale.set(0.85, 0.9, 1.2);
        head.position.set(0, 0.62, 0.65);
        group.add(head);
        break;
      }

      case 'answer_deer': {
        // It keeps what you bring it (slice 7): a graceful
        // pale-gold deer — the mirror, drawn calm.
        const coatMat = new THREE.MeshStandardMaterial({ color: 0xfcd34d, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.6, 8, 12), coatMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.82;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), coatMat);
        head.scale.set(0.8, 0.9, 1.3);
        head.position.set(0, 1.05, 0.62);
        group.add(head);
        for (const side of [-1, 1]) {
          const antler = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.3, 5), coatMat);
          antler.position.set(side * 0.1, 1.28, 0.56);
          antler.rotation.z = side * -0.4;
          group.add(antler);
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), coatMat);
          ear.scale.set(1.4, 0.5, 0.8);
          ear.position.set(side * 0.16, 1.08, 0.55);
          group.add(ear);
        }
        break;
      }

      case 'edge_wren': {
        // The reading, with wings (slice 7): a tiny border
        // bird, drawn bright — at a Welcoming edge it approves
        // of you, and it shows.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.8 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.7, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.25);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), featherMat);
        head.position.set(0, 0.04, 0.09);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.14), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.17, 0.03, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'rainback': {
        // A puddle, with opinions (slice 8): a flat Gel dome
        // spread thin on the wet ground, one opinionated bulge
        // for a head end. Translucent — it IS rain, briefly.
        const gelMat = new THREE.MeshStandardMaterial({
          color: 0x2dd4bf, roughness: 0.15, transparent: true, opacity: 0.75,
          emissive: 0x0f766e, emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), gelMat);
        body.scale.set(1.15, 0.35, 1.3);
        body.position.y = 0.1;
        group.add(body);
        const bulge = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 6), gelMat);
        bulge.scale.set(1, 0.7, 1);
        bulge.position.set(0, 0.16, 0.22);
        group.add(bulge);
        break;
      }

      case 'rime_owl': {
        // Falling politely (slice 8): a frost-rimed owl — white
        // face disc, snow-dusted wings named for the flap.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.85, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), featherMat);
        body.scale.set(0.9, 1.05, 0.95);
        group.add(body);
        const face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 }));
        face.scale.set(1, 1, 0.55);
        face.position.set(0, 0.05, 0.1);
        group.add(face);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.26), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.36, 0.05, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
          const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.09, 4), featherMat);
          tuft.position.set(side * 0.07, 0.19, 0.08);
          group.add(tuft);
        }
        break;
      }

      case 'storm_crow': {
        // The margin's gossip (slice 8): an ink-black crow,
        // broad wings, beak built for commentary.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.75 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.8, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), featherMat);
        body.scale.set(0.9, 0.9, 1.3);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), featherMat);
        head.position.set(0, 0.05, 0.17);
        group.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 5), new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5 }));
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.04, 0.28);
        group.add(beak);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.24), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.32, 0.04, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'surge_runner': {
        // Too light and too fast to sink (slice 8): a runner
        // bird — all legs and balance, body high on stilts.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.8 });
        const legMat = new THREE.MeshStandardMaterial({ color: 0x0c4a6e, roughness: 0.7 });
        for (const side of [-1, 1]) {
          const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.015, 0.55, 5), legMat);
          leg.position.set(side * 0.09, 0.28, 0);
          group.add(leg);
        }
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), featherMat);
        body.scale.set(0.85, 0.9, 1.3);
        body.position.y = 0.62;
        body.castShadow = true;
        group.add(body);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.3, 6), featherMat);
        neck.position.set(0, 0.82, 0.2);
        neck.rotation.x = 0.5;
        group.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), featherMat);
        head.position.set(0, 0.95, 0.3);
        group.add(head);
        const tail = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.3, 5), featherMat);
        tail.rotation.x = -Math.PI / 2 - 0.5;
        tail.position.set(0, 0.68, -0.28);
        group.add(tail);
        break;
      }

      case 'hayfinch': {
        // The margin's music (slice 8): a tiny ash-flecked
        // finch, warm gold under the grey.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.85 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.85, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.25);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), featherMat);
        head.position.set(0, 0.04, 0.07);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.12, 0.03, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'root_otter': {
        // One continuous medium (slice 8): a sleek, long
        // otter — low body, rudder tail, unbothered.
        const furMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 0.5, 6, 10), furMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.24;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), furMat);
        head.scale.set(0.95, 0.85, 1.05);
        head.position.set(0, 0.3, 0.48);
        group.add(head);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.4, 4, 6), furMat);
        tail.rotation.x = Math.PI / 2 - 0.25;
        tail.position.set(0, 0.16, -0.55);
        group.add(tail);
        break;
      }

      case 'boiler_crab': {
        // A blockage to be cleared in steam (slice 8): a
        // kettle dome with a lid, vent nub, and scuttle legs.
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0x991b1b, roughness: 0.4, metalness: 0.35,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), shellMat);
        body.scale.set(1.15, 0.65, 1);
        body.position.y = 0.24;
        body.castShadow = true;
        group.add(body);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 0.07, 10), shellMat);
        lid.position.y = 0.44;
        group.add(lid);
        const vent = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.12, 6), shellMat);
        vent.position.y = 0.53;
        group.add(vent);
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.012, 0.3, 4), shellMat);
            leg.position.set(side * 0.33, 0.1, 0.16 - i * 0.16);
            leg.rotation.z = side * 0.9;
            group.add(leg);
          }
        }
        break;
      }

      case 'far_bat': {
        // The far country's swallow (slice 8): a serene bat —
        // small body, honest ears, wide dark wings.
        const furMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x2e1065, roughness: 0.85, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), furMat);
        body.scale.set(0.9, 1, 1.1);
        group.add(body);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 4), furMat);
          ear.position.set(side * 0.045, 0.1, 0.01);
          group.add(ear);
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.18), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.26, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'thaw_mouse': {
        // At the arctic's door (slice 8): a small mouse in
        // melt-season grey-brown, ears up, tail long.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), furMat);
        body.scale.set(0.9, 0.8, 1.3);
        body.position.y = 0.08;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), furMat);
        head.position.set(0, 0.1, 0.11);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), furMat);
          ear.scale.set(1, 1, 0.4);
          ear.position.set(side * 0.04, 0.16, 0.08);
          group.add(ear);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.18, 3, 5), furMat);
        tail.rotation.x = Math.PI / 2 - 0.35;
        tail.position.set(0, 0.05, -0.18);
        group.add(tail);
        break;
      }

      case 'meal_moth': {
        // Room service, at dusk (slice 8): a pale dust-laden
        // moth — the wings carry the valley's dinner.
        const dustMat = new THREE.MeshStandardMaterial({
          color: 0xd6d3a8, roughness: 0.9, emissive: 0x713f12, emissiveIntensity: 0.25,
        });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xe7e5c8, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.1, 4, 6), dustMat);
        body.rotation.x = Math.PI / 2;
        group.add(body);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.15, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'heart_beetle': {
        // The heart's pulse (slice 8): a small beetle wearing
        // the bloom's shine — sap-gloss red over black.
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0xbe123c, roughness: 0.25, metalness: 0.2,
          emissive: 0x881337, emissiveIntensity: 0.35,
        });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), shellMat);
        body.scale.set(1, 0.7, 1.35);
        body.position.y = 0.07;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), shellMat);
        head.position.set(0, 0.06, 0.12);
        group.add(head);
        break;
      }

      case 'long_grazer': {
        // The plains' second scale (slice 11): a sauropod-plan
        // grazer drawn HUGE — barrel body, a neck that takes
        // its time arriving, a tail that takes longer leaving.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xa3a380, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.85, 1.6, 8, 14), hideMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 1.7;
        body.castShadow = true;
        group.add(body);
        const neck = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.3, 6, 10), hideMat);
        neck.position.set(0, 2.45, 1.35);
        neck.rotation.x = 0.7;
        group.add(neck);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), hideMat);
        head.scale.set(0.85, 0.8, 1.25);
        head.position.set(0, 3.05, 1.95);
        group.add(head);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.14, 1.5, 6, 8), hideMat);
        tail.position.set(0, 1.55, -1.75);
        tail.rotation.x = Math.PI / 2 - 0.35;
        group.add(tail);
        break;
      }

      case 'harvest_shrew': {
        // A heartbeat with a hunting license (slice 11):
        // nose-first — a small rust body behind a long snout.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), furMat);
        body.scale.set(0.9, 0.8, 1.4);
        body.position.y = 0.08;
        group.add(body);
        const snout = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.14, 6), furMat);
        snout.rotation.x = Math.PI / 2;
        snout.position.set(0, 0.07, 0.17);
        group.add(snout);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.12, 3, 5), furMat);
        tail.rotation.x = Math.PI / 2 - 0.3;
        tail.position.set(0, 0.06, -0.15);
        group.add(tail);
        break;
      }

      case 'plain_vole': {
        // A philosopher (slice 11): a small round vole, ears
        // up — sky-watched is a posture.
        const furMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), furMat);
        body.scale.set(1, 0.85, 1.2);
        body.position.y = 0.09;
        group.add(body);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), furMat);
          ear.scale.set(1, 1, 0.4);
          ear.position.set(side * 0.05, 0.18, 0.03);
          group.add(ear);
        }
        break;
      }

      case 'plainswift': {
        // The sky's fastest citizen (slice 11): a crescent —
        // long swept wings, a body that is mostly an excuse
        // for them.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.8 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.75, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), featherMat);
        body.scale.set(0.8, 0.8, 1.5);
        group.add(body);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.13), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.3, 0.02, -0.03);
          wing.rotation.x = -Math.PI / 2 + 0.06;
          wing.rotation.y = side * -0.35; // swept back: the crescent
          group.add(wing);
        }
        break;
      }

      case 'spore_wolf': {
        // The pack announces in spores (slice 11): a wolf
        // wearing its mulchwood coat — green spore-clumps in
        // the fur that burst when it shakes.
        const furMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.26, 0.55, 8, 12), furMat);
        body.rotation.x = Math.PI / 2;
        body.position.y = 0.62;
        body.castShadow = true;
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8), furMat);
        head.scale.set(0.85, 0.85, 1.25);
        head.position.set(0, 0.72, 0.6);
        group.add(head);
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.12, 4), furMat);
          ear.position.set(side * 0.09, 0.92, 0.55);
          group.add(ear);
        }
        const sporeMat = new THREE.MeshStandardMaterial({
          color: 0x65a30d, roughness: 0.9, emissive: 0x365314, emissiveIntensity: 0.5,
        });
        for (let i = 0; i < 4; i++) {
          const clump = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 5), sporeMat);
          clump.position.set((i % 2 - 0.5) * 0.25, 0.85, 0.25 - Math.floor(i / 2) * 0.35);
          group.add(clump);
        }
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.35, 4, 6), furMat);
        tail.rotation.x = Math.PI / 2 - 0.5;
        tail.position.set(0, 0.6, -0.6);
        group.add(tail);
        break;
      }

      case 'rib_spider': {
        // The Graveyard's rigger (slice 11): a small body on
        // eight long legs — drawn at rib height by its flight
        // spec, so the legs reach for ribs that aren't drawn.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.6 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), bodyMat);
        body.scale.set(1, 0.8, 1.3);
        group.add(body);
        const legMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.7 });
        for (let i = 0; i < 4; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.55, 4), legMat);
            leg.position.set(side * 0.18, -0.18, 0.12 - i * 0.08);
            leg.rotation.z = side * 0.8;
            leg.rotation.x = (i - 1.5) * 0.2;
            group.add(leg);
          }
        }
        break;
      }

      case 'root_serpent': {
        // The country, moving (slice 11): a chain of great
        // segments, bark-dark — the Underroot's weather.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.9 });
        for (let i = 0; i < 6; i++) {
          const seg = new THREE.Mesh(new THREE.SphereGeometry(0.34 - i * 0.03, 10, 8), hideMat);
          seg.scale.set(1, 0.9, 1.15);
          seg.position.set(0, 0.3, -i * 0.55);
          if (i === 0) seg.castShadow = true;
          group.add(seg);
        }
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xa16207, emissiveIntensity: 0.7 });
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), eyeMat);
          eye.position.set(side * 0.14, 0.42, 0.24);
          group.add(eye);
        }
        break;
      }

      case 'second_tenant': {
        // Wearing a dead tender (slice 11): a dome-and-ribcage
        // frame on many legs — the husk above, the collective
        // below.
        const huskMat = new THREE.MeshStandardMaterial({ color: 0xd6d3a8, roughness: 0.7, metalness: 0.25 });
        const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), huskMat);
        dome.position.y = 0.75;
        dome.castShadow = true;
        group.add(dome);
        for (let i = 0; i < 3; i++) {
          const rib = new THREE.Mesh(new THREE.TorusGeometry(0.34 - i * 0.05, 0.03, 6, 12, Math.PI), huskMat);
          rib.position.set(0, 0.72, 0.15 - i * 0.16);
          rib.rotation.y = Math.PI / 2;
          group.add(rib);
        }
        const legMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6, metalness: 0.4 });
        for (let i = 0; i < 4; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.75, 5), legMat);
            leg.position.set(side * 0.3, 0.36, 0.3 - i * 0.2);
            leg.rotation.z = side * 0.25;
            group.add(leg);
          }
        }
        break;
      }

      case 'sap_turtle': {
        // An archive with a head (slice 11): a turtle whose
        // shell is amber sap in layers — centuries, readable.
        const shellMat = new THREE.MeshStandardMaterial({
          color: 0xd97706, roughness: 0.35, transparent: true, opacity: 0.92,
          emissive: 0x92400e, emissiveIntensity: 0.25,
        });
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9 });
        const shell = new THREE.Mesh(new THREE.SphereGeometry(0.44, 14, 10), shellMat);
        shell.scale.set(1, 0.55, 1.15);
        shell.position.y = 0.3;
        shell.castShadow = true;
        group.add(shell);
        const keepsake = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.8 }));
        keepsake.position.set(0.12, 0.42, -0.1); // something green, held in the amber
        group.add(keepsake);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 10, 8), skinMat);
        head.scale.set(0.9, 0.8, 1.1);
        head.position.set(0, 0.22, 0.55);
        group.add(head);
        break;
      }

      case 'ashpicker': {
        // The cleanup crew (slice 11): an ash-gray picker
        // bird with ember eyes, working the cold burns.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.85 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.85, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), featherMat);
        body.scale.set(0.9, 0.9, 1.3);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), featherMat);
        head.position.set(0, 0.05, 0.14);
        group.add(head);
        const eyeMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.9 });
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 5), eyeMat);
          eye.position.set(side * 0.04, 0.07, 0.19);
          group.add(eye);
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.45, 0.2), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.27, 0.03, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'grave_owl': {
        // Whitened by its fields (slice 11): a broad silent
        // owl in bone-dust white — the White Graveyard's own.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), featherMat);
        body.scale.set(0.95, 1.05, 0.95);
        group.add(body);
        const face = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 }));
        face.scale.set(1, 1, 0.55);
        face.position.set(0, 0.05, 0.1);
        group.add(face);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.66, 0.28), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.38, 0.05, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'zot_hopper': {
        // Briefly, brightly (slice 11): a many-legged hopper
        // with a copper crest-fan it raises at the banner.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.7, metalness: 0.3 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), bodyMat);
        body.scale.set(0.9, 0.85, 1.3);
        body.position.y = 0.16;
        group.add(body);
        const crestMat = new THREE.MeshStandardMaterial({
          color: 0xd97706, roughness: 0.35, metalness: 0.7, side: THREE.DoubleSide,
          emissive: 0x92400e, emissiveIntensity: 0.4,
        });
        const crest = new THREE.Mesh(new THREE.CircleGeometry(0.11, 8, 0, Math.PI), crestMat);
        crest.position.set(0, 0.26, 0.02);
        group.add(crest);
        for (let i = 0; i < 3; i++) {
          for (const side of [-1, 1]) {
            const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.008, 0.22, 4), bodyMat);
            leg.position.set(side * 0.1, 0.07, 0.08 - i * 0.08);
            leg.rotation.z = side * 0.7;
            group.add(leg);
          }
        }
        break;
      }

      case 'hedge_sparrow': {
        // The everywhere-bird (slice 13): a small brown
        // sparrow — civilization's confetti.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xa1887f, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x8d6e63, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.25);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), featherMat);
        head.position.set(0, 0.035, 0.07);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.12, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'snow_finch': {
        // The season introducing itself (slice 13): a white
        // finch with dark wingtips.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.25);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), featherMat);
        head.position.set(0, 0.03, 0.065);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.11, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'winter_wren': {
        // Round as a snowball (slice 13): a plump wren with
        // its tail cocked, as wrens insist.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.95 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.95, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), featherMat);
        body.scale.set(1, 0.95, 1.05);
        group.add(body);
        const tail = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.09), wingMat);
        tail.position.set(0, 0.05, -0.09);
        tail.rotation.x = -0.7; // cocked
        group.add(tail);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.07), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.07, 0.015, 0);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'cinder_finch': {
        // Singed decoratively (slice 13): an amber finch with
        // an ash-dark bill.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.25);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), featherMat);
        head.position.set(0, 0.03, 0.065);
        group.add(head);
        const bill = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.05, 5), new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.6 }));
        bill.rotation.x = Math.PI / 2;
        bill.position.set(0, 0.03, 0.12);
        group.add(bill);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.11, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'fen_finch': {
        // A small citizen of the surface (slice 13): a green
        // finch with long reed-walking toes, drawn plain.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.25);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.042, 8, 6), featherMat);
        head.position.set(0, 0.03, 0.065);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.09), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.11, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'ruin_sparrow': {
        // The building inspector (slice 13): a gray sparrow,
        // never not on site.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.9, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), featherMat);
        body.scale.set(0.9, 0.9, 1.25);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), featherMat);
        head.position.set(0, 0.035, 0.07);
        group.add(head);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.1), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.12, 0.02, -0.01);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'field_crow': {
        // A crow, honestly (slice 13): black, unhurried, and
        // pricing your shiny things.
        const featherMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
        const wingMat = new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.85, side: THREE.DoubleSide });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), featherMat);
        body.scale.set(0.9, 0.9, 1.35);
        group.add(body);
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), featherMat);
        head.position.set(0, 0.05, 0.12);
        group.add(head);
        const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.09, 5), new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.5 }));
        beak.rotation.x = Math.PI / 2;
        beak.position.set(0, 0.05, 0.22);
        group.add(beak);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.16), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.position.set(side * 0.24, 0.03, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.08;
          group.add(wing);
        }
        break;
      }

      case 'moon_moth': {
        // Held breath, winged (slice 13): a great pale moth —
        // broad soft wings, a candle-drawn drift.
        const wingMat = new THREE.MeshStandardMaterial({
          color: 0xfef9c3, roughness: 0.9, side: THREE.DoubleSide,
          emissive: 0xfde68a, emissiveIntensity: 0.25,
        });
        const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.12, 4, 8), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.95 }));
        body.rotation.x = Math.PI / 2;
        group.add(body);
        for (const side of [-1, 1]) {
          const wing = new THREE.Mesh(new THREE.CircleGeometry(0.21, 10), wingMat);
          wing.name = side < 0 ? 'wingL' : 'wingR';
          wing.scale.set(1.15, 0.75, 1);
          wing.position.set(side * 0.2, 0.01, -0.02);
          wing.rotation.x = -Math.PI / 2 + 0.1;
          group.add(wing);
        }
        break;
      }

      case 'dust_lizard': {
        // A skipped stone that kept going (slice 13): a pale,
        // low, fast lizard plan.
        const hideMat = new THREE.MeshStandardMaterial({ color: 0xd6d3a8, roughness: 0.9 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), hideMat);
        body.scale.set(0.9, 0.6, 1.6);
        body.position.y = 0.06;
        group.add(body);
        const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.015, 0.18, 3, 5), hideMat);
        tail.rotation.x = Math.PI / 2;
        tail.position.set(0, 0.05, -0.2);
        group.add(tail);
        break;
      }

      case 'sleet_frog': {
        // Spring, moved up (slice 13): a pale blue frog with
        // ice still on its mind.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.55 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), skinMat);
        body.scale.set(1.1, 0.75, 1);
        body.position.y = 0.055;
        group.add(body);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 5), skinMat);
          eye.position.set(side * 0.04, 0.11, 0.03);
          group.add(eye);
        }
        break;
      }

      case 'frost_newt': {
        // Under the skin of its own country (slice 13): a
        // blue newt with a finned tail.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.5 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), skinMat);
        body.scale.set(0.9, 0.7, 1.7);
        body.position.y = 0.05;
        group.add(body);
        const fin = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.22, 4), new THREE.MeshStandardMaterial({ color: 0xbfdbfe, roughness: 0.4, side: THREE.DoubleSide }));
        fin.scale.z = 0.3;
        fin.rotation.x = -Math.PI / 2;
        fin.position.set(0, 0.05, -0.18);
        group.add(fin);
        break;
      }

      case 'cinder_toad': {
        // A garden that walks (slice 13): a squat ember-
        // country toad with a small cap growing on its back.
        const skinMat = new THREE.MeshStandardMaterial({ color: 0x9a6a4a, roughness: 0.85 });
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), skinMat);
        body.scale.set(1.2, 0.7, 1.1);
        body.position.y = 0.07;
        group.add(body);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0xdc7f4a, roughness: 0.7, emissive: 0x9a3412, emissiveIntensity: 0.35,
        }));
        cap.position.set(0, 0.13, -0.02);
        group.add(cap);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 5), skinMat);
          eye.position.set(side * 0.05, 0.12, 0.07);
          group.add(eye);
        }
        break;
      }

      default: {
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), materials.biolumAmber);
        body.position.y = 0.3;
        group.add(body);
        break;
      }
    }

    group.position.set(fauna.x, 0, fauna.z);
    group.rotation.y = fauna.rotation;
    return group;
  }

  function updateFaunaMesh(mesh: THREE.Group, fauna: FaunaEntity, wiggleDt = 0) {
    // Creatures stand ON the terrain: their mesh base is the ground
    // height at their position (the simulation itself stays 2D — this
    // is purely where the body is drawn, like the floor treatment).
    const groundY = terrainHeightAt(fauna.x, fauna.z);
    mesh.position.set(fauna.x, groundY + fauna.y, fauna.z);
    mesh.rotation.y = fauna.rotation;
    mesh.userData.entity = fauna;

    // GENERIC FLIGHT (creature build phase, slice 6, 2026-10-15):
    // any species whose table entry carries a flight spec rides
    // at its cruise altitude with its rise-and-settle bob, and
    // flaps if it names a flap rate — meshes name their wings
    // 'wingL'/'wingR' to be flapped. This branch runs FIRST: the
    // bespoke branches below (the glider's glide, the gnat's
    // dart) still draw their own species exactly as shipped,
    // overriding this one's numbers with their identical own.
    const flight = speciesDef(fauna.species)?.flight;
    if (flight) {
      mesh.position.y = groundY + flight.altitude + Math.sin(fauna.animTime * flight.bobRate) * flight.bobHeight;
      if (flight.flapRate !== undefined) {
        const flap = Math.sin(fauna.animTime * flight.flapRate) * 0.3;
        const wingL = mesh.getObjectByName('wingL');
        const wingR = mesh.getObjectByName('wingR');
        if (wingL) wingL.rotation.z = -0.08 - flap;
        if (wingR) wingR.rotation.z = 0.08 + flap;
      }
    }

    if (fauna.species === 'soft_puff' || fauna.species === 'rime_puff') {
      // The rime puff is the soft-puff's deliberate mirror — same
      // round body, same hop, wholly other country (slice 2).
      const hop = Math.abs(Math.sin(fauna.animTime * 6)) * 0.25;
      mesh.position.y = groundY + hop;
    }

    if (fauna.species === 'dew_gnat') {
      // Airborne by nature (slice 2): a low, darting hover with a
      // quick double-bob — the mesh rides at pest height while the
      // simulation stays 2D, exactly like the glider's glide.
      mesh.position.y = groundY + 0.55 + Math.sin(fauna.animTime * 7.3) * 0.13;
    }

    if (fauna.species === 'vesper_glider') {
      // Airborne by nature: a low glide with a slow rise-and-settle,
      // and the wings breathe — a shallow flap cycle, not a buzz.
      mesh.position.y = groundY + 0.85 + Math.sin(fauna.animTime * 1.7) * 0.22;
      const flap = Math.sin(fauna.animTime * 2.6) * 0.28;
      const wingL = mesh.getObjectByName('gliderWingL');
      const wingR = mesh.getObjectByName('gliderWingR');
      if (wingL) wingL.rotation.z = -0.1 - flap;
      if (wingR) wingR.rotation.z = 0.1 + flap;
    }

    // Idle-life wiggle (bounded Brownian — see game/motion.ts). Purely how
    // the mesh is DRAWN: the entity's simulated position never changes, so
    // nothing here needs syncing, saving, or pathing around. The offsets
    // are centimeters — a creature breathing in place, not sliding around.
    // The wiggle's FLAVOR is species personality (stalker ≈ statue,
    // puff = fidget) — bound to the species exactly like the mesh is:
    // if this id changed species across worlds, the old flavor goes.
    let wiggleEntry = wiggleMap.get(fauna.id);
    if (!wiggleEntry || wiggleEntry.species !== fauna.species) {
      const flavor = FAUNA_WIGGLE_FLAVORS[fauna.species] ?? FAUNA_WIGGLE_DEFAULT;
      wiggleEntry = { wiggle: new BrownianWiggle(hashStringToSeed(fauna.id), flavor), species: fauna.species };
      wiggleMap.set(fauna.id, wiggleEntry);
    }
    const w = wiggleEntry.wiggle.update(wiggleDt);
    mesh.position.x += w.x;
    mesh.position.z += w.z;
    mesh.rotation.z = w.rock;
  }

  function forgetFauna(id: string): void {
    wiggleMap.delete(id);
  }

  return { createFloraMesh, updateFloraMesh, createFaunaMesh, updateFaunaMesh, forgetFauna };
}
