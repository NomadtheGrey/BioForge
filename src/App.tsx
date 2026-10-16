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
  QuestSignals,
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
  zoneVariantAt,
  zoneHybridAt,
  zoneWeatherAt,
  livingHeartAt,
  type ZoneCoords,
} from './game/zones';
import { LANDFORM_EPOCH_MS } from './game/terrain';
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
import { EMPTY_FIELD_NOTES, type FieldNotesState } from './game/fieldNotesBook';

import { StartScreenModal } from './components/StartScreenModal';

// UI Components
import { HUD } from './components/HUD';
import { QuestLogModal } from './components/QuestLogModal';
import { TOOL_NAMES, accessTierOf, MADE_SPECIES_IDS } from './game/quests';
import { BIOMES } from './game/biomes';
import { bestWeapon } from './game/weapons';
import type { WeaponDef } from './game/weapons';
import { useQuests } from './hooks/useQuests';
import { useStorage } from './hooks/useStorage';
import { useVat } from './hooks/useVat';
import { useDebugKit } from './hooks/useDebugKit';
import { useZoneTravel, ZONE_ID_INSTALLED, WORLD_EDGE_COORD, ZONE_PUSH_SECONDS, ZONE_PUSH_MIN_COMPONENT } from './hooks/useZoneTravel';
import { useInstances } from './hooks/useInstances';
import { useSaveSession } from './hooks/useSaveSession';
import { useMultiplayerSync } from './hooks/useMultiplayerSync';
import { useGameInput, JUMP_GRAVITY, STORY_HEIGHT_METERS } from './hooks/useGameInput';
import { useGameLoop } from './hooks/useGameLoop';
import { TouchControls, type TouchMoveInput } from './components/TouchControls';
import { BioForgeModal } from './components/BioForgeModal';
import { findTunnelMouths, type TunnelMouthRef } from './game/tunnel';
import { InventoryModal } from './components/InventoryModal';
import { StorageModal } from './components/StorageModal';
import { VatModal } from './components/VatModal';
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

