/**
 * PlanterModal — the Planter's panel (BioForge wave 2, slice 5, 2026-10-19).
 *
 * "A plant with an address." Two faces, all rules in
 * game/structures/planter.ts:
 * EMPTY — a propagule picker: every DISTINCT propagule item in the
 *   pouch that names a species (propagation.ts is the only truth;
 *   wild-only species can never appear). Click plants it: one
 *   propagule consumed, the tenant moves in as a seedling.
 * PLANTED — the tenant's name and growth, and "take the plant
 *   back": the propagule returns to the pouch (seed species give
 *   their seed, piece species their piece — the take-back rule),
 *   and the pot stands empty again.
 *
 * The panel only renders and reports clicks; every law lives in
 * the module and the App-side handlers.
 */

import React from 'react';
import { X, Plus, Undo2, Sprout } from 'lucide-react';
import type { ItemId, StructureEntity } from '../types/game';
import { ITEMS } from '../game/items/constants';
import { floraDef } from '../game/flora/flora';
import { propaguleItemOf } from '../game/flora/propagation';
import {
  readPlanter,
  plantablePropagules,
  planterGrowthEffective,
  planterGrowthLabel,
} from '../game/structures/planter';

interface PlanterModalProps {
  /** The planter being viewed (live entity from the structures list). */
  structure: StructureEntity;
  inventory: Record<ItemId, number>;
  onClose: () => void;
  onPlant: (structure: StructureEntity, itemId: ItemId) => void;
  onTake: (structure: StructureEntity) => void;
}

export function PlanterModal(props: PlanterModalProps) {
  const { structure, inventory, onClose, onPlant, onTake } = props;
  // A cosmetic heartbeat while the panel stands open (1 s): the
  // game no longer ticks growth into the record — reads are
  // pure-effective from the timestamp law — so the panel re-reads
  // it itself. This timer writes nothing and dies with the modal.
  const [, setUiTick] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setUiTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const planter = readPlanter(structure);
  // Effective, not stored: the tenant may have grown while its
  // zone was unloaded (the timestamp law) — the record holds only
  // the base.
  const growthNow = planter.species ? planterGrowthEffective(planter, Date.now()) : 0;
  const plantable = plantablePropagules(inventory);
  const tenantName = planter.species ? floraDef(planter.species)?.name ?? planter.species : null;
  const tenantBack = planter.species ? propaguleItemOf(planter.species) : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg max-h-[94dvh] overflow-y-auto rounded-xl border border-lime-800 bg-[#101408] p-5 text-lime-50 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-wide">The Planter</h2>
            <p className="text-xs text-lime-300/80">
              A plant with an address — one tenant, grown where you put it.
            </p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-lime-300 hover:bg-lime-900/50" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {planter.species === null ? (
          <>
            {/* The empty pot: the propagule picker. */}
            <div className="mt-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-lime-400/70">
                Plant something
              </p>
              {plantable.length === 0 ? (
                <p className="text-sm text-lime-200/60">
                  No planting stock in the pouch. Seeds gather from the glove&apos;s harvest; pieces come
                  from the wild plants that wouldn&apos;t seed.
                </p>
              ) : (
                <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                  {plantable.map((id) => (
                    <button
                      key={id}
                      onClick={() => onPlant(structure, id)}
                      className="inline-flex items-center gap-1 rounded-full border border-lime-800 bg-lime-950/60 px-2 py-1 text-xs hover:border-lime-500"
                      title={ITEMS[id]?.description}
                    >
                      <Plus size={12} />
                      {ITEMS[id]?.name ?? id} ×{inventory[id]}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] italic text-lime-300/50">
              One plant per pot. It grows where it stands, over about a day&apos;s turning.
            </p>
          </>
        ) : (
          <>
            {/* The tenant, at home. */}
            <div className="mt-3 rounded-lg border border-lime-900/60 bg-lime-950/30 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-lime-100">
                <Sprout size={14} className="text-lime-400" />
                {tenantName}
              </p>
              <p className="mt-1 text-xs text-lime-200/70">{planterGrowthLabel(growthNow)}</p>
              <div className="mt-2">
                <button
                  onClick={() => onTake(structure)}
                  className="inline-flex items-center gap-1.5 rounded border border-lime-700 bg-lime-900/50 px-3 py-1.5 text-xs font-semibold text-lime-100 hover:border-lime-400"
                >
                  <Undo2 size={12} />
                  Take the plant back
                  {tenantBack ? ` (${ITEMS[tenantBack]?.name ?? tenantBack})` : ''}
                </button>
              </div>
            </div>
            <p className="mt-2 text-[11px] italic text-lime-300/50">
              Taking it returns its propagule whole — seed for seed-bearers, a living piece for the
              rest. The pot stands empty, ready for the next address.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
