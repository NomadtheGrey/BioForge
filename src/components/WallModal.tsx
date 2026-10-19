/**
 * WallModal — the Mycologist's Wall's panel (BioForge wave 2, 2026-10-19).
 *
 * Adam's direction: give fungus a purpose — a workplace, not a
 * shelf. Three faces, all rules in game/structures/fungusWall.ts:
 * MOUNTED (the collection, N of 37 kinds, each unmounting to a
 * living cutting), MOUNTABLE (the CAP-kind items you hold, each
 * mounting as one), and THE BIN (the rot crew's compost box:
 * feed fiber, bone, and chitin — harvest compost as it digests).
 *
 * The panel only renders and reports clicks; every law lives in
 * the module and the App-side handlers.
 */

import React from 'react';
import { X, Plus, Minus, Recycle, Sun } from 'lucide-react';
import type { ItemId, StructureEntity } from '../types/game';
import { ITEMS } from '../game/items/constants';
import {
  capKindMembers,
  glowMountCount,
  decomposerMountCount,
  readWall,
  wallBinCatchup,
  WALL_BIN_MAX,
  WALL_BIN_FEED,
  WALL_BIN_HARVEST_COST,
  WALL_DIGEST_SECONDS,
} from '../game/structures/fungusWall';

interface WallModalProps {
  /** The wall being viewed (live entity from the structures list). */
  structure: StructureEntity;
  inventory: Record<ItemId, number>;
  onClose: () => void;
  onMount: (structure: StructureEntity, itemId: ItemId) => void;
  onUnmount: (structure: StructureEntity, itemId: ItemId) => void;
  onFeedBin: (structure: StructureEntity) => void;
  onHarvestBin: (structure: StructureEntity) => void;
}

const FEED_NAMES: Partial<Record<ItemId, string>> = {
  soft_fiber: 'Fiber',
  clean_bone: 'Bone',
  carapace_scale: 'Chitin',
};

export function WallModal(props: WallModalProps) {
  const { structure, inventory, onClose, onMount, onUnmount, onFeedBin, onHarvestBin } = props;
  // A cosmetic heartbeat while the panel stands open (1 s): the
  // game no longer ticks the bin into the record — reads are
  // pure-effective from the timestamp law — so the panel re-reads
  // it itself. This timer writes nothing and dies with the modal.
  const [, setUiTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setUiTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  // Effective, not stored: the crew may have digested while the
  // zone was unloaded (the timestamp law) — the record holds only
  // the base. Mounts are untouched by time.
  const wall = wallBinCatchup(readWall(structure), Date.now());
  const total = capKindMembers().length;
  const mountable = capKindMembers().filter(
    (id) => (inventory[id] ?? 0) > 0 && !wall.mounted.includes(id),
  );
  const feedHeld = WALL_BIN_FEED.reduce((n, id) => n + (inventory[id] ?? 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl border border-emerald-800 bg-[#0c1410] p-5 text-emerald-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-wide">The Mycologist&apos;s Wall</h2>
            <p className="text-xs text-emerald-300/80">
              {wall.mounted.length} of {total} kinds mounted — they stay alive, and they keep working.
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-emerald-300 hover:bg-emerald-900/50" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* The collection. */}
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400/70">Mounted</p>
          {wall.mounted.length === 0 ? (
            <p className="text-sm text-emerald-200/60">Bare lattice, waiting. Mount caps below.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {wall.mounted.map((id) => (
                <span
                  key={id}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-700 bg-emerald-900/40 px-2 py-1 text-xs"
                  title={ITEMS[id]?.description}
                >
                  {ITEMS[id]?.name ?? id}
                  <button
                    onClick={() => onUnmount(structure, id)}
                    className="rounded-full p-0.5 text-emerald-300 hover:bg-emerald-800"
                    aria-label={`Unmount ${ITEMS[id]?.name ?? id}`}
                  >
                    <Minus size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          {wall.mounted.length > 0 && (
            <p className="mt-1 text-xs text-emerald-300/70">
              <Sun size={11} className="mr-1 inline" />
              {glowMountCount(wall.mounted)} glow kind{glowMountCount(wall.mounted) === 1 ? '' : 's'} lighting the camp ·{' '}
              <Recycle size={11} className="mr-1 inline" />
              {decomposerMountCount(wall.mounted)} rot-eater{decomposerMountCount(wall.mounted) === 1 ? '' : 's'} on the bin
            </p>
          )}
        </div>

        {/* Mountable caps. */}
        <div className="mt-3">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-emerald-400/70">Mount a cap</p>
          {mountable.length === 0 ? (
            <p className="text-sm text-emerald-200/60">
              No caps in the pouch. Caps gather from the wild country&apos;s fungi — one of each kind fits this wall.
            </p>
          ) : (
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
              {mountable.map((id) => (
                <button
                  key={id}
                  onClick={() => onMount(structure, id)}
                  className="inline-flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950/60 px-2 py-1 text-xs hover:border-emerald-500"
                  title={ITEMS[id]?.description}
                >
                  <Plus size={12} />
                  {ITEMS[id]?.name ?? id} ×{inventory[id]}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The bin: the rot crew's workplace. */}
        <div className="mt-3 rounded-lg border border-amber-900/60 bg-amber-950/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-400/80">The Bin</p>
          <p className="text-xs text-amber-200/70">
            The decomposer crew eats what nothing else eats — fiber, bone, chitin scrap. Banked: {wall.binStock} of{' '}
            {WALL_BIN_MAX}; ready compost: {wall.binDone}. Each compost costs {WALL_BIN_HARVEST_COST} stock and a little
            patience (one unit digests every {Math.round(WALL_DIGEST_SECONDS / 60)} min per rot-eater on the wall).
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => onFeedBin(structure)}
              disabled={feedHeld === 0 || wall.binStock >= WALL_BIN_MAX}
              className="rounded border border-amber-700 bg-amber-900/50 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:border-amber-400 disabled:opacity-40"
            >
              Feed the bin ({feedHeld} held: {WALL_BIN_FEED.map((id) => FEED_NAMES[id] ?? id).join(' · ')})
            </button>
            <button
              onClick={() => onHarvestBin(structure)}
              disabled={wall.binDone < WALL_BIN_HARVEST_COST}
              className="rounded border border-amber-700 bg-amber-900/50 px-3 py-1.5 text-xs font-semibold text-amber-100 hover:border-amber-400 disabled:opacity-40"
            >
              Harvest compost ({wall.binDone})
            </button>
          </div>
        </div>

        <p className="mt-2 text-[11px] italic text-emerald-300/50">
          Unmounting returns a living cutting — the cap survives, unharmed.
        </p>
      </div>
    </div>
  );
}
