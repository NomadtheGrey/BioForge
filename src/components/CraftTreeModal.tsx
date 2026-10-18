// ============================================================================
// THE CRAFTING TREE MODAL (Adam, 2026-10-17)
// ----------------------------------------------------------------------------
// Opened from a forge ingredient row's "?" — the full answer to
// "what would it take to have this?": the whole recipe tree under
// the item, every level marked with what the pouch already holds
// and what is still missing, the raw leaves carrying their
// where-to-find lines, and a footer with the netted
// still-to-gather list (shared materials counted once — the
// math lives in game/items/craftingTree.ts and is lab-checked).
// Pure props: the forge modal owns the open state.
// ============================================================================

import React, { useMemo } from 'react';
import { X, Check, AlertCircle, Hammer, Leaf } from 'lucide-react';
import type { ItemId } from '../types/game';
import { ITEMS } from '../game/items/constants';
import { buildCraftPlan, itemSources, type CraftTreeNode } from '../game/items/craftingTree';

interface CraftTreeModalProps {
  /** The item the tree is rooted at (null = closed). */
  itemId: ItemId | null;
  /** How many of it the parent recipe needs. */
  need: number;
  inventory: Partial<Record<ItemId, number>>;
  onClose: () => void;
}

const NodeRow: React.FC<{ node: CraftTreeNode; depth: number }> = ({ node, depth }) => {
  const item = ITEMS[node.itemId];
  const ready = node.shortfall <= 0;
  const sources = !node.recipe && node.shortfall > 0 ? itemSources(node.itemId) : [];
  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 pr-2"
        style={{ paddingLeft: `${depth * 18 + 8}px` }}
      >
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item?.color ?? '#94a3b8' }} />
        <span className="text-xs font-medium text-slate-200">{item?.name ?? node.itemId}</span>
        <span className="text-[10px] font-mono text-slate-400">× {node.need}</span>
        {ready ? (
          <span className="flex items-center gap-1 text-[10px] font-tech font-bold text-emerald-300">
            <Check className="w-3 h-3" /> {node.fromPouch >= node.need ? 'in your pouch' : 'covered'}
          </span>
        ) : node.recipe ? (
          <span className="flex items-center gap-1 text-[10px] font-tech font-bold text-cyan-300">
            <Hammer className="w-3 h-3" /> grow ×{node.batches} at the Forge
          </span>
        ) : (
          <span className="flex items-center gap-1 text-[10px] font-tech font-bold text-red-300">
            <AlertCircle className="w-3 h-3" /> find {node.shortfall} more
          </span>
        )}
      </div>
      {sources.map((line) => (
        <p key={line} className="text-[11px] text-slate-400 leading-snug" style={{ paddingLeft: `${depth * 18 + 26}px` }}>
          <Leaf className="w-3 h-3 inline mr-1 text-emerald-400/70" />
          {line}
        </p>
      ))}
      {node.children.map((child) => (
        <NodeRow key={child.itemId} node={child} depth={depth + 1} />
      ))}
    </div>
  );
};

export const CraftTreeModal: React.FC<CraftTreeModalProps> = ({ itemId, need, inventory, onClose }) => {
  const plan = useMemo(
    () => (itemId ? buildCraftPlan(itemId, Math.max(1, need), inventory) : null),
    [itemId, need, inventory]
  );
  if (!itemId || !plan) return null;
  const rootItem = ITEMS[itemId];

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="glass-panel rounded-3xl w-full max-w-lg max-h-[85dvh] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 pb-3">
          <div>
            <p className="text-[10px] font-tech font-bold tracking-widest text-cyan-300/80">THE CRAFTING TREE</p>
            <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2 mt-0.5">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: rootItem?.color ?? '#94a3b8' }} />
              {rootItem?.name ?? itemId}
              <span className="text-xs font-mono font-medium text-slate-400">× {Math.max(1, need)}</span>
            </h3>
            <p className="text-[11px] text-slate-400 mt-1">
              Everything it takes, level by level — what you hold, what to grow, what to go and find.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/70 transition-colors" aria-label="Close crafting tree">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-3 pb-2">
          <NodeRow node={plan.root} depth={0} />
        </div>

        <div className="border-t border-slate-700/50 p-4">
          {plan.rawNeeds.length === 0 ? (
            <p className="text-xs text-emerald-300 font-medium flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5" /> You hold everything this takes — the rest is growing.
            </p>
          ) : (
            <>
              <p className="text-[10px] font-tech font-bold tracking-widest text-slate-400 mb-2">STILL TO GATHER</p>
              <div className="flex flex-wrap gap-1.5">
                {plan.rawNeeds.map(({ itemId: rid, count }) => (
                  <span key={rid} className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-red-950/30 border border-red-900/40 text-red-200">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ITEMS[rid]?.color ?? '#94a3b8' }} />
                    {ITEMS[rid]?.name ?? rid} × {count}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
