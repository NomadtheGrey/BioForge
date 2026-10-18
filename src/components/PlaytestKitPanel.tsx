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

  const itemRows = useMemo(() => filterSearchRows(ITEM_ROWS, itemQuery), [itemQuery]);
  const speciesRows = useMemo(() => filterSearchRows(SPECIES_ROWS, speciesQuery), [speciesQuery]);

  const clampCount = (n: number) => Math.max(1, Math.min(999, Math.floor(n) || 1));

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
    </div>
  );
}
