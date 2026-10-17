import React from 'react';
import { Shield, Footprints, HardHat, Hand } from 'lucide-react';
import type { ItemId } from '../types/game';
import { ITEMS } from '../game/items/constants';
import {
  DROP_MAGNET_BRACED,
  DROP_MAGNET_CARRIED,
  LODESTONE_SLOT,
  SHIELD_GRAFTS,
  SHIELD_ITEM_IDS,
  graftOf,
  lodestoneOf,
  type ShieldGrowthMap,
} from '../game/creatures/shields';
import { BOOTS, familyByKind } from '../game/items/weaponsFamily';
import { MODULE_FOR_TOOL, TOOL_NAMES } from '../game/quests/quests';
import type { ToolType } from '../types/game';

/**
 * GEAR UPGRADE CARDS (Adam, 2026-10-17 — "a UI entry showing
 * its upgrades, like spike, magnet, spores"): the entry that
 * stands at the head of a platform's own tab and says what
 * upgrades the platform HAS — the shield's graft slot and its
 * branches' gifts, the Quicksteps' growths — with their live
 * state read from the pouch. Everything here derives from
 * the data tables (shields.ts rules, the family registry):
 * no per-upgrade copy lives in this file beyond the row
 * grammar, so a new graft kind or branch joins by data.
 */

interface CardProps {
  inventory: Record<ItemId, number>;
}

const owns = (inventory: Record<ItemId, number>, id: ItemId) => (inventory[id] ?? 0) > 0;

