import React, { useState } from 'react';
import { X, Sparkles, Check, AlertCircle, ArrowRight, Search, Sprout } from 'lucide-react';
import { CraftingRecipe, ItemId, StructureType } from '../types/game';
import { ITEMS, RECIPES, HELMET_GEAR_ITEM_IDS, BOOTS_GEAR_ITEM_IDS } from '../game/items/constants'
import { isGauntletUpgrade, isGearItem, gearTierOf, accessTierOf } from '../game/quests/quests';
import { BASE_SUPPLY_GROUPS, baseSupplyGroupOf, isBaseSupply } from '../game/items/baseSupplies';
import { soundEngine } from '../audio/soundEngine';
import { RecipeFlowchart } from './RecipeFlowchart';
// Arsenal kind chips on weapon recipes (work order, 2026-10-17):
// a recipe that grows a striker or shield says its kind beside
// its tier, in the family's rose.
import { FAMILY_KIND_LABEL, familyEntryOf } from '../game/items/weaponsFamily';
import { POUCH_UPGRADE_ITEMS, pouchTierOf } from '../game/items/pouch';
// The Shield tab's membership is the shield rules table's own
// list — crafts and graft recipes alike output a shield item.
// The graft-slot lock (HUD audit, 2026-10-17) reads the same
// module: a graft recipe whose target already wears a graft
// must not stay READY — crafting it would burn the materials
// on a no-op.
import { isShieldItem, graftOf, SHIELD_GRAFTS, type ShieldGrowthMap } from '../game/creatures/shields';

interface BioForgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventory: Record<ItemId, number>;
  nearForge: boolean;
  hasSynthesizer: boolean;
  /** The shield graft slots as worn — a graft recipe locks
   *  when its target's slot already reads a graft. */
  shieldGrowth?: ShieldGrowthMap;
  onCraftRecipe: (recipe: CraftingRecipe) => void;
  /** Grow Prerequisites (Adam, 2026-10-16): grow a short
   *  reagent's whole chain for the selected recipe in one pass. */
  onGrowPrerequisites?: (recipe: CraftingRecipe, ingredientId: ItemId) => void;
  onSelectStructureBlueprint?: (type: StructureType) => void;
}

