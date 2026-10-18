/**
 * HudPanel — the movable, closeable frame every HUD element wears
 * (Adam, 2026-10-16).
 *
 * Behavior:
 *   - DRAG: press the mouse on the panel's grip badge (top-left
 *     corner) — or on any non-interactive part of the panel — and
 *     drag; the panel follows and the offset is remembered by
 *     useHudLayout. Buttons and other controls inside the panel
 *     never start a drag, so every existing click keeps working.
 *   - CLOSE: the ✕ badge (top-right corner) hides the panel. It is
 *     a HIDE, not a delete — the panel comes back from the HUD
 *     Options screen (pause overlay → OPTIONS), which lists every
 *     panel with an on/off switch.
 *
 * The badges stay invisible until the panel is hovered (on touch
 * screens, where hover does not exist, they rest at low opacity).
 * The wrapper applies the saved offset as a transform on top of the
 * panel's normal layout position — flow and anchors stay exactly as
 * the layout code put them; dragging only nudges.
 *
 * Note on pointer lock: while the mouse is captured for looking
 * around there is no cursor to drag with. Press ESC to free the
 * mouse first — the same way every other HUD click already works.
 */

import React, { useLayoutEffect, useRef, useState } from 'react';
import { Move, X } from 'lucide-react';
import type { HudOffset, HudPanelId } from '../hooks/useHudLayout';

interface HudPanelProps {
  id: HudPanelId;
  /** Friendly name, used in the badges' tooltips. */
  label: string;
  /** Saved drag offset from useHudLayout. */
  offset: HudOffset;
  /** Called live while dragging so the panel tracks the mouse. */
  onMove: (id: HudPanelId, offset: HudOffset) => void;
  /** The ✕: hide this panel (restorable from HUD Options). */
  onClose: (id: HudPanelId) => void;
  /** Positioning / layout classes for the wrapper (absolute anchors,
   *  flex behavior) — the wrapped panel keeps its own styling. */
  className?: string;
  children: React.ReactNode;
}

/** A press counts as a drag only once the mouse has actually
 *  travelled — a plain click on panel surface stays a click. */
const DRAG_THRESHOLD_PX = 4;

export const HudPanel: React.FC<HudPanelProps> = ({
  id,
  label,
  offset,
  onMove,
  onClose,
  className = '',
  children,
}) => {
  const [dragging, setDragging] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [healTick, setHealTick] = useState(0);

  // Rotation / window resize can strand a panel too — re-check.
  React.useEffect(() => {
    const onResize = () => setHealTick((t) => t + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    if (dragging) return;
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const MIN_VISIBLE = 56;
    const EDGE = 8;
    const visW = Math.min(rect.right, vw) - Math.max(rect.left, 0);
    const visH = Math.min(rect.bottom, vh) - Math.max(rect.top, 0);
    if (visW >= MIN_VISIBLE && visH >= MIN_VISIBLE) return;
    let dx = 0;
    let dy = 0;
    if (visW < MIN_VISIBLE) {
      dx = rect.width > vw - EDGE * 2 || rect.left < 0 ? EDGE - rect.left : vw - EDGE - rect.right;
    }
    if (visH < MIN_VISIBLE) {
      dy = rect.height > vh - EDGE * 2 || rect.top < 0 ? EDGE - rect.top : vh - EDGE - rect.bottom;
    }
    if (dx !== 0 || dy !== 0) {
      onMove(id, { x: offset.x + dx, y: offset.y + dy });
    }
  }, [offset, dragging, id, onMove, healTick]);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
    moved: boolean;
  } | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Left button / touch / pen only.
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const target = e.target as HTMLElement;
    const fromGrip = target.closest('[data-hud-grip]') !== null;
    // Interactive innards keep their clicks: a press that starts on
    // a button, link, or field is a press on that control, never a
    // drag — unless it started on the grip badge itself (the badge
    // is deliberately rendered as a plain div, not a button).
    if (!fromGrip && target.closest('button, a, input, select, textarea, [data-no-drag]')) {
      return;
    }
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    if (!drag.moved) {
      drag.moved = true;
      setDragging(true);
    }
    onMove(id, { x: drag.baseX + dx, y: drag.baseY + dy });
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current?.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
  };

  const badgeClass =
    'absolute z-40 flex h-5 w-5 items-center justify-center rounded-full border border-slate-500/70 bg-slate-900/90 text-slate-300 shadow-md opacity-0 transition-opacity duration-150 group-hover/hud:opacity-100 [@media(hover:none)]:opacity-60 [@media(hover:none)]:h-7 [@media(hover:none)]:w-7';

  return (
    <div
      ref={wrapRef}
      // The panel's registry id IS its DOM id (How to Play
      // tutorial, 2026-10-17): the tutorial's highlight ring
      // resolves a step's target with getElementById, and the
      // steps name panels by their HUD_PANELS id. One element
      // per panel, so the ids stay unique.
      id={id}
      className={`group/hud relative pointer-events-auto ${dragging ? 'z-30' : ''} ${className}`}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        // TOUCH-ACTION IS 'none' ALWAYS (phone playtest find,
        // 2026-10-18): the browser decides at POINTERDOWN whether
        // a touch becomes a scroll/pan gesture. This used to be
        // set only once `dragging` flipped true — one move too
        // late: on a phone the browser claimed every touch for
        // scrolling and cancelled the pointer, so panels were
        // impossible to drag by finger while the mouse worked
        // perfectly. HUD panels are chrome — nothing inside one
        // needs a native scroll gesture — so the claim is off
        // for good. (Buttons inside still click normally;
        // touch-action governs gestures, not taps.)
        touchAction: 'none',
        userSelect: dragging ? 'none' : undefined,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {/* Drag grip — the always-works handle, even on panels that
          are wall-to-wall buttons (hotbar, session bar). */}
      <div
        data-hud-grip
        title={`Drag to move the ${label}`}
        className={`${badgeClass} -left-2 -top-2 cursor-grab active:cursor-grabbing`}
      >
        <Move className="h-3 w-3" />
      </div>

      {/* Close (hide) — restorable from Pause → OPTIONS. A real
          button for a11y; pointerdown is stopped so a press on it
          can never begin a drag. */}
      <button
        type="button"
        title={`Hide the ${label} (bring it back from Pause → Options)`}
        aria-label={`Hide the ${label}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={() => onClose(id)}
        className={`${badgeClass} -right-2 -top-2 cursor-pointer hover:bg-slate-700 hover:text-white`}
      >
        <X className="h-3 w-3" />
      </button>

      {children}
    </div>
  );
};
