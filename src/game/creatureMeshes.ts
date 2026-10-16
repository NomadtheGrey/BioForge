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

  function createFloraMesh(flora: FloraEntity): THREE.Group {
    const group = new THREE.Group();
    group.userData = { type: 'flora', entity: flora };

    switch (flora.species) {
      case 'lantern_fern': {
        const stalk = new THREE.Mesh(
          new THREE.CylinderGeometry(0.08, 0.16, 2.2, 8),
          materials.woodRoot
        );
        stalk.position.y = 1.1;
        stalk.castShadow = true;
        group.add(stalk);

        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 12), materials.biolumCyan);
        bulb.position.set(0, 2.2, 0);
        group.add(bulb);

        break;
      }

      case 'sap_weaver': {
        const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.4, 0.8, 8), materials.woodRoot);
        base.position.y = 0.4;
        group.add(base);

        const sac = new THREE.Mesh(new THREE.SphereGeometry(0.65, 16, 16), materials.biolumAmber);
        sac.position.y = 1.2;
        sac.scale.set(1, 1.25, 1);
        sac.castShadow = true;
        group.add(sac);

        break;
      }

      case 'petal_mill': {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 1.8, 8), materials.woodRoot);
        stem.position.y = 0.9;
        group.add(stem);

        const petalHub = new THREE.Group();
        petalHub.name = 'petalHub';
        petalHub.position.y = 1.8;

        const centerCore = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), materials.biolumAmber);
        petalHub.add(centerCore);

        for (let i = 0; i < 5; i++) {
          const angle = (i * Math.PI * 2) / 5;
          const petal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.7), materials.biolumPink);
          petal.position.set(Math.sin(angle) * 0.5, 0, Math.cos(angle) * 0.5);
          petal.rotation.y = angle;
          petalHub.add(petal);
        }

        group.add(petalHub);
        break;
      }

      case 'snap_trap': {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.35, 1.2, 8), materials.porcelainWhite);
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

      case 'glow_spore_cluster': {
        // The cave-mouth plant (Adam, 2026-10-14): a low cluster of
        // glowing cyan orbs on short dark stalks — the same blue
        // spheres that used to be pure set dressing at cave mouths,
        // now a real, harvestable plant that grows around them.
        const stalkGeom = new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6);
        const orbOffsets: [number, number, number][] = [
          [0, 0.52, 0], [0.18, 0.4, 0.1], [-0.16, 0.44, -0.08],
          [0.08, 0.34, -0.16], [-0.1, 0.3, 0.15], [0.22, 0.26, -0.14],
        ];
        for (const [ox, oy, oz] of orbOffsets) {
          const stalk = new THREE.Mesh(stalkGeom, materials.woodRoot);
          stalk.position.set(ox, oy / 2, oz);
          group.add(stalk);
          const orb = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), materials.biolumCyan);
          orb.position.set(ox, oy, oz);
          group.add(orb);
        }
        break;
      }

      case 'glow_fungus': {
        // The cavern's own fungus (Adam, 2026-10-14): taller than its
        // surface cousin — pale stalks and flat cyan caps, grown for a
        // place with no sun at all. Harvested like any plant; regrows.
        const capGeom = new THREE.SphereGeometry(0.16, 10, 8);
        const stalkMat = materials.woodRoot;
        const tuft: [number, number, number][] = [
          [0, 0.85, 0], [0.2, 0.6, 0.12], [-0.18, 0.7, -0.1], [0.1, 0.45, -0.2], [-0.08, 0.5, 0.18],
        ];
        for (const [ox, h, oz] of tuft) {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.055, h, 6), stalkMat);
          stalk.position.set(ox, h / 2, oz);
          group.add(stalk);
          const cap = new THREE.Mesh(capGeom, materials.biolumCyan);
          cap.scale.set(1, 0.5, 1);
          cap.position.set(ox, h + 0.03, oz);
          group.add(cap);
        }
        break;
      }

      case 'sunshard_cluster': {
        // Amber crystals that grow in the shallow caverns — a small
        // cluster of warm shards around a taller spine.
        const shardGeom = new THREE.OctahedronGeometry(0.3);
        const shards: [number, number, number, number][] = [
          [0, 0.42, 0, 1.25], [0.24, 0.26, 0.1, 0.8], [-0.2, 0.3, -0.14, 0.9], [0.05, 0.2, 0.24, 0.65],
        ];
        for (const [ox, oy, oz, s] of shards) {
          const shard = new THREE.Mesh(shardGeom, materials.biolumAmber);
          shard.position.set(ox, oy, oz);
          shard.scale.setScalar(s);
          shard.rotation.set(0.2, ox * 4, 0.15);
          shard.castShadow = true;
          group.add(shard);
        }
        break;
      }

      case 'prism_cluster': {
        // The deep caves' prize: two tall violet prisms. Stretched
        // octahedra read as cut crystal without any new geometry.
        const prismGeom = new THREE.OctahedronGeometry(0.34);
        const prisms: [number, number, number, number][] = [
          [0, 0.62, 0, 1.5], [0.26, 0.4, -0.1, 1.0], [-0.22, 0.32, 0.14, 0.8],
        ];
        for (const [ox, oy, oz, s] of prisms) {
          const prism = new THREE.Mesh(prismGeom, materials.biolumViolet);
          prism.position.set(ox, oy, oz);
          prism.scale.set(0.8 * s, 1.6 * s, 0.8 * s);
          prism.rotation.y = ox * 5;
          prism.castShadow = true;
          group.add(prism);
        }
        break;
      }

      case 'bounce_shroom': {
        // Squat springy stem + a wide violet cap: the trampoline. The
        // cap is named so the render loop can squash it when bounced on.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.45, 8), materials.woodRoot);
        stem.position.y = 0.22;
        stem.castShadow = true;
        group.add(stem);

        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.46, 16, 12), materials.biolumViolet);
        cap.name = 'bounceCap';
        cap.scale.set(1, 0.55, 1);
        cap.position.y = 0.5;
        cap.castShadow = true;
        group.add(cap);
        break;
      }

      case 'echo_reed': {
        // Wetland listening stalks: a fan of tall, ringed, hollow
        // reeds tipped with teal resonator bells. The rings are thin
        // torus bands — cheap, and they read as "grown around sound"
        // from across the marsh.
        const reedMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.8 });
        const ringMat = new THREE.MeshStandardMaterial({ color: 0x2dd4bf, roughness: 0.4, emissive: 0x0f766e, emissiveIntensity: 0.5 });
        const stalks: [number, number, number][] = [
          [0, 0, 2.6], [0.22, 0.1, 2.1], [-0.2, 0.12, 2.3], [0.1, -0.2, 1.8], [-0.12, -0.16, 2.0],
        ];
        for (const [ox, oz, h] of stalks) {
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, h, 6), reedMat);
          stalk.position.set(ox, h / 2, oz);
          stalk.rotation.z = ox * 0.25;
          stalk.castShadow = true;
          group.add(stalk);
          for (let r = 1; r <= 3; r++) {
            const ring = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 6, 12), ringMat);
            ring.position.set(ox + ox * 0.25 * (h * r / 4) * 0.4, (h * r) / 4, oz);
            ring.rotation.x = Math.PI / 2;
            group.add(ring);
          }
          const bell = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.22, 8, 1, true), ringMat);
          bell.position.set(ox + ox * 0.25 * h * 0.4, h + 0.08, oz);
          bell.rotation.x = Math.PI;
          group.add(bell);
        }
        break;
      }

      case 'antenna_shroom': {
        // Fungal Hollow giant #1 — the senser (Adam, 2026-10-15):
        // a thick violet stalk and small cap, with two long
        // antennae that end in glowing tips, tasting the spore air.
        const stalkMat = new THREE.MeshStandardMaterial({ color: 0x8b7bb8, roughness: 0.85 });
        const capMat = new THREE.MeshStandardMaterial({ color: 0x6d28d9, roughness: 0.6 });
        const tipMat = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.3, emissive: 0x7c3aed, emissiveIntensity: 0.9 });
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.3, 1.9, 8), stalkMat);
        stalk.position.y = 0.95; stalk.castShadow = true; group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.position.y = 1.9; cap.scale.y = 0.55; cap.castShadow = true; group.add(cap);
        for (const side of [-1, 1]) {
          const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 1.1, 5), stalkMat);
          antenna.position.set(side * 0.22, 2.5, 0);
          antenna.rotation.z = side * -0.35;
          group.add(antenna);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), tipMat);
          tip.position.set(side * 0.41, 3.02, 0);
          group.add(tip);
        }
        break;
      }

      case 'visor_shroom': {
        // Fungal Hollow giant #2 — the almost-face (Adam, 2026-10-15):
        // a broad cap whose front carries two dark eye-spots and a
        // shallow mouth arc. Not a face. Almost. That is the point.
        const stalkMat = new THREE.MeshStandardMaterial({ color: 0xa89a8c, roughness: 0.9 });
        const capMat = new THREE.MeshStandardMaterial({ color: 0x7e57c2, roughness: 0.65 });
        const darkMat = new THREE.MeshStandardMaterial({ color: 0x1c1030, roughness: 0.4 });
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.38, 1.3, 8), stalkMat);
        stalk.position.y = 0.65; stalk.castShadow = true; group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.95, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.position.y = 1.3; cap.scale.y = 0.5; cap.castShadow = true; group.add(cap);
        for (const side of [-1, 1]) {
          const eye = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), darkMat);
          eye.position.set(side * 0.34, 1.52, 0.78);
          eye.scale.z = 0.4;
          group.add(eye);
        }
        const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.035, 6, 12, Math.PI), darkMat);
        mouth.position.set(0, 1.38, 0.82);
        mouth.rotation.x = 0.25; mouth.rotation.z = Math.PI;
        group.add(mouth);
        break;
      }

      case 'shelf_shroom': {
        // Fungal Hollow giant #3 — the shelves (Adam, 2026-10-15):
        // flat bracket shelves stacked up a trunk, alternating
        // sides. The climbable kind, once climbing lands.
        const trunkMat = new THREE.MeshStandardMaterial({ color: 0x8a6d4f, roughness: 0.95 });
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0xd9a05b, roughness: 0.8 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.26, 2.3, 7), trunkMat);
        trunk.position.y = 1.15; trunk.castShadow = true; group.add(trunk);
        const shelves: [number, number, number][] = [
          [0.34, 0.8, 0.62], [-0.36, 1.3, 0.55], [0.3, 1.8, 0.48], [-0.26, 2.25, 0.4],
        ];
        for (const [ox, y, r] of shelves) {
          const shelf = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.85, 0.09, 10), shelfMat);
          shelf.position.set(ox, y, 0);
          shelf.castShadow = true;
          group.add(shelf);
        }
        break;
      }

      case 'cinder_bloom': {
        // Ember Scar (2026-10-15): a flower growing ON a vent — a
        // charred disc at its base, a dark stem, and layered ember
        // petals around a glowing core. It drinks the heat.
        const charMat = new THREE.MeshStandardMaterial({ color: 0x1f1512, roughness: 1 });
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x3a2320, roughness: 0.9 });
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xd9481c, roughness: 0.55, emissive: 0x7c2d12, emissiveIntensity: 0.5 });
        const coreMat = new THREE.MeshStandardMaterial({ color: 0xffb25e, roughness: 0.3, emissive: 0xff7a2a, emissiveIntensity: 1.2 });
        const base = new THREE.Mesh(new THREE.CircleGeometry(0.55, 12), charMat);
        base.rotation.x = -Math.PI / 2; base.position.y = 0.02; group.add(base);
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.8, 6), stemMat);
        stem.position.y = 0.4; stem.castShadow = true; group.add(stem);
        for (let i = 0; i < 5; i++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.42, 5), petalMat);
          const a = (i / 5) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.17, 0.86, Math.sin(a) * 0.17);
          petal.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
          group.add(petal);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), coreMat);
        core.position.y = 0.88;
        group.add(core);
        break;
      }

      case 'dusk_grass': {
        // Living (2026-10-15): black-violet grass — alien
        // photosynthesis wears purple-black here (Adam: no
        // chlorophyll assumptions). Crossed blade tufts with a
        // faint magenta sheen at the tips.
        const bladeMat3 = new THREE.MeshStandardMaterial({ color: 0x2e1a47, roughness: 0.7, emissive: 0x581c87, emissiveIntensity: 0.35 });
        const tipMat = new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.5, emissive: 0xa21caf, emissiveIntensity: 0.5 });
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.62, 4), bladeMat3);
          blade.position.set(Math.cos(a) * 0.13, 0.3, Math.sin(a) * 0.13);
          blade.rotation.set(Math.sin(a) * 0.3, 0, Math.cos(a) * 0.3);
          blade.castShadow = true; group.add(blade);
          const tip = new THREE.Mesh(new THREE.SphereGeometry(0.028, 5, 5), tipMat);
          tip.position.set(Math.cos(a) * 0.22, 0.6, Math.sin(a) * 0.22);
          group.add(tip);
        }
        break;
      }

      case 'heartbloom': {
        // Living (2026-10-15): the valley's heart worn outside —
        // great dark petals around a red core that begs to be
        // called beating. Big: the scale rides the flora record.
        const petalMat4 = new THREE.MeshStandardMaterial({ color: 0x3b1032, roughness: 0.55, emissive: 0x701a4d, emissiveIntensity: 0.3 });
        const coreMat3 = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.3, emissive: 0xdc2626, emissiveIntensity: 1.2 });
        const stemMat4 = new THREE.MeshStandardMaterial({ color: 0x2e1a47, roughness: 0.85 });
        const stem5 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.7, 7), stemMat4);
        stem5.position.y = 0.35; stem5.castShadow = true; group.add(stem5);
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.24, 7, 6), petalMat4);
          petal.position.set(Math.cos(a) * 0.26, 0.74, Math.sin(a) * 0.26);
          petal.scale.set(1, 0.4, 0.65);
          petal.rotation.y = -a;
          petal.rotation.x = 0.35;
          group.add(petal);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), coreMat3);
        core.position.y = 0.8;
        group.add(core);
        break;
      }

      case 'stormcatcher': {
        // Storm (2026-10-15): a tall ribbed reed crowned with a
        // coppery whorl and a charge-bright orb — a plant that
        // drinks lightning and grows glass in its crown.
        const reedMat = new THREE.MeshStandardMaterial({ color: 0x7a6a4f, roughness: 0.85 });
        const copperMat = new THREE.MeshStandardMaterial({ color: 0xb87333, roughness: 0.35, metalness: 0.55 });
        const orbMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.25, emissive: 0xf59e0b, emissiveIntensity: 1.1 });
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.07, 1.5, 6), reedMat);
        stalk.position.y = 0.75; stalk.castShadow = true; group.add(stalk);
        for (let i = 0; i < 5; i++) {
          const blade = new THREE.Mesh(new THREE.TorusGeometry(0.16 - i * 0.018, 0.016, 5, 10), copperMat);
          blade.position.y = 1.28 + i * 0.07;
          blade.rotation.x = Math.PI / 2;
          group.add(blade);
        }
        const orb = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 8), orbMat);
        orb.position.y = 1.62;
        group.add(orb);
        break;
      }

      case 'gravebloom': {
        // Bone (2026-10-15): a flower rooted in bone — a pale rib
        // shard for a base, bleached-silk petals, a marrow-gold
        // heart. Death, composted into something gentle.
        const boneMat3 = new THREE.MeshStandardMaterial({ color: 0xe8e2d0, roughness: 0.95 });
        const petalMat3 = new THREE.MeshStandardMaterial({ color: 0xf1ead8, roughness: 0.6, emissive: 0xcfc39e, emissiveIntensity: 0.25 });
        const heartMat2 = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.4, emissive: 0xb9832f, emissiveIntensity: 0.7 });
        const shard = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.05, 5, 10, Math.PI), boneMat3);
        shard.position.y = 0.05; shard.rotation.z = 0.4; group.add(shard);
        const stem4 = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.6, 6), new THREE.MeshStandardMaterial({ color: 0xb9ac8c, roughness: 0.9 }));
        stem4.position.y = 0.35; stem4.castShadow = true; group.add(stem4);
        for (let i = 0; i < 6; i++) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.13, 6, 5), petalMat3);
          const a = (i / 6) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.13, 0.68, Math.sin(a) * 0.13);
          petal.scale.set(1, 0.45, 0.7);
          petal.rotation.y = -a;
          group.add(petal);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), heartMat2);
        heart.position.y = 0.72; heart.scale.y = 0.8;
        group.add(heart);
        break;
      }

      case 'precursor_bloom': {
        // Precursor (2026-10-15): a too-perfect flower — eight
        // IDENTICAL petal boxes rotated at exact 45-degree steps
        // around a golden octahedron core, on an unnaturally
        // straight stem. Engineered geometry, grown.
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xe8f0c8, roughness: 0.5, emissive: 0x9db56b, emissiveIntensity: 0.35 });
        const coreMat2 = new THREE.MeshStandardMaterial({ color: 0xf5c542, roughness: 0.3, emissive: 0xd9a41f, emissiveIntensity: 0.9 });
        const stemMat3 = new THREE.MeshStandardMaterial({ color: 0x77894f, roughness: 0.8 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.85, 6), stemMat3);
        stem.position.y = 0.42; stem.castShadow = true; group.add(stem);
        for (let i = 0; i < 8; i++) {
          const petal = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.14), petalMat);
          const a = (i / 8) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.2, 0.88, Math.sin(a) * 0.2);
          petal.rotation.y = -a;
          petal.rotation.z = Math.cos(a) * 0.35;
          group.add(petal);
        }
        const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), coreMat2);
        core.position.y = 0.9;
        group.add(core);
        break;
      }

      case 'heartroot': {
        // Rootwood (2026-10-15): a buttress cluster — four arched
        // root slabs leaning into a dense heart bulb. Slab = a box
        // tilted inward; the heart catches a warm low light.
        const rootMat = new THREE.MeshStandardMaterial({ color: 0x6b4f2a, roughness: 0.95 });
        const heartMat3 = new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.7, emissive: 0x59331a, emissiveIntensity: 0.35 });
        for (let i = 0; i < 4; i++) {
          const slab = new THREE.Mesh(new THREE.BoxGeometry(0.22, 1.1, 0.5), rootMat);
          const a = (i / 4) * Math.PI * 2 + 0.3;
          slab.position.set(Math.cos(a) * 0.42, 0.5, Math.sin(a) * 0.42);
          slab.rotation.set(Math.sin(a) * 0.5, a, -Math.cos(a) * 0.5);
          slab.castShadow = true;
          group.add(slab);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), heartMat3);
        heart.position.y = 0.32;
        heart.scale.y = 0.8;
        group.add(heart);
        break;
      }

      case 'rime_spire': {
        // Ice Fangs (Frost, 2026-10-15): a frozen geyser — clustered
        // ice teeth leaning from a shared base, translucent pale
        // blue with a brighter core tooth.
        const iceMat = new THREE.MeshStandardMaterial({ color: 0xcfe8fa, transparent: true, opacity: 0.8, roughness: 0.25, metalness: 0.1, emissive: 0x8fc3e8, emissiveIntensity: 0.3 });
        const coreIceMat = new THREE.MeshStandardMaterial({ color: 0xeaf7ff, transparent: true, opacity: 0.9, roughness: 0.15, emissive: 0xa5d8ff, emissiveIntensity: 0.5 });
        for (let i = 0; i < 4; i++) {
          const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.16 - i * 0.02, 1.3 - i * 0.18, 6), i === 0 ? coreIceMat : iceMat);
          const a = (i / 4) * Math.PI * 2 + 0.4;
          tooth.position.set(Math.cos(a) * 0.18, 0.6 - i * 0.06, Math.sin(a) * 0.18);
          tooth.rotation.set(Math.sin(a) * 0.18, 0, -Math.cos(a) * 0.18);
          tooth.castShadow = true;
          group.add(tooth);
        }
        break;
      }

      case 'prism_reed': {
        // Prism Beds (Saltglass, 2026-10-15): a cluster of crystal
        // blades — translucent cones leaning at seeded angles
        // around a fused shard heart. Transparency + emissive
        // gives the grown-glass read.
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xbfe8e2, transparent: true, opacity: 0.72, metalness: 0.3, roughness: 0.15, emissive: 0x9fd8d0, emissiveIntensity: 0.4 });
        const heartMat2 = new THREE.MeshStandardMaterial({ color: 0xe0f5f0, roughness: 0.2, emissive: 0x5eead4, emissiveIntensity: 0.7 });
        for (let i = 0; i < 5; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.07, 1.1 + (i % 3) * 0.25, 5), bladeMat);
          const a = (i / 5) * Math.PI * 2;
          blade.position.set(Math.cos(a) * 0.16, 0.55, Math.sin(a) * 0.16);
          blade.rotation.set(Math.sin(a) * 0.22, 0, -Math.cos(a) * 0.22);
          blade.castShadow = true;
          group.add(blade);
        }
        const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.11), heartMat2);
        heart.position.y = 0.16;
        group.add(heart);
        break;
      }

      case 'obsidian_bloom': {
        // Obsidian Garden (2026-10-15): a flower of fused black
        // glass — flattened shard-petals around a violet heart.
        // Metalness + low roughness gives it the glassy catch.
        const glassMat = new THREE.MeshStandardMaterial({ color: 0x171021, metalness: 0.65, roughness: 0.22, emissive: 0x1e1033, emissiveIntensity: 0.6 });
        const heartMat = new THREE.MeshStandardMaterial({ color: 0x8b5cf6, roughness: 0.3, emissive: 0x7c3aed, emissiveIntensity: 1.1 });
        const stemMat2 = new THREE.MeshStandardMaterial({ color: 0x241a2e, roughness: 0.8 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.08, 0.7, 6), stemMat2);
        stem.position.y = 0.35; stem.castShadow = true; group.add(stem);
        for (let i = 0; i < 6; i++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 4), glassMat);
          const a = (i / 6) * Math.PI * 2;
          petal.scale.z = 0.35; // flattened into a shard
          petal.position.set(Math.cos(a) * 0.16, 0.82, Math.sin(a) * 0.16);
          petal.rotation.set(Math.sin(a) * 0.8, 0, -Math.cos(a) * 0.8);
          group.add(petal);
        }
        const heart = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), heartMat);
        heart.position.y = 0.84;
        group.add(heart);
        break;
      }

      case 'mirror_lily': {
        // Mirror Marsh (2026-10-15): the pool IS the mesh — a flat
        // reflective disc of mirror-liquid with lily pads riding it.
        // Metalness does the mirror work; the marsh's zone light
        // multiplier gives the gleam its reach.
        const poolMat = new THREE.MeshStandardMaterial({
          color: 0xcfe9e6, metalness: 0.9, roughness: 0.15,
          emissive: 0x2a4a48, emissiveIntensity: 0.35,
        });
        const pool = new THREE.Mesh(new THREE.CircleGeometry(1.15, 20), poolMat);
        pool.rotation.x = -Math.PI / 2;
        pool.position.y = 0.03;
        group.add(pool);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.03, 6, 24),
          new THREE.MeshStandardMaterial({ color: 0x5f7a72, roughness: 0.7 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.03;
        group.add(rim);
        const padMat = new THREE.MeshStandardMaterial({ color: 0x2f7a5e, roughness: 0.6 });
        const pads: [number, number, number][] = [[0.3, 0.2, 0.34], [-0.42, -0.15, 0.26], [0.05, -0.45, 0.22]];
        for (const [ox, oz, r] of pads) {
          const pad = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, 0.05, 10), padMat);
          pad.position.set(ox, 0.07, oz);
          pad.castShadow = true;
          group.add(pad);
        }
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.3, emissive: 0xd97706, emissiveIntensity: 0.7 }));
        bloom.position.set(0.3, 0.16, 0.2);
        group.add(bloom);
        break;
      }

      case 'bell_bloom':
      default: {
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 1.6, 8), materials.woodRoot);
        stem.position.y = 0.8;
        group.add(stem);

        const bell = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.7, 8, 1, true), materials.biolumViolet);
        bell.position.y = 1.6;
        bell.rotation.x = Math.PI;
        group.add(bell);
        break;
      }
    }

    group.position.set(flora.x, terrainHeightAt(flora.x, flora.z), flora.z);
    group.rotation.y = flora.rotation;
    return group;
  }

  function updateFloraMesh(mesh: THREE.Group, flora: FloraEntity) {
    mesh.position.set(flora.x, 0, flora.z);
    mesh.userData.entity = flora;
    const baseScale = flora.scale * (0.45 + flora.growthStage * 0.14);
    mesh.scale.set(baseScale, baseScale, baseScale);

    const petalHub = mesh.getObjectByName('petalHub');
    if (petalHub) {
      petalHub.rotation.y += 0.03;
    }
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
