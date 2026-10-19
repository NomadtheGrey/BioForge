/**
 * FeedbackModal — the player's word to the grower (Adam,
 * 2026-10-18: "We'll need an issues/recommendations modal,
 * so players can report issues and recommendations to the
 * bioforge.game@gmail.com address").
 *
 * THE DELIVERY, honestly — TWO DOORS, chosen by whether the
 * direct send is lit (game/feedbackSend: the EMAILJS_*
 * constants in game/links). LIT: the note sends straight
 * from this page through EmailJS to the game's Gmail — no
 * mail program needed; the player may leave an email for a
 * reply. DARK (the constants unset, as shipped): the
 * original door — the note travels by the player's OWN mail
 * program (mailto:), with the address on screen and a copy
 * button for players with no mail program set up. And if a
 * lit send FAILS, the mailto door is offered as the
 * fallback — the player's words are never eaten by a dead
 * transport.
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
import { Mail, X, Copy, Check, Bug, Lightbulb, Send, CheckCircle2 } from 'lucide-react';
import { FEEDBACK_EMAIL } from '../game/links';
import { BUILD_ID } from '../game/buildNotes';
import { feedbackSendConfigured, sendFeedback } from '../game/feedbackSend';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Where the player is, when a seat knows (zone · biome ·
   *  device) — rides in the note's footer when included. */
  contextLine?: string;
}

