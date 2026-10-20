// ====================================================================
// NewsModal — the start screen's news seat (system messages,
// Adam 2026-10-18). Props for the live feed (from
// useSystemFeed by way of StartScreenModal), plus ONE pure
// read at render: the device-kept system log
// (game/systemLog), the archive Adam commissioned
// 2026-10-20 — the last ~50 broadcasts + build notices this
// device has seen, expired word included, so news is
// cumulative on the device and never lost with a session.
//
// Two voices live here, kept visibly apart:
//   • "While you were away" — THIS build's own baked notes
//     (game/buildNotes.ts): what changed in the build the
//     player is now running.
//   • "Word from the grower" — the feed's live broadcasts
//     (game/systemFeed.ts): Adam's rare hand-made messages.
// The build stamp in the footer is the same string the merge
// flow reads out of the bundle to stamp the feed — shown so
// a player (or Adam) can always answer "which build am I on?"
// ====================================================================

import React from 'react';
import { X } from 'lucide-react';
import { BUILD_ID, BUILD_NOTES } from '../game/buildNotes';
import type { FeedBroadcast } from '../game/systemFeed';
import { readSystemLog } from '../game/systemLog';

/** A kept entry's first-seen day, as YYYY-MM-DD. */
const seenDay = (firstSeenAt: string | number): string =>
  typeof firstSeenAt === 'number'
    ? new Date(firstSeenAt).toISOString().slice(0, 10)
    : String(firstSeenAt).slice(0, 10);

interface NewsModalProps {
  isOpen: boolean;
  onClose: () => void;
  broadcasts: FeedBroadcast[];
}

export const NewsModal: React.FC<NewsModalProps> = ({ isOpen, onClose, broadcasts }) => {
  if (!isOpen) return null;
  // The kept archive, newest first. When this device has
  // seen anything, the archive IS the grower section (the
  // live feed's word merges into it upstream, so nothing
  // shows twice); on a device with an empty log, the live
  // broadcasts render exactly as they always have.
  const archive = readSystemLog();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-xl max-h-[94dvh] rounded-3xl flex flex-col overflow-hidden border border-sky-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 [@media(max-height:540px)]:px-4 [@media(max-height:540px)]:py-2 flex items-center gap-3 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h3 className="text-base font-tech font-bold text-white tracking-wide">NEWS</h3>
            <p className="text-[11px] text-slate-400">Word from the grower, and from the build itself</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-all cursor-pointer"
            aria-label="Close news"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* This build's own notes */}
          <section>
            <h4 className="text-[11px] font-tech font-bold tracking-widest text-sky-300 uppercase mb-2">
              While you were away — {BUILD_NOTES.title}
            </h4>
            <ul className="space-y-2">
              {BUILD_NOTES.lines.map((line, i) => (
                <li key={i} className="text-sm text-slate-200 leading-relaxed flex gap-2">
                  <span className="text-sky-400 mt-0.5">•</span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* The grower's broadcasts — from the kept archive
              when this device has one (broadcasts AND build
              notices, newest first), else the live feed. */}
          <section>
            <h4 className="text-[11px] font-tech font-bold tracking-widest text-emerald-300 uppercase mb-2">
              Word from the grower
            </h4>
            {archive.length > 0 ? (
              <>
                <p className="text-[11px] text-slate-500 leading-relaxed mb-3">
                  Kept on this device — the last bunch of word and build notices, newest first.
                  Nothing here rolls off when a session ends.
                </p>
                <div className="space-y-4">
                  {archive.map((e) =>
                    e.kind === 'broadcast' ? (
                      <article key={e.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
                        <div className="flex items-baseline gap-2">
                          <h5 className="text-sm font-tech font-bold text-white">{e.title}</h5>
                          {e.date && <span className="text-[10px] text-slate-500 font-mono">{e.date}</span>}
                        </div>
                        <p className="text-sm text-slate-300 leading-relaxed mt-1">{e.body}</p>
                      </article>
                    ) : (
                      <div
                        key={`build-${e.stamp}-${e.firstSeenAt}`}
                        className="flex items-baseline gap-2 rounded-2xl border border-sky-800/50 bg-sky-950/20 px-4 py-2.5"
                      >
                        <span className="text-[11px] font-tech font-bold tracking-wider text-sky-300 uppercase">
                          New build
                        </span>
                        <span className="text-xs font-mono text-slate-300">{e.stamp}</span>
                        <span className="ml-auto text-[10px] text-slate-500 font-mono">
                          first seen {seenDay(e.firstSeenAt)}
                        </span>
                      </div>
                    ),
                  )}
                </div>
              </>
            ) : broadcasts.length === 0 ? (
              <p className="text-sm text-slate-400 leading-relaxed">
                Nothing posted right now. When there is word — a new build worth your attention, a note
                from Adam — it will arrive here and in the co-op chat in-game.
              </p>
            ) : (
              <div className="space-y-4">
                {broadcasts.map((b) => (
                  <article key={b.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/50 px-4 py-3">
                    <div className="flex items-baseline gap-2">
                      <h5 className="text-sm font-tech font-bold text-white">{b.title}</h5>
                      {b.date && <span className="text-[10px] text-slate-500 font-mono">{b.date}</span>}
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed mt-1">{b.body}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Footer: the stamp, for "which build am I on?" */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/60 flex items-center justify-between">
          <span className="text-[10px] font-mono text-slate-500">Build {BUILD_ID}</span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-2xl text-[11px] font-tech font-bold text-sky-200 border border-sky-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            BACK
          </button>
        </div>
      </div>
    </div>
  );
};
