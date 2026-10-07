import React, { useState } from 'react';
import {
  Sparkles,
  Zap,
  Volume2,
  VolumeX,
  Compass,
  Hammer,
  Backpack,
  BookOpen,
  Users,
  HelpCircle,
  Sun,
  Moon,
  FolderArchive,
  Map,
} from 'lucide-react';
import {
  ToolType,
  PlayerState,
  GameNotification,
  StructureType,
  ItemId,
  HoverTarget,
  StructureEntity,
  FaunaEntity,
  FloraEntity,
} from '../types/game';
import { ITEMS } from '../game/constants';
import { Minimap } from './Minimap';

interface HUDProps {
  playerState: PlayerState;
  onSelectTool: (tool: ToolType) => void;
  onOpenInventory: () => void;
  onOpenBioForge: () => void;
  onOpenCodex: () => void;
  onOpenMultiplayer: () => void;
  onOpenControls: () => void;
  onOpenDevTools?: () => void;
  currentBiomeName: string;
  dayNightCycle: number;
  onToggleDayNight: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isPointerLocked: boolean;
  onRequestLock: () => void;
  hoverInfo: HoverTarget;
  notifications: GameNotification[];
  roomCode?: string;
  peerCount: number;
  selectedStructureType: StructureType;
  selectedSeedId: ItemId;
  structures?: StructureEntity[];
  fauna?: FaunaEntity[];
  flora?: FloraEntity[];
}

