/**
 * BioForge Game Input Domain Hook
 * Extracted from App.tsx (2026-10-15, the seam-by-seam refactor —
 * seam 5 of 6, a pure move: no behavior changes).
 *
 * Owns the input surface: the movement-key + touch + stamina refs
 * the game loop consumes, the seed/fertilizer/blueprint cycling,
 * jumping (hop + bounce-shroom launch checks), the touch adapters,
 * the gated tool selector, and the keyboard + wheel listener
 * effects. The loop (seam 6) reads the returned refs; the HUD reads
 * the returned verbs.
 *
 * The debug-kit toggle arrives as a lazy callback: useDebugKit is
 * called further down App's body than this hook (it depends on the
 * save session's state mirror), and the toggle is only ever
 * invoked on a keypress, long after mount.
 */

import { useRef, useCallback, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { ITEMS, NON_BUILDABLE_STRUCTURE_IDS } from '../game/items/constants';
import { isPropaguleItem } from '../game/flora/propagation';
import { isFloorType } from '../game/structures/placement';
import { TOOL_NAMES } from '../game/quests/quests';
import { soundEngine } from '../audio/soundEngine';
import type { BioForgeThreeEngine } from '../game/engine/threeEngine';
import type { TouchMoveInput } from '../components/TouchControls';
import type {
  FloraEntity, GameNotification, ItemId, PlayerState, StructureEntity, StructureType, ToolType,
} from '../types/game';
import type { InventoryMap } from './useSaveSession';

export type ActiveModal =
  | 'bioforge' | 'inventory' | 'codex' | 'multiplayer' | 'controls' | 'devtools' | 'quests' | 'storage' | 'vat' | 'wall' | null;

// Jump tuning (module level: the game loop in App reads JUMP_GRAVITY
// and STORY_HEIGHT_METERS for its per-frame integration).
export const BOUNCE_RADIUS = 0.9;
export const BOUNCE_GRACE_MS = 1600;
export const BOUNCE_MIN_STAGE = 4;
export const JUMP_GRAVITY = 24; // m/s^2 — gamey, snappier than Earth's 9.8
export const JUMP_VELOCITY = 5.4; // ordinary hop: ~0.6 m peak, ~0.45 s of air
export const BOUNCE_VELOCITY = 12.5; // shroom launch: ~3.3 m peak — clears a story
export const STORY_HEIGHT_METERS = 2.4; // mirrors threeEngine's STORY_HEIGHT

export interface GameInputDeps {
  engineRef: { current: BioForgeThreeEngine | null };
  jumpRef: { current: { y: number; vy: number; bounceFlip: boolean } };
  playerPosRef: { current: { x: number; z: number; rotation: number } };
  playerLevelRef: { current: number };
  activeModalRef: { current: string | null };
  activeModal: ActiveModal;
  isPointerLocked: boolean;
  playerState: PlayerState;
  inventory: InventoryMap;
  structuresListRef: { current: StructureEntity[] };
  floraListRef: { current: FloraEntity[] };
  bounceGraceUntil: { current: number };
  unlockedTools: ToolType[];
  setActiveTool: (tool: ToolType) => void;
  setSelectedStructureType: (structureType: StructureType) => void;
  setSelectedSeedId: (seedId: ItemId) => void;
  setSelectedFertilizerId: (fertilizerId: ItemId) => void;
  setActiveModal: Dispatch<SetStateAction<ActiveModal>>;
  postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
  /** LAZY: the debug-kit swap (Backquote), defined below in App. */
  onToggleDebugKit: () => void;
  /** The water module's stance toggle (F) — App flips the
   *  stance ref; the game loop reads it in the water. */
  onWaterStanceToggle: () => void;
  /** LAZY: swap the striker slot's draw (close ↔ ranged), defined
   *  in App — the weapons build (Adam, 2026-10-16). Triggered by
   *  re-selecting slot 7 (key tap or hotbar click) and by the
   *  mouse wheel while the striker is in hand. */
  onToggleStrikerDraw: () => void;
  /** Pond depth under the player (P5 move 2, Adam, 2026-10-16):
   *  App bridges this to the engine's waterDepthAt. Optional —
   *  an absent getter means a dry world. */
  getWaterDepth?: (x: number, z: number) => number;
  /** LAZY: the Left Hand cycle (the shield slice, Adam, 2026-10-17):
   *  Ctrl+wheel / Ctrl+↑↓ walk the owned left-hand instruments
   *  (the modifier moved Alt → Ctrl by Adam's ruling, 2026-10-18).
   *  Ref-driven — App's cycle lives below the input call site. */
  onCycleLeftHand: (dir: 1 | -1) => void;
}

export function useGameInput(deps: GameInputDeps) {
  const {
    engineRef, jumpRef, playerPosRef, playerLevelRef, activeModalRef,
    activeModal, isPointerLocked, playerState, inventory,
    structuresListRef, floraListRef, bounceGraceUntil, unlockedTools,
    setActiveTool, setSelectedStructureType, setSelectedSeedId, setSelectedFertilizerId,
    setActiveModal, postNotification, onToggleDebugKit, onWaterStanceToggle, onToggleStrikerDraw, getWaterDepth,
    onCycleLeftHand,
  } = deps;
  // The keyboard handler calls the toggle through the lazy dep.
  const toggleDebugKit = onToggleDebugKit;
  const toggleStrikerDraw = onToggleStrikerDraw;

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
  // The wheel carries PLANTING STOCK (propagation, 2026-10-18):
  // every seed-category item, plus every species' PIECE
  // propagule (a cutting or tuber is rarely a 'seed' by
  // category — dew, a shard, the reed itself) — membership is
  // the propagation data's word, so the wheel and the planter
  // can never disagree about what plants.
  const seedCycle: ItemId[] = useMemo(
    () =>
      Object.values(ITEMS)
        .filter((item) => item.category === 'seed' || isPropaguleItem(item.id))
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
        (s) => isFloorType(s.type) && (s.level ?? 0) === level && s.gridX === gx && s.gridZ === gz
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
      // Deep water steals the hop (P5 move 2, Adam, 2026-10-16):
      // chest-deep, your jump is a feeble heave — enough to climb
      // out at a shore, not enough to bunny-cross a pond. The
      // shroom launch above is exempt: a bounce fires you out of
      // anything, as it should.
      const depth = getWaterDepth?.(playerPosRef.current.x, playerPosRef.current.z) ?? 0;
      j.vy = depth > 0.9 ? JUMP_VELOCITY * 0.45 : JUMP_VELOCITY;
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


  const handleSelectTool = (tool: ToolType): void => {
    if (!unlockedTools.includes(tool)) {
      // The striker is not a module (weapons build): its lock
      // message names the crafts that fill the slot instead.
      if (tool === 'striker') {
        postNotification(
          'The Striker Slot Is Empty',
          'No weapon grown yet — grow a Briar Barb or a Spit Pod at the Bio-Forge and slot 7 wakes.',
          'alert',
          '#f59e0b',
        );
        return;
      }
      postNotification(
        'Module Not Grafted',
        `The ${TOOL_NAMES[tool]} is a gauntlet module — craft it at the Bio-Forge to unlock it. Your quest list [Q] shows the way.`,
        'alert',
        '#f59e0b',
      );
      return;
    }
    // Re-selecting the striker while it is in hand swaps its draw
    // (Adam, 2026-10-16: number tap switches close ↔ ranged).
    if (tool === 'striker' && playerState.activeTool === 'striker') {
      toggleStrikerDraw();
      return;
    }
    setActiveTool(tool);
  };

  // --------------------------------------------------------------------------
  // Keyboard Input with Guard Clauses (Esc / Pause Mode Awareness)
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape closes the open dialog, as if its X were clicked
      // (Adam, 2026-10-16) — handled BEFORE the typing guard:
      // Esc means "close" even from inside a text field (the
      // search boxes, the room-code field), where the guard
      // below otherwise swallows the key and the dialog stays
      // up. Every other key keeps the guard.
      if (e.key === 'Escape') {
        if (activeModal !== null) {
          setActiveModal(null);
        }
        keysPressed.current = {};
        return;
      }

      // Guard Clause 1: Ignore inputs if user is typing in form/chat fields
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) {
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

      // F flips the WATER MODULE's stance (Adam's consolidation,
      // 2026-10-18): swim ⇄ walk-the-water, for a Quicksteps
      // wearing the module's second growth. Ctrl+F / Cmd+F is
      // the browser's find — never the stance.
      if (e.key.toLowerCase() === 'f' && !e.ctrlKey && !e.metaKey && !e.repeat) {
        onWaterStanceToggle();
        return;
      }
      if (e.key === '?') {
        setActiveModal((prev) => (prev === 'controls' ? null : 'controls'));
        return;
      }

      const key = e.key.toLowerCase();

      // LEFT HAND (the shield slice, Adam, 2026-10-17; modifier
      // moved Alt → Ctrl by his ruling, 2026-10-18): Ctrl is the
      // left-hand modifier — Ctrl+↑/↓ walks the owned left-hand
      // instruments (lantern, shields) INSTEAD of every plain-arrow
      // behavior, and the arrows never register as movement keys
      // while Ctrl is held. Checked FIRST, before the tool arrows.
      // (macOS note: the OS eats Ctrl+↑/↓ for Mission Control —
      // Mac hands use Ctrl+wheel or the tile click instead.)
      if (e.ctrlKey && (key === 'arrowup' || key === 'arrowdown')) {
        e.preventDefault();
        onCycleLeftHand(key === 'arrowdown' ? 1 : -1);
        return;
      }

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
      // (skipped while Ctrl is held — Ctrl+arrows is the Left Hand
      // cycle, never movement).
      if (!e.ctrlKey && ['w', 'a', 's', 'd', 'arrowup', 'arrowleft', 'arrowdown', 'arrowright'].includes(key)) {
        keysPressed.current[key] = true;
      }

      if (key === 'w' && !e.repeat) {
        const now = performance.now();
        if (now - lastWTap.current < 300) {
          sprinting.current = true;
        }
        lastWTap.current = now;
      }

      // Tools 1 - 7 selection (7 = the striker slot; tapping it
      // while the striker is in hand swaps the draw — see
      // handleSelectTool).
      const toolKeyMap: Record<string, typeof playerState.activeTool> = {
        '1': 'harvest_glove',
        '2': 'bio_scanner',
        '3': 'planter_trowel',
        '4': 'solvent_sprayer',
        '5': 'taming_lure',
        '6': 'builder',
        '7': 'striker',
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
  }, [activeModal, isPointerLocked, setActiveTool, playerState.activeTool, cycleLoadedFertilizer, cycleSelectedStructure, attemptJump, onCycleLeftHand]);

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
      // LEFT HAND (the shield slice, Adam, 2026-10-17; modifier
      // moved Alt → Ctrl by his ruling, 2026-10-18): Ctrl is the
      // left-hand modifier — Ctrl+wheel walks the owned left-hand
      // instruments, and the plain wheel behavior (gauntlet side:
      // seeds / blueprints / striker draw) does NOT fire while
      // Ctrl is held.
      // THE ZOOM HAZARD, solved on purpose: browsers read
      // Ctrl+wheel as PAGE ZOOM. This listener is registered
      // NON-PASSIVE (below) precisely so the preventDefault here
      // holds the zoom off while the hand cycles — with a passive
      // listener the call would be ignored and the page would
      // zoom out from under the player. (Trackpad pinch also
      // arrives as Ctrl+wheel in Chrome; inside pointer lock the
      // gesture is inert to the browser anyway, and out of lock
      // the modal gate above has already returned.)
      if (e.ctrlKey) {
        e.preventDefault();
        const now = performance.now();
        if (now - lastWheelCycleRef.current < 150) return;
        lastWheelCycleRef.current = now;
        onCycleLeftHand(e.deltaY > 0 ? 1 : -1);
        return;
      }
      const tool = playerState.activeTool;
      if (tool !== 'planter_trowel' && tool !== 'builder' && tool !== 'striker') return;
      const now = performance.now();
      if (now - lastWheelCycleRef.current < 150) return;
      lastWheelCycleRef.current = now;
      if (tool === 'planter_trowel') {
        cycleSelectedSeed(e.deltaY > 0 ? 1 : -1);
      } else if (tool === 'builder') {
        cycleSelectedStructure(e.deltaY > 0 ? 1 : -1);
      } else {
        // The striker has no sub-selection of its own, so with it
        // in hand the wheel means the draw swap (Adam, 2026-10-16:
        // mouse wheel switches between ranged and melee).
        toggleStrikerDraw();
      }
    };

    // { passive: false } is LOAD-BEARING: window wheel listeners
    // default to passive in Chrome, which would silently ignore
    // the Ctrl+wheel zoom guard in handleWheel (see above).
    window.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      window.removeEventListener('wheel', handleWheel);
    };
  }, [activeModal, playerState.activeTool, cycleSelectedSeed, cycleSelectedStructure, toggleStrikerDraw, onCycleLeftHand]);

  return {
    keysPressed, lastWTap, sprinting, touchInputRef, staminaRef, lastStaminaSync,
    cycleLoadedFertilizer, cycleSelectedSeed, cycleSelectedStructure,
    attemptJump, handleTouchMoveChange, handleTouchLook, handleTouchInteract, handleSelectTool,
  };
}
