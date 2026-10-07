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
} from './types/game';
import { INITIAL_CODEX, ITEMS } from './game/constants';
import { BioForgeThreeEngine } from './game/threeEngine';
import { soundEngine } from './audio/soundEngine';
import { multiplayerManager } from './game/multiplayer';
import { FirstPersonMovementController, ControllerInputState } from './game/controller';

// Modular Domain Hooks (Enforces CODE_MANIFESTO.md Rule 8)
import { useInventory } from './hooks/useInventory';
import { useNotifications } from './hooks/useNotifications';
import { usePlayerState } from './hooks/usePlayerState';
import { useWorldEntities } from './hooks/useWorldEntities';
import { useToolInteractions } from './hooks/useToolInteractions';

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
  } = usePlayerState();

  const {
    floraList,
    faunaList,
    structuresList,
    droppedItems,
    addFlora,
    resetFloraHarvest,
    applyFloraFertilizer,
    addStructure,
    removeStructure,
    tameFauna,
    updateTick,
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

  // Minimap position state updated smoothly during frame/tick
  const [minimapPos, setMinimapPos] = useState({ x: playerState.x, z: playerState.z, rotation: playerState.rotation });
  const lastMinimapUpdateTime = useRef(0);

  // Movement Keys & High-Frequency Refs (Rule 3: Performance & Memoization)
  const keysPressed = useRef<Record<string, boolean>>({});
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
    inventory,
    addInventoryItem,
    deductInventoryItem,
    hasItem,
    resetFloraHarvest,
    applyFloraFertilizer,
    addFlora,
    addStructure,
    removeStructure,
    tameFauna,
    setCodexList,
    postNotification,
    onOpenBioForgeModal: () => setActiveModal('bioforge'),
    triggerHarvestFx: (x, z) => engineRef.current?.triggerHarvestEffect(x, z),
    triggerSolventFx: (x, z) => engineRef.current?.triggerSolventSprayEffect(x, z),
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
      onGroundClick: (wx, wz) => handleGroundClick(wx, wz),
      onFloraInteract: (flora) => handleFloraInteract(flora),
      onFaunaInteract: (fauna) => handleFaunaInteract(fauna),
      onStructureInteract: (structure) => handleStructureInteract(structure),
      onEntityHover: (target: HoverTarget) => setHoverInfo(target),
      onLockChange: (locked) => setIsPointerLocked(locked),
      onFrame: (dt: number) => {
        // Guard Clause 1: Engine unready
        if (!engineRef.current) return;

        // 1. Controller Update
        const isPaused = !isPointerLockedRef.current || activeModalRef.current !== null;
        if (isPaused) {
          keysPressed.current = {};
        }

        const inputState: ControllerInputState = {
          forward: Boolean(keysPressed.current['w'] || keysPressed.current['arrowup']),
          backward: Boolean(keysPressed.current['s'] || keysPressed.current['arrowdown']),
          left: Boolean(keysPressed.current['a'] || keysPressed.current['arrowleft']),
          right: Boolean(keysPressed.current['d'] || keysPressed.current['arrowright']),
        };

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
              0,
              hasItem(selectedStructureRef.current, 1)
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
          updateTick(
            simDt,
            moveResult.x,
            moveResult.z,
            (pickedItem) => {
              addInventoryItem(pickedItem.itemId, pickedItem.count);
              soundEngine.playHarvest();
              postNotification(
                'Item Collected',
                `Picked up ${pickedItem.count}x ${ITEMS[pickedItem.itemId]?.name || pickedItem.itemId}`,
                'harvest',
                ITEMS[pickedItem.itemId]?.color || '#38bdf8'
              );
            },
            (critterSpecies) => {
              if (critterSpecies === 'soft_puff') {
                postNotification('Bio-Pellet Produced', 'Your tamed Soft-Puff excreted high-grade organic fertilizer!', 'tame', '#10b981');
              }
              if (critterSpecies === 'chitin_stalker') {
                postNotification('Carapace Shedding', 'Your guardian Chitin-Stalker shed a Reinforced Carapace Scale!', 'tame', '#8b5cf6');
              }
            }
          );
        }

        // 3. Smooth Sol-Cycle advancement (1 second throttled UI tick)
        accumulatedDayTime.current += dt;
        if (accumulatedDayTime.current >= 1.0) {
          accumulatedDayTime.current = 0;
          setDayNightCycle((prev) => (prev + 0.002) % 1.0);
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
  }, [
    handleGroundClick,
    handleFloraInteract,
    handleFaunaInteract,
    handleStructureInteract,
    hasItem,
    addInventoryItem,
    updateTick,
    postNotification,
  ]);

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

      // Guard Clause 3: Ignore movement and gameplay inputs when Esc / pause mode is active
      const isPaused = !isPointerLocked || activeModal !== null;
      if (isPaused) {
        keysPressed.current = {};
        return;
      }

      // Register standard continuous WASD / Arrow movement keys
      const key = e.key.toLowerCase();
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        keysPressed.current[key] = true;
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

      // Guard Clause 2: If Esc / pause mode is active, clear pressed keys and ignore
      const isPaused = !isPointerLocked || activeModal !== null;
      if (isPaused) {
        keysPressed.current = {};
        return;
      }

      keysPressed.current[e.key.toLowerCase()] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [activeModal, isPointerLocked, setActiveTool]);

  // --------------------------------------------------------------------------
  // Multiplayer Event Setup
  // --------------------------------------------------------------------------
  useEffect(() => {
    multiplayerManager.setCallbacks({
      onPeerJoin: (peer) => {
        setPeers(multiplayerManager.getConnectedPeers());
        postNotification('Explorer Joined', `${peer.name} entered sector. Co-Op synced!`, 'system', peer.color);
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
      },
    });
  }, [peers, addStructure, removeStructure, resetFloraHarvest, tameFauna, postNotification]);

  const handleHostSession = () => {
    const code = multiplayerManager.hostSession();
    setRoomCode(code);
    setIsHost(true);
    setIsConnected(true);
    postNotification('Host Session Created', `Room Code: ${code}. Share with fellow explorers to join your world!`, 'system', '#10b981');
  };

  const handleJoinSession = (code: string) => {
    const success = multiplayerManager.joinSession(code);
    if (success) {
      setRoomCode(code);
      setIsHost(false);
      setIsConnected(true);
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

  const handleCraftRecipe = (recipe: CraftingRecipe) => {
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
        notifications={notifications}
        roomCode={roomCode}
        peerCount={peers.length}
        selectedStructureType={playerState.selectedStructureType}
        selectedSeedId={playerState.selectedSeedId}
      />

      {/* Modals */}
      <BioForgeModal
        isOpen={activeModal === 'bioforge'}
        onClose={() => setActiveModal(null)}
        inventory={inventory}
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
        onSelectTool={setActiveTool}
      />

      <CodexModal
        isOpen={activeModal === 'codex'}
        onClose={() => setActiveModal(null)}
        codexList={codexList}
      />

      <MultiplayerModal
        isOpen={activeModal === 'multiplayer'}
        onClose={() => setActiveModal(null)}
        roomCode={roomCode}
        isHost={isHost}
        isConnected={isConnected}
        peers={peers}
        onHostSession={handleHostSession}
        onJoinSession={handleJoinSession}
        onLeaveSession={handleLeaveSession}
        onSendMessage={handleSendChatMessage}
        chatMessages={chatMessages}
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
