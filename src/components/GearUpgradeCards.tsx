import React from 'react';
import { Shield, Footprints, HardHat, Hand } from 'lucide-react';
import type { ItemId } from '../types/game';
import { ITEMS } from '../game/items/constants';
import {
  DROP_MAGNET_BRACED,
  DROP_MAGNET_CARRIED,
  SHIELD_GRAFTS,
  SHIELD_ITEM_IDS,
  SHIELDS,
  SPORE_RADIUS,
  graftOf,
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
// Rows: the SLOT first (the one upgrade every shield can
// carry), then each branch's gift — the lamp, the Fenback's
// wrap (spore answer at its head, as Adam named it), and the
// Bulwark's pull (the "magnet"). A row's state names what the
// pouch actually holds, never a promise.
export const ShieldUpgradesCard: React.FC<CardProps & {
  shieldGrowth?: ShieldGrowthMap;
}> = ({ inventory, shieldGrowth }) => {
  const ownedShields = SHIELD_ITEM_IDS.filter((id) => owns(inventory, id));
  const graftedNames = SHIELD_ITEM_IDS
    .filter((id) => graftOf(shieldGrowth, id) !== null)
    .map((id) => ITEMS[id]?.name ?? id);
  const lampShield = SHIELDS.find((s) => s.hasLamp && owns(inventory, s.itemId));
  const hasFenback = owns(inventory, 'fenback_shield');
  const hasBulwark = owns(inventory, 'lodestone_bulwark');
  const spikes = SHIELD_GRAFTS.spikes;

  const rows: { name: string; line: string; state: string; live: boolean }[] = [
    {
      name: `Graft Slot · ${spikes.name}`,
      line: `One graft, grown onto any shield's face: strikes that meet it answer ${spikes.reflectPassive} damage carried, ${spikes.reflectBraced} braced. The graft survives the shield's grows.`,
      state: graftedNames.length > 0 ? `On: ${graftedNames.join(', ')}` : 'No shield grafted yet',
      live: graftedNames.length > 0,
    },
    {
      name: 'The Lamp · Lantern branch',
      line: 'A lantern grown into the shield’s face — the light holds while held, and throws forward while braced.',
      state: lampShield ? `Lit — ${ITEMS[lampShield.itemId]?.name}` : 'Not grown — the Lantern Shield carries it first',
      live: !!lampShield,
    },
    {
      name: 'Spore Answer · Fenback',
      line: `A braced block sheds a stagger-and-knockback spore burst (${SPORE_RADIUS} m) — and the wrap adds rear passive cover, Rooted Stance, and Shared Cover for an ally in your lee.`,
      state: hasFenback ? 'Carried — Fenback Shield' : 'Not grown — the Fenback carries it',
      live: hasFenback,
    },
    {
      name: 'The Pull · Lodestone Bulwark',
      line: `The ward itself pulls: dropped things drift toward you from ${DROP_MAGNET_CARRIED.radius} m carried, ${DROP_MAGNET_BRACED.radius} m braced.`,
      state: hasBulwark ? 'Carried — Lodestone Bulwark' : 'Not grown — the Bulwark carries it',
      live: hasBulwark,
    },
  ];

  return (
    <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3.5 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Shield className="w-4 h-4 text-rose-300" />
        <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-rose-200">
          Shield Upgrades
        </h4>
        <span className="text-[10px] text-slate-500 font-tech">
          {ownedShields.length} of {SHIELD_ITEM_IDS.length} shields in pouch
        </span>
      </div>
      <div className="space-y-1.5">
        {rows.map((r) => (
          <div key={r.name} className="flex items-start justify-between gap-3 text-[11px] leading-snug">
            <div className="min-w-0">
              <span className="font-semibold text-slate-200">{r.name}</span>
              <span className="text-slate-400"> — {r.line}</span>
            </div>
            <span className={`shrink-0 font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
              r.live
                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                : 'bg-slate-800/70 text-slate-500 border-slate-700/60'
            }`}>
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
