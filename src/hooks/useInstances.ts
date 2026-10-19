/**
 * BioForge Instances Domain Hook (caverns + ruins)
 * Extracted from App.tsx (2026-10-15, the seam-by-seam refactor —
 * seam 2 of 6, a pure move: no behavior changes).
 *
 * Owns the instanced-interior machinery: the InstanceState the
 * player is in (surface / a cavern level / a ruin), the descent
 * stack for deeper caves, per-cave player plantings, and every
 * enter/exit verb. Entering swaps the whole world for the
 * instance's lists and PARKS the surface lists in the instance
 * record; every other system (render sync, saves, the zone router)
 * reads through the parked snapshot while inside.
 *
 * The current lists arrive as dep VALUES (the handlers park them
 * verbatim on entry, exactly as the original closures did); the
 * shared refs arrive structurally.
 */

import { useRef, useState, useCallback } from 'react';
import type { BioForgeThreeEngine } from '../game/engine/threeEngine';
import type { WorldSnapshot } from '../game/saveSystem';
import {
  generateGameCavern, generateGameCavernLevel, cavernCellToWorld, cavernEntryYaw, cavernStratumName,
  type CavernResult,
} from '../game/world/cavern';
import { dealCavernFauna } from '../game/creatures/cavernFauna';
import { generateGameRuin, ruinEntryYaw, ruinCollisionGrid, type RuinResult } from '../game/world/ruinInterior';
import { findClearGround } from '../game/structures/clearGround';
import { FATE_STYLES, type RuinVariantId, type WorldFate } from '../game/world/ruins';
import { zoneCoordsAt, zoneHops, zoneBiomeAt } from '../game/world/zones';
import type { BiomeId } from '../game/world/biomes';
import type { DroppedItemEntity, FaunaEntity, FloraEntity, FloraSpecies, StructureEntity } from '../types/game';
import type { GameNotification } from '../types/game';

export interface InstancesDeps {
  engineRef: { current: BioForgeThreeEngine | null };
  playerPosRef: { current: { x: number; z: number; rotation: number } };
  /** The world seed (App-owned) — caves resolve their surface
   *  biome from it (cave resemblance, 2026-10-15). */
  worldSeedRef: { current: string };
  floraListRef: { current: FloraEntity[] };
  floraList: FloraEntity[];
  faunaList: FaunaEntity[];
  structuresList: StructureEntity[];
  droppedItems: DroppedItemEntity[];
  replaceWorld: (world: WorldSnapshot) => void;
  applyPlayerLevel: (level: number) => void;
  postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
}

export type InstanceState =
  | { kind: 'surface' }
  | {
      kind: 'cavern';
      mouthId: string;
      instanceId: string;
      cavern: CavernResult;
      /** 1-based depth level of `cavern` (Adam's deeper caves). */
      depth: number;
      parked: WorldSnapshot;
    }
  | {
      kind: 'ruin';
      landmarkId: string;
      instanceId: string;
      ruin: RuinResult;
      /** The ruin grid normalized to '.'/'#' for the movement
       *  controller (the result's own grid keeps its richer
       *  alphabet — overgrowth, rubble, markers — for the renderer). */
      collisionGrid: string[];
      parked: WorldSnapshot;
    };

export interface UseInstancesResult {
  instanceRef: { current: InstanceState };
  inCavern: boolean;
  inRuin: boolean;
  cavernDepth: number;
  cavePlantingsRef: { current: Record<string, FloraEntity[]> };
  plantingsKey: (instanceId: string, depth: number) => string;
  captureCavePlantings: (key: string) => void;
  handleEnterCave: (mouth: StructureEntity) => void;
  handleDescendCave: (descent: StructureEntity) => void;
  handleExitCave: () => void;
  handleVineClimb: () => void;
  handleEnterRuin: (landmark: StructureEntity) => void;
  handleExitRuin: () => void;
  resetInstanceState: () => void;
}

