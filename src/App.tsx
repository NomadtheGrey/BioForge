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
import { INITIAL_CODEX, ITEMS, NON_BUILDABLE_STRUCTURE_IDS, getRecipeTier } from './game/constants';
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
import { generateGameRuin, ruinEntryYaw, ruinCollisionGrid, type RuinResult } from './game/ruinInterior';
import { FATE_STYLES, type RuinVariantId, type WorldFate } from './game/ruins';
import { zoneInfo, zoneBiomeAt, biomeDisplayName, SPAWN_ZONE, zoneCoordsAt, zoneHops, zoneKey, type ZoneCoords } from './game/zones';
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
import {
  QUESTS,
  deriveUnlockedTools,
  questView,
  trackedQuest,
  TOOL_NAMES,
} from './game/quests';
import { TouchControls, type TouchMoveInput } from './components/TouchControls';
import { BioForgeModal } from './components/BioForgeModal';
import { InventoryModal } from './components/InventoryModal';
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
    replaceWorld,
  } = useWorldEntities();

  // 2. Modals & UI States
  const [activeModal, setActiveModal] = useState<
    'bioforge' | 'inventory' | 'codex' | 'multiplayer' | 'controls' | 'devtools' | 'quests' | null
  >(null);
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
  const instanceRef = useRef<InstanceState>({ kind: 'surface' });
  const [inCavern, setInCavern] = useState(false);
  const [inRuin, setInRuin] = useState(false);

  // ------------------------------------------------------------------------
  // Zone travel state (Adam's directive, 2026-10-15)
  // ------------------------------------------------------------------------
  // The world is a grid of zones; the player stands in exactly one.
  // Every VISITED zone keeps a snapshot here, persisting exactly as
  // left; unvisited zones aren't stored — they roll from (seed,
  // coords) on arrival. The host's map is the authority for
  // player-made changes across the country.
  const [playerZone, setPlayerZone] = useState<ZoneCoords>({ zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz });
  const playerZoneRef = useRef<ZoneCoords>({ zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz });
  const visitedZonesRef = useRef<Map<string, WorldSnapshot>>(new Map());
  // The seed of the world being played, whatever door the player came
  // through (own save → its seed; co-op guest → the host's seed, from
  // world_sync). Zone generation and zone identity both read it.
  const worldSeedRef = useRef<string>('');
  const [sessionSeed, setSessionSeed] = useState<string>('');
  // The sustained edge push, accumulated by the game loop: which edge
  // the player is leaning on, and since when. Push-through crossing:
  // hold your movement against the border for ZONE_PUSH_SECONDS and
  // you step through into the next zone.
  const edgePushRef = useRef<{ dir: 'N' | 'S' | 'E' | 'W'; since: number } | null>(null);
  // A GUEST's crossing, parked while waiting on the host: guests
  // never roll a zone themselves (Adam, 2026-10-15 — the host sends
  // zone info). travelToZone files the request; onZoneSnapshot
  // completes it. Walking off the edge or a silent host cancels it.
  interface PendingTravel {
    dir: 'N' | 'S' | 'E' | 'W';
    nx: number;
    nz: number;
    entryX: number;
    entryZ: number;
    slowTimer: number;
    failTimer: number;
  }
  const pendingTravelRef = useRef<PendingTravel | null>(null);
  const cancelPendingTravel = (): void => {
    const p = pendingTravelRef.current;
    if (!p) return;
    window.clearTimeout(p.slowTimer);
    window.clearTimeout(p.failTimer);
    pendingTravelRef.current = null;
  };
  // Set after travelToZone is defined (it lives further down, beside
  // the save handlers it collaborates with); the game loop calls
  // through this ref so definition order never matters.
  const travelToZoneRef = useRef<((dir: 'N' | 'S' | 'E' | 'W') => void) | null>(null);

  // Zone identification is a HELMET feature (Adam, 2026-10-15):
  // naming the land is a sense, and the helmet is the sensory
  // platform. No such helmet exists yet, so this is false for
  // everyone — labels carry the placeholder + upgrade message,
  // arrivals stay vague. When the helmet lands, this becomes an
  // equipment check and every gated label lights up at once.
  const ZONE_ID_INSTALLED = false;

  // Travel tuning: the movement clamp pins the player at ±48 (the
  // engine's WORLD_BOUNDARY in collision.ts); arriving players land
  // just inside the far side; a crossing asks for a deliberate
  // half-second-ish lean, long enough that bumping the wall while
  // exploring never triggers it by accident.
  const WORLD_EDGE_COORD = 48;
  const ZONE_ENTRY_INSET = 47.4;
  const ZONE_PUSH_SECONDS = 0.4;
  const ZONE_PUSH_MIN_COMPONENT = 0.35;
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
          structures.push({ ...base, id: `ruinheart_${link.instanceId}_${f.id}`, type: 'artifact_heart', ruinFeature: { fate, band: 'deep' } });
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
  const handleExitRuin = useCallback((): void => {
    const inst = instanceRef.current;
    if (inst.kind !== 'ruin') return;
    const landmark = inst.parked.structures.find((s) => s.id === inst.landmarkId);
    const exitX = landmark?.ruin?.exitX ?? 0;
    const exitZ = landmark?.ruin?.exitZ ?? 0;
    const facing = landmark ? Math.atan2(exitX - landmark.worldX, exitZ - landmark.worldZ) : 0;
    replaceWorld(inst.parked);
    engineRef.current?.setRuinMode(false);
    instanceRef.current = { kind: 'surface' };
    applyPlayerLevel(0);
    playerPosRef.current = { x: exitX, z: exitZ, rotation: facing };
    engineRef.current?.setPlayerPosition(exitX, exitZ, 0);
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

  // ------------------------------------------------------------------
  // Gauntlet modules + mini-quests (Adam, 2026-10-15)
  // ------------------------------------------------------------------
  // The gauntlet is the early game's progression spine: it starts
  // able to harvest only, and each other tool is a module crafted
  // at the forge (game/quests.ts holds the chain). Unlocks are
  // DERIVED from the pouch — owning a module item is the unlock —
  // with one exception: worlds created before the module system
  // existed are grandfathered to the full set (they earned their
  // tools under the old rules; nobody gets demoted). Co-op guests
  // have no local save and are grandfathered too — a host's world
  // shouldn't strand a guest without tools.
  const modulesGrandfathered =
    !currentSaveRef.current ||
    (currentSaveRef.current.createdAt ?? 0) < GAUNTLET_MODULE_EPOCH_MS;
  const unlockedTools = deriveUnlockedTools(inventory, modulesGrandfathered);
  const questViews = QUESTS.map((def) => questView(def, inventory, unlockedTools));
  const questProgress = playerState.questProgress;
  const trackedView = trackedQuest(
    questProgress?.completedIds ?? [],
    questProgress?.trackedId ?? null,
    questViews,
  );
  const showQuestHud = questProgress?.showHud ?? false;

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

  // Quest-progress writes, with silent adoption for veterans: the
  // first time a pre-quest save touches the system, everything its
  // (grandfathered) progress already satisfies is marked complete —
  // no toast parade for a chain finished under the old rules.
  const updateQuestProgress = (patch: Partial<QuestProgressState>): void => {
    if (questProgress) {
      setQuestProgress({ ...questProgress, ...patch });
      return;
    }
    setQuestProgress({
      completedIds: questViews.filter((v) => v.complete).map((v) => v.def.id),
      trackedId: null,
      showHud: false,
      ...patch,
    });
  };

  // Latch quest completions the moment they're earned: gather
  // objectives un-meet when the items get spent, so completion is
  // recorded, not re-derived forever. Veterans (no questProgress)
  // never latch — their adoption above seeds completions silently.
  const latchQuestKey = questProgress
    ? questViews
        .filter((v) => v.complete && !questProgress.completedIds.includes(v.def.id))
        .map((v) => v.def.id)
        .join(',')
    : '';
  useEffect(() => {
    if (!hasStarted || !latchQuestKey || !questProgress) return;
    const doneIds = latchQuestKey.split(',');
    setQuestProgress({
      ...questProgress,
      completedIds: [...questProgress.completedIds, ...doneIds],
    });
    doneIds.forEach((id) => {
      const def = QUESTS.find((q) => q.id === id);
      if (def) {
        postNotification(
          'Mini-Quest Complete',
          `${def.title} — nicely done. Press Q for the quest list and what comes next.`,
          'discover',
          '#34d399',
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latchQuestKey, hasStarted]);


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
  if (inst.kind !== 'surface') return inst.parked;
  const s = latestStateRef.current;
  return { flora: s.floraList, fauna: s.faunaList, structures: s.structuresList, drops: s.droppedItems };
};

// ------------------------------------------------------------------------
// Remote entity-event routing (zone travel, 2026-10-15)
// ------------------------------------------------------------------------
// Entity events arrive stamped with the sender's zone; the routing
// rules themselves live in game/zoneSync.ts (extracted on the
// push-size trigger). This adapter hands the router my stores: the
// visited-zones map, the parked surface while I'm inside one of its
// instances, and the session seed.
const zoneStores = (): ZoneStores => ({
  visited: visitedZonesRef.current,
  parked: () => (instanceRef.current.kind !== 'surface' ? instanceRef.current.parked : null),
  setParked: (snap: WorldSnapshot) => {
    const inst = instanceRef.current;
    if (inst.kind !== 'surface') inst.parked = snap;
  },
  seed: worldSeedRef.current,
  myZoneKey: zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz),
});

// Player state for a save: the React state holds vitals and tool picks,
// but the live position truth is playerPosRef (the game loop moves the
// ref every tick) — so position is overlaid from the ref. Inside a
// cavern, the saved position is the mouth's surface exit anchor: you
// wake up OUTSIDE the cave you were exploring, on solid ground.
const buildCurrentPlayerState = () => {
  const inst = instanceRef.current;
  if (inst.kind === 'ruin') {
    // Wake up OUTSIDE the ruin, at its landmark's exit anchor.
    const landmark = inst.parked.structures.find((s) => s.id === inst.landmarkId);
    const exitX = landmark?.ruin?.exitX ?? playerPosRef.current.x;
    const exitZ = landmark?.ruin?.exitZ ?? playerPosRef.current.z;
    return {
      ...latestStateRef.current.playerState,
      x: exitX,
      z: exitZ,
      rotation: landmark
        ? Math.atan2(exitX - landmark.worldX, exitZ - landmark.worldZ)
        : playerPosRef.current.rotation,
      level: 0,
    };
  }
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
  // Zone travel (2026-10-15): the record also carries every visited
  // zone's snapshot plus where the player is standing. The `world`
  // field above already holds the CURRENT zone's snapshot (the save
  // format's mirror rule); `zones` keeps the rest of the country.
  // buildWorldSnapshot covers the parked-surface case too — inside a
  // cave, the snapshot it returns IS the current zone's surface.
  record.zones = {
    ...Object.fromEntries(visitedZonesRef.current),
    [zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz)]: buildWorldSnapshot(),
  };
  record.currentZone = { ...playerZoneRef.current };
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

// The 2026-10-15 types pass, as an epoch: saves CREATED before it
// played by the old gauntlet rules (see the migration in
// applySavedGame). Midnight EDT on the day the pass landed.
const GAUNTLET_TYPES_PASS_EPOCH_MS = Date.UTC(2026, 9, 15, 4, 0, 0);

// Applies a loaded record to every state holder at once: world lists,
// pouch, player (state AND the loop's position ref), codex, and clock.
  const applySavedGame = (record: SavedGameRecord): void => {
    resetInstanceState();
    // The world's per-cave plantings come back with it (older saves
    // have none — an empty record, every cave wild).
    cavePlantingsRef.current = record.cavePlantings ?? {};
    // Zone travel (2026-10-15): restore the visited-zones map and the
    // zone the player saved in. Pre-travel saves have neither field:
    // their world IS the spawn zone, and the map starts from it.
    const restoredZones = new Map<string, WorldSnapshot>(Object.entries(record.zones ?? {}));
    const restoredZone: ZoneCoords = record.currentZone ?? { zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz };
    if (!restoredZones.has(zoneKey(restoredZone.zx, restoredZone.zz))) {
      restoredZones.set(zoneKey(restoredZone.zx, restoredZone.zz), record.world);
    }
    visitedZonesRef.current = restoredZones;
    playerZoneRef.current = restoredZone;
    setPlayerZone(restoredZone);
    worldSeedRef.current = record.worldSeed ?? '';
    setSessionSeed(record.worldSeed ?? '');
    replaceWorld(restoredZones.get(zoneKey(restoredZone.zx, restoredZone.zz)) ?? record.world);
    // Repaint the ground with the RESTORED zone's biome (pre-seed
    // saves pass null and keep the plain quadrant colors). This is
    // the only biome repaint on load — handleSelectSave used to do
    // it for the spawn zone before zones could be restored mid-map.
    engineRef.current?.setZoneBiome(record.worldSeed ? zoneBiomeAt(record.worldSeed, restoredZone.zx, restoredZone.zz) : null);
    // Gauntlet migration (types pass, 2026-10-15): the gauntlet is
    // issued equipment now, so every loaded world wears one — grant
    // it where an older save predates the starter kit. And fairness
    // for the old rules: before the pass, the ONLY way to hold a
    // gauntlet was to craft it for remote synthesis — a pre-pass
    // save holding one had paid for the graft's gift, so the graft
    // itself is granted. Post-pass saves can't false-trigger this:
    // their gauntlet is the starter, and createdAt says so.
    const migratedInventory = { ...record.inventory };
    if ((migratedInventory['field_synthesizer_gauntlet'] || 0) < 1) {
      migratedInventory['field_synthesizer_gauntlet'] = 1;
    } else if (
      record.createdAt < GAUNTLET_TYPES_PASS_EPOCH_MS &&
      (migratedInventory['gauntlet_synthesizer_upgrade'] || 0) < 1
    ) {
      migratedInventory['gauntlet_synthesizer_upgrade'] = 1;
    }
    restoreInventory(migratedInventory);
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
      enterFullscreenOnTouch();
      currentSaveRef.current = {
        id: record.id, name: record.name, difficulty: record.difficulty,
        worldSeed: record.worldSeed ?? '',
        createdAt: record.createdAt, savedAt: record.savedAt,
      };
      // (The biome repaint happens inside applySavedGame now — it
      // knows the zone the save was taken in.)
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
    enterFullscreenOnTouch();
    resetInstanceState();
    cavePlantingsRef.current = {};
    const meta = createSaveMetadata(name, difficulty, worldSeed);
    currentSaveRef.current = meta;
    // A new world starts the mini-quest chain fresh (2026-10-15):
    // nothing latched, the first quest tracked, the tracker HUD on
    // — the player can hide it from the quest list's checkbox [Q].
    setQuestProgress({ completedIds: [], trackedId: 'q_first_harvest', showHud: true });
    // The seed earns its keep: a new world's flora and fauna are GROWN
    // from it (seeded surface scatter — game/worldGen.ts) instead of
    // reusing the fixed hand-placed starter layout. Starter structures
    // (forge, floors, mound) stay fixed — they're the homestead, not
    // wilderness. Generate from meta.worldSeed: createSaveMetadata
    // guarantees a non-empty seed, and the world must match the seed
    // its save advertises.
    const generated = generateSeededWorld(meta.worldSeed);
    const spawnWorld: WorldSnapshot = {
      flora: generated.flora,
      fauna: generated.fauna,
      // Starter structures stay fixed (the homestead); world-grown
      // structures (v4: the spawn zone's cave mouth) join them here.
      structures: [...INITIAL_STRUCTURES, ...generated.structures],
      drops: [],
    };
    replaceWorld(spawnWorld);
    // Zone travel: a new world starts at home — the visited map
    // holds just the spawn zone (the very lists now live), the
    // player stands in it, and the session seed is this world's.
    visitedZonesRef.current = new Map([[zoneKey(SPAWN_ZONE.zx, SPAWN_ZONE.zz), spawnWorld]]);
    playerZoneRef.current = { zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz };
    setPlayerZone({ zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz });
    worldSeedRef.current = meta.worldSeed;
    setSessionSeed(meta.worldSeed);
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

  // ------------------------------------------------------------------------
  // Zone travel (2026-10-15)
  // ------------------------------------------------------------------------
  // A membership copy of the zone currently loaded — buildWorldSnapshot
  // already answers "the surface world" (the parked lists while inside
  // an instance, which ARE the current zone's surface); snapshotOf
  // (zoneSync.ts) copies the arrays so stored membership can't drift.
  const snapshotCurrentZone = (): WorldSnapshot => snapshotOf(buildWorldSnapshot());

  // The world_sync travel payload for the zone I stand in (zoneSync.ts).
  const buildZoneSyncTravel = (): { zone: string; zones: Record<string, WorldSnapshot>; worldSeed: string } =>
    buildZoneSyncTravelPayload(visitedZonesRef.current, zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz), buildWorldSnapshot(), worldSeedRef.current);

  // The crossing itself, once the far zone is IN HAND. Solo players
  // and hosts hold every zone already (their map, or a fresh roll of
  // their own seed); guests arrive here only with a host-sent
  // snapshot (hostSnapshot) — a guest never rolls a zone itself.
  const completeTravel = (nx: number, nz: number, entry: { x: number; z: number }, hostSnapshot?: WorldSnapshot): void => {
    // No crossing from underground: instances are entered from a
    // zone and exited back into it; the border out there isn't real.
    if (instanceRef.current.kind !== 'surface') return;
    const seed = worldSeedRef.current;
    if (!seed) return; // seedless contexts keep the single-zone world
    const cur = playerZoneRef.current;
    const pos = playerPosRef.current;
    // 1. Park the zone being left exactly as it stands — MINUS the
    //    pets set to Follow: they cross with their person (Adam,
    //    2026-10-15). Stay/guard pets keep their posts here, and
    //    this zone's snapshot goes back in the map either way.
    const leaving = snapshotCurrentZone();
    const followers = leaving.fauna.filter((f) => f.isTamed && f.command === 'follow');
    visitedZonesRef.current.set(zoneKey(cur.zx, cur.zz), {
      ...leaving,
      fauna: leaving.fauna.filter((f) => !(f.isTamed && f.command === 'follow')),
    });
    // 2. The far side: the host's snapshot when one was sent (and
    //    it joins my map as my copy of the truth); else a visited
    //    zone returns exactly as it was left; else — host or solo
    //    only — a new one rolls from (seed, coords), the coords a
    //    parameter of every roll.
    const nextKey = zoneKey(nx, nz);
    let target = hostSnapshot ?? visitedZonesRef.current.get(nextKey);
    if (hostSnapshot) visitedZonesRef.current.set(nextKey, hostSnapshot);
    if (!target) {
      const gen = generateSeededWorld(seed, nx, nz);
      target = { flora: gen.flora, fauna: gen.fauna, structures: gen.structures, drops: [] };
      visitedZonesRef.current.set(nextKey, target);
    }
    // Follow pets materialize beside their person in a loose ring,
    // already walking to the arrival point.
    const arrivals = followers.map((f, i) => ({
      ...f,
      x: entry.x + ((i % 3) - 1) * 1.6,
      z: entry.z + (Math.floor(i / 3) - 0.5) * 1.6,
      targetX: entry.x,
      targetZ: entry.z,
    }));
    replaceWorld({
      flora: target.flora,
      fauna: [...target.fauna, ...arrivals],
      structures: target.structures,
      drops: target.drops,
    });
    // 3. Stand there: identity, paint, position, story, momentum.
    playerZoneRef.current = { zx: nx, zz: nz };
    setPlayerZone({ zx: nx, zz: nz });
    engineRef.current?.setZoneBiome(zoneBiomeAt(seed, nx, nz));
    applyPlayerLevel(0);
    jumpRef.current = { y: 0, vy: 0, bounceFlip: false };
    playerPosRef.current = { x: entry.x, z: entry.z, rotation: pos.rotation };
    engineRef.current?.setPlayerPosition(entry.x, entry.z, 0);
    movementController.current.velocity.set(0, 0, 0);
    // 4. Announce the arrival — as fully as the player's gear
    //    allows. Zone identification is a helmet feature: without
    //    it the land stays unnamed, but dead reckoning (how far
    //    from home, which zone address) is the player's own.
    const hops = zoneHops(nx, nz);
    if (nx === SPAWN_ZONE.zx && nz === SPAWN_ZONE.zz) {
      postNotification('Home Again', 'The spawn zone — your homestead country.', 'system', '#38bdf8');
    } else if (ZONE_ID_INSTALLED) {
      const info = zoneInfo(seed, nx, nz);
      postNotification(info.name, `${biomeDisplayName(info.biome)} · ${hops} zone${hops === 1 ? '' : 's'} from home`, 'system', '#38bdf8');
    } else {
      postNotification('Unidentified Country', `${hops} zone${hops === 1 ? '' : 's'} from home · Zone ${nx}, ${nz} — a helmet zone identifier would name this land.`, 'system', '#38bdf8');
    }
    // 5. Persist shortly (the deferred beat lets the zone swap
    //    render first, the same trick world creation uses), and if
    //    hosting, re-sync the map so guests' copies stay true.
    window.setTimeout(() => saveNow(), 250);
    if (multiplayerManager.isConnected && multiplayerManager.isHost) {
      multiplayerManager.broadcastWorldSync(buildWorldSnapshot(), latestStateRef.current.dayNightCycle, buildZoneSyncTravel());
    }
  };
  // The edge push, resolved into a crossing. Called by the game
  // loop (through travelToZoneRef) when the lean has been
  // sustained. Solo players and hosts complete immediately; a
  // GUEST asks the host for the zone and waits at the border —
  // the host is the world's one source of truth, zones included.
  const travelToZone = (dir: 'N' | 'S' | 'E' | 'W'): void => {
    if (instanceRef.current.kind !== 'surface') return;
    if (pendingTravelRef.current) return; // one crossing at a time
    if (!worldSeedRef.current) return;
    const cur = playerZoneRef.current;
    const nx = dir === 'E' ? cur.zx + 1 : dir === 'W' ? cur.zx - 1 : cur.zx;
    const nz = dir === 'S' ? cur.zz + 1 : dir === 'N' ? cur.zz - 1 : cur.zz;
    // Arrive just inside the far edge, level with where you left on
    // the cross-axis, facing the way you were facing.
    const pos = playerPosRef.current;
    const clampAxis = (v: number): number => Math.max(-ZONE_ENTRY_INSET, Math.min(ZONE_ENTRY_INSET, v));
    const entry = {
      x: dir === 'E' ? -ZONE_ENTRY_INSET : dir === 'W' ? ZONE_ENTRY_INSET : clampAxis(pos.x),
      z: dir === 'S' ? -ZONE_ENTRY_INSET : dir === 'N' ? ZONE_ENTRY_INSET : clampAxis(pos.z),
    };
    if (multiplayerManager.isConnected && !multiplayerManager.isHost) {
      const pending: PendingTravel = { dir, nx, nz, entryX: entry.x, entryZ: entry.z, slowTimer: 0, failTimer: 0 };
      pending.slowTimer = window.setTimeout(() => {
        if (pendingTravelRef.current === pending) {
          postNotification('Crossing…', 'Waiting on the host to send that zone.', 'system', '#94a3b8');
        }
      }, 900);
      pending.failTimer = window.setTimeout(() => {
        if (pendingTravelRef.current === pending) {
          cancelPendingTravel();
          postNotification('No Answer From the Host', 'That zone never arrived — the way stays shut for now. Lean into the edge to try again.', 'system', '#f59e0b');
        }
      }, 6000);
      pendingTravelRef.current = pending;
      multiplayerManager.broadcastZoneRequest(zoneKey(nx, nz));
      return;
    }
    completeTravel(nx, nz, entry);
  };
  travelToZoneRef.current = travelToZone;

  // The co-op door: no local save involved. The guest plays in the
  // host's world; saveNow stays disarmed because currentSaveRef is null.
  const handleJoinCoopFromStart = (): void => {
    enterFullscreenOnTouch();
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
          multiplayerManager.broadcastWorldSync(buildWorldSnapshot(), latestStateRef.current.dayNightCycle, buildZoneSyncTravel());
        }
      },
      onPeerLeave: (peerId) => {
        setPeers(multiplayerManager.getConnectedPeers());
        engineRef.current?.removePeerAvatar(peerId);
      },
      onPeerMove: (peerId, px, pz, prot, _tool, level, zone) => {
        // Instances are separate spaces: a peer on the surface is not
        // standing in your cave, nor you in theirs — hide cross-zone
        // avatars instead of drawing them in the wrong world. (Old
        // builds tagged every surface position 'surface': read that
        // as the spawn zone, the only surface they knew.)
        const peerTag = zone === undefined || zone === 'surface' ? `zone:${zoneKey(SPAWN_ZONE.zx, SPAWN_ZONE.zz)}` : zone;
        if (peerTag !== currentZoneId()) {
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
      onEntityUpsert: (kind: EntityKind, entity: EntitySnapshot, zone?: string) => {
        // Zone routing: an upsert only touches the lists of the
        // zone it happened in (see routeForZoneTag). Untagged
        // events (older peers) keep the original live behavior.
        const route = zone === undefined ? 'live' : routeForZoneTag(zone, currentZoneId(), zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz), multiplayerManager.isHost);
        if (route === 'store') {
          storeEntityEvent(zoneStores(), zone as string, kind, entity);
          return;
        }
        if (route === 'drop') return;
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
      onEntityRemove: (kind: EntityKind, id: string, zone?: string) => {
        const route = zone === undefined ? 'live' : routeForZoneTag(zone, currentZoneId(), zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz), multiplayerManager.isHost);
        if (route === 'store') {
          storeEntityEvent(zoneStores(), zone as string, kind, null, id);
          return;
        }
        if (route === 'drop') return;
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
      onZoneRequest: (zone: string) => {
        // Host duty (the manager only calls this on the host): send
        // the zone from OUR record — the zone we're standing in
        // comes from the live/parked lists, a visited one from the
        // map, and a brand-new one we roll ourselves from our seed
        // and keep, so our record stays the only truth.
        const curKey = zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz);
        let snap = zone === curKey ? buildWorldSnapshot() : visitedZonesRef.current.get(zone);
        if (!snap) {
          const [zx, zz] = zone.split(',').map(Number);
          const seed = worldSeedRef.current;
          if (!seed || Number.isNaN(zx) || Number.isNaN(zz)) return;
          const gen = generateSeededWorld(seed, zx, zz);
          snap = { flora: gen.flora, fauna: gen.fauna, structures: gen.structures, drops: [] };
          visitedZonesRef.current.set(zone, snap);
        }
        multiplayerManager.broadcastZoneSnapshot(zone, snap, worldSeedRef.current);
      },
      onZoneSnapshot: (data) => {
        if (data.worldSeed && !worldSeedRef.current) {
          worldSeedRef.current = data.worldSeed;
          setSessionSeed(data.worldSeed);
        }
        const pending = pendingTravelRef.current;
        if (pending && zoneKey(pending.nx, pending.nz) === data.zone) {
          // The zone I asked for: complete the crossing with the
          // host's copy. (If I'd walked away, the tick already
          // cancelled the pending — this branch can't fire stale.)
          cancelPendingTravel();
          completeTravel(pending.nx, pending.nz, { x: pending.entryX, z: pending.entryZ }, data.world);
          return;
        }
        // Someone else's crossing, overheard: freshen my map with
        // the host's truth — unless it's the zone I'm standing in,
        // where my live lists and the event stream are fresher.
        if (data.zone !== zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz)) {
          visitedZonesRef.current.set(data.zone, data.world);
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
        // Zone travel (2026-10-15): the sync also lands us in the
        // host's CURRENT zone, adopts the host's visited-zones map
        // (their record of every zone's changes) and the world seed
        // — after this, we can wander off on our own and generate
        // the same wilderness the host would. Hosts on older builds
        // send none of it: the spawn-zone defaults below hold.
        if (data.worldSeed) {
          worldSeedRef.current = data.worldSeed;
          setSessionSeed(data.worldSeed);
        }
        const [hzx, hzz] = (data.zone ?? '0,0').split(',').map(Number);
        const hostZone: ZoneCoords = {
          zx: Number.isNaN(hzx) ? SPAWN_ZONE.zx : hzx,
          zz: Number.isNaN(hzz) ? SPAWN_ZONE.zz : hzz,
        };
        visitedZonesRef.current = new Map(Object.entries(data.zones ?? {}));
        playerZoneRef.current = hostZone;
        setPlayerZone(hostZone);
        replaceWorld({
          flora: data.flora,
          fauna: data.fauna,
          structures: data.structures,
          drops: data.drops,
        });
        if (worldSeedRef.current) {
          engineRef.current?.setZoneBiome(zoneBiomeAt(worldSeedRef.current, hostZone.zx, hostZone.zz));
        }
        setDayNightCycle(data.dayNightCycle);
      },
    });
  }, [peers, addStructure, removeStructure, resetFloraHarvest, tameFauna, postNotification, upsertFlora, removeFlora, upsertFauna, removeFauna, upsertStructure, upsertDroppedItem, removeDroppedItem, replaceWorld]);

  // Keep the multiplayer manager's zone stamp current: every entity
  // event this client sends is tagged with the zone it happened in
  // (the manager stamps centrally — see multiplayer.ts). The tag
  // changes exactly when zone identity does: travel (playerZone),
  // entering an instance (inCavern/inRuin), or leaving one.
  useEffect(() => {
    multiplayerManager.setCurrentZoneTag(currentZoneId());
  }, [playerZone, inCavern, inRuin, currentZoneId]);

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
  // Zone identity for the HUD (per-zone model — zones.ts)
  // ------------------------------------------------------------------------
  // The zone the player is standing in, from state (travel moves
  // it). Its name and biome derive from the world seed — BUT zone
  // identification is a HELMET feature (Adam, 2026-10-15): until a
  // helmet with the zone-identifier upgrade exists, the label does
  // not name the land. It carries the unidentified placeholder plus
  // the upgrade message in the sub-line; the coordinates stay,
  // because counting zones from home is dead reckoning, not a
  // sensor reading. Seedless contexts get the plain fallback.
  const activeSeed = sessionSeed;
  const currentZone = activeSeed ? zoneInfo(activeSeed, playerZone.zx, playerZone.zz) : null;
  const currentZoneName = !currentZone ? 'Starting Zone' : ZONE_ID_INSTALLED ? currentZone.name : 'Unidentified Country';
  const currentZoneBiomeLabel = !currentZone
    ? null
    : ZONE_ID_INSTALLED
      ? biomeDisplayName(currentZone.biome)
      : 'Zone Identifier not installed — a helmet upgrade reads the land';
  const zoneCoordsLabel = `Zone ${playerZone.zx}, ${playerZone.zz}`;

  // Edge label: within 10 m of the map border, name the zone beyond
  // the nearest edge — with the same helmet gate: pre-helmet you can
  // see there IS country that way (and push through into it), you
  // just can't name it. North is -Z, per the minimap's orientation.
  const edgeZoneLabel: string | null = (() => {
    if (!activeSeed) return null;
    const { x, z } = playerPosRef.current;
    const edges = [
      { dir: 'North', dist: 50 + z, zx: playerZone.zx, zz: playerZone.zz - 1 },
      { dir: 'South', dist: 50 - z, zx: playerZone.zx, zz: playerZone.zz + 1 },
      { dir: 'West', dist: 50 + x, zx: playerZone.zx - 1, zz: playerZone.zz },
      { dir: 'East', dist: 50 - x, zx: playerZone.zx + 1, zz: playerZone.zz },
    ];
    const nearest = edges.reduce((a, b) => (b.dist < a.dist ? b : a));
    if (nearest.dist > 10) return null;
    if (!ZONE_ID_INSTALLED) return `${nearest.dir} — Unidentified Country`;
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
