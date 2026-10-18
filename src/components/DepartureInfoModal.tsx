/**
 * DepartureInfoModal — the road out, explained (Adam's ask,
 * 2026-10-18: the Departure gets the Game Info treatment).
 *
 * WORDS: the body copy is the background lane's text of record
 * (2026-10-18), placed verbatim. Fate-line discipline holds
 * throughout — roads are described by their SHAPE, never by a
 * world's fate; the only text in the game that names a fate is
 * the assembled chapter itself. The road names and todo lines
 * are data (FINALE_ROADS in game/quests/finale.ts).
 *
 * SEAL AWARENESS: the modal mirrors the game's knowing-first
 * doctrine. Sealed (the chapter unread), it shows the general
 * road and a sealed slot where the world's own road will go;
 * unsealed, the slot opens onto the player's family road. In
 * GENERAL mode (the Game Info screen's door — reachable before
 * a world exists) there is no road slot at all, only the
 * teaser the About screen carries.
 *
 * HONESTY NOTE (background lane, at the words' delivery): the
 * Follow text describes shipped behavior (D2). The Answer,
 * Honor, and Confront texts describe their roads as designed
 * in THE_DEPARTURE.md — set-pieces D3–D5, queued behind Adam's
 * pacing. The finale quest itself already names those roads on
 * its tracker today; this modal elaborates the same promise.
 */

import React, { useEffect } from 'react';
import { DoorOpen, X } from 'lucide-react';
import { FINALE_ROADS, type FinaleFamilyId } from '../game/quests/finale';

interface DepartureInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** The player's world road, when a world is in play. */
  finaleFamily?: FinaleFamilyId | null;
  /** True while the chapter stands unread (the seal). */
  sealed?: boolean;
  /** Render the road slot (quest-log door). The Game Info
   *  door passes false — no world, no road to name yet. */
  showRoad?: boolean;
}

// The general road — seal-safe, verbatim (background lane).
const GENERAL: string[] = [
  'This world had people once, and their story has an ending with a door in it. Every road they could take, they took — and the way out they made still stands, in the shape they left it.',
  'The Departure is that door. It does not open for the strong or the fast. It opens for the one who knows: gather the five fragments the grand ruins keep, read the world’s story whole — and only then does the road become yours.',
  'What you do at the door is your answer. Go through, and see what a road between worlds is for. Or stay, and let it stand — a kept promise in the deep country. Both are endings. The road itself is the reward.',
];

// The sealed slot: what a player reads where their road goes.
const SEALED_LINE =
  'Your world’s road is written here — once you know whose it was. Five fragments are still out there, kept in the hearts of grand ruins, waiting to tell you.';

// The four roads — verbatim (background lane), each riding
// under its FINALE_ROADS name in the render.
const FAMILY_TEXT: Record<FinaleFamilyId, string> = {
  follow:
    'Their stations still stand in the grand ruins — great rings in the grand halls, broken kindly by the years. Mend one: re-heart it with prismatic cores, re-aim it with lodestone, rebind what time ate with living thread. Any ring, any order. When it stands whole — and you know whose road it was — step through.',
  answer:
    'They never left — they became. Go to them: the living valleys, the bright water. The visit is short, and meant to be; the goodbye is the meeting. Then they give the going what they need: the way to grow a tunnel that doesn’t stop — down, and through, and out.',
  honor:
    'Nobody is left to meet, and no road stands waiting — so you grow your own. First the memorial: build the remembering. Then plant the stalk where the memorial stands, tend it over days while it climbs past the weather, and climb it yourself, into the sky they emptied.',
  confront:
    'What ended them came from outside, and it left a scar — damage in the deep rooms that no grown thing made. Find it. Read it. Then choose how you step through: as revenge, or as curiosity. The road knows the difference, even if the shape is the same.',
};

// The Game Info screen's teaser — pre-world safe, verbatim.
export const DEPARTURE_TEASER =
  'And every world is hiding one more thing: a way out. The people who grew all this left by a road of their own making, and their road still stands. Learn their story — the whole of it — and the Departure becomes yours to take, or to leave standing. No ending is the wrong one.';

export const DepartureInfoModal: React.FC<DepartureInfoModalProps> = ({
  isOpen,
  onClose,
  finaleFamily,
  sealed,
  showRoad,
}) => {
  // Esc closes, as on the Game Info screen it patterns after.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const road = finaleFamily ? FINALE_ROADS[finaleFamily] : undefined;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-2xl max-h-[88dvh] rounded-3xl flex flex-col overflow-hidden border border-violet-400/40 shadow-2xl">
        {/* Header: the door, and the choice it names. */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-violet-950/70 border border-violet-400/40 flex items-center justify-center text-violet-300">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">THE DEPARTURE</h2>
              <p className="text-xs text-violet-300/90 italic">
                The road out — and the choice to take it, or let it stand.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            title="Close"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* The general road — safe at any seal state. */}
          <div className="space-y-3">
            {GENERAL.map((para, i) => (
              <p key={i} className="text-sm text-slate-300 leading-relaxed">
                {para}
              </p>
            ))}
          </div>

          {/* Your road — the seal-aware slot. Sealed, it holds
              the sealed line; unsealed, the family's own words
              under the road's data name and todo. */}
          {showRoad && (
            <div className="rounded-2xl border border-violet-400/30 bg-violet-950/15 px-4 py-3.5">
              <div className="text-[10px] font-tech font-bold tracking-widest text-violet-300 mb-1.5">
                YOUR ROAD
              </div>
              {sealed || !road || !finaleFamily ? (
                <p className="text-sm text-slate-300 leading-relaxed">{SEALED_LINE}</p>
              ) : (
                <>
                  <div className="text-sm font-bold text-slate-100">{road.name}</div>
                  <div className="text-[11px] italic text-violet-200/80 leading-snug mb-2">
                    {road.todo}
                  </div>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {FAMILY_TEXT[finaleFamily]}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* The reward, in the quest's own words. */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 shrink-0">
          <p className="text-[11px] text-slate-400 leading-snug">
            <span className="text-slate-300 font-semibold">Reward:</span> The road itself.
          </p>
        </div>
      </div>
    </div>
  );
};