export function useInstances(deps: InstancesDeps): UseInstancesResult {
  const {
    engineRef, playerPosRef, worldSeedRef, floraListRef,
    floraList, faunaList, structuresList, droppedItems,
    replaceWorld, applyPlayerLevel, postNotification,
  } = deps;


  // ----------------------------------------------------------------------
  // Instanced caverns (P3 interior)
  // ----------------------------------------------------------------------
  // Entering a cave mouth swaps the whole world for the mouth's
  // generated cavern: the surface lists are PARKED here, the
  // instance's own list (just the exit portal) takes their place, and
  // every system that reads the lists — render sync, the sim tick,
  // saves (via buildWorldSnapshot) — follows along. The cavern is
  // generated from the mouth's instanceId ALONE, so any client
  // holding the mouth entity (guests included, via world_sync)
  // rebuilds the identical cave without ever seeing the world seed.
  const instanceRef = useRef<InstanceState>({ kind: 'surface' });
  const [inCavern, setInCavern] = useState(false);
  const [inRuin, setInRuin] = useState(false);

  // The current depth level as STATE (the ref holds the truth; this
  // mirror exists so the HUD can name the stratum the player is in).
  const [cavernDepth, setCavernDepth] = useState(0);

  interface CaveFrame {
    cavern: CavernResult;
    world: WorldSnapshot;
    shaft: { x: number; z: number };
  }
  const caveStackRef = useRef<CaveFrame[]>([]);

  // Per-cave PLAYER plantings (Adam, 2026-10-14: planted cave plants
  // persist per-cave). Wild instance flora regenerates from the
  // instanceId on every entry — only what the player planted by hand
  // is remembered: captured from the live flora list when leaving a
  // cave (and at save time, for saves taken mid-delve), merged back
  // in on entry, and carried in the save record (saveSystem).
  const cavePlantingsRef = useRef<Record<string, FloraEntity[]>>({});
  // Plantings are remembered PER LEVEL of a cave: depth 1 keeps the
  // original bare-instanceId key (existing saves' gardens carry on
  // untouched); deeper levels suffix their depth.
  const plantingsKey = (instanceId: string, depth: number): string =>
    depth <= 1 ? instanceId : `${instanceId}#${depth}`;
  // How many ZONES (biomes) from spawn a cave mouth sits — the unit
  // this game counts distance in (Adam, 2026-10-14). It feeds the
  // descent roll: the farther out the mouth, the deeper its cave is
  // likelier to go. Derived from the mouth's stored position, so
  // every client holding the mouth computes the same number.
  const mouthHops = (m: StructureEntity): number => {
    const c = zoneCoordsAt(m.worldX, m.worldZ);
    return zoneHops(c.zx, c.zz);
  };
  // The biome of the zone a mouth is dug under (cave resemblance):
  // same derivation as mouthHops, one step further to the family.
  const mouthBiome = (m: StructureEntity): BiomeId => {
    const c = zoneCoordsAt(m.worldX, m.worldZ);
    return zoneBiomeAt(worldSeedRef.current, c.zx, c.zz);
  };
  const captureCavePlantings = useCallback((key: string): void => {
    cavePlantingsRef.current = {
      ...cavePlantingsRef.current,
      [key]: floraListRef.current
        .filter((f) => f.isPlayerPlanted)
        .map((f) => ({ ...f })),
    };
  }, []);

  // Enter one LEVEL of a cavern — the mouth's first level, or a
  // deeper one after a descent: build the level's structures (the
  // way back up, plus the way further down when this level rolled
  // one) and its living flora, swap the world for them, light the
  // engine's cavern, and land the player at the level's entrance.
  // Shared by cave entry and descent so the two can never drift.
  const enterCavernLevel = useCallback(
    (cavern: CavernResult, instanceId: string, depth: number, note: { title: string; body: string }): void => {
      const entry = cavernCellToWorld(cavern.entrance.x, cavern.entrance.y, cavern.width, cavern.height);
      const entryYaw = cavernEntryYaw(cavern.link);
      const idSuffix = depth > 1 ? `_d${depth}` : '';
      const exitPortal: StructureEntity = {
        id: `cave_exit_${instanceId}${idSuffix}`,
        type: 'cave_exit',
        gridX: Math.round(entry.x / 2),
        gridZ: Math.round(entry.z / 2),
        worldX: entry.x,
        worldZ: entry.z,
        rotation: entryYaw,
        health: 999,
        maxHealth: 999,
        doorOpenProgress: 0,
        level: 0,
      };
      const structures: StructureEntity[] = [exitPortal];
      // The way DOWN, when this level grew one: a shaft structure in
      // the deep chamber beside the heart (see cavern.ts placeDescent).
      if (cavern.descent) {
        const dw = cavernCellToWorld(cavern.descent.x, cavern.descent.y, cavern.width, cavern.height);
        structures.push({
          id: `cave_descent_${instanceId}_${depth}`,
          type: 'cave_descent',
          gridX: Math.round(dw.x / 2),
          gridZ: Math.round(dw.z / 2),
          worldX: dw.x,
          worldZ: dw.z,
          rotation: 0,
          health: 999,
          maxHealth: 999,
          doorOpenProgress: 0,
          level: 0,
        });
      }
      // The express way OUT, when this (deep) level grew one: an
      // alien vine shaft in the mid depths — one climb, straight to
      // the surface (see cavern.ts placeVineShaft).
      if (cavern.vineShaft) {
        const vw = cavernCellToWorld(cavern.vineShaft.x, cavern.vineShaft.y, cavern.width, cavern.height);
        structures.push({
          id: `vine_shaft_${instanceId}_${depth}`,
          type: 'vine_shaft',
          gridX: Math.round(vw.x / 2),
          gridZ: Math.round(vw.z / 2),
          worldX: vw.x,
          worldZ: vw.z,
          rotation: 0,
          health: 999,
          maxHealth: 999,
          doorOpenProgress: 0,
          level: 0,
        });
      }
      // The cavern's living contents: its glow fungus and BOTH
      // crystal kinds become real flora in the instance list —
      // harvestable, fertilizable, regrowable, exactly like surface
      // plants (Adam, 2026-10-14). Hazards and the heart stay scenery.
      // Ids are deterministic per instance + depth + feature, so co-op
      // peers inside the same cave level agree on which plant is
      // which. Features hugging the entrance cell are skipped: the
      // player materializes there, and a crystal in the doorway
      // would crowd the spawn.
      const caveFlora: FloraEntity[] = [];
      for (const f of cavern.features) {
        const species: FloraSpecies | null =
          f.type === 'glow_fungus'
            ? 'glow_fungus'
            : f.type === 'common_resource'
              ? 'sunshard_cluster'
              : f.type === 'rare_mineral'
                ? 'prism_cluster'
                : null;
        if (!species) continue;
        if (Math.abs(f.cx - cavern.entrance.x) <= 1 && Math.abs(f.cy - cavern.entrance.y) <= 1) continue;
        const w = cavernCellToWorld(f.cx, f.cy, cavern.width, cavern.height);
        caveFlora.push({
          id: `caveflora_${instanceId}${idSuffix}_${f.id}`,
          species,
          x: w.x,
          z: w.z,
          rotation: ((f.cx * 37 + f.cy * 91) % 628) / 100,
          scale: 0.9 + ((f.cx * 13 + f.cy * 7) % 40) / 100,
          growthStage: 5,
          growthProgress: 1,
          fertilizedGrowth: false,
          fertilizedYield: false,
          fertilizerTimer: 0,
          harvestReady: true,
          harvestTimer: 0,
          isHazardous: false,
          swayOffset: f.cx * 3 + f.cy,
        });
      }
      // The player's own plantings on THIS level come back — captured
      // on exit/save (cavePlantingsRef) — as fresh copies, so the
      // record never shares object identity with the live list.
      const plantedBack = (cavePlantingsRef.current[plantingsKey(instanceId, depth)] ?? [])
        .filter((p) => !caveFlora.some((f) => f.id === p.id))
        .map((p) => ({ ...p }));
      // The level's citizens (Part 7, slice C1): dealt by depth
      // from the cavern's own floor — the instance's fauna list
      // shipped empty until the cave program opened, and this is
      // the one door every level enters through, so entry and
      // descent can never deal different country.
      const caveFauna = dealCavernFauna(cavern, instanceId, depth);
      replaceWorld({ flora: [...caveFlora, ...plantedBack], fauna: caveFauna, structures, drops: [] });
      engineRef.current?.setCavernMode(true, cavern, depth);
      applyPlayerLevel(0);
      playerPosRef.current = { x: entry.x, z: entry.z, rotation: entryYaw };
      engineRef.current?.setPlayerPosition(entry.x, entry.z, 0);
      setInCavern(true);
      setCavernDepth(depth);
      postNotification(note.title, note.body, 'system', '#a855f7');
    },
    [replaceWorld, applyPlayerLevel, postNotification]
  );

  const handleEnterCave = useCallback(
    (mouth: StructureEntity): void => {
      if (instanceRef.current.kind !== 'surface') return;
      const link = mouth.cave;
      if (!link) {
        postNotification('Sealed Shut', 'This mouth leads nowhere — its cavern was never linked.', 'alert', '#fbbf24');
        return;
      }
      // The link anchor (mouth position + the facing implied by its
      // stored exit point) is bookkeeping for the record only — the
      // layout itself comes from the instanceId seed and nothing else.
      const anchorFacing = Math.atan2(link.exitZ - mouth.worldZ, link.exitX - mouth.worldX);
      const cavern = generateGameCavern(link.instanceId, link.instanceId, {
        x: mouth.worldX,
        z: mouth.worldZ,
        facing: anchorFacing,
      }, mouthHops(mouth), mouthBiome(mouth));
      if (!cavern.meta.validation.pass) {
        postNotification('Unstable Cavern', 'The way down collapses before it forms. (This cave failed its validation — a bug, not a feature.)', 'alert', '#ef4444');
        return;
      }
      instanceRef.current = {
        kind: 'cavern',
        mouthId: mouth.id,
        instanceId: link.instanceId,
        cavern,
        depth: 1,
        parked: {
          flora: [...floraList],
          fauna: [...faunaList],
          structures: [...structuresList],
          drops: [...droppedItems],
        },
      };
      caveStackRef.current = [];
      enterCavernLevel(cavern, link.instanceId, 1, {
        title: 'Biolume Caverns',
        body: cavern.descent
          ? 'You descend into the dark. The fungus and crystals down here are alive — harvest them like any plant and they will regrow. The glowing ring is the way home — and this cave goes deeper: a violet shaft waits in the deep dark.'
          : 'You descend into the dark. The fungus and crystals down here are alive — harvest them like any plant and they will regrow. The glowing ring is the way home.',
      });
    },
    [floraList, faunaList, structuresList, droppedItems, postNotification, enterCavernLevel]
  );

  // Down a shaft (Adam's deeper caves): the current level's world is
  // pushed onto the descent stack exactly as it stands, the next
  // level is generated from the same instanceId at depth + 1, and
  // the player lands at its entrance. The exit portal down there
  // pops the stack — the climb back up.
  const handleDescendCave = useCallback(
    (descent: StructureEntity): void => {
      const inst = instanceRef.current;
      if (inst.kind !== 'cavern') return;
      const mouth = inst.parked.structures.find((s) => s.id === inst.mouthId);
      if (!mouth?.cave) {
        postNotification('Sealed Shut', 'This shaft leads nowhere — its cavern was never linked.', 'alert', '#fbbf24');
        return;
      }
      const anchorFacing = Math.atan2(mouth.cave.exitZ - mouth.worldZ, mouth.cave.exitX - mouth.worldX);
      const next = generateGameCavernLevel(inst.instanceId, inst.instanceId, inst.depth + 1, {
        x: mouth.worldX,
        z: mouth.worldZ,
        facing: anchorFacing,
      }, mouthHops(mouth), mouthBiome(mouth));
      if (!next.meta.validation.pass) {
        postNotification('Unstable Cavern', 'The shaft crumbles before it deepens. (This level failed its validation — a bug, not a feature.)', 'alert', '#ef4444');
        return;
      }
      captureCavePlantings(plantingsKey(inst.instanceId, inst.depth));
      caveStackRef.current = [
        ...caveStackRef.current,
        {
          cavern: inst.cavern,
          world: {
            flora: [...floraList],
            fauna: [...faunaList],
            structures: [...structuresList],
            drops: [...droppedItems],
          },
          shaft: { x: descent.worldX, z: descent.worldZ },
        },
      ];
      const nextDepth = inst.depth + 1;
      instanceRef.current = { ...inst, cavern: next, depth: nextDepth };
      enterCavernLevel(next, inst.instanceId, nextDepth, {
        title: cavernStratumName(nextDepth),
        body: next.descent
          ? `Depth ${nextDepth} of the Biolume Caverns. Darker, richer — and the cave goes deeper still.`
          : `Depth ${nextDepth} of the Biolume Caverns — the deepest dark. Darker, richer, and from here the only way is back up.`,
      });
    },
    [floraList, faunaList, structuresList, droppedItems, postNotification, captureCavePlantings, enterCavernLevel]
  );

  // The final leg home — shared by the first level's exit portal
  // and by vine shafts at ANY depth: restore the parked surface
  // world and land the player at the mouth's stored exit anchor.
  const exitToSurface = useCallback(
    (inst: Extract<InstanceState, { kind: 'cavern' }>, note: { title: string; body: string }): void => {
      const mouth = inst.parked.structures.find((s) => s.id === inst.mouthId);
      // The return address is the anchor stored on the mouth at
      // world creation: 2 m out from the mouth, so the player lands
      // OUTSIDE the portal and never instantly re-triggers it.
      // CLEAR-GROUND GUARD (Adam, 2026-10-19): the resolver has no
      // ejector, so a placement written inside a solid footprint is
      // a permanent trap — the anchor is asked against the restored
      // surface's real collision before it is ever written. A cave
      // mouth's own disc is honest today (1.72 m < 2 m), but a
      // player-built wall at the doorstep is not the dealing's
      // business to foresee; the guard is.
      const exitX = mouth?.cave?.exitX ?? 0;
      const exitZ = mouth?.cave?.exitZ ?? 0;
      const clear = findClearGround(exitX, exitZ, inst.parked.structures, 0, { maxRadius: 20 })
        ?? { x: exitX, z: exitZ };
      const facing = mouth ? Math.atan2(clear.x - mouth.worldX, clear.z - mouth.worldZ) : 0;
      replaceWorld(inst.parked);
      engineRef.current?.setCavernMode(false);
      instanceRef.current = { kind: 'surface' };
      caveStackRef.current = [];
      applyPlayerLevel(0);
      playerPosRef.current = { x: clear.x, z: clear.z, rotation: facing };
      engineRef.current?.setPlayerPosition(clear.x, clear.z, 0);
      setInCavern(false);
      setCavernDepth(0);
      postNotification(note.title, note.body, 'system', '#38bdf8');
    },
    [replaceWorld, applyPlayerLevel, postNotification]
  );

  const handleExitCave = useCallback((): void => {
    const inst = instanceRef.current;
    if (inst.kind !== 'cavern') return;
    // Remember what the player planted down here before the instance
    // list goes away — it is this cave's garden, kept per-cave.
    captureCavePlantings(plantingsKey(inst.instanceId, inst.depth));
    // Below the first level, the exit portal is the way UP one
    // level: pop the descent stack, restore that level exactly as
    // it was left, and land the player at the shaft they climbed
    // out of.
    if (inst.depth > 1) {
      const frame = caveStackRef.current[caveStackRef.current.length - 1];
      if (frame) {
        caveStackRef.current = caveStackRef.current.slice(0, -1);
        const upDepth = inst.depth - 1;
        instanceRef.current = { ...inst, cavern: frame.cavern, depth: upDepth };
        replaceWorld(frame.world);
        engineRef.current?.setCavernMode(true, frame.cavern, upDepth);
        applyPlayerLevel(0);
        playerPosRef.current = { x: frame.shaft.x, z: frame.shaft.z, rotation: cavernEntryYaw(frame.cavern.link) };
        engineRef.current?.setPlayerPosition(frame.shaft.x, frame.shaft.z, 0);
        setCavernDepth(upDepth);
        postNotification(cavernStratumName(upDepth), 'You climb back up the shaft.', 'system', '#a855f7');
        return;
      }
      // No frame under us (a restored mid-state) — fall through to
      // the surface exit rather than stranding the player.
    }
    exitToSurface(inst, { title: 'Surface', body: 'You climb back into the open air.' });
  }, [replaceWorld, applyPlayerLevel, postNotification, captureCavePlantings, exitToSurface]);

  // The vine climb: from ANY depth, straight to the surface in one
  // motion (Adam's express access, 2026-10-14). The level's plantings
  // are captured first, exactly as on a portal exit.
  const handleVineClimb = useCallback((): void => {
    const inst = instanceRef.current;
    if (inst.kind !== 'cavern') return;
    captureCavePlantings(plantingsKey(inst.instanceId, inst.depth));
    exitToSurface(inst, {
      title: 'Daylight',
      body: 'Hand over hand up the living vine — the whole cave falls away below you, and then there is sky.',
    });
  }, [captureCavePlantings, exitToSurface]);

  // Step through a ruin landmark into its instanced interior (P4
  // interior stage): the interior derives from the landmark's link
  // record alone — instanceId as the seed (the cavern precedent, so
  // every client holding the landmark rebuilds the identical ruin),
  // with the world's fate choosing the layout variant and style.
  // The surface world parks; the instance's lists are the threshold
  // portal plus the generator's features turned into structures:
  // caches and the artifact heart (one-shot loot) and glyph stones
  // (lore). 'Traces' landmarks never reach here — the hook refuses
  // them with their remnant line first.
  const handleEnterRuin = useCallback(
    (landmark: StructureEntity): void => {
      if (instanceRef.current.kind !== 'surface') return;
      const link = landmark.ruin;
      if (!link) {
        postNotification('Sealed Shut', 'This ruin leads nowhere — its interior was never linked.', 'alert', '#fbbf24');
        return;
      }
      const ruin = generateGameRuin(link.instanceId, {
        instanceId: link.instanceId,
        fate: link.fate as WorldFate,
        variant: link.variant as RuinVariantId,
        tier: link.tier,
      });
      if (!ruin) {
        postNotification('Unstable Ruin', 'The way in collapses before it forms. (This ruin failed its validation — a bug, not a feature.)', 'alert', '#ef4444');
        return;
      }
      const fate = link.fate as WorldFate;
      const entry = cavernCellToWorld(ruin.entrance.cx, ruin.entrance.cy, ruin.width, ruin.height);
      const entryYaw = ruinEntryYaw(ruin);
      const structures: StructureEntity[] = [
        {
          id: `ruin_exit_${link.instanceId}`,
          type: 'ruin_exit',
          gridX: Math.round(entry.x / 2),
          gridZ: Math.round(entry.z / 2),
          worldX: entry.x,
          worldZ: entry.z,
          rotation: entryYaw,
          health: 999,
          maxHealth: 999,
          doorOpenProgress: 0,
          level: 0,
        },
      ];
      // Features become the ruin's contents. A feature sitting on the
      // entrance cell itself is skipped — the player materializes
      // there. Ids are deterministic per instance + feature, so
      // co-op peers inside the same ruin agree on every stone.
      for (const f of ruin.features) {
        if (f.cx === ruin.entrance.cx && f.cy === ruin.entrance.cy) continue;
        const w = cavernCellToWorld(f.cx, f.cy, ruin.width, ruin.height);
        const base = {
          gridX: Math.round(w.x / 2),
          gridZ: Math.round(w.z / 2),
          worldX: w.x,
          worldZ: w.z,
          rotation: ((f.cx * 37 + f.cy * 91) % 628) / 100,
          health: 999,
          maxHealth: 999,
          doorOpenProgress: 0,
          level: 0,
        };
        if (f.type === 'cache') {
          structures.push({ ...base, id: `ruincache_${link.instanceId}_${f.id}`, type: 'precursor_cache', ruinFeature: { fate, band: f.band } });
        } else if (f.type === 'artifact_heart') {
          structures.push({ ...base, id: `ruinheart_${link.instanceId}_${f.id}`, type: 'artifact_heart', ruinFeature: { fate, band: 'deep', tier: link.tier } });
        } else if (f.type === 'portal_ring') {
          // The Departure (D2): a Follow world's station ring,
          // standing in the grand ruin's heart room.
          structures.push({ ...base, id: `ruinportal_${link.instanceId}_${f.id}`, type: 'portal_ring', ruinFeature: { fate, band: 'deep' } });
        } else if (f.type === 'the_scar') {
          // The Departure (D5): a Confront world's scar — the
          // tear the strangers left, in the grand hall.
          structures.push({ ...base, id: `ruinscar_${link.instanceId}_${f.id}`, type: 'the_scar', ruinFeature: { fate, band: 'deep' } });
        } else {
          structures.push({
            ...base,
            id: `ruinglyph_${link.instanceId}_${f.id}`,
            type: 'ruin_glyph',
            ruinFeature: { fate, band: f.type === 'clue_deep' ? 'deep' : 'shallow' },
          });
        }
      }
      instanceRef.current = {
        kind: 'ruin',
        landmarkId: landmark.id,
        instanceId: link.instanceId,
        ruin,
        collisionGrid: ruinCollisionGrid(ruin),
        parked: {
          flora: [...floraList],
          fauna: [...faunaList],
          structures: [...structuresList],
          drops: [...droppedItems],
        },
      };
      replaceWorld({ flora: [], fauna: [], structures, drops: [] });
      engineRef.current?.setRuinMode(true, ruin, FATE_STYLES[fate]?.tint ?? 0xa8a29e);
      applyPlayerLevel(0);
      playerPosRef.current = { x: entry.x, z: entry.z, rotation: entryYaw };
      engineRef.current?.setPlayerPosition(entry.x, entry.z, 0);
      setInRuin(true);
      postNotification(
        'Precursor Ruin',
        'You step through the gate into the precursor ruin. What the centuries left is yours to read — and the deepest room keeps the heart of the place.',
        'system',
        '#a5b4fc'
      );
    },
    [floraList, faunaList, structuresList, droppedItems, postNotification, replaceWorld, applyPlayerLevel]
  );

  // Step back out of a ruin: restore the parked surface world and
  // land the player at the landmark's stored exit anchor (2 m out
  // along its facing — outside the portal, never re-triggering it).
  // CLEAR-GROUND GUARD (Adam, 2026-10-19 — the stuck-at-the-exit
  // bug): that 2 m anchor sits INSIDE a medium/grand landmark's own
  // collision disc (2.52 m solid), and the resolver has no ejector —
  // writing it raw trapped the player at the doorstep forever. The
  // anchor is asked against the restored surface's real collision
  // before it is ever written; the nearest clear spot wins. (The
  // dealing keeps writing the 2 m anchor — old saves carry it too —
  // because the guard, not the number, is the fix.)
  const handleExitRuin = useCallback((): void => {
    const inst = instanceRef.current;
    if (inst.kind !== 'ruin') return;
    const landmark = inst.parked.structures.find((s) => s.id === inst.landmarkId);
    const exitX = landmark?.ruin?.exitX ?? 0;
    const exitZ = landmark?.ruin?.exitZ ?? 0;
    const clear = findClearGround(exitX, exitZ, inst.parked.structures, 0, { maxRadius: 20 })
      ?? { x: exitX, z: exitZ };
    const facing = landmark ? Math.atan2(clear.x - landmark.worldX, clear.z - landmark.worldZ) : 0;
    replaceWorld(inst.parked);
    engineRef.current?.setRuinMode(false);
    instanceRef.current = { kind: 'surface' };
    applyPlayerLevel(0);
    playerPosRef.current = { x: clear.x, z: clear.z, rotation: facing };
    engineRef.current?.setPlayerPosition(clear.x, clear.z, 0);
    setInRuin(false);
    postNotification('Surface', 'You step back out into the open air, the ruin\'s silence behind you.', 'system', '#38bdf8');
  }, [replaceWorld, applyPlayerLevel, postNotification]);

  // Leaving an instance WITHOUT the portal (loading a save, starting
  // a new world, receiving a host's world): drop the cave so the
  // fresh world never opens inside a ghost instance.
  const resetInstanceState = useCallback((): void => {
    if (instanceRef.current.kind === 'surface') return;
    instanceRef.current = { kind: 'surface' };
    caveStackRef.current = [];
    engineRef.current?.setCavernMode(false);
    engineRef.current?.setRuinMode(false);
    setInCavern(false);
    setInRuin(false);
    setCavernDepth(0);
  }, []);


  return {
    instanceRef, inCavern, inRuin, cavernDepth, cavePlantingsRef, plantingsKey,
    captureCavePlantings, handleEnterCave, handleDescendCave, handleExitCave,
    handleVineClimb, handleEnterRuin, handleExitRuin, resetInstanceState,
  };
}
