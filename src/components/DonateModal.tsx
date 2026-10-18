/**
 * DonateModal — the two doors of support (Adam's build
 * order, 2026-10-18: "Let's point this to a modal in two
 * places. A little modal that offers to point to Ko-Fi OR
 * itch.io").
 *
 * Every Donate seat in the game opens THIS modal; the doors
 * inside do the traveling:
 *
 *   KO-FI — live today. The maker's tip jar, one click out
 *   (game/links' KOFI_URL, opened in a new tab).
 *
 *   ITCH.IO — the game's own page, which stands at launch.
 *   Until game/links' DONATE_URL carries its address, this
 *   door renders capped and says so plainly — the honesty
 *   the old button tooltip used to carry, moved to where it
 *   belongs. The day the URL lands, the door lights with no
 *   edit here.
 *
 * House modal pattern, lessons applied: pointer-events-auto
 * declared on its own overlay (seats live inside click-
 * transparent roots), its own Escape listener, backdrop and
 * X both close.
 */
import React, { useEffect } from 'react';
import { Heart, X, Coffee, Gamepad2 } from 'lucide-react';
import { DONATE_URL, KOFI_URL } from '../game/links';

interface DonateModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DonateModal: React.FC<DonateModalProps> = ({ isOpen, onClose }) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const itchUrl = DONATE_URL;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="glass-panel-biolum w-full max-w-sm rounded-3xl overflow-hidden border border-rose-500/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-800 bg-slate-900/60">
          <div className="w-10 h-10 rounded-2xl bg-rose-950/70 border border-rose-500/40 flex items-center justify-center text-rose-300">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-tech font-bold text-white tracking-wide">SUPPORT BIOFORGE</h2>
            <p className="text-xs text-slate-400">Everything is free — support keeps it growing.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close support"
            className="ml-auto p-2 rounded-xl text-slate-400 border border-slate-700/60 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {/* Door one: Ko-fi, live today. */}
          <button
            onClick={() => window.open(KOFI_URL, '_blank', 'noopener')}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-rose-500/50 bg-rose-950/40 hover:bg-rose-900/50 transition-colors cursor-pointer text-left"
          >
            <Coffee className="w-5 h-5 text-rose-300 shrink-0" />
            <span className="flex flex-col">
              <span className="text-sm font-tech font-bold text-rose-100">KO-FI</span>
              <span className="text-xs text-slate-400">Tip the maker — one coffee keeps the world growing.</span>
            </span>
          </button>

          {/* Door two: itch.io — capped until the page stands. */}
          {itchUrl ? (
            <button
              onClick={() => window.open(itchUrl, '_blank', 'noopener')}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-cyan-500/50 bg-cyan-950/40 hover:bg-cyan-900/50 transition-colors cursor-pointer text-left"
            >
              <Gamepad2 className="w-5 h-5 text-cyan-300 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm font-tech font-bold text-cyan-100">ITCH.IO</span>
                <span className="text-xs text-slate-400">The game&apos;s own page — downloads, devlogs, and its jar.</span>
              </span>
            </button>
          ) : (
            <div
              className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl border border-slate-700/60 bg-slate-900/50 opacity-80"
              title="The game's itch.io page stands at launch — this door lights when it does."
            >
              <Gamepad2 className="w-5 h-5 text-slate-500 shrink-0" />
              <span className="flex flex-col">
                <span className="text-sm font-tech font-bold text-slate-400">ITCH.IO</span>
                <span className="text-xs text-slate-500">The game&apos;s page stands at launch — this door lights when it does.</span>
              </span>
            </div>
          )}

          <p className="pt-1 text-center text-[11px] text-slate-500">
            Either door, or neither — the world stays free.
          </p>
        </div>
      </div>
    </div>
  );
};
