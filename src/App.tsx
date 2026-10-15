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
  ToolType,
  QuestProgressState,
} from './types/game';
import {
  INITIAL_CODEX,
  ITEMS,
  NON_BUILDABLE_STRUCTURE_IDS,
  getRecipeTier,
} from './game/constants';
import { BioForgeThreeEngine } from './game/threeEngine';
import { soundEngine } from './audio/soundEngine';
import { multiplayerManager, EntityKind, EntitySnapshot } from './game/multiplayer';

import { FirstPersonMovementController, ControllerInputState } from './game/controller';

// Modular Domain Hooks (Enforces CODE_MANIFESTO.md Rule 8)
import { useInventory } from './hooks/useInventory';
import { useNotifications } from './hooks/useNotifications';
import { usePlayerState } from './hooks/usePlayerState';
import { useWorldEntities, INITIAL_STRUCTURES } from './hooks/useWorldEntities';
import { generateSeededWorld } from './game/worldGen';
import { generateGameCavern, generateGameCavernLevel, cavernCellToWorld, cavernEntryYaw, cavernStratumName, type CavernResult } from './game/cavern';
import { generateGameRuin, ruinEntryYaw, ruinCollisionGrid, type RuinResult } from './game/ruinInterior';
import { FATE_STYLES, type RuinVariantId, type WorldFate } from './game/ruins';
import {
  zoneInfo,
  zoneBiomeAt,
  biomeDisplayName,
  SPAWN_ZONE,
  zoneCoordsAt,
  zoneHops,
  zoneKey,
  zoneHudLabels,
  type ZoneCoords,
} from './game/zones';
import { routeForZoneTag, storeEntityEvent, snapshotOf, buildZoneSyncTravel as buildZoneSyncTravelPayload, type ZoneStores } from './game/zoneSync';
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
import { QuestLogModal } from './components/QuestLogModal';
import { TOOL_NAMES } from './game/quests';
import { useQuests } from './hooks/useQuests';
import { useStorage } from './hooks/useStorage';
import { useDebugKit } from './hooks/useDebugKit';
import { useZoneTravel, ZONE_ID_INSTALLED, WORLD_EDGE_COORD, ZONE_PUSH_SECONDS, ZONE_PUSH_MIN_COMPONENT } from './hooks/useZoneTravel';
import { useInstances } from './hooks/useInstances';
import { useSaveSession } from './hooks/useSaveSession';
import { useMultiplayerSync } from './hooks/useMultiplayerSync';
import { TouchControls, type TouchMoveInput } from './components/TouchControls';
import { BioForgeModal } from './components/BioForgeModal';
import { InventoryModal } from './components/InventoryModal';
import { StorageModal } from './components/StorageModal';
import { POUCH_TIER_CAPS, pouchTierOf } from './game/pouch';
import { CodexModal } from './components/CodexModal';
import { MultiplayerModal } from './components/MultiplayerModal';
import { ControlsGuideModal } from './components/ControlsGuideModal';
import { SourceExporterModal } from './components/SourceExporterModal';
import { getProjectWorkspaceFiles } from './utils/workspaceFiles';

