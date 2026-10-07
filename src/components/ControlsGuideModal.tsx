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
      <div className="glass-panel-biolum w-full max-w-3xl h-[600px] rounded-3xl flex flex-col overflow-hidden border border-cyan-500/30 shadow-2xl">
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
                <p className="text-[11px] text-slate-400">Grows interlocking root floors, chitin-glass walls, and proximity iris doors on grid cells.</p>
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
            </div>
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
