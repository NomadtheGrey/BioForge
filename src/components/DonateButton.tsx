/**
 * DonateButton — the support door, seated beside CREDITS
 * wherever the credits live (Adam, 2026-10-18).
 *
 * One component, four seats — the start-screen header, Game
 * Info's Who Grew This, the pause popup, and the Session
 * bar — so the door looks the same everywhere and behaves
 * the same: it OPENS the DonateModal (the two doors, Ko-fi
 * live and itch.io capped until launch; Adam's build order
 * replaced the earlier link-or-capped button wholesale).
 *
 * The component owns its modal state, so a seat needs no
 * wiring beyond dropping the button in — the modal renders
 * from here, in whichever root the seat lives.
 */
import React, { useState } from 'react';
import { Heart } from 'lucide-react';
import { DonateModal } from './DonateModal';

export type DonateButtonVariant = 'header' | 'section' | 'popup' | 'session';

const CLASSES: Record<DonateButtonVariant, string> = {
  // Start-screen header pill.
  header:
    'px-4 py-2 rounded-2xl text-[11px] font-tech font-bold text-rose-200 border border-rose-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5',
  // Game Info's small section button (beside its CREDITS).
  section:
    'text-[11px] font-bold px-3 py-1.5 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5',
  // The pause popup's standing-row pill (beside RESUME kin).
  popup:
    'px-5 py-2 rounded-2xl text-xs font-tech font-bold text-rose-200 border border-rose-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5',
  // The session bar's ghost button (labels hide on small
  // screens, like every other button in that bar).
  session:
    'p-2 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-950/50 transition-colors cursor-pointer flex items-center gap-1.5',
};

export const DonateButton: React.FC<{ variant: DonateButtonVariant }> = ({ variant }) => {
  const [open, setOpen] = useState(false);
  // The session bar speaks in its own casing and hides labels
  // on small screens, like every other button in that bar.
  const inner =
    variant === 'session' ? (
      <>
        <Heart className="w-4 h-4" />
        <span className="text-[11px] font-mono font-medium hidden md:inline">Donate</span>
      </>
    ) : (
      <>
        <Heart className="w-3.5 h-3.5" /> DONATE
      </>
    );
  return (
    <>
      <button onClick={() => setOpen(true)} title="Support BioForge" className={CLASSES[variant]}>
        {inner}
      </button>
      {open && <DonateModal isOpen={open} onClose={() => setOpen(false)} />}
    </>
  );
};