// The gauntlet-module epoch (2026-10-15): worlds CREATED before
// this moment played by the free-tools rules and keep the full tool
// set (see modulesGrandfathered in App). Noon EDT on build day —
// comfortably after the last pre-module world could be created.
const GAUNTLET_MODULE_EPOCH_MS = Date.UTC(2026, 9, 15, 16, 0, 0);

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
    setOverflowHandler,
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
    setQuestProgress,
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
    spawnDroppedItem,
    replaceWorld,
  } = useWorldEntities();

  // 2. Modals & UI States
  const [activeModal, setActiveModal] = useState<
    'bioforge' | 'inventory' | 'codex' | 'multiplayer' | 'controls' | 'devtools' | 'quests' | 'storage' | null
  >(null);
  // Which storage pod the StorageModal shows (id; entity re-read live).
  const [storageTargetId, setStorageTargetId] = useState<string | null>(null);
  const [codexList, setCodexList] = useState<CodexEntry[]>(INITIAL_CODEX);
  const [dayNightCycle, setDayNightCycle] = useState<number>(0.35);
  const [isMuted, setIsMuted] = useState(false);
  const [isPointerLocked, setIsPointerLocked] = useState(false);
  // Touch-first devices (phones, tablets) have NO pointer lock —
  // mouse-look's lock simply doesn't exist there. On such a device
  // the game must run unlocked: no lock invitation, and the sim
  // doesn't pause waiting for a lock that can never engage.
  // Detected once from the primary pointer type ('coarse' = a
  // finger is the main pointer; mouse-driven devices say 'fine').
  const [touchMode] = useState<boolean>(
    () =>
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  );
  const [hoverInfo, setHoverInfo] = useState<HoverTarget>(null);

  // Memoized workspace virtual file map for Developer Exporter Tool
  const workspaceFiles = useMemo(() => getProjectWorkspaceFiles(), []);

  // Minimap position state updated smoothly during frame/tick
  const [minimapPos, setMinimapPos] = useState({ x: playerState.x, z: playerState.z, rotation: playerState.rotation });
  const lastMinimapUpdateTime = useRef(0);

  // Movement Keys & High-Frequency Refs (Rule 3: Performance & Memoization)
  const keysPressed = useRef<Record<string, boolean>>({});
  const lastWTap = useRef(0);
  const sprinting = useRef(false);
  // The touch thumbstick's latest direction, in exactly the shape
  // the movement loop consumes. It lives in a ref (not state) for the
  // same reason keysPressed does: pointer moves arrive far faster
  // than React needs to re-render, and the frame loop reads it live.
  const touchInputRef = useRef<TouchMoveInput>({
    forward: false,
    backward: false,
    left: false,
    right: false,
    sprint: false,
  });
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
  const touchModeRef = useRef(touchMode);

  // ------------------------------------------------------------------
  // Full screen (Adam, 2026-10-14): "the browser borders obscure the
  // play screen." The browser's chrome — URL bar, nav buttons — is
  // not ours to style away, but the Fullscreen API hands us the
  // whole display. Two doors in: the HUD's toggle button (the
  // option, both directions, everyone), and an automatic request
  // when a TOUCH player enters a world — the tap that starts play
  // is the user gesture the browser demands, so it costs the player
  // nothing. iPhone Safari has no element fullscreen API; the calls
  // no-op there (caught) and the button simply never flips state.
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  useEffect(() => {
    const onFullscreenChange = (): void => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);
  const requestGameFullscreen = (): void => {
    try {
      void document.documentElement.requestFullscreen().catch(() => {
        /* refused (no gesture, or unsupported) — the HUD button remains */
      });
    } catch {
      /* no Fullscreen API on this browser */
    }
  };
  const toggleGameFullscreen = (): void => {
    if (document.fullscreenElement) {
      try {
        void document.exitFullscreen().catch(() => {});
      } catch {
        /* no-op */
      }
    } else {
      requestGameFullscreen();
    }
  };
  const enterFullscreenOnTouch = (): void => {
    if (touchModeRef.current && !document.fullscreenElement) requestGameFullscreen();
  };
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
  // Touch input adapters (phone controls)
  // ----------------------------------------------------------------------
  // TouchControls translates thumbs into these three calls. Keeping
  // the adapters this thin is deliberate: the stick writes the same
  // ref the frame loop already reads, look goes through the engine's
  // one camera entry point, and a tap calls the engine's center
  // interaction — the identical verbs the keyboard/mouse use.
  const handleTouchMoveChange = useCallback((input: TouchMoveInput): void => {
    touchInputRef.current = input;
  }, []);

  const handleTouchLook = useCallback((deltaX: number, deltaY: number): void => {
    engineRef.current?.applyTouchLook(deltaX, deltaY);
  }, []);

  const handleTouchInteract = useCallback((): void => {
    if (activeModalRef.current !== null) return;
    engineRef.current?.interactAtCenter();
  }, []);

  // ----------------------------------------------------------------------
  // Instances (hooks/useInstances.ts — seam 2 of the App refactor)
  // ----------------------------------------------------------------------
  // Cavern + ruin entry/exit, the descent stack, and per-cave
  // plantings live in the hook now; the destructured names are the
  // ones the rest of App already uses. Called BEFORE useZoneTravel:
  // the travel hook reads this hook's instanceRef.
  const {
    instanceRef, inCavern, inRuin, cavernDepth, cavePlantingsRef, plantingsKey,
    captureCavePlantings, handleEnterCave, handleDescendCave, handleExitCave,
    handleVineClimb, handleEnterRuin, handleExitRuin, resetInstanceState,
  } = useInstances({
    engineRef,
    playerPosRef,
    floraListRef,
    floraList,
    faunaList,
    structuresList,
    droppedItems,
    replaceWorld,
    applyPlayerLevel,
    postNotification,
  });

  // ------------------------------------------------------------------------
  // Zone travel (hooks/useZoneTravel.ts — seam 1 of the App refactor)
  // ------------------------------------------------------------------------
  // Where the player is in the zone grid, the visited-zones map, the
  // session seed, and the crossing verbs live in the hook now. The
  // destructured names are the ones the rest of App already uses.
  // saveNowRef bridges a definition-order gap: completeTravel wants
  // to save shortly after a crossing, but saveNow is defined further
  // down (the save-session seam) — App assigns it there, and the
  // hook only ever calls through the ref, after mount.
  const saveNowRef = useRef<() => void>(() => {});
  const {
    playerZone, setPlayerZone, playerZoneRef, visitedZonesRef, worldSeedRef,
    sessionSeed, setSessionSeed, edgePushRef, pendingTravelRef, cancelPendingTravel,
    travelToZoneRef, zoneStores, buildZoneSyncTravel, completeTravel,
  } = useZoneTravel({
    engineRef,
    playerPosRef,
    movementController,
    jumpRef,
    instanceRef,
    replaceWorld,
    applyPlayerLevel,
    postNotification,
    // Lazy closures: both bindings are defined below this call in
    // App's body; they are only exercised after mount.
    buildWorldSnapshot: () => buildWorldSnapshot(),
    getDayNightCycle: () => latestStateRef.current.dayNightCycle,
    saveNowRef,
  });

  // The descent stack: one frame per level ABOVE the current one,
  // pushed when the player goes down a shaft, popped on the climb
  // back. A frame keeps that level's whole world — its lists exactly
  // as they were the moment the player left — plus the shaft's world
  // position, which is where the player climbs back out.

  /** 'surface', or the instance the player is inside — cavern
   *  levels suffix the depth so co-op peers on different levels of
   *  the same cave stay invisible to each other; a ruin is one
   *  level, keyed by its landmark's instanceId alone. */
  const currentZoneId = useCallback((): string => {
    const inst = instanceRef.current;
    if (inst.kind === 'ruin') return inst.instanceId;
    // On the surface the zone tag names the ZONE ('zone:zx,zz') —
    // with independent zone travel, two players topside in different
    // zones are in different places: their avatars hide from each
    // other and their entity events stay in their own zone.
    if (inst.kind !== 'cavern') return `zone:${zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz)}`;
    return inst.depth > 1 ? `${inst.instanceId}#${inst.depth}` : inst.instanceId;
  }, []);

  // The tool hook's instance guard: building and planting belong to
  // the surface world; inside an instance the hook refuses them (the
  // cavern additionally allows glow-spore planting — ruins allow
  // nothing planted by hand).
  const instanceKindNow = useCallback(
    (): 'surface' | 'cavern' | 'ruin' => instanceRef.current.kind,
    []
  );

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
    onEnterRuin: handleEnterRuin,
    onExitRuin: handleExitRuin,
    instanceKind: instanceKindNow,
    tameFauna,
    setFaunaCommand,
    setCodexList,
    postNotification,
    onOpenBioForgeModal: openBioForgeModal,
    onOpenStorage: (structure) => {
      setStorageTargetId(structure.id);
      setActiveModal('storage');
    },
    spawnDroppedItem,
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
        // Paused while a modal is open — or, on mouse-driven
        // devices, while the pointer is unlocked. Touch devices
        // skip the lock half: they'd wait forever otherwise.
        const isPaused = (!isPointerLockedRef.current && !touchModeRef.current) || activeModalRef.current !== null;

        // Keyboard and thumbstick are two front ends on ONE input
        // state: a direction counts when either device asks for it.
        const touchInput = touchInputRef.current;
        const inputState: ControllerInputState = {
          forward: Boolean(keysPressed.current['w'] || keysPressed.current['arrowup'] || touchInput.forward),
          backward: Boolean(keysPressed.current['s'] || keysPressed.current['arrowdown'] || touchInput.backward),
          left: Boolean(keysPressed.current['a'] || keysPressed.current['arrowleft'] || touchInput.left),
          right: Boolean(keysPressed.current['d'] || keysPressed.current['arrowright'] || touchInput.right),
        };

        const wantSprint = (sprinting.current || touchInput.sprint) && staminaRef.current > 0;
        movementController.current.sprintMultiplier = wantSprint ? 1.6 : 1;

        // Inside an instance, the instance grid itself is the walls
        // (caverns use their grid raw; ruins pass the collision copy).
        const activeInstance = instanceRef.current;
        const cavernArg =
          activeInstance.kind === 'cavern'
            ? {
                grid: activeInstance.cavern.grid,
                width: activeInstance.cavern.width,
                height: activeInstance.cavern.height,
              }
            : activeInstance.kind === 'ruin'
              ? {
                  grid: activeInstance.collisionGrid,
                  width: activeInstance.ruin.width,
                  height: activeInstance.ruin.height,
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

        // Zone travel — push-through crossing (2026-10-15). On the
        // surface, leaning your movement into the world's edge for a
        // sustained beat steps you into the neighbouring zone. The
        // desired direction is rebuilt from the camera + input the
        // same way the controller does (forward = camera facing;
        // right = forward × up), because the collision-clamped
        // position alone can't tell leaning from standing.
        if (activeInstance.kind === 'surface' && !isPaused) {
          // A guest's pending crossing dies if they wander off the
          // edge they asked from — a late zone snapshot must never
          // teleport a player who has gone back to exploring.
          const pending = pendingTravelRef.current;
          if (pending) {
            const pp = playerPosRef.current;
            const stillThere =
              (pending.dir === 'E' && pp.x > 45) ||
              (pending.dir === 'W' && pp.x < -45) ||
              (pending.dir === 'S' && pp.z > 45) ||
              (pending.dir === 'N' && pp.z < -45);
            if (!stillThere) cancelPendingTravel();
          }
          const camDir = new THREE.Vector3();
          engineRef.current.camera.getWorldDirection(camDir);
          const camLen = Math.hypot(camDir.x, camDir.z) || 1;
          const fX = camDir.x / camLen;
          const fZ = camDir.z / camLen;
          const rX = -fZ;
          const rZ = fX;
          const fAmt = (inputState.forward ? 1 : 0) - (inputState.backward ? 1 : 0);
          const rAmt = (inputState.right ? 1 : 0) - (inputState.left ? 1 : 0);
          const wantX = fX * fAmt + rX * rAmt;
          const wantZ = fZ * fAmt + rZ * rAmt;
          const px = playerPosRef.current.x;
          const pz = playerPosRef.current.z;
          let pushDir: 'N' | 'S' | 'E' | 'W' | null = null;
          if (px >= WORLD_EDGE_COORD - 0.01 && wantX > ZONE_PUSH_MIN_COMPONENT) pushDir = 'E';
          else if (px <= -WORLD_EDGE_COORD + 0.01 && wantX < -ZONE_PUSH_MIN_COMPONENT) pushDir = 'W';
          else if (pz >= WORLD_EDGE_COORD - 0.01 && wantZ > ZONE_PUSH_MIN_COMPONENT) pushDir = 'S';
          else if (pz <= -WORLD_EDGE_COORD + 0.01 && wantZ < -ZONE_PUSH_MIN_COMPONENT) pushDir = 'N';
          if (pushDir) {
            const nowMs = performance.now();
            if (edgePushRef.current?.dir === pushDir && nowMs - edgePushRef.current.since >= ZONE_PUSH_SECONDS * 1000) {
              edgePushRef.current = null;
              travelToZoneRef.current?.(pushDir);
            } else if (edgePushRef.current?.dir !== pushDir) {
              edgePushRef.current = { dir: pushDir, since: nowMs };
            }
          } else {
            edgePushRef.current = null;
          }
        } else {
          edgePushRef.current = null;
        }

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
      // Q opens the mini-quest LIST — the one door to quest
      // management (tracking pick + the tracker HUD's checkbox).
      if (e.key.toLowerCase() === 'q') {
        setActiveModal((prev) => (prev === 'quests' ? null : 'quests'));
        return;
      }
      // ` swaps the pouch to the debug kit and back (development
      // tool, 2026-10-15 — see toggleDebugKit).
      if (e.code === 'Backquote') {
        toggleDebugKit();
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
        handleSelectTool(toolKeyMap[e.key]);
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

  // ------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // Save session (hooks/useSaveSession.ts — seam 3 of the App refactor)
  // --------------------------------------------------------------------------
  // The boot gate, the save library, saveNow + autosave, and the
  // library verbs live in the hook now; the destructured names are
  // the ones the rest of App already uses. (The gauntlet grandfather
  // check just below reads currentSaveRef from here.)
  const {
    hasStarted, setHasStarted, saveList, currentSaveRef, latestStateRef,
    buildWorldSnapshot, buildCurrentPlayerState, saveNow,
    applySavedGame, handleSelectSave, handleCreateSave, handleDeleteSave, handleManualSave,
  } = useSaveSession({
    engineRef,
    playerPosRef,
    instanceRef,
    playerZoneRef,
    setPlayerZone,
    visitedZonesRef,
    worldSeedRef,
    setSessionSeed,
    cavePlantingsRef,
    resetInstanceState,
    floraList,
    faunaList,
    structuresList,
    droppedItems,
    inventory,
    playerState,
    codexList,
    dayNightCycle,
    restoreInventory,
    restorePlayerState,
    setCodexList,
    setDayNightCycle,
    setQuestProgress,
    replaceWorld,
    enterFullscreenOnTouch,
    postNotification,
    // Lazy: the debug hook is called further down; saveNow only
    // reads the stash when a save actually happens.
    getDebugStashRef: () => debugStashRef,
    captureCavePlantings,
    plantingsKey,
  });

  // ------------------------------------------------------------------
  // Gauntlet modules + mini-quests (Adam, 2026-10-15)
  // ------------------------------------------------------------------
  // The derivation, the quest views, the completion latch, and the
  // progress writes live in hooks/useQuests.ts (extracted under the
  // App push-size trigger). What remains here is the grandfather
  // call — worlds created before the module system existed keep
  // the full tool set, and co-op guests (no local save) are
  // grandfathered too: a host's world shouldn't strand a guest
  // without tools — plus the gated tool selector below.
  const modulesGrandfathered =
    !currentSaveRef.current ||
    (currentSaveRef.current.createdAt ?? 0) < GAUNTLET_MODULE_EPOCH_MS;
  const questProgress = playerState.questProgress;
  const { unlockedTools, questViews, trackedView, showQuestHud, updateQuestProgress } =
    useQuests({
      inventory,
      grandfathered: modulesGrandfathered,
      questProgress,
      setQuestProgress,
      postNotification,
      hasStarted,
    });

  // Tool selection, gated: every path that can switch tools (the
  // 1-6 keys, hotbar clicks) funnels through here, so a locked tool
  // explains itself instead of silently equipping.
  const handleSelectTool = (tool: ToolType): void => {
    if (!unlockedTools.includes(tool)) {
      postNotification(
        'Module Not Grafted',
        `The ${TOOL_NAMES[tool]} is a gauntlet module — craft it at the Bio-Forge to unlock it. Your quest list [Q] shows the way.`,
        'alert',
        '#f59e0b',
      );
      return;
    }
    setActiveTool(tool);
  };

// Debug kit swap (backquote key): hooks/useDebugKit — the real
// pouch waits in debugStashRef and saveNow writes the stash while
// a swap is active, so a debug session can't pollute a save.
const { debugStashRef, toggleDebugKit } = useDebugKit({
  getInventory: () => latestStateRef.current.inventory,
  restoreInventory,
  postNotification,
});

// Pouch overflow + storage-pod transfers: hooks/useStorage.
const { handleStorageDeposit, handleStorageWithdraw, handleStorageUpgrade } =
  useStorage({
    getInventory: () => latestStateRef.current.inventory,
    getPlayerPosition,
    addInventoryItem,
    deductInventoryItem,
    upsertStructure,
    spawnDroppedItem,
    setOverflowHandler,
    postNotification,
  });
const pouchTierNow = pouchTierOf(inventory);

// The zone-travel hook saves through this ref after a crossing
// (see saveNowRef at the hook call) — point it at the real saveNow
// now that saveNow exists.
saveNowRef.current = saveNow;

// --------------------------------------------------------------------------
// Multiplayer sync (hooks/useMultiplayerSync.ts — seam 4 of the App refactor)
// --------------------------------------------------------------------------
// Session state, the manager callbacks, the zone-tag + heartbeat
// effects, and the session verbs live in the hook now; the
// destructured names are the ones the rest of App already uses.
const {
  roomCode, isHost, isConnected, peers, chatMessages, chatToasts, inviteRoomCode,
  handleJoinCoopFromStart, handleHostSession, handleJoinSession, handleLeaveSession,
  handleSendChatMessage,
} = useMultiplayerSync({
  engineRef, playerPosRef, playerLevelRef, activeToolRef, currentZoneId,
  playerZone, inCavern, inRuin,
  playerZoneRef, setPlayerZone, visitedZonesRef, worldSeedRef, setSessionSeed,
  zoneStores, buildZoneSyncTravel, completeTravel, cancelPendingTravel, pendingTravelRef,
  buildWorldSnapshot, latestStateRef, setHasStarted, setDayNightCycle, resetInstanceState,
  postNotification, enterFullscreenOnTouch, setActiveModal,
  upsertFlora, upsertFauna, upsertStructure, upsertDroppedItem,
  removeFlora, removeFauna, removeStructure, removeDroppedItem,
  addStructure, resetFloraHarvest, tameFauna, replaceWorld,
});

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

  // Where the way out is, while inside a cavern — the radar's violet
  // exit arrow (HUD → Minimap) aims at it. On the spawn zone's
  // surface: null (the minimap's own spawn arrow takes over). In a
  // FOREIGN zone the same arrow becomes the way HOME: it aims at
  // the edge midpoint on the homeward side(s), suppressing the
  // spawn arrow, which would otherwise point at this zone's own
  // center and lie about where home is.
  const caveExitTarget = useMemo(() => {
    if (!inCavern && !inRuin) {
      if (playerZone.zx === SPAWN_ZONE.zx && playerZone.zz === SPAWN_ZONE.zz) return null;
      return {
        x: playerZone.zx === 0 ? 0 : -Math.sign(playerZone.zx) * 47,
        z: playerZone.zz === 0 ? 0 : -Math.sign(playerZone.zz) * 47,
      };
    }
    const exit = structuresList.find((s) => s.type === 'cave_exit' || s.type === 'ruin_exit');
    return exit ? { x: exit.worldX, z: exit.worldZ } : null;
  }, [inCavern, inRuin, structuresList, playerZone]);

  // Crafting access: within 6m of a bio-forge station, or wearing a
  // gauntlet with the Field Synthesizer GRAFT. The base gauntlet is
  // issued to everyone (it's how you harvest and plant) — field
  // synthesis is the graft's gift, not the glove's (types pass,
  // 2026-10-15; before it, this read the gauntlet item itself).
  const checkCraftAccess = (): { nearForge: boolean; hasSynthesizer: boolean } => {
    const px = playerPosRef.current.x;
    const pz = playerPosRef.current.z;
    const nearForge = structuresListRef.current.some(
      (s) => s.type === 'bio_forge_station' && Math.hypot(s.worldX - px, s.worldZ - pz) < 6
    );
    const hasSynthesizer = (inventory['gauntlet_synthesizer_upgrade'] || 0) > 0;
    return { nearForge, hasSynthesizer };
  };

  const handleCraftRecipe = (recipe: CraftingRecipe) => {
    const access = checkCraftAccess();
    // Tier is DERIVED from the recipe graph (getRecipeTier) — a
    // recipe has no .tier field. This line read one anyway until
    // the 2026-10-15 types pass, which quietly meant tier-3 recipes
    // were craftable anywhere the gauntlet reached. Forge tether
    // restored: tier 3+ is forge-only, graft or no graft.
    const forgeOnly = getRecipeTier(recipe) >= 3;
    if (!access.nearForge && (forgeOnly || !access.hasSynthesizer)) {
      postNotification(
        'Synthesis Blocked',
        forgeOnly
          ? 'Advanced synthesis requires a bio-forge station.'
          : 'Too far from a bio-forge station — graft a Field Synthesizer onto your gauntlet to craft in the field.',
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
  // Zone identity for the HUD: the label set (current zone + the
  // country beyond the nearest edge) is computed by zones.ts
  // zoneHudLabels — helmet gate included (extracted 2026-10-15
  // under the App push-size trigger).
  const activeSeed = sessionSeed;
  const {
    name: currentZoneName,
    biomeLabel: currentZoneBiomeLabel,
    coordsLabel: zoneCoordsLabel,
    edgeLabel: edgeZoneLabel,
  } = zoneHudLabels(
    activeSeed,
    playerZone,
    playerPosRef.current.x,
    playerPosRef.current.z,
    ZONE_ID_INSTALLED,
  );

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

  // The storage pod the panel is showing, if it still stands.
  const storagePod =
    activeModal === 'storage' && storageTargetId
      ? structuresList.find((s) => s.id === storageTargetId && s.type === 'storage_pod')
      : undefined;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 cursor-crosshair" />

      {/* Phone controls: only on touch-first devices, only once a
          world is entered, and never underneath an open modal. The
          HUD renders after this layer, so its real buttons keep
          first claim on their own taps. */}
      {touchMode && hasStarted && activeModal === null && (
        <TouchControls
          onMoveChange={handleTouchMoveChange}
          onLook={handleTouchLook}
          onJump={attemptJump}
          onInteract={handleTouchInteract}
        />
      )}

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
        onSelectTool={handleSelectTool}
        unlockedTools={unlockedTools}
        onToolLocked={handleSelectTool}
        onOpenQuests={() => setActiveModal('quests')}
        questView={trackedView}
        showQuestHud={showQuestHud}
        onCycleSeed={cycleSelectedSeed}
        onCycleFertilizer={cycleLoadedFertilizer}
        onCycleStructure={cycleSelectedStructure}
        onOpenInventory={() => setActiveModal('inventory')}
        onOpenBioForge={() => setActiveModal('bioforge')}
        onOpenCodex={() => setActiveModal('codex')}
        onOpenMultiplayer={() => setActiveModal('multiplayer')}
        onOpenControls={() => setActiveModal('controls')}
        onOpenDevTools={() => setActiveModal('devtools')}
        onSave={handleManualSave}
        currentBiomeName={inCavern ? cavernStratumName(cavernDepth || 1) : inRuin ? 'Precursor Ruin' : currentZoneName}
        currentBiomeType={inCavern ? 'Cavern' : inRuin ? 'Ruin Interior' : currentZoneBiomeLabel}
        edgeZoneLabel={inCavern || inRuin ? null : edgeZoneLabel}
        zoneCoordsLabel={inCavern || inRuin ? 'Instanced Zone' : zoneCoordsLabel}
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
        touchMode={touchMode}
        isFullscreen={isFullscreen}
        onToggleFullscreen={toggleGameFullscreen}
        onRequestLock={() => { if (!touchMode) engineRef.current?.requestPointerLock(); }}
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
      <QuestLogModal
        isOpen={activeModal === 'quests'}
        onClose={() => setActiveModal(null)}
        views={questViews}
        completedIds={questProgress?.completedIds ?? []}
        trackedId={questProgress?.trackedId ?? null}
        showHud={showQuestHud}
        onToggleShowHud={(show) => updateQuestProgress({ showHud: show })}
        onTrack={(questId) => updateQuestProgress({ trackedId: questId })}
      />
      {/* The open storage pod (entity re-read live from the list). */}
      {activeModal === 'storage' && storagePod && (
        <StorageModal
          structure={storagePod}
          inventory={inventory}
          pouchCap={POUCH_TIER_CAPS[pouchTierNow]}
          onClose={() => {
            setActiveModal(null);
            setStorageTargetId(null);
          }}
          onDeposit={handleStorageDeposit}
          onWithdraw={handleStorageWithdraw}
          onUpgrade={handleStorageUpgrade}
        />
      )}
      <BioForgeModal
        isOpen={activeModal === 'bioforge'}
        onClose={() => setActiveModal(null)}
        inventory={inventory}
        nearForge={craftAccess.nearForge}
        hasSynthesizer={craftAccess.hasSynthesizer}
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
