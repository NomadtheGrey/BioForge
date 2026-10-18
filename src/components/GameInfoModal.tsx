/**
 * GameInfoModal — the ABOUT screen (Adam's work order,
 * 2026-10-17): what BioForge is, and who you are in it.
 *
 * COPY DISCIPLINE (background lane's ruling, 2026-10-17):
 * the Primer (bioforge-primer.md) is a MASTER DRAFT — this
 * screen CUTS from it, never pastes wholesale. The lead is
 * cut from Version B's first paragraph (the primer §5
 * start-screen About is exactly that cut); the pillars are
 * §2, written to be quoted; the gear tiles and closing
 * lines compress §1. VERSION A (§3) IS DELIBERATELY NOT
 * USED — it is the new-game opening dialog, a different
 * moment, and lifting it here would spend its first-run
 * weight. The one-liner is §5's settled word-of-mouth
 * line, verbatim. UI text never names a world's fate
 * (Adam's hard ruling) — the mystery is what happened to
 * the Precursors, never the answer.
 *
 * Two doors, one screen: the start surface (a new player
 * before spawn) and the pause overlay (re-readable any time
 * — the primer's §5 argues the opening shouldn't be
 * one-and-gone).
 */

import React from 'react';
import { X, Sprout, Hand, HardHat, Footprints, Shield, DoorOpen } from 'lucide-react';
import { DepartureInfoModal, DEPARTURE_TEASER } from './DepartureInfoModal';
import { CreditsModal } from './CreditsModal';
import { DonateButton } from './DonateButton';

interface GameInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// The lead — CUT from Version B's first paragraph (the
// primer §5 start-screen About), trimmed to info-screen
// length: what the game is, in three short beats.
const LEAD: string[] = [
  'In BioForge, nothing is built. Everything is grown. At your homestead stands the Bio-Forge, which grows what you need — tools, weapons, walls, and in time even creatures — from what the world offers.',
  'The creatures are individuals, not resources. They court, negotiate, hoard, and decide — one dog will take thirty days to decide if you are worth trusting — and death is permanent, unless you saved a sample for the Culture Vat, where the lost can be regrown and raised as companions.',
  'Your world is generated fresh from its seed: meadows, rootwoods, ember fields and saltglass flats, five strata of caves below, the grown ruins of a fallen civilization above — and over it all a ten-minute sky, a ringed giant and three moons by night.',
];

// The Primer §2 — the five pillars, each with its line.
const PILLARS: { title: string; line: string }[] = [
  {
    title: 'Grown, not built',
    line: 'The forge grows; nothing is manufactured, and there are no machines — even the Precursors’ ancient works turn out to be grown husks.',
  },
  {
    title: 'Creatures are individuals',
    line: 'They court, negotiate, hoard, decide, and die permanently. You are a neighbor before you are a hunter.',
  },
  {
    title: 'The world keeps its own time',
    line: 'Days turn, harvest windows open and close, fruit ripens at kept hearths — with or without a witness.',
  },
  {
    title: 'Knowledge is gear',
    line: 'The helmet’s whole track is knowing: wayfinding, creature sight, zone names, darksight. Information is earned and worn, not given.',
  },
  {
    title: 'Home is an organism',
    line: 'The homestead is grown, not placed furniture — walls of root, a hearth with a heartbeat, tunnels that are one animal with two mouths.',
  },
];

// The living gear (Primer §1) — the three platforms, plus
// the Left Hand, whose shield is in the game by the time
// this screen ships.
const GEAR: { icon: React.ReactNode; name: string; verb: string; line: string }[] = [
  {
    icon: <Hand className="w-5 h-5" />,
    name: 'The Gauntlet',
    verb: 'DOES',
    line: 'Harvests, plants, builds — and in time learns to synthesize in the field. Its seventh slot draws your grown strikers.',
  },
  {
    icon: <HardHat className="w-5 h-5" />,
    name: 'The Helmet',
    verb: 'KNOWS',
    line: 'Radar, lenses, and visors turn information into a kind of sight.',
  },
  {
    icon: <Footprints className="w-5 h-5" />,
    name: 'The Quicksteps',
    verb: 'GO',
    line: 'One grown set under everything you do: waders for the marsh, soles that walk on lava.',
  },
  {
    icon: <Shield className="w-5 h-5" />,
    name: 'The Left Hand',
    verb: 'HOLDS',
    line: 'The lantern’s light — or a grown shield: worn, it blunts what strikes its face; raised, it is a wall. Ctrl + wheel cycles the hand.',
  },
];