// The landform epoch lives with the field itself (game/terrain.ts):
// worlds created before it keep the original uniform ripple as
// their ground — their land is part of their history, the same
// grandfathering the gauntlet modules got.

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
    setHealth,
    setPlayerLevel,
    restorePlayerState,
  } = usePlayerState();


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
    hearthFeed,
    setFaunaCommand,
    applyDissolve,
    strikeFauna,
    fireProjectile,
    releaseFauna,
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
    'bioforge' | 'inventory' | 'codex' | 'multiplayer' | 'controls' | 'devtools' | 'quests' | 'storage' | 'vat' | null
  >(null);

  // The striker slot's draw (weapons build, Adam, 2026-10-16):
  // which KIND of weapon slot 7 holds — 'close' or 'ranged'. The
  // drawn WEAPON derives from the pouch (best owned of the drawn
  // kind, the other kind when the drawn kind was never grown), and
  // the viewmodel hand re-grows whenever the draw changes.
  const [strikerDraw, setStrikerDraw] = useState<'close' | 'ranged'>('close');
  const strikerDrawRef = useRef<'close' | 'ranged'>('close');
  const drawnWeapon: WeaponDef | undefined =
    bestWeapon(inventory, strikerDraw) ?? bestWeapon(inventory, strikerDraw === 'close' ? 'ranged' : 'close');
  const drawnWeaponRef = useRef<WeaponDef | undefined>(undefined);
  useEffect(() => {
    strikerDrawRef.current = strikerDraw;
    drawnWeaponRef.current = drawnWeapon;
    if (drawnWeapon) engineRef.current?.setStrikerWeapon(drawnWeapon.itemId);
  }, [strikerDraw, drawnWeapon]);

  // Pay a strike's stamina (weapons build). Hoisted function
  // declaration on purpose: useToolInteractions composes ABOVE
  // useGameInput in this component, but staminaRef is the input
  // hook's — the body only ever runs at click time, long after
  // both hooks have run. False = too winded to strike.
  function spendStamina(amount: number): boolean {
    if (staminaRef.current < amount) return false;
    staminaRef.current = Math.max(0, staminaRef.current - amount);
    return true;
  }

  // Which storage pod the StorageModal shows (id; entity re-read live).
  const [storageTargetId, setStorageTargetId] = useState<string | null>(null);
  // Which culture vat the VatModal shows (id; entity re-read live).
  const [vatTargetId, setVatTargetId] = useState<string | null>(null);
  // The companion whose RELEASE is being confirmed (Adam,
  // 2026-10-15: release always asks first). The fauna rides
  // along so the dialog can say its name.
  const [pendingRelease, setPendingRelease] = useState<FaunaEntity | null>(null);
  const [codexList, setCodexList] = useState<CodexEntry[]>(INITIAL_CODEX);
  // Field Notes (dev wiring, 2026-10-16): the discovery notes the
  // player has unlocked by scanning and the named moments they
  // have witnessed. Saved with the world beside the codex; the
  // shape and the rules live in game/fieldNotesBook.ts.
  const [fieldNotesState, setFieldNotesState] = useState<FieldNotesState>(EMPTY_FIELD_NOTES);
  // Append-only unlock — the scanner's door. Deduped, so rescanning
  // an old friend never grows the book.
  const unlockFieldNotes = useCallback((noteIds: string[]) => {
    setFieldNotesState((prev) => {
      const fresh = noteIds.filter((id) => !prev.unlocked.includes(id));
      return fresh.length ? { ...prev, unlocked: [...prev.unlocked, ...fresh] } : prev;
    });
  }, []);
  // THE WITNESS SINK: every 'I was there' moment in the game calls
  // this one door (tool interactions today; sim-side moments ride
  // in on liveGameRefs). Append-only, deduped, silent — a record,
  // not an objective: nothing is rewarded for filling it.
  const recordFieldWitness = useCallback((noteId: string) => {
    setFieldNotesState((prev) =>
      prev.witnessed.includes(noteId)
        ? prev
        : { ...prev, witnessed: [...prev.witnessed, noteId] });
  }, []);
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
  // Jump state (vertical offset, velocity, pending story flip) —
  // owned here because three parties share it: game input sets it,
  // zone travel resets it, the game loop integrates it.
  const jumpRef = useRef({ y: 0, vy: 0, bounceFlip: false });
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
  // The visible spray (Adam, 2026-10-16): a jet from the player's
  // own position to the sprayed creature — the engine draws the
  // line, App just supplies where the player stands.
  const triggerSprayJetFx = useCallback(
    (x: number, z: number) => {
      const p = getPlayerPosition();
      engineRef.current?.triggerSprayJet(p.x, p.z, x, z);
    },
    [getPlayerPosition]
  );
  // The striker's tracer (weapons build, Adam, 2026-10-16): the
  // visible shot flies the same line at the same speed as the
  // sim's ledger entry — travel time derived from the drawn
  // weapon's table speed, so sight and resolution agree.
  const triggerShotFx = useCallback(
    (x: number, z: number, burst: boolean) => {
      const p = getPlayerPosition();
      const weapon = drawnWeaponRef.current;
      const speed = weapon?.projectileSpeed ?? 16;
      const travel = Math.hypot(x - p.x, z - p.z) / speed;
      engineRef.current?.triggerShotTracer(p.x, p.z, x, z, travel, burst);
    },
    [getPlayerPosition]
  );
  const getPlayerLevel = useCallback((): number => playerLevelRef.current, []);

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
    // worldSeedRef is declared BELOW this composition (it comes
    // from the save-session hook) — the lazy getter bridges it,
    // the established pattern for late refs in this file: the
    // getter body only runs on cave entry, long after the
    // declaration has executed.
    worldSeedRef: { get current() { return worldSeedRef.current; } },
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
    travelToZoneRef, zoneStores, buildZoneSyncTravel, completeTravel, respawnAtSpawn,
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
    // Lazy: the save session composes below; the getter is only
    // exercised on travel, long after mount (pond gate, P5 move 2).
    getWorldCreatedAt: () => currentSaveRef.current?.createdAt ?? 0,
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

  // Feeding the valley (Living, 2026-10-15): the satiation
  // deadline lives HERE because the tool hook composes before
  // the variant-effect refs below — App owns it; the loop and
  // the tool hook both read the same ref.
  const valleySatiatedUntilRef = useRef(0);

  // The BioTunnel (Adam, 2026-10-16): pairing is DERIVED from
  // the known world (game/tunnel.ts) — the live structure list
  // plus every visited zone's snapshot. Transit rides the zone-
  // travel machinery: the other mouth's zone loads exactly like a
  // border crossing (follow pets come through), and the gulp of
  // darkness is a fade the travel hides inside. Once the fade
  // closes you are inside the tunnel, and nothing interrupts it.
  const [tunnelFade, setTunnelFade] = useState(0);
  const tunnelBusyRef = useRef(false);
  const tunnelMouthsNow = (): TunnelMouthRef[] =>
    findTunnelMouths(structuresListRef.current, playerZoneRef.current, visitedZonesRef.current);
  const getTunnelMouthCount = useCallback((): number => tunnelMouthsNow().length, []);
  const annotateTunnelPairing = useCallback((structures: StructureEntity[]): void => {
    const paired = tunnelMouthsNow().length >= 2;
    structures.forEach((s) => {
      if (s.type === 'biotunnel_mouth') s.tunnel = { paired };
    });
  }, []);
  const onTunnelTransit = useCallback(
    (mouth: StructureEntity): void => {
      if (tunnelBusyRef.current) return;
      if (instanceRef.current.kind !== 'surface') {
        postNotification(
          'No Reach From Down Here',
          'The tunnel\'s body runs under the surface world — it cannot reach into the deep places.',
          'alert',
          '#fbbf24',
        );
        return;
      }
      const other = tunnelMouthsNow().find((m) => m.structure.id !== mouth.id);
      if (!other) {
        postNotification(
          'A Mouth Without Its Other Half',
          'This BioTunnel mouth hangs dark and still — its pair is gone. Grow the recipe again and set the other mouth down where the tunnel should lead.',
          'system',
          '#2dd4bf',
        );
        return;
      }
      tunnelBusyRef.current = true;
      setTunnelFade(1);
      window.setTimeout(() => {
        const o = other.structure;
        const fx = Math.sin(o.rotation ?? 0);
        const fz = Math.cos(o.rotation ?? 0);
        completeTravel(other.zone.zx, other.zone.zz, {
          x: o.worldX + fx * 2,
          z: o.worldZ + fz * 2,
        });
        postNotification(
          'The Tunnel Delivers You',
          'Darkness, one long gulp — and the other mouth lets you out. Nothing followed you through.',
          'system',
          '#2dd4bf',
        );
      }, 650);
      window.setTimeout(() => {
        setTunnelFade(0);
        tunnelBusyRef.current = false;
      }, 1750);
    },
    [completeTravel, postNotification],
  );

  // Ask the World signal bridge (Adam, 2026-10-16): the tool
  // interactions hook composes BEFORE useQuests in this file, so
  // its glyph/heart callbacks cannot call the quest writer
  // directly. They call through this ref instead — the real merge
  // function is assigned right after useQuests below, and clicks
  // only happen long after the whole composition has run (the
  // established lazy-bridge pattern of this file).
  const awMergeRef = useRef<(mutate: (s: QuestSignals) => QuestSignals) => void>(() => {});

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
    valleySatiatedUntilRef,
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
    hearthFeed,
    getDayNightCycle: () => latestStateRef.current.dayNightCycle,
    setFaunaCommand,
    setCodexList,
    fieldNotesState,
    unlockFieldNotes,
    recordFieldWitness,
    postNotification,
    onOpenBioForgeModal: openBioForgeModal,
    onOpenStorage: (structure) => {
      setStorageTargetId(structure.id);
      setActiveModal('storage');
    },
    onOpenVat: (structure) => {
      setVatTargetId(structure.id);
      setActiveModal('vat');
    },
    onTunnelTransit,
    getTunnelMouthCount,
    applyDissolve,
    strikeFauna,
    fireProjectile,
    strikerDrawRef,
    spendStamina,
    triggerShotFx,
    triggerStrikeHitFx: (x: number, z: number) => engineRef.current?.triggerStrikeBurst(x, z),
    onRequestRelease: (fauna) => setPendingRelease(fauna),
    // Ask the World: a glyph read names its ruin by structure id
    // (ruinglyph_<instanceId>_<feature>) — strip the prefix and
    // the trailing feature segment and the ruin's key remains.
    onGlyphRead: (glyphId) => {
      const ruinKey = glyphId.slice('ruinglyph_'.length, glyphId.lastIndexOf('_'));
      awMergeRef.current((s) => {
        const glyphRuins = s.glyphRuins ?? [];
        return glyphRuins.includes(ruinKey) ? s : { ...s, glyphRuins: [...glyphRuins, ruinKey] };
      });
    },
    onHeartReached: () => {
      awMergeRef.current((s) => (s.heart ? s : { ...s, heart: true }));
    },
    spawnDroppedItem,
    triggerHarvestFx,
    triggerSolventFx,
    triggerSprayJetFx,

  });

  const toolHandlersRef = useRef({
  handleGroundClick,
  handleFloraInteract,
  handleFaunaInteract,
  handleStructureInteract,
});
  const liveGameRefs = useRef({ hasItem, addInventoryItem, updateTick, postNotification, getPlacementRotation, recordFieldWitness });

  useEffect(() => {
    toolHandlersRef.current = {
      handleGroundClick,
      handleFloraInteract,
      handleFaunaInteract,
      handleStructureInteract,
    };
  liveGameRefs.current = { hasItem, addInventoryItem, updateTick, postNotification, getPlacementRotation, recordFieldWitness };
});
  // Zone identity (name + biome) is computed at render time from the
  // active world's seed — see the zone block just above the JSX return.
  // (The old quadrant-name indicator retired with the per-zone model:
  // a zone has ONE name and ONE biome, zones.ts.)

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
    fieldNotesState,
    dayNightCycle,
    restoreInventory,
    restorePlayerState,
    setCodexList,
    setFieldNotesState,
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

  // Landform context (P5 terrain move 1, Adam, 2026-10-16): keep
  // the engine's ground shaped for the world and zone the player
  // is actually in. Legacy = the save predates the landform epoch
  // (or no save is open — guests read their host's snapshot into
  // a local record, so their epoch is their own save's; a shape
  // mismatch across a co-op pair is cosmetic only, since heights
  // are rendered locally and never synced as state).
  useEffect(() => {
    const createdAt = currentSaveRef.current?.createdAt ?? 0;
    engineRef.current?.setTerrainContext(
      worldSeedRef.current,
      playerZone.zx,
      playerZone.zz,
      createdAt < LANDFORM_EPOCH_MS,
    );
  }, [playerZone, hasStarted]);
  const { unlockedTools, questViews, trackedView, showQuestHud, updateQuestProgress } =
    useQuests({
      inventory,
      grandfathered: modulesGrandfathered,
      questProgress,
      setQuestProgress,
      postNotification,
      hasStarted,
      // Ask the World rewards grant through the ordinary gain, so
      // pouch caps and the overflow drop apply as anywhere else.
      grantItems: (items) => {
        items.forEach((i) => addInventoryItem(i.itemId, i.count));
      },
    });

  // ------------------------------------------------------------------
  // Ask the World — signal writers (Adam, 2026-10-16)
  // ------------------------------------------------------------------
  // Small observers that record what the player has DONE and SEEN
  // into questProgress.signals; the line's quests derive their
  // completion from that record (game/quests.ts goalMet). Every
  // writer is a no-op until its fact changes, so these effects
  // cost a comparison per zone step, fauna change, or codex page.
  const questProgressRef = useRef(questProgress);
  questProgressRef.current = questProgress;
  awMergeRef.current = (mutate) => {
    const cur = questProgressRef.current;
    if (!cur) return;
    const before = cur.signals ?? {};
    const after = mutate(before);
    if (after !== before) updateQuestProgress({ signals: after });
  };

  // Zones stood in: families, hybrid country, the far families.
  useEffect(() => {
    if (!hasStarted || !worldSeedRef.current) return;
    const info = zoneInfo(worldSeedRef.current, playerZone.zx, playerZone.zz);
    const tier = BIOMES.find((b) => b.id === info.biome)?.tier ?? 0;
    awMergeRef.current((s) => {
      const families = s.families ?? [];
      const next: QuestSignals = { ...s };
      let changed = false;
      if (!families.includes(info.biome)) { next.families = [...families, info.biome]; changed = true; }
      if (info.hybrid && !s.hybrid) { next.hybrid = true; changed = true; }
      if (tier >= 3 && !s.tier3) { next.tier3 = true; changed = true; }
      return changed ? next : s;
    });
  }, [playerZone, hasStarted]);

  // Ruins entered, by instance.
  useEffect(() => {
    if (!hasStarted || !inRuin) return;
    const inst = instanceRef.current;
    if (inst.kind !== 'ruin') return;
    const id = inst.instanceId;
    awMergeRef.current((s) => {
      const ruins = s.ruins ?? [];
      return ruins.includes(id) ? s : { ...s, ruins: [...ruins, id] };
    });
  }, [inRuin, hasStarted]);

  // The vat's children (their ids carry the fauna_vat_ hatch
  // prefix) and the hearth dog's decision (a tamed hearth_dog).
  useEffect(() => {
    if (!hasStarted) return;
    const hatched = faunaList.some((f) => f.id.startsWith('fauna_vat_'));
    const dogBonded = faunaList.some((f) => f.species === 'hearth_dog' && f.isTamed);
    awMergeRef.current((s) => {
      if ((!hatched || s.hatched) && (!dogBonded || s.dogBonded)) return s;
      return { ...s, hatched: s.hatched || hatched, dogBonded: s.dogBonded || dogBonded };
    });
  }, [faunaList, hasStarted]);

  // Made things met, read off the codex's discovered pages.
  useEffect(() => {
    if (!hasStarted) return;
    const met = codexList
      .filter((e) => e.discovered && MADE_SPECIES_IDS.includes(e.species as string))
      .map((e) => e.species as string);
    awMergeRef.current((s) => {
      const prev = s.madeMet ?? [];
      return prev.length === met.length ? s : { ...s, madeMet: met };
    });
  }, [codexList, hasStarted]);

  // ------------------------------------------------------------------
  // Game input (hooks/useGameInput.ts — seam 5 of the App refactor)
  // ------------------------------------------------------------------
  // Movement/touch/stamina refs, cycling, jumping, touch adapters,
  // the gated tool selector, and the keyboard + wheel listeners live
  // in the hook now; the destructured names are the ones the game
  // loop and HUD already use.
  const {
    keysPressed, lastWTap, sprinting, touchInputRef, staminaRef, lastStaminaSync,
    cycleLoadedFertilizer, cycleSelectedSeed, cycleSelectedStructure,
    attemptJump, handleTouchMoveChange, handleTouchLook, handleTouchInteract, handleSelectTool,
  } = useGameInput({
    engineRef, jumpRef, playerPosRef, playerLevelRef, activeModalRef,
    activeModal, isPointerLocked, playerState, inventory,
    structuresListRef, floraListRef, bounceGraceUntil, unlockedTools,
    setActiveTool, setSelectedStructureType, setSelectedSeedId, setSelectedFertilizerId,
    setActiveModal, postNotification,
    // Lazy: useDebugKit is called just below (it reads the save
    // session's state mirror); the toggle fires on a keypress only.
    onToggleDebugKit: () => toggleDebugKit(),
    // The striker draw swap (weapons build): defined just below —
    // ref-driven, fires on the 7 key / wheel / tile click only.
    onToggleStrikerDraw: () => toggleStrikerDraw(),
    // Pond depth for the hop gate (P5 move 2): the engine owns the
    // current zone's pond list; input just asks.
    getWaterDepth: (x: number, z: number) => engineRef.current?.waterDepthAt(x, z) ?? 0,
  });

