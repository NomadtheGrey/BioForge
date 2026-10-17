/**
 * TutorialChrome — the tutorial's face (How to Play program,
 * Adam, 2026-10-17; design: ReadMeFiles/HOW_TO_PLAY_AND_
 * TUTORIAL.md §3). The ENGINE is the background lane's
 * useTutorial hook; this component is pure presentation:
 * it renders the current step's card and draws the pulsing
 * ring around the step's target. It owns no state of its
 * own beyond where the target happens to be on screen.
 *
 * The chrome rules (ratified with the design):
 *  - The ring NEVER takes clicks (pointer-events-none) and
 *    never dims or covers the game — it points, it does not
 *    fence.
 *  - A step whose target is null (its target is the WORLD —
 *    pick a plant, walk out of the home zone) runs in
 *    no-target mode: the card stands alone, no ring.
 *  - The tutorial NEVER traps the player: Next / Skip / End
 *    are on every card, and they answer to keys as well as
 *    clicks, because a signal-gated step runs while the
 *    pointer is locked and the mouse is the camera.
 *  - Targets resolve by DOM id: HUD panels carry their
 *    HUD_PANELS id on their root element (HudPanel), and the
 *    fixed help cluster's buttons carry their own ids
 *    ('quests-btn' / 'howto-btn').
 *
 * Keys: → or N = Next · ← = Skip step · X = End tutorial.
 * (Letters were chosen to dodge the game's own bindings:
 * WASD moves, B is the forge, S walks backward — arrows and
 * the two unused letters are what is safely left.)
 */

import React, { useEffect, useState } from 'react';
import { X, ChevronRight, ChevronsRight, Flag } from 'lucide-react';
import type { UseTutorialResult } from '../hooks/useTutorial';

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const TutorialChrome: React.FC<{ tutorial: UseTutorialResult }> = ({ tutorial }) => {
  const { active, step, stepNumber, stepCount, next, skip, exit } = tutorial;
  const target = step?.target ?? null;

  // ── The ring's anchor ────────────────────────────────────
  // Panels can be dragged mid-step and the window can
  // resize, so the target's rect is re-measured on a short
  // beat rather than once. 200 ms is invisible as lag on a
  // pulsing outline and costs nothing.
  const [rect, setRect] = useState<Rect | null>(null);
  useEffect(() => {
    if (!active || !target) {
      setRect(null);
      return;
    }
    const measure = () => {
      const el = document.getElementById(target);
      if (!el) {
        setRect(null);
        return;
      }
      const r = el.getBoundingClientRect();
      setRect({ x: r.left, y: r.top, w: r.width, h: r.height });
    };
    measure();
    const beat = window.setInterval(measure, 200);
    window.addEventListener('resize', measure);
    return () => {
      window.clearInterval(beat);
      window.removeEventListener('resize', measure);
    };
  }, [active, target]);

  // ── Keys (see header: the bindings that are safe) ───────
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
      if (e.key === 'ArrowRight' || e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        next();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        skip();
      } else if (e.key === 'x' || e.key === 'X') {
        e.preventDefault();
        exit();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, next, skip, exit]);

  if (!active || !step) return null;

  const isLast = stepNumber >= stepCount;
  const gated = step.gate !== 'manual';

  return (
    <>
      {/* The ring: a padded, pulsing outline around the
          step's target. pointer-events-none by rule — the
          player must be able to USE the thing it points at. */}
      {rect && (
        <div
          aria-hidden
          className="fixed z-30 pointer-events-none rounded-[1.4rem] border-2 border-emerald-300 shadow-[0_0_24px_rgba(52,211,153,0.65)] animate-pulse"
          style={{
            left: rect.x - 6,
            top: rect.y - 6,
            width: rect.w + 12,
            height: rect.h + 12,
          }}
        />
      )}

      {/* The step card: bottom-center, parked ABOVE the
          hotbar so the tools it talks about stay visible.
          Words come from tutorialSteps.ts verbatim — the
          text of record lives there, not here. */}
      <div className="fixed z-40 left-1/2 -translate-x-1/2 bottom-36 w-[min(92vw,30rem)] pointer-events-auto">
        <div className="glass-panel-biolum rounded-3xl border border-emerald-500/50 shadow-2xl px-5 py-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Flag className="w-3.5 h-3.5 text-emerald-300" />
            <span className="text-[10px] font-tech font-bold tracking-widest text-emerald-300 uppercase">
              Tutorial · Step {stepNumber} of {stepCount}
            </span>
            {gated && (
              <span className="text-[10px] font-mono text-slate-400">
                — or just do it; the game will notice
              </span>
            )}
          </div>
          <h3 className="font-tech font-bold text-base text-slate-50 leading-snug">
            {step.title}
          </h3>
          <p className="text-[13px] leading-relaxed text-slate-300 mt-1">{step.body}</p>

          {/* Every exit, always (the never-traps rule):
              End leaves the walk, Skip leaves the step,
              Next walks on — by click or by key. */}
          <div className="flex items-center gap-2 mt-3.5">
            <button
              onClick={exit}
              className="px-3 py-1.5 rounded-lg text-[10px] font-tech font-bold text-slate-400 hover:text-white hover:bg-slate-800/70 transition-all cursor-pointer flex items-center gap-1"
              title="End the tutorial (X)"
            >
              <X className="w-3.5 h-3.5" /> END
            </button>
            <button
              onClick={skip}
              className="px-3 py-1.5 rounded-lg text-[10px] font-tech font-bold text-slate-200 border border-slate-600/70 hover:bg-slate-800/70 transition-all cursor-pointer flex items-center gap-1"
              title="Skip this step (←)"
            >
              <ChevronsRight className="w-3.5 h-3.5" /> SKIP STEP
            </button>
            <button
              onClick={next}
              className="ml-auto px-4 py-1.5 rounded-lg text-[10px] font-tech font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1"
              title={isLast ? 'Finish the tutorial (→)' : 'Next step (→)'}
            >
              {isLast ? 'FINISH' : 'NEXT'} <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
