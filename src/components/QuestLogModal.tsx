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
 */
import { ScrollText, X } from 'lucide-react';
import { ITEMS } from '../game/constants';
import type { QuestProgressView } from '../game/quests';

interface QuestLogModalProps {
  isOpen: boolean;
  onClose: () => void;
  views: QuestProgressView[];
  completedIds: string[];
  trackedId: string | null;
  showHud: boolean;
  onToggleShowHud: (show: boolean) => void;
  onTrack: (questId: string) => void;
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
}: QuestLogModalProps) => {
  if (!isOpen) return null;

  const isDone = (v: QuestProgressView) =>
    v.complete || completedIds.includes(v.def.id);
  // Chain order gate: everything before the first incomplete quest
  // is done; that quest (and only it) is "available" next, though
  // any available-or-done quest may be re-tracked for its checks.
  const firstOpenIdx = views.findIndex((v) => !isDone(v));

  const tiers = [1, 2, 3] as const;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-2xl max-h-[640px] rounded-3xl flex flex-col overflow-hidden border border-emerald-500/30 shadow-2xl">
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

        {/* Tier sections */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {tiers.map((tier) => {
            const tierViews = views.filter((v) => v.def.tier === tier);
            if (tierViews.length === 0) return null;
            return (
              <div key={tier}>
                <div className="text-[10px] font-black tracking-[0.22em] text-emerald-300/80 mb-2">
                  {tier === 1
                    ? 'TIER 1 — GAUNTLET BASICS'
                    : tier === 2
                      ? 'TIER 2 — FIELD SYNTHESIS'
                      : 'TIER 3 — EYES & FEET'}
                </div>
                <div className="space-y-2">
                  {tierViews.map((v) => {
                    const idx = views.indexOf(v);
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
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