// The striker draw swap (weapons build, Adam, 2026-10-16): flip
// slot 7 between its close and ranged draws — but only when the
// other kind is actually grown; with one kind owned there is
// nothing to swap to and the key/wheel simply rests. Ref-driven
// (draw ref + the save session's inventory mirror) so the input
// hook's listeners can call it without stale state.
const toggleStrikerDraw = (): void => {
  const other = strikerDrawRef.current === 'close' ? 'ranged' : 'close';
  const weapon = bestWeapon(latestStateRef.current.inventory, other);
  if (!weapon) return;
  setStrikerDraw(other);
  postNotification(
    'Striker Drawn',
    `${ITEMS[weapon.itemId].name} — ${other === 'close' ? 'close' : 'ranged'} striker in hand.`,
    'system',
    '#facc15',
  );
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

// Culture-vat behaviors: hooks/useVat.
const { handleVatStart, handleVatUpgrade, handleVatHatch } = useVat({
  getInventory: () => latestStateRef.current.inventory,
  deductInventoryItem,
  upsertStructure,
  upsertFauna,
  getCurrentBiome: () => {
    const [zx, zz] = currentZoneId().split(',').map(Number);
    return zoneBiomeAt(worldSeedRef.current, zx || 0, zz || 0);
  },
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

  // --------------------------------------------------------------------------
  // Game loop (hooks/useGameLoop.ts — seam 6 of the App refactor)
  // --------------------------------------------------------------------------
  // The engine's creation, the authoritative per-frame loop, and
  // the engine-wiring effects live in the hook now. It returns
  // nothing: the loop reads the world through refs and writes back
  // through the same refs and setters it always used.
  // Variant effects (Adam, 2026-10-15): each variant carries ONE
  // player-facing effect; the loop reads these refs each tick. The
  // effect below keeps them honest as the player crosses zones and
  // posts each variant's one-time-per-world alert — which always
  // names the eventual gear answer (a helmet filter for spores,
  // Waders boots for the marsh drag).
  const sporeStaminaRef = useRef(false);
  const marshSluggishRef = useRef(false);
  const scarHeatRef = useRef(false);
  const thawColdRef = useRef(false);
  const stillColdRef = useRef(false);
  // Storm zots (2026-10-15): mean seconds between lightning
  // strikes (0 outside Storm country), the strike timer state
  // the loop owns, and the warning callback → the still-bright
  // banner below. The zot is FAIR: warned ~2.5s ahead, and any
  // roof/floor overhead (bridges included) takes the bolt.
  const stormZotRef = useRef(0);
  const zotStateRef = useRef({ timer: 20, warned: false });
  const onZotWarningRef = useRef<(() => void) | null>(null);
  const [zotWarn, setZotWarn] = useState(false);
  const zotWarnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onZotWarningRef.current = () => {
    setZotWarn(true);
    if (zotWarnTimeoutRef.current) clearTimeout(zotWarnTimeoutRef.current);
    zotWarnTimeoutRef.current = setTimeout(() => setZotWarn(false), 2300);
  };
  // The Living (2026-10-15): temperament refs + the grab cue.
  // The valley satiation deadline is shared: useToolInteractions
  // pushes it forward when a heartbloom is fed; the loop obeys.
  const livingWelcomeRef = useRef(false);
  const livingHungerRef = useRef(false);
  const livingTwomindedRef = useRef(false);
  const livingHeartRef = useRef<{ x: number; z: number; r: number } | null>(null);
  const grabStateRef = useRef({ timer: 14, warned: false, warnX: 0, warnZ: 0 });
  const grabSnareUntilRef = useRef(0);
  const onGrabWarningRef = useRef<(() => void) | null>(null);
  const [grabWarn, setGrabWarn] = useState(false);
  const grabWarnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  onGrabWarningRef.current = () => {
    setGrabWarn(true);
    if (grabWarnTimeoutRef.current) clearTimeout(grabWarnTimeoutRef.current);
    grabWarnTimeoutRef.current = setTimeout(() => setGrabWarn(false), 2000);
  };
  const healthRef = useRef(100);
  const lastHealthSync = useRef(0);
  // Death + respawn (Adam, 2026-10-15): the loop fires
  // onPlayerDeathRef when health reaches 0 on a world where death
  // is armed (Normal/Hostile — Peaceful floors health at 1). The
  // handler restores the vitals and wakes the player at the
  // ORIGINAL SPAWN BASE via the travel hook. The pouch is
  // untouched: the land took your strength, not your things.
  const deathArmedRef = useRef(false);
  const playerDeadRef = useRef(false);
  const onPlayerDeathRef = useRef<(() => void) | null>(null);
  // The loop drains healthRef under scar heat; player state is the
  // record of truth whenever anything else writes it (loads, heals).
  useEffect(() => {
    healthRef.current = playerState.health;
  }, [playerState.health]);
  const variantAlertedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    // The margin check comes FIRST (2026-10-15): a hybrid zone's
    // face is its hybrid def — variant suppressed, effects read
    // from whichever face the zone wears.
    const hybrid = sessionSeed ? zoneHybridAt(sessionSeed, playerZone.zx, playerZone.zz) : null;
    const variant = hybrid ? null : (sessionSeed ? zoneVariantAt(sessionSeed, playerZone.zx, playerZone.zz) : null);
    const faceEffect = variant?.effect ?? hybrid?.def.effect ?? null;
    // Weather (2026-10-15): the zone's sky, resolved in zones.ts;
    // the engine renders it and hides it indoors on its own.
    if (sessionSeed) {
      const sky = zoneWeatherAt(sessionSeed, playerZone.zx, playerZone.zz);
      engineRef.current?.setWeather(sky.mode, sky.intensity);
    }
    deathArmedRef.current = (currentSaveRef.current?.difficulty ?? 'peaceful') !== 'peaceful';
    sporeStaminaRef.current = faceEffect === 'spore_stamina';
    marshSluggishRef.current = faceEffect === 'marsh_sluggish';
    scarHeatRef.current = faceEffect === 'scar_heat';
    thawColdRef.current = faceEffect === 'thaw_cold';
    stillColdRef.current = faceEffect === 'frost_stillcold';
    // Storm zots are FAMILY-wide (2026-10-15): plain Storm zones
    // zot at the family default (35s); variants carry their own
    // interval (Dunes angry, Skyfall calm).
    stormZotRef.current = sessionSeed && zoneBiomeAt(sessionSeed, playerZone.zx, playerZone.zz) === 'storm'
      ? (variant?.zotIntervalSec ?? 35)
      : 0;
    // The Living's temperaments (2026-10-15): the variant IS the
    // mood. Two-Minded carries living_hunger as its effect id;
    // the loop splits it by the heart thicket (livingHeartRef).
    livingWelcomeRef.current = variant?.effect === 'living_welcome';
    livingHungerRef.current = variant?.effect === 'living_hunger' && variant?.id !== 'twominded_valley';
    livingTwomindedRef.current = variant?.id === 'twominded_valley';
    livingHeartRef.current = variant?.id === 'twominded_valley' && sessionSeed
      ? livingHeartAt(sessionSeed, playerZone.zx, playerZone.zz)
      : null;
    // The Content Valley (2026-10-15): plain Living zones have no
    // variant, so the variant chain below never speaks for them —
    // the family's home face gets its own one-time word.
    if (sessionSeed && !variant && !hybrid && zoneBiomeAt(sessionSeed, playerZone.zx, playerZone.zz) === 'living') {
      const plainKey = `${sessionSeed}:living:plain`;
      if (!variantAlertedRef.current.has(plainKey)) {
        variantAlertedRef.current.add(plainKey);
        postNotification(
          'The Content Valley',
          'This whole valley is one organism — the purple-black grass is its skin, and somewhere in it beats a single heartbloom. It knows you are here. It does not mind. Not all of its moods are this calm.',
          'system',
          '#c084fc',
        );
      }
    }
    if (hybrid && sessionSeed) {
      const key = `${sessionSeed}:hybrid:${hybrid.def.id}`;
      if (!variantAlertedRef.current.has(key)) {
        variantAlertedRef.current.add(key);
        if (hybrid.def.id === 'ember|wetland') {
          postNotification(
            'The Scalding Fens',
            'Where marsh meets ember, the land compromises in steam: hot pools, warm mud, and heat that taxes you by day like the Scar itself. The water did not put the fire out. They negotiated.',
            'system',
            '#fdba74',
          );
        } else if (hybrid.def.id === 'fungal|meadow') {
          postNotification(
            'The Mulchwood',
            'Meadow grass over fungal dark — a soft, rich, spore-sweet wood. The air taxes your stamina gently, as in the Hollow; the ground gives back more than it takes.',
            'system',
            '#bef264',
          );
        } else if (hybrid.def.id === 'saltglass|wetland') {
          postNotification(
            'The Brine Shallows',
            'Salt country dissolving into marsh: bright pans, dark water, life armored against both. Neither family won here. Both stayed.',
            'system',
            '#99f6e4',
          );
        } else if (hybrid.def.id === 'ember|storm') {
          postNotification(
            'The Iron Ashes',
            'Burned country under a charged sky. The zots still fall here — keep a roofline in reach, as in any Storm zone.',
            'system',
            '#fca5a5',
          );
        } else if (hybrid.def.id === 'frost|rootwood') {
          postNotification(
            'The Frozen Forest',
            'Trees standing in frost country, rimed and silent, roots locked in white ground. The wood endures; so does the cold.',
            'system',
            '#bae6fd',
          );
        } else {
          postNotification(
            hybrid.def.name,
            'Margin country — two lands meeting, and the blend growing where they touch. Life from both families grows here; the zone ahead and behind stay purely themselves.',
            'system',
            '#e7e5e4',
          );
        }
      }
    }
    if (variant && sessionSeed) {
      const key = `${sessionSeed}:${variant.id}`;
      if (!variantAlertedRef.current.has(key)) {
        variantAlertedRef.current.add(key);
        if (variant.id === 'fungal_hollow') {
          postNotification(
            'Spore-Thick Air',
            'Spore-thick air fills this Fungal Hollow, and it taxes your stamina as you move. A helmet with a filter upgrade will answer it; until then, cross briskly and rest at the edges.',
            'system',
            '#a78bfa',
          );
        } else if (variant.id === 'ember_scar') {
          postNotification(
            'The Ember Scar',
            'By day, the heat of this place drinks your stamina — and at empty stamina it starts on your health. But its nights are warm: rest here after dark and strength returns fast. Cross at dawn.',
            'system',
            '#fb923c',
          );
        } else if (variant.id === 'ashen_drift') {
          postNotification(
            'The Ashen Drift',
            'Deep ash swallows light here — every lantern dies young and the dark leans close. Walk by your brightest lights, and keep them near.',
            'system',
            '#a8a29e',
          );
        } else if (variant.id === 'obsidian_garden') {
          postNotification(
            'The Obsidian Garden',
            'Black glass flowers grow from the old burning — beautiful, sharp, and worth a shard to anyone building with light in mind.',
            'system',
            '#c4b5fd',
          );
        } else if (variant.id === 'saltglass_flats') {
          postNotification(
            'The Flats',
            'An endless salt pan under a doubled sun-glare — every light you carry burns half again as bright, and there is nothing else here at all.',
            'system',
            '#e2e8f0',
          );
        } else if (variant.id === 'saltglass_thaw') {
          postNotification(
            'The Thaw',
            'Freeze-thaw country, mild by day — but its nights bite: the cold drinks your stamina after dark. Cross by daylight, or do not stop moving.',
            'system',
            '#93c5d8',
          );
        } else if (variant.id === 'saltglass_prism') {
          postNotification(
            'The Prism Beds',
            'Crystal reeds grow here in fused beds, humming faintly at noon — saltglass the desert grew itself. Harvest the blades for shards.',
            'system',
            '#5eead4',
          );
        } else if (variant.id === 'frost_stillwhite') {
          postNotification(
            'The Stillwhite',
            'The cold here never sleeps — it drinks your stamina day and night alike, slowly, without malice. There is no warm hour to wait for. Keep moving, or carry your rest with you.',
            'system',
            '#bfdbfe',
          );
        } else if (variant.id === 'frost_fangs') {
          postNotification(
            'The Ice Fangs',
            'Geysers frozen mid-eruption, older than the hills. The ice in them refuses the sun — harvest a tooth and carry winter in your pouch.',
            'system',
            '#a5d8ff',
          );
        } else if (variant.id === 'frost_singing') {
          postNotification(
            'The Singing Ice',
            'A frozen lake that booms under its own pressure and throws your lights far through the ice. Rare country. Listen a while.',
            'system',
            '#dbeafe',
          );
        } else if (variant.id === 'rootwood_canopy') {
          postNotification(
            'Rootwood Canopy',
            'The biggest roots in the world, with bright clearings between them — and bridges: root decks strung tower to tower. Click a vine ladder at a tower to climb up and walk the span.',
            'system',
            '#84cc16',
          );
        } else if (variant.id === 'rootwood_underroot') {
          postNotification(
            'The Underroot',
            'The canopy closes overhead here and the ground lives in gloom — light carries barely half as far. Walk by your lanterns.',
            'system',
            '#65a30d',
          );
        } else if (variant.id === 'rootwood_rootfall') {
          postNotification(
            'The Rootfall',
            'A giant came down here, long ago — split heartwood, rich soil, and heartroot stands growing thick in the wreck. Generous country.',
            'system',
            '#d9a05b',
          );
        } else if (variant.id === 'precursor_garden') {
          postNotification(
            'Precursor Garden',
            'Someone planted this — spirals of perfect blooms, still following instructions ten thousand years old. Harvest the blooms for living thread; the rows around them grow rich.',
            'system',
            '#d9f99d',
          );
        } else if (variant.id === 'precursor_untended') {
          postNotification(
            'The Untended',
            'A precursor garden with no gardener — the spiral gone feral, lush and tangled and dark. The blooms still grow here. So does everything else.',
            'system',
            '#a3b86b',
          );
        } else if (variant.id === 'precursor_tending') {
          postNotification(
            'The Tending Field',
            'The densest bloom spirals in the world — and the tenders still standing in the rows: huge grown things, hollow and long dead. They were never built. They were grown, and the gardens outlived them.',
            'system',
            '#e7f0b0',
          );
        } else if (variant.id === 'bonefields') {
          postNotification(
            'The Bonefields',
            'Fragments everywhere — ribs, shards, half a jaw — and flowers sheltering in their shade. The soil here remembers everything, and feeds it forward. Harvest gravebloom for bone meal.',
            'system',
            '#e2dac6',
          );
        } else if (variant.id === 'marrow_flats') {
          postNotification(
            'The Marrow Flats',
            'The richest soil in the world: death, fully composted into generosity. Gravebloom stands thick here.',
            'system',
            '#d9c88f',
          );
        } else if (variant.id === 'leviathan_graveyard') {
          postNotification(
            'Leviathan Graveyard',
            'Ribs you walk under. A skull like a house. Whatever this was, it was the biggest thing in its world — and its world ended anyway. Walk quietly.',
            'system',
            '#efe9d8',
          );
        } else if (variant.id === 'charged_flats') {
          postNotification(
            'The Charged Flats',
            'The air hums and your skin prickles. Lightning zots this country every half-minute or so — when the air goes still and bright, get under a roof, a ruin slab, or a bridge. Out in the open, a strike costs blood and empties your wind.',
            'system',
            '#fbbf24',
          );
        } else if (variant.id === 'magnetic_dunes') {
          postNotification(
            'Magnetic Dunes',
            'Black sand, and the charge at its angriest — strikes come twice as often here, and fulgurite fingers crowd the dunes. Cross it sheltered, or cross it fast.',
            'system',
            '#f59e0b',
          );
        } else if (variant.id === 'skyfall_basin') {
          postNotification(
            'Skyfall Basin',
            'Strange calm. The basin drinks the charge — strikes are rare here, and the stormcatchers grow rich on what the sky gives up. And the old reports were right: watch the rain. It falls UP.',
            'system',
            '#a5d8e8',
          );
        } else if (variant.id === 'welcoming_valley') {
          postNotification(
            'Welcoming Valley',
            'The valley is in its generous mood — the ground itself heals you while you stand in it. Somewhere in it beats one heartbloom; even a kind host likes to be fed.',
            'system',
            '#e9d5ff',
          );
        } else if (variant.id === 'hungry_valley') {
          postNotification(
            'Hungry Valley',
            'The hello and the grab begin with the same gesture here. When the ground rustles and the edges of your sight go red, MOVE — the roots lash the spot you stood on. Or feed the heartbloom, and it will digest instead of hunting.',
            'system',
            '#fda4af',
          );
        } else if (variant.id === 'twominded_valley') {
          postNotification(
            'Two-Minded Valley',
            'Both moods at once: the clearings heal you, and the thicket around its heartbloom grabs. Learn where the heart grows, and you know which valley you are standing in.',
            'system',
            '#d8b4fe',
          );
        } else if (variant.id === 'mycelium_web') {
          postNotification(
            'The Mycelium Web',
            'The giants grow in a RING here — one network, showing through the ground. The spore air breathes with the whole circle; your stamina is its tide.',
            'system',
            '#c4b5fd',
          );
        } else if (variant.id === 'glowfen') {
          postNotification(
            'The Glowfen',
            'Cave glow, growing topside — the fen shines with fungus light, soft and kind. The gentle face of the fungal country.',
            'system',
            '#7dd3fc',
          );
        } else if (variant.id === 'petrified_grove') {
          postNotification(
            'The Petrified Grove',
            'Giants, turned to stone mid-sway. Sparse, grey, and very quiet — what is here is what died here.',
            'system',
            '#d6d3d1',
          );
        } else if (variant.id === 'mirror_marsh') {
          postNotification(
            'The Mirror Marsh',
            'Still pools double the reach of every light here — but the wading drags at your stride. Boots with Waders will answer the drag someday.',
            'system',
            '#7dd3c8',
          );
        }
      }
    }
  }, [sessionSeed, playerZone, postNotification]);

  const handlePlayerDeath = useCallback((): void => {
    healthRef.current = playerState.maxHealth;
    setHealth(playerState.maxHealth);
    staminaRef.current = 100;
    setStamina(100);
    postNotification(
      'Taken by the Land',
      'You wake at the spawn base, whole and breathing — on the heart tile at its center. The country keeps its dangers; it does not keep you.',
      'system',
      '#f87171',
    );
    respawnAtSpawn();
    playerDeadRef.current = false;
  }, [playerState.maxHealth, setHealth, setStamina, postNotification, respawnAtSpawn]);
  onPlayerDeathRef.current = handlePlayerDeath;

  // Pause mode on background return (Adam, 2026-10-15): the engine
  // reports a long frame gap (the tab was away); latch the pause —
  // the ref flips first, so the very next frame already holds —
  // and the HUD overlay offers the deliberate resume.
  const [returnPaused, setReturnPaused] = useState(false);
  const returnPausedRef = useRef(false);
  const onBackgroundReturn = () => {
    returnPausedRef.current = true;
    setReturnPaused(true);
  };
  const resumeFromReturn = () => {
    returnPausedRef.current = false;
    setReturnPaused(false);
    if (!touchMode) engineRef.current?.requestPointerLock();
  };

  useGameLoop({
    containerRef, engineRef, movementController, playerPosRef, playerLevelRef,
    jumpRef, bounceGraceUntil, keysPressed, touchInputRef, staminaRef, lastStaminaSync,
    sprinting, sporeStaminaRef, marshSluggishRef, getWaterDepth: (x: number, z: number) => engineRef.current?.waterDepthAt(x, z) ?? 0, scarHeatRef, thawColdRef, stillColdRef, stormZotRef, onZotWarningRef, zotStateRef, livingWelcomeRef, livingHungerRef, livingTwomindedRef, livingHeartRef, grabStateRef, grabSnareUntilRef, valleySatiatedUntilRef, onGrabWarningRef, healthRef, lastHealthSync, deathArmedRef, playerDeadRef, onPlayerDeathRef, edgePushRef, pendingTravelRef, travelToZoneRef, cancelPendingTravel,
    instanceRef, toolHandlersRef, liveGameRefs,
    accumulatedTickTime, accumulatedDayTime, selectedStructureRef,
    touchModeRef, isPointerLockedRef, activeModalRef, returnPausedRef,
    structuresListRef, floraListRef, annotateTunnelPairing,
    activeToolRef, lastBroadcastTime, lastMinimapUpdateTime, latestStateRef, currentZoneId,
    applyPlayerLevel, postNotification, setStamina, setHealth, setMinimapPos,
    setDayNightCycle, setHoverInfo, setIsPointerLocked, onBackgroundReturn,
    activeModal, playerState, floraList, faunaList, structuresList, droppedItems, dayNightCycle,
  });

  // ------------------------------------------------------------------------
  // Left Hand (Adam, 2026-10-14): the off-hand slot for INSTRUMENTS —
  // the Hand Lantern-Fern (a living torch) and the Prismatic Field
  // Radar (minimap pings). Taking one INTO the hand spends the pouch
  // item; stowing returns it. The engine light follows
  // PlayerState.heldItemId via an engine-wiring effect in the
  // game-loop hook, so saves, loads, and co-op world swaps all keep
  // the hand honest.
  // ------------------------------------------------------------------------
  const handleToggleHeldItem = useCallback((): void => {
    // The Left Hand holds the LANTERN — the slot raises the one
    // instrument kept for it, a second click stows it (Adam,
    // 2026-10-14). The Prismatic Field Radar used to share this
    // slot; it is a HELMET upgrade now (Adam, 2026-10-16) and
    // lives in the helm's radar track, installed by ownership.
    const HOLDABLES: ItemId[] = ['hand_lantern_fern'];
    const held = playerState.heldItemId;
    const owned = HOLDABLES.filter((id) => id === held || hasItem(id, 1));
    if (owned.length === 0) {
      postNotification('Empty Left Hand', 'Craft a Hand Lantern-Fern at the Bio-Forge [B] to hold it here.', 'alert', '#fbbf24');
      return;
    }
    const idx = held ? owned.indexOf(held) : -1;
    const next = owned[idx + 1] ?? null;
    if (held) addInventoryItem(held, 1);
    if (next) {
      deductInventoryItem(next, 1);
      setHeldItemId(next);
      postNotification('Lantern Raised', 'The Hand Lantern-Fern takes your left hand — its light goes where you go.', 'craft', '#22d3ee');
    } else {
      setHeldItemId(null);
      postNotification('Left Hand Free', `${ITEMS[held as ItemId]?.name ?? 'Item'} stowed back in your pouch.`, 'craft', '#94a3b8');
    }
  }, [playerState.heldItemId, addInventoryItem, deductInventoryItem, hasItem, setHeldItemId, postNotification]);

  // Radar migration (Adam, 2026-10-16): a save from before the
  // conversion can come back holding the radar in the Left Hand —
  // raising it had DEDUCTED it from the pouch, so hand it back
  // and clear the hand. The radar's seat is the helm now; owning
  // it is what installs it. Clearing the hand is the guard: the
  // effect re-runs on the cleared value and stops.
  useEffect(() => {
    if (playerState.heldItemId !== 'prismatic_field_radar') return;
    addInventoryItem('prismatic_field_radar', 1);
    setHeldItemId(null);
    postNotification('Radar Finds Its Seat', 'The Prismatic Field Radar belongs in the Homestead Helm now — it rides there whenever helm and radar are both yours.', 'craft', '#a855f7');
  }, [playerState.heldItemId, addInventoryItem, setHeldItemId, postNotification]);

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
    // restored: tier 3+ is forge-only, graft or no graft. The tier
    // read is the ACCESS tier (Adam, 2026-10-15): a gear part's
    // pinned display tier governs — the Tier 2 radar is Field
    // Synthesizer work, exactly as its label says.
    const forgeOnly = accessTierOf(recipe) >= 3;
    if (!access.nearForge && (forgeOnly || !access.hasSynthesizer)) {
      postNotification(
        'Synthesis Blocked',
        forgeOnly
          ? 'Advanced synthesis requires a bio-forge station.'
          : 'Too far from a bio-forge station — the Field Synthesizer lets you craft in the field.',
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
      // A freshly grown storage pod selects itself as the blueprint
      // (Adam, 2026-10-15): it is set down by hand with the harvest
      // glove, so the player's next ground click should meet the
      // pod they just made — not whatever blueprint was left over.
      if (recipe.outputId === 'storage_pod') {
        setSelectedStructureType('storage_pod');
      }
      if (recipe.outputId === 'sample_rack') {
        setSelectedStructureType('sample_rack');
      }
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
      ? structuresList.find(
          (s) => s.id === storageTargetId && (s.type === 'storage_pod' || s.type === 'sample_rack'),
        )
      : undefined;

  // The culture vat the panel is showing, if it still stands.
  const vatStructure =
    activeModal === 'vat' && vatTargetId
      ? structuresList.find((s) => s.id === vatTargetId && s.type === 'culture_vat')
      : undefined;

  // The radar's tier (Adam's taxonomy, 2026-10-16): the helm
  // carries the radar track — TIER 1 wayfinding when helm +
  // radar are owned, TIER 2 creature location when the
  // Lifefinder growth joins them. Ownership IS installation
  // (the same reading the HUD's panel gate uses).
  const radarTier = !hasItem('homestead_helm', 1)
    ? 0
    : hasItem('prismatic_field_radar', 1) && hasItem('prismatic_lifefinder', 1)
      ? 2
      : hasItem('prismatic_field_radar', 1)
        ? 1
        : 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* 3D WebGL Canvas Viewport */}
      <div ref={containerRef} className="absolute inset-0 cursor-crosshair" />

      {/* Storm zot WARNING (2026-10-15): the still-bright moment
          before a strike — a pale amber bloom at the screen's
          edges. This flash IS the fairness mechanism: ~2.5s of
          warning to get under cover. Pointer-transparent. */}
      {zotWarn && (
        <div
          className="absolute inset-0 pointer-events-none z-40"
          style={{ background: 'radial-gradient(ellipse at center, transparent 52%, rgba(251,191,36,0.28) 100%)', boxShadow: 'inset 0 0 120px rgba(253,230,138,0.35)' }}
        />
      )}

      {/* Grab WARNING (Living, 2026-10-15): the rustle before the
          roots lash — deep red at the edges. The fairness cue for
          the grab, same contract as the zot's still-bright flash:
          see it, move off the spot, watch the ground grab air. */}
      {grabWarn && (
        <div
          className="absolute inset-0 pointer-events-none z-40"
          style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(159,18,57,0.32) 100%)', boxShadow: 'inset 0 0 120px rgba(190,18,60,0.4)' }}
        />
      )}

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
        strikerDrawName={drawnWeapon ? ITEMS[drawnWeapon.itemId].name : undefined}
        strikerDrawKind={drawnWeapon?.kind}
        onOpenQuests={() => setActiveModal('quests')}
        questView={trackedView}
        onDismissQuest={
          trackedView
            ? () =>
                updateQuestProgress({
                  trackedId: null,
                  dismissedId: trackedView.def.id,
                })
            : undefined
        }
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
        radarActive={radarTier >= 1}
        radarTier={radarTier}
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
        isReturnPaused={returnPaused}
        onResumeFromReturn={resumeFromReturn}
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
        fieldNotesState={fieldNotesState}
        codexList={codexList}
        showHud={showQuestHud}
        onToggleShowHud={(show) => updateQuestProgress({ showHud: show })}
        onTrack={(questId) =>
          updateQuestProgress({
            trackedId: questId,
            // Re-tracking a dismissed quest clears its dismissal —
            // the X rests a quest, the log brings it back.
            ...(questProgress?.dismissedId === questId
              ? { dismissedId: null }
              : {}),
          })
        }
      />
      {/* Release confirmation (Adam, 2026-10-15): letting a
          companion go is the one command that always asks. */}
      {pendingRelease && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="glass-panel-biolum w-full max-w-sm rounded-3xl border border-amber-500/40 px-6 py-5 shadow-2xl">
            <div className="font-tech text-sm font-bold tracking-widest text-amber-200">RELEASE</div>
            <p className="mt-2 text-sm leading-relaxed text-slate-200">
              Are you sure you want to release{' '}
              <span className="font-bold text-white">{pendingRelease.customName || pendingRelease.species.replace('_', ' ')}</span>?
              It will live wild in this country from now on — the bond is spent, and winning it again means a lure and luck, like any stranger.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setPendingRelease(null)}
                className="rounded-xl border border-slate-500/50 px-4 py-2 text-xs font-tech font-bold text-slate-300 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                KEEP
              </button>
              <button
                onClick={() => {
                  releaseFauna(pendingRelease.id);
                  multiplayerManager.broadcastEntityUpsert('fauna', {
                    ...pendingRelease,
                    isTamed: false,
                    command: undefined,
                    state: 'wandering',
                  });
                  postNotification(
                    'Released',
                    `${pendingRelease.customName || pendingRelease.species.replace('_', ' ')} turns back to the wild. It keeps its name — a known animal, not a stranger.`,
                    'tame',
                    '#f59e0b',
                  );
                  setPendingRelease(null);
                }}
                className="rounded-xl border border-amber-400/70 bg-amber-500/20 px-4 py-2 text-xs font-tech font-bold text-amber-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                RELEASE
              </button>
            </div>
          </div>
        </div>
      )}
      {/* The open culture vat (entity re-read live from the list). */}
      {activeModal === 'vat' && vatStructure && (
        <VatModal
          structure={vatStructure}
          inventory={inventory}
          onClose={() => {
            setActiveModal(null);
            setVatTargetId(null);
          }}
          onStart={handleVatStart}
          onHatch={handleVatHatch}
          onUpgrade={handleVatUpgrade}
        />
      )}
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
      {/* The BioTunnel gulp (Adam, 2026-10-16): while a transit
          runs, the screen is the inside of the tunnel — darkness
          that closes, swallows the travel, and lets go. */}
      <div
        className="fixed inset-0 z-[80] bg-black pointer-events-none transition-opacity duration-500"
        style={{ opacity: tunnelFade }}
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
