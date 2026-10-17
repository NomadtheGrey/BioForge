/**
 * QuestLogModal — the mini-quest list (Adam, 2026-10-15).
 *
 * The ONE door to quest management: the top-row button and the Q
 * hotkey both open this panel. It lists the mini-quests grouped by
 * tier (Adam: "a list of the same tier mini quests"), each with its
 * gather checkmarks and a status — and it owns the tracker HUD's
 * visibility through the checkbox at the top (Adam: "a little
 * checkbox there allows the little HUD to appear/disappear"). From
 * here the player also picks which quest the tracker follows.
 *
 * Quests unlock in chain order: a quest is available when every
 * quest before it is complete. Tracking is a preference, not a
 * gate — any available quest can be pinned to the tracker.
 *
 * PLAYSTYLE TABS (Adam, 2026-10-16): the log now opens through a
 * row of tabs — All Quests plus the seven playstyles from
 * ReadMeFiles/PLAYER_STYLES.md (the taxonomy and the per-quest
 * population map live in game/questStyles.ts). The tabs are a
 * LENS, never lanes: nobody picks a style, every tab is always
 * there, and chain state, tracking, and completion are global —
 * the same quest shows the same face in every tab it appears in.
 * All Quests keeps the chapter view (and the Field Notes);
 * Completionists is the master ledger (every quest, plus the
 * notes). The panel widened to max-w-4xl to give the tab bar room
 * to wrap to two rows without crowding the cards.
 */
import { useState } from 'react';
import { ScrollText, X } from 'lucide-react';
import { ITEMS } from '../game/constants';
import { FIELD_NOTES } from '../game/fieldNotes';
import type { FieldNotesState } from '../game/fieldNotesBook';
import type { CodexEntry } from '../types/game';
import type { ItemId } from '../types/game';
import { ASK_THE_WORLD_LINE, type QuestProgressView } from '../game/quests';
import { PLAYSTYLE_TABS, questInStyle, type PlayStyleId } from '../game/questStyles';
// THE WORLD ASKS BACK (dev lane, 2026-10-17): the dynamic saga
// section lives in this tab. The modal only READS the record and
// fires the callbacks — acceptance, choice, and tracking all land
// in App, which owns the asksBack state slice.
import type {
  AsksBackState,
  AsksInstance,
  AsksOffer,
} from '../game/asksBackState';
import { MAX_ACTIVE_SAGAS } from '../game/asksBack/director';
import { goalProgressText, choiceLabels } from '../game/asksBack/latch';

/** The tab state: a playstyle lens, or the Ask the World line's
 *  own tab (a named quest LINE, not a style — it sits apart from
 *  the style family in the bar, in the precursor amber). */
type LogTab = PlayStyleId | 'ask-the-world';

const LINE_TAB_META = {
  label: 'Ask the World',
  icon: '🗝️',
  promise:
    'Invitations from the country itself — go places, witness things, and piece together what the Precursors left behind.',
};

interface QuestLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  views: QuestProgressView[];
  completedIds: string[];
  trackedId: string | null;
  showHud: boolean;
  onToggleShowHud: (show: boolean) => void;
  onTrack: (questId: string) => void;
  fieldNotesState: FieldNotesState;
  codexList: CodexEntry[];
  // THE WORLD ASKS BACK (S3): the saga record the section reads,
  // plus the three doors into App's state slice.
  asksBackState: AsksBackState;
  onAcceptSaga: (offerId: string) => void;
  onChooseBranch: (sagaId: string, option: string) => void;
  onTrackSaga: (sagaId: string | null) => void;
  // S3: what the saga progress lines read — the goal-state signals,
  // the pouch, and the current zone key. (worldSeed is genuinely
  // unneeded by the progress math; the latch ctx carries ''.)
  sagaLatch: {
    signals?: import('../types/game').QuestSignals;
    inventory: Record<string, number>;
    zoneKey: string;
  };
}