export const BioForgeModal: React.FC<BioForgeModalProps> = ({
  isOpen,
  onClose,
  inventory,
  nearForge,
  hasSynthesizer,
  shieldGrowth,
  onCraftRecipe,
  onGrowPrerequisites,
  onSelectStructureBlueprint,
}) => {
  const [activeCategory, setActiveCategory] = useState<'all' | 'seeds' | 'fertilizers' | 'composites' | 'defenses' | 'gauntlet' | 'helmet' | 'boots' | 'shield' | 'base'>('all');
  const [selectedRecipe, setSelectedRecipe] = useState<CraftingRecipe>(RECIPES[0]);
  const [isCrafting, setIsCrafting] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'tree'>('list');
  // Every hook lives ABOVE the isOpen early return below: a hook
  // under it changes the hook count when the modal opens, React
  // throws, and the whole app unmounts to a black screen (the
  // B-key bug, found 2026-10-16 — this filter's first home was
  // under that return in both tabbed screens).
  const [tierFilter, setTierFilter] = useState<'all' | 'raw' | 1 | 2 | 3>('all');
  // Search (Adam, 2026-10-16): three or more letters, matched as
  // a consecutive substring of the item's name, case-blind —
  // "vat", "Cul" and "ulture" all find the Culture Vat. While a
  // search is live it searches EVERYTHING (tabs and tier row
  // stand down), because a finder that respects the filter you
  // forgot you set is a finder that lies.
  const [searchQuery, setSearchQuery] = useState('');
  const searchTerm = searchQuery.trim().toLowerCase();
  const searchActive = searchTerm.length >= 3;
  const matchesSearch = (r: CraftingRecipe) =>
    (ITEMS[r.outputId]?.name ?? '').toLowerCase().includes(searchTerm);

  if (!isOpen) return null;

  const filteredRecipes = RECIPES.filter((r) => {
    if (activeCategory === 'all') return true;
    // Base Supplies (Adam, 2026-10-16): everything you'd build
    // the base with — the classifier lives in game/baseSupplies
    // and is shared with the pouch, so the shelf never drifts.
    if (activeCategory === 'base') return isBaseSupply(r.outputId);
    // Gear-line tabs (Adam, 2026-10-15) filter by what a recipe
    // MAKES, not by its recipe category: the Gauntlet tab gathers
    // the one-time gauntlet upgrades (modules + Field Synthesizer),
    // the Helmet tab the helmet-line set. The recipes keep their
    // home categories too — these tabs are dedicated gatherings,
    // not moves. The gauntlet itself never appears under any tab:
    // it is issued at arrival, not crafted.
    if (activeCategory === 'gauntlet') return isGauntletUpgrade(r.outputId);
    if (activeCategory === 'helmet') return HELMET_GEAR_ITEM_IDS.includes(r.outputId);
    if (activeCategory === 'boots') return BOOTS_GEAR_ITEM_IDS.includes(r.outputId);
    // The Shield tab (Adam, 2026-10-17): every recipe that
    // grows a shield OR grows onto one — isShieldItem on the
    // output catches both, since a graft recipe's output is
    // the shield it grows onto.
    if (activeCategory === 'shield') return isShieldItem(r.outputId);
    return r.category === activeCategory;
  });

  // Second tab row (Adam, 2026-10-15): a TIER filter that composes
  // with the category/gear tabs. Numeric bands read the ACCESS
  // tier (so the label and the lock keep agreeing); the forge's
  // Raw band means crafts that MAKE raw materials — ingredient
  // goods like compost and subassemblies — since a recipe itself
  // is never uncrafted. In a tier view the list groups by item
  // type (the output's category), per Adam's shape.
  const tierVisible = (r: CraftingRecipe): boolean => {
    if (tierFilter === 'all') return true;
    if (tierFilter === 'raw') return ITEMS[r.outputId]?.category === 'raw';
    return accessTierOf(r) === tierFilter;
  };
  const visibleRecipes = searchActive
    ? RECIPES.filter(matchesSearch)
    : filteredRecipes.filter(tierVisible);
  const TYPE_GROUPS: { id: string; label: string }[] = [
    { id: 'equipment', label: 'Equipment' },
    { id: 'structure', label: 'Structures' },
    { id: 'fertilizer', label: 'Fertilizers' },
    { id: 'seed', label: 'Seeds' },
    { id: 'raw', label: 'Raw Materials' },
  ];
  type ListEntry =
    | { kind: 'heading'; label: string }
    | { kind: 'recipe'; recipe: CraftingRecipe };
  const listEntries: ListEntry[] = [];
  if (searchActive || (tierFilter === 'all' && activeCategory !== 'base')) {
    visibleRecipes.forEach((recipe) => listEntries.push({ kind: 'recipe', recipe }));
  } else if (activeCategory === 'base') {
    // The Base Supplies shelf groups by what a piece is FOR in
    // the base (game/baseSupplies), with the tier row still
    // filtering which pieces show.
    for (const g of BASE_SUPPLY_GROUPS) {
      const rs = visibleRecipes.filter((r) => baseSupplyGroupOf(r.outputId) === g.id);
      if (rs.length === 0) continue;
      listEntries.push({ kind: 'heading', label: g.label });
      rs.forEach((recipe) => listEntries.push({ kind: 'recipe', recipe }));
    }
  } else {
    for (const g of TYPE_GROUPS) {
      const rs = visibleRecipes.filter((r) => ITEMS[r.outputId]?.category === g.id);
      if (rs.length === 0) continue;
      listEntries.push({ kind: 'heading', label: g.label });
      rs.forEach((recipe) => listEntries.push({ kind: 'recipe', recipe }));
    }
  }

  const hasIngredients = (recipe: CraftingRecipe) => {
    return recipe.ingredients.every((ing) => (inventory[ing.id] || 0) >= ing.count);
  };

  const canCraft = (recipe: CraftingRecipe) => {
    // One-time gauntlet upgrades lock while owned (Adam, 2026-10-15):
    // owning one IS wearing it (auto-equipped), so a second craft
    // would only burn ingredients on a duplicate that cannot stack.
    if (isGauntletUpgrade(recipe.outputId) && (inventory[recipe.outputId] || 0) > 0) return false;
    // The graft-slot lock (HUD audit, 2026-10-17): one graft per
    // shield — a filled slot refuses the recipe outright.
    if (recipe.graftShield && graftOf(shieldGrowth, recipe.graftShield)) return false;
    // The pouch-tier lock (Adam's play pass, 2026-10-17): the
    // carrying ladder's upgrades are one-time and maxStack 1 —
    // owning one IS the tier, so a re-craft would only burn
    // ingredients on a duplicate that cannot stack. Tier-aware
    // (dev lane's boundary nuance): the tiers never consume,
    // so crafting a tier BENEATH the one you carry is the same
    // paid no-op one rung down — the lock keys on the carried
    // tier, not the item.
    if (POUCH_UPGRADE_ITEMS.includes(recipe.outputId) && pouchTierOf(inventory) >= POUCH_UPGRADE_ITEMS.indexOf(recipe.outputId) + 1) return false;
    if (!hasIngredients(recipe)) return false;
    if (nearForge) return true;
    if (accessTierOf(recipe) >= 3) return false;
    return hasSynthesizer;
  };

  const craftBlockReason = (recipe: CraftingRecipe): string | null => {
    // The owned-upgrade lock speaks first — it is the stable fact
    // about this recipe, ingredients come and go.
    if (isGauntletUpgrade(recipe.outputId) && (inventory[recipe.outputId] || 0) > 0)
      return 'Already grafted onto your gauntlet';
    // The filled graft slot speaks just as early, in the same
    // shape: name the graft the shield already wears.
    if (recipe.graftShield) {
      const worn = graftOf(shieldGrowth, recipe.graftShield);
      if (worn) return `Already grafted — ${SHIELD_GRAFTS[worn].name}`;
    }
    // The carried pouch tier speaks in the same family: an
    // owned upgrade is already the player's carrying tier —
    // and a surpassed tier reads the same, by the same rule.
    if (POUCH_UPGRADE_ITEMS.includes(recipe.outputId) && pouchTierOf(inventory) >= POUCH_UPGRADE_ITEMS.indexOf(recipe.outputId) + 1)
      return 'Already crafted — you already carry this tier or better';
    if (!hasIngredients(recipe)) return 'Missing ingredients';
    if (nearForge) return null;
    if (accessTierOf(recipe) >= 3) return 'Advanced synthesis requires a bio-forge station';
    if (!hasSynthesizer) return 'Too far from a bio-forge — the Field Synthesizer lets you craft in the field';
    return null;
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

        {/* Search (Adam, 2026-10-16): near the top, over both
            tab rows. Three letters or more and the list becomes
            every recipe whose product's name holds those letters
            in a row — tabs and tiers stand down until it clears. */}
        <div className="px-6 pt-3 pb-1 flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search recipes… (3+ letters)"
              className="w-full bg-slate-900/70 border border-slate-700/70 rounded-xl pl-8 pr-8 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-cyan-500/50"
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
            <span className="text-[11px] text-cyan-300/90 font-tech">
              {visibleRecipes.length} match{visibleRecipes.length === 1 ? '' : 'es'} for “{searchQuery.trim()}” — searching all recipes
            </span>
          )}
        </div>

        {/* Categories Bar */}
        <div className="px-6 py-3 border-b border-slate-800/70 bg-slate-900/30 flex items-center gap-2 overflow-x-auto">
          {[
            { id: 'all', label: 'All Synthetics' },
            { id: 'gauntlet', label: 'Gauntlet' },
            { id: 'helmet', label: 'Helmet' },
            { id: 'boots', label: 'Quicksteps' },
            { id: 'shield', label: 'Shield' },
            { id: 'seeds', label: 'Spore & Seeds' },
            { id: 'fertilizers', label: 'Fertilizers' },
            { id: 'composites', label: 'Living Composites' },
            { id: 'defenses', label: 'Bio-Defenses' },
            { id: 'base', label: 'Base Supplies' },
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
          <div className="ml-auto flex items-center gap-1 pl-3 border-l border-slate-800/70">
            {(['list', 'tree'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 rounded-xl text-xs font-tech transition-all ${
                  viewMode === mode
                    ? 'bg-teal-500/20 text-teal-300 border border-teal-500/40'
                    : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                {mode === 'list' ? 'List' : 'Tree'}
              </button>
            ))}
          </div>
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

        {/* Content Body */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Recipe List / Tree */}
          <div className="w-1/2 border-r border-slate-800/80 overflow-hidden">
            {viewMode === 'tree' && !searchActive ? (
              <RecipeFlowchart
                inventory={inventory}
                nearForge={nearForge}
                hasSynthesizer={hasSynthesizer}
                selectedRecipeId={selectedRecipe.id}
                onSelectRecipe={setSelectedRecipe}
              />
            ) : (
              <div className="h-full overflow-y-auto p-4 space-y-2">
                {/* The upgrade ENTRIES at the forge (Adam,
                    2026-10-17): a platform tab opens by naming
                    the upgrades it gathers, so the Shield tab
                    reads as the slot + branches, not a bare
                    recipe pile. */}
                {!searchActive && activeCategory === 'shield' && (
                  <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-3.5">
                    <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-rose-200 mb-1">
                      The Left Hand’s Ward — Upgrades
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Four shields below, and the one graft that grows onto any of them: Thorn Spikes,
                      in the Graft Slot. The line branches, never climbs — the Lantern buys light, the
                      Fenback buys the wrap and its Spore Answer, the Bulwark buys the Pull.
                    </p>
                  </div>
                )}
                {!searchActive && activeCategory === 'boots' && (
                  <div className="rounded-2xl border border-lime-500/30 bg-lime-950/20 p-3.5">
                    <h4 className="text-[11px] font-tech font-bold uppercase tracking-wider text-lime-200 mb-1">
                      The Quicksteps — Upgrades
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      One grown pair below, and a growth for every impediment the country puts
                      underfoot: Waders for the marsh, Stillsteps for still water, Webfoots for the
                      swim, Ember Soles for the fire. Every growth mounts the same pair, at once.
                    </p>
                  </div>
                )}
                {visibleRecipes.length === 0 && (
                  <div className="text-center text-slate-500 text-xs font-tech py-10">
                    {searchActive
                      ? `No recipes match “${searchQuery.trim()}”.`
                      : 'Nothing here yet.'}
                  </div>
                )}
                {listEntries.map((entry) => {
              if (entry.kind === 'heading') {
                return (
                  <div key={entry.label} className="pt-2 pb-0.5 text-[10px] font-tech font-bold uppercase tracking-wider text-slate-500">
                    {entry.label}
                  </div>
                );
              }
              const recipe = entry.recipe;
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
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-semibold text-slate-100">{recipe.name}</h4>
                        {/* Gear parts carry their tier (Adam,
                            2026-10-15) — graph-derived, see
                            gearTierOf in game/quests/quests.ts. */}
                        {isGearItem(recipe.outputId) && gearTierOf(recipe.outputId) !== null && (
                          <span className="text-[9px] font-tech font-bold px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            TIER {gearTierOf(recipe.outputId)}
                          </span>
                        )}
                        {recipe.graftShield ? (
                          // A graft recipe grows into the shield's
                          // SLOT, not into a new shield: its chip
                          // names the slot, not the base shield's
                          // family tier (Platforms Parallel).
                          <span className="text-[9px] font-tech font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            GRAFT SLOT
                          </span>
                        ) : familyEntryOf(recipe.outputId) && (
                          <span className="text-[9px] font-tech font-bold px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                            {FAMILY_KIND_LABEL[familyEntryOf(recipe.outputId)!.kind].toUpperCase()} · T{familyEntryOf(recipe.outputId)!.tier}
                          </span>
                        )}
                      </div>
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
            )}
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
                    <h3 className="text-base font-tech font-bold text-white">{selectedRecipe.graftShield ? selectedRecipe.name : outputItem.name}</h3>
                    <span className="text-[10px] uppercase font-tech px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                      {outputItem.rarity}
                    </span>
                    {isGearItem(outputItem.id) && gearTierOf(outputItem.id) !== null && (
                      <span className="text-[10px] uppercase font-tech font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                        Tier {gearTierOf(outputItem.id)}
                      </span>
                    )}
                    {selectedRecipe.graftShield ? (
                      <span className="text-[10px] uppercase font-tech font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        Graft Slot
                      </span>
                    ) : familyEntryOf(outputItem.id) && (
                      <span className="text-[10px] uppercase font-tech font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-500/30">
                        {FAMILY_KIND_LABEL[familyEntryOf(outputItem.id)!.kind]} · Tier {familyEntryOf(outputItem.id)!.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {selectedRecipe.graftShield ? selectedRecipe.description : outputItem.description}
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
                          {/* Grow Prerequisites (Adam, 2026-10-16):
                              a short reagent that is itself crafted
                              offers to grow its whole chain in one
                              pass, right here — no bouncing between
                              recipes to assemble a Tier 2/3 craft. */}
                          {!hasEnough && onGrowPrerequisites && RECIPES.some((r) => r.outputId === ing.id) && (
                            <button
                              onClick={() => onGrowPrerequisites(selectedRecipe, ing.id)}
                              disabled={isCrafting}
                              title={`Grow the ${ingItem.name} this recipe needs — and anything IT needs — in one pass`}
                              className="flex items-center gap-1 text-[10px] font-tech font-bold px-2 py-1 rounded-lg border border-emerald-500/40 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25 disabled:opacity-50 transition-colors"
                            >
                              <Sprout className="w-3 h-3" />
                              Grow Prerequisites
                            </button>
                          )}
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
              {craftBlockReason(selectedRecipe) && !isCrafting && (
                <p className="mt-2 text-xs text-amber-400/90 text-center flex items-center justify-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{craftBlockReason(selectedRecipe)}</span>
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
