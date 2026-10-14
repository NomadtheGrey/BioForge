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
} from './types/game';
import { INITIAL_CODEX, ITEMS } from './game/constants';
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
    setPlayerTransform,
    setStamina,
    restorePlayerState,
  } = usePlayerState();

  // ------------------------------------------------------------------------
  // Loaded Fertilizer Cycling (mouse wheel / ArrowUp / ArrowDown)
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
  // Current Biome Indicator
  const getCurrentBiomeName = useCallback((): string => {
    const { x, z } = playerPosRef.current;
    if (x <= 0 && z <= 0) return 'Violet Cradle';
    if (x > 0 && z <= 0) return 'Turquoise Glade';
    if (x <= 0 && z > 0) return 'Amber Thicket';
    return 'Prismatic Verge';
  }, []);

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

        const moveResult = movementController.current.update(
          dt,
          playerPosRef.current.x,
          playerPosRef.current.z,
          engineRef.current.camera,
          inputState,
          isPaused,
          structuresListRef.current,
          floraListRef.current
        );

        playerPosRef.current.x = moveResult.x;
        playerPosRef.current.z = moveResult.z;

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
              activeToolRef.current
            );
          }
        }

        // Update Camera & Viewmodel dynamics using the exact same dt
        engineRef.current.setPlayerPosition(moveResult.x, moveResult.z);
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
            const gx = Math.round(pt.x / 2);
            const gz = Math.round(pt.z / 2);
            engineRef.current.setGhostPreview(
              selectedStructureRef.current,
              true,
              gx,
              gz,
              liveGameRefs.current.getPlacementRotation(),
              liveGameRefs.current.hasItem(selectedStructureRef.current, 1)

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
  }, [activeModal, isPointerLocked, setActiveTool, playerState.activeTool, cycleLoadedFertilizer]);

  // Mouse wheel cycles the loaded fertilizer while the trowel is equipped.
  // Guarded like the keyboard handler: no cycling while a modal is open.
  // A short cooldown keeps one physical scroll notch from spinning through
  // the whole rotation on high-resolution wheels.
  const lastWheelCycleRef = useRef(0);
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      if (activeModal !== null) return;
      if (playerState.activeTool !== 'planter_trowel') return;
      if (e.deltaY === 0) return;
      const now = performance.now();
      if (now - lastWheelCycleRef.current < 150) return;
      lastWheelCycleRef.current = now;
      cycleLoadedFertilizer(e.deltaY > 0 ? 1 : -1);
    };

    window.addEventListener('wheel', handleWheel);
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [activeModal, playerState.activeTool, cycleLoadedFertilizer]);

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
// what a save stores as its world).
const buildWorldSnapshot = (): WorldSnapshot => {
  const s = latestStateRef.current;
  return { flora: s.floraList, fauna: s.faunaList, structures: s.structuresList, drops: s.droppedItems };
};

// Player state for a save: the React state holds vitals and tool picks,
// but the live position truth is playerPosRef (the game loop moves the
// ref every tick) — so position is overlaid from the ref.
const buildCurrentPlayerState = () => ({
  ...latestStateRef.current.playerState,
  x: playerPosRef.current.x,
  z: playerPosRef.current.z,
  rotation: playerPosRef.current.rotation,
});

// Writes the current session to its save slot. The two guard clauses
// are the whole safety story: no save attached → nothing to write;
// connected as a guest → the world belongs to the host, never save it.
const saveNow = useCallback((): void => {
  const meta = currentSaveRef.current;
  if (!meta) return;
  if (multiplayerManager.isConnected && !multiplayerManager.isHost) return;
  const s = latestStateRef.current;
  const record = buildSavedGame(meta, buildWorldSnapshot(), s.inventory, buildCurrentPlayerState(), s.dayNightCycle, s.codexList);
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
      structures: INITIAL_STRUCTURES,
      drops: [],
    });
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
      onPeerMove: (peerId, px, pz, prot) => {
        const peer = peers.find((p) => p.id === peerId);
        engineRef.current?.updatePeerAvatar(peerId, peer?.name || 'Explorer', px, pz, prot, peer?.color || '#38bdf8');
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
      multiplayerManager.broadcastPlayerMove(pos.x, pos.z, pos.rotation, activeToolRef.current);
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
        currentBiomeName={getCurrentBiomeName()}
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
