/**
 * PlaytestKitPanel — the PLAYTEST KIT (Adam, 2026-10-17):
 * the debug backquote grows from a pouch swap into a small
 * debug panel. Debug arranges situations for testing; it is
 * NOT a cheat console — no god mode, no stat editing, no
 * quest/director/save manipulation. Every control reaches a
 * REAL seam: items through addInventoryItem, spawns through
 * the sim's own fauna path (a debug spawn is stamped exactly
 * like a natural deal), time through the world clock, the
 * shower through the sky calendar's own event path.
 *
 * Layout: a standalone fixed panel (deliberately NOT in
 * HUD_PANELS — the kit stays out of the per-device layout
 * persistence and opens even while panels are hidden).
 * Opens/closes on Backquote (App), Esc closes from here.
 * Fully tappable: pointer-events-auto, real buttons.
 *
 * Registry data is imported directly (ITEMS, SPECIES);
 * only ACTIONS travel through props.
 */

import { useEffect, useMemo, useState } from 'react';
import type { FaunaSpecies, ItemId } from '../types/game';
import { ITEMS } from '../game/items/constants';
import { SPECIES } from '../game/creatures/species';
import { filterSearchRows, type SearchRow } from './playtestSearch';
import {
  kitUnlocks,
  loadKitRemembered,
  publishBroadcast,
  saveKitRemembered,
  type BroadcastDraft,
} from './kitLock';

export interface PlaytestKitPanelProps {
  /** True while the debug kit holds the pouch (useDebugKit). */
  kitSwapped: boolean;
  onClose: () => void;
  /** The old one-press pouch flip, now living one click
   *  from where it used to be (dev lane, 2026-10-17). */
  onToggleKit: () => void;
  onGive: (itemId: ItemId, count: number) => void;
  onSpawn: (species: FaunaSpecies) => void;
  /** World-clock phase: 0.5 = midday, 0.0 = midnight. */
  onSetPhase: (phase: number) => void;
  onCallShower: () => void;
  onHeal: () => void;
}

const ITEM_ROWS: SearchRow[] = Object.values(ITEMS).map((def) => ({
  id: def.id,
  name: def.name,
}));
const SPECIES_ROWS: SearchRow[] = Object.values(SPECIES).map((def) => ({
  id: def.id,
  name: def.name,
}));

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-emerald-900/60 pt-2 first:border-t-0 first:pt-0">
      <div className="text-[11px] font-bold uppercase tracking-widest text-emerald-300/80 mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-md border border-emerald-900 bg-black/40 px-2 py-1.5 text-sm text-stone-200 placeholder:text-stone-600 outline-none focus:border-emerald-600"
    />
  );
}

