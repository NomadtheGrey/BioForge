// ============================================================================
// structureBuilders.ts — how every structure TYPE looks in the world
// ============================================================================
//
// Extracted from threeEngine.ts (2026-10-14, Adam's refactor call):
// the engine file had grown to the whole-file push channel's size
// ceiling, and the builders are its biggest self-contained block.
// This module is a pure factory — give it the engine's shared
// materials and it returns the type -> builder record the engine's
// sync/ghost code consumes. No behavior lives here beyond "what a
// thing of this type looks like"; placement, collision, and lights
// stay with the engine and the game data.
//
// Builders share the engine's materials (never disposed with a
// mesh — the engine owns their lifetime) and otherwise allocate
// fresh geometries/materials per build, which the engine's mesh
// disposal expects.
// ============================================================================

import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { StructureType, StructureEntity } from '../types/game';
import { hashId, mulberry32 } from './lifePulse';
import { rootGrainTexture, barkTexture, wovenTexture, jitterVertices } from './grownTextures';

/** The engine's shared material palette, as the builders use it. */
export interface StructureMaterials {
  porcelainWhite: THREE.MeshStandardMaterial;
  chitinGlass: THREE.MeshPhysicalMaterial;
  biolumCyan: THREE.MeshStandardMaterial;
  biolumAmber: THREE.MeshStandardMaterial;
  biolumPink: THREE.MeshStandardMaterial;
  biolumViolet: THREE.MeshStandardMaterial;
  woodRoot: THREE.MeshStandardMaterial;
  ghostValid: THREE.MeshBasicMaterial;
  ghostInvalid: THREE.MeshBasicMaterial;
}

/** Build the structure-type -> mesh-builder record for an engine.
 * Builders may read the entity (its id seeds per-instance variation);
 * ghosts call with no entity and get the generic seed. */
