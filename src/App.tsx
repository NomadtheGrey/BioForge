/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as THREE from 'three';
import {
  HoverTarget,
  CodexEntry,
  CraftingRecipe,
  FloraEntity,
  FaunaEntity,
  StructureEntity,
  DroppedItemEntity,
  ItemId,
  StructureType,
  FloraSpecies,
} from './types/game';
import { INITIAL_CODEX, ITEMS, NON_BUILDABLE_STRUCTURE_IDS } from './game/constants';
import { BioForgeThreeEngine } from './game/threeEngine';
import { soundEngine } from './audio/soundEngine';
import { multiplayerManager, EntityKind, EntitySnapshot } from './game/multiplayer';

const CHAT_TOAST_DURATION_MS = 5000;
const MAX_CHAT_TOASTS = 5;
import { FirstPersonMovementController, ControllerInputState } from './game/controller';

// Modular Domain Hooks (Enforces CODE_MANIFESTO.md Rule 8)
import { useInventory } from './hooks/useInventory';
import { useNotifications } from './hooks/useNotifications';
import { usePlayerState } from './hooks/usePlayerState';
import { useWorldEntities, INITIAL_STRUCTURES } from './hooks/useWorldEntities';
import { generateSeededWorld } from './game/worldGen';
import { generateGameCavern, generateGameCavernLevel, cavernCellToWorld, cavernEntryYaw, cavernStratumName, type CavernResult } from './game/cavern';
import { zoneInfo, zoneBiomeAt, biomeDisplayName, SPAWN_ZONE, zoneCoordsAt, zoneHops } from './game/zones';
import { occupancyConflict, placementFor } from './game/placement';
import { useToolInteractions } from './hooks/useToolInteractions';
import {
  AUTOSAVE_INTERVAL_MS,
  buildSavedGame,
  createSaveMetadata,
  deleteSavedGame,
  listSaveMetadata,
  loadSavedGame,
  storeSavedGame,
  GameDifficulty,
  SaveMetadata,
  SavedGameRecord,
  WorldSnapshot,
} from './game/saveSystem';

import { StartScreenModal } from './components/StartScreenModal';

// UI Components
import { HUD } from './components/HUD';
import { BioForgeModal } from './components/BioForgeModal';
import { InventoryModal } from './components/InventoryModal';
import { CodexModal } from './components/CodexModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { ControlsGuideModal } from './components/ControlsGuideModal';
import { SourceExporterModal } from './components/SourceExporterModal';
import { getProjectWorkspaceFiles } from './utils/workspaceFiles';

