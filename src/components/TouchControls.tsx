import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowBigUp, Hand } from 'lucide-react';

// ============================================================================
// TouchControls — the phone's second input backend
// ============================================================================
//
// Desktop BioForge is driven by WASD, pointer-lock mouse look, Space,
// and clicks. None of those input devices exist on a phone, so this
// overlay translates thumbs into the SAME verbs App already owns:
//
//   left thumb  -> a floating thumbstick -> the movement booleans the
//                  keyboard fills today (far push = sprint)
//   right thumb -> drag to look, using the engine's touch-look entry
//   quick tap   -> the center-screen tool interaction
//   USE button  -> the same deliberate center interaction
//   JUMP button -> App's existing attemptJump (hop / bounce-shroom)
//
// This component owns GESTURES ONLY. It does not move the player,
// rotate the camera, or decide what a tool does; App and the engine
// keep those jobs, which is why desktop and touch cannot drift into
// two subtly different games.
//
// Layout note: the overlay root ignores pointer events. Its gesture
// zones opt back in underneath the HUD; HUD panels and buttons are
// later siblings with their own pointer handling, so a thumb aiming
// for the hotbar never starts a camera drag underneath it.
// ============================================================================

export interface TouchMoveInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  sprint: boolean;
}

interface TouchControlsProps {
  onMoveChange: (input: TouchMoveInput) => void;
  onLook: (deltaX: number, deltaY: number) => void;
  onJump: () => void;
  onInteract: () => void;
}

const STOPPED: TouchMoveInput = {
  forward: false,
  backward: false,
  left: false,
  right: false,
  sprint: false,
};

// The stick reports a direction once the thumb has travelled this
// far from its landing point; inside it, the player stands still.
// Distances are fractions of the stick radius.
const STICK_RADIUS_PX = 52;
const STICK_KNOB_TRAVEL_PX = 36;
const STICK_DEAD_ZONE = 0.16;
const STICK_DIRECTION = 0.34;
const STICK_SPRINT = 0.85;
// A look gesture still counts as a TAP (use the tool) when it is
// short and barely moves; anything longer is a camera drag, and a
// drag must never fire the tool on release.
const TAP_MAX_DISTANCE_PX = 12;
const TAP_MAX_DURATION_MS = 400;

