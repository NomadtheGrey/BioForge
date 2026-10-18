/**
 * ScarChoiceModal — the Departure, Confront (D5, 2026-10-18).
 *
 * The motive choice at the scar: revenge or curiosity. It
 * latches ONCE, ever, per world (QuestSignals.finaleMotive),
 * so this modal exists to make that single choice a real
 * moment — two doors, plainly worded, and a way to step
 * back without choosing. Pure props, no hooks below any
 * early return (the ChapterModal lesson): the component
 * reads isOpen and renders null when closed, with all hooks
 * (none) above the return.
 */
import React from 'react';

export type ScarMotive = 'revenge' | 'curiosity';

interface ScarChoiceModalProps {
  isOpen: boolean;
  onChoose: (motive: ScarMotive) => void;
  onClose: () => void;
}

export const ScarChoiceModal: React.FC<ScarChoiceModalProps> = ({ isOpen, onChoose, onClose }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-lg rounded-2xl border border-red-900/60 bg-[#171114] p-6 shadow-2xl">
        <div className="text-[11px] font-semibold uppercase tracking-[0.25em] text-red-400/80">The Scar</div>
        <h2 className="mt-2 text-xl font-bold text-red-100">How do you step through?</h2>
        <p className="mt-3 text-sm leading-relaxed text-stone-300">
          The tear leads where they went — the ones who did this. The road is the same either way.
          What you carry through it is not. Choose once; the scar will remember.
        </p>
        <div className="mt-5 grid gap-3">
          <button
            onClick={() => onChoose('revenge')}
            className="rounded-xl border border-red-800/70 bg-red-950/40 px-4 py-3 text-left transition hover:bg-red-950/70"
          >
            <div className="font-semibold text-red-200">Revenge</div>
            <div className="mt-1 text-sm text-stone-400">
              Step through after them as you are. No recipe, no growing — the departure is a pursuit.
            </div>
          </button>
          <button
            onClick={() => onChoose('curiosity')}
            className="rounded-xl border border-violet-800/70 bg-violet-950/30 px-4 py-3 text-left transition hover:bg-violet-950/60"
          >
            <div className="font-semibold text-violet-200">Curiosity</div>
            <div className="mt-1 text-sm text-stone-400">
              Read the tear — the one reading the world has never allowed — and grow a way of your own,
              warded with passage protections.
            </div>
          </button>
          <button
            onClick={onClose}
            className="mt-1 rounded-xl border border-stone-700/60 px-4 py-2 text-sm text-stone-400 transition hover:bg-stone-800/50"
          >
            Not yet
          </button>
        </div>
      </div>
    </div>
  );
};