export default function App() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<BioForgeThreeEngine | null>(null);
  const movementController = useRef<FirstPersonMovementController>(new FirstPersonMovementController());

  // 1. Modular Domain Hooks
  const {
    inventory,
    addInventoryItem,
    deductInventoryItem,
    hasItem,
    craftRecipe,
    restoreInventory,
  } = useInventory();

  const {
    notifications,
    postNotification,
  } = useNotifications();

  const {
    playerState,
    setActiveTool,
    setSelectedStructureType,
    setSelectedSeedId,
    setSelectedFertilizerId,
    setHeldItemId,
    setPlayerTransform,
    setStamina,
    setPlayerLevel,
    restorePlayerState,
  } = usePlayerState();

  // ------------------------------------------------------------------------
  // Loaded Fertilizer Cycling (ArrowUp / ArrowDown)
  // ------------------------------------------------------------------------
  // The planter trowel carries one "loaded" fertilizer at a time
  // (playerState.selectedFertilizerId) — clicking a plant applies THAT
  // one, never whichever the pouch happens to hold first. The cycle
  // order is derived from ITEMS (category 'fertilizer'), so a future
  // third fertilizer joins the rotation with no change needed here.
  const fertilizerCycle: ItemId[] = useMemo(
    () =>
      Object.values(ITEMS)
        .filter((item) => item.category === 'fertilizer')
        .map((item) => item.id),
    []
  );

  const cycleLoadedFertilizer = useCallback(
    (direction: 1 | -1): void => {
      if (fertilizerCycle.length < 2) return;
      const currentIndex = fertilizerCycle.indexOf(playerState.selectedFertilizerId);
      const nextIndex =
        (currentIndex + direction + fertilizerCycle.length) % fertilizerCycle.length;
      setSelectedFertilizerId(fertilizerCycle[nextIndex]);
    },
    [fertilizerCycle, playerState.selectedFertilizerId, setSelectedFertilizerId]
  );

  // ------------------------------------------------------------------------
  // Seed & Blueprint Cycling (Adam, 2026-10-14)
  // ------------------------------------------------------------------------
  // The same treatment for the other selections a tool carries: the
  // trowel's SEED and the builder's BLUEPRINT. Orders derive from ITEMS
  // categories, so new seeds and structures join the rotation on their
  // own. Input split on the trowel, which carries two selections: the
  // WHEEL cycles seeds (planting is its main verb) and ↑/↓ keep cycling
  // fertilizer as they already did. On the builder, both inputs cycle
  // the blueprint.
  const seedCycle: ItemId[] = useMemo(
    () =>
      Object.values(ITEMS)
        .filter((item) => item.category === 'seed')
        .map((item) => item.id),
    []
  );

  const structureCycle: ItemId[] = useMemo(
    () =>
      Object.values(ITEMS)
        .filter(
          (item) =>
            item.category === 'structure' &&
            !NON_BUILDABLE_STRUCTURE_IDS.includes(item.id)
        )
        .map((item) => item.id),
    []
  );

  const cycleSelectedSeed = useCallback(
    (direction: 1 | -1): void => {
      if (seedCycle.length < 2) return;
      const currentIndex = seedCycle.indexOf(playerState.selectedSeedId);
      const nextIndex = (currentIndex + direction + seedCycle.length) % seedCycle.length;
      setSelectedSeedId(seedCycle[nextIndex]);
    },
    [seedCycle, playerState.selectedSeedId, setSelectedSeedId]
  );

  const cycleSelectedStructure = useCallback(
    (direction: 1 | -1): void => {
      if (structureCycle.length < 2) return;
      const currentIndex = structureCycle.indexOf(playerState.selectedStructureType as ItemId);
      const nextIndex =
        (currentIndex + direction + structureCycle.length) % structureCycle.length;
      setSelectedStructureType(structureCycle[nextIndex] as StructureType);
    },
    [structureCycle, playerState.selectedStructureType, setSelectedStructureType]
  );

  const {
    floraList,
    faunaList,
    structuresList,
    droppedItems,
    addFlora,
    upsertFlora,
    removeFlora,
    resetFloraHarvest,
    applyFloraFertilizer,
    addStructure,
    upsertStructure,
    removeStructure,
    tameFauna,
    setFaunaCommand,
    upsertFauna,
    removeFauna,
    updateTick,
    upsertDroppedItem,
    removeDroppedItem,
    replaceWorld,
  } = useWorldEntities();

  // 2. Modals & UI States
  const [activeModal, setActiveModal] = useState<
    'bioforge' | 'inventory' | 'codex' | 'multiplayer' | 'controls' | 'devtools' | null
  >(null);
  const [codexList, setCodexList] = useState<CodexEntry[]>(INITIAL_CODEX);
  const [dayNightCycle, setDayNightCycle] = useState<number>(0.35);
  const [isMuted, setIsMuted] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  const [hoverInfo, setHoverInfo] = useState<HoverTarget>(null);

  // Memoized workspace virtual file map for Developer Exporter Tool
  const workspaceFiles = useMemo(() => getProjectWorkspaceFiles(), []);

  // 3. Multiplayer States
  const [roomCode, setRoomCode] = useState<string>('');
  const [isHost, setIsHost] = useState<boolean>(false);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [peers, setPeers] = useState(multiplayerManager.getConnectedPeers());
  const [chatMessages, setChatMessages] = useState<{ sender: string; text: string; color: string; time: string }[]>([]);
  const [chatToasts, setChatToasts] = useState<{ id: number; sender: string; text: string; color: string }[]>([]);

  // Invite links: when the game is opened from a shared link
  // (…/?room=CODE), the code is parked here at boot and handed to the
  // multiplayer modal, which pre-fills its join field. Empty string
  // means "no invite" — the modal then behaves exactly as before.
  const [inviteRoomCode, setInviteRoomCode] = useState<string>('');

  // Minimap position state updated smoothly during frame/tick
  const [minimapPos, setMinimapPos] = useState({ x: playerState.x, z: playerState.z, rotation: playerState.rotation });
  const lastMinimapUpdateTime = useRef(0);

  // Movement Keys & High-Frequency Refs (Rule 3: Performance & Memoization)
  const keysPressed = useRef<Record<string, boolean>>({});
  const lastWTap = useRef(0);
  const sprinting = useRef(false);
  const staminaRef = useRef(100);
  const lastStaminaSync = useRef(0);
  const playerPosRef = useRef({ x: playerState.x, z: playerState.z, rotation: playerState.rotation });
  // The story the player stands on (0 = ground). The movement loop reads
  // this ref; playerState.level is the persisted copy, kept in step by
  // the mirror effect below and by setPlayerLevel at every transition.
  const playerLevelRef = useRef(playerState.level ?? 0);
  useEffect(() => {
    playerLevelRef.current = playerState.level ?? 0;
  }, [playerState.level]);
  // Change the player's story (ladder climbs, shroom bounces, falls):
  // ref first (the loop reads it this frame), then the persisted state.
  const applyPlayerLevel = useCallback(
    (level: number): void => {
      if (playerLevelRef.current === level) return;
      playerLevelRef.current = level;
      setPlayerLevel(level);
    },
    [setPlayerLevel]
  );
  // Bounce grace: after a shroom bounce the player hangs in the ceiling
  // HOLE (a cell with no floor) — support checks pause until this
  // timestamp so they can step onto a real tile instead of dropping
  // straight back through.
  const bounceGraceUntil = useRef(0);
  const activeToolRef = useRef(playerState.activeTool);
  const selectedStructureRef = useRef(playerState.selectedStructureType);
  const isPointerLockedRef = useRef(isPointerLocked);
  const activeModalRef = useRef(activeModal);
  const structuresListRef = useRef(structuresList);
  const floraListRef = useRef(floraList);
  const lastBroadcastTime = useRef(0);
  const accumulatedTickTime = useRef(0);
  const accumulatedDayTime = useRef(0);

  // Sync state into high-frequency refs without re-mounting loops
  useEffect(() => {
    activeToolRef.current = playerState.activeTool;
  }, [playerState.activeTool]);

  useEffect(() => {
    selectedStructureRef.current = playerState.selectedStructureType;
  }, [playerState.selectedStructureType]);

  useEffect(() => {
    isPointerLockedRef.current = isPointerLocked;
  }, [isPointerLocked]);

  useEffect(() => {
    activeModalRef.current = activeModal;
  }, [activeModal]);

  useEffect(() => {
    structuresListRef.current = structuresList;
  }, [structuresList]);

  useEffect(() => {
    floraListRef.current = floraList;
  }, [floraList]);

  const triggerHarvestFx = useCallback(
  (x: number, z: number) => engineRef.current?.triggerHarvestEffect(x, z),
  []
);
  const triggerSolventFx = useCallback(
  (x: number, z: number) => engineRef.current?.triggerSolventSprayEffect(x, z),
  []
);
  const openBioForgeModal = useCallback(() => setActiveModal('bioforge'), []);

  // Placement facing (Adam, 2026-10-14): crafted structures used to place
  // at rotation 0 no matter what, so walls could never turn a corner.
  // Placement now takes the player's FACING, snapped to 90° steps —
  // face east and a wall runs north-south; face north and it runs
  // east-west. Read live from the camera (not the movement ref, which
  // only updates while walking) so turning in place counts. This one
  // getter feeds BOTH the ghost preview and the actual placement, so
  // what you see is always what gets built.
  const getPlacementRotation = useCallback((): number => {
    const engine = engineRef.current;
    if (!engine) return 0;
    const dir = new THREE.Vector3();
    engine.camera.getWorldDirection(dir);
    const yaw = Math.atan2(dir.x, dir.z);
    const step = Math.PI / 2;
    return Math.round(yaw / step) * step;
  }, []);

  // Live player position + story for the tool hook: ceiling placement
  // reads the player's side of a wall, and ladder climbs move the
  // player's story (through the same applyPlayerLevel the loop uses).
  const getPlayerPosition = useCallback((): { x: number; z: number } => playerPosRef.current, []);
  const getPlayerLevel = useCallback((): number => playerLevelRef.current, []);

  // ----------------------------------------------------------------------
  // Jumping (Adam, 2026-10-14)
  // ----------------------------------------------------------------------
  // Space is a real jump now: a short cosmetic arc over the level
  // model (the game has no Y physics — your height IS your story,
  // plus this offset). Standing on a mature bounce-shroom turns the
  // hop into a LAUNCH: the arc crosses story height, the player's
  // level flips mid-flight, and air control (movement keys keep
  // working while airborne) lets you slide onto the adjacent floor
  // tile — Mario rules. Falling ONTO a cap from above still does
  // nothing: the cap fires only when jumped on (Adam's spec). After
  // a bounce, a grace window pauses the story-support check so you
  // can step from the ceiling hole onto a tile.
  const BOUNCE_RADIUS = 0.9;
  const BOUNCE_GRACE_MS = 1600;
  const BOUNCE_MIN_STAGE = 4;
  const JUMP_GRAVITY = 24; // m/s^2 — gamey, snappier than Earth's 9.8
  const JUMP_VELOCITY = 5.4; // ordinary hop: ~0.6 m peak, ~0.45 s of air
  const BOUNCE_VELOCITY = 12.5; // shroom launch: ~3.3 m peak — clears a story
  const STORY_HEIGHT_METERS = 2.4; // mirrors threeEngine's STORY_HEIGHT
  const jumpRef = useRef({ y: 0, vy: 0, bounceFlip: false });
  // Throttle for the too-young-cap explanation: Space gets mashed,
  // and the lesson only needs saying once every few seconds.
  const lastYoungNoteRef = useRef(0);

  // Is a bounce available under the player's feet right now — and if
  // a shroom is there but the bounce can't work, why not? Pure check:
  // the caller decides about notifications and velocities.
  const bounceCheck = (): { near: boolean; blocked: 'opening' | 'landing' | 'young' | null; shroomStage?: number } => {
    // Bounce-shrooms are ground plants (they never root on floors),
    // so the launch only exists on the ground story.
    if (playerLevelRef.current !== 0) return { near: false, blocked: null };
    const pos = playerPosRef.current;
    const shroom = floraListRef.current.find(
      (f) =>
        f.species === 'bounce_shroom' &&
        Math.hypot(f.x - pos.x, f.z - pos.z) < BOUNCE_RADIUS
    );
    if (!shroom) return { near: false, blocked: null };
    // A cap underfoot that hasn't matured yet is its own verdict:
    // the bounce used to fail SILENTLY here (plain hop, no reason
    // given), which read as "the bounce is broken" in playtest. The
    // caller explains it — stage 4 of 5 is the firing line.
    if (shroom.growthStage < BOUNCE_MIN_STAGE) {
      return { near: true, blocked: 'young', shroomStage: shroom.growthStage };
    }

    const cellGX = Math.round(pos.x / 2);
    const cellGZ = Math.round(pos.z / 2);
    const structs = structuresListRef.current;
    const floorAt = (gx: number, gz: number, level: number): boolean =>
      structs.some(
        (s) => s.type === 'root_tile_floor' && (s.level ?? 0) === level && s.gridX === gx && s.gridZ === gz
      );

    if (floorAt(cellGX, cellGZ, 1)) return { near: true, blocked: 'opening' };
    const hasLanding =
      floorAt(cellGX + 1, cellGZ, 1) ||
      floorAt(cellGX - 1, cellGZ, 1) ||
      floorAt(cellGX, cellGZ + 1, 1) ||
      floorAt(cellGX, cellGZ - 1, 1);
    if (!hasLanding) return { near: true, blocked: 'landing' };
    return { near: true, blocked: null };
  };

  const attemptJump = useCallback((): void => {
    const j = jumpRef.current;
    if (j.vy !== 0 || j.y > 0) return; // already airborne
    const bounce = bounceCheck();
    if (bounce.near && bounce.blocked === 'opening') {
      postNotification(
        'No Opening Above',
        'The ceiling over this shroom is closed. Dissolve a tile with the Solvent Sprayer [4] to open the hole.',
        'alert',
        '#fbbf24'
      );
    }
    if (bounce.near && bounce.blocked === 'landing') {
      postNotification(
        'Nothing to Land On',
        'Bouncing here would just drop you back down the hole. Lay ceiling tiles around the opening first.',
        'alert',
        '#fbbf24'
      );
    }
    if (bounce.near && bounce.blocked === 'young') {
      // Throttled: the hop still happens, the lesson repeats at most
      // every five seconds no matter how hard Space gets mashed.
      const now = performance.now();
      if (now - lastYoungNoteRef.current > 5000) {
        lastYoungNoteRef.current = now;
        postNotification(
          'Too Young to Bounce',
          `This cap is at growth stage ${bounce.shroomStage} of 5 — it only fires at maturity (stage 4). Fertilizer speeds the growing up.`,
          'system',
          '#38bdf8'
        );
      }
    }
    if (bounce.near && !bounce.blocked) {
      // The launch: big arc, story flip mid-flight (the game loop
      // applies it as the arc crosses STORY_HEIGHT_METERS), and the
      // grace window so the landing step isn't rushed.
      j.vy = BOUNCE_VELOCITY;
      j.bounceFlip = true;
      bounceGraceUntil.current = performance.now() + BOUNCE_GRACE_MS;
      soundEngine.playFertilize();
    } else {
      j.vy = JUMP_VELOCITY;
    }
  }, [postNotification]);

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
  type InstanceState =
    | { kind: 'surface' }
    | {
        kind: 'cavern';
        mouthId: string;
        instanceId: string;
        cavern: CavernResult;
        /** 1-based depth level of `cavern` (Adam's deeper caves). */
        depth: number;
        parked: WorldSnapshot;
      };
  const instanceRef = useRef<InstanceState>({ kind: 'surface' });
  const [inCavern, setInCavern] = useState(false);
  // The current depth level as STATE (the ref holds the truth; this
  // mirror exists so the HUD can name the stratum the player is in).
  const [cavernDepth, setCavernDepth] = useState(0);

  // The descent stack: one frame per level ABOVE the current one,
  // pushed when the player goes down a shaft, popped on the climb
  // back. A frame keeps that level's whole world — its lists exactly
  // as they were the moment the player left — plus the shaft's world
  // position, which is where the player climbs back out.
  interface CaveFrame {
    cavern: CavernResult;
    world: WorldSnapshot;
    shaft: { x: number; z: number };
  }
  const caveStackRef = useRef<CaveFrame[]>([]);

  /** 'surface', or the cavern instanceId the player is inside —
   *  deeper levels suffix the depth so co-op peers on different
   *  levels of the same cave stay invisible to each other. */
  const currentZoneId = useCallback((): string => {
    const inst = instanceRef.current;
    if (inst.kind !== 'cavern') return 'surface';
    return inst.depth > 1 ? `${inst.instanceId}#${inst.depth}` : inst.instanceId;
  }, []);

  const isInCavernNow = useCallback(
    (): boolean => instanceRef.current.kind === 'cavern',
    []
  );

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
      replaceWorld({ flora: [...caveFlora, ...plantedBack], fauna: [], structures, drops: [] });
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
      }, mouthHops(mouth));
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
      }, mouthHops(mouth));
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
      const exitX = mouth?.cave?.exitX ?? 0;
      const exitZ = mouth?.cave?.exitZ ?? 0;
      const facing = mouth ? Math.atan2(exitX - mouth.worldX, exitZ - mouth.worldZ) : 0;
      replaceWorld(inst.parked);
      engineRef.current?.setCavernMode(false);
      instanceRef.current = { kind: 'surface' };
      caveStackRef.current = [];
      applyPlayerLevel(0);
      playerPosRef.current = { x: exitX, z: exitZ, rotation: facing };
      engineRef.current?.setPlayerPosition(exitX, exitZ, 0);
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

  // Leaving an instance WITHOUT the portal (loading a save, starting
  // a new world, receiving a host's world): drop the cave so the
  // fresh world never opens inside a ghost instance.
  const resetInstanceState = useCallback((): void => {
    if (instanceRef.current.kind === 'surface') return;
    instanceRef.current = { kind: 'surface' };
    caveStackRef.current = [];
    engineRef.current?.setCavernMode(false);
    setInCavern(false);
    setCavernDepth(0);
  }, []);

  // 4. Encapsulated Tool Interactions
  const {
    handleGroundClick,
    handleFloraInteract,
    handleFaunaInteract,
    handleStructureInteract,
  } = useToolInteractions({
    activeTool: playerState.activeTool,
    selectedStructureType: playerState.selectedStructureType,
    selectedSeedId: playerState.selectedSeedId,
    selectedFertilizerId: playerState.selectedFertilizerId,
    inventory,
    structuresList,
    floraList,
    addInventoryItem,
    deductInventoryItem,
    hasItem,
    resetFloraHarvest,
    applyFloraFertilizer,
    addFlora,
    addStructure,
    removeStructure,
    removeFlora,
    getPlacementRotation,
    getPlayerPosition,
    getPlayerLevel,
    applyPlayerLevel,
    onEnterCave: handleEnterCave,
    onExitCave: handleExitCave,
    onDescendCave: handleDescendCave,
    onVineClimb: handleVineClimb,
    isInCavern: isInCavernNow,
    tameFauna,
    setFaunaCommand,
    setCodexList,
    postNotification,
    onOpenBioForgeModal: openBioForgeModal,
    triggerHarvestFx,
    triggerSolventFx,

  });

  const toolHandlersRef = useRef({
  handleGroundClick,
  handleFloraInteract,
  handleFaunaInteract,
  handleStructureInteract,
});
  const liveGameRefs = useRef({ hasItem, addInventoryItem, updateTick, postNotification, getPlacementRotation });

  useEffect(() => {
    toolHandlersRef.current = {
      handleGroundClick,
      handleFloraInteract,
      handleFaunaInteract,
      handleStructureInteract,
    };
  liveGameRefs.current = { hasItem, addInventoryItem, updateTick, postNotification, getPlacementRotation };
});
  // Zone identity (name + biome) is computed at render time from the
  // active world's seed — see the zone block just above the JSX return.
  // (The old quadrant-name indicator retired with the per-zone model:
  // a zone has ONE name and ONE biome, zones.ts.)

  // --------------------------------------------------------------------------
  // Three.js Engine Lifecycle & Authoritative Simulation Loop (Single Source of Truth)
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (!containerRef.current) return;

    const engine = new BioForgeThreeEngine(containerRef.current, {
    onGroundClick: (wx, wz) => toolHandlersRef.current.handleGroundClick(wx, wz),
    onFloraInteract: (flora) => toolHandlersRef.current.handleFloraInteract(flora),
    onFaunaInteract: (fauna) => toolHandlersRef.current.handleFaunaInteract(fauna),
    onStructureInteract: (structure) => toolHandlersRef.current.handleStructureInteract(structure),
      onEntityHover: (target: HoverTarget) => setHoverInfo(target),
      onLockChange: (locked) => setIsPointerLocked(locked),
      onFrame: (dt: number) => {
        // Guard Clause 1: Engine unready
        if (!engineRef.current) return;

        // 1. Controller Update
        const isPaused = !isPointerLockedRef.current || activeModalRef.current !== null;

        const inputState: ControllerInputState = {
          forward: Boolean(keysPressed.current['w'] || keysPressed.current['arrowup']),
          backward: Boolean(keysPressed.current['s'] || keysPressed.current['arrowdown']),
          left: Boolean(keysPressed.current['a'] || keysPressed.current['arrowleft']),
          right: Boolean(keysPressed.current['d'] || keysPressed.current['arrowright']),
        };

        const wantSprint = sprinting.current && staminaRef.current > 0;
        movementController.current.sprintMultiplier = wantSprint ? 1.6 : 1;

        // Inside an instance, the cavern grid itself is the walls.
        const activeInstance = instanceRef.current;
        const cavernArg =
          activeInstance.kind === 'cavern'
            ? {
                grid: activeInstance.cavern.grid,
                width: activeInstance.cavern.width,
                height: activeInstance.cavern.height,
              }
            : null;

        const moveResult = movementController.current.update(
          dt,
          playerPosRef.current.x,
          playerPosRef.current.z,
          engineRef.current.camera,
          inputState,
          isPaused,
          structuresListRef.current,
          floraListRef.current,
          playerLevelRef.current,
          cavernArg
        );

        playerPosRef.current.x = moveResult.x;
        playerPosRef.current.z = moveResult.z;

        // Jump arc: gravity pulls the cosmetic Y back to the floor.
        // Movement input kept working during the move above — that IS
        // the air control. A bounce launch flips the player's story
        // as the arc crosses story height: camera height is the SUM
        // (level × story + jumpY), so subtracting the story from
        // jumpY in the same frame keeps the view perfectly continuous
        // while collision and support switch to the upper floor.
        const jump = jumpRef.current;
        if (jump.vy !== 0 || jump.y > 0) {
          jump.vy -= JUMP_GRAVITY * dt;
          jump.y += jump.vy * dt;
          if (jump.bounceFlip && playerLevelRef.current === 0 && jump.y >= STORY_HEIGHT_METERS) {
            applyPlayerLevel(1);
            jump.y -= STORY_HEIGHT_METERS;
            jump.bounceFlip = false;
          }
          if (jump.y <= 0) {
            jump.y = 0;
            jump.vy = 0;
            jump.bounceFlip = false;
            // Touching down on the upper story: a short grace to
            // finish the step onto a tile before support is judged.
            if (playerLevelRef.current > 0) {
              bounceGraceUntil.current = Math.max(bounceGraceUntil.current, performance.now() + 350);
            }
          }
        }

        // Story support: above the ground story you stand on ceiling
        // floors. Step off one (or have it dissolved under you) and you
        // drop to the highest floor still present in this column, or
        // to the ground. Runs after the move, so this frame's collision
        // still used the level you started on. A fresh bounce (Part 3)
        // buys a short grace window to step from the hole onto a tile.
        // While a jump arc is airborne, support isn't judged at all.
        if (playerLevelRef.current > 0 && performance.now() > bounceGraceUntil.current && jump.y <= 0) {
          const cellX = Math.round(moveResult.x / 2);
          const cellZ = Math.round(moveResult.z / 2);
          let landing = 0;
          let supported = false;
          for (const s of structuresListRef.current) {
            if (s.type !== 'root_tile_floor' || s.gridX !== cellX || s.gridZ !== cellZ) continue;
            const l = s.level ?? 0;
            if (l === playerLevelRef.current) supported = true;
            if (l < playerLevelRef.current && l > landing) landing = l;
          }
          if (!supported) {
            applyPlayerLevel(landing);
          }
        }

        const isSprintingNow = wantSprint && moveResult.isMoving && !isPaused;
        const staminaDelta = isSprintingNow ? -18 * dt : (moveResult.isMoving ? 8 : 14) * dt;
        staminaRef.current = Math.max(0, Math.min(100, staminaRef.current + staminaDelta));
        if (performance.now() - lastStaminaSync.current > 100) {
          lastStaminaSync.current = performance.now();
          setStamina(staminaRef.current);
        }

        if (moveResult.isMoving) {
          const camDir = new THREE.Vector3();
          engineRef.current.camera.getWorldDirection(camDir);
          playerPosRef.current.rotation = Math.atan2(camDir.x, camDir.z);

          // Throttled network broadcast (every 60ms)
          const now = performance.now();
          if (now - lastBroadcastTime.current > 60) {
            lastBroadcastTime.current = now;
            multiplayerManager.broadcastPlayerMove(
              moveResult.x,
              moveResult.z,
              playerPosRef.current.rotation,
              activeToolRef.current,
              playerLevelRef.current,
              currentZoneId()
            );
          }
        }

        // Update Camera & Viewmodel dynamics using the exact same dt
        engineRef.current.setPlayerPosition(moveResult.x, moveResult.z, playerLevelRef.current, jump.y);
        engineRef.current.updateViewmodelDynamics(dt, moveResult.isMoving);

        // Smooth Minimap Pos update (every 50ms)
        const frameNow = performance.now();
        if (frameNow - lastMinimapUpdateTime.current > 50) {
          lastMinimapUpdateTime.current = frameNow;
          const currentCamDir = new THREE.Vector3();
          engineRef.current.camera.getWorldDirection(currentCamDir);
          const currentRotation = Math.atan2(currentCamDir.x, currentCamDir.z);
          setMinimapPos({
            x: moveResult.x,
            z: moveResult.z,
            rotation: currentRotation,
          });
        }

        // Building Ghost Preview
        if (activeToolRef.current === 'builder') {
          const pt = engineRef.current.getAimGroundIntersection();
          if (pt) {
            const type = selectedStructureRef.current;
            const rotation = liveGameRefs.current.getPlacementRotation();
            // Same placement math the click will use (game/placement.ts):
            // panels preview on their EDGE, and the ghost turns red when
            // the spot is already occupied — no promising what the click
            // would refuse.
            const spot = placementFor(type, pt.x, pt.z, rotation);
            const blocked = occupancyConflict(type, spot, structuresListRef.current) !== undefined;
            engineRef.current.setGhostPreview(
              type,
              true,
              spot.worldX,
              spot.worldZ,
              rotation,
              liveGameRefs.current.hasItem(type, 1) && !blocked
            );
          }
        }
        if (activeToolRef.current !== 'builder') {
          engineRef.current.setGhostPreview(selectedStructureRef.current, false, 0, 0, 0, true);
        }

        // 2. Throttled Ecosystem Simulation Tick (10 Hz = 100ms)
        accumulatedTickTime.current += dt;
        if (accumulatedTickTime.current >= 0.1) {
          const simDt = accumulatedTickTime.current;
          accumulatedTickTime.current = 0;
          liveGameRefs.current.updateTick(
            simDt,
            moveResult.x,
            moveResult.z,
            (pickedItem) => {
              liveGameRefs.current.addInventoryItem(pickedItem.itemId, pickedItem.count);
              soundEngine.playHarvest();
              liveGameRefs.current.postNotification(
                'Item Collected',
                `Picked up ${pickedItem.count}x ${ITEMS[pickedItem.itemId]?.name || pickedItem.itemId}`,
                'harvest',
                ITEMS[pickedItem.itemId]?.color || '#38bdf8'
              );
            },
            (critterSpecies) => {
              if (critterSpecies === 'soft_puff') {
                liveGameRefs.current.postNotification('Bio-Pellet Produced', 'Your tamed Soft-Puff excreted high-grade organic fertilizer!', 'tame', '#10b981');
              }
              if (critterSpecies === 'chitin_stalker') {
                liveGameRefs.current.postNotification('Carapace Shedding', 'Your guardian Chitin-Stalker shed a Reinforced Carapace Scale!', 'tame', '#8b5cf6');
              }
            }
          );
        }

        // 3. Smooth Sol-Cycle advancement (1 second throttled UI tick, host authority)
        accumulatedDayTime.current += dt;
        if (accumulatedDayTime.current >= 1.0) {
          accumulatedDayTime.current = 0;
          if (!multiplayerManager.isConnected || multiplayerManager.isHost) {
            setDayNightCycle((prev) => {
              const next = (prev + 0.002) % 1.0;
              multiplayerManager.broadcastDayNight(next);
              return next;
            });
          }
        }
      },
    });

    engineRef.current = engine;

    const handleGesture = () => {
      soundEngine.startAmbient();
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('keydown', handleGesture);

    return () => {
      engine.destroy();
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, []);

  // Sync World Entities with Engine
  useEffect(() => {
    engineRef.current?.syncFlora(floraList);
  }, [floraList]);

  useEffect(() => {
    engineRef.current?.syncFauna(faunaList);
  }, [faunaList]);

  useEffect(() => {
    engineRef.current?.syncStructures(structuresList, playerPosRef.current.x, playerPosRef.current.z);
  }, [structuresList]);

  useEffect(() => {
    engineRef.current?.syncDroppedItems(droppedItems);
  }, [droppedItems]);

  useEffect(() => {
    engineRef.current?.setDayNightTime(dayNightCycle);
  }, [dayNightCycle]);

  // Viewmodel & Modal Synchronization
  useEffect(() => {
    if (activeModal !== null) {
      engineRef.current?.unlockPointer();
    }
  }, [activeModal]);

  useEffect(() => {
    engineRef.current?.setViewmodelTool(playerState.activeTool);
  }, [playerState.activeTool]);

  useEffect(() => {
    engineRef.current?.setViewmodelBlueprint(playerState.selectedStructureType);
  }, [playerState.selectedStructureType]);

  // --------------------------------------------------------------------------
  // Keyboard Input with Guard Clauses (Esc / Pause Mode Awareness)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Guard Clause 1: Ignore inputs if user is typing in form/chat fields
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      // Guard Clause 2: Handle Escape key to dismiss modals or handle pause state
      if (e.key === 'Escape') {
        if (activeModal !== null) {
          setActiveModal(null);
        }
        keysPressed.current = {};
        return;
      }

      // Spacebar: jump — a hop anywhere, a bounce-shroom LAUNCH when
      // standing on a mature cap (see attemptJump).
      if (e.code === 'Space') {
        e.preventDefault();
        attemptJump();
        return;
      }

      // Quick Window Shortcuts can toggle modals
      if (e.key.toLowerCase() === 'b') {
        setActiveModal((prev) => (prev === 'bioforge' ? null : 'bioforge'));
        return;
      }
      if (e.key.toLowerCase() === 'i') {
        setActiveModal((prev) => (prev === 'inventory' ? null : 'inventory'));
        return;
      }
      if (e.key.toLowerCase() === 'c') {
        setActiveModal((prev) => (prev === 'codex' ? null : 'codex'));
        return;
      }
      if (e.key.toLowerCase() === 'm') {
        setActiveModal((prev) => (prev === 'multiplayer' ? null : 'multiplayer'));
        return;
      }
      if (e.key === '?') {
        setActiveModal((prev) => (prev === 'controls' ? null : 'controls'));
        return;
      }

      const key = e.key.toLowerCase();

      // Loaded-fertilizer cycling: with the planter trowel equipped, ↑/↓
      // switch which fertilizer is loaded INSTEAD of walking — WASD still
      // moves. (The arrows keep their movement role with every other tool,
      // and ←/→ always move.)
      if (
        playerState.activeTool === 'planter_trowel' &&
        (key === 'arrowup' || key === 'arrowdown')
      ) {
        e.preventDefault();
        cycleLoadedFertilizer(key === 'arrowdown' ? 1 : -1);
        return;
      }

      // Same deal on the builder: ↑/↓ cycle the BLUEPRINT instead of
      // walking — WASD still moves, and ←/→ always move.
      if (
        playerState.activeTool === 'builder' &&
        (key === 'arrowup' || key === 'arrowdown')
      ) {
        e.preventDefault();
        cycleSelectedStructure(key === 'arrowdown' ? 1 : -1);
        return;
      }

      // Register standard continuous WASD / Arrow movement keys
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        keysPressed.current[key] = true;
      }

      if (key === 'w' && !e.repeat) {
        const now = performance.now();
        if (now - lastWTap.current < 300) {
          sprinting.current = true;
        }
        lastWTap.current = now;
      }

      // Tools 1 - 6 selection
      const toolKeyMap: Record<string, typeof playerState.activeTool> = {
        '1': 'harvest_glove',
        '2': 'bio_scanner',
        '3': 'planter_trowel',
        '4': 'solvent_sprayer',
        '5': 'taming_lure',
        '6': 'builder',
      };
      if (toolKeyMap[e.key]) {
        setActiveTool(toolKeyMap[e.key]);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      // Guard Clause 1: Ignore inputs if user is typing in form/chat fields
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      keysPressed.current[e.key.toLowerCase()] = false;

      if (e.key.toLowerCase() === 'w') {
        sprinting.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeModal, isPointerLocked, setActiveTool, playerState.activeTool, cycleLoadedFertilizer, cycleSelectedStructure, attemptJump]);

  // Mouse wheel cycles the equipped tool's primary selection: SEEDS on
  // the trowel, BLUEPRINTS on the builder. (The trowel's fertilizer
  // keeps the ↑/↓ arrows — see the keydown handler.) Guarded like the
  // keyboard handler: no cycling while a modal is open. A short
  // cooldown keeps one physical scroll notch from spinning through the
  // whole rotation on high-resolution wheels.
  const lastWheelCycleRef = useRef(0);
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (activeModal !== null) return;
      if (e.deltaY === 0) return;
      const tool = playerState.activeTool;
      if (tool !== 'planter_trowel' && tool !== 'builder') return;
      const now = performance.now();
      if (now - lastWheelCycleRef.current < 150) return;
      lastWheelCycleRef.current = now;
      if (tool === 'planter_trowel') {
        cycleSelectedSeed(e.deltaY > 0 ? 1 : -1);
      } else {
        cycleSelectedStructure(e.deltaY > 0 ? 1 : -1);
      }
    };

    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [activeModal, playerState.activeTool, cycleSelectedSeed, cycleSelectedStructure]);

  // --------------------------------------------------------------------------
  // Save System — start gate, snapshots, autosave