export const QuestLogModal = ({
  isOpen,
  onClose,
  views,
  completedIds,
  trackedId,
  showHud,
  onToggleShowHud,
  onTrack,
  fieldNotesState,
  codexList,
  asksBackState,
  onAcceptSaga,
  onChooseBranch,
  onTrackSaga,
  sagaLatch,
}: QuestLogModalProps) => {
  // The active playstyle lens. Hooks run before the isOpen guard —
  // App keeps this component mounted and flips the flag.
  const [activeTab, setActiveTab] = useState<LogTab>('all');

  if (!isOpen) return null;

  const isDone = (v: QuestProgressView) =>
    v.complete || completedIds.includes(v.def.id);

  // The merged view list holds two families (background lane's
  // Ask the World build, 2026-10-16): the CRAFT CHAIN and the
  // LINE quests. They are shelved separately — the chain keeps
  // the chapter sections and the playstyle shelves exactly as
  // they were, the line gets its own tab — and the chain's
  // availability math runs on the craft views only, so a line
  // quest's goal state can never pose as the chain's front.
  const lineViews = views.filter((v) => v.def.line === ASK_THE_WORLD_LINE);
  const craftViews = views.filter((v) => !v.def.line);

  // Chain order gate: everything before the first incomplete quest
  // is done; that quest (and only it) is "available" next, though
  // any available-or-done quest may be re-tracked for its checks.
  const firstOpenIdx = craftViews.findIndex((v) => !isDone(v));

  const chapters = [1, 2, 3] as const;

  const isLineTab = activeTab === 'ask-the-world';
  const activeTabMeta: { label: string; icon: string; promise: string; comingSoon?: string } = isLineTab
    ? LINE_TAB_META
    : (PLAYSTYLE_TABS.find((t) => t.id === activeTab) ?? PLAYSTYLE_TABS[0]);
  const tabViews = (tab: PlayStyleId) => craftViews.filter((v) => questInStyle(v.def.id, tab));
  const tabDoneCount = (tab: PlayStyleId) => tabViews(tab).filter(isDone).length;

  // One quest card, rendered identically in every view — the
  // chain state it shows is global, so a quest's face never
  // changes with the lens you found it through.
  const renderQuestCard = (v: QuestProgressView) => {
    const idx = craftViews.indexOf(v);
    const done = isDone(v);
    const available = done || idx === firstOpenIdx;
    const tracked = trackedId === v.def.id;
    return (
      <div
        key={v.def.id}
        className={`rounded-2xl border px-4 py-3 ${
          done
            ? 'border-emerald-500/25 bg-emerald-950/20'
            : available
              ? 'border-slate-600 bg-slate-900/70'
              : 'border-slate-800 bg-slate-900/30 opacity-55'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex-none w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black ${
              done
                ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                : 'border-slate-600 text-slate-500'
            }`}
          >
            {done ? '✓' : available ? '•' : '🔒'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-100">
              {v.def.title}
            </div>
            <div className="text-[11px] text-slate-400 leading-snug">
              {v.def.blurb}
            </div>
            {/* What a locked quest waits on (dev-lane note,
                2026-10-16): in a style tab the predecessor may
                live on another shelf, and an unexplained lock
                reads as the TAB gating — naming the chain
                predecessor keeps the lens honest. */}
            {!done && !available && idx > 0 && (
              <div className="text-[11px] text-slate-500 leading-snug mt-0.5">
                Opens after “{craftViews[idx - 1].def.title}”
              </div>
            )}
          </div>
          {!done && available && (
            <button
              onClick={() => onTrack(v.def.id)}
              className={`flex-none text-[11px] font-bold px-3 py-1.5 rounded-xl border ${
                tracked
                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:border-emerald-400/50'
              }`}
            >
              {tracked ? 'TRACKING' : 'TRACK'}
            </button>
          )}
          {done && (
            <span className="flex-none text-[11px] font-black tracking-wider text-emerald-300">
              DONE
            </span>
          )}
        </div>
        {/* Gather checkmarks */}
        {(!done || v.gather.length > 0) && available && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {v.gather.map((g) => (
              <span
                key={g.itemId}
                className={`text-[11px] px-2 py-0.5 rounded-lg border ${
                  g.done || done
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-slate-700 bg-slate-800/50 text-slate-300'
                }`}
              >
                {(g.done || done) && '✓ '}
                {ITEMS[g.itemId]?.name ?? g.itemId} ·{' '}
                {Math.min(g.have, g.count)}/{g.count}
              </span>
            ))}
            {/* The craft the gathers serve — the same
                final checkbox the tracker shows */}
            {v.completion && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold ${
                  v.completion.done || done
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                }`}
              >
                {(v.completion.done || done) && '✓ '}
                {v.completion.label}
              </span>
            )}
          </div>
        )}
      </div>
    );
  };

  // The chapter-grouped ledger — the All Quests view, and the
  // Completionists master ledger (same chapters, same cards).
  const renderChapterSections = () => (
    <>
      {chapters.map((chapter) => {
        const chapterViews = craftViews.filter((v) => v.def.questChapter === chapter);
        if (chapterViews.length === 0) return null;
        return (
          <div key={chapter}>
            <div className="text-[10px] font-black tracking-[0.22em] text-emerald-300/80 mb-2">
              {chapter === 1
                ? 'CHAPTER 1 — GAUNTLET BASICS'
                : chapter === 2
                  ? 'CHAPTER 2 — FIELD SYNTHESIS'
                  : 'CHAPTER 3 — EYES & FEET'}
            </div>
            <div className="space-y-2">
              {chapterViews.map(renderQuestCard)}
            </div>
          </div>
        );
      })}
    </>
  );

  // FIELD NOTES — the discovery layer (data: slice 46;
  // wiring: dev chat, 2026-10-16). Locked notes are
  // ABSENT, never greyed — this whole section renders
  // only once the player has scanned something with a
  // story. A witnessed note carries its moment under
  // the clue, as a record. Nothing here is tracked to
  // the HUD, by design. Shown in the All Quests view
  // and the Completionists ledger.
  const renderFieldNotes = () => {
    if (fieldNotesState.unlocked.length === 0) return null;
    return (
      <div>
        <div className="text-[10px] font-black tracking-[0.22em] text-amber-300/80 mb-2">
          FIELD NOTES — {fieldNotesState.unlocked.length}/{FIELD_NOTES.length} FOUND
        </div>
        <div className="space-y-2">
          {FIELD_NOTES.filter((n) => fieldNotesState.unlocked.includes(n.id)).map((note) => {
            const witnessed = fieldNotesState.witnessed.includes(note.id);
            const name = note.species
              ? (codexList.find((c) => c.species === note.species)?.name
                ?? note.species.replace(/_/g, ' '))
              : 'The Great Ones';
            return (
              <div key={note.id} className="rounded-xl border border-amber-400/25 bg-amber-500/5 px-3.5 py-2.5">
                <div className="text-[13px] font-bold text-amber-100">{name}</div>
                <p className="mt-0.5 text-[12px] italic leading-snug text-slate-300">{note.clue}</p>
                {witnessed && (
                  <div className="mt-1.5 text-[11px] font-semibold text-amber-200/90">
                    ✓ Witnessed — {note.witness}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // An Ask the World card: no gathers to check off — the quest
  // completes on a goal state, so its face is the invitation
  // itself (flavor wink + blurb), the live progress line, and
  // its state: open, SEALED (chapter-3 invitations wait for
  // Field Synthesis — a seal, not a chain lock, and the latch
  // still honors a goal met early), or answered, with the
  // reward note the invitation carried.
  const renderLineCard = (v: QuestProgressView) => {
    const done = isDone(v);
    const sealed = !!v.sealed && !done;
    const tracked = trackedId === v.def.id;
    // The Field Note cross-link (background lane's join key,
    // HUD lane's render, 2026-10-16): a witness-goal card, once
    // complete, names the note its moment wrote. PURITY GUARD
    // (the creatures lane's rule): the link renders only when
    // the quest is done AND the note stands witnessed — a
    // locked note is absent everywhere, including as a teaser
    // on a quest card. The note's subject resolves exactly as
    // the Field Notes section resolves it.
    const witnessNoteName = (() => {
      const goal = v.def.completeWhen;
      if (!done || !goal || goal.kind !== 'witness') return null;
      const note = FIELD_NOTES.find((n) => n.id === goal.noteId);
      if (!note || !fieldNotesState.witnessed.includes(note.id)) return null;
      return note.species
        ? (codexList.find((c) => c.species === note.species)?.name
          ?? note.species.replace(/_/g, ' '))
        : 'The Great Ones';
    })();
    return (
      <div
        key={v.def.id}
        className={`rounded-2xl border px-4 py-3 ${
          done
            ? 'border-emerald-500/25 bg-emerald-950/20'
            : sealed
              ? 'border-amber-500/20 bg-slate-900/30 opacity-60'
              : 'border-amber-500/30 bg-amber-950/10'
        }`}
      >
        <div className="flex items-center gap-3">
          <span
            className={`flex-none w-6 h-6 rounded-lg border flex items-center justify-center text-xs font-black ${
              done
                ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                : sealed
                  ? 'border-amber-400/40 text-amber-300'
                  : 'border-amber-400/50 text-amber-300'
            }`}
          >
            {done ? '✓' : sealed ? '🔒' : '✦'}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-100">
              {v.def.title}
            </div>
            {v.def.flavor && (
              <div className="text-[11px] italic text-amber-200/80 leading-snug">
                {v.def.flavor}
              </div>
            )}
            <div className="text-[11px] text-slate-400 leading-snug">
              {v.def.blurb}
            </div>
          </div>
          {!done && !sealed && (
            <button
              onClick={() => onTrack(v.def.id)}
              className={`flex-none text-[11px] font-bold px-3 py-1.5 rounded-xl border ${
                tracked
                  ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                  : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:border-amber-400/50'
              }`}
            >
              {tracked ? 'TRACKING' : 'TRACK'}
            </button>
          )}
          {done && (
            <span className="flex-none text-[11px] font-black tracking-wider text-emerald-300">
              DONE
            </span>
          )}
        </div>
        {sealed ? (
          <div className="mt-2 text-[11px] text-amber-200/70 leading-snug">
            Sealed — this invitation opens once Field Synthesis is complete.
          </div>
        ) : (
          v.completion && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span
                className={`text-[11px] px-2 py-0.5 rounded-lg border font-semibold ${
                  done
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-200'
                    : 'border-amber-400/40 bg-amber-500/10 text-amber-200'
                }`}
              >
                {done && '✓ '}
                {v.completion.label}
              </span>
            </div>
          )
        )}
        {done && v.def.rewardNote && (
          <div className="mt-1.5 text-[11px] text-slate-400 leading-snug">
            <span className="text-slate-300 font-semibold">Reward:</span>{' '}
            {v.def.rewardNote}
          </div>
        )}
        {witnessNoteName && (
          <div className="mt-1.5 text-[11px] text-amber-200/80 leading-snug">
            📖 Field Note — {witnessNoteName} · witnessed
          </div>
        )}
      </div>
    );
  };

  // The line's shelf: its invitations grouped by chapter, same
  // rhythm as the craft ledger, in the line's amber.
  const renderLineSections = () => (
    <>
      {chapters.map((chapter) => {
        const chapterLineViews = lineViews.filter((v) => v.def.questChapter === chapter);
        if (chapterLineViews.length === 0) return null;
        return (
          <div key={chapter}>
            <div className="text-[10px] font-black tracking-[0.22em] text-amber-300/80 mb-2">
              CHAPTER {chapter} — INVITATIONS
            </div>
            <div className="space-y-2">
              {chapterLineViews.map(renderLineCard)}
            </div>
          </div>
        );
      })}
    </>
  );

  // ── THE WORLD ASKS BACK (S3) ─────────────────────────────────
  // The dynamic sagas' shelf, inside the Ask the World tab, AFTER
  // the invitation chapters (HUD lane's placement note, 2026-10-16:
  // sagas are kin to the line, not the craft chain).
  //
  // STATE HONESTY (HUD lane's second note): offered / active /
  // answered wear three distinct faces — violet ◈ for an offer,
  // amber ➤ for work in hand, emerald ✓ for answered. An offer is
  // NEVER dressed as a locked quest: no lock glyph, no "Opens
  // after" chain language anywhere — sagas are not chain-gated;
  // they are taken up or left to fade.
  const sagaCtx = {
    worldSeed: '',
    zoneKey: sagaLatch.zoneKey,
    signals: sagaLatch.signals,
    inventory: sagaLatch.inventory,
    itemName: (id: string) => ITEMS[id as ItemId]?.name ?? id,
  };
  const sagaRewardLine = (offer: AsksOffer | AsksInstance) =>
    offer.reward.items.length > 0
      ? offer.reward.items
          .map((i) => `${ITEMS[i.itemId as ItemId]?.name ?? i.itemId} ×${i.count}`)
          .join(', ')
      : null;
  const sagaActiveCount = asksBackState.active.filter(
    (a) => a.status === 'active',
  ).length;
  const sagaRosterFull = sagaActiveCount >= MAX_ACTIVE_SAGAS;

  const renderOfferedSaga = (offer: AsksOffer) => {
    const reward = sagaRewardLine(offer);
    return (
      <div
        key={offer.id}
        className="rounded-2xl border border-violet-500/30 bg-violet-950/10 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="flex-none w-6 h-6 rounded-lg border border-violet-400/50 text-violet-300 flex items-center justify-center text-xs font-black">
            ◈
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-black tracking-[0.22em] text-violet-300/80">
              THE WORLD ASKS
            </div>
            <div className="text-sm font-bold text-slate-100">{offer.title}</div>
            <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
              {offer.text}
            </div>
          </div>
          <button
            onClick={() => onAcceptSaga(offer.id)}
            disabled={sagaRosterFull}
            title={
              sagaRosterFull
                ? 'Three sagas is the most the world asks at once — answer or release one first'
                : 'Take up this saga'
            }
            className={`flex-none text-[11px] font-bold px-3 py-1.5 rounded-xl border ${
              sagaRosterFull
                ? 'border-slate-700 bg-slate-800/50 text-slate-500 cursor-not-allowed'
                : 'border-violet-400/60 bg-violet-500/20 text-violet-200 hover:border-violet-300'
            }`}
          >
            ACCEPT
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400">
          <span>
            {offer.steps.length} steps · {offer.zoneName}
          </span>
          {reward && (
            <span>
              <span className="text-slate-300 font-semibold">Reward:</span>{' '}
              {reward}
            </span>
          )}
          <span className="text-violet-200/60 italic">
            Unanswered offers fade back into the world's memory.
          </span>
        </div>
      </div>
    );
  };

  const renderActiveSaga = (inst: AsksInstance) => {
    const step = inst.steps[inst.currentStep];
    const tracked = asksBackState.tracked === inst.id;
    const choice = asksBackState.events.choices[inst.id];
    const isChoiceStep =
      !!step &&
      step.goal.kind === 'PROPOSED' &&
      step.goal.signal === 'chooseBranch' &&
      choice === undefined;
    const reward = sagaRewardLine(inst);
    return (
      <div
        key={inst.id}
        className="rounded-2xl border border-amber-500/30 bg-amber-950/10 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <span className="flex-none w-6 h-6 rounded-lg border border-amber-400/50 text-amber-300 flex items-center justify-center text-xs font-black">
            ➤
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-slate-100">{inst.title}</div>
            <div className="text-[10px] font-semibold tracking-wider text-amber-200/70">
              STEP {Math.min(inst.currentStep + 1, inst.steps.length)} OF{' '}
              {inst.steps.length} · {inst.zoneName}
            </div>
          </div>
          <button
            onClick={() => onTrackSaga(tracked ? null : inst.id)}
            className={`flex-none text-[11px] font-bold px-3 py-1.5 rounded-xl border ${
              tracked
                ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-200'
                : 'border-slate-600 bg-slate-800/70 text-slate-200 hover:border-amber-400/50'
            }`}
          >
            {tracked ? 'TRACKING' : 'TRACK'}
          </button>
        </div>
        {step && (
          <div className="mt-2 pl-9">
            <div className="text-[13px] font-bold text-slate-200">
              {step.title}
            </div>
            <div className="text-[11px] text-slate-400 leading-snug mt-0.5">
              {step.text}
            </div>
            <div className="mt-1.5 text-[11px] font-semibold text-amber-200/90">
              {goalProgressText(step, inst, asksBackState, sagaCtx)}
            </div>
            {isChoiceStep && (
              <div className="mt-2 flex flex-wrap gap-2">
                {choiceLabels(inst, step).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => onChooseBranch(inst.id, opt.value)}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-xl border border-amber-400/60 bg-amber-500/15 text-amber-100 hover:bg-amber-500/25"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {reward && (
          <div className="mt-1.5 pl-9 text-[11px] text-slate-400 leading-snug">
            <span className="text-slate-300 font-semibold">Reward:</span>{' '}
            {reward}
          </div>
        )}
      </div>
    );
  };

  const renderAnsweredSaga = (c: { id: string; day: number; title?: string; zoneName?: string }) => (
    <div
      key={c.id}
      className="rounded-2xl border border-emerald-500/20 bg-emerald-950/10 px-4 py-2.5 flex items-center gap-3"
    >
      <span className="flex-none w-6 h-6 rounded-lg border border-emerald-400/40 text-emerald-300 flex items-center justify-center text-xs font-black">
        ✓
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-bold text-slate-200 truncate">
          {c.title ?? 'A saga answered'}
        </div>
        <div className="text-[10px] text-slate-500">
          Answered · day {c.day}
          {c.zoneName ? ` · ${c.zoneName}` : ''}
        </div>
      </div>
      <span className="flex-none text-[10px] font-black tracking-wider text-emerald-300/80">
        ANSWERED
      </span>
    </div>
  );

  const renderAsksBackSection = () => {
    const offers = asksBackState.offers;
    const actives = asksBackState.active.filter((a) => a.status === 'active');
    const answered = asksBackState.completed;
    const empty = offers.length === 0 && actives.length === 0 && answered.length === 0;
    return (
      <div>
        <div className="text-[10px] font-black tracking-[0.22em] text-violet-300/80 mb-1">
          THE WORLD ASKS BACK
        </div>
        <p className="text-[11px] text-slate-400 leading-snug mb-3">
          Sagas the world offers from your own history — always two steps
          or more, never chained, never placed: dealt, the way the world
          deals everything. Take one up, or let it fade.
        </p>
        {empty ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center">
            <div className="text-2xl mb-1.5">◈</div>
            <div className="text-sm font-bold text-slate-200">
              The world is quiet — for now
            </div>
            <div className="text-[11px] text-slate-400 mt-1">
              Keep walking. It notices what you do.
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {offers.length > 0 && (
              <div>
                <div className="text-[10px] font-black tracking-[0.18em] text-violet-300/70 mb-2">
                  OFFERED · {offers.length}
                </div>
                <div className="space-y-2">{offers.map(renderOfferedSaga)}</div>
              </div>
            )}
            {actives.length > 0 && (
              <div>
                <div className="text-[10px] font-black tracking-[0.18em] text-amber-300/70 mb-2">
                  IN HAND · {actives.length}
                </div>
                <div className="space-y-2">{actives.map(renderActiveSaga)}</div>
              </div>
            )}
            {answered.length > 0 && (
              <div>
                <div className="text-[10px] font-black tracking-[0.18em] text-emerald-300/60 mb-2">
                  ANSWERED · {answered.length}
                </div>
                <div className="space-y-1.5">
                  {[...answered].reverse().map(renderAnsweredSaga)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const styleViews = !isLineTab && activeTab !== 'all' && activeTab !== 'completionists'
    ? tabViews(activeTab)
    : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-4xl max-h-[88vh] rounded-3xl flex flex-col overflow-hidden border border-emerald-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <ScrollText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide text-slate-100">
                MINI-QUESTS
              </h2>
              <p className="text-[11px] text-slate-400">
                The game, taught in the order it deepens. Finish one to open the next.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl border border-slate-700 bg-slate-800/60 text-slate-300 hover:text-white hover:border-slate-500 flex items-center justify-center"
            aria-label="Close quest list"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* The tracker HUD's switch lives here (Adam's model: this
            panel is where you choose to display the quest HUD). */}
        <label className="mx-6 mt-4 flex items-center gap-3 rounded-2xl border border-slate-700/80 bg-slate-900/60 px-4 py-3 cursor-pointer">
          <input
            type="checkbox"
            checked={showHud}
            onChange={(e) => onToggleShowHud(e.target.checked)}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm text-slate-200 font-semibold">
            Show the quest HUD
          </span>
          <span className="text-[11px] text-slate-400">
            the little tracker card with the checkmarks, on screen while you play
          </span>
        </label>

        {/* Playstyle tabs — a lens, not lanes (Adam, 2026-10-16).
            Nobody chooses a style; the tabs simply re-shelve the
            same quests by the verb they teach. The bar wraps to a
            second row at this width by design. Each tab carries
            its progress count, and the active tab's promise line
            sits under the bar. */}
        <div className="mx-6 mt-4">
          <div className="flex flex-wrap gap-1.5">
            {PLAYSTYLE_TABS.map((tab) => {
              const total = tabViews(tab.id).length;
              const doneCount = tabDoneCount(tab.id);
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                    active
                      ? 'border-emerald-400/60 bg-emerald-500/20 text-emerald-100'
                      : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:border-emerald-400/40 hover:text-slate-100'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  <span className={`font-mono text-[10px] ${active ? 'text-emerald-300' : 'text-slate-500'}`}>
                    {doneCount}/{total}
                  </span>
                </button>
              );
            })}
            {/* The Ask the World line's own tab — set apart from
                the style family in the precursor amber: a named
                line, not a playstyle. */}
            <button
              onClick={() => setActiveTab('ask-the-world')}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-bold transition-colors ${
                isLineTab
                  ? 'border-amber-400/60 bg-amber-500/20 text-amber-100'
                  : 'border-amber-500/30 bg-amber-950/20 text-amber-200/80 hover:border-amber-400/50 hover:text-amber-100'
              }`}
            >
              <span>🗝️</span>
              <span>Ask the World</span>
              <span className={`font-mono text-[10px] ${isLineTab ? 'text-amber-300' : 'text-amber-200/50'}`}>
                {lineViews.filter(isDone).length}/{lineViews.length}
              </span>
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-400 leading-snug">
            <span className="text-slate-200 font-semibold">{activeTabMeta.label}.</span>{' '}
            {activeTabMeta.promise}
            {isLineTab ? (
              lineViews.some((v) => v.sealed && !isDone(v)) && (
                <span className="text-amber-200/70">
                  {' '}Some invitations are sealed until Field Synthesis is complete.
                </span>
              )
            ) : (
              <span className="text-slate-500">
                {' '}No style is chosen — every quest can be run from any tab it appears in.
              </span>
            )}
          </p>
        </div>

        {/* Content — the chapter ledger for All / Completionists,
            or the active style's shelf in chain order. */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isLineTab ? (
            <>
              {renderLineSections()}
              {renderAsksBackSection()}
            </>
          ) : activeTab === 'all' || activeTab === 'completionists' ? (
            <>
              {renderChapterSections()}
              {renderFieldNotes()}
            </>
          ) : (
            <div>
              {styleViews.length > 0 ? (
                <div className="space-y-2">
                  {styleViews.map(renderQuestCard)}
                </div>
              ) : (
                <div className="rounded-2xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center">
                  <div className="text-2xl mb-1.5">{activeTabMeta.icon}</div>
                  <div className="text-sm font-bold text-slate-200">
                    No quests shelved here — yet
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    {activeTabMeta.promise}
                  </div>
                </div>
              )}
              {/* An honest note where the shelf is still being
                  stocked — it names the feed instead of faking
                  content (see questStyles.ts on the gaps). */}
              {activeTabMeta.comingSoon && (
                <div className="mt-3 rounded-xl border border-slate-800 bg-slate-900/30 px-3.5 py-2.5 text-[11px] text-slate-400 leading-snug">
                  <span className="text-slate-300 font-semibold">Still growing:</span>{' '}
                  {activeTabMeta.comingSoon}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