export const HUD: React.FC<HUDProps> = ({
  playerState,
  onSelectTool,
  onOpenInventory,
  onOpenBioForge,
  onOpenCodex,
  onOpenMultiplayer,
  onOpenControls,
  onOpenDevTools,
  currentBiomeName,
  dayNightCycle,
  onToggleDayNight,
  isMuted,
  onToggleMute,
  isPointerLocked,
  onRequestLock,
  hoverInfo,
  notifications,
  roomCode,
  peerCount,
  selectedStructureType,
  selectedSeedId,
  structures = [],
  fauna = [],
  flora = [],
}) => {
  const [isMinimapVisible, setIsMinimapVisible] = useState<boolean>(true);
  const isDay = dayNightCycle > 0.25 && dayNightCycle < 0.75;

  const tools: { id: ToolType; label: string; key: string; icon: string; desc: string; color: string }[] = [
    {
      id: 'harvest_glove',
      label: 'Harvest Glove',
      key: '1',
      icon: '✨',
      desc: 'Gentle non-lethal botanical extraction',
      color: '#2dd4bf',
    },
    {
      id: 'bio_scanner',
      label: 'Bio-Scanner',
      key: '2',
      icon: '🔍',
      desc: 'Scan lifeforms to discover lore & codex traits',
      color: '#38bdf8',
    },
    {
      id: 'planter_trowel',
      label: 'Planter Trowel',
      key: '3',
      icon: '🌱',
      desc: 'Plant seeds and apply growth fertilizers',
      color: '#4ade80',
    },
    {
      id: 'solvent_sprayer',
      label: 'Solvent Sprayer',
      key: '4',
      icon: '💧',
      desc: 'Dissolves structures back into 100% raw seeds',
      color: '#f43f5e',
    },
    {
      id: 'taming_lure',
      label: 'Taming Lure',
      key: '5',
      icon: '🍯',
      desc: 'Offer sweet nectar or bait to domesticate wildlife',
      color: '#f59e0b',
    },
    {
      id: 'builder',
      label: 'Bio-Builder',
      key: '6',
      icon: '🏗️',
      desc: 'Grow interlocking living structures',
      color: '#a855f7',
    },
  ];

  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-4 overflow-hidden">
      {/* Top Bar: Vitals, Biome, Room, Atmosphere, Quick Actions */}
      <div className="flex items-start justify-between w-full">
        {/* Left: Bio-Suit Vitals & Tactical Minimap Radar */}
        <div className="flex flex-col gap-2.5">
          <div className="pointer-events-auto flex flex-col gap-2 glass-panel p-3.5 rounded-2xl w-72">
            <div className="flex items-center justify-between">
              <span className="font-tech text-xs tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> BIO-SUIT INTEGRITY
              </span>
              <span className="text-xs text-slate-400 font-mono">VER 2.4.0</span>
            </div>

            {/* Health Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-emerald-300 font-medium">Cellular Health</span>
                <span className="text-emerald-400 font-mono">{Math.round(playerState.health)}/{playerState.maxHealth}</span>
              </div>
              <div className="w-full h-2 bg-slate-900/80 rounded-full overflow-hidden border border-emerald-950">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-300 shadow-sm shadow-emerald-500/50"
                  style={{ width: `${(playerState.health / playerState.maxHealth) * 100}%` }}
                />
              </div>
            </div>

            {/* Stamina Bar */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-cyan-300 font-medium">Kinetic Stamina</span>
                <span className="text-cyan-400 font-mono">{Math.round(playerState.stamina)}/{playerState.maxStamina}</span>
              </div>
              <div className="w-full h-2 bg-slate-900/80 rounded-full overflow-hidden border border-cyan-950">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 rounded-full transition-all duration-300 shadow-sm shadow-cyan-500/50"
                  style={{ width: `${(playerState.stamina / playerState.maxStamina) * 100}%` }}
                />
              </div>
            </div>

            {/* Energy / Bio-Pellet Charge */}
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-purple-300 font-medium">Synthesizer Energy</span>
                <span className="text-purple-400 font-mono">{Math.round(playerState.energy)}/{playerState.maxEnergy}</span>
              </div>
              <div className="w-full h-2 bg-slate-900/80 rounded-full overflow-hidden border border-purple-950">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-pink-400 rounded-full transition-all duration-300 shadow-sm shadow-purple-500/50"
                  style={{ width: `${(playerState.energy / playerState.maxEnergy) * 100}%` }}
                />
              </div>
            </div>
          </div>

          {/* Minimap Widget */}
          {isMinimapVisible && (
            <Minimap
              playerX={playerState.x}
              playerZ={playerState.z}
              playerRotation={playerState.rotation}
              structures={structures}
              fauna={fauna}
              flora={flora}
              currentBiomeName={currentBiomeName}
            />
          )}
        </div>

        {/* Center Top: Biome & Day/Night Indicator */}
        <div className="pointer-events-auto flex items-center gap-3">
          <div className="glass-panel px-4 py-2 rounded-2xl flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Current Sector</span>
              <span className="text-sm font-tech font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-pink-400">
                {currentBiomeName}
              </span>
            </div>
          </div>

          {/* Day/Night Toggle & Bioluminescence button */}
          <button
            onClick={onToggleDayNight}
            title="Toggle Day / Night Bioluminescence"
            className="glass-panel hover:bg-slate-800/80 transition-colors p-2.5 rounded-2xl flex items-center gap-2 text-xs font-medium text-slate-200 border border-slate-700/50"
          >
            {isDay ? (
              <>
                <Sun className="w-4 h-4 text-amber-400 animate-spin-slow" />
                <span className="font-tech text-amber-300">Sol-Cycle</span>
              </>
            ) : (
              <>
                <Moon className="w-4 h-4 text-purple-400 animate-pulse" />
                <span className="font-tech text-purple-300">Biolum-Night</span>
              </>
            )}
          </button>
        </div>

        {/* Right Top: Room & Navigation Modals */}
        <div className="pointer-events-auto flex items-center gap-2">
          {/* Multiplayer Status Pill */}
          <button
            onClick={onOpenMultiplayer}
            className={`glass-panel px-3 py-2 rounded-2xl flex items-center gap-2 text-xs font-medium border transition-colors ${
              roomCode
                ? 'border-emerald-500/50 text-emerald-300 bg-emerald-950/40'
                : 'border-slate-700/50 text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span>{roomCode ? `Room: ${roomCode} (${peerCount + 1})` : 'P2P Co-Op'}</span>
          </button>

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-white transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Dev Tools Exporter Modal Trigger */}
          {onOpenDevTools && (
            <button
              onClick={onOpenDevTools}
              title="Dev Tools: Codebase Source Exporter"
              className="glass-panel p-2.5 rounded-2xl text-cyan-400 hover:text-cyan-200 hover:border-cyan-500/50 transition-colors flex items-center gap-1.5 border border-cyan-500/30 bg-cyan-950/30"
            >
              <FolderArchive className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] font-mono font-medium hidden md:inline">Dev Tools</span>
            </button>
          )}

          {/* Minimap Radar Toggle */}
          <button
            onClick={() => setIsMinimapVisible((prev) => !prev)}
            title={isMinimapVisible ? 'Hide Minimap Radar' : 'Show Minimap Radar'}
            className={`glass-panel p-2.5 rounded-2xl transition-colors flex items-center gap-1.5 border ${
              isMinimapVisible
                ? 'border-cyan-500/50 text-cyan-300 bg-cyan-950/40'
                : 'border-slate-700/50 text-slate-300 hover:text-white'
            }`}
          >
            <Map className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-mono font-medium hidden md:inline">Map</span>
          </button>

          {/* Controls Guide */}
          <button
            onClick={onOpenControls}
            title="Controls & Guide"
            className="glass-panel p-2.5 rounded-2xl text-slate-300 hover:text-white transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Middle Center: 1st-Person Crosshair Reticle & Hover Target Details */}
      <div className="flex flex-col items-center justify-center my-auto pointer-events-none">
        {/* 1st-Person High-Tech Reticle */}
        <div className="relative flex items-center justify-center w-7 h-7 mb-2">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
          <div className="absolute w-5 h-5 rounded-full border border-cyan-400/40" />
          <div className="absolute -top-1 w-1.5 h-0.5 bg-cyan-400/60" />
          <div className="absolute -bottom-1 w-1.5 h-0.5 bg-cyan-400/60" />
          <div className="absolute -left-1 w-0.5 h-1.5 bg-cyan-400/60" />
          <div className="absolute -right-1 w-0.5 h-1.5 bg-cyan-400/60" />
        </div>

        {/* Pointer Lock Invitation (Visible when cursor is unlocked) */}
        {!isPointerLocked && (
          <button
            onClick={onRequestLock}
            className="pointer-events-auto glass-panel-biolum px-5 py-2 rounded-2xl flex items-center gap-2.5 text-xs font-tech font-bold text-cyan-300 hover:scale-105 active:scale-95 transition-all shadow-xl border border-cyan-500/50 cursor-pointer mb-3"
          >
            <Compass className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>CLICK SCREEN TO LOOK & EXPLORE (ESC TO RELEASE)</span>
          </button>
        )}

        {/* Hover Target Inspector */}
        {hoverInfo && (
          <div className="glass-panel-biolum px-4 py-2 rounded-2xl flex flex-col items-center animate-fade-in text-center max-w-md shadow-2xl">
            <span className="font-tech text-xs tracking-wider text-cyan-300 font-bold">{hoverInfo.name}</span>
            <span className="text-xs text-slate-300 mt-0.5">{hoverInfo.details}</span>
          </div>
        )}
      </div>

      {/* Notification Toast Stack on Right */}
      <div className="absolute right-4 top-20 flex flex-col gap-2 pointer-events-none max-w-sm">
        {notifications.slice(0, 4).map((n) => (
          <div
            key={n.id}
            className="glass-panel p-3 rounded-2xl flex items-start gap-3 border border-slate-700/60 shadow-lg animate-slide-left pointer-events-auto"
          >
            <div
              className="w-2.5 h-2.5 rounded-full mt-1 shrink-0"
              style={{ backgroundColor: n.iconColor || '#38bdf8' }}
            />
            <div className="flex flex-col">
              <span className="text-xs font-tech font-bold text-slate-200">{n.title}</span>
              <span className="text-xs text-slate-300 mt-0.5">{n.message}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Bar: Tool Selection, Active Sub-item, and Main Windows */}
      <div className="flex flex-col items-center gap-3 w-full">
        {/* Contextual Active Sub-Selection Info */}
        {playerState.activeTool === 'builder' && (
          <div className="pointer-events-auto glass-panel px-4 py-1.5 rounded-2xl flex items-center gap-3 text-xs">
            <span className="text-slate-400">Selected Blueprint:</span>
            <span className="font-tech font-bold text-purple-300">
              {ITEMS[selectedStructureType]?.name || selectedStructureType}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">(Change in Bio-Forge [B] or Inventory [I])</span>
          </div>
        )}

        {playerState.activeTool === 'planter_trowel' && (
          <div className="pointer-events-auto glass-panel px-4 py-1.5 rounded-2xl flex items-center gap-3 text-xs">
            <span className="text-slate-400">Selected Seed:</span>
            <span className="font-tech font-bold text-emerald-300">
              {ITEMS[selectedSeedId]?.name || selectedSeedId}
            </span>
            <span className="text-[10px] text-slate-400 font-mono">(Click mounds to plant / fertilize)</span>
          </div>
        )}

        <div className="flex items-center justify-between w-full max-w-4xl">
          {/* Main Quick Nav Buttons */}
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              onClick={onOpenBioForge}
              className="glass-panel hover:bg-cyan-950/50 hover:border-cyan-500/50 text-cyan-300 font-tech font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <Hammer className="w-4 h-4 text-cyan-400" />
              <span>Bio-Forge [B]</span>
            </button>

            <button
              onClick={onOpenInventory}
              className="glass-panel hover:bg-emerald-950/50 hover:border-emerald-500/50 text-emerald-300 font-tech font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <Backpack className="w-4 h-4 text-emerald-400" />
              <span>Pouch [I]</span>
            </button>

            <button
              onClick={onOpenCodex}
              className="glass-panel hover:bg-purple-950/50 hover:border-purple-500/50 text-purple-300 font-tech font-bold text-xs px-3.5 py-2.5 rounded-2xl flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>Codex [C]</span>
            </button>
          </div>

          {/* Tool Hotbar (1 - 6) */}
          <div className="pointer-events-auto glass-panel p-2 rounded-2xl flex items-center gap-2 shadow-2xl">
            {tools.map((t) => {
              const isActive = playerState.activeTool === t.id;
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectTool(t.id)}
                  title={`${t.label} [${t.key}]: ${t.desc}`}
                  className={`group relative flex flex-col items-center justify-center w-14 h-14 rounded-xl transition-all duration-200 border ${
                    isActive
                      ? 'bg-slate-800/90 border-cyan-400 shadow-md shadow-cyan-500/20 scale-105'
                      : 'bg-slate-900/60 border-slate-700/40 hover:bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xl leading-none">{t.icon}</span>
                  <span className="text-[10px] font-tech font-bold mt-1 text-slate-200">{t.key}</span>

                  {/* Active highlight glow dot */}
                  {isActive && (
                    <span
                      className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full shadow-sm animate-pulse"
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