// --------------------------------------------------------------------------
// hasStarted is the boot gate: the start screen stays up until the
// player picks a saved world, starts a new one, or takes the co-op door.
const [hasStarted, setHasStarted] = useState(false);

// The library shown on the start screen (metadata only — worlds load on
// demand when one is picked).
const [saveList, setSaveList] = useState<SaveMetadata[]>([]);

// Which save the current session belongs to. A ref, not state: the
// autosave timer and pagehide handler must always see the latest value
// without re-subscribing. Null means "no save attached" — the start
// screen is still up, or this is a co-op guest session.
const currentSaveRef = useRef<SaveMetadata | null>(null);

// A mirror of every state slice a save needs, refreshed each render.
// Timers and network callbacks read from here so they never act on
// stale closures. (The engine loop keeps its own per-list refs; this
// one exists purely for save/snapshot assembly.)
const latestStateRef = useRef({
  floraList, faunaList, structuresList, droppedItems,
  inventory, playerState, codexList, dayNightCycle,
});
useEffect(() => {
  latestStateRef.current = {
    floraList, faunaList, structuresList, droppedItems,
    inventory, playerState, codexList, dayNightCycle,
  };
});

// The world-only portion of current state (what world_sync sends and
// what a save stores as its world). While the player is inside a
// cavern, "the world" is the PARKED surface world: instances are
// regenerated from their seed on entry and are never themselves
// saved or synced — a guest joining a host who is underground gets
// the surface, which is where they'll arrive.
const buildWorldSnapshot = (): WorldSnapshot => {
  const inst = instanceRef.current;
  if (inst.kind === 'cavern') return inst.parked;
  const s = latestStateRef.current;
  return { flora: s.floraList, fauna: s.faunaList, structures: s.structuresList, drops: s.droppedItems };
};

