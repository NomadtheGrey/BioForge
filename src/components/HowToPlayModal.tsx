/**
 * HowToPlayModal — HOW TO PLAY (Adam's program, 2026-10-17;
 * design: ReadMeFiles/HOW_TO_PLAY_AND_TUTORIAL.md).
 *
 * The boundary (HUD lane's refinement, ratified): the Game
 * Info screen is WHAT THE WORLD IS; this modal is HOW TO
 * PLAY — the verbs, the controls, the first-hour grammar,
 * and the door into the interactive tutorial. One small
 * "About this world" link crosses to Game Info; no copy is
 * shared between the two screens.
 *
 * The words are the design doc's §2 (background lane's text
 * of record), with two FACT corrections from the game's own
 * tool table (HUD.tsx's tools array, the numbering every
 * surface agrees on): the Solvent Sprayer is [4] and the
 * Taming Lure is [5] — the draft had the solvent at [5] and
 * the lure missing. The death sentence likewise states the
 * SHIPPED rule (wake at spawn, pouch untouched — there is
 * no drop mechanic), where the draft described drops.
 *
 * The tutorial itself is Slice B: the background lane's
 * useTutorial engine. This shell takes onShowTutorial as an
 * OPTIONAL prop and renders the primary button only when
 * the engine is wired in, so the modal never grows a dead
 * button in the meantime.
 */

import React, { useEffect, useState } from 'react';
import { X, BookOpen, ScrollText, Play, Sprout } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Footer door: close this modal and open the Quest Log. */
  onOpenQuests?: () => void;
  /** The boundary link: close this modal and open Game Info. */
  onOpenAbout?: () => void;
  /** Slice B: starts the interactive tutorial. Rendered only
   *  when the engine is wired in. */
  onShowTutorial?: () => void;
}

// A section of the lesson: a plain heading and short lines.
// The readability bar (Adam): a 12-year-old following this
// page should never meet an unexplained word.
const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section>
    <h3 className="text-[11px] font-tech font-bold uppercase tracking-widest text-emerald-300 mb-1.5">
      {title}
    </h3>
    <div className="text-[13px] leading-relaxed text-slate-300 space-y-1.5">{children}</div>
  </section>
);

