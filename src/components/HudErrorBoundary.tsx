/**
 * HudErrorBoundary — the HUD's own safety net (2026-10-18, the
 * PR #56 phone black-screen's second lesson).
 *
 * The heal-loop regression blacked the WHOLE screen because a
 * fault inside one HUD panel propagated to the app root and
 * unmounted everything — game included. Whatever a panel does
 * wrong from here on, the blast radius stops at the furniture:
 * this boundary catches a render fault in the HUD layer, drops
 * the panels, and leaves a small note with a RELOAD PANELS tap
 * that re-mounts them. The world underneath keeps running; the
 * player loses chrome for a moment, never the game.
 *
 * Class component by necessity: error boundaries have no hook
 * form. Deliberately tiny and dependency-free.
 */

import React from 'react';

interface HudErrorBoundaryState {
  failed: boolean;
}

export class HudErrorBoundary extends React.Component<
  { children: React.ReactNode },
  HudErrorBoundaryState
> {
  state: HudErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): HudErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // The console keeps the evidence for the bug report; the
    // player keeps the game.
    console.error('[BioForge HUD] a panel faulted and was dropped:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="pointer-events-auto absolute left-1/2 top-4 z-50 -translate-x-1/2">
        <button
          type="button"
          onClick={() => this.setState({ failed: false })}
          className="rounded-full border border-amber-400/50 bg-slate-900/90 px-4 py-2 text-xs font-tech font-bold text-amber-200 shadow-lg"
        >
          The HUD hit a snag — tap to bring the panels back
        </button>
      </div>
    );
  }
}
