import React, { useState } from 'react';
import { X, Sparkles, Check, AlertCircle, ArrowRight } from 'lucide-react';
import { CraftingRecipe, ItemId, StructureType } from '../types/game';
import { ITEMS, RECIPES } from '../game/constants';
import { soundEngine } from '../audio/soundEngine';

interface BioForgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<ItemId, number>;
  onCraftRecipe: (recipe: CraftingRecipe) => void;
  onSelectStructureBlueprint?: (type: StructureType) => void;
}

export const BioForgeModal: React.FC<BioForgeModalProps> = ({
  isOpen,
  onClose,
  inventory,
  onCraftRecipe,
  onSelectStructureBlueprint,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'seeds' | 'fertilizers' | 'composites' | 'defenses'>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe>(RECIPES[0]);
  const [isCrafting, setIsCrafting] = useState(false);

  if (!isOpen) return null;

  const filteredRecipes = RECIPES.filter(
    (r) => activeCategory === 'all' || r.category === activeCategory
  );

  const canCraft = (recipe: CraftingRecipe) => {
    return recipe.ingredients.every((ing) => (inventory[ing.id] || 0) >= ing.count);
  };

  const handleCraft = (recipe: CraftingRecipe) => {
    if (!canCraft(recipe) || isCrafting) return;
    setIsCrafting(true);

    setTimeout(() => {
      onCraftRecipe(recipe);
      soundEngine.playCraftSuccess();
      setIsCrafting(false);

      // If it's a structure, auto select it for building
      if (ITEMS[recipe.outputId].category === 'structure' && onSelectStructureBlueprint) {
        onSelectStructureBlueprint(recipe.outputId as StructureType);
      }
    }, recipe.craftTimeMs * 0.4); // Snappy feedback
  };

  const outputItem = ITEMS[selectedRecipe.outputId];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-4xl h-[640px] rounded-3xl flex flex-col overflow-hidden border border-cyan-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">
                BIO-FORGE WORKSTATION
              </h2>
              <p className="text-xs text-slate-400">
                Molecular Synthesis of Living Seeds, Fertilizers & Bio-Composites
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
            { id: 'all', label: 'All Synthetics' },
            { id: 'seeds', label: 'Spore & Seeds' },
            { id: 'fertilizers', label: 'Fertilizers' },
            { id: 'composites', label: 'Living Composites' },
            { id: 'defenses', label: 'Bio-Defenses' },
          ].map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id as typeof activeCategory)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-medium font-tech transition-all ${
                activeCategory === cat.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Recipe List */}
          <div className="w-1/2 border-r border-slate-800/80 overflow-y-auto p-4 space-y-2">
            {filteredRecipes.map((recipe) => {
              const item = ITEMS[recipe.outputId];
              const craftable = canCraft(recipe);
              const isSelected = selectedRecipe.id === recipe.id;

              return (
                <div
                  key={recipe.id}
                  onClick={() => setSelectedRecipe(recipe)}
                  className={`p-3 rounded-2xl border cursor-pointer transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-slate-800/80 border-cyan-500 shadow-md shadow-cyan-950/50'
                      : 'bg-slate-900/40 border-slate-800/60 hover:bg-slate-800/40'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shadow-inner"
                      style={{
                        backgroundColor: `${item.color}20`,
                        border: `1px solid ${item.color}40`,
                        color: item.color,
                      }}
                    >
                      {recipe.outputCount}x
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{recipe.name}</h4>
                      <p className="text-[11px] text-slate-400 line-clamp-1">{recipe.description}</p>
                    </div>
                  </div>

                  <div>
                    {craftable ? (
                      <span className="text-[10px] font-tech font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        READY
                      </span>
                    ) : (
                      <span className="text-[10px] font-tech px-2 py-0.5 rounded-full bg-slate-800 text-slate-500">
                        MISSING
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right: Synthesis Details & Action */}
          <div className="w-1/2 p-6 flex flex-col justify-between overflow-y-auto bg-slate-900/20">
            <div>
              {/* Output Preview */}
              <div className="flex items-start gap-4 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/50 mb-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold shrink-0 shadow-lg"
                  style={{
                    backgroundColor: `${outputItem.color}25`,
                    border: `1px solid ${outputItem.color}60`,
                    color: outputItem.color,
                  }}
                >
                  {selectedRecipe.outputCount}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-tech font-bold text-white">{outputItem.name}</h3>
                    <span className="text-[10px] uppercase font-tech px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                      {outputItem.rarity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {outputItem.description}
                  </p>
                </div>
              </div>

              {/* Required Bio-Reagents */}
              <div className="mb-6">
                <h4 className="text-xs font-tech font-semibold tracking-wider text-slate-400 uppercase mb-3">
                  Required Bio-Reagents
                </h4>
                <div className="space-y-2">
                  {selectedRecipe.ingredients.map((ing) => {
                    const ingItem = ITEMS[ing.id];
                    const currentAmount = inventory[ing.id] || 0;
                    const hasEnough = currentAmount >= ing.count;

                    return (
                      <div
                        key={ing.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                          hasEnough
                            ? 'bg-slate-800/40 border-slate-700/60 text-slate-200'
                            : 'bg-red-950/20 border-red-900/40 text-red-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: ingItem.color }}
                          />
                          <span className="font-medium">{ingItem.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono font-semibold">
                          <span>{currentAmount}</span>
                          <span className="text-slate-500">/</span>
                          <span>{ing.count}</span>
                          {hasEnough ? (
                            <Check className="w-3.5 h-3.5 text-emerald-400 ml-1" />
                          ) : (
                            <AlertCircle className="w-3.5 h-3.5 text-red-400 ml-1" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Synthesize Button */}
            <div className="pt-4 border-t border-slate-800/80">
              <button
                disabled={!canCraft(selectedRecipe) || isCrafting}
                onClick={() => handleCraft(selectedRecipe)}
                className={`w-full py-3.5 rounded-2xl font-tech font-bold text-sm tracking-wide flex items-center justify-center gap-2 transition-all shadow-xl ${
                  canCraft(selectedRecipe) && !isCrafting
                    ? 'bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 shadow-cyan-500/25 active:scale-[0.98]'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {isCrafting ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin text-cyan-950" />
                    <span>SYNTHESIZING LIVING COMPOSITE...</span>
                  </>
                ) : (
                  <>
                    <span>BIO-FORGE SYNTHESIS</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