function RowButton({ label, sub, onClick, active }: { label: string; sub?: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md px-2 py-1 text-sm transition-colors ${
        active ? 'bg-emerald-800/60 text-emerald-100' : 'text-stone-300 hover:bg-emerald-950/60 hover:text-emerald-100'
      }`}
    >
      <span className="block truncate">{label}</span>
      {sub && <span className="block truncate text-[11px] text-stone-500">{sub}</span>}
    </button>
  );
}

export function PlaytestKitPanel(props: PlaytestKitPanelProps) {
  const { kitSwapped, onClose, onToggleKit, onGive, onSpawn, onSetPhase, onCallShower, onHeal } = props;

  // Esc closes the panel — its own listener, like the
  // other modals; Backquote toggles it from App's input
  // layer (its INPUT-focus guard already keeps typing safe).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const [itemQuery, setItemQuery] = useState('');
  const [giveCount, setGiveCount] = useState(1);
  const [selectedItem, setSelectedItem] = useState<ItemId | null>(null);
  const [speciesQuery, setSpeciesQuery] = useState('');

  // THE LOCK + THE SYSTEM TAB (slice 4, Adam 2026-10-18).
  // Session-only by default; a remembered device skips the
  // prompt (a convenience flag — kitLock.ts is honest about
  // what it is and is not). The publish code is never
  // stored: sessionCode carries THIS session's typed unlock
  // to the composer as a prefill, nothing persists it.
  const [tab, setTab] = useState<'kit' | 'system'>('kit');
  const [unlocked, setUnlocked] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && loadKitRemembered(localStorage)
  );
  const [codeInput, setCodeInput] = useState('');
  const [remember, setRemember] = useState<boolean>(
    () => typeof localStorage !== 'undefined' && loadKitRemembered(localStorage)
  );
  const [unlockError, setUnlockError] = useState(false);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [draftPriority, setDraftPriority] = useState<BroadcastDraft['priority']>('panel');
  const [publishCode, setPublishCode] = useState('');
  const [publishStatus, setPublishStatus] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const tryUnlock = () => {
    if (kitUnlocks(codeInput)) {
      setUnlocked(true);
      setSessionCode(codeInput);
      setCodeInput('');
      setUnlockError(false);
      if (typeof localStorage !== 'undefined') saveKitRemembered(localStorage, remember);
    } else {
      setUnlockError(true);
    }
  };

  const handleSend = async () => {
    const code = publishCode.trim() || sessionCode || '';
    if (!draftTitle.trim() || !draftBody.trim()) {
      setPublishStatus('A broadcast needs a title and a body.');
      return;
    }
    if (!code) {
      setPublishStatus('Type the publish code — the feed checks it on its side.');
      return;
    }
    setSending(true);
    setPublishStatus('Sending…');
    const result = await publishBroadcast(code, {
      title: draftTitle,
      body: draftBody,
      priority: draftPriority,
    });
    setSending(false);
    if (result.ok) {
      setPublishStatus(`Sent — the feed carries it now (${result.id}). Players meet it within a minute or two.`);
      setDraftTitle('');
      setDraftBody('');
    } else {
      setPublishStatus(result.error);
    }
  };

  const itemRows = useMemo(() => filterSearchRows(ITEM_ROWS, itemQuery), [itemQuery]);
  const speciesRows = useMemo(() => filterSearchRows(SPECIES_ROWS, speciesQuery), [speciesQuery]);

  const clampCount = (n: number) => Math.max(1, Math.min(999, Math.floor(n) || 1));

  // THE LOCKED FACE. A courtesy screen for shared machines
  // (kitLock.ts carries the honest framing); the kit behind
  // it is unchanged. Enter submits, like every door.
  if (!unlocked) {
    return (
      <div className="pointer-events-auto fixed right-4 top-24 z-50 w-[21rem] rounded-2xl border border-emerald-900 bg-[#0c1210]/95 p-4 text-stone-200 shadow-2xl backdrop-blur">
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-bold uppercase tracking-widest text-emerald-300">Playtest Kit</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-0.5 text-lg leading-none text-stone-400 hover:bg-emerald-950 hover:text-stone-100"
            aria-label="Close Playtest Kit"
          >
            ×
          </button>
        </div>
        <p className="text-sm text-stone-400">This kit is locked. Type the dev code to open it.</p>
        <form
          className="mt-3 space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            tryUnlock();
          }}
        >
          <input
            type="password"
            value={codeInput}
            onChange={(e) => {
              setCodeInput(e.target.value);
              setUnlockError(false);
            }}
            placeholder="Dev code"
            autoFocus
            className="w-full rounded-md border border-emerald-900 bg-black/40 px-2 py-1.5 text-sm text-stone-200 placeholder:text-stone-600 outline-none focus:border-emerald-600"
          />
          {unlockError && <p className="text-[11px] text-rose-300">That code doesn't open it.</p>}
          <label className="flex items-center gap-2 text-[11px] text-stone-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-emerald-600"
            />
            Remember this device (skips the prompt here; the publish code is still typed per send)
          </label>
          <button
            type="submit"
            className="w-full rounded-md bg-emerald-800/70 px-2 py-1.5 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-700/70"
          >
            Unlock
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="pointer-events-auto fixed right-4 top-24 z-50 w-[21rem] max-h-[78vh] overflow-y-auto rounded-2xl border border-emerald-900 bg-[#0c1210]/95 p-4 text-stone-200 shadow-2xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-bold uppercase tracking-widest text-emerald-300">Playtest Kit</div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-0.5 text-lg leading-none text-stone-400 hover:bg-emerald-950 hover:text-stone-100"
          aria-label="Close Playtest Kit"
        >
          ×
        </button>
      </div>

      {/* Tabs (slice 4): the kit proper, and the System tab —
          the broadcast composer + the kit-access controls. */}
      <div className="mb-3 flex gap-1.5">
        {(
          [
            ['kit', 'Kit'],
            ['system', 'System'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`flex-1 rounded-md px-2 py-1 text-xs font-bold uppercase tracking-widest transition-colors ${
              tab === id ? 'bg-emerald-800/70 text-emerald-100' : 'bg-stone-800/60 text-stone-400 hover:text-stone-200'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'kit' ? (
      <div className="space-y-3">
        {/* THE KIT SWAP (dev lane, 2026-10-17): the old
          one-press pouch flip lives first, directly under
          the title, so the muscle memory lands one click
          from where it used to be. */}
        <Section title="Debug Kit">
          <button
            type="button"
            onClick={onToggleKit}
            className={`w-full rounded-md px-2 py-1.5 text-sm font-semibold transition-colors ${
              kitSwapped ? 'bg-emerald-800/70 text-emerald-100 hover:bg-emerald-700/70' : 'bg-stone-800/70 text-stone-300 hover:bg-stone-700/70'
            }`}
          >
            {kitSwapped ? 'Restore real pouch' : 'Swap in full debug kit'}
          </button>
          <p className="mt-1 text-[11px] text-stone-500">
            {kitSwapped ? 'Saves still record your real pouch, never the kit.' : 'Saves record the real pouch, never the kit.'}
          </p>
        </Section>

        <Section title="Give">
          <SearchInput value={itemQuery} onChange={setItemQuery} placeholder="Search items — name or id…" />
          <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5">
            {itemRows.map((row) => (
              <RowButton
                key={row.id}
                label={row.name}
                sub={row.id}
                active={selectedItem === row.id}
                onClick={() => setSelectedItem(row.id as ItemId)}
              />
            ))}
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            {[1, 10, 50].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setGiveCount(n)}
                className={`rounded-md px-2 py-1 text-xs transition-colors ${giveCount === n ? 'bg-emerald-800/70 text-emerald-100' : 'bg-stone-800/60 text-stone-400 hover:text-stone-200'}`}
              >
                ×{n}
              </button>
            ))}
            <input
              value={String(giveCount)}
              onChange={(e) => setGiveCount(clampCount(Number(e.target.value)))}
              inputMode="numeric"
              className="w-16 rounded-md border border-emerald-900 bg-black/40 px-1.5 py-1 text-center text-sm text-stone-200 outline-none focus:border-emerald-600"
            />
            <button
              type="button"
              disabled={!selectedItem}
              onClick={() => {
                if (selectedItem) onGive(selectedItem, giveCount);
              }}
              className="flex-1 rounded-md bg-emerald-800/70 px-2 py-1 text-sm font-semibold text-emerald-100 transition-colors hover:bg-emerald-700/70 disabled:opacity-40"
            >
              Add
            </button>
          </div>
        </Section>

        <Section title="Spawn">
          <SearchInput value={speciesQuery} onChange={setSpeciesQuery} placeholder="Search species — name or id…" />
          <div className="mt-1.5 max-h-40 overflow-y-auto space-y-0.5">
            {speciesRows.map((row) => (
              <RowButton
                key={row.id}
                label={row.name}
                sub={row.id}
                onClick={() => onSpawn(row.id as FaunaSpecies)}
              />
            ))}
          </div>
          <p className="mt-1 text-[11px] text-stone-500">One tap: one wild individual, 5 m ahead of you.</p>
        </Section>

        <Section title="World">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => onSetPhase(0.5)}
              className="flex-1 rounded-md bg-stone-800/60 px-2 py-1.5 text-sm text-stone-300 transition-colors hover:bg-stone-700/60"
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => onSetPhase(0.0)}
              className="flex-1 rounded-md bg-stone-800/60 px-2 py-1.5 text-sm text-stone-300 transition-colors hover:bg-stone-700/60"
            >
              Night
            </button>
            <button
              type="button"
              onClick={onCallShower}
              className="flex-1 rounded-md bg-indigo-900/60 px-2 py-1.5 text-sm text-indigo-200 transition-colors hover:bg-indigo-800/60"
            >
              Call shower
            </button>
          </div>
          <p className="mt-1 text-[11px] text-stone-500">The shower is the block's own seeded event, dealt tonight.</p>
        </Section>

        <Section title="Vitals">
          <button
            type="button"
            onClick={onHeal}
            className="w-full rounded-md bg-rose-900/50 px-2 py-1.5 text-sm font-semibold text-rose-200 transition-colors hover:bg-rose-800/50"
          >
            Heal full + stamina full
          </button>
          <p className="mt-1 text-[11px] text-stone-500">Through the normal player-state writers. Nothing else is touched.</p>
        </Section>
      </div>
      ) : (
      <div className="space-y-3">
        {/* THE COMPOSER (slice 4): write a broadcast, choose
            its weight, send. The feed Worker's door checks
            the publish code against its own secret — this
            panel holds no key and grants nothing by itself;
            without the door configured, the feed answers so
            and the status line reports it plainly. */}
        <Section title="Broadcast">
          <input
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            placeholder="Title"
            maxLength={120}
            className="w-full rounded-md border border-emerald-900 bg-black/40 px-2 py-1.5 text-sm text-stone-200 placeholder:text-stone-600 outline-none focus:border-emerald-600"
          />
          <textarea
            value={draftBody}
            onChange={(e) => setDraftBody(e.target.value)}
            placeholder="The word itself — player voice, no spoilers."
            maxLength={600}
            rows={4}
            className="mt-1.5 w-full rounded-md border border-emerald-900 bg-black/40 px-2 py-1.5 text-sm text-stone-200 placeholder:text-stone-600 outline-none focus:border-emerald-600"
          />
          <div className="mt-1.5 flex gap-1.5">
            {(
              [
                ['panel', 'Panel — waits in the news'],
                ['notice', 'Notice — also toasts once'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setDraftPriority(id)}
                className={`flex-1 rounded-md px-2 py-1 text-[11px] transition-colors ${
                  draftPriority === id ? 'bg-sky-800/70 text-sky-100' : 'bg-stone-800/60 text-stone-400 hover:text-stone-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="password"
            value={publishCode}
            onChange={(e) => setPublishCode(e.target.value)}
            placeholder={sessionCode ? 'Publish code (your unlock code, unless the feed’s differs)' : 'Publish code'}
            className="mt-1.5 w-full rounded-md border border-emerald-900 bg-black/40 px-2 py-1.5 text-sm text-stone-200 placeholder:text-stone-600 outline-none focus:border-emerald-600"
          />
          <button
            type="button"
            disabled={sending}
            onClick={() => void handleSend()}
            className="mt-1.5 w-full rounded-md bg-sky-800/70 px-2 py-1.5 text-sm font-semibold text-sky-100 transition-colors hover:bg-sky-700/70 disabled:opacity-40"
          >
            {sending ? 'Sending…' : 'Send to every player'}
          </button>
          {publishStatus && <p className="mt-1 text-[11px] text-stone-400">{publishStatus}</p>}
        </Section>

        <Section title="Kit Access">
          <label className="flex items-center gap-2 text-[11px] text-stone-400">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => {
                setRemember(e.target.checked);
                if (typeof localStorage !== 'undefined') saveKitRemembered(localStorage, e.target.checked);
              }}
              className="accent-emerald-600"
            />
            Remember this device
          </label>
          <button
            type="button"
            onClick={() => {
              setUnlocked(false);
              setSessionCode(null);
              setTab('kit');
            }}
            className="mt-1.5 w-full rounded-md bg-stone-800/70 px-2 py-1.5 text-sm text-stone-300 transition-colors hover:bg-stone-700/70"
          >
            Lock the kit
          </button>
          <p className="mt-1 text-[11px] text-stone-500">
            The lock is a courtesy screen for shared machines. The publishing door is the feed's own —
            its code lives in the Worker's settings, never in the game.
          </p>
        </Section>
      </div>
      )}
    </div>
  );
}