// ─── THE SHIELD CARD ─────────────────────────────────────────
// Rebuilt as a PLATFORM entry (Adam, 2026-10-17 — 'very much
// like the rest of the equipment'): the fork is deleted, so
// the card is the ladder first — the three rungs in the other
// cards' row grammar, WORN / GREW ONWARD / NOT GROWN — and
// beneath it the two SLOTS that ride the ward at every rung:
// the graft slot on its face, the lodestone slot in its body.
// A consumed rung reads GREW ONWARD, never NOT GROWN: the
// player grew it, and the ward they wear is its continuation.
export const ShieldUpgradesCard: React.FC<CardProps & {
  shieldGrowth?: ShieldGrowthMap;
  heldItemId?: ItemId | null;
}> = ({ inventory, shieldGrowth, heldItemId }) => {
  // A held shield is OUT of the pouch (raising deducts — the
  // hand's transfer model), and with the hand filling itself
  // the worn rung is nearly always the held one. Ownership
  // here counts the hand: the rung in it is WORN, full stop.
  const ownsShield = (id: ItemId) => owns(inventory, id) || heldItemId === id;
  const entries = familyByKind().find((sh) => sh.kind === 'defensive')?.entries ?? [];
  const topTier = Math.max(
    0,
    ...entries.filter((e) => ownsShield(e.itemId)).map((e) => e.tier),
  );
  const graftedNames = SHIELD_ITEM_IDS
    .filter((id) => graftOf(shieldGrowth, id) !== null)
    .map((id) => ITEMS[id]?.name ?? id);
  const lodestoneNames = SHIELD_ITEM_IDS
    .filter((id) => lodestoneOf(shieldGrowth, id))
    .map((id) => ITEMS[id]?.name ?? id);
  const spikes = SHIELD_GRAFTS.spikes;

  const chip = (state: string) =>
    state === 'WORN' || state === 'SET'
      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
      : state === 'GREW ONWARD'
        ? 'bg-slate-800/50 text-slate-400 border-slate-600/50'
        : 'bg-slate-800/70 text-slate-500 border-slate-700/60';

  const slotRows: { name: string; line: string; state: string; names: string[] }[] = [
    {
      name: `Graft Slot · ${spikes.name}`,
      line: `One graft, grown onto the ward's face: strikes that meet it answer ${spikes.reflectPassive} damage worn, ${spikes.reflectBraced} braced. The graft survives the climb.`,
      state: graftedNames.length > 0 ? 'SET' : 'NOT SET',
      names: graftedNames,
    },
    {
      name: `Lodestone Slot · ${LODESTONE_SLOT.name}`,
      line: `${LODESTONE_SLOT.blurb} The pull runs ${DROP_MAGNET_CARRIED.radius} m worn, ${DROP_MAGNET_BRACED.radius} m braced — and the lodestone survives the climb like the graft does.`,
      state: lodestoneNames.length > 0 ? 'SET' : 'NOT SET',
      names: lodestoneNames,
    },
  ];

  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-3.5 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4 text-amber-300" />
        <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-amber-200">
          Shield Upgrades
        </h4>
        <span className="text-[10px] text-slate-500 font-tech">
          one ward — grown upward, slots ride it
        </span>
      </div>
      <div className="space-y-1.5">
        {entries.map((e) => {
          const owned = ownsShield(e.itemId);
          const state = owned ? 'WORN' : e.tier < topTier ? 'GREW ONWARD' : 'NOT GROWN';
          return (
            <div key={e.itemId} className="flex items-start justify-between gap-3 text-[11px] leading-snug">
              <div className="min-w-0">
                <span className="font-semibold text-slate-200">{ITEMS[e.itemId]?.name ?? e.itemId}</span>
                <span className="text-slate-400"> — {e.signatures?.[0] ?? ''}</span>
              </div>
              <span className={`shrink-0 font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${chip(state)}`}>
                {state}
              </span>
            </div>
          );
        })}
        {slotRows.map((r) => (
          <div key={r.name} className="flex items-start justify-between gap-3 text-[11px] leading-snug pt-1 border-t border-slate-700/40">
            <div className="min-w-0">
              <span className="font-semibold text-slate-200">{r.name}</span>
              <span className="text-slate-400"> — {r.line}</span>
              {r.names.length > 0 && (
                <span className="block text-[10px] text-emerald-300/80 font-tech mt-0.5">
                  On your {r.names.join(', ')}
                </span>
              )}
            </div>
            <span className={`shrink-0 font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${chip(r.state)}`}>
              {r.state}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── THE QUICKSTEPS CARD ─────────────────────────────────────
// The boots' parallel treatment (Adam, same ask): the base
// set and its four growths as one entry — each row a BOOTS
// family record (its signature line is the data's own words),
// its state read from the pouch.
export const QuickstepsUpgradesCard: React.FC<CardProps> = ({ inventory }) => {
  return (
    <div className="rounded-2xl border border-lime-500/30 bg-lime-950/20 p-3.5 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Footprints className="w-4 h-4 text-lime-300" />
        <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-lime-200">
          Quicksteps Upgrades
        </h4>
        <span className="text-[10px] text-slate-500 font-tech">
          one pair — every growth at once
        </span>
      </div>
      <div className="space-y-1.5">
        {BOOTS.map((e) => {
          const item = ITEMS[e.itemId];
          const owned = owns(inventory, e.itemId);
          const isBase = e.itemId === 'quicksteps';
          return (
            <div key={e.itemId} className="flex items-start justify-between gap-3 text-[11px] leading-snug">
              <div className="min-w-0">
                <span className="font-semibold text-slate-200">{item?.name ?? e.itemId}</span>
                <span className="text-slate-400"> — {e.signatures?.[0] ?? ''}</span>
              </div>
              <span className={`shrink-0 font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                owned
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800/70 text-slate-500 border-slate-700/60'
              }`}>
                {owned ? (isBase ? 'YOUR SET' : 'ON YOUR SET') : 'NOT GROWN'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── THE HELMET CARD ─────────────────────────────────────────
// Adam (2026-10-17, from the Quicksteps screenshot): the same
// entry for the KNOW platform — the helm and everything grown
// onto it (the radar at tier 2, the Lifefinder at tier 3, the
// lenses), each row a HELMETS family record with its own
// signature line and its live state from the pouch.
export const HelmetUpgradesCard: React.FC<CardProps> = ({ inventory }) => {
  const entries = familyByKind().find((sh) => sh.kind === 'helmet')?.entries ?? [];
  const ownedCount = entries.filter((e) => owns(inventory, e.itemId)).length;
  return (
    <div className="rounded-2xl border border-sky-500/30 bg-sky-950/20 p-3.5 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <HardHat className="w-4 h-4 text-sky-300" />
        <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-sky-200">
          Helmet Upgrades
        </h4>
        <span className="text-[10px] text-slate-500 font-tech">
          one helm — every lens at once · {ownedCount} of {entries.length} worn
        </span>
      </div>
      <div className="space-y-1.5">
        {entries.map((e) => {
          const item = ITEMS[e.itemId];
          const owned = owns(inventory, e.itemId);
          const isBase = e.itemId === 'homestead_helm';
          return (
            <div key={e.itemId} className="flex items-start justify-between gap-3 text-[11px] leading-snug">
              <div className="min-w-0">
                <span className="font-semibold text-slate-200">{item?.name ?? e.itemId}</span>
                <span className="text-slate-400"> — {e.signatures?.[0] ?? ''}</span>
              </div>
              <span className={`shrink-0 font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                owned
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800/70 text-slate-500 border-slate-700/60'
              }`}>
                {owned ? (isBase ? 'YOUR HELM' : 'WORN') : 'NOT GROWN'}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── THE GAUNTLET CARD ───────────────────────────────────────
// The ACT platform's entry: the Graft (Field Synthesizer)
// first — the capstone — then the five modules in unlock
// order, each the module that grafts one tool onto the glove.
// The footer reads the STRIKER SLOT: slot 7 is the gauntlet's
// other slot-shaped thing, drawing the best owned striker of
// each kind, so this card answers "what can this hand hold"
// in full.
const GAUNTLET_MODULE_ORDER: ToolType[] = [
  'bio_scanner',
  'planter_trowel',
  'builder',
  'solvent_sprayer',
  'taming_lure',
];

export const GauntletUpgradesCard: React.FC<CardProps> = ({ inventory }) => {
  const synthId = 'gauntlet_synthesizer_upgrade' as ItemId;
  const synthOwned = owns(inventory, synthId);
  const bestOf = (kind: 'close' | 'ranged') =>
    (familyByKind().find((sh) => sh.kind === kind)?.entries ?? [])
      .filter((e) => owns(inventory, e.itemId))
      .sort((a, b) => b.tier - a.tier)[0];
  const close = bestOf('close');
  const ranged = bestOf('ranged');
  const closeName = close ? ITEMS[close.itemId]?.name ?? '—' : '—';
  const rangedName = ranged ? ITEMS[ranged.itemId]?.name ?? '—' : '—';
  return (
    <div className="rounded-2xl border border-violet-500/30 bg-violet-950/20 p-3.5 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Hand className="w-4 h-4 text-violet-300" />
        <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-violet-200">
          Gauntlet Upgrades
        </h4>
        <span className="text-[10px] text-slate-500 font-tech">
          one glove — every graft at once
        </span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-start justify-between gap-3 text-[11px] leading-snug">
          <div className="min-w-0">
            <span className="font-semibold text-slate-200">{ITEMS[synthId]?.name ?? 'Field Synthesizer'}</span>
            <span className="text-slate-400"> — the Graft: a tiny forge grown onto the gauntlet. Craft tier 1–2 anywhere.</span>
          </div>
          <span className={`shrink-0 font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
            synthOwned
              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-800/70 text-slate-500 border-slate-700/60'
          }`}>
            {synthOwned ? 'GRAFTED' : 'NOT GROWN'}
          </span>
        </div>
        {GAUNTLET_MODULE_ORDER.map((tool) => {
          const moduleId = MODULE_FOR_TOOL[tool];
          if (!moduleId) return null;
          const owned = owns(inventory, moduleId);
          return (
            <div key={tool} className="flex items-start justify-between gap-3 text-[11px] leading-snug">
              <div className="min-w-0">
                <span className="font-semibold text-slate-200">{ITEMS[moduleId]?.name ?? moduleId}</span>
                <span className="text-slate-400"> — grafts the {TOOL_NAMES[tool]} onto your gauntlet.</span>
              </div>
              <span className={`shrink-0 font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                owned
                  ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                  : 'bg-slate-800/70 text-slate-500 border-slate-700/60'
              }`}>
                {owned ? 'GRAFTED' : 'NOT GROWN'}
              </span>
            </div>
          );
        })}
        <p className="text-[10px] text-slate-500 font-mono pt-1">
          {close || ranged
            ? `Striker slot [7] draws: ${closeName} (close) · ${rangedName} (ranged)`
            : 'Striker slot [7] is empty — grow a Briar Barb or a Spit Pod at the forge.'}
        </p>
      </div>
    </div>
  );
};