// One tool row: the key, the name, what it does in one breath.
const Tool: React.FC<{ k: string; name: string; children: React.ReactNode }> = ({ k, name, children }) => (
  <p>
    <span className="inline-block min-w-[1.6rem] text-center font-tech font-bold text-cyan-300 bg-slate-800/80 border border-slate-700/70 rounded-md px-1 mr-1.5">
      {k}
    </span>
    <span className="font-semibold text-slate-100">{name}</span>
    <span className="text-slate-400"> — {children}</span>
  </p>
);

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({
  isOpen,
  onClose,
  onOpenQuests,
  onOpenAbout,
  onShowTutorial,
}) => {
  // FULL AND QUICK (Adam, 2026-10-17 — he refused the
  // either/or): the modal keeps BOTH cuts of the lesson, on
  // two buttons, available at any time. Full is the doc's §2;
  // Quick is the same facts compressed to one screen. The
  // toggle lives in the header so it never scrolls away.
  const [view, setView] = useState<'full' | 'quick'>('full');

  // Esc closes, like every modal in the game (the modal
  // carries its own listener — the GameInfoModal pattern).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="glass-panel-biolum w-full max-w-2xl max-h-[88vh] rounded-3xl border border-emerald-500/40 shadow-2xl flex flex-col overflow-hidden">
        {/* Head: the title, the boundary link, and the ✕. */}
        <div className="px-5 pt-4 pb-3 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-emerald-300 shrink-0" />
          <h2 className="font-tech font-bold text-lg text-slate-100 tracking-wide">
            How to Play BioForge
          </h2>
          {onOpenAbout && (
            <button
              onClick={onOpenAbout}
              className="ml-auto text-[11px] font-tech font-bold text-emerald-300/90 hover:text-emerald-200 flex items-center gap-1 cursor-pointer"
              title="What this world is — the Game Info screen"
            >
              <Sprout className="w-3.5 h-3.5" /> About this world
            </button>
          )}
          <button
            onClick={onClose}
            className={`${onOpenAbout ? '' : 'ml-auto'} p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 cursor-pointer`}
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* The two cuts, always one tap apart (Adam: long AND
            short, both available at any time). Pinned in the
            header so the switch never scrolls out of reach. */}
        <div className="flex items-center gap-1.5 mt-3">
          {(
            [
              { id: 'full', label: 'FULL GUIDE' },
              { id: 'quick', label: 'QUICK GUIDE' },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-tech font-bold tracking-wider transition-all cursor-pointer ${
                view === v.id
                  ? 'bg-emerald-400 text-emerald-950'
                  : 'text-slate-300 border border-slate-600/70 hover:bg-slate-800/70'
              }`}
            >
              {v.label}
            </button>
          ))}
          <span className="text-[10px] text-slate-500 font-mono ml-1">
            {view === 'full' ? 'the whole game in five minutes' : 'the same game in thirty seconds'}
          </span>
        </div>
        </div>

        {/* The lesson itself — the doc's §2 words, facts
            corrected per the header note. Scrolls as one
            page; a reference, not a dialog. */}
        <div className="px-5 py-4 overflow-y-auto space-y-5">
          {view === 'full' ? (
          <>
          <Section title="Welcome, grower">
            <p>
              Nothing here is built — everything is grown. You are standing in a living world
              with a gauntlet on one hand and a pouch at your belt. This page is the whole game
              in five minutes.
            </p>
          </Section>

          <Section title="The loop, in one breath">
            <p>
              Harvest what grows → carry it home → grow what you need at the Bio-Forge → graft
              it onto your gear → walk further out, where stranger country grows stranger
              things. Every new tool opens a new verb, and every verb opens new country.
            </p>
          </Section>

          <Section title="Your hands">
            <Tool k="1" name="Harvest Glove">gathers ripe plants. Walk up, click.</Tool>
            <Tool k="2" name="Bio-Scanner">
              reads creatures, plants, and ruins into your Codex. Knowledge is gear here.
            </Tool>
            <Tool k="3" name="Planter Trowel">
              grafted, not given (see the Forge). It does two jobs: it plants seeds, and it
              applies fertilizer — the same trowel sows and feeds.
            </Tool>
            <Tool k="4" name="Solvent Sprayer">
              un-grows things gently: plants give back their seed, structures give back their
              kit, whole.
            </Tool>
            <Tool k="5" name="Taming Lure">
              offer a creature a treat, the right way, and it may follow you home. Friends are
              grown, not bought.
            </Tool>
            <Tool k="6" name="Bio-Builder">
              places what the Forge grows: walls, hearths, storage, tunnels.
            </Tool>
            <Tool k="7" name="Striker">
              your grown weapons, if you grow them. Tap 7 again (or the mouse wheel) to swap
              between your close and ranged strikers.
            </Tool>
            <p>
              <span className="font-semibold text-slate-100">Your Left Hand</span>
              <span className="text-slate-400">
                {' '}— holds one instrument: the Hand Lantern-Fern's light, or a grown shield.{' '}
                <span className="text-slate-200 font-medium">Alt + wheel</span> or{' '}
                <span className="text-slate-200 font-medium">Alt + ↑/↓</span> cycles it; tapping
                its tile works too.
              </span>
            </p>
          </Section>

          <Section title="The Bio-Forge [B]">
            <p>
              Your homestead's forge grows everything: tools, modules, furniture, weapons,
              shields, whole structures. Stand near it — or graft the{' '}
              <span className="text-slate-100 font-medium">Field Synthesizer</span> onto your
              gauntlet and craft tier 1–2 recipes anywhere. Recipes that consume what you
              already carry say so; one-time crafts lock once they're yours.
            </p>
          </Section>

          <Section title="Quests — the game teaches in quests">
            <p>
              Press <span className="text-slate-100 font-medium">Q</span> (or the Quests button)
              for the Quest Log. Three kinds live there:
            </p>
            <p>
              <span className="font-semibold text-slate-100">Mini-quests</span>
              <span className="text-slate-400">
                {' '}— the crafting chain. Each one names what to gather and what it grows into:
                a pouch, a scanner, a trowel. Following them IS the tutorial the world gives
                you; the tracker card on your HUD follows the one you've pinned.
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">Ask the World</span>
              <span className="text-slate-400">
                {' '}— questions the land answers as you explore: ruins, glyphs, strange
                meetings. No fetch lists; go and see.
              </span>
            </p>
            <p>
              <span className="font-semibold text-slate-100">The World Asks Back</span>
              <span className="text-slate-400">
                {' '}— in time, the country starts asking things of YOU. Watch the tracker.
              </span>
            </p>
          </Section>

          <Section title="Your platforms">
            <p>
              Everything you wear is a grown platform, and each verb belongs to one: the{' '}
              <span className="text-slate-100 font-medium">Gauntlet</span> DOES (its modules
              and grafts), the <span className="text-slate-100 font-medium">Helmet</span> KNOWS
              (radar, lenses, creature sight), the{' '}
              <span className="text-slate-100 font-medium">Quicksteps</span> GO (waders,
              stillsteps, soles that walk on lava). Your shield rides the Left Hand. Upgrades
              are grown at the Forge and owned for good — owning one is wearing it.
            </p>
          </Section>

          <Section title="The world">
            <p>
              One zone is 100 paces across; the country changes as you walk out — meadows
              first, then wetlands, fungal dark, ember fields, saltglass, stranger things.
              Danger and wonder both rise with distance. Days turn on a ten-minute sky; your
              zone panel reads the day and hour. If you fall, you wake at your spawn point
              with your pouch untouched — falling costs you the walk back, never what you
              carry.
            </p>
          </Section>

          <Section title="Creatures are people">
            <p>
              They court, negotiate, hoard, and decide. Some can be fed, lured, and tamed into
              companions; the Culture Vat can regrow the lost from a saved sample. A guardian
              at your side is worth two strikers.
            </p>
          </Section>

          <Section title="Saving & company">
            <p>
              The game autosaves at your homestead world; the session bar (top-right) holds
              Save and Co-Op. A friend can join your world — you stay the host, your world is
              the world.
            </p>
            <p className="text-emerald-200/90 font-medium">
              Stuck? Follow the tracker. The next mini-quest is always the way forward.
            </p>
          </Section>
          </>
          ) : (
          <>
          {/* THE QUICK CUT — the same game in thirty seconds:
              same facts, no stories. A player in a hurry (or
              mid-play, checking one thing) lands here. */}
          <Section title="The whole game">
            <p>
              Harvest what grows → grow what you need at the Bio-Forge → graft it onto your
              gear → walk further out. That is the entire loop. Everything below is detail.
            </p>
          </Section>

          <Section title="Your hands">
            <Tool k="1" name="Harvest Glove">pick ripe plants.</Tool>
            <Tool k="2" name="Bio-Scanner">read creatures and plants into your Codex.</Tool>
            <Tool k="3" name="Planter Trowel">plant seeds AND spread fertilizer.</Tool>
            <Tool k="4" name="Solvent Sprayer">un-grow things, whole — nothing is wasted.</Tool>
            <Tool k="5" name="Taming Lure">offer treats; make companions.</Tool>
            <Tool k="6" name="Bio-Builder">place walls, hearths, storage.</Tool>
            <Tool k="7" name="Striker">your grown weapon — tap 7 again to swap close/ranged.</Tool>
            <p>
              <span className="font-semibold text-slate-100">Left Hand</span>
              <span className="text-slate-400">
                {' '}— lantern or shield. <span className="text-slate-200 font-medium">Alt + wheel</span> cycles it.
              </span>
            </p>
          </Section>

          <Section title="Forge, quests, gear">
            <p>
              <span className="text-slate-100 font-medium">B</span> opens the Bio-Forge — it
              grows everything you will ever wear.{' '}
              <span className="text-slate-100 font-medium">Q</span> opens the Quest Log — the
              mini-quests are the crafting chain, and following them teaches the game. Your
              gear is three platforms and a shield: the Gauntlet DOES, the Helmet KNOWS, the
              Quicksteps GO. Owning an upgrade is wearing it.
            </p>
          </Section>

          <Section title="If you remember one thing">
            <p className="text-emerald-200/90 font-medium">
              Follow the tracker. The next mini-quest is always the way forward — and this
              page is always one tap away, on the glowing button at the top-right.
            </p>
          </Section>
          </>
          )}
        </div>

        {/* Footer doors: the tutorial first (Slice B wires
            its engine), the Quest Log beside it, Close last. */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-t border-slate-700/60">
          {onShowTutorial && (
            <button
              onClick={onShowTutorial}
              className="px-4 py-2 rounded-xl text-xs font-tech font-bold text-emerald-950 bg-emerald-400 hover:bg-emerald-300 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Play className="w-3.5 h-3.5" /> SHOW TUTORIAL
            </button>
          )}
          {onOpenQuests && (
            <button
              onClick={onOpenQuests}
              className="px-4 py-2 rounded-xl text-xs font-tech font-bold text-slate-100 border border-slate-500/60 hover:bg-slate-800/70 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <ScrollText className="w-3.5 h-3.5 text-emerald-300" /> OPEN THE QUEST LOG
            </button>
          )}
          <button
            onClick={onClose}
            className="ml-auto px-4 py-2 rounded-xl text-xs font-tech font-bold text-slate-300 hover:text-white hover:bg-slate-800/70 active:scale-95 transition-all cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
