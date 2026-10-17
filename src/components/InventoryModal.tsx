import React, { useState } from 'react';
import { X, Backpack, Sprout, Hammer, ArrowUpRight, Search } from 'lucide-react';
import { ItemId, StructureType, ToolType } from '../types/game';
import { ITEMS, HELMET_GEAR_ITEM_IDS, BOOTS_GEAR_ITEM_IDS } from '../game/items/constants';
import { isGauntletUpgrade, isGearItem, gearTierOf } from '../game/quests/quests';
import { BASE_SUPPLY_GROUPS, baseSupplyGroupOf, isBaseSupply } from '../game/items/baseSupplies';
import { POUCH_TIER_CAPS, POUCH_TIER_NAMES, pouchTierOf } from '../game/items/pouch';
// Real item icons (shared resolver) + the grown arsenal's
// family facts for tiles/inspector (work order, 2026-10-17).
import { itemIcon } from './itemIcon';
import {
  FAMILY_KIND_LABEL,
  consumedRung,
  familyEntryOf,
} from '../game/items/weaponsFamily';
import { DROP_MAGNET_BRACED, DROP_MAGNET_CARRIED, SHIELD_GRAFTS, graftOf, isShieldItem, lodestoneOf, type ShieldGrowthMap } from '../game/creatures/shields';
// The platform upgrade ENTRIES (Adam, 2026-10-17): the card
// at the head of a platform's tab that shows its upgrades —
// the shield's slot and branches, the Quicksteps' growths.
import { ShieldUpgradesCard, QuickstepsUpgradesCard, HelmetUpgradesCard, GauntletUpgradesCard } from './GearUpgradeCards';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<ItemId, number>;
  onSelectBlueprint: (type: StructureType) => void;
  onSelectSeed: (seedId: ItemId) => void;
  onSelectFertilizer: (fertilizerId: ItemId) => void;
  onSelectTool: (tool: ToolType) => void;
  // The Spike Graft record (PlayerState.shieldGrowth), when
  // passed: a shield's inspector marks GRAFTED on the item.
  shieldGrowth?: ShieldGrowthMap;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onSelectBlueprint,
  onSelectSeed,
  onSelectFertilizer,
  onSelectTool,
  shieldGrowth,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'raw' | 'seed' | 'fertilizer' | 'structure' | 'gauntlet' | 'helmet' | 'boots' | 'shield' | 'base'>('all');
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null);
  // Every hook lives ABOVE the isOpen early return below: a hook
  // under it changes the hook count when the modal opens, React
  // throws, and the whole app unmounts to a black screen (the
  // B-key bug, found 2026-10-16 — this filter's first home was
  // under that return in both tabbed screens).
  const [tierFilter, setTierFilter] = useState<'all' | 'raw' | 1 | 2 | 3>('all');
  // Search (Adam, 2026-10-16), twin of the forge's: 3+ letters,
  // a consecutive substring of the item's name, case-blind.
  // While live it searches the WHOLE pouch — tabs and tier row
  // stand down until it clears.
  const [searchQuery, setSearchQuery] = useState('');
  const searchTerm = searchQuery.trim().toLowerCase();
  const searchActive = searchTerm.length >= 3;

  // The pouch tier derives from the upgrade items in the pouch.
  const pouchTier = pouchTierOf(inventory);

  if (!isOpen) return null;

  // Filter items in inventory that have count > 0
  const ownedItems = Object.entries(inventory)
    .filter(([_, count]) => (count as number) > 0)
    .map(([id]) => id as ItemId);

  const filteredItems = ownedItems.filter((id) => {
    const item = ITEMS[id];
    if (!item) return false;
    if (activeTab === 'all') return true;
    // Gear tabs (Adam, 2026-10-15) mirror the BioForge screen's:
    // Gauntlet gathers the worn upgrades (each already marked
    // EQUIPPED on its tile), Helmet the helmet-line set — the two
    // platforms get a home in the pouch as well as at the forge.
    if (activeTab === 'gauntlet') return isGauntletUpgrade(id);
    if (activeTab === 'helmet') return HELMET_GEAR_ITEM_IDS.includes(id);
    if (activeTab === 'boots') return BOOTS_GEAR_ITEM_IDS.includes(id);
    // The Shield tab (Adam, 2026-10-17): the Left Hand's family
    // gets its own shelf in the pouch, like every platform.
    if (activeTab === 'shield') return isShieldItem(id);
    // Base Supplies (Adam, 2026-10-16): everything you'd build
    // the base with, classified in game/baseSupplies — shared
    // with the forge screen so the shelf never drifts.
    if (activeTab === 'base') return isBaseSupply(id);
    return item.category === activeTab;
  });

  // Second tab row (Adam, 2026-10-15): a TIER filter composing
  // with the category/gear tabs, twin of the BioForge screen's.
  // A pouch item's band is its craft tier (gearTierOf — the
  // recipe graph, with the radar's pinned ladder tier), and Raw
  // is everything never crafted: the drops and gatherables. In a
  // tier view the grid groups by item type, with full-width
  // heading cells between the groups.
  const itemTierBand = (id: ItemId): number => gearTierOf(id) ?? 0;
  const tierVisibleItem = (id: ItemId): boolean => {
    if (tierFilter === 'all') return true;
    if (tierFilter === 'raw') return itemTierBand(id) === 0;
    return itemTierBand(id) === tierFilter;
  };
  const visibleItems = searchActive
    ? ownedItems.filter((id) => (ITEMS[id]?.name ?? '').toLowerCase().includes(searchTerm))
    : filteredItems.filter(tierVisibleItem);
  const TYPE_GROUPS: { id: string; label: string }[] = [
    { id: 'equipment', label: 'Equipment' },
    { id: 'structure', label: 'Structures' },
    { id: 'fertilizer', label: 'Fertilizers' },
    { id: 'seed', label: 'Seeds' },
    { id: 'raw', label: 'Raw Materials' },
  ];
  type GridEntry =
    | { kind: 'heading'; label: string }
    | { kind: 'item'; id: ItemId };
  const gridEntries: GridEntry[] = [];
  if (searchActive || (tierFilter === 'all' && activeTab !== 'base')) {
    visibleItems.forEach((id) => gridEntries.push({ kind: 'item', id }));
  } else if (activeTab === 'base') {
    // The Base Supplies shelf groups by what a piece is FOR in
    // the base (game/baseSupplies); the tier row still filters.
    for (const g of BASE_SUPPLY_GROUPS) {
      const ids = visibleItems.filter((id) => baseSupplyGroupOf(id) === g.id);
      if (ids.length === 0) continue;
      gridEntries.push({ kind: 'heading', label: g.label });
      ids.forEach((id) => gridEntries.push({ kind: 'item', id }));
    }
  } else {
    for (const g of TYPE_GROUPS) {
      const ids = visibleItems.filter((id) => ITEMS[id]?.category === g.id);
      if (ids.length === 0) continue;
      gridEntries.push({ kind: 'heading', label: g.label });
      ids.forEach((id) => gridEntries.push({ kind: 'item', id }));
    }
  }

  // The inspector follows what's actually on the grid (the
  // visible list), not the un-tiered tab list behind it.
  const activeItem = selectedItemId ? ITEMS[selectedItemId] : visibleItems.length > 0 ? ITEMS[visibleItems[0]] : null;

  const handleEquip = () => {
    if (!activeItem) return;
    if (activeItem.category === 'structure') {
      onSelectBlueprint(activeItem.id as StructureType);
      onSelectTool('builder');
      onClose();
      return;
    }
    if (activeItem.category === 'seed') {
      onSelectSeed(activeItem.id);
      onSelectTool('planter_trowel');
      onClose();
      return;
    }
    if (activeItem.category === 'fertilizer') {
      // "SELECT FOR FERTILIZING" actually loads the clicked fertilizer
      // into the trowel (it previously equipped the tool but never told
      // the game WHICH fertilizer was chosen).
      onSelectFertilizer(activeItem.id);
      onSelectTool('planter_trowel');
      onClose();
      return;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-4xl h-[600px] rounded-3xl flex flex-col overflow-hidden border border-emerald-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Backpack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">
                BIO-STORAGE POUCH
              </h2>
              <p className="text-xs text-slate-400">
                Botanical Specimens, Bio-Seeds & Living Composite Inventory
              </p>
              {/* The carrying ladder, at a glance (Adam, 2026-10-15):
                  your pouch tier and what a full stack means today. */}
              <p className="text-[11px] font-mono text-amber-300/90 mt-0.5">
                {POUCH_TIER_NAMES[pouchTier]} · stacks hold {POUCH_TIER_CAPS[pouchTier]}
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

        {/* Search (Adam, 2026-10-16): near the top, over both
            tab rows — 3+ letters and the grid becomes every
            owned item whose name holds those letters in a row. */}
        <div className="px-6 pt-3 pb-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search the pouch… (3+ letters)"
              className="w-full bg-slate-900/70 border border-slate-700/70 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-200"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          {searchActive && (
            <span className="text-[11px] text-emerald-300/90 font-tech">
              {visibleItems.length} match{visibleItems.length === 1 ? '' : 'es'} for “{searchQuery.trim()}” — searching the whole pouch
            </span>
          )}
        </div>

        {/* Categories Bar */}
        <div className="px-6 py-3 border-b border-slate-800/70 bg-slate-900/30 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'gauntlet', label: 'Gauntlet' },
            { id: 'helmet', label: 'Helmet' },
            { id: 'boots', label: 'Quicksteps' },
            { id: 'shield', label: 'Shield' },
            { id: 'raw', label: 'Raw Harvests' },
            { id: 'seed', label: 'Flora Seeds' },
            { id: 'fertilizer', label: 'Fertilizers' },
            { id: 'structure', label: 'Bio-Composites' },
            { id: 'base', label: 'Base Supplies' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium font-tech transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tier Row — the second tab row (Adam, 2026-10-15) */}
        <div className="px-6 py-2 border-b border-slate-800/70 bg-slate-900/20 flex items-center gap-2 overflow-x-auto">
          <span className="text-[10px] font-tech uppercase tracking-wider text-slate-500 mr-1">Tier</span>
          {[
            { id: 'all', label: 'All Tiers' },
            { id: 'raw', label: 'Raw' },
            { id: 1, label: 'Tier 1' },
            { id: 2, label: 'Tier 2' },
            { id: 3, label: 'Tier 3' },
          ].map((t) => (
            <button
              key={String(t.id)}
              onClick={() => setTierFilter(t.id as typeof tierFilter)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium font-tech transition-all ${
                tierFilter === t.id
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Grid */}
          <div className="w-7/12 border-r border-slate-800/80 overflow-y-auto p-4">
            {/* The upgrade ENTRIES (Adam, 2026-10-17): a platform's
                own tab opens with what the platform can carry —
                the shield's graft slot and branch gifts, the
                Quicksteps' growths — with live state from the
                pouch. Search stands them down like the tabs. */}
            {!searchActive && activeTab === 'shield' && (
              <ShieldUpgradesCard inventory={inventory} shieldGrowth={shieldGrowth} />
            )}
            {!searchActive && activeTab === 'boots' && (
              <QuickstepsUpgradesCard inventory={inventory} />
            )}
            {!searchActive && activeTab === 'helmet' && (
              <HelmetUpgradesCard inventory={inventory} />
            )}
            {!searchActive && activeTab === 'gauntlet' && (
              <GauntletUpgradesCard inventory={inventory} />
            )}
            {visibleItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <Backpack className="w-8 h-8 mb-2 opacity-40" />
                <span>
                  {searchActive
                    ? `No items match “${searchQuery.trim()}”.`
                    : 'No bio-specimens stored in this category.'}
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2.5">
                {gridEntries.map((entry) => {
                  if (entry.kind === 'heading') {
                    return (
                      <div key={entry.label} className="col-span-4 pt-2 pb-0.5 text-[10px] font-tech font-bold uppercase tracking-wider text-slate-500">
                        {entry.label}
                      </div>
                    );
                  }
                  const id = entry.id;
                  const item = ITEMS[id];
                  const count = inventory[id] || 0;
                  const isSelected = activeItem?.id === id;
                  const TileIcon = itemIcon(item.iconName);
                  const tileFamily = familyEntryOf(id);
                  // A filled graft slot names its KIND on the tile
                  // itself (Platforms Parallel, 2026-10-17): the
                  // slot is part of the shield's identity, not a
                  // bare yes/no badge tucked in the inspector.
                  const tileGraft = tileFamily?.kind === 'defensive' ? graftOf(shieldGrowth, id) : null;
                  const tileLodestone = tileFamily?.kind === 'defensive' ? lodestoneOf(shieldGrowth, id) : false;

                  return (
                    <div
                      key={id}
                      onClick={() => setSelectedItemId(id)}
                      className={`relative p-2.5 rounded-2xl border cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 aspect-square ${
                        isSelected
                          ? 'bg-slate-800/90 border-emerald-400 shadow-md shadow-emerald-950/40 scale-102'
                          : 'bg-slate-900/50 border-slate-800/70 hover:bg-slate-800/40'
                      }`}
                    >
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm"
                        style={{
                          backgroundColor: `${item.color}20`,
                          border: `1px solid ${item.color}50`,
                          color: item.color,
                        }}
                      >
                        <TileIcon className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 text-center line-clamp-1 w-full">
                        {item.name}
                      </span>
                      {/* Arsenal family chip (work order, 2026-
                          10-17): kind + tier at a glance, in the
                          family's rose. */}
                      {tileFamily && (
                        <span className={`font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${
                          {
                            close: 'bg-rose-500/15 text-rose-300 border-rose-500/40',
                            ranged: 'bg-orange-500/15 text-orange-300 border-orange-500/40',
                            defensive: 'bg-amber-500/15 text-amber-300 border-amber-500/40',
                            helmet: 'bg-sky-500/15 text-sky-300 border-sky-500/40',
                            boots: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40',
                          }[tileFamily.kind]
                        }`}>
                          {FAMILY_KIND_LABEL[tileFamily.kind].toUpperCase()} · T{tileFamily.tier}
                          {tileGraft ? ` · ${SHIELD_GRAFTS[tileGraft].name.toUpperCase()}` : ''}
                          {tileLodestone ? ' · LODESTONE' : ''}
                        </span>
                      )}
                      {/* One-time gauntlet upgrades are worn, not
                          carried (Adam, 2026-10-15): owning one IS
                          having it equipped, and the pouch says so
                          instead of presenting it as dead clutter. */}
                      {isGauntletUpgrade(id) && (
                        <span className="font-tech text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                          EQUIPPED
                        </span>
                      )}
                      <span className="absolute top-1.5 right-2 font-mono text-[10px] font-bold text-slate-400 bg-slate-950/80 px-1.5 py-0.2 rounded-md">
                        {count}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Inspector */}
          <div className="w-5/12 p-6 flex flex-col justify-between overflow-y-auto bg-slate-900/20">
            {activeItem ? (
              <>
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold shadow-lg"
                      style={{
                        backgroundColor: `${activeItem.color}25`,
                        border: `1px solid ${activeItem.color}60`,
                        color: activeItem.color,
                      }}
                    >
                      {React.createElement(itemIcon(activeItem.iconName), { className: 'w-7 h-7' })}
                    </div>
                    <div>
                      <h3 className="text-base font-tech font-bold text-white">{activeItem.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] uppercase font-tech px-2 py-0.5 rounded-full bg-slate-800 text-emerald-300 border border-slate-700">
                          {activeItem.rarity}
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Stock: {inventory[activeItem.id] || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed mb-6 bg-slate-800/30 p-3.5 rounded-2xl border border-slate-800">
                    {activeItem.description}
                  </p>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                      <span>Category</span>
                      <span className="font-tech uppercase text-slate-200">{activeItem.category}</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                      <span>Max Stack</span>
                      <span className="font-mono text-slate-200">{activeItem.maxStack}</span>
                    </div>
                    {isGauntletUpgrade(activeItem.id) && (
                      <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                        <span>Status</span>
                        <span className="font-tech uppercase text-emerald-300">Equipped — on your gauntlet</span>
                      </div>
                    )}
                    {isGearItem(activeItem.id) && (
                      <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                        <span>Tier</span>
                        <span className="font-tech uppercase text-amber-300">
                          {gearTierOf(activeItem.id) !== null
                            ? `Tier ${gearTierOf(activeItem.id)}`
                            : 'Issued — starter platform'}
                        </span>
                      </div>
                    )}
                    {/* Arsenal family rows (work order, 2026-10-17):
                        kind + tier, the seat, and the striker's
                        numbers — the same facts the codex dossier
                        shows, at pouch distance. */}
                    {familyEntryOf(activeItem.id) && (
                      <>
                        <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                          <span>{familyEntryOf(activeItem.id)!.kind === 'helmet' ? 'Helmet' : familyEntryOf(activeItem.id)!.kind === 'boots' ? 'Quicksteps' : 'Arsenal'}</span>
                          <span className="font-tech uppercase text-rose-300">
                            {FAMILY_KIND_LABEL[familyEntryOf(activeItem.id)!.kind]} · Tier {familyEntryOf(activeItem.id)!.tier}
                          </span>
                        </div>
                        <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                          <span>Seat</span>
                          <span className="font-tech uppercase text-slate-200">
                            {/* Platforms Parallel (2026-10-17): every
                                kind names its own seat — the row was
                                written when only the arsenal had
                                family entries. */}
                            {familyEntryOf(activeItem.id)!.kind === 'defensive'
                              ? 'Left Hand'
                              : familyEntryOf(activeItem.id)!.kind === 'helmet'
                                ? 'Homestead Helm'
                                : familyEntryOf(activeItem.id)!.kind === 'boots'
                                  ? 'Quicksteps'
                                  : 'Gauntlet · Slot 7'}
                          </span>
                        </div>
                        {familyEntryOf(activeItem.id)!.damage !== undefined && (
                          <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                            <span>Strike</span>
                            <span className="font-mono text-slate-200">
                              {familyEntryOf(activeItem.id)!.damage} dmg · {familyEntryOf(activeItem.id)!.cooldownSeconds}s · {familyEntryOf(activeItem.id)!.staminaCost} stam
                            </span>
                          </div>
                        )}
                        {familyEntryOf(activeItem.id)!.kind === 'defensive' && shieldGrowth && (
                          <>
                          <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                            <span>Graft Slot</span>
                            <span className={`font-tech uppercase ${graftOf(shieldGrowth, activeItem.id) ? 'text-emerald-300' : 'text-slate-500'}`}>
                              {(() => {
                                const g = graftOf(shieldGrowth, activeItem.id);
                                return g
                                  ? `${SHIELD_GRAFTS[g].name} — answers ${SHIELD_GRAFTS[g].reflectPassive} / ${SHIELD_GRAFTS[g].reflectBraced} braced`
                                  : 'Not grafted';
                              })()}
                            </span>
                          </div>
                          <div className="flex justify-between py-1.5 border-b border-slate-800 text-slate-400">
                            <span>Lodestone Slot</span>
                            <span className={`font-tech uppercase ${lodestoneOf(shieldGrowth, activeItem.id) ? 'text-emerald-300' : 'text-slate-500'}`}>
                              {lodestoneOf(shieldGrowth, activeItem.id)
                                ? `Set — the pull runs ${DROP_MAGNET_CARRIED.radius} m worn, ${DROP_MAGNET_BRACED.radius} m braced`
                                : 'Not set'}
                            </span>
                          </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                  {/* A shield's ward, in its registry lines —
                      the same signatures the codex dossier
                      renders (data, not surface copy). */}
                  {familyEntryOf(activeItem.id)?.signatures && (
                    <ul className="space-y-1.5 mt-3">
                      {familyEntryOf(activeItem.id)!.signatures!.map((line, i) => (
                        <li key={i} className="text-[11px] text-slate-400 leading-relaxed flex gap-2">
                          <span className="text-rose-300/70 shrink-0">◈</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {/* The family's rules, where the item sits: the
                      strikers' ladder consumes its lower rung;
                      the shield line branches instead. */}
                  {familyEntryOf(activeItem.id) && (
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-3">
                      {familyEntryOf(activeItem.id)!.kind === 'defensive'
                        ? 'The shield line branches from the Scute Shield: later shields buy a different gift — light, wrap, or pull — not a stronger wall. This shield’s signatures above say which branch it is.'
                        : familyEntryOf(activeItem.id)!.kind === 'helmet'
                          ? 'A growth of the helm: owning it is wearing it, and the platform carries every growth at once — no lens or listener replaces another.'
                          : familyEntryOf(activeItem.id)!.kind === 'boots'
                            ? 'A growth of the Quicksteps: owning it is wearing it, and the pair carries every growth at once — one for each impediment, none replacing another.'
                            : consumedRung(familyEntryOf(activeItem.id)!)
                              ? `Grown from the ${ITEMS[consumedRung(familyEntryOf(activeItem.id)!)!.itemId]?.name}, which the growing consumed — a higher striker tier replaces the lower, never stacks beside it.`
                              : 'A striker of the ladder: the next tier of its kind is grown FROM this one and consumes it.'}
                    </p>
                  )}
                  {/* What a tier IS, said once where players look
                      at parts (Adam, 2026-10-15): the number counts
                      the recipe's depth, and it is the same number
                      the forge tether enforces. */}
                  {isGearItem(activeItem.id) && (
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-3">
                      A part's tier counts its recipe's depth — every crafted ingredient adds one.
                      Tier 3 work happens at the forge.
                    </p>
                  )}
                </div>

                {/* Quick Equip / Action Button */}
                <div className="pt-4 border-t border-slate-800/80">
                  {activeItem.category === 'structure' && (
                    <button
                      onClick={handleEquip}
                      className="w-full py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 font-tech font-bold text-xs tracking-wider text-white flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
                    >
                      <Hammer className="w-4 h-4" />
                      <span>EQUIP AS ACTIVE BLUEPRINT</span>
                    </button>
                  )}

                  {activeItem.category === 'seed' && (
                    <button
                      onClick={handleEquip}
                      className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-tech font-bold text-xs tracking-wider text-white flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all"
                    >
                      <Sprout className="w-4 h-4" />
                      <span>EQUIP FOR PLANTER TROWEL</span>
                    </button>
                  )}

                  {activeItem.category === 'fertilizer' && (
                    <button
                      onClick={handleEquip}
                      className="w-full py-3 rounded-2xl bg-teal-600 hover:bg-teal-500 font-tech font-bold text-xs tracking-wider text-white flex items-center justify-center gap-2 shadow-lg shadow-teal-600/20 active:scale-95 transition-all"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                      <span>SELECT FOR FERTILIZING</span>
                    </button>
                  )}
                </div>
              </>
            ) : (
              <div className="h-full flex items-center justify-center text-slate-500 text-xs">
                Select an item to view properties
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
