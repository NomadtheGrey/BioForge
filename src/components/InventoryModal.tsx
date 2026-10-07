import React, { useState } from 'react';
import { X, Backpack, Sparkles, Sprout, Hammer, ArrowUpRight } from 'lucide-react';
import { ItemId, StructureType, ToolType } from '../types/game';
import { ITEMS } from '../game/constants';

interface InventoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<ItemId, number>;
  onSelectBlueprint: (type: StructureType) => void;
  onSelectSeed: (seedId: ItemId) => void;
  onSelectTool: (tool: ToolType) => void;
}

export const InventoryModal: React.FC<InventoryModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onSelectBlueprint,
  onSelectSeed,
  onSelectTool,
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'raw' | 'seed' | 'fertilizer' | 'structure'>('all');
  const [selectedItemId, setSelectedItemId] = useState<ItemId | null>(null);

  if (!isOpen) return null;

  // Filter items in inventory that have count > 0
  const ownedItems = Object.entries(inventory)
    .filter(([_, count]) => (count as number) > 0)
    .map(([id]) => id as ItemId);

  const filteredItems = ownedItems.filter((id) => {
    const item = ITEMS[id];
    if (!item) return false;
    return activeTab === 'all' || item.category === activeTab;
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
                  </div>
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
