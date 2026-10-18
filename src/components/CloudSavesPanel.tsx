// ====================================================================
// CLOUD SAVES — the start-screen seat (Adam's ruling,
// 2026-10-18: the toggle AND the words live by Saved Worlds).
//
// The panel heads the Saved Worlds section on the start
// screen: worlds are chosen there, so their traveling papers
// live there. It holds, in one self-contained component:
//   THE ROW    — off/on, mirroring Adam's laws in its copy:
//                opt-in only; the local save is the master.
//   THE WORDS  — the reveal screen: three words, big, with
//                the honest warning (the words are the only
//                key; there is no recovery) and a copy button.
//   THE DOOR   — "playing on a new computer?": type the
//                words, see the worlds they hold, bring one
//                down (it lands as a NEW local save — never
//                over an existing one) or remove it from the
//                cloud (explicit, confirmed — the only cloud
//                delete in the game).
// All box traffic goes through game/cloudSaves.ts, whose
// wrappers never throw: a dead network is a quiet sentence
// here, never a crash. The mirror itself rides the save
// funnel in useSaveSession — this panel never uploads.
// ====================================================================

import React, { useEffect, useState } from 'react';
import { Cloud, Copy, Check, Download, KeyRound, Trash2, X } from 'lucide-react';
import {
  canonicalizePassphrase,
  cloudDeleteSave,
  cloudGetRecord,
  cloudIndex,
  generatePassphrase,
  storePassphrase,
  storedPassphrase,
  CLOUD_LAST_SYNC_KEY,
  type CloudIndexEntry,
} from '../game/cloudSaves';
import type { SavedGameRecord } from '../game/saveSystem';

interface CloudSavesPanelProps {
  /** Lands a downloaded record as a new local save
   *  (useSaveSession's handleImportCloudSave). */
  onImport: (record: SavedGameRecord) => void;
}

