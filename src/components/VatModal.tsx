/**
 * VatModal — a placed Culture Vat's panel (Adam, 2026-10-15).
 *
 * Three faces, one per state of the vat in front of you:
 * RESTING: the samples in your pouch, each with its soup bill
 * and its band — start what's affordable, see plainly what a
 * deeper vat or a missing ingredient stands between you and the
 * rest. WORKING: the growing thing's name and a patience bar.
 * READY: one emerald word — HATCH.
 *
 * All rules live in game/structures/vat.ts; this panel only renders them
 * and reports clicks through callbacks, in the StorageModal
 * shape the game already taught the player.
 */

import React from 'react';
import { X, Sprout, FlaskConical, Egg, ArrowUpCircle } from 'lucide-react';
import type { FaunaSpecies, ItemId, StructureEntity } from '../types/game';
import { ITEMS } from '../game/items/constants';
import { speciesDef } from '../game/creatures/species';
import { VAT_TIER_NAMES, vatKitFor, vatPlanFor, type VatBand } from '../game/structures/vat';

interface VatModalProps {
  /** The vat being viewed (live entity from the structures list). */
  structure: StructureEntity;
  inventory: Record<ItemId, number>;
  onClose: () => void;
  onStart: (structure: StructureEntity, species: FaunaSpecies) => void;
  onHatch: (structure: StructureEntity) => void;
  onUpgrade: (structure: StructureEntity) => void;
}

const BAND_LABEL: Record<VatBand, string> = {
  common: 'Common country',
  wild: 'Wild country',
  strange: 'Strange country',
};

const CYCLE_LABEL: Record<number, string> = {
  250: 'about half a Sol-cycle',
  375: 'about three-quarters of a Sol-cycle',
  500: 'a full Sol-cycle',
};

export const VatModal: React.FC<VatModalProps> = ({
  structure,
  inventory,
  onClose,
  onStart,
  onHatch,
  onUpgrade,
}) => {
  const vat = structure.vat ?? { tier: 1 };
  const tier = Math.min(Math.max(vat.tier, 1), VAT_TIER_NAMES.length);
  const kitId = vatKitFor(tier);
  const hasKit = kitId ? (inventory[kitId] ?? 0) > 0 : false;
  const g = vat.gestating;
  const ready = !!g && g.progress >= g.total;

  // Every species the pouch holds a sample of, band order first.
  const startable = (Object.keys(inventory) as ItemId[])
    .filter((id) => id.startsWith('sample_') && (inventory[id] ?? 0) > 0)
    .map((id) => id.slice('sample_'.length) as FaunaSpecies)
    .filter((species) => speciesDef(species))
    .sort((a, b) => vatPlanFor(a).band.localeCompare(vatPlanFor(b).band));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4" onClick={onClose}>
      <div
        className="glass-panel-biolum w-full max-w-md rounded-3xl border border-emerald-500/40 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: what this vat is, and how deep its culture runs. */}
        <div className="flex items-start justify-between gap-3 border-b border-emerald-500/20 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <FlaskConical className="h-5 w-5 text-emerald-300" />
              <h2 className="font-tech text-sm font-bold tracking-widest text-emerald-200">
                {VAT_TIER_NAMES[tier - 1].toUpperCase()}
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-300">
              {tier === 1 && 'A young culture — common country can grow here.'}
              {tier === 2 && 'A rich culture — the wild country, and anything that hunts.'}
              {tier === 3 && 'A deep, strange culture — even the far country can grow here.'}
            </p>
            {kitId && (
              <button
                onClick={() => onUpgrade(structure)}
                disabled={!hasKit}
                className={`mt-2 flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11px] font-tech font-bold transition-all ${
                  hasKit
                    ? 'border-emerald-400/60 text-emerald-200 hover:scale-105 active:scale-95 cursor-pointer'
                    : 'border-slate-600/50 text-slate-500 cursor-not-allowed'
                }`}
              >
                <ArrowUpCircle className="h-3.5 w-3.5" />
                {hasKit ? `APPLY ${ITEMS[kitId]?.name.toUpperCase()}` : `NEEDS ${ITEMS[kitId]?.name.toUpperCase()}`}
              </button>
            )}
          </div>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:text-white cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto px-5 py-4">
          {/* WORKING / READY face */}
          {g && (
            <div className="flex flex-col items-center gap-3 py-2 text-center">
              <Egg className={`h-10 w-10 ${ready ? 'text-emerald-300 animate-pulse' : 'text-slate-400'}`} />
              <div className="font-tech text-sm font-bold text-slate-100">
                {ready ? `${speciesDef(g.species).name} — ready` : `Growing: ${speciesDef(g.species).name}`}
              </div>
              {!ready && (
                <>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-400/80 transition-all"
                      style={{ width: `${Math.floor((g.progress / g.total) * 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-400">
                    The culture is working. The silhouette inside firms up as it grows — come back when it bobs, ready.
                  </p>
                </>
              )}
              {ready && (
                <button
                  onClick={() => onHatch(structure)}
                  className="mt-1 flex items-center gap-2 rounded-2xl border border-emerald-400/70 bg-emerald-500/20 px-6 py-2.5 font-tech text-sm font-bold text-emerald-200 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                >
                  <Sprout className="h-4 w-4" />
                  HATCH
                </button>
              )}
            </div>
          )}

          {/* RESTING face: the sample shelf */}
          {!g && startable.length === 0 && (
            <p className="py-3 text-center text-xs leading-relaxed text-slate-400">
              The vat rests, empty and breathing. It grows creatures from their{' '}
              <span className="text-emerald-300">Samples</span> — something from the original creature.
              Tamed companions shed samples as they live beside you; the wild leave rare traces where they wander.
              Keep two cuttings from everything you love.
            </p>
          )}
          {!g &&
            startable.map((species) => {
              const plan = vatPlanFor(species);
              const tierOk = tier >= plan.vatTier;
              const missing = plan.ingredients.filter((ing) => (inventory[ing.id] ?? 0) < ing.count);
              const canStart = tierOk && missing.length === 0;
              return (
                <div key={species} className="mb-3 rounded-2xl border border-slate-600/40 bg-slate-900/40 px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-slate-100">{plan.def.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {BAND_LABEL[plan.band]} · hatches in {CYCLE_LABEL[plan.seconds] ?? 'a while'}
                      </div>
                    </div>
                    <button
                      onClick={() => onStart(structure, species)}
                      disabled={!canStart}
                      className={`rounded-xl border px-3 py-1.5 text-[11px] font-tech font-bold transition-all ${
                        canStart
                          ? 'border-emerald-400/60 text-emerald-200 hover:scale-105 active:scale-95 cursor-pointer'
                          : 'border-slate-600/50 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      BEGIN
                    </button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {plan.ingredients.map((ing) => {
                      const held = inventory[ing.id] ?? 0;
                      const ok = held >= ing.count;
                      return (
                        <span
                          key={ing.id}
                          className={`rounded-full border px-2 py-0.5 text-[11px] ${
                            ok ? 'border-emerald-500/40 text-emerald-200' : 'border-red-400/40 text-red-300'
                          }`}
                        >
                          {ITEMS[ing.id]?.name ?? ing.id} {held}/{ing.count}
                        </span>
                      );
                    })}
                    {!tierOk && (
                      <span className="rounded-full border border-amber-400/40 px-2 py-0.5 text-[11px] text-amber-300">
                        Needs a {plan.vatTier === 2 ? 'richened' : 'deepened'} vat
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
};
