/**
 * BioForge Start Screen
 * ---------------------------------------------------------------------------
 * The first thing a player sees. BioForge worlds are persistent now (see
 * game/saveSystem.ts), so the game opens on a library, not a void:
 *
 *   - SAVED WORLDS: every world stored on this device, newest first.
 *     Clicking one loads it. The trash button deletes — two-step, because
 *     deletion is forever and a misclick shouldn't cost anyone a base.
 *   - NEW GAME: name a world and pick its difficulty. Only Peaceful is
 *     selectable today; Normal and Hostile are shown disabled, per design,
 *     until hostile creature AI exists to give them meaning.
 *   - JOIN CO-OP: a door for guests. Joining somebody else's world needs
 *     no local save at all, so it bypasses this screen's save logic and
 *     simply opens the game with the multiplayer panel ready.
 *
 * This component owns no game state. It reports the player's choice
 * through callbacks and lets App do the loading, creating, and deleting.
 */

import React, { useState } from 'react';
import { Play, Plus, Trash2, Users, Sprout } from 'lucide-react';
import { GameDifficulty, SaveMetadata, MAX_SAVE_NAME_LENGTH } from '../game/saveSystem';

interface StartScreenModalProps {
  isOpen: boolean;
  saves: SaveMetadata[];
  onSelectSave: (id: string) => void;
  onCreateSave: (name: string, difficulty: GameDifficulty) => void;
  onDeleteSave: (id: string) => void;
  onJoinCoop: () => void;
}

/**
 * The difficulty choices, in the order the screen shows them. `playable`
 * is what greys Normal and Hostile out — flip a flag here when its AI
 * lands and the button lights up with no other UI change needed.
 */
const DIFFICULTY_OPTIONS: { id: GameDifficulty; label: string; blurb: string; playable: boolean }[] = [
  { id: 'peaceful', label: 'PEACEFUL', blurb: 'Creatures never attack. Tend, tame, build.', playable: true },
  { id: 'normal', label: 'NORMAL', blurb: 'Wild creatures can turn hostile.', playable: false },
  { id: 'hostile', label: 'HOSTILE', blurb: 'Normal, plus explorers can fight each other.', playable: false },
];

/** Human label for a save's difficulty, shown in the save list. */
function difficultyLabel(difficulty: GameDifficulty): string {
  if (difficulty === 'normal') return 'Normal';
  if (difficulty === 'hostile') return 'Hostile';
  return 'Peaceful';
}

/** Compact "last played" stamp for a save row. */
function formatSavedAt(savedAt: number): string {
  return new Date(savedAt).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const StartScreenModal: React.FC<StartScreenModalProps> = ({
  isOpen,
  saves,
  onSelectSave,
  onCreateSave,
  onDeleteSave,
  onJoinCoop,
}) => {
  // New Game form state. The name may stay blank — saveSystem substitutes
  // "Unnamed World" — so the button is never disabled over a name.
  const [worldName, setWorldName] = useState('');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('peaceful');

  // Which save (if any) is mid-delete-confirmation. Deleting takes two
  // clicks on purpose: arm with the trash button, confirm with the red one.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleDeleteClick = (id: string) => {
    // First click arms the confirmation; second click actually deletes.
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setConfirmDeleteId(null);
    onDeleteSave(id);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
      <div className="glass-panel-biolum w-full max-w-2xl max-h-[90vh] rounded-3xl flex flex-col overflow-hidden border border-cyan-500/30 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3 border-b border-slate-800 bg-slate-900/60">
          <div className="w-10 h-10 rounded-2xl bg-cyan-950/70 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
            <Sprout className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-tech font-bold text-white tracking-wide">BIOFORGE</h2>
            <p className="text-xs text-slate-400">Choose a world, or grow a new one</p>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto">
          {/* ------------------------------------------------------------ */}
          {/* Saved worlds                                                  */}
          {/* ------------------------------------------------------------ */}
          <div>
            <h3 className="text-[11px] font-tech text-slate-400 uppercase tracking-wider mb-2">
              Saved Worlds ({saves.length})
            </h3>
            {saves.length === 0 ? (
              <p className="text-xs text-slate-500 p-4 rounded-2xl bg-slate-900/40 border border-slate-800">
                No saved worlds on this device yet. Start your first one below — it will
                autosave as you play and wait for you here next time.
              </p>
            ) : (
              <div className="space-y-2">
                {saves.map((save) => (
                  <div
                    key={save.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-slate-900/60 border border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-100 truncate">{save.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {difficultyLabel(save.difficulty)} · Last played {formatSavedAt(save.savedAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => onSelectSave(save.id)}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-teal-400 hover:from-cyan-400 hover:to-teal-300 text-slate-950 text-xs font-tech font-bold flex items-center gap-1.5 active:scale-95 transition-all"
                      >
                        <Play className="w-3.5 h-3.5" /> PLAY
                      </button>
                      <button
                        onClick={() => handleDeleteClick(save.id)}
                        title="Delete this world"
                        className={
                          confirmDeleteId === save.id
                            ? 'px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-tech font-bold transition-all'
                            : 'p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors'
                        }
                      >
                        {confirmDeleteId === save.id ? 'CONFIRM?' : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ------------------------------------------------------------ */}
          {/* New game                                                      */}
          {/* ------------------------------------------------------------ */}
          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <h3 className="text-[11px] font-tech text-slate-400 uppercase tracking-wider">New Game</h3>
            <input
              type="text"
              maxLength={MAX_SAVE_NAME_LENGTH}
              value={worldName}
              onChange={(e) => setWorldName(e.target.value)}
              placeholder="Name your world (e.g. Verdant Base)"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-400"
            />
            <div className="grid grid-cols-3 gap-2">
              {DIFFICULTY_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  disabled={!option.playable}
                  onClick={() => setDifficulty(option.id)}
                  title={option.playable ? option.blurb : 'Coming soon — needs hostile creature AI'}
                  className={
                    !option.playable
                      ? 'p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-600 cursor-not-allowed text-left'
                      : difficulty === option.id
                        ? 'p-2.5 rounded-xl bg-cyan-950 border border-cyan-400 text-left transition-all'
                        : 'p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-left hover:border-slate-500 transition-all'
                  }
                >
                  <div className="text-xs font-tech font-bold text-slate-100">
                    {option.label}
                    {!option.playable && (
                      <span className="ml-1.5 text-[9px] font-mono text-slate-500 uppercase">soon</span>
                    )}
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug mt-0.5">{option.blurb}</div>
                </button>
              ))}
            </div>
            <button
              onClick={() => onCreateSave(worldName, difficulty)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-lime-400 hover:from-emerald-400 hover:to-lime-300 font-tech font-bold text-xs text-slate-950 shadow-md shadow-emerald-500/20 active:scale-95 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> START NEW WORLD
            </button>
          </div>

          {/* ------------------------------------------------------------ */}
          {/* Co-op door                                                    */}
          {/* ------------------------------------------------------------ */}
          <button
            onClick={onJoinCoop}
            className="w-full p-4 rounded-2xl bg-slate-900/40 border border-slate-800/80 text-left flex items-start gap-3 hover:border-purple-500/50 transition-all"
          >
            <Users className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
            <span>
              <strong className="text-slate-200 block text-xs mb-0.5">Joining a friend instead?</strong>
              <span className="text-xs text-slate-400">
                Skip the library and head straight to the multiplayer panel. A guest plays in
                the host's world — no local save needed.
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