function formatWhen(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  return new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const CloudSavesPanel: React.FC<CloudSavesPanelProps> = ({ onImport }) => {
  const [secret, setSecret] = useState<string | null>(() => storedPassphrase());
  const [showWords, setShowWords] = useState(false);
  const [firstReveal, setFirstReveal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [doorOpen, setDoorOpen] = useState(false);
  const [doorInput, setDoorInput] = useState('');
  const [listSecret, setListSecret] = useState<string | null>(null);
  const [entries, setEntries] = useState<CloudIndexEntry[] | null>(null);
  const [listBusy, setListBusy] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<number | null>(() => {
    try {
      const raw = window.localStorage.getItem(CLOUD_LAST_SYNC_KEY);
      const n = raw ? Number(raw) : NaN;
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch { return null; }
  });

  // The words screen owns its Escape (the house pattern: a
  // modal that can't be closed is a bug report waiting).
  useEffect(() => {
    if (!showWords) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowWords(false); };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [showWords]);

  const loadList = async (forSecret: string) => {
    setListBusy(true);
    setListError(null);
    setConfirmRemove(null);
    const list = await cloudIndex(forSecret);
    setListBusy(false);
    if (list === null) {
      setEntries(null);
      setListError("Couldn't reach the cloud box — check your connection and try again.");
      return;
    }
    setListSecret(forSecret);
    setEntries(list);
  };

  const turnOn = () => {
    const words = generatePassphrase();
    storePassphrase(words);
    setSecret(words);
    setFirstReveal(true);
    setCopied(false);
    setShowWords(true);
  };

  const turnOff = () => {
    storePassphrase(null);
    setSecret(null);
    setDoorOpen(false);
    setEntries(null);
    setListSecret(null);
    setNote('Cloud saves are off on this device. The copies already in the box stay there — turning off only forgets the words here.');
  };

  const findWorlds = () => {
    const canon = canonicalizePassphrase(doorInput);
    if (!canon) {
      setEntries(null);
      setListError('That isn\'t three words — your passphrase is exactly three plain words, like "maple otter brook".');
      return;
    }
    void loadList(canon);
  };

  const bringHere = async (entry: CloudIndexEntry) => {
    if (!listSecret) return;
    setNote(null);
    const record = await cloudGetRecord(listSecret, entry.slot);
    if (!record) {
      setNote('That world wouldn\'t come down — the box may be busy. Try again in a moment.');
      return;
    }
    onImport(record);
    setNote(`"${entry.name}" is in your list below now — a fresh copy, landed beside your worlds here.`);
  };

  const removeFromCloud = async (entry: CloudIndexEntry) => {
    if (confirmRemove !== entry.slot) { setConfirmRemove(entry.slot); return; }
    if (!listSecret) return;
    const ok = await cloudDeleteSave(listSecret, entry.slot);
    setConfirmRemove(null);
    if (ok) {
      setNote(`"${entry.name}" is out of the cloud. The copy on its home device is untouched.`);
      void loadList(listSecret);
    } else {
      setNote('The box didn\'t answer — that world is still in the cloud.');
    }
  };

  const copyWords = () => {
    if (!secret) return;
    try {
      void navigator.clipboard?.writeText(secret);
      setCopied(true);
    } catch { setCopied(false); }
  };

  return (
    <div className="p-4 rounded-2xl bg-slate-900/60 border border-sky-900/60">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[11px] font-tech text-sky-300 uppercase tracking-wider flex items-center gap-1.5">
            <Cloud className="w-3.5 h-3.5" /> Cloud Saves
          </h3>
          {secret ? (
            <p className="text-xs text-slate-400 mt-1">
              On — every world you save on this device also sends a copy up, under your three words.
              The save on this device stays the real one; the cloud is its mirror.
              {lastSync && <> Last copy up: {formatWhen(new Date(lastSync).toISOString())}.</>}
            </p>
          ) : (
            <p className="text-xs text-slate-400 mt-1">
              Off — your worlds live only on this device. Turn it on and a copy of each save
              follows three words you choose, so your worlds can meet you on another computer.
            </p>
          )}
          {note && <p className="text-xs text-sky-200 mt-2">{note}</p>}
        </div>
        <div className="flex flex-col gap-2 shrink-0">
          {secret ? (
            <>
              <button
                onClick={() => { setFirstReveal(false); setCopied(false); setShowWords(true); }}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-tech font-bold flex items-center gap-1.5 transition-colors"
              >
                <KeyRound className="w-3.5 h-3.5" /> MY WORDS
              </button>
              <button
                onClick={turnOff}
                className="px-3 py-1.5 rounded-xl bg-slate-800/60 hover:bg-slate-700 text-slate-400 text-xs font-tech flex items-center justify-center transition-colors"
              >
                TURN OFF
              </button>
            </>
          ) : (
            <button
              onClick={turnOn}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 text-xs font-tech font-bold flex items-center gap-1.5 active:scale-95 transition-all"
            >
              <Cloud className="w-3.5 h-3.5" /> TURN ON
            </button>
          )}
        </div>
      </div>

      {/* The door: worlds under words, yours or typed. */}
      <div className="mt-3 pt-3 border-t border-slate-800">
        {!doorOpen ? (
          <button
            onClick={() => {
              setDoorOpen(true);
              setNote(null);
              if (secret) void loadList(secret);
            }}
            className="text-xs font-tech text-sky-300 hover:text-sky-200 transition-colors"
          >
            {secret ? 'SEE MY CLOUD WORLDS ↓' : 'PLAYING ON A NEW COMPUTER? ENTER YOUR WORDS ↓'}
          </button>
        ) : (
          <div>
            {!secret && (
              <div className="flex items-center gap-2">
                <input
                  value={doorInput}
                  onChange={(e) => setDoorInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') findWorlds(); }}
                  placeholder="your three words — like maple otter brook"
                  className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-slate-950/70 border border-slate-700 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-sky-500"
                />
                <button
                  onClick={findWorlds}
                  disabled={listBusy}
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-tech font-bold disabled:opacity-50 transition-colors"
                >
                  FIND MY WORLDS
                </button>
              </div>
            )}
            {listBusy && <p className="text-xs text-slate-500 mt-2">Asking the box…</p>}
            {listError && <p className="text-xs text-amber-300 mt-2">{listError}</p>}
            {entries && !listBusy && (
              entries.length === 0 ? (
                <p className="text-xs text-slate-500 mt-2">No worlds under those words yet — a world appears here after its home device saves with cloud saves on.</p>
              ) : (
                <div className="space-y-2 mt-2">
                  {entries.map((entry) => (
                    <div key={entry.slot} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/50 border border-slate-800">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-slate-100 truncate">{entry.name || 'Unnamed World'}</div>
                        <div className="text-[11px] text-slate-400">
                          Saved up {formatWhen(entry.updatedAt)}
                          {entry.seed && <> · Seed {entry.seed}</>}
                          <> · {Math.max(1, Math.round(entry.size / 1024))} KB</>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => void bringHere(entry)}
                          title="Bring this world down to this device (lands as a new save)"
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-tech font-bold flex items-center gap-1.5 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" /> BRING HERE
                        </button>
                        <button
                          onClick={() => void removeFromCloud(entry)}
                          title="Remove this world from the cloud (the copy on its home device is untouched)"
                          className={
                            confirmRemove === entry.slot
                              ? 'px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-tech font-bold transition-all'
                              : 'p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors'
                          }
                        >
                          {confirmRemove === entry.slot ? 'CONFIRM?' : <Trash2 className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
            <button
              onClick={() => setDoorOpen(false)}
              className="text-[11px] font-tech text-slate-500 hover:text-slate-300 mt-2 transition-colors"
            >
              CLOSE ↑
            </button>
          </div>
        )}
      </div>

      {/* The words screen. */}
      {showWords && secret && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4"
          style={{ pointerEvents: 'auto' }}
          onClick={() => setShowWords(false)}
        >
          <div
            className="w-full max-w-md p-6 rounded-3xl bg-slate-900 border border-sky-900/70 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h3 className="text-sm font-tech font-bold text-sky-200 tracking-wider flex items-center gap-2">
                <KeyRound className="w-4 h-4" /> YOUR THREE WORDS
              </h3>
              <button onClick={() => setShowWords(false)} className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors" title="Close">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="flex items-stretch justify-center gap-2 my-5">
              {secret.split(' ').map((word) => (
                <span key={word} className="px-4 py-3 rounded-2xl bg-slate-950 border border-sky-800 text-xl font-tech font-bold text-sky-100 tracking-wide">
                  {word}
                </span>
              ))}
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              These three words are the <strong>only key</strong> to your cloud saves — there is no
              account and no password reset. Write them down somewhere safe. If the words are lost,
              the cloud copies are lost with them — but the saves on this computer are never
              affected, whatever happens to the words.
            </p>
            <div className="flex gap-2 mt-5">
              <button
                onClick={copyWords}
                className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 text-xs font-tech font-bold flex items-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'COPIED' : 'COPY WORDS'}
              </button>
              <button
                onClick={() => setShowWords(false)}
                className="flex-1 px-3 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-cyan-400 hover:from-sky-400 hover:to-cyan-300 text-slate-950 text-xs font-tech font-bold active:scale-95 transition-all"
              >
                {firstReveal ? "I'VE WRITTEN THEM DOWN" : 'CLOSE'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