// Player state for a save: the React state holds vitals and tool picks,
// but the live position truth is playerPosRef (the game loop moves the
// ref every tick) — so position is overlaid from the ref. Inside a
// cavern, the saved position is the mouth's surface exit anchor: you
// wake up OUTSIDE the cave you were exploring, on solid ground.
const buildCurrentPlayerState = () => {
  const inst = instanceRef.current;
  if (inst.kind === 'cavern') {
    const mouth = inst.parked.structures.find((s) => s.id === inst.mouthId);
    const exitX = mouth?.cave?.exitX ?? playerPosRef.current.x;
    const exitZ = mouth?.cave?.exitZ ?? playerPosRef.current.z;
    return {
      ...latestStateRef.current.playerState,
      x: exitX,
      z: exitZ,
      rotation: mouth
        ? Math.atan2(exitX - mouth.worldX, exitZ - mouth.worldZ)
        : playerPosRef.current.rotation,
      level: 0,
    };
  }
  return {
    ...latestStateRef.current.playerState,
    x: playerPosRef.current.x,
    z: playerPosRef.current.z,
    rotation: playerPosRef.current.rotation,
  };
};

// Writes the current session to its save slot. The two guard clauses
// are the whole safety story: no save attached → nothing to write;
// connected as a guest → the world belongs to the host, never save it.
const saveNow = useCallback((): void => {
  const meta = currentSaveRef.current;
  if (!meta) return;
  if (multiplayerManager.isConnected && !multiplayerManager.isHost) return;
  const s = latestStateRef.current;
  // A save taken mid-delve: capture the cave's plantings first (the
  // snapshot itself still writes the parked surface world, so the
  // player wakes up outside — with their cave garden on record).
  if (instanceRef.current.kind === 'cavern') {
    captureCavePlantings(plantingsKey(instanceRef.current.instanceId, instanceRef.current.depth));
  }
  const record = buildSavedGame(meta, buildWorldSnapshot(), s.inventory, buildCurrentPlayerState(), s.dayNightCycle, s.codexList, cavePlantingsRef.current);
  currentSaveRef.current = { ...meta, savedAt: record.savedAt };
  void storeSavedGame(record);
  // buildWorldSnapshot/buildCurrentPlayerState only read refs, so this
  // callback safely stays stable for the interval/pagehide effects.
}, []);

