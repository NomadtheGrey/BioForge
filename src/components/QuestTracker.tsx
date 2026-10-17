/**
 * QuestTracker — the little quest HUD (Adam, 2026-10-15).
 *
 * A compact card that follows ONE mini-quest: its title and a row
 * per gather objective, each carrying a checkmark once the item is
 * in the pouch (Adam: "checkmarks for gathered items"). For module
 * quests the last row is the craft itself — it checks when the
 * module is grafted on and the tool unlocks.
 *
 * Visibility is a preference owned by the quest LIST (the checkbox
 * there shows/hides this card — App renders it only when the
 * player's showHud preference is on). One door, one switch: the
 * button up top and the Q hotkey both open the list, never this
 * card directly.
 */
import { X } from 'lucide-react';
import { ITEMS } from '../game/constants';
import type { QuestProgressView } from '../game/quests';

/**
 * The saga the tracker follows (S3): an active World Asks Back
 * saga pinned from the quest log. Rendered in the saga's violet —
 * the authored quest's emerald/amber face stays untouched.
 */
export interface SagaTrackView {
  title: string;
  zoneName: string;
  stepN: number;
  stepTotal: number;
  stepTitle: string;
  stepText: string;
  progress: string;
}

interface QuestTrackerProps {
  view?: QuestProgressView | null;
  saga?: SagaTrackView | null;
  /** Close this quest's card (Adam, 2026-10-15): the tracker
   * rests; the quest stays in the log, ready to re-track. */
  onDismiss?: () => void;
}

export const QuestTracker = ({ view, saga, onDismiss }: QuestTrackerProps) => {
  // A pinned saga wears its own face: the saga title, the
  // current step, and the live progress line (the same math the
  // log card shows — latch.ts is the single source).
  if (saga) {
    return (
      <div className="relative pointer-events-none w-52 min-[760px]:w-60 rounded-2xl border border-violet-400/25 bg-slate-950/70 backdrop-blur-md px-3.5 py-3 shadow-xl">
        {onDismiss && (
          <button
            onClick={onDismiss}
            title="Unpin this saga (it stays in the quest log)"
            className="pointer-events-auto absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
        <div className="flex items-center gap-2">
          <span className="text-[9px] font-black tracking-[0.18em] px-1.5 py-0.5 rounded-md bg-violet-500/15 border border-violet-400/30 text-violet-300">
            SAGA
          </span>
          <span className="text-[10px] font-black tracking-[0.18em] text-violet-200/70">
            THE WORLD ASKS BACK
          </span>
        </div>
        <div className="mt-1 text-sm font-bold text-slate-100 leading-tight">
          {saga.title}
        </div>
        <div className="text-[10px] font-semibold tracking-wider text-violet-200/70 mt-0.5">
          STEP {saga.stepN} OF {saga.stepTotal} · {saga.zoneName}
        </div>
        <div className="mt-1.5 text-[11px] font-bold text-slate-200 leading-snug">
          {saga.stepTitle}
        </div>
        <div className="mt-0.5 text-[11px] font-semibold text-violet-200/90 leading-snug">
          {saga.progress}
        </div>
      </div>
    );
  }

  if (!view) return null;
  const { def, gather } = view;

  return (
    <div className="relative pointer-events-none w-52 min-[760px]:w-60 rounded-2xl border border-emerald-400/25 bg-slate-950/70 backdrop-blur-md px-3.5 py-3 shadow-xl">
      {/* The little X (Adam): close this quest; reselect it in the log */}
      {onDismiss && (
        <button
          onClick={onDismiss}
          title="Close this quest (reopen it from the quest log)"
          className="pointer-events-auto absolute top-2 right-2 w-5 h-5 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-100 hover:bg-slate-700/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
      {/* Header: tier chip + quest title */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black tracking-[0.18em] px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
          CHAPTER {def.questChapter}
        </span>
        <span className="text-[10px] font-black tracking-[0.18em] text-emerald-200/70">
          {def.line ? 'ASK THE WORLD' : 'MINI-QUEST'}
        </span>
      </div>
      <div className="mt-1 text-sm font-bold text-slate-100 leading-tight">
        {def.title}
      </div>
      {/* A tracked line quest wears its flavor wink (its
          progress rides the completion row below — for a line
          quest that row IS the live goal line, not a craft). */}
      {def.line && def.flavor && (
        <div className="text-[10px] italic text-amber-200/80 leading-snug">
          {def.flavor}
        </div>
      )}

      {/* Gather objectives — the checkmark list */}
      <ul className="mt-2 space-y-1">
        {gather.map((g) => (
          <li
            key={g.itemId}
            className={`flex items-center gap-2 text-xs ${
              g.done ? 'text-emerald-300' : 'text-slate-300'
            }`}
          >
            <span
              className={`flex-none w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-black ${
                g.done
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                  : 'border-slate-600 text-transparent'
              }`}
            >
              ✓
            </span>
            <span className="flex-1 truncate">
              {ITEMS[g.itemId]?.name ?? g.itemId}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {Math.min(g.have, g.count)}/{g.count}
            </span>
          </li>
        ))}

        {/* The craft step itself — EVERY quest's final checkbox
            (Adam, 2026-10-15): the gathers exist to make this. */}
        {view.completion && (
          <li
            className={`flex items-center gap-2 text-xs pt-1 mt-1 border-t border-slate-700/50 ${
              view.completion.done ? 'text-emerald-300' : 'text-amber-200'
            }`}
          >
            <span
              className={`flex-none w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-black ${
                view.completion.done
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                  : 'border-amber-400/50 text-transparent'
              }`}
            >
              ✓
            </span>
            <span className="flex-1 truncate">{view.completion.label}</span>
          </li>
        )}
      </ul>
    </div>
  );
};
