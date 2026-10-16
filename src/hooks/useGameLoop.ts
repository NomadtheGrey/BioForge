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
  DroppedItemEntity, FaunaEntity, FaunaSpecies, FloraEntity, GameNotification, HoverTarget,
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
  /** True while the player stands in an Ember Scar zone. */
  scarHeatRef: { current: boolean };
  // Storm zots (2026-10-15): the mean seconds between lightning
  // strikes in Storm country (0 = not storm country), and the
  // warning callback App uses for the still-bright cue.
  stormZotRef: { current: number };
  // The Living (2026-10-15): temperament refs — welcome heals,
  // hunger grabs, twominded decides by the heart-thicket patch
  // (livingHeartRef, set by App per zone). grabState is the
  // grab timer + warned spot; the snare deadline slows movement;
  // the satiation deadline (fed heartbloom) pauses the grabs.
  livingWelcomeRef: { current: boolean };
  livingHungerRef: { current: boolean };
  livingTwomindedRef: { current: boolean };
  livingHeartRef: { current: { x: number; z: number; r: number } | null };
  grabStateRef: { current: { timer: number; warned: boolean; warnX: number; warnZ: number } };
  grabSnareUntilRef: { current: number };
  valleySatiatedUntilRef: { current: number };
  onGrabWarningRef: { current: (() => void) | null };
  onZotWarningRef: { current: (() => void) | null };
  zotStateRef: { current: { timer: number; warned: boolean } };
  thawColdRef: { current: boolean };
  stillColdRef: { current: boolean };
  healthRef: { current: number };
  lastHealthSync: { current: number };
  /** Death is armed on Normal/Hostile worlds (Adam's pin). */
  deathArmedRef: { current: boolean };
  /** Latched while a death is being answered (respawn in flight). */
  playerDeadRef: { current: boolean };
  onPlayerDeathRef: { current: (() => void) | null };
  // (storm zot refs are declared beside scarHeatRef above)
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
    updateTick: (dt: number, playerX: number, playerZ: number, onPickupItem: (item: DroppedItemEntity) => void, onCritterExcrete?: (species: string) => void, onFaunaAttack?: (species: FaunaSpecies, damage: number) => void, attacksArmed?: boolean) => void;
    postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
    getPlacementRotation: () => number;
  } };
  accumulatedTickTime: { current: number };
  accumulatedDayTime: { current: number };
  selectedStructureRef: { current: StructureType };
  touchModeRef: { current: boolean };
  /** Pause-mode latch (Adam, 2026-10-15): set via the engine's
   *  onBackgroundReturn when the player comes back from a
   *  background tab; while set, the whole sim holds. */
  returnPausedRef: { current: boolean };
  /** App's latch setter for the engine's background-return report. */
  onBackgroundReturn: () => void;
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
  setHealth: (value: number) => void;
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
    jumpRef, bounceGraceUntil, keysPressed, touchInputRef, staminaRef, sporeStaminaRef, marshSluggishRef, scarHeatRef, thawColdRef, stillColdRef, stormZotRef, onZotWarningRef, zotStateRef, livingWelcomeRef, livingHungerRef, livingTwomindedRef, livingHeartRef, grabStateRef, grabSnareUntilRef, valleySatiatedUntilRef, onGrabWarningRef, healthRef, lastHealthSync, deathArmedRef, playerDeadRef, onPlayerDeathRef, lastStaminaSync,
    sprinting, edgePushRef, pendingTravelRef, travelToZoneRef, cancelPendingTravel,
    instanceRef, toolHandlersRef, liveGameRefs,
    accumulatedTickTime, accumulatedDayTime, selectedStructureRef,
    touchModeRef, isPointerLockedRef, activeModalRef, returnPausedRef, onBackgroundReturn,
    structuresListRef, floraListRef,
    activeToolRef, lastBroadcastTime, lastMinimapUpdateTime, latestStateRef, currentZoneId,
    applyPlayerLevel, postNotification, setStamina, setHealth, setMinimapPos,
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
      onBackgroundReturn: () => onBackgroundReturn(),
      onFrame: (dt: number) => {
        // Guard Clause 1: Engine unready
        if (!engineRef.current) return;

        // PAUSE MODE on background return (Adam, 2026-10-15): the
        // whole simulation holds — no movement, no world ticks, no
        // day advance, no broadcasts — until the player resumes
        // from the HUD overlay. The engine still renders its
        // backdrop behind the overlay; only the sim waits.
        if (returnPausedRef.current) return;

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
        // Rooted by the valley (Living, 2026-10-15): a landed
        // grab holds you at 40% speed while the snare lasts.
        const snared = performance.now() < grabSnareUntilRef.current && instanceRef.current.kind === 'surface' ? 0.4 : 1;
        movementController.current.sprintMultiplier = (wantSprint ? 1.6 : 1) * wading * snared;

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

        // Sub-stepped movement + jump (2026-10-15): the engine now
        // hands over REAL delta time (see threeEngine.animate — the
        // old 0.05s cap threw elapsed time away under 20 fps and
        // the game ran in slow motion; Clarissa's "movement and
        // turning feel sluggish"). A long real frame integrates
        // here in slices of at most 1/30s, so collision stays
        // honest (no tunneling through thin walls at low fps) and
        // jump arcs stay smooth, while game TIME advances at true
        // speed. Rates that merely accumulate (stamina, variant
        // effects, timers further down) still consume the frame's
        // full dt exactly once.
        const jump = jumpRef.current;
        const stepCount = Math.max(1, Math.ceil(dt / (1 / 30)));
        const stepDt = dt / stepCount;
        let moveResult = {
          x: playerPosRef.current.x,
          z: playerPosRef.current.z,
          isMoving: false,
        };
        for (let step = 0; step < stepCount; step++) {
          moveResult = movementController.current.update(
            stepDt,
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

          // Jump arc, per step: gravity pulls the cosmetic Y back
          // to the floor. Movement input kept working during the
          // move above — that IS the air control. A bounce launch
          // flips the player's story as the arc crosses story
          // height: camera height is the SUM (level x story +
          // jumpY), so subtracting the story from jumpY in the
          // same step keeps the view perfectly continuous while
          // collision and support switch to the upper floor.
          if (jump.vy !== 0 || jump.y > 0) {
            jump.vy -= JUMP_GRAVITY * stepDt;
            jump.y += jump.vy * stepDt;
            if (jump.bounceFlip && playerLevelRef.current === 0 && jump.y >= STORY_HEIGHT_METERS) {
              applyPlayerLevel(1);
              jump.y -= STORY_HEIGHT_METERS;
              jump.bounceFlip = false;
            }
            if (jump.y <= 0) {
              jump.y = 0;
              jump.vy = 0;
              jump.bounceFlip = false;
              // Touching down on the upper story: a short grace
              // to finish the step onto a tile before support is
              // judged (the support check runs once, below).
              if (playerLevelRef.current > 0) {
                bounceGraceUntil.current = Math.max(bounceGraceUntil.current, performance.now() + 350);
              }
            }
          }
        }

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

        // (The jump arc integrates inside the sub-stepped movement
        // loop above — see the note there.)

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
            if ((s.type !== 'root_tile_floor' && s.type !== 'heart_tile') || s.gridX !== cellX || s.gridZ !== cellZ) continue;
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

        // Variant effect (Adam, 2026-10-15): EMBER SCAR HEAT. By
        // day (Sol-cycle 0.25-0.75, the engine's own day band) the
        // scar drinks stamina at 16/s — faster than any regen, so
        // shade-timing is the only answer — and at empty stamina
        // the heat starts on HEALTH at 1.2/s. By night the ground
        // is warm instead: +8/s stamina while you rest in it.
        // Surface only. Death (Adam, 2026-10-15): on Normal/
        // Hostile worlds health may reach 0, firing the respawn
        // callback; on Peaceful the floor stays 1.
        if (scarHeatRef.current && activeInstance.kind === 'surface') {
          const cycle = latestStateRef.current.dayNightCycle;
          const isDay = cycle > 0.25 && cycle < 0.75;
          if (isDay) {
            staminaRef.current = Math.max(0, staminaRef.current - 16 * dt);
            if (staminaRef.current <= 0) {
              const floor = deathArmedRef.current ? 0 : 1;
              healthRef.current = Math.max(floor, healthRef.current - 1.2 * dt);
              if (performance.now() - lastHealthSync.current > 100) {
                lastHealthSync.current = performance.now();
                setHealth(healthRef.current);
              }
              if (deathArmedRef.current && healthRef.current <= 0 && !playerDeadRef.current) {
                playerDeadRef.current = true;
                onPlayerDeathRef.current?.();
              }
            }
          } else {
            staminaRef.current = Math.min(100, staminaRef.current + 8 * dt);
          }
        }

        // ---------------------------------------------------------
        // Storm ZOTS (2026-10-15, Adam: "occasionally zotting the
        // player with lightning"). Fairness first: the air goes
        // still-bright ~2.5s BEFORE each strike (App's warning
        // banner), and a roof/floor overhead — a house, a ruin
        // slab, a ROOT BRIDGE deck — takes the bolt instead. A
        // hit costs 15 health and empties stamina; death rules
        // are scar heat's (armed on Normal/Hostile, floored at
        // 1 on Peaceful, respawn callback at 0). Surface only.
        // The timer lives in refs the block owns via closure
        // variables on the hook's ref objects below.
        if (stormZotRef.current > 0 && activeInstance.kind === 'surface') {
          const zotState = zotStateRef.current;
          zotState.timer -= dt;
          if (zotState.timer <= 2.5 && !zotState.warned) {
            zotState.warned = true;
            onZotWarningRef.current?.();
          }
          if (zotState.timer <= 0) {
            const cellX = Math.round(playerPosRef.current.x / 2);
            const cellZ = Math.round(playerPosRef.current.z / 2);
            const sheltered = structuresListRef.current.some(
              (st) => (st.level ?? 0) >= 1 && st.gridX === cellX && st.gridZ === cellZ,
            );
            if (!sheltered) {
              staminaRef.current = 0;
              const floor = deathArmedRef.current ? 0 : 1;
              healthRef.current = Math.max(floor, healthRef.current - 15);
              setHealth(healthRef.current);
              lastHealthSync.current = performance.now();
              if (deathArmedRef.current && healthRef.current <= 0 && !playerDeadRef.current) {
                playerDeadRef.current = true;
                onPlayerDeathRef.current?.();
              }
            }
            zotState.timer = stormZotRef.current * (0.6 + Math.random() * 0.8);
            zotState.warned = false;
          }
        }

        // ---------------------------------------------------------
        // The LIVING (2026-10-15): one organism, two temperaments.
        // WELCOME: the ground heals (+1.2/s toward 100, surface).
        // HUNGER: the grab — warned ~2s ahead (App banner), aimed
        // at the spot you stood on; move 3.5m+ and it grabs air.
        // A landed grab: 10 health (death rules as scar heat) and
        // a 3s root-snare at 40% speed. FEEDING a heartbloom
        // satiates: grabs pause while the valley digests.
        // TWO-MINDED: hunger inside the heart thicket, welcome
        // outside it — decided per frame by distance to the heart.
        if ((livingWelcomeRef.current || livingHungerRef.current || livingTwomindedRef.current) && activeInstance.kind === 'surface') {
          let welcomeHere = livingWelcomeRef.current;
          let hungerHere = livingHungerRef.current;
          if (livingTwomindedRef.current && livingHeartRef.current) {
            const heart = livingHeartRef.current;
            const inThicket = Math.hypot(playerPosRef.current.x - heart.x, playerPosRef.current.z - heart.z) < heart.r;
            welcomeHere = !inThicket;
            hungerHere = inThicket;
          }
          if (welcomeHere && healthRef.current < 100) {
            healthRef.current = Math.min(100, healthRef.current + 1.2 * dt);
            if (performance.now() - lastHealthSync.current > 200) {
              lastHealthSync.current = performance.now();
              setHealth(healthRef.current);
            }
          }
          if (hungerHere) {
            const grab = grabStateRef.current;
            if (performance.now() < valleySatiatedUntilRef.current) {
              grab.timer = 12; // digesting — the timer holds
              grab.warned = false;
            } else {
              grab.timer -= dt;
              if (grab.timer <= 2.0 && !grab.warned) {
                grab.warned = true;
                grab.warnX = playerPosRef.current.x;
                grab.warnZ = playerPosRef.current.z;
                onGrabWarningRef.current?.();
              }
              if (grab.timer <= 0) {
                const moved = Math.hypot(playerPosRef.current.x - grab.warnX, playerPosRef.current.z - grab.warnZ);
                if (moved <= 3.5) {
                  const floor = deathArmedRef.current ? 0 : 1;
                  healthRef.current = Math.max(floor, healthRef.current - 10);
                  setHealth(healthRef.current);
                  lastHealthSync.current = performance.now();
                  grabSnareUntilRef.current = performance.now() + 3000;
                  if (deathArmedRef.current && healthRef.current <= 0 && !playerDeadRef.current) {
                    playerDeadRef.current = true;
                    onPlayerDeathRef.current?.();
                  }
                }
                grab.timer = 22 * (0.7 + Math.random() * 0.6);
                grab.warned = false;
              }
            }
          }
        }

        // Variant effect (2026-10-15): THE THAW'S COLD — the Scar's
        // mirror. Where the scar burns by day, the thaw country
        // freezes by NIGHT (outside the 0.25-0.75 day band): the
        // cold drinks stamina at 6/s on the surface. No health
        // stage — the cold pressures you home or to a light; it
        // does not take you. Cross the Thaw by daylight.
        if (thawColdRef.current && activeInstance.kind === 'surface') {
          const cycle = latestStateRef.current.dayNightCycle;
          const isNight = cycle <= 0.25 || cycle >= 0.75;
          if (isNight) {
            staminaRef.current = Math.max(0, staminaRef.current - 6 * dt);
          }
        }
        // Variant effect (2026-10-15): THE STILLWHITE'S COLD —
        // constant, day and night: stamina drains 4/s on the
        // surface. Slower than the Thaw's night bite and far
        // slower than the Scar's day burn, but it NEVER lets up:
        // in the Stillwhite there is no warm hour to wait for.
        if (stillColdRef.current && activeInstance.kind === 'surface') {
          staminaRef.current = Math.max(0, staminaRef.current - 4 * dt);
        }
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

        // Building Ghost Preview. The storage pod previews by hand
        // too (Adam, 2026-10-15): grown, not built — with the
        // harvest glove active and the pod selected, the ghost
        // shows where the hand will set it down.
        const podByHand =
          activeToolRef.current === 'harvest_glove' &&
          selectedStructureRef.current === 'storage_pod';
        if (activeToolRef.current === 'builder' || podByHand) {
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
        if (activeToolRef.current !== 'builder' && !podByHand) {
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
            },
            // Danger system (creature slice 5, 2026-10-15): a wild
            // hunter's bite lands here. The damage pattern is the
            // house one (scar heat / zot / grab): floor 1 while
            // death is unarmed, 0 on armed worlds, where reaching
            // 0 fires the respawn callback. Armed worlds are the
            // only worlds where bites happen at all — the flag
            // passed below IS deathArmed — so Peaceful never
            // reaches this handler. In co-op the fauna sim runs
            // on the host, so bites land on the host's player —
            // the same accepted v1 simplification as pickups.
            (_attackedBy, damage) => {
              const floor = deathArmedRef.current ? 0 : 1;
              healthRef.current = Math.max(floor, healthRef.current - damage);
              setHealth(healthRef.current);
              if (deathArmedRef.current && healthRef.current <= 0 && !playerDeadRef.current) {
                playerDeadRef.current = true;
                onPlayerDeathRef.current?.();
              }
            },
            deathArmedRef.current
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
