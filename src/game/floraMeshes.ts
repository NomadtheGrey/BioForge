// ============================================================================
// floraMeshes.ts — flora mesh factory (extracted from creatureMeshes.ts,
// creature slice 10, 2026-10-16)
// ----------------------------------------------------------------------------
// creatureMeshes.ts outgrew the single-push size cap the same way
// constants.ts did; the flora half of the mesh kit lives here now,
// under the same rule the codex extraction set: a growing table's
// rendering travels with its own module. The kit in creatureMeshes.ts
// delegates to these functions — callers see no change.
//
// buildFloraMesh draws one plant/fungus from the shared structure
// materials + the engine's terrain height lookup; updateFloraMeshImpl
// applies growth scale + the petal-mill's slow spin per frame.
// ============================================================================

import * as THREE from 'three';
import type { FloraEntity } from '../types/game';
import type { StructureMaterials } from './structureBuilders';

export function buildFloraMesh(
  flora: FloraEntity,
  materials: StructureMaterials,
  terrainHeightAt: (x: number, z: number) => number,
): THREE.Group {
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

      case 'gulp_lily': {
        // The pad IS the pod (slice 9): a wide lily pad with a
        // folded seam and a dew-cup heart — still water, with
        // an author.
        const padMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 });
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.5, 0.07, 12), padMat);
        pad.position.y = 0.06;
        group.add(pad);
        const seam = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.03, 1.0), new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.7 }));
        seam.position.y = 0.1;
        group.add(seam);
        const cup = new THREE.Mesh(
          new THREE.SphereGeometry(0.12, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.5, emissive: 0x9d174d, emissiveIntensity: 0.3 })
        );
        cup.position.set(0, 0.14, 0.18);
        group.add(cup);
        break;
      }

      case 'waygrass': {
        // A route, in grass (slice 9): a low tussock of blades
        // leaning the same way — the direction of travel.
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.85, side: THREE.DoubleSide });
        for (let i = 0; i < 7; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.5 + (i % 3) * 0.12, 4), bladeMat);
          blade.position.set((i % 3 - 1) * 0.12, 0.25, (Math.floor(i / 3) - 1) * 0.12);
          blade.rotation.x = 0.3;
          blade.rotation.z = 0.12;
          group.add(blade);
        }
        break;
      }

      case 'flame_lily': {
        // Fire's promise, blooming (slice 9): a red lily on a
        // dark stalk — the Ashen fields, a week after the burn.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 0.9 }));
        stalk.position.y = 0.35;
        group.add(stalk);
        const petalMat = new THREE.MeshStandardMaterial({
          color: 0xef4444, roughness: 0.5, side: THREE.DoubleSide,
          emissive: 0x991b1b, emissiveIntensity: 0.4,
        });
        for (let i = 0; i < 5; i++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.34, 5), petalMat);
          const a = (i / 5) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.11, 0.78, Math.sin(a) * 0.11);
          petal.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
          group.add(petal);
        }
        break;
      }

      case 'salt_daisy': {
        // Telling noon (slice 9): white crust-petaled daisy —
        // a pale star wearing its salt.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.45, 6), new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.85 }));
        stem.position.y = 0.22;
        group.add(stem);
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, side: THREE.DoubleSide });
        for (let i = 0; i < 8; i++) {
          const petal = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), petalMat);
          petal.scale.set(1.5, 0.2, 0.7);
          const a = (i / 8) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.12, 0.47, Math.sin(a) * 0.12);
          petal.rotation.y = -a;
          group.add(petal);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6 }));
        heart.position.y = 0.49;
        group.add(heart);
        break;
      }

      case 'compass_cress': {
        // All pointing one way (slice 9): a low crystalline
        // rosette whose needle-leaves align to the field — the
        // whole plant drawn rotated toward +Z of its frame.
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x67e8f9, roughness: 0.3, metalness: 0.3,
          emissive: 0x155e75, emissiveIntensity: 0.35, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 6; i++) {
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.34, 4), leafMat);
          leaf.position.set((i % 3 - 1) * 0.1, 0.1, 0.06 + Math.floor(i / 3) * 0.08);
          leaf.rotation.x = -1.1; // laid forward: the alignment reads
          group.add(leaf);
        }
        break;
      }

      case 'ice_grass': {
        // A meadow through glass (slice 9): pale ice blades
        // with one blue bloom suspended among them.
        const bladeMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.25, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 6; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.45 + (i % 3) * 0.1, 4), bladeMat);
          blade.position.set((i % 3 - 1) * 0.11, 0.22, (Math.floor(i / 3) - 1) * 0.11);
          blade.rotation.z = (i % 3 - 1) * 0.15;
          group.add(blade);
        }
        const bloom = new THREE.Mesh(
          new THREE.SphereGeometry(0.06, 8, 6),
          new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x1d4ed8, emissiveIntensity: 0.6, roughness: 0.4 })
        );
        bloom.position.set(0, 0.3, 0);
        group.add(bloom);
        break;
      }

      case 'field_cap': {
        // Done honestly (slice 9): THE cap-and-stem — a tan
        // dome on a cream stem, the forager's first lesson.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xf5f0dc, roughness: 0.9 }));
        stem.position.y = 0.15;
        group.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xb08968, roughness: 0.85 }));
        cap.position.y = 0.28;
        cap.castShadow = true;
        group.add(cap);
        break;
      }

      case 'frostcap': {
        // Winter, growing upward (slice 9): pale caps stepping
        // up a stalk, each wearing its rime.
        const stalkMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.8 });
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.09, 0.9, 8), stalkMat);
        stalk.position.y = 0.45;
        group.add(stalk);
        for (let i = 0; i < 3; i++) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16 - i * 0.03, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), stalkMat);
          cap.position.set((i - 1) * 0.07, 0.45 + i * 0.24, 0);
          group.add(cap);
        }
        break;
      }

      case 'haycap': {
        // At ankle height (slice 9): a squat golden cap on a
        // short stem — the meadow's fertility, fruiting.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.18, 8), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.9 }));
        stem.position.y = 0.09;
        group.add(stem);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xd6c48f, roughness: 0.9 }));
        cap.scale.y = 0.8;
        cap.position.y = 0.16;
        group.add(cap);
        break;
      }

      case 'coal_cap': {
        // After the fire (slice 9): a black cap with an ember
        // seam — the burn's first cool week, fruiting.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.26, 8), new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.95 }));
        stem.position.y = 0.13;
        group.add(stem);
        const capMat = new THREE.MeshStandardMaterial({
          color: 0x1c1917, roughness: 0.6, emissive: 0xea580c, emissiveIntensity: 0.25,
        });
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.position.y = 0.24;
        group.add(cap);
        break;
      }

      case 'snow_morel': {
        // The melt line, edible (slice 9): a dark honeycomb
        // cone — pits drawn as a darker tip band and texture
        // of bumps.
        const bodyMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
        const body = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 8), bodyMat);
        body.position.y = 0.18;
        group.add(body);
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0x292524, roughness: 1 }));
        tip.position.y = 0.36;
        group.add(tip);
        break;
      }

      case 'ink_cap': {
        // A library, self-destructing politely (slice 9): a
        // pale bell cap going black at the rim — the melt,
        // beginning.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.34, 8), new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 }));
        stem.position.y = 0.17;
        group.add(stem);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.3, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.7, side: THREE.DoubleSide }));
        cap.position.y = 0.45;
        group.add(cap);
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.018, 6, 12), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.4 }));
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.31;
        group.add(rim);
        break;
      }

      case 'bonemoss': {
        // A sheet with ambitions (slice 10): a deep-green
        // carpet hugging the ground — drawn as overlapping low
        // mounds, black-green in the shade of itself.
        const mossMat = new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 1 });
        for (let i = 0; i < 4; i++) {
          const mound = new THREE.Mesh(new THREE.SphereGeometry(0.3 - (i % 2) * 0.08, 8, 6), mossMat);
          mound.scale.set(1.2, 0.25, 1.1);
          mound.position.set((i % 2 - 0.5) * 0.4, 0.05, (Math.floor(i / 2) - 0.5) * 0.4);
          group.add(mound);
        }
        break;
      }

      case 'listening_fern': {
        // The valley listening back (slice 10): fronds arced
        // outward, two broad ear-leaves turned the same way —
        // toward the sound, toward you.
        const frondMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const frond = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.8, 4), frondMat);
          const a = (i / 5) * Math.PI * 2;
          frond.position.set(Math.cos(a) * 0.16, 0.35, Math.sin(a) * 0.16);
          frond.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
          group.add(frond);
        }
        for (const side of [-1, 1]) {
          const ear = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), frondMat);
          ear.scale.set(1, 1.3, 0.25);
          ear.position.set(side * 0.1, 0.55, 0.14);
          group.add(ear);
        }
        break;
      }

      case 'snowbell': {
        // Grown ice, tuned (slice 10): a living stalk and a
        // bell of ice-crystal petals, translucent as the lake
        // it keeps time with.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8 }));
        stalk.position.y = 0.27;
        group.add(stalk);
        const bell = new THREE.Mesh(
          new THREE.ConeGeometry(0.16, 0.24, 8, 1, true),
          new THREE.MeshStandardMaterial({
            color: 0xbae6fd, roughness: 0.2, transparent: true, opacity: 0.8,
            side: THREE.DoubleSide, emissive: 0x38bdf8, emissiveIntensity: 0.3,
          })
        );
        bell.position.y = 0.62;
        bell.rotation.x = Math.PI;
        group.add(bell);
        break;
      }

      case 'grave_vine': {
        // Flowering from the ribs (slice 10): pale arcs for
        // the skeleton it climbs, white flowers along them.
        const boneMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 });
        const flowerMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc, roughness: 0.6, emissive: 0x94a3b8, emissiveIntensity: 0.25,
        });
        for (let i = 0; i < 3; i++) {
          const rib = new THREE.Mesh(new THREE.TorusGeometry(0.3 - i * 0.05, 0.03, 6, 12, Math.PI), boneMat);
          rib.position.set((i - 1) * 0.22, 0.05, 0);
          rib.rotation.z = 0.2;
          group.add(rib);
          const flower = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), flowerMat);
          flower.position.set((i - 1) * 0.22 + 0.1, 0.32 - i * 0.04, 0.08);
          group.add(flower);
        }
        break;
      }

      case 'saltroot': {
        // Living conduits of crystal (slice 10): a small tree
        // whose roots are glass — cyan crystal roots splaying
        // from the trunk into the soil it threads.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.16, 1.1, 8), materials.woodRoot);
        trunk.position.y = 0.55;
        trunk.castShadow = true;
        group.add(trunk);
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.2, metalness: 0.2,
          emissive: 0x155e75, emissiveIntensity: 0.4,
        });
        for (let i = 0; i < 5; i++) {
          const root = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.6, 5), glassMat);
          const a = (i / 5) * Math.PI * 2;
          root.position.set(Math.cos(a) * 0.28, 0.12, Math.sin(a) * 0.28);
          root.rotation.set(Math.sin(a) * 1.1, 0, -Math.cos(a) * 1.1);
          group.add(root);
        }
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.9 }));
        crown.scale.y = 0.75;
        crown.position.y = 1.35;
        group.add(crown);
        break;
      }

      case 'stormroot': {
        // Grown for the lightning (slice 10): a low shrub of
        // spires with charged fruit glowing among them.
        const spireMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.85 });
        for (let i = 0; i < 4; i++) {
          const spire = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.7 + (i % 2) * 0.25, 6), spireMat);
          spire.position.set((i % 2 - 0.5) * 0.3, 0.35, (Math.floor(i / 2) - 0.5) * 0.3);
          group.add(spire);
        }
        const fruitMat = new THREE.MeshStandardMaterial({
          color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.8, roughness: 0.4,
        });
        for (let i = 0; i < 3; i++) {
          const fruit = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fruitMat);
          fruit.position.set((i - 1) * 0.2, 0.22, 0.15 - (i % 2) * 0.25);
          group.add(fruit);
        }
        break;
      }

      case 'bog_lantern': {
        // The water's edge, lit (slice 10): sedge blades and
        // gel pods of biolume on thin stalks — uncounted
        // lanterns along the banks.
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.85, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.6, 4), bladeMat);
          blade.position.set((i % 3 - 1) * 0.14, 0.3, (Math.floor(i / 3) - 0.5) * 0.2);
          blade.rotation.z = (i % 3 - 1) * 0.2;
          group.add(blade);
        }
        const podMat = new THREE.MeshStandardMaterial({
          color: 0xa3e635, emissive: 0x65a30d, emissiveIntensity: 0.9,
          roughness: 0.3, transparent: true, opacity: 0.9,
        });
        for (let i = 0; i < 3; i++) {
          const pod = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), podMat);
          pod.scale.y = 1.25;
          pod.position.set((i - 1) * 0.18, 0.62, (i % 2) * 0.12);
          group.add(pod);
        }
        break;
      }

      case 'gale_grass': {
        // Each stand a chord (slice 10): hollow blades in
        // length-sorted ranks — the wind's own sorting, drawn.
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.7, side: THREE.DoubleSide });
        for (let i = 0; i < 7; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.45 + (i % 4) * 0.12, 4), bladeMat);
          blade.position.set((i - 3) * 0.09, (0.45 + (i % 4) * 0.12) / 2, 0);
          blade.rotation.z = 0.08;
          group.add(blade);
        }
        break;
      }

      case 'doorstep_rose': {
        // Threshold-true (slice 10): a small rose bush in
        // bloom — the door's ledger, flowering.
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.95 });
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bushMat);
        bush.scale.y = 0.8;
        bush.position.y = 0.28;
        group.add(bush);
        const roseMat = new THREE.MeshStandardMaterial({
          color: 0xfb7185, roughness: 0.55, emissive: 0x9f1239, emissiveIntensity: 0.35,
        });
        for (let i = 0; i < 4; i++) {
          const rose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), roseMat);
          const a = (i / 4) * Math.PI * 2 + 0.4;
          rose.position.set(Math.cos(a) * 0.24, 0.38 + (i % 2) * 0.1, Math.sin(a) * 0.24);
          group.add(rose);
        }
        break;
      }

      case 'glyph_vine': {
        // Still writing (slice 10): a vine stem with letter-
        // leaves in sequence — flat green glyphs along its
        // length, none repeated.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.85 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.0, 6), stemMat);
        stem.position.y = 0.5;
        stem.rotation.z = 0.15;
        group.add(stem);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.7, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const leaf = new THREE.Mesh(new THREE.PlaneGeometry(0.14, 0.18), leafMat);
          leaf.position.set((i % 2 === 0 ? 1 : -1) * 0.12, 0.2 + i * 0.17, 0);
          leaf.rotation.y = (i % 2 === 0 ? 1 : -1) * 0.7;
          leaf.rotation.z = i * 0.35; // each leaf turned differently: the sequence
          group.add(leaf);
        }
        break;
      }

      case 'glowcap': {
        // The light the grub evolved inside (slice 10): THE
        // glowing cap — a broad dome with a gill-lit green
        // underside, the grove's ceiling at ankle height.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xd9f99d, roughness: 0.85 }));
        stem.position.y = 0.17;
        group.add(stem);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.7 });
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.position.y = 0.33;
        cap.castShadow = true;
        group.add(cap);
        const gills = new THREE.Mesh(
          new THREE.CylinderGeometry(0.26, 0.26, 0.03, 12),
          new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 1.1, roughness: 0.5 })
        );
        gills.position.y = 0.33;
        group.add(gills);
        break;
      }

      case 'ash_puff': {
        // The Drift's punctuation (slice 10): a cluster of
        // pale puffballs at ground level, unpuffed and
        // patient.
        const puffMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.95 });
        for (let i = 0; i < 3; i++) {
          const puff = new THREE.Mesh(new THREE.SphereGeometry(0.11 - (i % 2) * 0.03, 8, 6), puffMat);
          puff.position.set((i - 1) * 0.16, 0.09, (i % 2) * 0.12 - 0.05);
          group.add(puff);
        }
        break;
      }

      case 'meadow_clover': {
        // Rich soil's signature (slice 12): a low trefoil
        // sheet — small round leaflets in a ground-cover mat.
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.9, side: THREE.DoubleSide });
        for (let i = 0; i < 7; i++) {
          const leaflet = new THREE.Mesh(new THREE.CircleGeometry(0.06, 6), leafMat);
          leaflet.rotation.x = -Math.PI / 2 + 0.25;
          leaflet.position.set((i % 3 - 1) * 0.14, 0.06, (Math.floor(i / 3) - 1) * 0.13);
          group.add(leaflet);
        }
        break;
      }

      case 'vent_rose': {
        // A flower with a shutter (slice 12): scaled petals
        // cupped around a warm core, rim-set.
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, roughness: 0.6, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.16, 4), petalMat);
          const a = (i / 6) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.09, 0.12, Math.sin(a) * 0.09);
          petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
          group.add(petal);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.7, roughness: 0.5,
        }));
        core.position.y = 0.1;
        group.add(core);
        break;
      }

      case 'stormcap': {
        // Gas-bellied (slice 12): a stalk and an INFLATED cap —
        // a balloon of a mushroom, ready to travel.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0xe9d5ff, roughness: 0.8 }));
        stalk.position.y = 0.2;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), new THREE.MeshStandardMaterial({
          color: 0xa78bfa, roughness: 0.45, transparent: true, opacity: 0.92,
          emissive: 0x7c3aed, emissiveIntensity: 0.35,
        }));
        cap.scale.y = 0.8;
        cap.position.y = 0.5;
        group.add(cap);
        break;
      }

      case 'anvil_cap': {
        // Furniture that fruits (slice 12): flat, dense,
        // tool-hard brackets stacked like worktops.
        const bracketMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.35, 6), stemMat);
        stem.position.y = 0.17;
        group.add(stem);
        for (let i = 0; i < 2; i++) {
          const bracket = new THREE.Mesh(new THREE.CylinderGeometry(0.24 - i * 0.05, 0.26 - i * 0.05, 0.05, 10), bracketMat);
          bracket.position.set(i * 0.06 - 0.03, 0.36 + i * 0.09, 0);
          group.add(bracket);
        }
        break;
      }

      case 'glass_fern': {
        // Lenses in series (slice 12): fronds of grown glass
        // arcing from a glowing crown.
        const glassMat = new THREE.MeshStandardMaterial({
          color: 0x67e8f9, roughness: 0.15, transparent: true, opacity: 0.75,
          emissive: 0x0e7490, emissiveIntensity: 0.5, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 5; i++) {
          const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.55), glassMat);
          const a = (i / 5) * Math.PI * 2;
          frond.position.set(Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14);
          frond.rotation.set(0.5, -a, 0);
          group.add(frond);
        }
        break;
      }

      case 'forge_bloom': {
        // Hand-warm till dawn (slice 12): a spiral bed of
        // ember petals holding their heat.
        const petalMat = new THREE.MeshStandardMaterial({
          color: 0xfb923c, roughness: 0.55, emissive: 0xea580c, emissiveIntensity: 0.55, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 7; i++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), petalMat);
          const a = i * 1.1; // the spiral
          petal.position.set(Math.cos(a) * 0.1, 0.1 + i * 0.012, Math.sin(a) * 0.1);
          petal.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
          group.add(petal);
        }
        break;
      }

      case 'ember_ivy': {
        // A wall of coals, breathing (slice 12): creeping
        // stems with ember-veined leaves, smoldering slow.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0x7c2d12, roughness: 0.7, emissive: 0xea580c, emissiveIntensity: 0.5, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 3; i++) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), stemMat);
          stem.position.set((i - 1) * 0.12, 0.22, 0);
          stem.rotation.z = (i - 1) * 0.3;
          group.add(stem);
          const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.08, 6), leafMat);
          leaf.position.set((i - 1) * 0.18, 0.42, 0.04);
          group.add(leaf);
        }
        break;
      }

      case 'frost_ivy': {
        // The sister, in the other valley (slice 12): rime-
        // skinned leaves preserving what they touch.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const leafMat = new THREE.MeshStandardMaterial({
          color: 0xbae6fd, roughness: 0.35, transparent: true, opacity: 0.85, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 3; i++) {
          const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.5, 5), stemMat);
          stem.position.set((i - 1) * 0.12, 0.22, 0);
          stem.rotation.z = (i - 1) * 0.3;
          group.add(stem);
          const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.08, 6), leafMat);
          leaf.position.set((i - 1) * 0.18, 0.42, 0.04);
          group.add(leaf);
        }
        break;
      }

      case 'mirror_reed': {
        // Grown in both directions (slice 12): a reed and its
        // downward twin from the waterline, one bloom each.
        const reedMat = new THREE.MeshStandardMaterial({ color: 0x0e7490, roughness: 0.5 });
        const bloomMat = new THREE.MeshStandardMaterial({
          color: 0x7dd3fc, roughness: 0.3, transparent: true, opacity: 0.85,
          emissive: 0x0369a1, emissiveIntensity: 0.5,
        });
        for (const [dx, dz] of [[-0.1, 0], [0.1, 0.06]] as const) {
          const reed = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.8, 6), reedMat);
          reed.position.set(dx, 0.4, dz);
          group.add(reed);
          const down = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.002, 0.5, 6), reedMat);
          down.position.set(dx, -0.22, dz);
          group.add(down);
          const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), bloomMat);
          bloom.position.set(dx, 0.86, dz);
          group.add(bloom);
        }
        break;
      }

      case 'rime_grass': {
        // A down bed that stands up (slice 12): blades with
        // rime feathers — pale plumes that do not rustle.
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.5, side: THREE.DoubleSide });
        for (let i = 0; i < 7; i++) {
          const blade = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.5, 4), bladeMat);
          blade.scale.z = 0.4; // feathered flat
          blade.position.set((i % 3 - 1) * 0.12, 0.25, (Math.floor(i / 3) - 1) * 0.11);
          blade.rotation.z = (i % 3 - 1) * 0.12;
          group.add(blade);
        }
        break;
      }

      case 'fang_fern': {
        // The geysers' schedule, in vegetable form (slice 12):
        // fronds frozen into serrated ice teeth.
        const toothMat = new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.25, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 5; i++) {
          const frond = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.55, 3), toothMat);
          const a = (i / 5) * Math.PI * 2;
          frond.position.set(Math.cos(a) * 0.13, 0.26, Math.sin(a) * 0.13);
          frond.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
          group.add(frond);
        }
        break;
      }

      case 'mirror_cap': {
        // A sky, half a second late (slice 12): a cap whose
        // top is a dark mirror disc.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.8 }));
        stem.position.y = 0.11;
        group.add(stem);
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.2, 0.05, 14), new THREE.MeshStandardMaterial({
          color: 0x1e293b, roughness: 0.05, metalness: 0.85,
          emissive: 0x334155, emissiveIntensity: 0.4,
        }));
        cap.position.y = 0.25;
        group.add(cap);
        break;
      }

      case 'meltcap': {
        // Proud at midnight (slice 14): a pale cap on a stalk,
        // drawn at its moment.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.35, 8), new THREE.MeshStandardMaterial({ color: 0xf5f3ff, roughness: 0.8 }));
        stalk.position.y = 0.17;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0xe9d5ff, roughness: 0.5, emissive: 0xa855f7, emissiveIntensity: 0.3,
        }));
        cap.position.y = 0.34;
        group.add(cap);
        break;
      }

      case 'poolcap': {
        // One slow sailing (slice 14): a raft — a flat disc of
        // small sail-backed caps.
        const raftMat = new THREE.MeshStandardMaterial({ color: 0x065f46, roughness: 0.9 });
        const raft = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.36, 0.04, 12), raftMat);
        raft.position.y = 0.03;
        group.add(raft);
        const capMat = new THREE.MeshStandardMaterial({ color: 0x6ee7b7, roughness: 0.7 });
        for (let i = 0; i < 5; i++) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
          cap.position.set((i % 3 - 1) * 0.16, 0.06, (Math.floor(i / 3) - 0.5) * 0.18);
          group.add(cap);
        }
        break;
      }

      case 'saltcap': {
        // Masonry by mushroom (slice 14): a living heart under
        // a rind of glass — a crystalline dome over a warm core.
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.7 }));
        heart.position.y = 0.1;
        group.add(heart);
        const rind = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.15, transparent: true, opacity: 0.75,
          emissive: 0x155e75, emissiveIntensity: 0.35,
        }));
        rind.position.y = 0.1;
        group.add(rind);
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.12, 8), new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.8 }));
        stalk.position.y = 0.05;
        group.add(stalk);
        break;
      }

      case 'tomb_cap': {
        // The pantry's guard (slice 14): a squat, pale,
        // dust-fed cap.
        const capMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, roughness: 0.95 });
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.18, 8), capMat);
        stalk.position.y = 0.09;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
        cap.scale.y = 0.75;
        cap.position.y = 0.17;
        group.add(cap);
        break;
      }

      case 'ring_cap': {
        // The ring is the yield (slice 14): small caps in a
        // CIRCLE — the colony drawn at its honest geometry.
        const capMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, roughness: 0.8 });
        const stalkMat = new THREE.MeshStandardMaterial({ color: 0xf0fdf4, roughness: 0.85 });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.12, 5), stalkMat);
          stalk.position.set(Math.cos(a) * 0.3, 0.06, Math.sin(a) * 0.3);
          group.add(stalk);
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 5, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
          cap.position.set(Math.cos(a) * 0.3, 0.12, Math.sin(a) * 0.3);
          group.add(cap);
        }
        break;
      }

      case 'veil_cap': {
        // Filter-grade (slice 14): a cap with its silk veil
        // hanging — a pale skirt under the dome.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.3, 8), new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.85 }));
        stalk.position.y = 0.15;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.7 }));
        cap.position.y = 0.29;
        group.add(cap);
        const veil = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.16, 0.1, 10, 1, true), new THREE.MeshStandardMaterial({
          color: 0xf1f5f9, roughness: 0.4, transparent: true, opacity: 0.65, side: THREE.DoubleSide,
        }));
        veil.position.y = 0.24;
        group.add(veil);
        break;
      }

      case 'glass_cap': {
        // It stores the noon (slice 14): a translucent cap
        // grown through with glass, glowing from inside.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.25, 8), new THREE.MeshStandardMaterial({
          color: 0xcffafe, roughness: 0.3, transparent: true, opacity: 0.8,
        }));
        stalk.position.y = 0.12;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0x67e8f9, roughness: 0.12, transparent: true, opacity: 0.8,
          emissive: 0x0e7490, emissiveIntensity: 0.6,
        }));
        cap.position.y = 0.24;
        group.add(cap);
        break;
      }

      case 'heart_shelf': {
        // The sloth's staircase (slice 14): great woody
        // brackets stacked up a stand-in trunk.
        const shelfMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.95 });
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.0, 8), materials.woodRoot);
        trunk.position.y = 0.5;
        group.add(trunk);
        for (let i = 0; i < 3; i++) {
          const shelf = new THREE.Mesh(new THREE.CylinderGeometry(0.22 - i * 0.03, 0.24 - i * 0.03, 0.05, 10), shelfMat);
          shelf.position.set(0.12 - i * 0.05, 0.35 + i * 0.28, (i % 2) * 0.1 - 0.05);
          group.add(shelf);
        }
        break;
      }

      case 'bone_puff': {
        // White on white (slice 14): a round pale puffball —
        // the country's own moon, at ankle height.
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf5f5f4, roughness: 0.95 }));
        puff.position.y = 0.13;
        group.add(puff);
        const puff2 = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), puff.material as THREE.Material);
        puff2.position.set(0.18, 0.08, 0.08);
        group.add(puff2);
        break;
      }

      case 'wind_puff': {
        // The broadcast, waiting on weather (slice 14): a
        // puffball drawn tight, unpuffed.
        const puff = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 }));
        puff.scale.y = 0.9;
        puff.position.y = 0.12;
        group.add(puff);
        const seam = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.012, 5, 12), new THREE.MeshStandardMaterial({ color: 0xa8a29e, roughness: 0.9 }));
        seam.position.y = 0.16;
        seam.rotation.x = Math.PI / 2;
        group.add(seam);
        break;
      }

      case 'door_cap': {
        // The register, in fungus (slice 14): a small cap on a
        // doorframe post — drawn with its post, as found.
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.7, 0.07), materials.woodRoot);
        post.position.y = 0.35;
        group.add(post);
        const capMat = new THREE.MeshStandardMaterial({ color: 0xa3e635, roughness: 0.8 });
        for (const y of [0.45, 0.6]) {
          const cap = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), capMat);
          cap.position.set(0.06, y, 0);
          cap.rotation.z = -0.5;
          group.add(cap);
        }
        break;
      }

      case 'glyph_cap': {
        // Writing in gills (slice 14): a cap drawn from below
        // its moment — pale dome, scripted underside.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0xd9f99d, roughness: 0.85 }));
        stalk.position.y = 0.11;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.75 }));
        cap.position.y = 0.21;
        group.add(cap);
        const gills = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.02, 10), new THREE.MeshStandardMaterial({
          color: 0xa3e635, emissive: 0x4d7c0f, emissiveIntensity: 0.5, roughness: 0.6,
        }));
        gills.position.y = 0.21;
        group.add(gills);
        break;
      }

      case 'canopy_cup': {
        // A pond in the sky (slice 16): a branch and a broad
        // living bowl, drawn full.
        const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.8, 6), materials.woodRoot);
        branch.rotation.z = Math.PI / 2 - 0.25;
        branch.position.y = 0.35;
        group.add(branch);
        const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, Math.PI / 2.4, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.8, side: THREE.DoubleSide }));
        bowl.position.y = 0.62;
        group.add(bowl);
        const water = new THREE.Mesh(new THREE.CircleGeometry(0.27, 12), new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.1, transparent: true, opacity: 0.85 }));
        water.rotation.x = -Math.PI / 2;
        water.position.y = 0.64;
        group.add(water);
        break;
      }

      case 'banner_vine': {
        // The country's flag, grown (slice 16): a hard anchor
        // and a long streamer given to the wind.
        const anchor = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.7, 6), new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.9 }));
        anchor.position.y = 0.35;
        group.add(anchor);
        const streamer = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.14), new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.85, side: THREE.DoubleSide }));
        streamer.position.set(0.42, 0.62, 0);
        streamer.rotation.z = 0.12; // streaming horizontal
        group.add(streamer);
        break;
      }

      case 'charnel_bloom': {
        // A flower's whole performance (slice 16): corpse-pale
        // petals around a marrow-gold heart.
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.85, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.2, 4), petalMat);
          const a = (i / 6) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.1, 0.16, Math.sin(a) * 0.1);
          petal.rotation.set(Math.sin(a) * 0.55, 0, -Math.cos(a) * 0.55);
          group.add(petal);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xfbbf24, emissive: 0xb45309, emissiveIntensity: 0.5, roughness: 0.5,
        }));
        heart.position.y = 0.14;
        group.add(heart);
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.14, 6), petalMat);
        stalk.position.y = 0.07;
        group.add(stalk);
        break;
      }

      case 'wrongbloom': {
        // Wound the other way (slice 16): eight geometric
        // petals, their spiral read in the arrangement.
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xd8b4fe, roughness: 0.5, side: THREE.DoubleSide });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.2), petalMat);
          petal.position.set(Math.cos(a) * 0.12, 0.14, Math.sin(a) * 0.12);
          petal.rotation.set(0.6, -a, 0.5); // the reversed tilt
          group.add(petal);
        }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xfbbf24, emissive: 0xd97706, emissiveIntensity: 0.6, roughness: 0.4,
        }));
        core.position.y = 0.12;
        group.add(core);
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.12, 6), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.6, metalness: 0.3 }));
        stalk.position.y = 0.06;
        group.add(stalk);
        break;
      }

      case 'tumble_sage': {
        // Rooted, in season (slice 16): a sage ball — a wiry
        // sphere of gray-green twigs.
        const twigMat = new THREE.MeshStandardMaterial({ color: 0xa3a380, roughness: 1 });
        const ball = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), twigMat);
        ball.position.y = 0.26;
        group.add(ball);
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.9 });
        for (let i = 0; i < 5; i++) {
          const a = i * 2.2;
          const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), leafMat);
          leaf.position.set(Math.cos(a) * 0.24, 0.3 + (i % 3) * 0.06, Math.sin(a) * 0.24);
          group.add(leaf);
        }
        break;
      }

      case 'amber_bloom': {
        // Forever at the moment of opening (slice 16): a
        // perfect flower suspended in a translucent amber
        // teardrop.
        const amber = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), new THREE.MeshStandardMaterial({
          color: 0xf59e0b, roughness: 0.2, transparent: true, opacity: 0.6,
          emissive: 0x92400e, emissiveIntensity: 0.3,
        }));
        amber.scale.y = 1.25;
        amber.position.y = 0.28;
        group.add(amber);
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.6 }));
        bloom.position.y = 0.28;
        group.add(bloom);
        break;
      }

      case 'silt_rose': {
        // The marsh's waterworks (slice 16): a mud-rooted rose
        // with a clear ring drawn at its base.
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.95 });
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), bushMat);
        bush.scale.y = 0.75;
        bush.position.y = 0.2;
        group.add(bush);
        const roseMat = new THREE.MeshStandardMaterial({ color: 0x9f7a5a, roughness: 0.7 });
        for (let i = 0; i < 3; i++) {
          const rose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), roseMat);
          const a = i * 2.1;
          rose.position.set(Math.cos(a) * 0.18, 0.32, Math.sin(a) * 0.18);
          group.add(rose);
        }
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.015, 5, 18), new THREE.MeshStandardMaterial({
          color: 0x7dd3fc, roughness: 0.2, transparent: true, opacity: 0.6,
        }));
        ring.rotation.x = Math.PI / 2;
        ring.position.y = 0.03;
        group.add(ring);
        break;
      }

      case 'ghost_orchid': {
        // No green in it at all (slice 16): a pale leafless
        // stem and ghost-white blooms.
        const stemMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.9 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.5, 5), stemMat);
        stem.position.y = 0.25;
        stem.rotation.z = 0.1;
        group.add(stem);
        const bloomMat = new THREE.MeshStandardMaterial({
          color: 0xf8fafc, roughness: 0.5, emissive: 0x94a3b8, emissiveIntensity: 0.3, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 3; i++) {
          const bloom = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.12, 5, 1, true), bloomMat);
          bloom.position.set(0.05 - (i % 2) * 0.09, 0.34 + i * 0.1, 0);
          bloom.rotation.x = Math.PI;
          group.add(bloom);
        }
        break;
      }

      case 'thaw_rose': {
        // The calendar, flowering (slice 16): a rose with
        // crystal-rimmed ice petals over meltwater blue.
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.9 });
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), bushMat);
        bush.scale.y = 0.75;
        bush.position.y = 0.16;
        group.add(bush);
        const petalMat = new THREE.MeshStandardMaterial({
          color: 0xfda4af, roughness: 0.3, transparent: true, opacity: 0.9,
          emissive: 0xbe185d, emissiveIntensity: 0.25,
        });
        for (let i = 0; i < 3; i++) {
          const rose = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), petalMat);
          const a = i * 2.1 + 0.5;
          rose.position.set(Math.cos(a) * 0.14, 0.3, Math.sin(a) * 0.14);
          group.add(rose);
        }
        break;
      }

      case 'dust_rose': {
        // The Graveyard, sweetened (slice 16): a bone-white
        // rose bush in bone-dust soil.
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 });
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), bushMat);
        bush.scale.y = 0.75;
        bush.position.y = 0.2;
        group.add(bush);
        const roseMat = new THREE.MeshStandardMaterial({ color: 0xf5f0e6, roughness: 0.75 });
        for (let i = 0; i < 4; i++) {
          const rose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), roseMat);
          const a = i * 1.7;
          rose.position.set(Math.cos(a) * 0.17, 0.32 + (i % 2) * 0.06, Math.sin(a) * 0.17);
          group.add(rose);
        }
        break;
      }

      case 'obsidian_rose': {
        // The dark entry (slice 16): black, glossy, sharp —
        // petals as glass blades.
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), bushMat);
        bush.scale.y = 0.75;
        bush.position.y = 0.18;
        group.add(bush);
        const petalMat = new THREE.MeshStandardMaterial({ color: 0x0c0a09, roughness: 0.1, metalness: 0.4, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 3), petalMat);
          const a = (i / 5) * Math.PI * 2;
          petal.position.set(Math.cos(a) * 0.13, 0.3, Math.sin(a) * 0.13);
          petal.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
          group.add(petal);
        }
        break;
      }

      case 'hedge_rose': {
        // Planted by walking (slice 16): a hedge-built rose
        // bush with bright hips.
        const bushMat = new THREE.MeshStandardMaterial({ color: 0x166534, roughness: 0.95 });
        const bush = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), bushMat);
        bush.scale.set(1.2, 0.8, 1);
        bush.position.y = 0.26;
        group.add(bush);
        const roseMat = new THREE.MeshStandardMaterial({ color: 0xfb7185, roughness: 0.65 });
        const hipMat = new THREE.MeshStandardMaterial({ color: 0xe11d48, roughness: 0.5 });
        for (let i = 0; i < 3; i++) {
          const rose = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), roseMat);
          const a = i * 2.1;
          rose.position.set(Math.cos(a) * 0.24, 0.36, Math.sin(a) * 0.2);
          group.add(rose);
          const hip = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 6), hipMat);
          hip.position.set(Math.cos(a + 1) * 0.26, 0.24, Math.sin(a + 1) * 0.2);
          group.add(hip);
        }
        break;
      }

      case 'raincatcher': {
        // A citizen of one sky (slice 18): a translucent
        // gas-bag canopy over a soft heart, drawn low and
        // rain-bellied.
        const bag = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), new THREE.MeshStandardMaterial({
          color: 0xbae6fd, roughness: 0.3, transparent: true, opacity: 0.55,
        }));
        bag.scale.y = 0.8;
        bag.position.y = 0.55;
        group.add(bag);
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), new THREE.MeshStandardMaterial({
          color: 0x7dd3fc, roughness: 0.4, emissive: 0x0369a1, emissiveIntensity: 0.3,
        }));
        heart.position.y = 0.3;
        group.add(heart);
        break;
      }

      case 'tending_vine': {
        // Tool-tipped (slice 18): a patient vine with shaped
        // ends — a pruner, a probe, a small lamp.
        const vineMat = new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.5, metalness: 0.4 });
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.5, 6), vineMat);
        stalk.position.y = 0.25;
        stalk.rotation.z = 0.15;
        group.add(stalk);
        const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xfde68a, emissive: 0xf59e0b, emissiveIntensity: 1.0, roughness: 0.3,
        }));
        lamp.position.set(0.12, 0.52, 0);
        group.add(lamp);
        const pruner = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 4), vineMat);
        pruner.position.set(-0.08, 0.45, 0.05);
        pruner.rotation.z = 0.8;
        group.add(pruner);
        break;
      }

      case 'hearthroot': {
        // The valley's hello (slice 18): reaching roots and a
        // warm bloom leaning toward the path.
        const rootMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.9 });
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1;
          const root = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.4, 5), rootMat);
          root.position.set(Math.cos(a) * 0.18, 0.03, Math.sin(a) * 0.18);
          root.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
          group.add(root);
        }
        const bloom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xfb923c, roughness: 0.6, emissive: 0x9a3412, emissiveIntensity: 0.35,
        }));
        bloom.position.set(0.06, 0.22, 0);
        group.add(bloom);
        break;
      }

      case 'puffbell': {
        // The hour, kept (slice 18): a spore-laden bell on a
        // stalk, drawn mid-swelling.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.85 }));
        stalk.position.y = 0.15;
        group.add(stalk);
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 1.6), new THREE.MeshStandardMaterial({
          color: 0xd8b4fe, roughness: 0.7, side: THREE.DoubleSide,
          emissive: 0x7e22ce, emissiveIntensity: 0.25,
        }));
        bell.position.y = 0.36;
        bell.rotation.x = Math.PI;
        group.add(bell);
        break;
      }

      case 'arch_tree': {
        // A door that grew (slice 18): two trunk halves trained
        // into an arch, canopy braided overhead.
        const trunkMat = materials.woodRoot;
        for (const side of [-1, 1]) {
          const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.9, 7), trunkMat);
          trunk.position.set(side * 0.32, 0.45, 0);
          trunk.rotation.z = side * -0.35;
          group.add(trunk);
        }
        const crown = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.07, 6, 12, Math.PI), trunkMat);
        crown.position.y = 0.88;
        group.add(crown);
        const canopy = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.95 }));
        canopy.scale.y = 0.6;
        canopy.position.y = 1.05;
        group.add(canopy);
        break;
      }

      case 'smoke_tree': {
        // Fire in its joints (slice 18): a dark trunk with
        // ember seams and a canopy of its own smoke.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.15, 0.8, 7), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 }));
        trunk.position.y = 0.4;
        group.add(trunk);
        const seam = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.12, 0.3, 7), new THREE.MeshStandardMaterial({
          color: 0xea580c, emissive: 0xea580c, emissiveIntensity: 0.9, roughness: 0.6,
        }));
        seam.position.y = 0.35;
        group.add(seam);
        const smoke = new THREE.Mesh(new THREE.SphereGeometry(0.38, 10, 8), new THREE.MeshStandardMaterial({
          color: 0x57534e, roughness: 1, transparent: true, opacity: 0.5,
        }));
        smoke.scale.y = 0.65;
        smoke.position.y = 0.95;
        group.add(smoke);
        break;
      }

      case 'lightcreep': {
        // A floor, slowly re-decided (slice 18): a light-clear
        // sheet with a brighter leading edge.
        const sheet = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshStandardMaterial({
          color: 0xa3e635, roughness: 0.3, transparent: true, opacity: 0.55,
          emissive: 0x3f6212, emissiveIntensity: 0.4,
        }));
        sheet.rotation.x = -Math.PI / 2;
        sheet.position.y = 0.02;
        sheet.scale.set(1.3, 1, 1);
        group.add(sheet);
        const edge = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({
          color: 0xd9f99d, emissive: 0x65a30d, emissiveIntensity: 0.7, roughness: 0.4,
        }));
        edge.scale.y = 0.4;
        edge.position.set(0.36, 0.03, 0);
        group.add(edge);
        break;
      }

      case 'zot_star': {
        // The flats' archive (slice 18): a radial star of
        // crystal petals around a strike-glass heart.
        const petalMat = new THREE.MeshStandardMaterial({
          color: 0xfde047, roughness: 0.2, metalness: 0.3,
          emissive: 0xa16207, emissiveIntensity: 0.4, side: THREE.DoubleSide,
        });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.22, 4), petalMat);
          petal.position.set(Math.cos(a) * 0.13, 0.05, Math.sin(a) * 0.13);
          petal.rotation.set(Math.sin(a) * 1.2, 0, -Math.cos(a) * 1.2);
          group.add(petal);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.15, metalness: 0.5 }));
        heart.position.y = 0.04;
        group.add(heart);
        break;
      }

      case 'grabvine': {
        // Stillness is the tell (slice 18): tendrils crossed at
        // ankle height, perfectly, patiently still.
        const vineMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.85 });
        for (let i = 0; i < 3; i++) {
          const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.6, 5), vineMat);
          tendril.rotation.z = Math.PI / 2;
          tendril.rotation.y = i * 0.6;
          tendril.position.y = 0.08 + i * 0.05;
          group.add(tendril);
        }
        const knot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 6), vineMat);
        knot.position.y = 0.1;
        group.add(knot);
        break;
      }

      case 'maw_bloom': {
        // A smell that doesn't belong is a mouth (slice 18): a
        // throne-scale snap bloom, drawn shut-ish and wrong.
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xbe185d, roughness: 0.6, side: THREE.DoubleSide });
        for (const side of [-1, 1]) {
          const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), petalMat);
          jaw.scale.set(1, 0.5, 1);
          jaw.position.set(side * 0.08, 0.14, 0);
          jaw.rotation.z = side * -0.5;
          group.add(jaw);
        }
        const throat = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshStandardMaterial({ color: 0x500724, roughness: 0.8 }));
        throat.position.y = 0.1;
        group.add(throat);
        break;
      }

      case 'quiver_cap': {
        // Rolling, used without having it (slice 18): a gel
        // cap that quivers — drawn translucent, mid-drip.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 0.2, 6), new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.6, transparent: true, opacity: 0.8 }));
        stalk.position.y = 0.1;
        group.add(stalk);
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({
          color: 0xa5f3fc, roughness: 0.15, transparent: true, opacity: 0.75,
          emissive: 0x155e75, emissiveIntensity: 0.3,
        }));
        cap.position.y = 0.2;
        group.add(cap);
        const bead = new THREE.Mesh(new THREE.SphereGeometry(0.035, 7, 6), cap.material as THREE.Material);
        bead.position.set(0.1, 0.14, 0.05);
        group.add(bead);
        break;
      }

      case 'balloon_vine': {
        // Two kingdoms, one emigration (slice 18): a vine with
        // an inflated cradle-pod ready to lift its cutting.
        const vineMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9 });
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.04, 0.45, 6), vineMat);
        stalk.position.y = 0.22;
        stalk.rotation.z = 0.12;
        group.add(stalk);
        const pod = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 8), new THREE.MeshStandardMaterial({
          color: 0x86efac, roughness: 0.35, transparent: true, opacity: 0.85,
        }));
        pod.scale.y = 1.2;
        pod.position.set(0.1, 0.52, 0);
        group.add(pod);
        break;
      }

      case 'noonflower': {
        // One hour, daily (slice 19): a broad sunflower head on
        // a gear-stemmed stalk.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.5, 6), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.5, metalness: 0.4 }));
        stalk.position.y = 0.25;
        group.add(stalk);
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.04, 12), new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.8 }));
        head.position.y = 0.52;
        group.add(head);
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.6, side: THREE.DoubleSide });
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.11, 4), petalMat);
          petal.position.set(Math.cos(a) * 0.16, 0.52, Math.sin(a) * 0.16);
          petal.rotation.set(Math.sin(a) * 1.4, 0, -Math.cos(a) * 1.4);
          group.add(petal);
        }
        break;
      }

      case 'lambswool': {
        // A map of naps (slice 19): a plush ground mat.
        const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.07, 12), new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 1 }));
        mat.position.y = 0.035;
        group.add(mat);
        const tuftMat = new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 1 });
        for (let i = 0; i < 4; i++) {
          const tuft = new THREE.Mesh(new THREE.SphereGeometry(0.06, 7, 6), tuftMat);
          const a = i * 1.7;
          tuft.position.set(Math.cos(a) * 0.2, 0.09, Math.sin(a) * 0.2);
          group.add(tuft);
        }
        break;
      }

      case 'spore_fern': {
        // Each frond a hanging garden (slice 19): green fronds
        // with a dusty spore-crop on top.
        const frondMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.9, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const frond = new THREE.Mesh(new THREE.PlaneGeometry(0.09, 0.42), frondMat);
          frond.position.set(Math.cos(a) * 0.1, 0.2, Math.sin(a) * 0.1);
          frond.rotation.set(0.5, -a, 0);
          group.add(frond);
        }
        const crop = new THREE.Mesh(new THREE.SphereGeometry(0.05, 7, 6), new THREE.MeshStandardMaterial({ color: 0xd8b4fe, roughness: 0.8 }));
        crop.position.y = 0.3;
        group.add(crop);
        break;
      }

      case 'coalwood': {
        // Pre-burned its whole life (slice 19): a black pillar
        // with a green crown.
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.14, 0.9, 8), new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.95 }));
        trunk.position.y = 0.45;
        group.add(trunk);
        const crown = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), new THREE.MeshStandardMaterial({ color: 0x3f6212, roughness: 0.95 }));
        crown.position.y = 1.0;
        group.add(crown);
        break;
      }

      case 'aurora_vine': {
        // It answers the sky (slice 19): a hanging vine lit in
        // shifting bands.
        const vineMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.55, 5), vineMat);
        stem.position.y = 0.28;
        stem.rotation.z = 0.2;
        group.add(stem);
        const bandCols = [0x6ee7b7, 0x67e8f9, 0xc4b5fd];
        for (let i = 0; i < 3; i++) {
          const band = new THREE.Mesh(new THREE.SphereGeometry(0.045, 7, 6), new THREE.MeshStandardMaterial({
            color: bandCols[i], emissive: bandCols[i], emissiveIntensity: 0.7, roughness: 0.4,
          }));
          band.position.set(0.05 + i * 0.02, 0.2 + i * 0.14, 0);
          group.add(band);
        }
        break;
      }

      case 'bridge_moss': {
        // You do not strip a bridge (slice 19): a gripping
        // carpet patch, drawn as a walkable green pad.
        const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.4, 0.05, 12), new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 1 }));
        pad.position.y = 0.025;
        group.add(pad);
        break;
      }

      case 'canopy_orchid': {
        // High news, fallen (slice 19): a bright orchid bloom
        // on a slender epiphyte stem.
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.4, 5), new THREE.MeshStandardMaterial({ color: 0x86efac, roughness: 0.8 }));
        stem.position.y = 0.2;
        group.add(stem);
        const bloomMat = new THREE.MeshStandardMaterial({ color: 0xf0abfc, roughness: 0.5, side: THREE.DoubleSide });
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), bloomMat);
          petal.position.set(Math.cos(a) * 0.07, 0.42, Math.sin(a) * 0.07);
          petal.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
          group.add(petal);
        }
        break;
      }

      case 'rib_grass': {
        // Green stitching (slice 19): grass blades in a long
        // rooting line.
        const bladeMat = new THREE.MeshStandardMaterial({ color: 0xa3a380, roughness: 0.9, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
          const blade = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.3), bladeMat);
          blade.position.set(-0.25 + i * 0.1, 0.15, 0);
          blade.rotation.z = (i % 3 - 1) * 0.2;
          group.add(blade);
        }
        const head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 5), new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.8 }));
        head.position.set(0.15, 0.34, 0);
        group.add(head);
        break;
      }

      case 'kite_flower': {
        // Its children leave by air (slice 19): a tall flower
        // with a winged seed-kite ready on the stem.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.55, 6), new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.9 }));
        stalk.position.y = 0.27;
        group.add(stalk);
        const bud = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), new THREE.MeshStandardMaterial({ color: 0x7dd3fc, roughness: 0.6 }));
        bud.scale.y = 1.3;
        bud.position.y = 0.58;
        group.add(bud);
        const kite = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshStandardMaterial({ color: 0xbae6fd, roughness: 0.7, side: THREE.DoubleSide, transparent: true, opacity: 0.8 }));
        kite.position.set(0.12, 0.45, 0);
        kite.rotation.z = 0.5;
        group.add(kite);
        break;
      }

      case 'guest_flower': {
        // The valley's manners (slice 19): a low wide bloom,
        // drawn open — someone is approaching.
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xfda4af, roughness: 0.6, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.CircleGeometry(0.07, 6), petalMat);
          petal.position.set(Math.cos(a) * 0.09, 0.08, Math.sin(a) * 0.09);
          petal.rotation.x = -Math.PI / 2 + 0.4;
          petal.rotation.z = -a;
          group.add(petal);
        }
        const heart = new THREE.Mesh(new THREE.SphereGeometry(0.04, 7, 6), new THREE.MeshStandardMaterial({ color: 0xfde68a, roughness: 0.6 }));
        heart.position.y = 0.08;
        group.add(heart);
        break;
      }

      case 'clock_bloom': {
        // Planted as clocks (slice 19): a bred bed-flower whose
        // petal color states the hour.
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.3, 6), new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.5, metalness: 0.3 }));
        stalk.position.y = 0.15;
        group.add(stalk);
        const petalMat = new THREE.MeshStandardMaterial({ color: 0xc4b5fd, roughness: 0.5, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const petal = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.11, 4), petalMat);
          petal.position.set(Math.cos(a) * 0.08, 0.32, Math.sin(a) * 0.08);
          petal.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6);
          group.add(petal);
        }
        break;
      }

      case 'roadweed': {
        // It flowers in footprints (slice 19): a flat
        // trample-proof rosette.
        const leafMat = new THREE.MeshStandardMaterial({ color: 0x65a30d, roughness: 0.95, side: THREE.DoubleSide });
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.07, 6), leafMat);
          leaf.position.set(Math.cos(a) * 0.08, 0.03, Math.sin(a) * 0.08);
          leaf.rotation.x = -Math.PI / 2 + 0.25;
          group.add(leaf);
        }
        const flower = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 5), new THREE.MeshStandardMaterial({ color: 0xfef9c3, roughness: 0.7 }));
        flower.position.y = 0.06;
        group.add(flower);
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

export function updateFloraMeshImpl(mesh: THREE.Group, flora: FloraEntity): void {
    mesh.position.set(flora.x, 0, flora.z);
    mesh.userData.entity = flora;
    const baseScale = flora.scale * (0.45 + flora.growthStage * 0.14);
    mesh.scale.set(baseScale, baseScale, baseScale);

    const petalHub = mesh.getObjectByName('petalHub');
    if (petalHub) {
      petalHub.rotation.y += 0.03;
    }
  }
