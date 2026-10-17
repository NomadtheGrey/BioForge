/**
 * CarryBanner — the S6 Movable Vaults carry indicator (Adam, 2026-10-17).
 *
 * HUD's read on the carried state: while a vault rides, this banner
 * floats above the hotbar — click/tap the ground to set it down, or
 * back out (right-click / Esc on desktop, this button on touch).
 * Its own component per the APP RULE: App mounts it, nothing more.
 */
import React from 'react';
import type { CarryState } from '../game/structures/movableVaults';
import { ITEMS } from '../game/items/constants';

interface CarryBannerProps {
  /** The live carry (null = not carrying — renders nothing). */
  carrying: CarryState | null;
  /** Right-click / Esc equivalent: restore the vault to its origin. */
  onCancel: () => void;
}

export const CarryBanner: React.FC<CarryBannerProps> = ({ carrying, onCancel }) => {
  if (!carrying) return null;
  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-28 z-40 pointer-events-auto glass-panel px-4 py-2 rounded-2xl flex items-center gap-3 text-xs shadow-xl">
      <span className="font-tech font-bold text-purple-300 tracking-wide">
        CARRYING {(ITEMS[carrying.entity.type]?.name ?? 'Vault').toUpperCase()}
      </span>
      <span className="text-slate-400">click the ground to set it down</span>
      <button
        onClick={onCancel}
        className="px-3 py-1 rounded-xl text-xs font-tech font-bold text-slate-300 border border-slate-600 hover:border-slate-400 hover:text-white transition-colors"
      >
        Cancel
      </button>
    </div>
  );
};
