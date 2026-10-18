/**
 * CreditsModal — BioForge's credits (Adam, 2026-10-18).
 *
 * Adam's own call ("I forgot that I'll need a credits
 * modal"): the wrap-week screen that names everyone and
 * everything the game stands on — designed to match itch's
 * AI-disclosure tagging at publish, so the assistance line
 * is plain and unhidden. Placement: the start screen's
 * header, beside About (the main menu seat Adam specified,
 * beside Support/donate when that door joins the menu).
 *
 * Pure props — no hooks at all, so nothing can violate the
 * hooks-above-the-early-return lesson; it renders null
 * while closed.
 */
import React from 'react';
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
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="glass-panel-biolum w-full max-w-md rounded-3xl overflow-hidden border border-cyan-500/30 shadow-2xl">
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
            Adam
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
          <Block heading="Model Pipeline">
            Meshy → Mixamo — with thanks to Alex
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
