/**
 * FeedbackModal — the player's word to the grower (Adam,
 * 2026-10-18: "We'll need an issues/recommendations modal,
 * so players can report issues and recommendations to the
 * bioforge.game@gmail.com address").
 *
 * THE DELIVERY, honestly: the game has no mail server (the
 * database future is parked), so the note travels by the
 * player's OWN mail program — the modal composes it and the
 * send button opens a pre-addressed, pre-written message
 * (mailto:). For players with no mail program set up, the
 * address stands on the screen with a copy button, so the
 * word can still be sent from anywhere. When a real backend
 * ever lands, this component's compose half survives; only
 * the send changes.
 *
 * Built with today's lessons in from birth: it declares
 * pointer-events-auto itself (one of its seats lives inside
 * the HUD's click-transparent root), it owns an Escape
 * listener, and the backdrop closes it.
 *
 * Seats: the Session bar (beside Credits/Donate — the
 * always-visible row) and the start screen's header.
 */
import React, { useEffect, useState } from 'react';
import { Mail, X, Copy, Check, Bug, Lightbulb } from 'lucide-react';
import { FEEDBACK_EMAIL } from '../game/links';
import { BUILD_ID } from '../game/buildNotes';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where the player is, when a seat knows (zone · biome ·
   *  device) — rides in the note's footer when included. */
  contextLine?: string;
}

type FeedbackKind = 'issue' | 'recommendation';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, contextLine }) => {
  const [kind, setKind] = useState<FeedbackKind>('issue');
  const [message, setMessage] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  // Escape closes it (the credits lesson, applied from birth).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const kindWord = kind === 'issue' ? 'Issue' : 'Recommendation';
  const firstLine = message.trim().split('\n')[0]?.slice(0, 48) ?? '';
  const subject = `BioForge — ${kindWord}${firstLine ? `: ${firstLine}` : ''}`;
  const footer = includeContext
    ? `\n\n— — —\nBuild: ${BUILD_ID}${contextLine ? `\nWhere: ${contextLine}` : ''}`
    : '';
  const mailto = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message.trim() + footer)}`;

  const handleSend = () => {
    window.location.href = mailto;
    setSent(true);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(FEEDBACK_EMAIL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard refused (permissions) — the address is on
      // screen in plain text regardless; nothing else to do.
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md pointer-events-auto"
      onClick={onClose}
    >
      <div
        className="glass-panel-biolum w-full max-w-md rounded-3xl overflow-hidden border border-violet-500/30 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-800 bg-slate-900/60">
          <div className="w-10 h-10 rounded-2xl bg-violet-950/70 border border-violet-500/40 flex items-center justify-center text-violet-300">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-tech font-bold text-white tracking-wide">FEEDBACK</h2>
            <p className="text-xs text-slate-400">Tell the grower what broke — or what you&apos;d grow next.</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close feedback"
            className="ml-auto p-2 rounded-xl text-slate-400 border border-slate-700/60 hover:text-white hover:scale-105 active:scale-95 transition-all cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* What kind of word is this? */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setKind('issue')}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-tech font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                kind === 'issue'
                  ? 'text-amber-200 border-amber-500/60 bg-amber-950/50'
                  : 'text-slate-400 border-slate-700/60 hover:bg-slate-800/60'
              }`}
            >
              <Bug className="w-3.5 h-3.5" /> REPORT AN ISSUE
            </button>
            <button
              onClick={() => setKind('recommendation')}
              className={`flex-1 px-3 py-2 rounded-xl text-[11px] font-tech font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                kind === 'recommendation'
                  ? 'text-cyan-200 border-cyan-500/60 bg-cyan-950/50'
                  : 'text-slate-400 border-slate-700/60 hover:bg-slate-800/60'
              }`}
            >
              <Lightbulb className="w-3.5 h-3.5" /> RECOMMENDATION
            </button>
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            autoFocus
            placeholder={
              kind === 'issue'
                ? 'What happened? What were you doing when it happened?'
                : 'What would make the world better?'
            }
            className="w-full rounded-xl bg-slate-900/70 border border-slate-700/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-400/60 resize-y"
          />

          <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includeContext}
              onChange={(e) => setIncludeContext(e.target.checked)}
              className="mt-0.5 accent-violet-400"
            />
            Include where I am and which build I&apos;m on — it helps fix things.
          </label>

          <button
            onClick={handleSend}
            disabled={!message.trim()}
            className="w-full px-4 py-2.5 rounded-xl text-xs font-tech font-bold text-violet-100 border border-violet-400/60 bg-violet-950/60 hover:bg-violet-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            OPEN IN MY MAIL APP
          </button>

          <p className="text-[11px] leading-relaxed text-slate-500">
            {sent
              ? 'Your mail app should be opening with the note addressed and written — just press send there. Nothing arrived? Write us directly:'
              : 'This opens your own mail program with the note addressed to us. No mail program set up? Copy the address and write from anywhere:'}
          </p>
          <div className="flex items-center gap-2">
            <span className="flex-1 font-mono text-xs text-slate-300 bg-slate-900/70 border border-slate-700/60 rounded-lg px-3 py-2 select-all">
              {FEEDBACK_EMAIL}
            </span>
            <button
              onClick={handleCopy}
              className="px-3 py-2 rounded-lg text-[11px] font-tech font-bold text-slate-200 border border-slate-600/60 hover:bg-slate-800/70 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'COPIED' : 'COPY'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
