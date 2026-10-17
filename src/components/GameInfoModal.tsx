/**
 * GameInfoModal — the ABOUT screen (Adam's work order,
 * 2026-10-17): what BioForge is, and who you are in it.
 *
 * COPY DISCIPLINE: every line derives from the Primer
 * (ReadMe-adjacent design doc, bioforge-primer.md) — the
 * game's master explanation. The lead is its §3 opening
 * text, the five sections are its §2 pillars, the gear tiles
 * and closing lines compress its §1. Nothing here invents a
 * claim the game doesn't keep; if the primer changes, this
 * screen follows it.
 *
 * Two doors, one screen: the start surface (a new player
 * before spawn) and the pause overlay (re-readable any time
 * — the primer's §5 argues the opening shouldn't be
 * one-and-gone).
 */

import React from 'react';
import { X, Sprout, Hand, HardHat, Footprints, Shield } from 'lucide-react';

interface GameInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// The Primer §3 — the opening text, in the world's own
// voice, kept whole so the screen and the first spawn
// speak the same words.
const OPENING: string[] = [
  'You wake in the meadow with the smell of rain coming, and a gauntlet grown around your hand like it always belonged there.',
  'This is a living world, and it does things the living way. Nothing here is built — it is grown. The forge at your homestead will grow your tools, your walls, your weapons, and in time, your companions. Feed it what the world offers and it will feed you back.',
  'The creatures are not here for you. They have their own hungers, their own hours, their own opinions — and if one dies, it is gone for good, unless you kept a piece of it safe for the vat. Be a neighbor first. The world notices.',
  'Grow your gauntlet to do, your helmet to know, your Quicksteps to go. Walk far enough and the land changes its mind about what it is. Dig deep enough and you will find what the Precursors left growing in the dark.',
  'Start small. Grow the lantern. The rest will call to you.',
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
    line: 'The lantern’s light — or a grown shield: carried, it blunts what strikes its face; raised, it is a wall. Alt + wheel cycles the hand.',
  },
];

export const GameInfoModal: React.FC<GameInfoModalProps> = ({ isOpen, onClose }) => {
  // Esc closes it from either door (the screen is App-state,
  // not the activeModal union, so it carries its own listener
  // — the same pattern the HUD Options panel uses).
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
      <div className="glass-panel-biolum w-full max-w-3xl max-h-[88vh] rounded-3xl flex flex-col overflow-hidden border border-emerald-500/30 shadow-2xl">
        {/* Header: the name, and the one line that explains it. */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Sprout className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">BIOFORGE</h2>
              <p className="text-xs text-emerald-300/90 italic">
                You are a grower in a world that grows back.
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
          {/* The opening, re-readable (Primer §3). */}
          <div className="space-y-3">
            {OPENING.map((para, i) => (
              <p
                key={i}
                className={`leading-relaxed ${
                  i === 0 ? 'text-[15px] text-slate-100' : 'text-sm text-slate-300'
                } ${i === OPENING.length - 1 ? 'text-emerald-200 font-medium' : ''}`}
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
              and what you're working toward. */}
          <div className="bg-emerald-950/30 border border-emerald-800/40 rounded-2xl px-4 py-3.5 space-y-2">
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-slate-100">It is also a game for family.</strong>{' '}
              Another player can join your world from their own device and grow alongside
              you — the same sky, the same creatures, the same dog deciding.
            </p>
            <p className="text-xs text-slate-300 leading-relaxed">
              <strong className="text-slate-100">What are you working toward?</strong>{' '}
              No plot waits at the end of the quests, and there is no win state. What
              remains is a bigger, stranger, more beloved homestead — and a world you
              know by heart.
            </p>
          </div>

          <p className="text-center text-[11px] font-tech tracking-[0.25em] text-slate-500 pb-1">
            GROW · TAME · EXPLORE · BELONG
          </p>
        </div>
      </div>
    </div>
  );
};
