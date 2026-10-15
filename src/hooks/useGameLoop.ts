/**
 * BioForge Game Loop Domain Hook
 * Extracted from App.tsx (2026-10-15, the seam-by-seam refactor —
 * seam 6 of 6, a pure move: no behavior changes). The hot path,
 * moved last and most carefully.
 *
 * Owns the engine's life: the setup effect that creates the
 * Three.js engine and runs the authoritative per-frame loop
 * (movement + story support + jump integration, stamina, the
 * zone-edge push, world tick, peer broadcast, day/night advance,
 * minimap sync), and the engine-wiring effects that mirror React
 * state into the engine (list syncs, day/night, viewmodel, pointer
 * lock, the held lantern light).
 *
 * Everything arrives as refs and stable callbacks — the loop reads
 * the world through refs exactly as it did inside App, so frame
 * behavior is unchanged. This hook returns nothing.
 */

import { useEffect } from 'react';
import { BioForgeThreeEngine } from '../game/threeEngine';
import type { FirstPersonMovementController, ControllerInputState } from '../game/controller';
import * as THREE from 'three';
import { occupancyConflict, placementFor } from '../game/placement';
import { multiplayerManager } from '../game/multiplayer';
import { soundEngine } from '../audio/soundEngine';
import { ITEMS } from '../game/constants';
import { WORLD_EDGE_COORD, ZONE_PUSH_SECONDS, ZONE_PUSH_MIN_COMPONENT } from './useZoneTravel';
import { JUMP_GRAVITY, STORY_HEIGHT_METERS } from './useGameInput';
import type { WorldSnapshot } from '../game/saveSystem';
import type { InstanceState } from './useInstances';
import type { PendingTravel } from './useZoneTravel';
import type {
  DroppedItemEntity, FaunaEntity, FloraEntity, GameNotification, HoverTarget,
  ItemId, PlayerState, StructureEntity, StructureType, ToolType,
} from '../types/game';
import type { TouchMoveInput } from '../components/TouchControls';

export interface GameLoopDeps {
  containerRef: { current: HTMLDivElement | null };
  engineRef: { current: BioForgeThreeEngine | null };
  movementController: { current: FirstPersonMovementController };
  playerPosRef: { current: { x: number; z: number; rotation: number } };
  playerLevelRef: { current: number };
  jumpRef: { current: { y: number; vy: number; bounceFlip: boolean } };
  bounceGraceUntil: { current: number };
  keysPressed: { current: Record<string, boolean> };
  touchInputRef: { current: TouchMoveInput };
  staminaRef: { current: number };
  /** True while the player stands in spore-thick variant air. */
  sporeStaminaRef: { current: boolean };
  /** True while the player wades a sluggish variant (Mirror Marsh). */
  marshSluggishRef: { current: boolean };
  lastStaminaSync: { current: number };
  sprinting: { current: boolean };
  edgePushRef: { current: { dir: 'N' | 'S' | 'E' | 'W'; since: number } | null };
  pendingTravelRef: { current: PendingTravel | null };
  travelToZoneRef: { current: ((dir: 'N' | 'S' | 'E' | 'W') => void) | null };
  cancelPendingTravel: () => void;
  instanceRef: { current: InstanceState };
  toolHandlersRef: { current: {
    handleGroundClick: (worldX: number, worldZ: number) => void;
    handleFloraInteract: (flora: FloraEntity) => void;
    handleFaunaInteract: (fauna: FaunaEntity) => void;
    handleStructureInteract: (structure: StructureEntity) => void;
  } };
  liveGameRefs: { current: {
    hasItem: (itemId: ItemId, quantity: number) => boolean;
    addInventoryItem: (itemId: ItemId, quantity: number) => void;
    updateTick: (dt: number, playerX: number, playerZ: number, onPickupItem: (item: DroppedItemEntity) => void, onCritterExcrete?: (species: string) => void) => void;
    postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
    getPlacementRotation: () => number;
  } };
  accumulatedTickTime: { current: number };
  accumulatedDayTime: { current: number };
  selectedStructureRef: { current: StructureType };
  touchModeRef: { current: boolean };
  isPointerLockedRef: { current: boolean };
  activeModalRef: { current: string | null };
  structuresListRef: { current: StructureEntity[] };
  floraListRef: { current: FloraEntity[] };
  activeToolRef: { current: ToolType };
  lastBroadcastTime: { current: number };
  lastMinimapUpdateTime: { current: number };
  latestStateRef: { current: { dayNightCycle: number } };
  currentZoneId: () => string;
  applyPlayerLevel: (level: number) => void;
  postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
  setStamina: (value: number) => void;
  setMinimapPos: (pos: { x: number; z: number; rotation: number }) => void;
  setDayNightCycle: (value: number | ((prev: number) => number)) => void;
  setHoverInfo: (info: HoverTarget) => void;
  setIsPointerLocked: (value: boolean) => void;
  activeModal: string | null;
  playerState: PlayerState;
  floraList: FloraEntity[];
  faunaList: FaunaEntity[];
  structuresList: StructureEntity[];
  droppedItems: DroppedItemEntity[];
  dayNightCycle: number;
}

export function useGameLoop(deps: GameLoopDeps): void {
  const {
    containerRef, engineRef, movementController, playerPosRef, playerLevelRef,
    jumpRef, bounceGraceUntil, keysPressed, touchInputRef, staminaRef, sporeStaminaRef, marshSluggishRef, lastStaminaSync,
    sprinting, edgePushRef, pendingTravelRef, travelToZoneRef, cancelPendingTravel,
    instanceRef, toolHandlersRef, liveGameRefs,
    accumulatedTickTime, accumulatedDayTime, selectedStructureRef,
    touchModeRef, isPointerLockedRef, activeModalRef,
    structuresListRef, floraListRef,
    activeToolRef, lastBroadcastTime, lastMinimapUpdateTime, latestStateRef, currentZoneId,
    applyPlayerLevel, postNotification, setStamina, setMinimapPos,
    setDayNightCycle, setHoverInfo, setIsPointerLocked,
    activeModal, playerState, floraList, faunaList, structuresList, droppedItems, dayNightCycle,
  } = deps;

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
        // Variant effect (Adam, 2026-10-15): Mirror Marsh wading
        // drag — every stride at 85% while on its surface. The
        // planned answer is a boots module (Waders); until boots
        // exist, the marsh is country you feel in your legs.
        const wading = marshSluggishRef.current && instanceRef.current.kind === 'surface' ? 0.85 : 1;
        movementController.current.sprintMultiplier = (wantSprint ? 1.6 : 1) * wading;

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
        // Variant effect (Adam, 2026-10-15): Fungal Hollow air is
        // spore-thick — standing in it taxes stamina 8/s, exactly
        // cancelling walking regen and slowing rest recovery. The
        // planned answer is a helmet + filter upgrade; until it
        // exists, the hollow is a place you cross, not linger in.
        // Surface only — underground is cave air, not hollow air.
        const sporeTax = sporeStaminaRef.current && activeInstance.kind === 'surface' ? 8 * dt : 0;
        const staminaDelta = (isSprintingNow ? -18 * dt : (moveResult.isMoving ? 8 : 14) * dt) - sporeTax;
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


  // The held lantern light follows the Left Hand (see App's
  // handleToggleHeldItem): the engine light is on while the
  // Lantern-Fern is the held instrument.
  useEffect(() => {
    engineRef.current?.setHeldLight(playerState.heldItemId === 'hand_lantern_fern');
  }, [playerState.heldItemId]);
}
