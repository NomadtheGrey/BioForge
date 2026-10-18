// ====================================================================
// SystemStreamPanel — the in-game system stream's card
// (system messages, Adam 2026-10-18). HUD.tsx seats it in a
// HudPanel at the BOTTOM of the left stack (the HUD lane's
// placement call: the column reads urgency-descending, and a
// stream is a log you consult, not a gauge you watch).
//
// Furniture discipline from the stack's own history: the
// card's height is CAPPED and the lines scroll INSIDE it —
// a feed must never stretch the column (the 770px lesson).
// The system voice is its own: sky accent + a SYSTEM tag,
// visibly not a game notice and not a quest line.
//
// Clicking the card marks the stream seen (the unread dot
// clears) — reading is the acknowledgement.
// ====================================================================

import React, { useEffect, useRef } from 'react';
import type { SystemLine } from '../hooks/useSystemFeed';

interface SystemStreamPanelProps {
  lines: SystemLine[];
  unread: number;
  onRead: () => void;
}

export const SystemStreamPanel: React.FC<SystemStreamPanelProps> = ({ lines, unread, onRead }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // The stream reads like a chat: newest at the bottom, and
  // the view follows new lines as they land.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines.length]);

  return (
    <div
      className="glass-panel w-72 px-3.5 py-3 rounded-2xl border border-sky-700/40 shadow-lg cursor-pointer"
      onClick={onRead}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[9px] font-tech font-bold tracking-widest text-sky-300 uppercase">
          System
        </span>
        {unread > 0 && (
          <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" aria-label={`${unread} unread`} />
        )}
        <span className="text-[9px] text-slate-500 font-mono ml-auto">grower · builds</span>
      </div>
      <div ref={scrollRef} className="max-h-44 overflow-y-auto space-y-2.5 pr-1">
        {lines.length === 0 ? (
          <p className="text-[11px] text-slate-400 leading-relaxed">
            No word yet. The channel is open — new builds and rare word from the grower land here.
          </p>
        ) : (
          lines.map((line) => (
            <div key={line.id}>
              {line.title && (
                <div className="text-[10px] font-tech font-bold text-sky-200 leading-tight">{line.title}</div>
              )}
              <p className="text-[11px] text-slate-300 leading-snug">{line.text}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
