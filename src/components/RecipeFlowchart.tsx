import React, { useMemo } from 'react';
import {
  AlertTriangle,
  Bell,
  Circle,
  CircleDot,
  CloudRain,
  Cpu,
  Droplet,
  Droplets,
  Flame,
  Flower,
  Gem,
  Grid,
  Layers,
  Lightbulb,
  Maximize2,
  Shield,
  Sparkle,
  Sparkles,
  Sprout,
  Square,
  Sun,
  Target,
  Umbrella,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { CraftingRecipe, ItemId } from '../types/game';
import { ITEMS, RECIPES } from '../game/constants';

const ICONS: Record<string, LucideIcon> = {
  AlertTriangle,
  Bell,
  Circle,
  CircleDot,
  CloudRain,
  Cpu,
  Droplet,
  Droplets,
  Flame,
  Flower,
  Gem,
  Grid,
  Layers,
  Lightbulb,
  Maximize2,
  Shield,
  Sparkle,
  Sparkles,
  Sprout,
  Square,
  Sun,
  Target,
  Umbrella,
  Zap,
};

interface RecipeFlowchartProps {
  inventory: Record<ItemId, number>;
  nearForge: boolean;
  hasGauntlet: boolean;
  selectedRecipeId: string;
  onSelectRecipe: (recipe: CraftingRecipe) => void;
}

const NODE_W = 172;
const NODE_H = 70;
const COL_GAP = 100;
const ROW_GAP = 14;
const PAD = 24;

type NodeStatus = 'ready' | 'locked' | 'missing';

export const RecipeFlowchart: React.FC<RecipeFlowchartProps> = ({
  inventory,
  nearForge,
  hasGauntlet,
  selectedRecipeId,
  onSelectRecipe,
}) => {
  const graph = useMemo(() => {
    const producerOf = new Map<ItemId, CraftingRecipe>();
    for (const r of RECIPES) {
      if (!producerOf.has(r.outputId)) {
        producerOf.set(r.outputId, r);
      }
    }

    const depths = new Map<string, number>();
    const visiting = new Set<string>();
    const depthOf = (r: CraftingRecipe): number => {
      const cached = depths.get(r.id);
      if (cached !== undefined) {
        return cached;
      }
      if (visiting.has(r.id)) {
        return 0;
      }
      visiting.add(r.id);
      let d = 0;
      for (const ing of r.ingredients) {
        const p = producerOf.get(ing.id);
        if (p && p.id !== r.id) {
          d = Math.max(d, depthOf(p) + 1);
        }
      }
      visiting.delete(r.id);
      depths.set(r.id, d);
      return d;
    };

    const edges: { from: CraftingRecipe; to: CraftingRecipe }[] = [];
    for (const r of RECIPES) {
      for (const ing of r.ingredients) {
        const p = producerOf.get(ing.id);
        if (p && p.id !== r.id) {
          edges.push({ from: p, to: r });
        }
      }
    }

    const columns = new Map<number, CraftingRecipe[]>();
    for (const r of RECIPES) {
      const d = depthOf(r);
      const list = columns.get(d) || [];
      list.push(r);
      columns.set(d, list);
    }
    for (const list of columns.values()) {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }
    return { edges, columns };
  }, []);

  const nodeStatus = (r: CraftingRecipe): NodeStatus => {
    const hasIng = r.ingredients.every((ing) => (inventory[ing.id] || 0) >= ing.count);
    if (!hasIng) {
      return 'missing';
    }
    if (nearForge) {
      return 'ready';
    }
    if (r.tier === 3) {
      return 'locked';
    }
    return hasGauntlet ? 'ready' : 'locked';
  };

  const statusStyle: Record<NodeStatus, { border: string; label: string; labelColor: string }> = {
    ready: { border: 'rgba(52,211,153,0.55)', label: 'READY', labelColor: '#34d399' },
    locked: { border: 'rgba(251,191,36,0.45)', label: 'LOCKED', labelColor: '#fbbf24' },
    missing: { border: 'rgba(51,65,85,0.9)', label: 'MISSING', labelColor: '#64748b' },
  };

  const pos = new Map<string, { x: number; y: number }>();
  let maxX = 0;
  let maxY = 0;
  const sortedDepths = [...graph.columns.keys()].sort((a, b) => a - b);
  for (const d of sortedDepths) {
    const list = graph.columns.get(d) || [];
    list.forEach((r, i) => {
      const x = PAD + d * (NODE_W + COL_GAP);
      const y = PAD + i * (NODE_H + ROW_GAP);
      pos.set(r.id, { x, y });
      maxX = Math.max(maxX, x + NODE_W);
      maxY = Math.max(maxY, y + NODE_H);
    });
  }
  const canvasW = maxX + PAD;
  const canvasH = maxY + PAD;

  return (
    <div className="relative w-full h-full overflow-auto bg-slate-950/40">
      <div className="relative" style={{ width: canvasW, height: canvasH }}>
        <svg
          className="absolute top-0 left-0 pointer-events-none"
          width={canvasW}
          height={canvasH}
        >
          {graph.edges.map((e, i) => {
            const a = pos.get(e.from.id);
            const b = pos.get(e.to.id);
            if (!a || !b) {
              return null;
            }
            const x1 = a.x + NODE_W;
            const y1 = a.y + NODE_H / 2;
            const x2 = b.x;
            const y2 = b.y + NODE_H / 2;
            const mx = (x1 + x2) / 2;
            return (
              <path
                key={`${e.from.id}-${e.to.id}-${i}`}
                d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                fill="none"
                stroke="rgba(103,232,249,0.35)"
                strokeWidth={1.5}
              />
            );
          })}
        </svg>

        {sortedDepths.map((d) =>
          (graph.columns.get(d) || []).map((r) => {
            const p = pos.get(r.id);
            if (!p) {
              return null;
            }
            const item = ITEMS[r.outputId];
            const Icon = ICONS[item.iconName] || Sprout;
            const status = nodeStatus(r);
            const style = statusStyle[status];
            const isSelected = selectedRecipeId === r.id;
            return (
              <div
                key={r.id}
                onClick={() => onSelectRecipe(r)}
                className="absolute rounded-xl border p-2 cursor-pointer transition-all bg-slate-900/80 backdrop-blur-sm hover:bg-slate-800/80"
                style={{
                  left: p.x,
                  top: p.y,
                  width: NODE_W,
                  height: NODE_H,
                  borderColor: style.border,
                  boxShadow: isSelected ? `0 0 0 2px ${item.color}66` : undefined,
                }}
              >
                <div className="flex items-center gap-2 h-full">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${item.color}20`,
                      border: `1px solid ${item.color}50`,
                      color: item.color,
                    }}
                  >
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-slate-100 truncate">
                      {r.name}
                    </div>
                    <div
                      className="text-[10px] font-tech font-bold tracking-wide"
                      style={{ color: style.labelColor }}
                    >
                      {style.label}
                      {r.tier === 3 ? ' · T3' : ''}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
