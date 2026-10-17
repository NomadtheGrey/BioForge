import React, { useState } from 'react';
import { X, BookOpen, Sparkles, CheckCircle2, Lock, Eye } from 'lucide-react';
import { CodexEntry, ItemId, ShieldGraftId } from '../types/game';
import { ITEMS } from '../game/items/constants';
import {
  FAMILY_KIND_BLURB,
  FAMILY_KIND_LABEL,
  consumedRung,
  familyByKind,
  familyEntryOf,
  recipeForItem,
  type FamilyEntry,
} from '../game/items/weaponsFamily';
import { itemIcon } from './itemIcon';
// The graft's reflect numbers ride the shield rules table —
// the dossier quotes them from the source, never from copy.
import { SHIELD_GRAFTS, graftOf } from '../game/creatures/shields';

interface CodexModalProps {
  isOpen: boolean;
  onClose: () => void;
  codexList: CodexEntry[];
  // The pouch, when the host passes it: the Grown Arsenal marks
  // entries GROWN / NOT GROWN and shows ingredient counts from
  // it. Optional so the section renders fully without it.
  inventory?: Record<ItemId, number>;
  // The Spike Graft record (PlayerState.shieldGrafts), when
  // passed: shield dossiers mark GRAFTED on the entry itself.
  shieldGrafts?: Partial<Record<ItemId, ShieldGraftId | boolean>>;
}

