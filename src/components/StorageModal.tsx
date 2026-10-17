/**
 * StorageModal — a placed storage pod's panel (Adam, 2026-10-15).
 *
 * Two columns: what the POD holds (click a stack to take it back,
 * as much as your pouch has room for) and what your POUCH holds
 * (click a stack to stash it, as much as the pod has room for).
 * One click moves a whole stack-or-what-fits — no drag, no count
 * dialogs, phone-friendly. The header carries the pod's tier and
 * the upgrade button: owning the next growth kit enables it, and
 * applying it raises the pod in place, contents preserved.
 *
 * All the rules live in game/items/pouch.ts (STORAGE_TIERS); this panel
 * only renders them and reports clicks through callbacks.
 */

import React from 'react';
import { X, Package, ArrowDownToLine, ArrowUpFromLine, Sprout, Move } from 'lucide-react';
import type { ItemId, StructureEntity } from '../types/game';
import { ITEMS } from '../game/items/constants';
import { STORAGE_TIERS, storageCapsFor, storageKitFor, storageSlotsUsed, type StorageContents } from '../game/items/pouch';
import { isSampleItem } from '../game/structures/vat';
import { isSlottedUpgrade } from '../game/items/slottedUpgrades';

interface StorageModalProps {
  /** The pod being viewed (live entity from the structures list). */
  structure: StructureEntity;
  inventory: Record<ItemId, number>;
  /** The player's pouch stack cap today (for "what fits" notes). */
  pouchCap: number;
  onClose: () => void;
  onDeposit: (structure: StructureEntity, itemId: ItemId) => void;
  onWithdraw: (structure: StructureEntity, itemId: ItemId) => void;
  onUpgrade: (structure: StructureEntity) => void;
  /**
   * S6 Movable Vaults: lift the WHOLE container — tier, contents in
   * their exact slots — and carry it. Optional so the panel renders
   * standalone without the carry wired.
   */
  onMove?: (structure: StructureEntity) => void;
}

