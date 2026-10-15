import React, { useState } from 'react';
import { X, Backpack, Sparkles, Sprout, Hammer, ArrowUpRight } from 'lucide-react';
import { ItemId, StructureType, ToolType } from '../types/game';
import { ITEMS, HELMET_GEAR_ITEM_IDS, BOOTS_GEAR_ITEM_IDS } from '../game/constants';
import { isGauntletUpgrade, isGearItem, gearTierOf } from '../game/quests';
import { POUCH_TIER_CAPS, POUCH_TIER_NAMES, pouchTierOf } from '../game/pouch';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<ItemId, number>;
  onSelectBlueprint: (type: StructureType) => void;
  onSelectSeed: (seedId: ItemId) => void;
  onSelectFertilizer: (fertilizerId: ItemId) => void;
  onSelectTool: (tool: ToolType) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onSelectBlueprint,
  onSelectSeed,
  onSelectFertilizer,
  onSelectTool,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'raw' | 'seed' | 'fertilizer' | 'structure' | 'gauntlet' | 'helmet' | 'boots'>('all');
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null);

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
    return item.category === activeTab;
  });

  const activeItem = selectedItemId ? ITEMS[selectedItemId] : filteredItems.length > 0 ? ITEMS[filteredItems[0]] : null;

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

        {/* Categories Bar */}
        <div className="px-6 py-3 border-b border-slate-800/70 bg-slate-900/30 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Items' },
            { id: 'gauntlet', label: 'Gauntlet' },
            { id: 'helmet', label: 'Helmet' },
            { id: 'boots', label: 'Quicksteps' },
            { id: 'raw', label: 'Raw Harvests' },
            { id: 'seed', label: 'Flora Seeds' },
            { id: 'fertilizer', label: 'Fertilizers' },
            { id: 'structure', label: 'Bio-Composites' },
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

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left Grid */}
          <div className="w-7/12 border-r border-slate-800/80 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 text-xs">
                <Backpack className="w-8 h-8 mb-2 opacity-40" />
                <span>No bio-specimens stored in this category.</span>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2.5">
                {filteredItems.map((id) => {
                  const item = ITEMS[id];
                  const count = inventory[id] || 0;
                  const isSelected = activeItem?.id === id;

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
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <span className="text-[11px] font-semibold text-slate-200 text-center line-clamp-1 w-full">
                        {item.name}
                      </span>
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
                      <Sparkles className="w-7 h-7" />
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
                  </div>
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
