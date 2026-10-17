/**
 * The Chapter Modal (Ask the World, Adam, 2026-10-16): when the
 * fragment set completes, the world's story is read whole — once,
 * here, in a panel that treats the moment with the weight the
 * thread spent earning it. The chapter names the fate outright:
 * the one earned exception to "the fate is never shown."
 *
 * Deliberately unadorned: an amber-ruled panel, the fate's name,
 * the story. App opens it at the latch; the close button is the
 * only control. (Re-reading from the quest log's line tab is the
 * HUD lane's follow-on; the data lives in game/quests/awChapters.ts.)
 */

import React from 'react';
import { X } from 'lucide-react';
import type { AwChapter } from '../game/quests/awChapters';

interface ChapterModalProps {
  chapter: AwChapter;
  onClose: () => void;
}

export const ChapterModal: React.FC<ChapterModalProps> = ({ chapter, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-xl rounded-xl border border-amber-500/40 bg-stone-950/95 p-6 shadow-2xl">
        <div className="mb-1 flex items-start justify-between gap-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-amber-400/80">
            What Happened Here
          </p>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 transition hover:bg-stone-800 hover:text-stone-100"
            aria-label="Close the chapter"
          >
            <X size={16} />
          </button>
        </div>
        <h2 className="mb-4 text-2xl font-bold text-amber-200">{chapter.name}</h2>
        <p className="max-h-[55vh] overflow-y-auto pr-1 text-[15px] leading-relaxed text-stone-200">
          {chapter.body}
        </p>
        <p className="mt-5 border-t border-amber-500/20 pt-3 text-xs italic text-stone-400">
          Five fragments, five houses — the set is complete, and the chapter is yours. It is
          kept with the world that grew it; another seed would tell another ending.
        </p>
      </div>
    </div>
  );
};

export default ChapterModal;