export function createStructureBuilders(materials: StructureMaterials): Record<StructureType, (entity?: StructureEntity) => THREE.Group> {
  return {
    // The Grown Look pass (Adam, 2026-10-17): the root floor finally
    // reads as roots. The slab wears the root-grain texture with
    // jittered edges, and raised root ridges cross it and spill over
    // the sides, knotting where they meet — a floor that grew together
    // rather than one that was laid.
    'root_tile_floor': (entity) => {
      const group = new THREE.Group();
      const floorGeom = new THREE.BoxGeometry(2, 0.12, 2);
      jitterVertices(floorGeom, 0.008, hashId(entity?.id ?? 'ghost-floor'));
      const floor = new THREE.Mesh(
        floorGeom,
        new THREE.MeshStandardMaterial({ map: rootGrainTexture(1), roughness: 0.92 }),
      );
      floor.position.y = 0.06;
      floor.receiveShadow = true;
      group.add(floor);
      // Raised ridges: half-round roots running across the slab and
      // drooping over its edges. Seeded per structure so no two floors
      // knot the same way.
      const rng = mulberry32(hashId(entity?.id ?? 'ghost-floor'));
      const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x4a3320, roughness: 0.85 });
      const ridge = (a: number, b: number): void => {
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(-1.16, 0.10 + rng() * 0.04, a),
          new THREE.Vector3(-0.45, 0.16 + rng() * 0.03, a * 0.5 + (rng() - 0.5) * 0.2),
          new THREE.Vector3(0.45, 0.15 + rng() * 0.03, b * 0.5 + (rng() - 0.5) * 0.2),
          new THREE.Vector3(1.16, 0.07 + rng() * 0.04, b),
        ]);
        const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.045, 6), ridgeMat);
        tube.castShadow = true;
        group.add(tube);
      };
      ridge(-0.38 + (rng() - 0.5) * 0.1, 0.30 + (rng() - 0.5) * 0.1);
      ridge(0.05 + (rng() - 0.5) * 0.1, -0.42 + (rng() - 0.5) * 0.1);
      ridge(0.62 + (rng() - 0.5) * 0.1, 0.05 + (rng() - 0.5) * 0.1);
      // The knot where the ridges meet: a swollen root knuckle.
      const knot = new THREE.Mesh(new THREE.SphereGeometry(0.095, 10, 8), ridgeMat);
      knot.scale.set(1.25, 0.62, 1);
      knot.position.set((rng() - 0.5) * 0.2, 0.15, (rng() - 0.5) * 0.2);
      knot.castShadow = true;
      group.add(knot);
      return group;
    },
    // The Heart Tile (Adam, 2026-10-16; Grown Look, 2026-10-17): the
    // spawn base's default respawn point — a root floor grown with a
    // heart of its own. Adam's call: it must actually HAVE a heart,
    // and it must BEAT. Two-lobed organ (welded spheres + tapered
    // cone) nestled half-sunk at the tile's center, root-spoke
    // vessels radiating across the slab, a faint rose halo beneath.
    // The 'heartOrgan' named part is driven by structureLife's heart
    // pass on the shared double-thump heartbeat, phased per entity.
    'heart_tile': (entity) => {
      const group = new THREE.Group();
      const slabGeom = new THREE.BoxGeometry(2, 0.12, 2);
      jitterVertices(slabGeom, 0.008, hashId(entity?.id ?? 'ghost-heart'));
      const slab = new THREE.Mesh(
        slabGeom,
        new THREE.MeshStandardMaterial({ map: rootGrainTexture(1), roughness: 0.92 }),
      );
      slab.position.y = 0.06;
      slab.receiveShadow = true;
      group.add(slab);
      // The organ: two lobes up top, a point below — welded into one
      // smooth fleshy mass. Seeded asymmetry keeps it from reading
      // sculpted; every heart tile's heart is its own.
      const rng = mulberry32(hashId(entity?.id ?? 'ghost-heart'));
      const lobeL = new THREE.SphereGeometry(0.17, 18, 14);
      lobeL.translate(-0.10 + (rng() - 0.5) * 0.03, 0.16, (rng() - 0.5) * 0.03);
      const lobeR = new THREE.SphereGeometry(0.17, 18, 14);
      lobeR.translate(0.10 + (rng() - 0.5) * 0.03, 0.15, (rng() - 0.5) * 0.03);
      const taper = new THREE.ConeGeometry(0.20, 0.44, 18);
      taper.rotateX(Math.PI); // point down
      taper.translate((rng() - 0.5) * 0.03, -0.03, 0);
      const heartGeom = mergeVertices(mergeGeometries([lobeL, lobeR, taper]), 0.01);
      heartGeom.computeVertexNormals();
      const heartMat = new THREE.MeshStandardMaterial({
        color: 0xb0211f, roughness: 0.26, metalness: 0,
        emissive: 0x7f1d1d, emissiveIntensity: 0.18,
      });
      const heart = new THREE.Mesh(heartGeom, heartMat);
      heart.name = 'heartOrgan';
      heart.scale.set(0.92, 0.92, 0.92);
      heart.position.y = 0.30;
      heart.castShadow = true;
      group.add(heart);
      // Root-spoke vessels: the heart's roots, radiating across the slab.
      const vesselMat = new THREE.MeshStandardMaterial({ color: 0x7f2d24, roughness: 0.6 });
      const spokes = 7;
      for (let i = 0; i < spokes; i++) {
        const a = (i / spokes) * Math.PI * 2 + (rng() - 0.5) * 0.5;
        const mid = a + (rng() - 0.5) * 0.4;
        const curve = new THREE.CatmullRomCurve3([
          new THREE.Vector3(Math.cos(a) * 0.30, 0.13, Math.sin(a) * 0.30),
          new THREE.Vector3(Math.cos(mid) * 0.58, 0.135, Math.sin(mid) * 0.58),
          new THREE.Vector3(Math.cos(a) * 0.94, 0.12, Math.sin(a) * 0.94),
        ]);
        const vessel = new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.02, 5), vesselMat);
        group.add(vessel);
      }
      // The halo: the old ring dimmed to a faint glow beneath the organ.
      const ringMat = new THREE.MeshStandardMaterial({ color: 0x881337, roughness: 0.5, emissive: 0xf43f5e, emissiveIntensity: 0.25 });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.04, 8, 24), ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.125;
      group.add(ring);
      return group;
    },
    'chitin_glass_wall': () => {
      const group = new THREE.Group();
      const postGeom = new THREE.CylinderGeometry(0.12, 0.12, 2.4, 8);
      const leftPost = new THREE.Mesh(postGeom, materials.porcelainWhite);
      leftPost.position.set(-0.95, 1.2, 0);
      const rightPost = leftPost.clone();
      rightPost.position.x = 0.95;
      group.add(leftPost);
      group.add(rightPost);

      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 0.1), materials.chitinGlass);
      pane.position.set(0, 1.2, 0);
      pane.castShadow = true;
      group.add(pane);
      return group;
    },
    // Saltglass pane (Adam, 2026-10-16): the window wall. A root frame
    // (posts, sill, header, and the mullion cross) around a TRUE
    // see-through saltglass sheet — pale milky green, the brine-pan
    // glass of the Saltglass Flats. The pane itself casts no shadow:
    // a window that darkens a room would be a wall with pretensions.
    'saltglass_pane': () => {
      const group = new THREE.Group();
      const postGeom = new THREE.CylinderGeometry(0.1, 0.12, 2.4, 8);
      const leftPost = new THREE.Mesh(postGeom, materials.woodRoot);
      leftPost.position.set(-0.95, 1.2, 0);
      leftPost.castShadow = true;
      const rightPost = leftPost.clone();
      rightPost.position.x = 0.95;
      group.add(leftPost);
      group.add(rightPost);
      const railMat = materials.woodRoot;
      const sill = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.16, 0.12), railMat);
      sill.position.set(0, 0.12, 0);
      sill.castShadow = true;
      group.add(sill);
      const header = sill.clone();
      header.position.y = 2.3;
      group.add(header);
      const mullionV = new THREE.Mesh(new THREE.BoxGeometry(0.07, 2.06, 0.07), railMat);
      mullionV.position.set(0, 1.21, 0);
      group.add(mullionV);
      const mullionH = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.07, 0.07), railMat);
      mullionH.position.set(0, 1.21, 0);
      group.add(mullionH);
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xcff5e1, roughness: 0.12, metalness: 0.0,
        transparent: true, opacity: 0.42,
        emissive: 0x9fd8bb, emissiveIntensity: 0.12,
      });
      const pane = new THREE.Mesh(new THREE.BoxGeometry(1.76, 2.06, 0.04), glassMat);
      pane.position.set(0, 1.21, 0);
      group.add(pane);
      return group;
    },
    // The Hearthpod (Adam, 2026-10-16): a squat grown organ — root
    // feet, a terracotta pod body, and the arum's spathe opening at
    // the top around a core that glows dull amber. The glow is the
    // thermogenic tissue showing through; there is no flame mesh
    // here and there never will be — the pod cannot burn anything.
    'hearthpod': () => {
      const group = new THREE.Group();
      const footGeom = new THREE.CylinderGeometry(0.07, 0.1, 0.3, 7);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const foot = new THREE.Mesh(footGeom, materials.woodRoot);
        foot.position.set(Math.cos(a) * 0.34, 0.13, Math.sin(a) * 0.34);
        foot.rotation.z = Math.cos(a) * 0.35;
        foot.rotation.x = -Math.sin(a) * 0.35;
        foot.castShadow = true;
        group.add(foot);
      }
      const fleshMat = new THREE.MeshStandardMaterial({ color: 0x9a3412, roughness: 0.75 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 14, 10), fleshMat);
      body.scale.set(1, 0.82, 1);
      body.position.y = 0.52;
      body.castShadow = true;
      group.add(body);
      const spatheMat = new THREE.MeshStandardMaterial({ color: 0x7f1d1d, roughness: 0.65, side: THREE.DoubleSide });
      const spathe = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.15, 0.34, 10, 1, true), spatheMat);
      spathe.position.y = 0.94;
      group.add(spathe);
      // The spathe lip: five petal flaps laid open around the mouth.
      const lipGeom = new THREE.SphereGeometry(0.16, 8, 6);
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const lip = new THREE.Mesh(lipGeom, spatheMat);
        lip.scale.set(1, 0.28, 0.62);
        lip.position.set(Math.cos(a) * 0.3, 1.1, Math.sin(a) * 0.3);
        lip.rotation.y = -a;
        lip.rotation.z = Math.cos(a) * 0.7;
        lip.rotation.x = Math.sin(a) * 0.7;
        group.add(lip);
      }
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x78350f, roughness: 0.4, emissive: 0xffb020, emissiveIntensity: 1.1,
      });
      const core = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), coreMat);
      core.position.y = 0.9;
      group.add(core);
      return group;
    },
    // Rootweave wall (Adam, 2026-10-16): the cheap opaque panel —
    // root slats laced over-and-under with fiber withies between
    // two root posts. The slats nearly touch, so the silhouette
    // is solid from both faces; the alternating z of slats and
    // withies is what makes it read as a weave and not a fence
    // of boards. Ladders hang on its edges like any panel.
    'rootweave_wall': () => {
      const group = new THREE.Group();
      const postGeom = new THREE.CylinderGeometry(0.11, 0.13, 2.4, 8);
      const leftPost = new THREE.Mesh(postGeom, materials.woodRoot);
      leftPost.position.set(-0.95, 1.2, 0);
      leftPost.castShadow = true;
      const rightPost = leftPost.clone();
      rightPost.position.x = 0.95;
      group.add(leftPost);
      group.add(rightPost);
      const slatMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.9 });
      const slatGeom = new THREE.BoxGeometry(1.8, 0.19, 0.06);
      for (let i = 0; i < 10; i++) {
        const slat = new THREE.Mesh(slatGeom, slatMat);
        slat.position.set(0, 0.28 + i * 0.205, i % 2 === 0 ? 0.04 : -0.04);
        slat.castShadow = true;
        group.add(slat);
      }
      const withyMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 });
      const withyGeom = new THREE.BoxGeometry(0.09, 2.05, 0.05);
      for (let i = 0; i < 6; i++) {
        const withy = new THREE.Mesh(withyGeom, withyMat);
        withy.position.set(-0.75 + i * 0.3, 1.2, i % 2 === 0 ? -0.055 : 0.055);
        group.add(withy);
      }
      return group;
    },
    // Briar fence (Adam, 2026-10-16): pen panels of uneven briar
    // stakes, thorn-tipped and lashed with withies — grown, never
    // lumber. Heights and leans vary stake to stake on a fixed
    // pattern so a fence line looks cultivated, not stamped.
    'pen_fence': () => {
      const group = new THREE.Group();
      const stakeMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.95 });
      const thornMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.9 });
      const heights = [1.9, 2.2, 1.7, 2.05, 1.8, 2.15, 1.95];
      const leans = [0.03, -0.05, 0.06, -0.02, 0.05, -0.04, 0.02];
      for (let i = 0; i < heights.length; i++) {
        const h = heights[i];
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.075, h, 6), stakeMat);
        stake.position.set(-0.9 + i * 0.3, h / 2, (i % 2 === 0 ? 0.02 : -0.02));
        stake.rotation.z = leans[i];
        stake.castShadow = true;
        group.add(stake);
        const thorn = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 6), thornMat);
        thorn.position.set(-0.9 + i * 0.3 - Math.sin(leans[i]) * h, h + 0.06, stake.position.z);
        group.add(thorn);
      }
      const lashMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 });
      for (const y of [0.55, 1.35]) {
        const lash = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.07, 0.05), lashMat);
        lash.position.set(0, y, 0.055);
        group.add(lash);
        const lashBack = lash.clone();
        lashBack.position.z = -0.055;
        group.add(lashBack);
      }
      return group;
    },
    // Briar gate (Adam, 2026-10-16): a framed briar panel hung on
    // a resin hinge. The moving part lives in the 'gateSwing'
    // group, pivoted at the hinge post — the engine's door pass
    // swings it by doorOpenProgress, the iris mechanism in
    // briar form. It answers to people (proximity), never to
    // the penned.
    'pen_gate': () => {
      const group = new THREE.Group();
      const postMat = materials.woodRoot;
      const postGeom = new THREE.CylinderGeometry(0.1, 0.12, 2.3, 8);
      const hingePost = new THREE.Mesh(postGeom, postMat);
      hingePost.position.set(-0.95, 1.15, 0);
      hingePost.castShadow = true;
      const latchPost = hingePost.clone();
      latchPost.position.x = 0.95;
      group.add(hingePost);
      group.add(latchPost);
      const hingeBandMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.5, emissive: 0x92400e, emissiveIntensity: 0.25 });
      for (const y of [0.5, 1.75]) {
        const band = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.03, 6, 12), hingeBandMat);
        band.rotation.x = Math.PI / 2;
        band.position.set(-0.95, y, 0);
        group.add(band);
      }
      const swing = new THREE.Group();
      swing.name = 'gateSwing';
      swing.position.set(-0.95, 0, 0);
      const stakeMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.95 });
      for (let i = 0; i < 6; i++) {
        const h = 1.75 + (i % 3) * 0.12;
        const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.065, h, 6), stakeMat);
        stake.position.set(0.18 + i * 0.3, h / 2 + 0.08, 0);
        stake.castShadow = true;
        swing.add(stake);
      }
      const braceMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 0.85 });
      for (const y of [0.5, 1.5]) {
        const brace = new THREE.Mesh(new THREE.BoxGeometry(1.72, 0.08, 0.05), braceMat);
        brace.position.set(0.93, y, 0.05);
        swing.add(brace);
        const braceBack = brace.clone();
        braceBack.position.z = -0.05;
        swing.add(braceBack);
      }
      group.add(swing);
      return group;
    },
    // Sample rack (slice D, 2026-10-16): a root frame of specimen
    // shelves — the vat loop's cabinet. Three shelf boards carry
    // a still life of sample vials (the collection's promise, not
    // its contents — pods don't render what they hold either).
    'sample_rack': () => {
      const group = new THREE.Group();
      const frameMat = materials.woodRoot;
      const postGeom = new THREE.BoxGeometry(0.09, 1.7, 0.09);
      for (const sx of [-0.8, 0.8]) {
        for (const sz of [-0.25, 0.25]) {
          const post = new THREE.Mesh(postGeom, frameMat);
          post.position.set(sx, 0.85, sz);
          post.castShadow = true;
          group.add(post);
        }
      }
      const shelfMat = new THREE.MeshStandardMaterial({ color: 0x854d0e, roughness: 0.85 });
      const vialGlass = new THREE.MeshStandardMaterial({
        color: 0x99f6e4,
        roughness: 0.15,
        metalness: 0.1,
        transparent: true,
        opacity: 0.65,
      });
      const vialGlowMats = [0x4ade80, 0xf472b6, 0x67e8f9, 0xfacc15].map(
        (c) =>
          new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.4,
            emissive: c,
            emissiveIntensity: 0.5,
          }),
      );
      const vialGeom = new THREE.CylinderGeometry(0.055, 0.055, 0.24, 8);
      for (let shelf = 0; shelf < 3; shelf++) {
        const y = 0.3 + shelf * 0.55;
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.05, 0.6), shelfMat);
        board.position.set(0, y, 0);
        board.castShadow = true;
        group.add(board);
        for (let i = 0; i < 5; i++) {
          const vial = new THREE.Mesh(vialGeom, vialGlass);
          vial.position.set(-0.6 + i * 0.3, y + 0.15, (i + shelf) % 2 === 0 ? 0.1 : -0.1);
          group.add(vial);
          const fill = new THREE.Mesh(
            new THREE.CylinderGeometry(0.04, 0.04, 0.1, 8),
            vialGlowMats[(i + shelf) % vialGlowMats.length],
          );
          fill.position.set(vial.position.x, y + 0.1, vial.position.z);
          group.add(fill);
        }
      }
      return group;
    },
    // Furniture (slice E, 2026-10-16): the base becomes a home.
    // Root table: four root legs and a slab with a resin inlay.
    'root_table': () => {
      const group = new THREE.Group();
      const legGeom = new THREE.CylinderGeometry(0.06, 0.08, 0.75, 7);
      for (const sx of [-0.7, 0.7]) {
        for (const sz of [-0.4, 0.4]) {
          const leg = new THREE.Mesh(legGeom, materials.woodRoot);
          leg.position.set(sx, 0.375, sz);
          leg.castShadow = true;
          group.add(leg);
        }
      }
      const top = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.09, 1.1), (new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 })));
      top.position.y = 0.79;
      top.castShadow = true;
      group.add(top);
      const inlay = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 0.02, 16),
        new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.35, emissive: 0x92400e, emissiveIntensity: 0.3 }),
      );
      inlay.position.y = 0.845;
      group.add(inlay);
      return group;
    },
    // Root stool: three legs and a polished round seat.
    'root_stool': () => {
      const group = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.45, 6), materials.woodRoot);
        leg.position.set(Math.cos(a) * 0.2, 0.225, Math.sin(a) * 0.2);
        leg.rotation.z = Math.cos(a) * 0.18;
        leg.rotation.x = -Math.sin(a) * 0.18;
        group.add(leg);
      }
      const seat = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.3, 0.07, 14), (new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 })));
      seat.position.y = 0.48;
      seat.castShadow = true;
      group.add(seat);
      return group;
    },
    // Woven rug: a thick flat weave with a border and fringe.
    // It lies at the floor's own height; the placement datum
    // puts it on whatever surface carries the cell.
    // Woven rug (Grown Look, 2026-10-17): the flat green slab gets
    // the woven-fiber texture — an over-under checker in fiber
    // tones — and a whispered jitter so its edges aren't cut lines.
    'woven_rug': (entity) => {
      const group = new THREE.Group();
      const bodyGeom = new THREE.BoxGeometry(1.8, 0.035, 1.8);
      jitterVertices(bodyGeom, 0.010, hashId(entity?.id ?? 'ghost-rug'));
      const body = new THREE.Mesh(
        bodyGeom,
        new THREE.MeshStandardMaterial({ map: wovenTexture(3), roughness: 1 }),
      );
      body.position.y = 0.02;
      group.add(body);
      const borderMat = new THREE.MeshStandardMaterial({ color: 0xa16207, roughness: 1 });
      for (const sz of [-0.82, 0.82]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.04, 0.12), borderMat);
        strip.position.set(0, 0.022, sz);
        group.add(strip);
      }
      for (const sx of [-0.82, 0.82]) {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, 1.44), borderMat);
        strip.position.set(sx, 0.022, 0);
        group.add(strip);
      }
      const fringeMat = new THREE.MeshStandardMaterial({ color: 0xd9f99d, roughness: 1 });
      for (let i = 0; i < 7; i++) {
        for (const sz of [-0.95, 0.95]) {
          const f = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.015, 0.12), fringeMat);
          f.position.set(-0.75 + i * 0.25, 0.012, sz);
          group.add(f);
        }
      }
      return group;
    },
    // Root shelf: a standing frame with three boards and the
    // small silhouettes of kept things.
    'root_shelf': () => {
      const group = new THREE.Group();
      const sideGeom = new THREE.BoxGeometry(0.08, 1.8, 0.5);
      for (const sx of [-0.75, 0.75]) {
        const side = new THREE.Mesh(sideGeom, materials.woodRoot);
        side.position.set(sx, 0.9, 0);
        side.castShadow = true;
        group.add(side);
      }
      const boardMat = (new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 }));
      const potMat = new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.7 });
      const jarMat = new THREE.MeshStandardMaterial({ color: 0x67e8f9, roughness: 0.3, emissive: 0x155e75, emissiveIntensity: 0.4 });
      for (let i = 0; i < 3; i++) {
        const y = 0.25 + i * 0.6;
        const board = new THREE.Mesh(new THREE.BoxGeometry(1.58, 0.06, 0.5), boardMat);
        board.position.y = y;
        group.add(board);
        const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.07, 0.16, 8), i % 2 === 0 ? potMat : jarMat);
        pot.position.set(-0.45 + i * 0.4, y + 0.11, 0);
        group.add(pot);
      }
      return group;
    },
    // Root bed: a root frame, a petal-soft mattress, a pillow.
    // Furniture only (Adam): the Heart Tile owns respawning.
    'root_bed': () => {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.22, 2.0), materials.woodRoot);
      frame.position.y = 0.18;
      frame.castShadow = true;
      group.add(frame);
      const mattress = new THREE.Mesh(
        new THREE.BoxGeometry(0.95, 0.14, 1.9),
        new THREE.MeshStandardMaterial({ color: 0xfbcfe8, roughness: 0.95 }),
      );
      mattress.position.y = 0.36;
      group.add(mattress);
      const pillow = new THREE.Mesh(
        new THREE.BoxGeometry(0.6, 0.1, 0.35),
        new THREE.MeshStandardMaterial({ color: 0xfdf4ff, roughness: 1 }),
      );
      pillow.position.set(0, 0.44, -0.7);
      group.add(pillow);
      const postGeom = new THREE.CylinderGeometry(0.05, 0.06, 0.7, 7);
      for (const sx of [-0.48, 0.48]) {
        const post = new THREE.Mesh(postGeom, materials.woodRoot);
        post.position.set(sx, 0.45, -0.95);
        group.add(post);
      }
      const headSlat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.09, 0.05), (new THREE.MeshStandardMaterial({ color: 0x5b3a1e, roughness: 0.9 })));
      headSlat.position.set(0, 0.72, -0.95);
      group.add(headSlat);
      return group;
    },
    // Vine ladder: two springy rails + rungs, standing in the wall's
    // plane so it reads from either face. One segment spans one story.
    'vine_ladder': () => {
      const group = new THREE.Group();
      const railMat = new THREE.MeshStandardMaterial({ color: 0x4d7c0f, roughness: 0.85 });
      const rungMat = new THREE.MeshStandardMaterial({ color: 0x84cc16, roughness: 0.7, emissive: 0x3f6212, emissiveIntensity: 0.35 });
      const railGeom = new THREE.BoxGeometry(0.07, 2.4, 0.07);
      const leftRail = new THREE.Mesh(railGeom, railMat);
      leftRail.position.set(-0.7, 1.2, 0);
      const rightRail = leftRail.clone();
      rightRail.position.x = 0.7;
      group.add(leftRail);
      group.add(rightRail);
      const rungGeom = new THREE.CylinderGeometry(0.03, 0.03, 1.4, 6);
      for (let i = 0; i < 6; i++) {
        const rung = new THREE.Mesh(rungGeom, rungMat);
        rung.rotation.z = Math.PI / 2;
        rung.position.set(0, 0.3 + i * 0.36, 0);
        group.add(rung);
      }
      return group;
    },
    // Cave mouth: the registry needs an entry, but a mouth's real look
    // is its per-entity DRESSING (game/caveSurface.ts) — boulders, rock
    // lips, the dark opening — which only the entity knows. This base
    // is just a rocky mound so a mouth never renders as nothing;
    // createStructureMesh layers the dressing on top of it.
    'cave_mouth': () => {
      const group = new THREE.Group();
      const mound = new THREE.Mesh(
        new THREE.DodecahedronGeometry(1.9, 0),
        new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 }),
      );
      mound.position.y = 0.55;
      mound.scale.set(1.25, 0.72, 1.1);
      mound.castShadow = true;
      group.add(mound);
      return group;
    },
    // Ruin landmark: the registry needs an entry, but a ruin's real
    // look is its per-entity DRESSING (game/ruins.ts) — broken pillars
    // and stubs tinted by the world's fate — which only the entity
    // knows. This base is a low stone dais so a landmark never renders
    // as nothing; createStructureMesh layers the dressing on top.
    'ruin_landmark': () => {
      const group = new THREE.Group();
      const dais = new THREE.Mesh(
        new THREE.CylinderGeometry(2.3, 2.6, 0.28, 9),
        new THREE.MeshStandardMaterial({ color: 0x78716c, roughness: 0.95 }),
      );
      dais.position.y = 0.12;
      dais.castShadow = true;
      group.add(dais);
      return group;
    },
    // Tender husk (2026-10-15, Adam's ruling): NOT a machine — a
    // FORGED creature, grown by the precursors for garden work,
    // biggish and long dead. A hollow ribcage of chitin arcs over
    // a spine beam, a cracked skull-dome at the head end, a few
    // ribs broken or fallen. Pale, dry, silent — scenery that was
    // once somebody's workforce.
    'tender_husk': () => {
      const group = new THREE.Group();
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xd6cdb4, roughness: 0.95 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0x8a7f63, roughness: 1 });
      // The spine beam, low and long.
      const spine = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 4.4), darkMat);
      spine.position.y = 1.55; spine.castShadow = true; group.add(spine);
      // Ribs: arcs shrinking toward the tail; two are broken stubs.
      for (let i = 0; i < 6; i++) {
        const t = i / 5;
        const radius = 1.5 - t * 0.55;
        const z = -1.9 + i * 0.72;
        if (i === 2 || i === 4) {
          const stub = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.09, 6, 12, Math.PI * 0.5), boneMat);
          stub.position.set(0.9, 0.4, z); stub.rotation.z = 0.5; stub.rotation.y = Math.PI / 2;
          stub.castShadow = true; group.add(stub);
          continue;
        }
        const rib = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.09, 6, 14, Math.PI), boneMat);
        rib.position.set(0, 0.25, z);
        rib.rotation.y = Math.PI / 2;
        rib.castShadow = true; group.add(rib);
      }
      // The skull-dome at the head end — a cracked hollow shell.
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8, 0, Math.PI * 2, 0, Math.PI * 0.62), boneMat);
      skull.position.set(0, 1.35, 2.35); skull.rotation.x = 0.5; skull.castShadow = true; group.add(skull);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.9), darkMat);
      jaw.position.set(0, 0.55, 2.6); jaw.rotation.x = 0.25; group.add(jaw);
      // Legs: jointed stilts, folded where it died standing.
      for (const sx of [-1, 1]) for (const sz of [-1.3, 1.3]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.06, 1.5, 6), darkMat);
        leg.position.set(sx * 0.75, 0.75, sz); leg.rotation.z = sx * 0.18; leg.castShadow = true; group.add(leg);
      }
      return group;
    },
    // Bone fragment (2026-10-15): a half-buried rib and shards —
    // the small change of Bone country, scattered everywhere.
    'bone_fragment': () => {
      const group = new THREE.Group();
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe2dac6, roughness: 0.95 });
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 6, 12, Math.PI), boneMat);
      rib.position.y = -0.15; rib.rotation.y = Math.PI / 2; rib.castShadow = true; group.add(rib);
      const shard1 = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.14, 0.22), boneMat);
      shard1.position.set(0.5, 0.08, 0.4); shard1.rotation.y = 0.7; group.add(shard1);
      const shard2 = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.12, 0.18), boneMat);
      shard2.position.set(-0.45, 0.06, -0.3); shard2.rotation.y = -0.4; group.add(shard2);
      return group;
    },
    // The Leviathan (2026-10-15): ONE impossible skeleton — the
    // tender husk's visual language at ten times the scale. Ribs
    // seven meters tall you walk UNDER, vertebra discs along a
    // spine line, and a skull like a house at the head.
    'leviathan_ribs': () => {
      const group = new THREE.Group();
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe6dfca, roughness: 0.95 });
      const darkMat = new THREE.MeshStandardMaterial({ color: 0xa3987c, roughness: 1 });
      for (let i = 0; i < 7; i++) {
        const t = i / 6;
        const radius = 5.2 + Math.sin(t * Math.PI) * 2.1;
        const rib = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.32, 7, 16, Math.PI), boneMat);
        rib.position.set(0, -1.6, -9 + i * 3);
        rib.rotation.y = Math.PI / 2;
        rib.castShadow = true; group.add(rib);
        const vert = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.05, 0.7, 10), darkMat);
        vert.position.set(0, 0.1, -9 + i * 3); vert.castShadow = true; group.add(vert);
      }
      const skull = new THREE.Mesh(new THREE.SphereGeometry(2.6, 10, 8), boneMat);
      skull.position.set(0, 1.2, 11.5); skull.scale.set(0.85, 0.75, 1.35); skull.castShadow = true; group.add(skull);
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 4.2), darkMat);
      jaw.position.set(0, 0.25, 12.5); jaw.rotation.x = 0.12; group.add(jaw);
      return group;
    },
    // Fulgurite (2026-10-15): jagged glass fingers — sand fused
    // by a lightning strike, keeping the strike's shape.
    'fulgurite': () => {
      const group = new THREE.Group();
      const glassMat = new THREE.MeshStandardMaterial({ color: 0xf5c35c, roughness: 0.25, emissive: 0xd97706, emissiveIntensity: 0.35 });
      const darkMat2 = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 1 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + 0.4;
        const finger = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.7 + (i % 3) * 0.25, 5), glassMat);
        finger.position.set(Math.cos(a) * 0.28, 0.35, Math.sin(a) * 0.28);
        finger.rotation.set(Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35);
        finger.castShadow = true; group.add(finger);
      }
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.65, 0.14, 8), darkMat2);
      base.position.y = 0.05; group.add(base);
      return group;
    },
    // Petrified giant (2026-10-15): a stone mushroom — thick
    // tapered stem, a wide cracked cap, gill rings underneath.
    // Grey, silent, permanent: the Grove's standing dead.
    'petrified_shroom': () => {
      const group = new THREE.Group();
      const stoneMat = new THREE.MeshStandardMaterial({ color: 0x8f8a94, roughness: 1 });
      const darkStone = new THREE.MeshStandardMaterial({ color: 0x625d6b, roughness: 1 });
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.95, 3.4, 9), stoneMat);
      stem.position.y = 1.7; stem.castShadow = true; group.add(stem);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(1.9, 11, 7, 0, Math.PI * 2, 0, Math.PI * 0.52), stoneMat);
      cap.position.y = 3.35; cap.scale.y = 0.62; cap.castShadow = true; group.add(cap);
      const gills = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 0.16, 11), darkStone);
      gills.position.y = 3.3; group.add(gills);
      const shardA = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.6), darkStone);
      shardA.position.set(1.3, 0.25, 0.7); shardA.rotation.y = 0.6; group.add(shardA);
      return group;
    },
    // The portal home inside an instanced cavern: a standing ring of
    // dark rock and violet light (kin to the iris door's frame, so it
    // reads as "door" at a glance), with a translucent inner disc —
    // the surface, seen from below. Clicking it exits the instance.
    'cave_exit': () => {
      const group = new THREE.Group();
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.14, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9, emissive: 0x7c3aed, emissiveIntensity: 0.55 })
      );
      ring.position.set(0, 1.35, 0);
      ring.castShadow = true;
      group.add(ring);
      const disc = new THREE.Mesh(
        new THREE.CircleGeometry(0.98, 24),
        new THREE.MeshBasicMaterial({ color: 0xa855f7, transparent: true, opacity: 0.32, side: THREE.DoubleSide })
      );
      disc.name = 'caveExitDisc';
      disc.position.set(0, 1.35, 0);
      group.add(disc);
      const base = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.8, 0),
        new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 })
      );
      base.position.y = 0.15;
      base.scale.set(1.3, 0.45, 1.0);
      group.add(base);
      return group;
    },
    // The shaft DOWN to the next depth level (Adam's deeper caves):
    // a rock collar around a black pit, cold violet light breathing
    // up from below. Where the exit portal stands tall ("door"), the
    // descent lies flat ("hole") — the two read oppositely at a
    // glance, which is the point. Clicking it descends.
    'cave_descent': () => {
      const group = new THREE.Group();
      const collar = new THREE.Mesh(
        new THREE.TorusGeometry(1.05, 0.17, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x44403c, roughness: 0.9, emissive: 0x5b21b6, emissiveIntensity: 0.5 })
      );
      collar.rotation.x = Math.PI / 2;
      collar.position.y = 0.1;
      collar.castShadow = true;
      group.add(collar);
      const pit = new THREE.Mesh(
        new THREE.CircleGeometry(1.0, 24),
        new THREE.MeshBasicMaterial({ color: 0x010103 })
      );
      pit.name = 'caveDescentPit';
      pit.rotation.x = -Math.PI / 2;
      pit.position.y = 0.05;
      group.add(pit);
      const breath = new THREE.Mesh(
        new THREE.CircleGeometry(0.62, 24),
        new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.3, side: THREE.DoubleSide })
      );
      breath.name = 'caveDescentGlow';
      breath.rotation.x = -Math.PI / 2;
      breath.position.y = 0.08;
      group.add(breath);
      for (let i = 0; i < 3; i++) {
        const rock = new THREE.Mesh(
          new THREE.DodecahedronGeometry(0.42, 0),
          new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 })
        );
        const a = (i / 3) * Math.PI * 2 + 0.5;
        rock.position.set(Math.cos(a) * 1.3, 0.12, Math.sin(a) * 1.3);
        rock.scale.set(1, 0.6, 1);
        group.add(rock);
      }
      return group;
    },
    // The vine shaft (Adam's deep-cave elevator): an alien vine
    // through a crack in the cavern roof — the hanging doorway
    // (exit stands, descent lies flat, the vine HANGS). Trunk and
    // tendrils rise the full 4.6 m; glow-leaves mark it living.
    'vine_shaft': () => {
      const group = new THREE.Group();
      const barkMat = new THREE.MeshStandardMaterial({ color: 0x365314, roughness: 0.9 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x166534, emissive: 0x34d399, emissiveIntensity: 0.85, roughness: 0.6 });
      // Root collar where the vine meets the cavern floor.
      const collar = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), barkMat);
      collar.position.y = 0.18;
      collar.scale.set(1.25, 0.45, 1.25);
      collar.castShadow = true;
      group.add(collar);
      // The trunk: thick as a mast, climbing to the ceiling crack.
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.26, 4.6, 7), barkMat);
      trunk.position.y = 2.3;
      trunk.rotation.z = 0.03;
      trunk.castShadow = true;
      group.add(trunk);
      // Tendrils spiraling off the trunk — handholds, in fiction.
      for (let i = 0; i < 3; i++) {
        const tendril = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.6, 5), barkMat);
        const a = (i / 3) * Math.PI * 2 + 0.6;
        tendril.position.set(Math.cos(a) * 0.3, 2.5, Math.sin(a) * 0.3);
        tendril.rotation.set(Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35);
        group.add(tendril);
      }
      // Glow-leaves along the upper trunk — the vine's own light.
      for (let i = 0; i < 6; i++) {
        const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.16, 6, 5), leafMat);
        const a = (i / 6) * Math.PI * 2 + 0.3;
        leaf.position.set(Math.cos(a) * 0.34, 3.1 + (i % 3) * 0.55, Math.sin(a) * 0.34);
        leaf.scale.set(1, 0.45, 1.6);
        leaf.rotation.y = -a;
        group.add(leaf);
      }
      // The crack it climbs through: a dark disc on the ceiling.
      const crack = new THREE.Mesh(
        new THREE.CircleGeometry(0.8, 16),
        new THREE.MeshBasicMaterial({ color: 0x010103 })
      );
      crack.name = 'vineShaftCrack';
      crack.rotation.x = Math.PI / 2;
      crack.position.y = 4.58;
      group.add(crack);
      return group;
    },
    // The threshold OUT of a ruin interior: two broken pillars and
    // a tilted lintel — the cave exit's door grammar in precursor
    // stone — with a teal daylight shimmer between them.
    'ruin_exit': () => {
      const group = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.95 });
      const pillarGeom = new THREE.BoxGeometry(0.38, 2.6, 0.38);
      const leftPillar = new THREE.Mesh(pillarGeom, stone);
      leftPillar.position.set(-0.95, 1.3, 0);
      leftPillar.castShadow = true;
      const rightPillar = leftPillar.clone();
      rightPillar.position.x = 0.95;
      rightPillar.scale.y = 0.82; // the right pillar broke shorter
      rightPillar.position.y = 1.07;
      group.add(leftPillar);
      group.add(rightPillar);
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.34, 0.42), stone);
      lintel.position.set(0, 2.62, 0);
      lintel.rotation.z = 0.045; // settled with the centuries
      lintel.castShadow = true;
      group.add(lintel);
      const shimmer = new THREE.Mesh(
        new THREE.PlaneGeometry(1.65, 2.3),
        new THREE.MeshBasicMaterial({ color: 0x2dd4bf, transparent: true, opacity: 0.26, side: THREE.DoubleSide })
      );
      shimmer.name = 'ruinExitShimmer';
      shimmer.position.set(0, 1.2, 0);
      group.add(shimmer);
      const slab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.14, 1.1), stone);
      slab.position.y = 0.07;
      slab.receiveShadow = true;
      group.add(slab);
      return group;
    },
    // A precursor cache: a stone coffer with a cold cyan seam — the
    // seal the precursors trusted to outlast them. Opened with the
    // harvest glove (useToolInteractions resolves its seeded loot).
    'precursor_cache': () => {
      const group = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 });
      const body = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.68, 0.82), stone);
      body.position.y = 0.34;
      body.castShadow = true;
      group.add(body);
      const lid = new THREE.Mesh(new THREE.BoxGeometry(1.28, 0.2, 0.94), stone);
      lid.position.y = 0.76;
      lid.rotation.z = 0.03;
      lid.castShadow = true;
      group.add(lid);
      // The seal seam: a thin emissive line where lid meets body.
      const seam = new THREE.Mesh(
        new THREE.BoxGeometry(1.17, 0.045, 0.84),
        new THREE.MeshStandardMaterial({ color: 0x164e63, emissive: 0x22d3ee, emissiveIntensity: 1.1, roughness: 0.4 })
      );
      seam.position.y = 0.67;
      group.add(seam);
      return group;
    },
    // The artifact heart: the deepest room's prize on its pedestal —
    // a warm rose crystal that still pulses, ringed by shardlets.
    'artifact_heart': () => {
      const group = new THREE.Group();
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.55, 0.75, 0.9, 8),
        new THREE.MeshStandardMaterial({ color: 0x57534e, roughness: 0.95 })
      );
      pedestal.position.y = 0.45;
      pedestal.castShadow = true;
      group.add(pedestal);
      const heart = new THREE.Mesh(
        new THREE.OctahedronGeometry(0.62),
        new THREE.MeshStandardMaterial({ color: 0x881337, emissive: 0xf43f5e, emissiveIntensity: 1.7, roughness: 0.25 })
      );
      heart.name = 'artifactHeartCrystal';
      heart.position.y = 1.55;
      group.add(heart);
      for (let i = 0; i < 3; i++) {
        const shard = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.16),
          new THREE.MeshStandardMaterial({ color: 0x881337, emissive: 0xfb7185, emissiveIntensity: 1.2, roughness: 0.3 })
        );
        const a = (i / 3) * Math.PI * 2 + 0.4;
        shard.position.set(Math.cos(a) * 0.95, 1.25 + (i % 2) * 0.35, Math.sin(a) * 0.95);
        group.add(shard);
      }
      return group;
    },
    // A ruin glyph: a stone tablet on a rubble base, its indigo
    // script-lines still lit. Clicking reads the stone's memory
    // (useToolInteractions serves the fate's lore lines).
    'ruin_glyph': () => {
      const group = new THREE.Group();
      const stone = new THREE.MeshStandardMaterial({ color: 0x605a54, roughness: 0.95 });
      const base = new THREE.Mesh(new THREE.DodecahedronGeometry(0.7, 0), stone);
      base.position.y = 0.16;
      base.scale.set(1.25, 0.5, 1);
      group.add(base);
      const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.95, 1.5, 0.16), stone);
      tablet.position.y = 1.05;
      tablet.rotation.x = -0.1; // leaning back on its base, reading angle
      tablet.castShadow = true;
      group.add(tablet);
      // Script lines: three lit bars of descending length on the face.
      const scriptMat = new THREE.MeshBasicMaterial({ color: 0xa5b4fc });
      [0.34, 0.22, 0.27].forEach((len, i) => {
        const line = new THREE.Mesh(new THREE.BoxGeometry(len * 2, 0.045, 0.02), scriptMat);
        line.position.set(-0.32 + len, 1.42 - i * 0.3, 0.1);
        line.rotation.x = -0.1;
        group.add(line);
      });
      return group;
    },
    'iris_slit_door': () => {
      const group = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.12, 8, 24), materials.porcelainWhite);
      frame.position.set(0, 1.2, 0);
      group.add(frame);

      // Blades lie flat in the frame plane (XY, facing ±Z): rotation.x = 90°
      // turns the cylinder's thin axis (Y) into Z. Left leaf covers the -X
      // half (thetaStart PI), right leaf the +X half (thetaStart 0), so the
      // straight edges meet along x = 0 when closed.
      const irisLeft = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.08, 16, 1, false, Math.PI, Math.PI),
        materials.biolumPink
      );
      irisLeft.name = 'irisLeft';
      irisLeft.rotation.x = Math.PI / 2;
      irisLeft.position.set(0, 1.2, 0);
      group.add(irisLeft);

      const irisRight = new THREE.Mesh(
        new THREE.CylinderGeometry(0.85, 0.85, 0.08, 16, 1, false, 0, Math.PI),
        materials.biolumPink
      );
      irisRight.name = 'irisRight';
      irisRight.rotation.x = Math.PI / 2;
      irisRight.position.set(0, 1.2, 0);
      group.add(irisRight);
      return group;
    },
    'lantern_fern_post': () => {
      const group = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.16, 2.6, 8), materials.woodRoot);
      pole.position.y = 1.3;
      group.add(pole);

      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.38, 16, 16), materials.biolumCyan);
      orb.position.y = 2.7;
      group.add(orb);

      return group;
    },
    'bio_forge_station': () => {
      const group = new THREE.Group();
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.1, 0.6, 16), materials.porcelainWhite);
      base.position.y = 0.3;
      group.add(base);

      const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.35, 1), materials.biolumCyan);
      core.name = 'forgeCore';
      core.position.y = 1.1;
      group.add(core);
      return group;
    },
    'cultivation_mound': () => {
      const group = new THREE.Group();
      const mound = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 1.0, 0.22, 16), materials.woodRoot);
      mound.position.y = 0.11;
      group.add(mound);
      return group;
    },
    // The storage pod (Adam, 2026-10-15): a squat grown bulb with a
    // latched lid — root-wood body, a porcelain rim ring, and an
    // amber glow seam where the lid seals. One mesh serves all
    // three tiers; the tier lives in the entity's storage record
    // and in the pod's panel, not in the silhouette (v1).
    'storage_pod': () => {
      const group = new THREE.Group();

      // Squashed-sphere body, rooted in a low wood collar.
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.86, 0.18, 14), materials.woodRoot);
      collar.position.y = 0.09;
      collar.castShadow = true;
      group.add(collar);

      const body = new THREE.Mesh(new THREE.SphereGeometry(0.68, 18, 14), materials.porcelainWhite);
      body.scale.y = 0.78;
      body.position.y = 0.62;
      body.castShadow = true;
      group.add(body);

      // The lid: a shallow dome cap with an amber seam under it.
      const seam = new THREE.Mesh(new THREE.TorusGeometry(0.52, 0.045, 8, 24), materials.biolumAmber);
      seam.rotation.x = Math.PI / 2;
      seam.position.y = 0.98;
      group.add(seam);

      const lid = new THREE.Mesh(new THREE.SphereGeometry(0.54, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2.4), materials.chitinGlass);
      lid.position.y = 0.97;
      lid.castShadow = true;
      group.add(lid);

      // A little latch nub on the front — the "click me" affordance.
      const latch = new THREE.Mesh(new THREE.OctahedronGeometry(0.09, 0), materials.biolumAmber);
      latch.position.set(0, 0.72, 0.66);
      group.add(latch);

      return group;
    },
    // The BioTunnel mouth (Adam, 2026-10-16; grotesque pass,
    // 2026-10-17): ONE organism with two mouths, and now it reads
    // like one. A ribbed throat of wet flesh on a root mound — but
    // the front is an irregular LIP with bone-pale teeth angled
    // into a dark GULLET, so you can see INTO the thing. The
    // pairing membrane still lives inside the gullet as the named
    // 'tunnelMembrane' child (the engine's pairing tell, stirred by
    // updateTunnelLife exactly as before); the teal glow now burns
    // from within the throat instead of sitting on a drum.
    // Per-mouth variation is seeded from the entity id, so the
    // pair's two mouths are siblings, never twins.
    'biotunnel_mouth': (entity) => {
      const group = new THREE.Group();
      // Seed: the entity id when the engine builds the real mesh,
      // a fixed fallback for ghosts (buildGhostFor passes none).
      const rng = mulberry32(hashId(entity?.id ?? 'ghost-mouth'));
      const base = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.3, 0.22, 20), materials.woodRoot);
      base.position.y = 0.11;
      base.receiveShadow = true;
      group.add(base);
      // Root spurs clawing out of the mound — two or three, seeded.
      const spurGeom = new THREE.ConeGeometry(0.13, 0.5, 7);
      const spurCount = 2 + Math.floor(rng() * 2);
      for (let i = 0; i < spurCount; i++) {
        const a = (i / spurCount) * Math.PI * 2 + rng() * 0.8;
        const spur = new THREE.Mesh(spurGeom, materials.woodRoot);
        spur.position.set(Math.sin(a) * 1.05, 0.14, Math.cos(a) * 1.05);
        spur.rotation.set(Math.cos(a) * 0.9, 0, -Math.sin(a) * 0.9);
        spur.castShadow = true;
        group.add(spur);
      }
      // Wet flesh palette — everything grown here shares it, damp
      // and bruised (Adam: "almost grotesque").
      const fleshMat = new THREE.MeshStandardMaterial({ color: 0x8e2f2f, roughness: 0.32 });
      const lipMat = new THREE.MeshStandardMaterial({ color: 0x6b1f2e, roughness: 0.35 });
      const darkMat = new THREE.MeshStandardMaterial({
        color: 0x2a0d12, roughness: 0.55, side: THREE.DoubleSide,
      });
      const boneMat = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 });
      // The throat ribs: still five full rings, but grown not
      // machined — seeded radii and slight tilts per rib.
      for (let i = 0; i < 5; i++) {
        const ribGeom = new THREE.TorusGeometry(0.82 + rng() * 0.12, 0.09, 10, 24);
        const rib = new THREE.Mesh(ribGeom, fleshMat);
        rib.position.set(0, 1.15, -0.36 + i * 0.18);
        rib.rotation.x = (rng() - 0.5) * 0.12;
        rib.rotation.y = (rng() - 0.5) * 0.12;
        rib.castShadow = true;
        group.add(rib);
      }
      // The gullet: an open dark cone from the lip back into the
      // throat, so the opening has DEPTH. The membrane hangs inside
      // it instead of capping the front.
      const gullet = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.24, 0.54, 14, 1, true), darkMat);
      gullet.position.set(0, 1.15, 0.09);
      group.add(gullet);
      const membraneMat = new THREE.MeshStandardMaterial({
        color: 0x134e4a,
        roughness: 0.35,
        emissive: 0x14b8a6,
        emissiveIntensity: 0,
        transparent: true,
        opacity: 0.92,
        side: THREE.DoubleSide,
      });
      const membrane = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), membraneMat);
      membrane.position.set(0, 1.15, -0.10);
      membrane.name = 'tunnelMembrane';
      group.add(membrane);
      // The lip: an irregular ring of flesh at the front opening.
      // Lumpiness is seeded smooth noise around the circle (not per
      // vertex index, so shared verts displace identically), and it
      // lives in its own group ('tunnelLip') for the life pass's
      // peristaltic ripple.
      const lipGroup = new THREE.Group();
      lipGroup.name = 'tunnelLip';
      const lumpPhase1 = rng() * Math.PI * 2;
      const lumpPhase2 = rng() * Math.PI * 2;
      const lipGeom = new THREE.TorusGeometry(0.78, 0.16, 12, 28);
      {
        const pos = lipGeom.attributes.position as THREE.BufferAttribute;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          const theta = Math.atan2(v.y, v.x);
          const lump = 0.05 * Math.sin(3 * theta + lumpPhase1) + 0.04 * Math.sin(5 * theta + lumpPhase2);
          const radial = 1 + lump / 0.78;
          v.x *= radial;
          v.y *= radial;
          v.z += 0.04 * Math.sin(4 * theta + lumpPhase1);
          pos.setXYZ(i, v.x, v.y, v.z);
        }
        lipGeom.computeVertexNormals();
      }
      const lip = new THREE.Mesh(lipGeom, lipMat);
      lip.position.set(0, 1.15, 0.36);
      lip.castShadow = true;
      lipGroup.add(lip);
      // The teeth: twelve bone cones ringed inside the lip, angled
      // into the gullet, NO two the same length (seeded).
      const throatTarget = new THREE.Vector3(0, 1.15, -0.2);
      for (let i = 0; i < 12; i++) {
        const theta = (i / 12) * Math.PI * 2 + (rng() - 0.5) * 0.35;
        const len = 0.12 + rng() * 0.12;
        const toothGeom = new THREE.ConeGeometry(0.045, len, 6);
        toothGeom.rotateX(Math.PI / 2); // tip points +Z, at the throat
        const tooth = new THREE.Mesh(toothGeom, boneMat);
        tooth.position.set(Math.cos(theta) * 0.60, 1.15 + Math.sin(theta) * 0.60, 0.40);
        tooth.lookAt(throatTarget);
        tooth.castShadow = true;
        lipGroup.add(tooth);
      }
      group.add(lipGroup);
      // The veins (Adam: "nasty gross veins, pulsing"): raised
      // branching tubes crawling over the lip and down the throat —
      // bruise-purple, glossy. Their pulse lives in updateTunnelLife
      // (heartbeat, phased per mouth); here they are just named
      // ('tunnelVeins') so the pass can find them.
      const veinMat = new THREE.MeshStandardMaterial({
        color: 0x4a1540, roughness: 0.25,
        emissive: 0x7d1a4d, emissiveIntensity: 0.08,
      });
      const veins = new THREE.Group();
      veins.name = 'tunnelVeins';
      const veinStems = 5;
      for (let i = 0; i < veinStems; i++) {
        const theta0 = rng() * Math.PI * 2;
        const drift = (rng() - 0.5) * 0.8;
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k < 4; k++) {
          const y = 1.55 - k * 0.38;
          const radius = 0.86 - k * 0.055;
          const theta = theta0 + k * 0.35 * (drift >= 0 ? 1 : -1);
          pts.push(new THREE.Vector3(Math.cos(theta) * radius, y, 0.28 - k * 0.13));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        veins.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.022, 5, false), veinMat));
        // One branch per stem, peeling off at the second point.
        const bpts: THREE.Vector3[] = [pts[1]];
        for (let k = 1; k < 4; k++) {
          const y = pts[1].y - k * 0.22;
          const theta = theta0 + 0.5 + k * 0.3 * (drift >= 0 ? 1 : -1);
          const radius = 0.82 - k * 0.04;
          bpts.push(new THREE.Vector3(Math.cos(theta) * radius, y, 0.20 - k * 0.10));
        }
        const bcurve = new THREE.CatmullRomCurve3(bpts);
        veins.add(new THREE.Mesh(new THREE.TubeGeometry(bcurve, 8, 0.013, 5, false), veinMat));
      }
      group.add(veins);
      return group;
    },
    'culture_vat': (entity) => {
      const group = new THREE.Group();
      // Seed: per-vat variation (the sac's lumps, the vein layout)
      // rides the entity id; ghosts get the generic seed.
      const rng = mulberry32(hashId(entity?.id ?? 'ghost-vat'));

      // The Culture Vat (Adam, 2026-10-15; look spec from the
      // background chat; grotesque pass 2026-10-17): a translucent
      // membrane sac cradled in a resin rib-frame, rooted in a wood
      // collar — grown, never manufactured. Named parts (vatSac /
      // vatCore) are how the engine's per-frame vat-life pass
      // breathes the sac and grows the silhouette inside it; see
      // structureLife.ts. The chitin-glass read stays — the
      // silhouette inside must stay visible.
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.86, 1.02, 0.2, 14), materials.woodRoot);
      collar.position.y = 0.1;
      collar.castShadow = true;
      group.add(collar);

      // A flesh ring where the collar meets the sac — the same wet
      // red as the tunnel mouth's flesh. Accent only, same collar
      // footprint.
      const fleshRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.84, 0.06, 8, 24),
        new THREE.MeshStandardMaterial({ color: 0x8e2f2f, roughness: 0.32 })
      );
      fleshRing.rotation.x = Math.PI / 2;
      fleshRing.position.y = 0.2;
      fleshRing.castShadow = true;
      group.add(fleshRing);

      // Root feet: three short toes gripping the ground.
      const footGeom = new THREE.ConeGeometry(0.16, 0.42, 7);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + 0.5;
        const foot = new THREE.Mesh(footGeom, materials.woodRoot);
        foot.position.set(Math.sin(a) * 0.82, 0.16, Math.cos(a) * 0.82);
        foot.rotation.set(Math.cos(a) * 0.5, 0, -Math.sin(a) * 0.5);
        group.add(foot);
      }

      // The resin ribs: five half-arcs curling up around the sac
      // like fingers. Resin gets a fresh material per build (the
      // shared palette has no resin tone) — tinted bloodward for
      // the grotesque pass.
      const resinMat = new THREE.MeshStandardMaterial({ color: 0x8a3b1f, roughness: 0.55, metalness: 0.05 });
      const ribGeom = new THREE.TorusGeometry(0.8, 0.065, 8, 20, Math.PI);
      for (let i = 0; i < 5; i++) {
        const rib = new THREE.Mesh(ribGeom, resinMat);
        const a = (i / 5) * Math.PI * 2;
        rib.position.y = 0.18;
        rib.rotation.y = a;
        rib.castShadow = true;
        group.add(rib);
      }

      // The membrane sac itself: the shared chitin-glass, tall —
      // but lumpy now, seeded vertex displacement so every vat has
      // its own skin. The displacement is per-BUILD geometry (the
      // material stays shared); the silhouette read is untouched.
      const lumpPhase1 = rng() * Math.PI * 2;
      const lumpPhase2 = rng() * Math.PI * 2;
      const lumpPhase3 = rng() * Math.PI * 2;
      const sacGeom = new THREE.SphereGeometry(0.72, 20, 16);
      {
        const pos = sacGeom.attributes.position as THREE.BufferAttribute;
        const v = new THREE.Vector3();
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i);
          const n = Math.sin(2.1 * v.x + lumpPhase1) * Math.sin(1.7 * v.y + lumpPhase2) * Math.sin(2.3 * v.z + lumpPhase3);
          const s = 1 + 0.045 * n;
          pos.setXYZ(i, v.x * s, v.y * s, v.z * s);
        }
        sacGeom.computeVertexNormals();
      }
      const sac = new THREE.Mesh(sacGeom, materials.chitinGlass);
      sac.name = 'vatSac';
      sac.scale.set(1, 1.12, 1);
      sac.position.y = 0.98;
      sac.castShadow = true;
      group.add(sac);

      // The veins: raised branching tubes hugging the sac's curve
      // (bruise-purple, glossy), named 'vatVeins' for the life
      // pass. Their heartbeat quickens as gestation progresses —
      // the pass reads the same gestation record as the core.
      const veinMat = new THREE.MeshStandardMaterial({
        color: 0x4a1540, roughness: 0.25,
        emissive: 0x7d1a4d, emissiveIntensity: 0.08,
      });
      const veins = new THREE.Group();
      veins.name = 'vatVeins';
      const vatVeinStems = 8;
      for (let i = 0; i < vatVeinStems; i++) {
        const theta0 = (i / vatVeinStems) * Math.PI * 2 + rng() * 0.5;
        const drift = (rng() - 0.5) * 1.2;
        const pts: THREE.Vector3[] = [];
        for (let k = 0; k < 4; k++) {
          const y = 0.35 + k * 0.42;
          const theta = theta0 + k * 0.4 * (drift >= 0 ? 1 : -1);
          pts.push(new THREE.Vector3(Math.cos(theta) * 0.74, y, Math.sin(theta) * 0.74));
        }
        const curve = new THREE.CatmullRomCurve3(pts);
        veins.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 0.018, 5, false), veinMat));
        // One branch per stem, peeling off at the second point.
        const bpts: THREE.Vector3[] = [pts[1]];
        for (let k = 1; k < 3; k++) {
          const y = pts[1].y - k * 0.2;
          const theta = theta0 + 0.6 + k * 0.3 * (drift >= 0 ? 1 : -1);
          bpts.push(new THREE.Vector3(Math.cos(theta) * 0.73, y, Math.sin(theta) * 0.73));
        }
        const bcurve = new THREE.CatmullRomCurve3(bpts);
        veins.add(new THREE.Mesh(new THREE.TubeGeometry(bcurve, 6, 0.011, 5, false), veinMat));
      }
      group.add(veins);

      // The silhouette inside: a curled, dark form that firms up
      // as a gestation progresses. Its material is per-build —
      // the engine's vat-life pass sets its opacity and scale
      // from the entity's gestation record every frame.
      const coreMat = new THREE.MeshStandardMaterial({
        color: 0x2e1065, roughness: 0.4, metalness: 0,
        emissive: 0x0d9488, emissiveIntensity: 0.25, transparent: true, opacity: 0,
      });
      const core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 1), coreMat);
      core.name = 'vatCore';
      core.scale.setScalar(0.001);
      core.position.y = 0.92;
      group.add(core);

      // The crown seam: a biolume iris ring at the sac's top —
      // what opens when the creature hatches.
      const iris = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.045, 8, 22), materials.biolumCyan);
      iris.rotation.x = Math.PI / 2;
      iris.position.y = 1.72;
      group.add(iris);

      return group;
    },
    'tamed_snap_trap_turret': () => {
      const group = new THREE.Group();
      // Pedestal
      const pedestal = new THREE.Mesh(
        new THREE.CylinderGeometry(0.42, 0.58, 0.55, 10),
        materials.woodRoot
      );
      pedestal.position.y = 0.275;
      pedestal.castShadow = true;
      group.add(pedestal);

      // Swivel head (named for future targeting in normal/hostile modes)
      const head = new THREE.Group();
      head.name = 'turretHead';
      head.position.y = 0.85;

      const skull = new THREE.Mesh(
        new THREE.SphereGeometry(0.3, 12, 12),
        materials.porcelainWhite
      );
      skull.castShadow = true;
      head.add(skull);

      // Jaws mirror the wild snap-trap flora so it reads as the same creature
      const jawMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        roughness: 0.35,
        emissive: 0x7f1d1d,
        emissiveIntensity: 0.5,
      });
      const upperJaw = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 6), jawMat);
      upperJaw.rotation.x = Math.PI / 4;
      upperJaw.position.set(0, 0.18, 0.18);
      const lowerJaw = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.5, 6), jawMat);
      lowerJaw.rotation.x = -Math.PI / 4;
      lowerJaw.position.set(0, -0.18, 0.18);
      head.add(upperJaw);
      head.add(lowerJaw);

      group.add(head);
      return group;
    },
    'spore_canopy': () => {
      const group = new THREE.Group();
      // Four corner posts
      const postGeom = new THREE.CylinderGeometry(0.09, 0.12, 2.4, 8);
      const corners: Array<[number, number]> = [[-0.85, -0.85], [0.85, -0.85], [-0.85, 0.85], [0.85, 0.85]];
      corners.forEach(([px, pz]) => {
        const post = new THREE.Mesh(postGeom, materials.woodRoot);
        post.position.set(px, 1.2, pz);
        post.castShadow = true;
        group.add(post);
      });

      // Dome cap
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(1.55, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42),
        materials.biolumViolet
      );
      dome.position.y = 2.1;
      dome.castShadow = true;
      group.add(dome);

      // Dew-collector orb at the apex (emissive only — no new light, protects the light budget)
      const orb = new THREE.Mesh(
        new THREE.SphereGeometry(0.22, 12, 12),
        materials.biolumCyan
      );
      orb.position.y = 3.7;
      group.add(orb);
      return group;
    },
  };
}