// Load the save library once at boot, for the start screen.
useEffect(() => {
  void listSaveMetadata().then(setSaveList);
}, []);

// Autosave on an interval while a world is open.
useEffect(() => {
  if (!hasStarted) return;
  const id = setInterval(saveNow, AUTOSAVE_INTERVAL_MS);
  return () => clearInterval(id);
}, [hasStarted, saveNow]);

// Save when the page goes away. `pagehide` is the reliable leave
// signal — it fires on tab close and navigation, including mobile
// browsers where beforeunload often never runs.
useEffect(() => {
  const onPageHide = () => saveNow();
  window.addEventListener('pagehide', onPageHide);
  return () => window.removeEventListener('pagehide', onPageHide);
}, [saveNow]);

// Applies a loaded record to every state holder at once: world lists,
// pouch, player (state AND the loop's position ref), codex, and clock.
  const applySavedGame = (record: SavedGameRecord): void => {
    resetInstanceState();
    // The world's per-cave plantings come back with it (older saves
    // have none — an empty record, every cave wild).
    cavePlantingsRef.current = record.cavePlantings ?? {};
    replaceWorld(record.world);
    restoreInventory(record.inventory);
    restorePlayerState(record.playerState);
    playerPosRef.current = {
      x: record.playerState.x,
      z: record.playerState.z,
      rotation: record.playerState.rotation,
    };
    setCodexList(record.codexList);
    setDayNightCycle(record.dayNightCycle);
  };

  const handleSelectSave = (id: string): void => {
    void loadSavedGame(id).then((record) => {
      if (!record) {
        postNotification('Save Unreadable', 'That world could not be loaded (missing, or written by an older format).', 'system', '#ef4444');
        return;
      }
      applySavedGame(record);
      currentSaveRef.current = {
        id: record.id, name: record.name, difficulty: record.difficulty,
        worldSeed: record.worldSeed ?? '',
        createdAt: record.createdAt, savedAt: record.savedAt,
      };
      // Repaint the ground with this world's spawn-zone biome (pre-seed
      // saves pass null and keep the plain quadrant colors).
      engineRef.current?.setZoneBiome(record.worldSeed ? zoneBiomeAt(record.worldSeed, SPAWN_ZONE.zx, SPAWN_ZONE.zz) : null);
      setHasStarted(true);
      postNotification(
        'World Loaded',
        record.worldSeed ? `Welcome back to ${record.name} · Seed ${record.worldSeed}` : `Welcome back to ${record.name}.`,
        'system',
        '#10b981'
      );
    });
  };

  const handleCreateSave = (name: string, difficulty: GameDifficulty, worldSeed: string): void => {
    resetInstanceState();
    cavePlantingsRef.current = {};
    const meta = createSaveMetadata(name, difficulty, worldSeed);
    currentSaveRef.current = meta;
    // The seed earns its keep: a new world's flora and fauna are GROWN
    // from it (seeded surface scatter — game/worldGen.ts) instead of
    // reusing the fixed hand-placed starter layout. Starter structures
    // (forge, floors, mound) stay fixed — they're the homestead, not
    // wilderness. Generate from meta.worldSeed: createSaveMetadata
    // guarantees a non-empty seed, and the world must match the seed
    // its save advertises.
    const generated = generateSeededWorld(meta.worldSeed);
    replaceWorld({
      flora: generated.flora,
      fauna: generated.fauna,
      // Starter structures stay fixed (the homestead); world-grown
      // structures (v4: the spawn zone's cave mouth) join them here.
      structures: [...INITIAL_STRUCTURES, ...generated.structures],
      drops: [],
    });
    // The ground wears the spawn zone's biome tint (always meadow).
    engineRef.current?.setZoneBiome(zoneBiomeAt(meta.worldSeed, SPAWN_ZONE.zx, SPAWN_ZONE.zz));
    setHasStarted(true);
    // First save right away — but deferred a beat: saveNow reads
    // latestStateRef, which only syncs after the replaceWorld render
    // commits, so saving in this same tick would snapshot the PREVIOUS
    // world into the new save. Writing it now (50 ms later) means the
    // world exists in the library from minute one.
    window.setTimeout(() => saveNow(), 50);
    postNotification('New World Created', `${meta.name} · Seed ${meta.worldSeed} — grown from your seed. Autosaving as you play.`, 'system', '#10b981');
  };

  const handleDeleteSave = (id: string): void => {
    void deleteSavedGame(id)
      .then(() => listSaveMetadata())
      .then(setSaveList);
  };

  // The co-op door: no local save involved. The guest plays in the
  // host's world; saveNow stays disarmed because currentSaveRef is null.
  const handleJoinCoopFromStart = (): void => {
    setHasStarted(true);
    setActiveModal('multiplayer');
  };

  // ------------------------------------------------------------------------
  // Invite Links — landing side
  // ------------------------------------------------------------------------
  // A host shares a link like bioforgegame.netlify.app/?room=BIO77X.
  // On boot we lift the code out of the URL so the join flow can start
  // pre-filled: the guest lands on the start screen, takes the co-op
  // door, and the code is already waiting in the join field — all that
  // is left is typing their name and pressing JOIN SESSION.
  // The parameter is sanitized to the room-code alphabet (letters and
  // digits, 6 max) and must be at least 3 characters, matching what the
  // join field itself accepts. The URL is left untouched; the code also
  // stays parked here until a session actually starts, so closing the
  // modal and reopening it keeps the pre-fill.
  useEffect(() => {
    const rawCode = new URLSearchParams(window.location.search).get('room');
    if (!rawCode) return;
    const cleanCode = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
    if (cleanCode.length < 3) return;
    setInviteRoomCode(cleanCode);
    postNotification('Invite Link Detected', `Room code ${cleanCode} is filled in and waiting — take the co-op door to join your host!`, 'system', '#a855f7');
  }, []);

  // The HUD's Save button. saveNow() itself silently no-ops in exactly
  // the two cases guarded below, so this handler checks them first and
  // tells the player what happened instead of letting a click vanish.
  // ------------------------------------------------------------------------
  // Left Hand (Adam, 2026-10-14): the off-hand slot for INSTRUMENTS —
  // the Hand Lantern-Fern (a living torch) and the Prismatic Field
  // Radar (minimap pings). Taking one INTO the hand spends the pouch
  // item; stowing returns it. The engine light follows
  // PlayerState.heldItemId via the effect below, so saves, loads,
  // and co-op world swaps all keep the hand honest.
  // ------------------------------------------------------------------------
  const handleToggleHeldItem = useCallback((): void => {
    // The Left Hand holds INSTRUMENTS, and the slot CYCLES the ones
    // you own (Adam, 2026-10-14): click takes the first, click again
    // swaps to the next, click past the last stows it. Lantern vs
    // radar is a real choice in the dark — light, or knowledge.
    const HOLDABLES: ItemId[] = ['hand_lantern_fern', 'prismatic_field_radar'];
    const held = playerState.heldItemId;
    const owned = HOLDABLES.filter((id) => id === held || hasItem(id, 1));
    if (owned.length === 0) {
      postNotification('Empty Left Hand', 'Craft a Hand Lantern-Fern or a Prismatic Field Radar at the Bio-Forge [B] to hold an instrument.', 'alert', '#fbbf24');
      return;
    }
    const idx = held ? owned.indexOf(held) : -1;
    const next = owned[idx + 1] ?? null;
    if (held) addInventoryItem(held, 1);
    if (next) {
      deductInventoryItem(next, 1);
      setHeldItemId(next);
      if (next === 'prismatic_field_radar') {
        postNotification('Radar Raised', 'The Prismatic Field Radar takes your left hand — the minimap now pings caves, ruins, deep shafts, and rare lives.', 'craft', '#a855f7');
      } else {
        postNotification('Lantern Raised', 'The Hand Lantern-Fern takes your left hand — its light goes where you go.', 'craft', '#22d3ee');
      }
    } else {
      setHeldItemId(null);
      postNotification('Left Hand Free', `${ITEMS[held as ItemId]?.name ?? 'Item'} stowed back in your pouch.`, 'craft', '#94a3b8');
    }
  }, [playerState.heldItemId, addInventoryItem, deductInventoryItem, hasItem, setHeldItemId, postNotification]);

  useEffect(() => {
    engineRef.current?.setHeldLight(playerState.heldItemId === 'hand_lantern_fern');
  }, [playerState.heldItemId]);

  // Where the cave exit is, while inside a cavern — the radar's violet
  // way-out arrow (HUD → Minimap) aims at it. On the surface: null.
  const caveExitTarget = useMemo(() => {
    if (!inCavern) return null;
    const exit = structuresList.find((s) => s.type === 'cave_exit');
    return exit ? { x: exit.worldX, z: exit.worldZ } : null;
  }, [inCavern, structuresList]);

  const handleManualSave = (): void => {
    const meta = currentSaveRef.current;
    if (!meta) {
      postNotification('Nothing to Save', 'You are visiting as a co-op guest — there is no local world attached to this session.', 'system', '#f59e0b');
      return;
    }
    if (multiplayerManager.isConnected && !multiplayerManager.isHost) {
      postNotification('Guest Session', "You are playing in the host's world — only the host can save it.", 'system', '#f59e0b');
      return;
    }
    saveNow();
    postNotification('World Saved', `${meta.name} was saved just now.`, 'system', '#10b981');
  };

  // --------------------------------------------------------------------------
  // Multiplayer Event Setup
  // --------------------------------------------------------------------------
  useEffect(() => {
    multiplayerManager.setCallbacks({
      onPeerJoin: (peer) => {
        setPeers(multiplayerManager.getConnectedPeers());
        postNotification('Explorer Joined', `${peer.name} entered sector. Co-Op synced!`, 'system', peer.color);
        // Host duty: a new explorer's game booted with the starter world
        // (or their own saved one). If it isn't OUR world, it's wrong —
        // send the full snapshot so they play in the same place we do.
        if (multiplayerManager.isHost) {
          multiplayerManager.broadcastWorldSync(buildWorldSnapshot(), latestStateRef.current.dayNightCycle);
        }
      },
      onPeerLeave: (peerId) => {
        setPeers(multiplayerManager.getConnectedPeers());
        engineRef.current?.removePeerAvatar(peerId);
      },
      onPeerMove: (peerId, px, pz, prot, _tool, level, zone) => {
        // Instances are separate spaces: a peer on the surface is not
        // standing in your cave, nor you in theirs — hide cross-zone
        // avatars instead of drawing them in the wrong world.
        if ((zone ?? 'surface') !== currentZoneId()) {
          engineRef.current?.removePeerAvatar(peerId);
          return;
        }
        const peer = peers.find((p) => p.id === peerId);
        engineRef.current?.updatePeerAvatar(peerId, peer?.name || 'Explorer', px, pz, prot, peer?.color || '#38bdf8', level ?? 0);
      },
      onBuildPlaced: (structure) => {
        addStructure(structure);
        soundEngine.playBuildPlace();
      },
      onBuildRemoved: (structId) => {
        removeStructure(structId);
        soundEngine.playSolventSpray();
      },
      onFloraHarvested: (floraId) => {
        resetFloraHarvest(floraId, 18);
      },
      onFaunaTamed: (faunaId, tamedBy) => {
        tameFauna(faunaId, `${tamedBy}'s Companion`, 'following');
        postNotification('Wildlife Domesticated', `${tamedBy} tamed a companion for the base!`, 'tame', '#a855f7');
      },
      onChatMessage: (sender, text, color) => {
        setChatMessages((prev) => [
          ...prev,
          { sender, text, color, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
        ]);
        const toastId = Date.now() + Math.random();
        setChatToasts((prev) => [...prev.slice(-MAX_CHAT_TOASTS), { id: toastId, sender, text, color }]);
        setTimeout(() => {
          setChatToasts((prev) => prev.filter((t) => t.id !== toastId));
        }, CHAT_TOAST_DURATION_MS);
      },
      onEntityUpsert: (kind: EntityKind, entity: EntitySnapshot) => {
        switch (kind) {
          case 'flora':
            upsertFlora(entity as FloraEntity);
            break;
          case 'fauna':
            upsertFauna(entity as FaunaEntity);
            break;
          case 'structure':
            upsertStructure(entity as StructureEntity);
            break;
          case 'drop':
            upsertDroppedItem(entity as DroppedItemEntity);
            break;
        }
      },
      onEntityRemove: (kind: EntityKind, id: string) => {
        switch (kind) {
          case 'flora':
            removeFlora(id);
            break;
          case 'fauna':
            removeFauna(id);
            break;
          case 'structure':
            removeStructure(id);
            break;
          case 'drop':
            removeDroppedItem(id);
            break;
        }
      },
      onDayNight: (value) => {
        setDayNightCycle(value);
      },
      onWorldSync: (data) => {
        // The host's world replaces ours wholesale. This is memory only:
        // our own save file on disk is untouched, and autosave is gated
        // off while we are guests, so their world can never overwrite it.
        resetInstanceState();
        replaceWorld({
          flora: data.flora,
          fauna: data.fauna,
          structures: data.structures,
          drops: data.drops,
        });
        setDayNightCycle(data.dayNightCycle);
      },
    });
  }, [peers, addStructure, removeStructure, resetFloraHarvest, tameFauna, postNotification, upsertFlora, removeFlora, upsertFauna, removeFauna, upsertStructure, upsertDroppedItem, removeDroppedItem, replaceWorld]);

  // ------------------------------------------------------------------------
  // Presence heartbeat — appear on join, stay visible standing still
  // ------------------------------------------------------------------------
  // The movement broadcast in the game loop only fires while the player is
  // actually moving, so a peer who joins and stands still never sends a
  // position — and because remote avatars are only drawn when a peer_move
  // arrives, that player stays invisible to everyone until they walk.
  // While connected, this heartbeat re-sends our current position once a
  // second whether we are moving or not. A joiner materializes for the
  // room almost immediately; the room materializes for the joiner too,
  // because everyone else's heartbeats keep arriving; and nobody vanishes
  // for the crime of standing still. Position truth is playerPosRef, the
  // same source the movement broadcast uses.
  const PEER_PRESENCE_HEARTBEAT_MS = 1000;
  useEffect(() => {
    if (!isConnected) return;
    const sendPresence = () => {
      const pos = playerPosRef.current;
      multiplayerManager.broadcastPlayerMove(pos.x, pos.z, pos.rotation, activeToolRef.current, playerLevelRef.current, currentZoneId());
    };
    sendPresence();
    const heartbeatId = setInterval(sendPresence, PEER_PRESENCE_HEARTBEAT_MS);
    return () => clearInterval(heartbeatId);
  }, [isConnected]);

  const handleHostSession = () => {
    const code = multiplayerManager.hostSession();
    setRoomCode(code);
    setIsHost(true);
    setIsConnected(true);
    // A session has started, so any parked invite code has done its job
    // (or was never meant for us). Clear it so it can't pre-fill later.
    setInviteRoomCode('');
    postNotification('Host Session Created', `Room Code: ${code}. Share the code — or copy your invite link from the multiplayer panel — to bring fellow explorers into your world!`, 'system', '#10b981');
  };

  const handleJoinSession = (code: string) => {
    const success = multiplayerManager.joinSession(code);
    if (success) {
      setRoomCode(code);
      setIsHost(false);
      setIsConnected(true);
      // Joined — the parked invite code is spent. Clear it (see
      // handleHostSession for why).
      setInviteRoomCode('');
      postNotification('Session Joined', `Connected to room ${code}! Co-Op base building active.`, 'system', '#a855f7');
    }
  };

  const handleLeaveSession = () => {
    multiplayerManager.leaveSession();
    setRoomCode('');
    setIsHost(false);
    setIsConnected(false);
    setPeers([]);
    postNotification('Session Disconnected', 'Returned to local single-explorer mode.', 'system', '#64748b');
  };

  const handleSendChatMessage = (text: string) => {
    multiplayerManager.broadcastChat(text);
    setChatMessages((prev) => [
      ...prev,
      {
        sender: 'You',
        text,
        color: multiplayerManager.playerColor,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
  };

  // Crafting access: within 6m of a bio-forge station, or carrying the Field Synthesizer Gauntlet
  const checkCraftAccess = (): { nearForge: boolean; hasGauntlet: boolean } => {
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const nearForge = structuresListRef.current.some(
      (s) => s.type === 'bio_forge_station' && Math.hypot(s.worldX - px, s.worldZ - pz) < 6
    );
    const hasGauntlet = (inventory['field_synthesizer_gauntlet'] || 0) > 0;
    return { nearForge, hasGauntlet };
  };

  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    const access = checkCraftAccess();
    const forgeOnly = recipe.tier === 3;
    if (!access.nearForge && (forgeOnly || !access.hasGauntlet)) {
      postNotification(
        'Synthesis Blocked',
        forgeOnly
          ? 'Advanced synthesis requires a bio-forge station.'
          : 'Too far from a bio-forge station — synthesize a Field Synthesizer Gauntlet to craft in the field.',
        'craft',
        '#f59e0b'
      );
      return;
    }
    const success = craftRecipe(recipe);
    if (success) {
      postNotification(
        'Synthesis Complete',
        `Synthesized ${recipe.outputCount}x ${ITEMS[recipe.outputId]?.name || recipe.outputId} in Bio-Forge.`,
        'craft',
        ITEMS[recipe.outputId]?.color || '#06b6d4'
      );
    }
  };

  const craftAccess = checkCraftAccess();

  // Trowel hover hint: tell the player when a plant can (or can't) be fertilized
  // ------------------------------------------------------------------------
  // Zone identity for the HUD (per-zone model — zones.ts)
  // ------------------------------------------------------------------------
  // The current zone is the SPAWN ZONE (0, 0) — the only zone that
  // exists as a playable map so far. Its name and biome derive from
  // the world seed; seedless contexts (pre-seed saves, co-op guests)
  // get a plain fallback name and no biome line.
  const activeSeed = currentSaveRef.current?.worldSeed ?? '';
  const currentZone = activeSeed ? zoneInfo(activeSeed, SPAWN_ZONE.zx, SPAWN_ZONE.zz) : null;
  const currentZoneName = currentZone ? currentZone.name : 'Starting Zone';
  const currentZoneBiomeLabel = currentZone ? biomeDisplayName(currentZone.biome) : null;
  const zoneCoordsLabel = `Zone ${SPAWN_ZONE.zx}, ${SPAWN_ZONE.zz}`;

  // Edge label: within 10 m of the map border, name the zone beyond
  // the nearest edge (its deterministic name + biome from the seed) —
  // the world already has a geography before travel between zones
  // exists. North is -Z, per the minimap's orientation.
  const edgeZoneLabel: string | null = (() => {
    if (!activeSeed) return null;
    const { x, z } = playerPosRef.current;
    const edges = [
      { dir: 'North', dist: 50 + z, zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz - 1 },
      { dir: 'South', dist: 50 - z, zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz + 1 },
      { dir: 'West', dist: 50 + x, zx: SPAWN_ZONE.zx - 1, zz: SPAWN_ZONE.zz },
      { dir: 'East', dist: 50 - x, zx: SPAWN_ZONE.zx + 1, zz: SPAWN_ZONE.zz },
    ];
    const nearest = edges.reduce((a, b) => (b.dist < a.dist ? b : a));
    if (nearest.dist > 10) return null;
    const beyond = zoneInfo(activeSeed, nearest.zx, nearest.zz);
    return `${nearest.dir} — ${beyond.name} · ${biomeDisplayName(beyond.biome)}`;
  })();

  const hoverHint: string | null = (() => {
    if (playerState.activeTool !== 'planter_trowel' || hoverInfo?.type !== 'flora') return null;
    const flora = hoverInfo.entity;
    if (flora.fertilizedGrowth || flora.fertilizedYield) return null;
    const loadedId = playerState.selectedFertilizerId;
    if ((inventory[loadedId] ?? 0) > 0) {
      return `Click to apply ${ITEMS[loadedId]?.name || 'fertilizer'}`;
    }
    const hasAnyFertilizer =
      (inventory['growth_fertilizer'] ?? 0) > 0 || (inventory['yield_fertilizer'] ?? 0) > 0;
    if (hasAnyFertilizer) {
      return `${ITEMS[loadedId]?.name || 'Loaded fertilizer'} in the trowel, none in pouch — wheel / ↑ ↓ to switch`;
    }
    return 'No fertilizer — craft at Bio-Forge [B]';
  })();

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 cursor-crosshair" />

      {/* Futuristic Botanical Tech HUD */}
      <HUD
        playerState={{
          ...playerState,
          x: minimapPos.x,
          z: minimapPos.z,
          rotation: minimapPos.rotation,
        }}
        structures={structuresList}
        fauna={faunaList}
        flora={floraList}
        onSelectTool={setActiveTool}
        onOpenInventory={() => setActiveModal('inventory')}
        onOpenBioForge={() => setActiveModal('bioforge')}
        onOpenCodex={() => setActiveModal('codex')}
        onOpenMultiplayer={() => setActiveModal('multiplayer')}
        onOpenControls={() => setActiveModal('controls')}
        onOpenDevTools={() => setActiveModal('devtools')}
        onSave={handleManualSave}
        currentBiomeName={inCavern ? cavernStratumName(cavernDepth || 1) : currentZoneName}
        currentBiomeType={inCavern ? 'Cavern' : currentZoneBiomeLabel}
        edgeZoneLabel={inCavern ? null : edgeZoneLabel}
        zoneCoordsLabel={inCavern ? 'Instanced Zone' : zoneCoordsLabel}
        inventory={inventory}
        caveExitTarget={caveExitTarget}
        radarActive={playerState.heldItemId === 'prismatic_field_radar'}
        onToggleHeldItem={handleToggleHeldItem}
        dayNightCycle={dayNightCycle}
        onToggleDayNight={() => {
          if (dayNightCycle > 0.5) {
            setDayNightCycle(0.35);
            return;
          }
          setDayNightCycle(0.85);
        }}
        isMuted={isMuted}
        onToggleMute={() => {
          const next = soundEngine.toggleMute();
          setIsMuted(next);
        }}
        isPointerLocked={isPointerLocked}
        onRequestLock={() => engineRef.current?.requestPointerLock()}
        hoverInfo={hoverInfo}
        hoverHint={hoverHint}
        notifications={notifications}
        roomCode={roomCode}
        peerCount={peers.length}
        selectedStructureType={playerState.selectedStructureType}
        selectedSeedId={playerState.selectedSeedId}
        selectedFertilizerId={playerState.selectedFertilizerId}
      />

      {/* In-game chat toasts (bottom-left, above nav buttons) */}
      <div className="absolute left-4 bottom-28 z-30 flex flex-col justify-end gap-1.5 max-w-xs pointer-events-none">
        {chatToasts.map((t) => (
          <div key={t.id} className="glass-panel px-3 py-1.5 rounded-xl text-xs animate-fade-in">
            <span className="font-bold" style={{ color: t.color }}>{t.sender}: </span>
            <span className="text-slate-200">{t.text}</span>
          </div>
        ))}
      </div>

      {/* Modals */}
      <BioForgeModal
        isOpen={activeModal === 'bioforge'}
        onClose={() => setActiveModal(null)}
        inventory={inventory}
        nearForge={craftAccess.nearForge}
        hasGauntlet={craftAccess.hasGauntlet}
        onCraftRecipe={handleCraftRecipe}
        onSelectStructureBlueprint={(type) => {
          setSelectedStructureType(type);
          setActiveTool('builder');
        }}
      />

      <InventoryModal
        isOpen={activeModal === 'inventory'}
        onClose={() => setActiveModal(null)}
        inventory={inventory}
        onSelectBlueprint={setSelectedStructureType}
        onSelectSeed={setSelectedSeedId}
        onSelectFertilizer={setSelectedFertilizerId}
        onSelectTool={setActiveTool}
      />

      <CodexModal
        isOpen={activeModal === 'codex'}
        onClose={() => setActiveModal(null)}
        codexList={codexList}
      />

      <StartScreenModal
        isOpen={!hasStarted}
        saves={saveList}
        onSelectSave={handleSelectSave}
        onCreateSave={handleCreateSave}
        onDeleteSave={handleDeleteSave}
        onJoinCoop={handleJoinCoopFromStart}
      />
      <MultiplayerModal
        isOpen={activeModal === 'multiplayer'}
        onClose={() => setActiveModal(null)}
        roomCode={roomCode}
        isHost={isHost}
        isConnected={isConnected}
        peers={peers}
        playerName={multiplayerManager.playerName}
        onSetPlayerName={(name) => multiplayerManager.setPlayerName(name)}
        onHostSession={handleHostSession}
        onJoinSession={handleJoinSession}
        onLeaveSession={handleLeaveSession}
        onSendMessage={handleSendChatMessage}
        chatMessages={chatMessages}
        initialJoinCode={inviteRoomCode}
      />

      <ControlsGuideModal
        isOpen={activeModal === 'controls'}
        onClose={() => setActiveModal(null)}
      />

      <SourceExporterModal
        isOpen={activeModal === 'devtools'}
        onClose={() => setActiveModal(null)}
        files={workspaceFiles}
      />
    </div>
  );
}
