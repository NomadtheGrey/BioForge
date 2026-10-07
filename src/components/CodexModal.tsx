import React, { useState } from 'react';
import { X, BookOpen, Sparkles, CheckCircle2, Lock, Eye } from 'lucide-react';
import { CodexEntry } from '../types/game';

interface CodexModalProps {
  isOpen: boolean;
  onClose: () => void;
  codexList: CodexEntry[];
}

export const CodexModal: React.FC<CodexModalProps> = ({
  isOpen,
  onClose,
  codexList,
}) => {
  const [activeFilter, setActiveFilter] = useState<'all' | 'flora' | 'fauna' | 'composite'>('all');
  const [selectedEntry, setSelectedEntry] = useState<CodexEntry>(codexList[0]);

  if (!isOpen) return null;

  const filtered = codexList.filter(
    (e) => activeFilter === 'all' || e.type === activeFilter
  );

  const discoveredCount = codexList.filter((e) => e.discovered).length;
  const totalCount = codexList.length;

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
        </div>
      </div>
    </div>
  );
};
