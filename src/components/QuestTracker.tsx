/**
 * QuestTracker — the little quest HUD (Adam, 2026-10-15).
 *
 * A compact card that follows ONE mini-quest: its title and a row
 * per gather objective, each carrying a checkmark once the item is
 * in the pouch (Adam: "checkmarks for gathered items"). For module
 * quests the last row is the craft itself — it checks when the
 * module is grafted on and the tool unlocks.
 *
 * Visibility is a preference owned by the quest LIST (the checkbox
 * there shows/hides this card — App renders it only when the
 * player's showHud preference is on). One door, one switch: the
 * button up top and the Q hotkey both open the list, never this
 * card directly.
 */
import { ITEMS } from '../game/constants';
import type { QuestProgressView } from '../game/quests';
import { MODULE_FOR_TOOL, TOOL_NAMES } from '../game/quests';

interface QuestTrackerProps {
  view: QuestProgressView;
}

export const QuestTracker = ({ view }: QuestTrackerProps) => {
  const { def, gather } = view;
  const unlockDone = def.unlockTool ? view.complete : false;

  return (
    <div className="pointer-events-none w-52 min-[760px]:w-60 rounded-2xl border border-emerald-400/25 bg-slate-950/70 backdrop-blur-md px-3.5 py-3 shadow-xl">
      {/* Header: tier chip + quest title */}
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-black tracking-[0.18em] px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-400/30 text-emerald-300">
          TIER {def.tier}
        </span>
        <span className="text-[10px] font-black tracking-[0.18em] text-emerald-200/70">
          MINI-QUEST
        </span>
      </div>
      <div className="mt-1 text-sm font-bold text-slate-100 leading-tight">
        {def.title}
      </div>

      {/* Gather objectives — the checkmark list */}
      <ul className="mt-2 space-y-1">
        {gather.map((g) => (
          <li
            key={g.itemId}
            className={`flex items-center gap-2 text-xs ${
              g.done ? 'text-emerald-300' : 'text-slate-300'
            }`}
          >
            <span
              className={`flex-none w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-black ${
                g.done
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                  : 'border-slate-600 text-transparent'
              }`}
            >
              ✓
            </span>
            <span className="flex-1 truncate">
              {ITEMS[g.itemId]?.name ?? g.itemId}
            </span>
            <span className="font-mono text-[11px] text-slate-400">
              {Math.min(g.have, g.count)}/{g.count}
            </span>
          </li>
        ))}

        {/* The craft step itself, for module quests */}
        {def.unlockTool && (
          <li
            className={`flex items-center gap-2 text-xs ${
              unlockDone ? 'text-emerald-300' : 'text-amber-200'
            }`}
          >
            <span
              className={`flex-none w-4 h-4 rounded-md border flex items-center justify-center text-[10px] font-black ${
                unlockDone
                  ? 'bg-emerald-500/25 border-emerald-400/50 text-emerald-300'
                  : 'border-amber-400/50 text-transparent'
              }`}
            >
              ✓
            </span>
            <span className="flex-1 truncate">
              Craft the module — unlock {TOOL_NAMES[def.unlockTool]}
              {MODULE_FOR_TOOL[def.unlockTool] ? '' : ''}
            </span>
          </li>
        )}
      </ul>
    </div>
  );
};