export const CodexModal: React.FC<CodexModalProps> = ({
  isOpen,
  onClose,
  codexList,
  inventory,
  shieldGrafts,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'flora' | 'fauna' | 'composite' | 'arsenal'>('all');
  const [selectedEntry, setSelectedEntry] = useState<CodexEntry>(codexList[0]);
  // The arsenal's selected entry (weapons-family work order,
  // 2026-10-17): species selection can't hold it — the family
  // is keyed by item, not by specimen.
  const [selectedWeaponId, setSelectedWeaponId] = useState<ItemId>('briar_barb');

  if (!isOpen) return null;

  const filtered = codexList.filter(
    (e) => activeFilter === 'all' || e.type === activeFilter
  );

  const discoveredCount = codexList.filter((e) => e.discovered).length;
  const totalCount = codexList.length;

  // ─── THE GROWN ARSENAL (weapons-family work order, 2026-10-17) ──
  // The six strikers plus the shield line, shelved by KIND with
  // their tiers, stats, recipes, and the ladder's one rule: a
  // higher striker tier CONSUMES the lower weapon of its kind.
  // Entries assemble from data (weaponsFamily.ts) — nothing here
  // is per-item. Weapons are forge knowledge, not scanned
  // discoveries, so entries read openly; the pouch (when passed)
  // only marks what stands GROWN.
  const owns = (id: ItemId) => (inventory?.[id] ?? 0) > 0;
  const selWeapon: FamilyEntry | undefined = familyEntryOf(selectedWeaponId);
  const selItem = selWeapon ? ITEMS[selWeapon.itemId] : undefined;

  const renderArsenalRow = (e: FamilyEntry) => {
    const item = ITEMS[e.itemId];
    if (!item) return null;
    const Icon = itemIcon(item.iconName);
    const isSel = selectedWeaponId === e.itemId;
    const grown = owns(e.itemId);
    return (
      <div
        key={e.itemId}
        onClick={() => setSelectedWeaponId(e.itemId)}
        className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
          isSel
            ? 'bg-slate-800/90 border-rose-500/60 shadow-md shadow-rose-950/40'
            : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40'
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner"
            style={{
              backgroundColor: `${item.color}25`,
              border: `1px solid ${item.color}`,
              color: item.color,
            }}
          >
            <Icon className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-semibold text-slate-100 truncate">{item.name}</h4>
            <p className="text-[11px] text-slate-400">
              {FAMILY_KIND_LABEL[e.kind]} · Tier {e.tier}
              {e.damage !== undefined ? ` · ${e.damage} dmg` : ''}
            </p>
          </div>
        </div>
        {inventory && (
          grown
            ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            : <span className="text-[10px] text-slate-500 font-mono shrink-0">NOT GROWN</span>
        )}
      </div>
    );
  };

  const renderArsenalBody = () => (
    <>
      {/* Left: the shelves, by kind */}
      <div className="w-5/12 border-r border-slate-800/80 overflow-y-auto p-4 space-y-5">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Everything the gauntlet and the Left Hand can grow for a fight. One shelf per
          kind; strikers climb, shields branch.
        </p>
        {familyByKind().map(({ kind, entries }) => (
          <div key={kind} className="space-y-2">
            <div>
              <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-rose-300/90">
                {FAMILY_KIND_LABEL[kind]}
              </h4>
              <p className="text-[10px] text-slate-500 leading-snug">{FAMILY_KIND_BLURB[kind]}</p>
            </div>
            {entries.length === 0 ? (
              <p className="text-[11px] text-slate-600 italic px-1">Nothing grown onto this shelf yet.</p>
            ) : (
              entries.map(renderArsenalRow)
            )}
          </div>
        ))}
      </div>

      {/* Right: the selected entry's dossier */}
      <div className="w-7/12 p-6 flex flex-col justify-between overflow-y-auto bg-slate-900/20">
        {selWeapon && selItem ? (
          <div className="space-y-5">
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                style={{
                  backgroundColor: `${selItem.color}25`,
                  border: `1px solid ${selItem.color}60`,
                  color: selItem.color,
                }}
              >
                {React.createElement(itemIcon(selItem.iconName), { className: 'w-8 h-8' })}
              </div>
              <div>
                <h3 className="text-lg font-tech font-bold text-white">{selItem.name}</h3>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[10px] uppercase font-tech px-2.5 py-0.5 rounded-full bg-slate-800 text-rose-300 border border-slate-700">
                    {FAMILY_KIND_LABEL[selWeapon.kind]} · Tier {selWeapon.tier}
                  </span>
                  <span className="text-[10px] uppercase font-tech px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700 capitalize">
                    {selItem.rarity}
                  </span>
                  {inventory && (
                    <span className={`text-[10px] uppercase font-tech px-2.5 py-0.5 rounded-full border ${
                      owns(selWeapon.itemId)
                        ? 'bg-emerald-950/50 text-emerald-300 border-emerald-800/60'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}>
                      {owns(selWeapon.itemId) ? 'Grown — yours' : 'Not yet grown'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  {selWeapon.kind === 'defensive'
                    ? 'Worn on the Left Hand — Alt + wheel or Alt + ↑ cycles the hand (lantern ↔ shield ↔ empty).'
                    : 'Seated on the gauntlet in slot 7 — the slot draws your best of each kind; the wheel swaps the draw.'}
                </p>
              </div>
            </div>

            <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-tech font-semibold uppercase text-slate-400 mb-1.5">
                What It Is
              </h4>
              <p className="text-xs text-slate-200 leading-relaxed">{selItem.description}</p>
            </div>

            {/* Striker numbers, straight from the rules table. */}
            {selWeapon.damage !== undefined && (
              <div>
                <h4 className="text-xs font-tech font-semibold uppercase text-slate-400 mb-2">
                  Field Numbers
                </h4>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    ['Damage', `${selWeapon.damage}`],
                    ['Cooldown', `${selWeapon.cooldownSeconds}s`],
                    ['Stamina', `${selWeapon.staminaCost}`],
                    ...(selWeapon.reach !== undefined
                      ? [['Reach', `${selWeapon.reach} m`], ['Flinch', `${selWeapon.flinchSeconds}s`]] as [string, string][]
                      : []),
                    ...(selWeapon.projectileSpeed !== undefined
                      ? [['Shot speed', `${selWeapon.projectileSpeed} m/s`]] as [string, string][]
                      : []),
                    ...(selWeapon.burstRadius !== undefined
                      ? [['Burst', `${selWeapon.burstRadius} m`]] as [string, string][]
                      : []),
                  ].map(([label, value]) => (
                    <div key={label} className="bg-slate-800/40 border border-slate-800 rounded-xl px-3 py-2">
                      <span className="block text-[9px] uppercase font-mono text-slate-500">{label}</span>
                      <span className="text-sm font-tech font-bold text-slate-100">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Defensive entries speak through their SIGNATURE
                LINES — carried in the registry as data (shield
                slice, 2026-10-17), rendered verbatim, never
                hardcoded here: the two states for the Scute, the
                light-branch for the Lantern, the Fenback's four. */}
            {selWeapon.kind === 'defensive' && selWeapon.signatures && (
              <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800">
                <h4 className="text-xs font-tech font-semibold uppercase text-slate-400 mb-2">
                  How It Wards
                </h4>
                <ul className="space-y-1.5">
                  {selWeapon.signatures.map((line, i) => (
                    <li key={i} className="text-xs text-slate-300 leading-relaxed flex gap-2">
                      <span className="text-rose-300/70 shrink-0">◈</span>
                      <span>{line}</span>
                    </li>
                  ))}
                </ul>
                {/* The Spike Graft: a modifier ON the entry,
                    never a shelf item (pinned) — its numbers
                    ride the rules table; its state, when the
                    host passes the graft record, marks here. */}
                <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-start gap-2">
                  <span className="text-rose-300/70 shrink-0 mt-0.5">◈</span>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    <strong className="text-slate-200">The Graft Slot</strong> — one graft
                    grown onto the face. Thorn Spikes (a Tier 2 addition): strikes landing on
                    the shield answer {SHIELD_GRAFTS.spikes.reflectPassive} damage carried, {SHIELD_GRAFTS.spikes.reflectBraced} braced.
                    {selWeapon.tier >= 2 && ' The graft survives this shield’s grows — combination and consume-and-keep alike.'}
                    {shieldGrafts && (
                      <span className={`block mt-1 font-tech text-[10px] uppercase tracking-wide ${graftOf(shieldGrafts, selWeapon.itemId) ? 'text-emerald-300' : 'text-slate-500'}`}>
                        {(() => {
                          const g = graftOf(shieldGrafts, selWeapon.itemId);
                          return g ? `Grafted — this shield wears its ${SHIELD_GRAFTS[g].name}` : 'Not grafted';
                        })()}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* THE LADDER (strikers) / THE BRANCH (defensives). */}
            <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800">
              <h4 className="text-xs font-tech font-semibold uppercase text-rose-300/90 mb-2">
                {selWeapon.kind === 'defensive' ? 'The Branch' : 'The Ladder'}
              </h4>
              <div className="flex items-center gap-1.5 flex-wrap">
                {familyByKind()
                  .find((g) => g.kind === selWeapon.kind)
                  ?.entries.map((e, i, arr) => (
                    <React.Fragment key={e.itemId}>
                      <button
                        onClick={() => setSelectedWeaponId(e.itemId)}
                        className={`px-2.5 py-1.5 rounded-lg text-[11px] font-tech border transition-all ${
                          e.itemId === selWeapon.itemId
                            ? 'bg-rose-500/20 text-rose-200 border-rose-500/50'
                            : 'bg-slate-900/60 text-slate-300 border-slate-700/70 hover:bg-slate-800/60'
                        }`}
                      >
                        T{e.tier} {ITEMS[e.itemId]?.name}
                        {inventory && owns(e.itemId) ? ' ✓' : ''}
                      </button>
                      {i < arr.length - 1 && <span className="text-slate-600 text-xs">→</span>}
                    </React.Fragment>
                  ))}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-2.5">
                {selWeapon.kind === 'defensive'
                  ? 'A branch, not a bigger wall: the Lantern Shield blocks exactly as the Scute Shield does, in both states — its tier buys the light. The lamp is grown into the shield’s face, so the light holds even braced.'
                  : 'One weapon per tier, per kind — and a higher tier is an upgrade, not a sibling: its recipe consumes the lower weapon, so you never hold two of a kind.'}
                {consumedRung(selWeapon) && (
                  <> This one is grown from the <strong className="text-slate-200">{ITEMS[consumedRung(selWeapon)!.itemId]?.name}</strong>, which the growing consumes.</>
                )}
              </p>
            </div>

            {/* The recipe, with pouch counts when known. */}
            {recipeForItem(selWeapon.itemId) && (
              <div>
                <h4 className="text-xs font-tech font-semibold uppercase text-slate-400 mb-2">
                  Grown at the Bio-Forge
                </h4>
                <div className="flex flex-wrap gap-2">
                  {recipeForItem(selWeapon.itemId)!.ingredients.map((ing) => (
                    <span
                      key={ing.id}
                      className="text-xs px-3 py-1.5 rounded-xl bg-rose-950/40 text-rose-200 border border-rose-800/50 flex items-center gap-1.5"
                    >
                      {ITEMS[ing.id]?.name ?? ing.id} ×{ing.count}
                      {inventory && (
                        <span className="text-rose-300/60 font-mono text-[10px]">
                          (have {inventory[ing.id] ?? 0})
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
            <h3 className="text-base font-tech font-bold text-slate-300">The shelves are bare</h3>
            <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
              No arsenal data on file yet.
            </p>
          </div>
        )}
        <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between items-center">
          <span>BioForge Ecological Research Database</span>
          <span className="font-mono">THE GROWN ARSENAL</span>
        </div>
      </div>
    </>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-4xl h-[620px] rounded-3xl flex flex-col overflow-hidden border border-purple-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-950/70 border border-purple-500/40 flex items-center justify-center text-purple-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">
                ECOSYSTEM CODEX & BIO-SCANNER
              </h2>
              <p className="text-xs text-slate-400">
                Cataloged Alien Flora, Domestication Records & Bio-Composites
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-slate-400 uppercase font-mono block">Scanned Mastery</span>
              <span className="font-tech font-bold text-cyan-400 text-sm">
                {discoveredCount} / {totalCount} ({Math.round((discoveredCount / totalCount) * 100)}%)
              </span>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-6 py-3 border-b border-slate-800/70 bg-slate-900/30 flex items-center gap-2">
          {[
            { id: 'all', label: 'All Catalog' },
            { id: 'flora', label: 'Flora & Fungi' },
            { id: 'fauna', label: 'Fauna & Wildlife' },
            { id: 'composite', label: 'Living Architectures' },
            { id: 'arsenal', label: 'Grown Arsenal' },
          ].map((f) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id as typeof activeFilter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium font-tech transition-all ${
                activeFilter === f.id
                  ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {activeFilter === 'arsenal' ? renderArsenalBody() : (
          <>
          {/* Left: Species List */}
          <div className="w-5/12 border-r border-slate-800/80 overflow-y-auto p-4 space-y-2">
            {filtered.map((entry) => {
              const isSelected = selectedEntry.species === entry.species;
              return (
                <div
                  key={entry.species}
                  onClick={() => setSelectedEntry(entry)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-800/90 border-purple-500 shadow-md shadow-purple-950/40'
                      : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-base shadow-inner shrink-0"
                      style={{
                        backgroundColor: entry.discovered ? `${entry.iconColor}25` : '#1e293b',
                        border: `1px solid ${entry.discovered ? entry.iconColor : '#334155'}`,
                        color: entry.discovered ? entry.iconColor : '#64748b',
                      }}
                    >
                      {entry.discovered ? <Sparkles className="w-5 h-5" /> : <Lock className="w-4 h-4" />}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">
                        {entry.discovered ? entry.name : 'Unknown Specimen'}
                      </h4>
                      <p className="text-[11px] text-slate-400 capitalize">
                        {entry.discovered ? entry.type : 'Unscanned'}
                      </p>
                    </div>
                  </div>

                  <div>
                    {entry.discovered ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">SCAN [2]</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Detailed Ecological dossier */}
          <div className="w-7/12 p-6 flex flex-col justify-between overflow-y-auto bg-slate-900/20">
            {selectedEntry.discovered ? (
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 shadow-lg"
                    style={{
                      backgroundColor: `${selectedEntry.iconColor}25`,
                      border: `1px solid ${selectedEntry.iconColor}60`,
                      color: selectedEntry.iconColor,
                    }}
                  >
                    <Eye className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-tech font-bold text-white">{selectedEntry.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] uppercase font-tech px-2.5 py-0.5 rounded-full bg-slate-800 text-purple-300 border border-slate-700">
                        {selectedEntry.type}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        Native Biome: {selectedEntry.biome}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800">
                  <h4 className="text-xs font-tech font-semibold uppercase text-slate-400 mb-1.5">
                    Field Observations
                  </h4>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {selectedEntry.description}
                  </p>
                </div>

                {/* Byproducts & Non-lethal harvesting */}
                <div>
                  <h4 className="text-xs font-tech font-semibold uppercase text-slate-400 mb-2">
                    Harvestable Byproducts & Secretions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedEntry.byproducts.map((bp) => (
                      <span
                        key={bp}
                        className="text-xs px-3 py-1.5 rounded-xl bg-cyan-950/40 text-cyan-300 border border-cyan-800/50 flex items-center gap-1.5"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                        {bp}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Domestication / Crafting Notes */}
                <div className="bg-slate-800/30 p-4 rounded-2xl border border-slate-800">
                  <h4 className="text-xs font-tech font-semibold uppercase text-purple-400 mb-1">
                    Domestication & Architectural Utility
                  </h4>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    {selectedEntry.tamingOrCraftNotes}
                  </p>
                </div>
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400">
                <div className="w-16 h-16 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-600 mb-4">
                  <Lock className="w-8 h-8" />
                </div>
                <h3 className="text-base font-tech font-bold text-slate-300">Specimen Undiscovered</h3>
                <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">
                  Equip your <strong className="text-cyan-400">Bio-Scanner [2]</strong> in the field and click this lifeform to reveal its genetic properties, byproducts, and taming baits.
                </p>
              </div>
            )}

            <div className="pt-4 border-t border-slate-800/80 text-[11px] text-slate-500 flex justify-between items-center">
              <span>BioForge Ecological Research Database</span>
              <span className="font-mono">STATUS: SYNCHRONIZED</span>
            </div>
          </div>
          </>
          )}
        </div>
      </div>
    </div>
  );
};