export const StorageModal: React.FC<StorageModalProps> = ({
  structure,
  inventory,
  pouchCap,
  onClose,
  onDeposit,
  onWithdraw,
  onUpgrade,
  onMove,
}) => {
  const contents: StorageContents = structure.storage ?? { tier: 1, items: {} };
  const tier = Math.min(Math.max(contents.tier, 1), STORAGE_TIERS.length);
  // Capacity by KIND (slice D, 2026-10-16): pods read the tier
  // table; the Sample Rack reads its own shelf row — and racks
  // never deepen, so no next tier and no kit, ever.
  const caps = storageCapsFor(structure.type, tier);
  const nextCaps = structure.type === 'storage_pod' && tier < STORAGE_TIERS.length ? STORAGE_TIERS[tier] : null;
  const kitId = structure.type === 'storage_pod' ? storageKitFor(tier) : null;
  const hasKit = kitId ? (inventory[kitId] ?? 0) > 0 : false;

  const storedEntries = (Object.entries(contents.items) as [ItemId, number][])
    .filter(([, count]) => count > 0)
    .sort(([a], [b]) => (ITEMS[a]?.name ?? a).localeCompare(ITEMS[b]?.name ?? b));
  // Slotted upgrades (gauntlet modules, helmet lenses,
  // Quicksteps growths, pouch tiers) ride their gear and are
  // never offered for stashing — Adam, 2026-10-17. They are
  // counted separately so the panel can SAY why they are
  // missing instead of the pouch looking emptier than it is.
  const slottedHeld = (Object.entries(inventory) as [ItemId, number][])
    .filter(([id, count]) => count > 0 && ITEMS[id] && isSlottedUpgrade(id)).length;
  const pouchEntries = (Object.entries(inventory) as [ItemId, number][])
    .filter(([id, count]) => count > 0 && ITEMS[id])
    .filter(([id]) => !isSlottedUpgrade(id))
    .filter(([id]) => structure.type !== 'sample_rack' || isSampleItem(id))
    .sort(([a], [b]) => (ITEMS[a]?.name ?? a).localeCompare(ITEMS[b]?.name ?? b));

  const stackRow = (
    itemId: ItemId,
    count: number,
    action: 'deposit' | 'withdraw',
  ) => {
    const item = ITEMS[itemId];
    if (!item) return null;
    const roomNote =
      action === 'withdraw'
        ? `pouch holds ${pouchCap}`
        : `pod takes ${caps.perStack}/stack`;
    return (
      <button
        key={`${action}-${itemId}`}
        onClick={() => (action === 'deposit' ? onDeposit(structure, itemId) : onWithdraw(structure, itemId))}
        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl border border-slate-800/70 bg-slate-900/50 hover:bg-slate-800/50 hover:border-amber-500/40 transition-all text-left"
        title={action === 'deposit' ? 'Stash in the pod' : 'Take back into your pouch'}
      >
        <span
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: `${item.color}20`, border: `1px solid ${item.color}50`, color: item.color }}
        >
          <Package className="w-4 h-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-xs font-semibold text-slate-200 truncate">{item.name}</span>
          <span className="block text-[10px] text-slate-500">{roomNote}</span>
        </span>
        <span className="font-mono text-xs font-bold text-slate-300">×{count}</span>
        {action === 'deposit' ? (
          <ArrowDownToLine className="w-4 h-4 text-amber-400 shrink-0" />
        ) : (
          <ArrowUpFromLine className="w-4 h-4 text-emerald-400 shrink-0" />
        )}
      </button>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-slate-800 bg-slate-950/95 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-950/70 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">{caps.name.toUpperCase()}</h2>
              <p className="text-xs text-slate-400">
                {storageSlotsUsed(contents)} of {caps.slots} kinds stored · up to {caps.perStack} each
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        {/* S6 Movable Vaults: the gentle verb — lift the whole pod or
            rack (contents in their exact slots, tier intact) and carry
            it. While carrying, the whole kit is inert: tool-less and
            defenseless for the haul. */}
        {onMove && (
          <div className="px-6 py-2.5 border-b border-slate-800/70 bg-slate-900/30 flex items-center gap-3">
            <Move className="w-4 h-4 text-purple-400 shrink-0" />
            <p className="flex-1 text-xs text-slate-400">
              Carry this {structure.type === 'sample_rack' ? 'rack' : 'pod'} somewhere better — everything inside rides along.
            </p>
            <button
              onClick={() => onMove(structure)}
              className="px-3.5 py-1.5 rounded-xl text-xs font-medium font-tech bg-purple-500/20 text-purple-300 border border-purple-500/40 hover:bg-purple-500/30 transition-all"
            >
              Move
            </button>
          </div>
        )}

        {/* Upgrade strip */}
        {nextCaps && (
          <div className="px-6 py-3 border-b border-slate-800/70 bg-slate-900/30 flex items-center gap-3">
            <Sprout className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="flex-1 text-xs text-slate-400">
              Grow into a <span className="text-slate-200 font-semibold">{nextCaps.name}</span> — {nextCaps.slots} kinds,{' '}
              {nextCaps.perStack} each.
              {!hasKit && kitId && (
                <span className="text-slate-500"> Needs a {ITEMS[kitId]?.name} in your pouch (craft it at the Bio-Forge).</span>
              )}
            </p>
            <button
              onClick={() => onUpgrade(structure)}
              disabled={!hasKit}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium font-tech transition-all ${
                hasKit
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-600 border border-slate-800 cursor-not-allowed'
              }`}
            >
              Apply Kit
            </button>
          </div>
        )}

        {/* Two columns */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-slate-800/80 overflow-hidden">
          <div className="overflow-y-auto p-4">
            <h3 className="text-[11px] font-tech font-bold text-amber-300/90 tracking-wider mb-2">IN THE POD — TAP TO TAKE</h3>
            {storedEntries.length === 0 ? (
              <p className="text-xs text-slate-500">The pod is empty. Stash something from your pouch.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {storedEntries.map(([id, count]) => stackRow(id, count, 'withdraw'))}
              </div>
            )}
          </div>
          <div className="overflow-y-auto p-4">
            <h3 className="text-[11px] font-tech font-bold text-emerald-300/90 tracking-wider mb-2">IN YOUR POUCH — TAP TO STASH</h3>
            {pouchEntries.length === 0 ? (
              <p className="text-xs text-slate-500">
                {slottedHeld > 0
                  ? 'Nothing stashable — everything else you carry is slotted into your gear.'
                  : 'Your pouch is empty.'}
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {pouchEntries.map(([id, count]) => stackRow(id, count, 'deposit'))}
              </div>
            )}
            {slottedHeld > 0 && (
              <p className="text-[10px] text-slate-600 mt-2">
                {slottedHeld} slotted upgrade{slottedHeld === 1 ? '' : 's'} ride your gear — grown in, never stashed.
              </p>
            )}
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/40">
          <p className="text-[11px] text-slate-500">
            Dissolving a pod with the Solvent Sprayer spills everything inside at its feet — nothing stored is ever lost.
          </p>
        </div>
      </div>
    </div>
  );
};