export const GameInfoModal: React.FC<GameInfoModalProps> = ({ isOpen, onClose }) => {
  // Esc closes it from either door (the screen is App-state,
  // not the activeModal union, so it carries its own listener
  // — the same pattern the HUD Options panel uses).
  const [departureOpen, setDepartureOpen] = React.useState(false);
  const [creditsOpen, setCreditsOpen] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-3xl max-h-[88dvh] rounded-3xl flex flex-col overflow-hidden border border-emerald-500/30 shadow-2xl">
        {/* Header: the name, and the one line that explains it. */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">BIOFORGE</h2>
              <p className="text-xs text-emerald-300/90 italic">
                A first-person world where you don’t build anything — you grow it, and the creatures are people.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-5 space-y-7">
          {/* The lead: the primer §5 About cut. */}
          <div className="space-y-3">
            {LEAD.map((para, i) => (
              <p
                key={i}
                className={`leading-relaxed ${
                  i === 0 ? 'text-[15px] text-slate-100' : 'text-sm text-slate-300'
                }`}
              >
                {para}
              </p>
            ))}
          </div>

          {/* The five pillars (Primer §2). */}
          <div>
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-emerald-300/90 mb-3">
              How This World Works
            </h3>
            <div className="space-y-2">
              {PILLARS.map((p, i) => (
                <div
                  key={p.title}
                  className="flex gap-3.5 bg-slate-800/30 border border-slate-800 rounded-2xl px-4 py-3"
                >
                  <span className="font-tech font-bold text-emerald-400/80 text-sm shrink-0 w-5 text-right">
                    {i + 1}
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-100">{p.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed mt-0.5">{p.line}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The living gear (Primer §1). */}
          <div>
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-emerald-300/90 mb-3">
              Your Living Gear
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {GEAR.map((g) => (
                <div
                  key={g.name}
                  className="bg-slate-800/30 border border-slate-800 rounded-2xl px-4 py-3"
                >
                  <div className="flex items-center gap-2.5 text-emerald-300">
                    {g.icon}
                    <h4 className="text-sm font-semibold text-slate-100">{g.name}</h4>
                    <span className="text-[9px] font-tech font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                      {g.verb}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed mt-1.5">{g.line}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The honest answers (Primer §1 + §6): who joins you,
              and what hangs over every world. The fate itself is
              never named here — or anywhere in the UI (Adam's
              ruling); the mystery is the sentence, not the answer. */}
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl px-4 py-3.5 space-y-2">
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-slate-100">It is also a game for family.</strong>{' '}
              Another player can join your world from their own device and grow alongside
              you — the host’s world is the real one, and everything in it is shared:
              the same sky, the same creatures, the same dog deciding.
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-slate-100">What hangs over it all?</strong>{' '}
              The Precursors grew a civilization across these lands, and it ended.
              What happened to them is written in your world’s seed — and the ruins,
              the wild country, and the strata below are how it answers. Day to day,
              what you are working toward is simpler: a bigger, stranger, more
              beloved homestead, and a world you know by heart.
            </p>
          </div>

          {/* The Departure (Adam, 2026-10-18): the About screen
              carries the road's teaser — the background lane's
              pre-world-safe words — and a door into its modal.
              General mode there: this screen also stands before
              any world exists, so no road is named here. */}
          <div className="bg-violet-950/25 border border-violet-400/30 rounded-2xl px-4 py-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-violet-300">
              <DoorOpen className="w-4 h-4" />
              <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-slate-100">
                The Departure
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">{DEPARTURE_TEASER}</p>
            <button
              onClick={() => setDepartureOpen(true)}
              className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-violet-400/50 bg-violet-500/15 text-violet-200 hover:bg-violet-500/25 transition-colors"
            >
              THE ROAD OUT
            </button>
          </div>

          {/* Credits & Support (Adam's seating call to the
              HUD lane, 2026-10-18): the Game Info screen is
              the in-game door to the same pair the start
              header carries — a returning player shouldn't
              have to quit to the menu to find either. The
              Donation button rides capped until the itch
              page stands (DonateButton carries the rule). */}
          <div className="bg-slate-800/30 border border-slate-800 rounded-2xl px-4 py-3.5 space-y-2.5">
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-slate-100">
              Who Grew This
            </h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              BioForge was designed and developed by Adam, grown with AI assistance —
              the whole story, the tools, and the playtesters stand in the credits.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCreditsOpen(true)}
                className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-cyan-500/50 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 transition-colors"
              >
                CREDITS
              </button>
              {/* The Donation door beside Credits (Adam,
                  2026-10-18) — capped until the itch page
                  stands; DonateButton carries the rule. */}
              <DonateButton variant="section" />
            </div>
          </div>

          <p className="text-center text-[11px] font-tech tracking-[0.25em] text-slate-500 pb-1">
            GROW · TAME · EXPLORE · BELONG
          </p>
        </div>
      </div>
      <DepartureInfoModal
        isOpen={departureOpen}
        onClose={() => setDepartureOpen(false)}
        showRoad={false}
      />
      <CreditsModal isOpen={creditsOpen} onClose={() => setCreditsOpen(false)} />
    </div>
  );
};
