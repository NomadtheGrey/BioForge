/**
 * CreditsModal — BioForge's credits (Adam, 2026-10-18).
 *
 * Adam's own call ("I forgot that I'll need a credits
 * modal"): the wrap-week screen that names everyone and
 * everything the game stands on — designed to match itch's
 * AI-disclosure tagging at publish, so the assistance line
 * is plain and unhidden. Seats: the start screen's header,
 * Game Info's Who Grew This, and the pause popup's standing
 * row — wherever a player browses, the roll is one click off.
 *
 * THE CLOSE THAT WOULDN'T (Adam's live report, same day:
 * "the Credits screen refuses to close on ESC and clicking
 * the X"): two plain causes. (1) This modal owns NO Escape
 * handler — it was born "pure props, no hooks," and nothing
 * else in the game closes it for it. It listens now, while
 * open. (2) One of its seats (the pause popup) lives inside
 * the HUD's root, which is pointer-events-none by design —
 * clicks fell THROUGH the modal there, X included. The
 * overlay now declares pointer-events-auto itself, so the
 * modal is clickable in every seat it will ever occupy.
 * The backdrop closes it too, the house pattern.
 *
 * CONTENT (Adam's corrections, same day): he is credited as
 * Adam Bailey, a.k.a. Nomad the Grey; and there is NO model
 * pipeline line — the game uses no Meshy models yet, so
 * Meshy, Mixamo, and Alex are not a thing here until models
 * actually land. When they do, the line returns, earned.
 */
import React, { useEffect } from 'react';
import { Sprout, X } from 'lucide-react';

interface CreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** One credits block: a small-caps heading and its lines. */
const Block: React.FC<{ heading: string; children: React.ReactNode }> = ({ heading, children }) => (
  <div>
    <h3 className="text-[11px] font-tech text-cyan-300/80 uppercase tracking-[0.2em]">{heading}</h3>
    <div className="mt-1.5 text-sm leading-relaxed text-slate-200">{children}</div>
  </div>
);

export const CreditsModal: React.FC<CreditsModalProps> = ({ isOpen, onClose }) => {
  // Escape closes the roll while it's open (the fix above).
  // Capture phase, so the modal's word stands even where a
  // host screen keeps its own Escape habits.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="glass-panel-biolum w-full max-w-md rounded-3xl overflow-hidden border border-cyan-500/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-800 bg-slate-900/60">
          <div className="w-10 h-10 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-tech font-bold text-white tracking-wide">CREDITS</h2>
            <p className="text-xs text-slate-400">Who and what BioForge stands on</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close credits"
            className="ml-auto p-2 rounded-xl text-slate-400 border border-slate-700/60 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6 space-y-5">
          <Block heading="Design & Development">
            Adam Bailey <span className="text-slate-400">— a.k.a. Nomad the Grey</span>
          </Block>
          <Block heading="AI Assistance">
            Marlowe · Google AI Studio
            <p className="mt-1 text-xs text-slate-400">
              BioForge was designed by a person and built with AI help, openly — design,
              writing, and code reviewed and directed by its developer.
            </p>
          </Block>
          <Block heading="Built With">
            Vite · React · Three.js · Cloudflare Workers
          </Block>
          <Block heading="Playtesters">
            Clarissa — first through the door, and the first to break it honestly
            <p className="mt-1 text-xs text-slate-400">
              …and every friend and family member who has walked a world and said what they found.
            </p>
          </Block>
          <p className="pt-1 text-center text-xs text-slate-500">
            Thank you for playing in a grown world.
          </p>
        </div>
      </div>
    </div>
  );
};
