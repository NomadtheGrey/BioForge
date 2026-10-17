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
import { BioForgeThreeEngine } from '../game/engine/threeEngine';
import type { FirstPersonMovementController, ControllerInputState } from '../game/engine/controller';
import * as THREE from 'three';
import { occupancyConflict, placementFor, isFloorType } from '../game/structures/placement';
import { noteIdForPickupItem } from '../game/knowledge/fieldNotesBook';
import { isSampleItem } from '../game/structures/vat';
import type { AsksEventInput } from '../game/quests/asksBackState';
import { multiplayerManager } from '../game/multiplayer';
import { soundEngine } from '../audio/soundEngine';
import { ITEMS } from '../game/items/constants';
import { WORLD_EDGE_COORD, ZONE_PUSH_SECONDS, ZONE_PUSH_MIN_COMPONENT } from './useZoneTravel';
import { JUMP_GRAVITY, STORY_HEIGHT_METERS } from './useGameInput';
// THE SHIELD (Adam, 2026-10-17): braced stamina drain, braced
// move slow, the held lamp-shields' light, and the per-tick
// combat input for the bite site.
import {
  SHIELD_BRACED_SLOW,
  SHIELD_RAISED_DRAIN_PER_SEC,
  resolveShieldStrike,
  shieldOf,
  dropMagnetFor,
  graftOf,
  type ShieldCombatInput,
  type ShieldSideEffect,
  type StrikeCtx,
} from '../game/creatures/shields';
import type { WorldSnapshot } from '../game/saveSystem';
import type { InstanceState } from './useInstances';
import type { PendingTravel } from './useZoneTravel';
/** S6 Movable Vaults: the ghost driver renders the carried vault. */
import type { CarryState } from '../game/structures/movableVaults';
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
  /** Pond depth under the player (P5 move 2, Adam, 2026-10-16):
   *  App bridges this to the engine's waterDepthAt. Optional —
   *  an absent getter means a dry world. */
  getWaterDepth?: (x: number, z: number) => number;
  /** Which liquid stands under the player (liquids pass, Adam,
   *  2026-10-16): bridged to the engine's liquidAt. Optional —
   *  an absent getter means nothing can burn you. */
  getLiquidAt?: (x: number, z: number) => { liquid: string; depth: number } | null;
  /** True while the player owns Ember Soles, the Quicksteps
   *  growth that answers hot ground: soles make lava a road. */
  hasEmberSoles?: () => boolean;
  /** True while the player carries a Plume Charm (Ingredient
   *  Sinks, 2026-10-17): fast falls glide instead of dropping. */
  hasPlumeCharm?: () => boolean;
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
    updateTick: (dt: number, playerX: number, playerZ: number, onPickupItem: (item: DroppedItemEntity) => void, onCritterExcrete?: (species: string) => void, onFaunaAttack?: (species: FaunaSpecies, damage: number, ctx?: StrikeCtx) => void, attacksArmed?: boolean, dayPhase?: number, onFieldWitness?: (noteId: string) => void, onSentinelBell?: (species: FaunaSpecies, kind: 'threat' | 'visitor') => void, onAsksEvent?: (input: AsksEventInput | AsksEventInput[]) => void, dropMagnet?: { radius: number; speed: number }) => void;
    postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
    // The Field Notes witness sink (App's recordFieldWitness,
    // fieldNotesBook.ts) — optional so the loop never hard-depends
    // on the book; sim-side witnesses ride in through here too.
    recordFieldWitness?: (noteId: string) => void;
    /** The World Asks Back (2026-10-16): the saga event sink —
     *  sample pickups and sim-side culls stamp through here. */
    recordAsksEvent?: (input: AsksEventInput | AsksEventInput[]) => void;
    getPlacementRotation: () => number;
    /** THE SHIELD (Adam, 2026-10-17): the wield hook's live refs —
     *  optional so the loop never hard-depends on the shield slice;
     *  App's liveGameRefs effect sets them once the hook composes. */
    shield?: {
      buildCombatInput: (getPlayerFacing: () => number, payStamina: (n: number) => boolean) => import('../game/creatures/shields').ShieldCombatInput | undefined;
      onStaminaEmpty: () => void;
      tickClock: (dt: number) => void;
      raisedRef: { current: boolean };
      growthRef: { current: import('../game/creatures/shields').ShieldGrowthMap };
      /** THE SHIELD (2026-10-17): the strike side-effect sink —
       *  the shared consumer queues reflects, staggers, and spore
       *  bursts here; the sim's post-map sweep drains them. */
      queueShieldSideEffect: (fx: ShieldSideEffect) => void;
    };
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
  /**
   * S6 Movable Vaults: the live carry state (null = not carrying).
   * While set, the ghost driver renders the carried vault's ghost
   * instead of any builder blueprint.
   */
  carryRef: { current: CarryState | null };
  /** Refresh derived BioTunnel pairing on the live list (App). */
  annotateTunnelPairing: (structures: StructureEntity[]) => void;
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
    jumpRef, bounceGraceUntil, keysPressed, touchInputRef, staminaRef, sporeStaminaRef, marshSluggishRef, getWaterDepth, getLiquidAt, hasEmberSoles, hasPlumeCharm, scarHeatRef, thawColdRef, stillColdRef, stormZotRef, onZotWarningRef, zotStateRef, livingWelcomeRef, livingHungerRef, livingTwomindedRef, livingHeartRef, grabStateRef, grabSnareUntilRef, valleySatiatedUntilRef, onGrabWarningRef, healthRef, lastHealthSync, deathArmedRef, playerDeadRef, onPlayerDeathRef, lastStaminaSync,
    sprinting, edgePushRef, pendingTravelRef, travelToZoneRef, cancelPendingTravel,
    instanceRef, toolHandlersRef, liveGameRefs,
    accumulatedTickTime, accumulatedDayTime, selectedStructureRef,
    touchModeRef, isPointerLockedRef, activeModalRef, returnPausedRef, onBackgroundReturn,
    structuresListRef, floraListRef, annotateTunnelPairing, carryRef,
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
        // Pond water (P5 move 2, Adam, 2026-10-16): real depth,
        // real drag — ankle water slows a stride a little, waist
        // water a lot, chest water halves you. This is WADING;
        // floating/swimming arrives with the movement platform.
        // Waders (the Quicksteps growth) are the marsh's answer
        // today; pond relief can hang on the same platform later.
        const waterDepth = instanceRef.current.kind === 'surface' && getWaterDepth
          ? getWaterDepth(playerPosRef.current.x, playerPosRef.current.z)
          : 0;
        const inWater = waterDepth > 1.0 ? 0.5 : waterDepth > 0.35 ? 0.65 : waterDepth > 0.05 ? 0.85 : 1;
        // Rooted by the valley (Living, 2026-10-15): a landed
        // grab holds you at 40% speed while the snare lasts.
        const snared = performance.now() < grabSnareUntilRef.current && instanceRef.current.kind === 'surface' ? 0.4 : 1;
        // THE SHIELD (2026-10-17): braced walking is a wall's
        // walk — slow, deliberate, roots tearing and re-setting.
        const bracedSlow = liveGameRefs.current.shield?.raisedRef.current ? SHIELD_BRACED_SLOW : 1;
        movementController.current.sprintMultiplier = (wantSprint ? 1.6 : 1) * wading * snared * inWater * bracedSlow;

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
            // The Plume Charm (Ingredient Sinks, 2026-10-17):
            // the game has no fall damage — falls are this
            // offset returning to support — so the charm's
            // gift is the glide: once a descent is honestly
            // fast (vy < -1.5), gravity gentles to 0.45x and
            // the sink rate caps at 3 m/s. Launches (vy > 0)
            // are untouched, so bounce arcs keep their climb
            // and gain a long, rideable descent.
            const gliding =
              jump.vy < -1.5 && !!(hasPlumeCharm && hasPlumeCharm());
            jump.vy -= JUMP_GRAVITY * stepDt * (gliding ? 0.45 : 1);
            if (gliding && jump.vy < -3.0) jump.vy = -3.0;
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
            // The BioTunnel guest fix (Adam, 2026-10-16): a tunnel
            // ride is not edge-anchored — it waits at the mouth it
            // started from, and dies only if the guest walks away
            // from that mouth before the host's zone arrives.
            const stillThere = pending.tunnel
              ? Math.hypot(pp.x - pending.tunnel.nearX, pp.z - pending.tunnel.nearZ) < 6
              : (pending.dir === 'E' && pp.x > 45) ||
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
            if (!isFloorType(s.type) || s.gridX !== cellX || s.gridZ !== cellZ) continue;
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
        // THE SHIELD (2026-10-17): a raised shield is effort —
        // bracing suppresses stamina recovery and drinks it slowly
        // (the braced tax). At empty the guard breaks: the shield
        // drops and a brief vulnerable beat runs. Blocks pay per
        // hit at the bite site (useWorldEntities).
        const shieldRaised = liveGameRefs.current.shield?.raisedRef.current ?? false;
        const staminaDelta = (isSprintingNow ? -18 * dt : (shieldRaised ? 0 : (moveResult.isMoving ? 8 : 14) * dt)) - sporeTax - (shieldRaised ? SHIELD_RAISED_DRAIN_PER_SEC * dt : 0);
        staminaRef.current = Math.max(0, Math.min(100, staminaRef.current + staminaDelta));
        if (shieldRaised && staminaRef.current <= 0) {
          liveGameRefs.current.shield?.onStaminaEmpty();
        }

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
        // LAVA CONTACT (liquids pass, Adam, 2026-10-16). Standing
        // in lava burns at 12 health/s — no stamina buffer, no
        // day/night mercy; the liquid itself is the hazard. Ember
        // Soles (the Quicksteps growth) are the whole answer:
        // wearing them, lava is just slow ground (the wading drag
        // above still applies). Death rules mirror scar heat:
        // Normal/Hostile may reach 0 and respawn; Peaceful floors
        // at 1. Surface only — instances hold no liquids.
        if (activeInstance.kind === 'surface' && getLiquidAt) {
          const standing = getLiquidAt(playerPosRef.current.x, playerPosRef.current.z);
          if (standing && standing.liquid === 'lava' && standing.depth > 0.05 && !(hasEmberSoles && hasEmberSoles())) {
            const floor = deathArmedRef.current ? 0 : 1;
            healthRef.current = Math.max(floor, healthRef.current - 12 * dt);
            if (performance.now() - lastHealthSync.current > 100) {
              lastHealthSync.current = performance.now();
              setHealth(healthRef.current);
            }
            if (deathArmedRef.current && healthRef.current <= 0 && !playerDeadRef.current) {
              playerDeadRef.current = true;
              onPlayerDeathRef.current?.();
            }
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

        // THE SHIELD (2026-10-17): the shield's per-frame drive —
        // its clock (guard-break windows, spore cooldowns), the
        // left-hand viewmodel (rebuild only on item/graft change;
        // the raise lerps), and the Fenback's ward arc behind a
        // braced bearer.
        const shieldCtl = liveGameRefs.current.shield;
        if (shieldCtl) {
          shieldCtl.tickClock(dt);
          const heldShield = shieldOf(playerState.heldItemId ?? null) ?? null;
          const grafted = !!(heldShield && graftOf(shieldCtl.growthRef.current, heldShield.itemId));
          engineRef.current.setShieldViewmodel(heldShield, grafted, shieldCtl.raisedRef.current, dt);
          const camDir = new THREE.Vector3();
          engineRef.current.camera.getWorldDirection(camDir);
          const facing = Math.atan2(camDir.x, camDir.z);
          // The ward arc is the FENBACK's braced ward (branch-
          // keyed, not tier-keyed — the Bulwark raises no arc).
          const wardActive = shieldCtl.raisedRef.current && heldShield?.itemId === 'fenback_shield';
          engineRef.current.setWardArc(wardActive, moveResult.x, moveResult.z, facing);
          // The held light follows the Left Hand per frame (a braced
          // lamp-shield throws its light forward — see the engine).
          const heldShieldLamp = heldShield?.hasLamp ?? false;
          engineRef.current.setHeldLight(
            playerState.heldItemId === 'hand_lantern_fern' || heldShieldLamp,
            shieldCtl.raisedRef.current && heldShieldLamp
          );
        }

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
          (selectedStructureRef.current === 'storage_pod' ||
            selectedStructureRef.current === 'biotunnel_mouth' ||
            selectedStructureRef.current === 'sample_rack');
        // S6 MOVABLE VAULTS: the carried vault's ghost. While a carry
        // is live it owns the ghost channel outright — the carried
        // entity is out of the zone lists, so it can't conflict with
        // itself, and the click agrees with the ghost through the
        // same placement math (placementFor + occupancyConflict).
        // Rotation is facing-derived, like all placement (Adam's pin).
        const carried = carryRef.current;
        if (carried) {
          const pt = engineRef.current.getAimGroundIntersection();
          if (pt) {
            const rotation = liveGameRefs.current.getPlacementRotation();
            const spot = placementFor(carried.entity.type, pt.x, pt.z, rotation);
            const blocked = occupancyConflict(carried.entity.type, spot, structuresListRef.current) !== undefined;
            engineRef.current.setGhostPreview(
              carried.entity.type,
              true,
              spot.worldX,
              spot.worldZ,
              rotation,
              !blocked
            );
          }
        } else if (activeToolRef.current === 'builder' || podByHand) {
          const pt = engineRef.current.getAimGroundIntersection();
          if (pt) {
            const type = selectedStructureRef.current;
            const rotation = liveGameRefs.current.getPlacementRotation();
            // Same placement math the click will use (game/structures/placement.ts):
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
        if (!carried && activeToolRef.current !== 'builder' && !podByHand) {
          engineRef.current.setGhostPreview(selectedStructureRef.current, false, 0, 0, 0, true);
        }

        // 2. Throttled Ecosystem Simulation Tick (10 Hz = 100ms)
        accumulatedTickTime.current += dt;
        if (accumulatedTickTime.current >= 0.1) {
          const simDt = accumulatedTickTime.current;
          accumulatedTickTime.current = 0;
          // THE SHIELD (2026-10-17): the per-tick combat input for
          // the shared strike consumer below — facing from the
          // camera (computed once, shared by the input and the
          // consumer), stamina from the loop's own ref (App's
          // spendStamina logic, inline), the spore presentation
          // from the engine. Undefined when the Left Hand holds no
          // shield: strikes resolve exactly as before.
          let shieldCombat: ShieldCombatInput | undefined;
          let tickFacing = 0;
          const shieldCtl = liveGameRefs.current.shield;
          if (shieldCtl) {
            const d = new THREE.Vector3();
            engineRef.current?.camera.getWorldDirection(d);
            tickFacing = Math.atan2(d.x, d.z);
            const input = shieldCtl.buildCombatInput(
              () => tickFacing,
              (n) => {
                if (staminaRef.current < n) return false;
                staminaRef.current = Math.max(0, staminaRef.current - n);
                setStamina(staminaRef.current);
                return true;
              }
            );
            if (input) {
              shieldCombat = {
                ...input,
                triggerSporeFx: (x, z) => engineRef.current?.triggerSporeBurst(x, z),
              };
            }
          }
          liveGameRefs.current.updateTick(
            simDt,
            moveResult.x,
            moveResult.z,
            (pickedItem) => {
              liveGameRefs.current.addInventoryItem(pickedItem.itemId, pickedItem.count);
              // Field Notes pickup witnesses (fieldNotesBook): a
              // shed gel, scale, plate or requisition collected is
              // the note's named moment.
              const pickupWitness = noteIdForPickupItem(pickedItem.itemId);
              if (pickupWitness) liveGameRefs.current.recordFieldWitness?.(pickupWitness);
              // The World Asks Back (2026-10-16): a sample vial
              // picked up is the sample event for saga latching —
              // the id strips to the species the saga text names.
              if (isSampleItem(pickedItem.itemId)) {
                liveGameRefs.current.recordAsksEvent?.({
                  kind: 'sample',
                  species: pickedItem.itemId.slice('sample_'.length),
                  count: pickedItem.count,
                });
              }
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
            // THE SHIELD (2026-10-17): the SHARED strike consumer.
            // The main bite line and the Fall Hawk's stoop both
            // feed this callback, so block resolution lives HERE —
            // never at a call site — and both feeders block
            // identically. The damage arriving is final (the bite
            // line's scaled expression); the strike context says
            // where the teeth came from. Side effects queue back
            // into the sim's post-map sweep.
            (_attackedBy, damage, ctx) => {
              let finalDamage = damage;
              if (shieldCombat && ctx && shieldCtl) {
                finalDamage = resolveShieldStrike(
                  shieldCombat,
                  damage,
                  ctx,
                  moveResult.x,
                  moveResult.z,
                  tickFacing,
                  (targetId, hitDamage, flinch) =>
                    shieldCtl.queueShieldSideEffect({ kind: 'hit', targetId, damage: hitDamage, flinch }),
                  (x, z, grafted) =>
                    shieldCtl.queueShieldSideEffect({ kind: 'burst', x, z, grafted })
                ).finalDamage;
              }
              const floor = deathArmedRef.current ? 0 : 1;
              healthRef.current = Math.max(floor, healthRef.current - finalDamage);
              setHealth(healthRef.current);
              if (deathArmedRef.current && healthRef.current <= 0 && !playerDeadRef.current) {
                playerDeadRef.current = true;
                onPlayerDeathRef.current?.();
              }
            },
            deathArmedRef.current,
            // The clock, for the sim's scheduled lives (slice
            // 42): the hermit's dawn gift and the moth's road.
            latestStateRef.current.dayNightCycle,
            // Field Notes witnesses (creature slice 47): the sim
            // stamps the notes it can see happen — an escort
            // performed, a verdict filed, a gift left at dawn —
            // through App's append-only, deduped sink.
            (noteId) => liveGameRefs.current.recordFieldWitness?.(noteId),
            // The Meadowback's sentinel bell (creature slice
            // 49): the sim reports; the loop announces. A
            // threat-bell on armed worlds, a visitor-bell on
            // Peaceful — the same low note, read by context.
            (_species, kind) => {
              liveGameRefs.current.postNotification(
                'The Sentinel Bell',
                kind === 'threat'
                  ? 'A low bell-note rolls out from your Meadowback — something nearby is hunting.'
                  : 'A low bell-note from your Meadowback, unhurried — it has seen a visitor, and announced it.',
                'system',
                '#a3a380'
              );
            },
            // The World Asks Back (2026-10-16): the saga event
            // sink — culls stamp through here into App's ledger.
            (input) => liveGameRefs.current.recordAsksEvent?.(input),
            // The Lodestone Bulwark's pull (Ingredient Sinks,
            // 2026-10-17): the drop pass's reach this tick,
            // from the shield in hand and whether it is raised.
            dropMagnetFor(
              shieldOf(playerState.heldItemId ?? null) ?? undefined,
              liveGameRefs.current.shield?.raisedRef.current ?? false
            )
          );
        }

        // 3. Smooth Sol-Cycle advancement (1 second throttled UI tick, host authority)
        accumulatedDayTime.current += dt;
        if (accumulatedDayTime.current >= 1.0) {
          accumulatedDayTime.current = 0;
          if (!multiplayerManager.isConnected || multiplayerManager.isHost) {
            setDayNightCycle((prev) => {
              // Adam's ten minutes per planet rotation
              // (day/night build, 2026-10-16): this block ticks
              // once per second, so +1/600 per tick is the cycle.
              const next = (prev + 1 / 600) % 1.0;
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
    annotateTunnelPairing(structuresList);
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


  // The held light is driven per frame in the shield block above
  // (a braced lamp-shield throws it forward); no effect needed.
}