interface Point {
  x: number;
  y: number;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  onMoveChange,
  onLook,
  onJump,
  onInteract,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);

  // Thumbstick state: where the thumb landed (its floating base) and
  // how far the knob is displaced from that base, in pixels.
  const stickPointerId = useRef<number | null>(null);
  const stickOrigin = useRef<Point | null>(null);
  const [stickBase, setStickBase] = useState<Point | null>(null);
  const [stickKnob, setStickKnob] = useState<Point>({ x: 0, y: 0 });

  // Look-drag state: the active pointer and its last position, plus
  // the gesture's start so a quick, still touch can read as a tap.
  const lookPointerId = useRef<number | null>(null);
  const lookLast = useRef<Point | null>(null);
  const lookStart = useRef<{ point: Point; at: number; dragged: boolean } | null>(null);

  const stopStick = useCallback(() => {
    stickPointerId.current = null;
    stickOrigin.current = null;
    setStickBase(null);
    setStickKnob({ x: 0, y: 0 });
    onMoveChange(STOPPED);
  }, [onMoveChange]);

  // If the overlay unmounts mid-gesture (a modal opens, the world
  // changes), never leave a movement direction switched on.
  useEffect(() => stopStick, [stopStick]);

  const localPoint = (clientX: number, clientY: number): Point => {
    const rect = rootRef.current?.getBoundingClientRect();
    return {
      x: clientX - (rect?.left ?? 0),
      y: clientY - (rect?.top ?? 0),
    };
  };

  const updateStick = (clientX: number, clientY: number) => {
    const origin = stickOrigin.current;
    if (!origin || !rootRef.current) return;
    const rect = rootRef.current.getBoundingClientRect();
    const dx = clientX - rect.left - origin.x;
    const dy = clientY - rect.top - origin.y;
    const distance = Math.hypot(dx, dy);
    const magnitude = distance / STICK_RADIUS_PX;
    // The knob's drawn travel is shorter than the input radius: it
    // stays inside its base ring even when the thumb pushes past
    // the ring for a full-tilt (or sprint) input.
    const knobScale = distance > 0 ? Math.min(1, STICK_KNOB_TRAVEL_PX / distance) : 0;
    setStickKnob({ x: dx * knobScale, y: dy * knobScale });

    if (magnitude <= STICK_DEAD_ZONE) {
      onMoveChange(STOPPED);
      return;
    }
    const nx = dx / (distance || 1);
    const ny = dy / (distance || 1);
    onMoveChange({
      forward: ny < -STICK_DIRECTION,
      backward: ny > STICK_DIRECTION,
      left: nx < -STICK_DIRECTION,
      right: nx > STICK_DIRECTION,
      // Sprint is the far forward push: the touch twin of desktop's
      // double-tap W. A far sideways/backwards push just walks.
      sprint: magnitude >= STICK_SPRINT && ny < -STICK_DIRECTION,
    });
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || stickPointerId.current !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    stickPointerId.current = e.pointerId;
    const point = localPoint(e.clientX, e.clientY);
    stickOrigin.current = point;
    setStickBase(point);
    setStickKnob({ x: 0, y: 0 });
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickPointerId.current) return;
    e.preventDefault();
    updateStick(e.clientX, e.clientY);
  };

  const handleStickEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== stickPointerId.current) return;
    e.preventDefault();
    stopStick();
  };

  const handleLookDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' || lookPointerId.current !== null) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    lookPointerId.current = e.pointerId;
    const point = localPoint(e.clientX, e.clientY);
    lookLast.current = point;
    lookStart.current = { point, at: performance.now(), dragged: false };
  };

  const handleLookMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current || !lookLast.current) return;
    e.preventDefault();
    const point = localPoint(e.clientX, e.clientY);
    const deltaX = point.x - lookLast.current.x;
    const deltaY = point.y - lookLast.current.y;
    lookLast.current = point;
    const start = lookStart.current;
    if (start && Math.hypot(point.x - start.point.x, point.y - start.point.y) > TAP_MAX_DISTANCE_PX) {
      start.dragged = true;
    }
    if (deltaX !== 0 || deltaY !== 0) onLook(deltaX, deltaY);
  };

  const handleLookEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== lookPointerId.current) return;
    e.preventDefault();
    const start = lookStart.current;
    lookPointerId.current = null;
    lookLast.current = null;
    lookStart.current = null;
    // Only a short, still touch is a tap. A camera drag ending over
    // a plant must not harvest it by accident.
    if (start && !start.dragged && performance.now() - start.at <= TAP_MAX_DURATION_MS) {
      onInteract();
    }
  };

  const pressButton = (
    e: React.PointerEvent<HTMLButtonElement>,
    action: () => void
  ) => {
    // Buttons answer on pointer DOWN, not the later click: a game
    // control should fire when the thumb lands, and the gesture must
    // not leak into the look zone behind the button.
    e.preventDefault();
    e.stopPropagation();
    action();
  };

  return (
    <div
      ref={rootRef}
      className="pointer-events-none absolute inset-0 z-0 select-none overflow-hidden"
      data-testid="touch-controls"
    >
      {/* Camera-drag field: the right-hand side of the world. The
          left side belongs to the thumbstick, so the two thumbs can
          work at the same time without stealing each other's drag. */}
      <div
        className="pointer-events-auto absolute right-0 top-0 h-full w-[56%] [touch-action:none]"
        data-testid="touch-look-surface"
        onPointerDown={handleLookDown}
        onPointerMove={handleLookMove}
        onPointerUp={handleLookEnd}
        onPointerCancel={handleLookEnd}
      />

      {/* Thumbstick field: the lower-left. The stick is FLOATING —
          its base appears wherever the thumb lands in this field, so
          the player never has to hunt for a fixed spot on the glass. */}
      <div
        className="pointer-events-auto absolute bottom-36 left-0 h-[36dvh] w-[46%] [touch-action:none]"
        data-testid="touch-stick-surface"
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickEnd}
        onPointerCancel={handleStickEnd}
      >
        {/* Resting guide: where the stick will wake up, drawn only
            while no thumb is down. */}
        {!stickBase && (
          <div className="pointer-events-none absolute bottom-5 left-5 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-200/25 bg-slate-950/25">
            <div className="h-14 w-14 rounded-full border border-cyan-100/30 bg-cyan-300/10" />
          </div>
        )}
      </div>

      {/* The live stick, centred on the thumb's landing point. */}
      {stickBase && (
        <div
          className="pointer-events-none absolute z-20 flex h-28 w-28 items-center justify-center rounded-full border border-cyan-200/40 bg-slate-950/30 shadow-xl"
          style={{ left: stickBase.x, top: stickBase.y, transform: 'translate(-50%, -50%)' }}
        >
          <div
            className="h-14 w-14 rounded-full border border-cyan-100/50 bg-cyan-300/25 shadow-lg shadow-cyan-500/20"
            style={{
              transform: `translate(${stickKnob.x}px, ${stickKnob.y}px)`,
            }}
          />
        </div>
      )}

      {/* Thumb buttons: USE rides above JUMP at the right edge, in
          the arc of the right thumb and clear of the hotbar below.
          Both are deliberately larger than the minimum tap target —
          they get pressed while looking at the world, not at them. */}
      <div className="absolute bottom-40 right-3 z-20 flex flex-col items-center gap-3">
        <button
          type="button"
          aria-label="Use current tool"
          className="pointer-events-auto flex h-16 w-16 flex-col items-center justify-center rounded-full border border-teal-200/50 bg-teal-400/20 text-teal-50 shadow-xl shadow-teal-950/30 backdrop-blur-sm [touch-action:none] active:bg-teal-300/35"
          onPointerDown={(e) => pressButton(e, onInteract)}
        >
          <Hand className="h-6 w-6" />
          <span className="mt-0.5 text-[9px] font-bold tracking-widest">USE</span>
        </button>
        <button
          type="button"
          aria-label="Jump"
          className="pointer-events-auto flex h-[4.5rem] w-[4.5rem] flex-col items-center justify-center rounded-full border border-cyan-200/50 bg-cyan-400/20 text-cyan-50 shadow-xl shadow-cyan-950/30 backdrop-blur-sm [touch-action:none] active:bg-cyan-300/35"
          onPointerDown={(e) => pressButton(e, onJump)}
        >
          <ArrowBigUp className="h-7 w-7" />
          <span className="mt-0.5 text-[9px] font-bold tracking-widest">JUMP</span>
        </button>
      </div>
    </div>
  );
};
