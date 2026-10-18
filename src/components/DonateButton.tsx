/**
 * DonateButton — the donation door, seated beside CREDITS
 * wherever the credits live (Adam, 2026-10-18: 'put a
 * Donation button next to the Credits button wherever it
 * lies. It won't wire to anything yet, but it can read
 * whatever is clever').
 *
 * One component, three seats — the start-screen header, Game
 * Info's Who Grew This, and the pause popup — so the door
 * looks and behaves the same everywhere. It ALWAYS renders:
 * Adam's call supersedes the older rule that the support seat
 * stayed dark until launch. Until game/links' DONATE_URL
 * stands set (the itch page, at wrap), the button is a capped
 * jar: present, labeled, and honest about being capped — its
 * tooltip carries the word. The day the URL lands, this same
 * button opens it, everywhere at once, with no seat edits.
 */
import React from 'react';
import { Heart } from 'lucide-react';
import { DONATE_URL } from '../game/links';

export type DonateButtonVariant = 'header' | 'section' | 'popup' | 'session';

const CLASSES: Record<DonateButtonVariant, string> = {
  // Start-screen header pill (the old SUPPORT seat's dress).
  header:
    'px-4 py-2 rounded-2xl text-[11px] font-tech font-bold text-rose-200 border border-rose-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5',
  // Game Info's small section button (beside its CREDITS).
  section:
    'text-[11px] font-bold px-3 py-1.5 rounded-xl border border-rose-500/50 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20 transition-colors cursor-pointer flex items-center gap-1.5',
  // The pause popup's standing-row pill (beside RESUME kin).
  popup:
    'px-5 py-2 rounded-2xl text-xs font-tech font-bold text-rose-200 border border-rose-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5',
  // The session bar's ghost button (Adam, 2026-10-18: the
  // doors belong on the always-visible Session UI, next to
  // Ping — not only behind an alt-tab).
  session:
    'p-2 rounded-xl text-rose-300 hover:text-rose-200 hover:bg-rose-950/50 transition-colors cursor-pointer flex items-center gap-1.5',
};

const CAPPED_WORD =
  'The jar is still capped — it opens when the game\u2019s page stands at launch. Reaching for it counts.';

export const DonateButton: React.FC<{ variant: DonateButtonVariant }> = ({ variant }) => {
  const url = DONATE_URL;
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
  if (url) {
    return (
      <button onClick={() => window.open(url, '_blank', 'noopener')} className={CLASSES[variant]}>
        {inner}
      </button>
    );
  }
  return (
    <button
      type="button"
      title={CAPPED_WORD}
      aria-label={`Donate — ${CAPPED_WORD}`}
      className={`${CLASSES[variant]} opacity-90`}
    >
      {inner}
    </button>
  );
};
