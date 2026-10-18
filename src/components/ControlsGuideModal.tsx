import React from 'react';
import { X, HelpCircle, Sparkles, Navigation, Layers, ShieldAlert, Cpu } from 'lucide-react';

interface ControlsGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ControlsGuideModal: React.FC<ControlsGuideModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-3xl h-[min(600px,94dvh)] rounded-3xl flex flex-col overflow-hidden border border-cyan-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-slate-800 bg-slate-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-tech font-bold text-white tracking-wide">
                EXPLORER'S FIELD MANUAL & CONTROLS
              </h2>
              <p className="text-xs text-slate-400">
                Keybindings, Cultivation Cycles, and Living Base Construction
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

        {/* Content Body */}
        <div className="flex-1 p-6 overflow-y-auto space-y-6">
          {/* Controls Grid */}
          <div>
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-cyan-400 mb-3 flex items-center gap-2">
              <Navigation className="w-4 h-4" /> 1st-Person Movement & Mouse-Look
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Move Forward / Strafe</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">W A S D</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Mouse-Look / Aim</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Click Screen (ESC to release)</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Interact / Use Active Tool</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Left Mouse Click</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Collision Physics</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-bold">Solid Walls & Dense Flora</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Jump</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Spacebar</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Bounce-Shroom Launch — bounce to the story above, steer mid-air to land on a floor tile</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Jump on / near a mature Bounce-Shroom</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Climb a Vine Ladder</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-bold">Click the Ladder</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Sprint</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Double-tap W</span>
              </div>
              {/* The water module's stance key (background lane's
                  consolidation, 2026-10-18): Quicksteps' second
                  growth holds the step on water; F trades it for
                  the swim, and back — only in the water, where
                  the in-game hint also names it. */}
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Water Module — switch between swimming and walking the water (second growth, in the water)</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">F</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Cycle Planting Stock / Blueprint (wheel) · Fertilizer / Blueprint (arrows, with the trowel or builder in hand) — the wheel walks every seed and plantable piece you carry</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Mouse Wheel · ↑ ↓</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Cycle the Left Hand — lantern ↔ Scute Shield ↔ Lantern Shield ↔ Fenback Shield, wrapping around what you own. The hand fills itself: grow or find a lantern or a shield and it is worn there at once — the hand stands empty only while you own nothing for it, and a piece worn in the hand is out of the pouch while you wear it. Ctrl is the left-hand modifier: it never touches the gauntlet's wheel. (Your browser reads Ctrl + wheel as page zoom — the game holds that off while you play; on a Mac, Ctrl + ↑ is the system's own shortcut, so Ctrl + wheel or the slot click is the hand's way there.) (The Prismatic Field Radar is helmet gear, not a Left Hand item.)</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Ctrl + Wheel · Ctrl + ↑ · Click the slot</span>
              </div>
              <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800 flex justify-between items-center">
                <span className="text-slate-300">Raise the Shield — hold to brace: frontal strikes are walled off at stamina's price. Lowered, a worn shield still blunts frontal strikes for free. (On touch, hold the RAISE button.)</span>
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold">Hold Right-Mouse</span>
              </div>
            </div>
          </div>

          {/* Tools & Hotkeys */}
          <div>
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-purple-400 mb-3 flex items-center gap-2">
              <Layers className="w-4 h-4" /> Bio-Suit Tools & Hotkeys
            </h3>
            <div className="grid grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2 text-teal-300 font-bold mb-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">[1]</span>
                  <span>Harvest Glove</span>
                </div>
                <p className="text-[11px] text-slate-400">Non-lethal extraction of resins, petals, fibers, and essences without harming plant life.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2 text-cyan-300 font-bold mb-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">[2]</span>
                  <span>Bio-Scanner</span>
                </div>
                <p className="text-[11px] text-slate-400">Scan flora, fauna, and structures to unlock entries and breeding notes in the Codex.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2 text-emerald-300 font-bold mb-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">[3]</span>
                  <span>Planter Trowel</span>
                </div>
                <p className="text-[11px] text-slate-400">Plant cultivated seeds into garden mounds and apply Growth or Yield Fertilizers.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2 text-rose-300 font-bold mb-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">[4]</span>
                  <span>Solvent Sprayer</span>
                </div>
                <p className="text-[11px] text-slate-400">Enzymatic deconstructor: dissolves bio-structures and refunds 100% of raw seed-nodes.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2 text-amber-300 font-bold mb-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">[5]</span>
                  <span>Taming Lure</span>
                </div>
                <p className="text-[11px] text-slate-400">Offer Sweet Nectar to Soft-Puffs or bait to Chitin-Stalkers to domesticate them as companions.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2 text-purple-300 font-bold mb-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">[6]</span>
                  <span>Bio-Builder</span>
                </div>
                <p className="text-[11px] text-slate-400">Grows interlocking root floors, chitin-glass walls, and proximity iris doors on grid cells. Pieces face the way you face (90° steps) — turn to make corners. Click a wall with a wall selected to stack a story; with a floor selected to lay a ceiling over your side; then click a ceiling tile to grow it toward where you face, middle tiles included. With a vine ladder selected, click a wall to grow a ladder up its face.</p>
              </div>

              <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800">
                <div className="flex items-center gap-2 text-yellow-300 font-bold mb-1">
                  <span className="font-mono bg-slate-800 px-1.5 py-0.2 rounded text-[11px]">[7]</span>
                  <span>Striker</span>
                </div>
                <p className="text-[11px] text-slate-400">The gauntlet's weapon slot — one grown striker at a time, close or ranged. With the Striker in hand, tap [7] again or roll the mouse wheel to swap between your best close and ranged weapons. Click a creature to strike it.</p>
              </div>
            </div>
          </div>

          {/* Quick Windows */}
          <div>
            <h3 className="text-xs font-tech font-bold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
              <Cpu className="w-4 h-4" /> Interface Shortcuts
            </h3>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-cyan-300 font-bold block mb-1">[B]</span>
                <span className="text-slate-300">Bio-Forge Crafting</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-emerald-300 font-bold block mb-1">[I]</span>
                <span className="text-slate-300">Storage Pouch</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-purple-300 font-bold block mb-1">[C]</span>
                <span className="text-slate-300">Ecosystem Codex</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-pink-300 font-bold block mb-1">[M]</span>
                <span className="text-slate-300">P2P Multiplayer</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-teal-300 font-bold block mb-1">[Q]</span>
                <span className="text-slate-300">Mini-Quests</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-amber-300 font-bold block mb-1">[?]</span>
                <span className="text-slate-300">This Guide</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-bold block mb-1">[Esc]</span>
                <span className="text-slate-300">Release Mouse / Close Window</span>
              </div>
              <div className="p-2.5 rounded-xl bg-slate-900/50 border border-slate-800 text-center">
                <span className="font-mono bg-slate-800 px-2 py-0.5 rounded text-slate-300 font-bold block mb-1">[`]</span>
                <span className="text-slate-300">Debug Kit (dev)</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3">
              The HUD itself is yours to arrange: every panel can be dragged by its corner grip and
              hidden with its ✕. Bring panels back — and find more display options as they arrive —
              on the pause screen's <span className="text-cyan-300 font-bold">OPTIONS</span> button.
            </p>
          </div>

          {/* Core Loop Summary */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-cyan-950/40 via-purple-950/40 to-teal-950/40 border border-cyan-800/40 text-xs">
            <h4 className="font-tech font-bold text-cyan-300 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4" /> Pro-Tip: Additive Cultivation & Proximity Doors
            </h4>
            <p className="text-slate-300 leading-relaxed">
              BioForge features <strong>no soil depletion</strong>. Apply <em>Growth Fertilizer</em> (Basic Compost + Bio-Pellets) to fast-forward flower bloom, and <em>Yield Fertilizer</em> to triple harvests. Build <em>Iris-Slit Proximity Doors</em> in your walls — they will organically open whenever you approach!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