type FeedbackKind = 'issue' | 'recommendation';
type SendPhase = 'compose' | 'sending' | 'sent' | 'failed';

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, contextLine }) => {
  const [kind, setKind] = useState<FeedbackKind>('issue');
  const [message, setMessage] = useState('');
  const [includeContext, setIncludeContext] = useState(true);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  // The direct send's phase machine (only reachable while
  // the EmailJS door is lit): compose → sending → sent |
  // failed. Failed never eats the words — the form keeps the
  // message and the mailto door opens as the fallback.
  const [phase, setPhase] = useState<SendPhase>('compose');
  const [replyEmail, setReplyEmail] = useState('');
  // The failure's substance (Adam's pin, 2026-10-19): the
  // failed state SHOWS why — the transport's reason, and the
  // HTTP status when the service answered with one — in
  // player words, never a vague 'something went wrong'.
  const [failInfo, setFailInfo] = useState<{ reason: string; status?: number } | null>(null);
  const [noteCopied, setNoteCopied] = useState(false);
  const directSend = feedbackSendConfigured();

  // Escape closes it (the credits lesson, applied from birth).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [isOpen, onClose]);

  // A sent note is spent: reopening the modal after a send
  // starts a fresh form rather than the old thank-you.
  useEffect(() => {
    if (isOpen && phase === 'sent') {
      setPhase('compose');
      setMessage('');
      setReplyEmail('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

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

  // The direct door (lit EmailJS only): one call with the
  // composed strings, per the feedbackSend contract — it
  // never throws; a refusal lands in 'failed' with the words
  // intact and the mailto door offered below.
  const handleDirectSend = async () => {
    if (!message.trim() || phase === 'sending') return;
    setPhase('sending');
    setFailInfo(null);
    const result = await sendFeedback({
      subject,
      message: message.trim() + footer,
      fromEmail: replyEmail.trim() || undefined,
    });
    if (result.ok) {
      setPhase('sent');
    } else {
      setFailInfo({ reason: result.reason, status: result.status });
      setPhase('failed');
    }
  };

  // The failure's other escape (Adam's pin, 2026-10-19): copy
  // the FULL composed note — subject and body, footer and
  // all — so the player can paste it into any mail program
  // or page themselves. A failed send never traps the words.
  const handleCopyNote = async () => {
    try {
      await navigator.clipboard.writeText(`${subject}\n\n${message.trim() + footer}`);
      setNoteCopied(true);
      window.setTimeout(() => setNoteCopied(false), 2000);
    } catch {
      // Clipboard refused — the words still stand in the
      // form above, selectable by hand; nothing else to do.
    }
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

  // The address row is shared: it is the dark door's standing
  // help AND the lit door's failure fallback.
  const addressRow = (
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
  );

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

        {directSend && phase === 'sent' ? (
          /* ── SENT (the direct door): the words are away. ── */
          <div className="p-6 space-y-4 flex flex-col items-center text-center">
            <CheckCircle2 className="w-10 h-10 text-emerald-300" />
            <p className="text-sm text-slate-200 font-semibold">Your words are on their way to the grower.</p>
            <p className="text-[11px] leading-relaxed text-slate-500">
              {replyEmail.trim()
                ? `You left an address for a reply: ${replyEmail.trim()} — if your note needs an answer, watch that inbox.`
                : 'No reply address was left, so this one travels one way — thank you all the same.'}
            </p>
            <button
              onClick={onClose}
              className="w-full px-4 py-2.5 rounded-xl text-xs font-tech font-bold text-violet-100 border border-violet-400/60 bg-violet-950/60 hover:bg-violet-900/60 transition-colors cursor-pointer"
            >
              CLOSE
            </button>
          </div>
        ) : (
          <div className="p-6 space-y-4">
            {/* What kind of word is this? */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setKind('issue')}
                disabled={phase === 'sending'}
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
                disabled={phase === 'sending'}
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
              disabled={phase === 'sending'}
              placeholder={
                kind === 'issue'
                  ? 'What happened? What were you doing when it happened?'
                  : 'What would make the world better?'
              }
              className="w-full rounded-xl bg-slate-900/70 border border-slate-700/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-400/60 resize-y"
            />

            {/* The reply door (direct send only): an email is
                OPTIONAL — the note travels fine without one;
                it only decides whether the grower can answer. */}
            {directSend && (
              <input
                type="email"
                value={replyEmail}
                onChange={(e) => setReplyEmail(e.target.value)}
                disabled={phase === 'sending'}
                placeholder="Your email, if you'd like a reply (optional)"
                className="w-full rounded-xl bg-slate-900/70 border border-slate-700/60 px-3 py-2.5 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-violet-400/60"
              />
            )}

            <label className="flex items-start gap-2 text-xs text-slate-400 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={includeContext}
                onChange={(e) => setIncludeContext(e.target.checked)}
                className="mt-0.5 accent-violet-400"
              />
              Include where I am and which build I&apos;m on — it helps fix things.
            </label>

            {directSend ? (
              <>
                <button
                  onClick={handleDirectSend}
                  disabled={!message.trim() || phase === 'sending'}
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-tech font-bold text-violet-100 border border-violet-400/60 bg-violet-950/60 hover:bg-violet-900/60 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  {phase === 'sending' ? 'SENDING…' : phase === 'failed' ? 'TRY SENDING AGAIN' : 'SEND'}
                </button>

                {phase === 'failed' ? (
                  /* ── FAILED: the honest fallback. The words
                      stay in the form above; the mailto door
                      opens beneath, exactly as the dark door
                      works today. ── */
                  <>
                    <p className="text-[11px] leading-relaxed text-amber-200/90">
                      The direct send didn&apos;t go through — your words are still here, nothing was
                      lost.
                      {failInfo && (
                        <>
                          {' '}
                          <span className="text-amber-100 font-semibold">
                            {failInfo.reason === 'network'
                              ? 'Why: the note never reached the mail service — the connection failed, or took too long (it gives up after 10 seconds).'
                              : failInfo.reason === 'rejected'
                                ? `Why: the mail service answered but refused the note${failInfo.status ? ` (HTTP ${failInfo.status})` : ''} — the sending service itself said no.`
                                : 'Why: the direct send is not set up on this build.'}
                          </span>
                        </>
                      )}{' '}
                      Two ways out: copy your note and paste it anywhere, or send it through your mail
                      app instead:
                    </p>
                    <button
                      onClick={handleCopyNote}
                      className="w-full px-4 py-2.5 rounded-xl text-xs font-tech font-bold text-slate-200 border border-slate-500/60 hover:bg-slate-800/60 transition-colors cursor-pointer flex items-center justify-center gap-2"
                    >
                      {noteCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                      {noteCopied ? 'COPIED — PASTE IT ANYWHERE' : 'COPY MY NOTE'}
                    </button>
                    <button
                      onClick={handleSend}
                      className="w-full px-4 py-2.5 rounded-xl text-xs font-tech font-bold text-slate-200 border border-slate-500/60 hover:bg-slate-800/60 transition-colors cursor-pointer"
                    >
                      OPEN IN MY MAIL APP
                    </button>
                    {addressRow}
                  </>
                ) : (
                  <p className="text-[11px] leading-relaxed text-slate-500">
                    Sends straight from this page to the grower — no mail app needed.
                  </p>
                )}
              </>
            ) : (
              <>
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
                {addressRow}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
