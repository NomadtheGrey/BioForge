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

    if (fauna.species === 'soft_puff') {
      const hop = Math.abs(Math.sin(fauna.animTime * 6)) * 0.25;
      mesh.position.y = groundY + hop;
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
