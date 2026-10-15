import React, { useState, useEffect, useRef } from 'react';
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
  Maximize2,
  Minimize2,
  Save,
  Flashlight,
  Radar,
  ChevronLeft,
  ChevronRight,
  ScrollText,
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

/**
 * Previous/next tap targets for a tool selection. On desktop these
 * choices ride the mouse wheel and arrow keys; a phone has neither,
 * so touch mode renders this pair beside the selection it changes.
 * The buttons call App's existing cycle functions — no second copy
 * of the seed/fertilizer/blueprint ordering lives here.
 */
const CycleButtons: React.FC<{
  label: string;
  onCycle?: (direction: 1 | -1) => void;
}> = ({ label, onCycle }) => {
  if (!onCycle) return null;
  const buttonClass =
    'flex h-9 w-9 items-center justify-center rounded-full border border-slate-500/60 bg-slate-800/80 text-slate-100 transition-all active:scale-95 active:bg-slate-700';
  return (
    <span className="flex items-center gap-1" aria-label={`${label} selector`}>
      <button
        type="button"
        aria-label={`Previous ${label}`}
        className={buttonClass}
        onClick={() => onCycle(-1)}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label={`Next ${label}`}
        className={buttonClass}
        onClick={() => onCycle(1)}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </span>
  );
};

interface HUDProps {
  playerState: PlayerState;
  onSelectTool: (tool: ToolType) => void;
  /** Touch-mode selection cycling (the wheel/arrow replacements). */
  onCycleSeed?: (direction: 1 | -1) => void;
  onCycleFertilizer?: (direction: 1 | -1) => void;
  onCycleStructure?: (direction: 1 | -1) => void;
  onOpenInventory: () => void;
  onOpenBioForge: () => void;
  onOpenCodex: () => void;
  onOpenMultiplayer: () => void;
  onOpenControls: () => void;
  onOpenDevTools?: () => void;
  onSave?: () => void;
  currentBiomeName: string;
  /** The current zone's biome TYPE (Meadow/Wetland/Fungal/Ember); null when the world has no seed. */
  currentBiomeType: string | null;
  /** Near the map edge: the next zone's direction, name, and biome. Null away from edges. */
  edgeZoneLabel: string | null;
  /** The current zone's grid coordinates, e.g. "Zone 0, 0" (spawn tracking). */
  zoneCoordsLabel: string;
  /** While inside a cavern: where the cave exit is (the radar draws a
   * violet way-out arrow toward it). Null on the surface. */
  caveExitTarget: { x: number; z: number } | null;
  /** True while the Prismatic Field Radar is the held Left-Hand
   * instrument: the Minimap draws its find pings. */
  radarActive: boolean;
  /** Click on the Left Hand slot: cycle the owned instruments, or stow. */
  onToggleHeldItem: () => void;
  /** Gauntlet modules (2026-10-15): the tools whose modules are
   * grafted on. Locked tiles render dimmed with a lock and report
   * their clicks through onToolLocked instead of selecting. */
  unlockedTools: ToolType[];
  onToolLocked: (tool: ToolType) => void;
  /** Opens the mini-quest LIST (the top-row button; the Q hotkey is
   * App's). The list — not this HUD — owns tracker visibility. */
  onOpenQuests: () => void;
  /** The tracked mini-quest's live view, and whether the player
   * wants the tracker card shown (the list's checkbox). Null view =
   * chain finished or not applicable; the card rests. */
  questView: QuestProgressView | null;
  showQuestHud: boolean;
  dayNightCycle: number;
  onToggleDayNight: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isPointerLocked: boolean;
  // True on touch-first devices: no pointer lock exists there, so
  // the click-to-lock invitation is never shown.
  touchMode: boolean;
  /** Full screen state + toggle (Adam, 2026-10-14): the browser's
   * own chrome eats the play screen on a phone. Optional — the
   * button renders only when App wires the toggle. */
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  onRequestLock: () => void;
  hoverInfo: HoverTarget;
  hoverHint?: string | null;
  notifications: GameNotification[];
  roomCode?: string;
  peerCount: number;
  selectedStructureType: StructureType;
  selectedSeedId: ItemId;
  selectedFertilizerId: ItemId;
  /** Live pouch contents — the hotbar and descriptors show counts for
   *  anything a tool consumes, so the last item is never spent blind. */
  inventory: Record<ItemId, number>;
  structures?: StructureEntity[];
  fauna?: FaunaEntity[];
  flora?: FloraEntity[];
}

import { QuestTracker } from './QuestTracker';
import type { QuestProgressView } from '../game/quests';

export const HUD: React.FC<HUDProps> = ({
  playerState,
  onSelectTool,
  onCycleSeed,
  onCycleFertilizer,
  onCycleStructure,
  onOpenInventory,
  onOpenBioForge,
  onOpenCodex,
  onOpenMultiplayer,
  onOpenControls,
  onOpenDevTools,
  onSave,
  currentBiomeName,
  currentBiomeType,
  edgeZoneLabel,
  zoneCoordsLabel,
  caveExitTarget,
  radarActive,
  onToggleHeldItem,
  unlockedTools,
  onToolLocked,
  onOpenQuests,
  questView,
  showQuestHud,
  dayNightCycle,
  onToggleDayNight,
  isMuted,
  onToggleMute,
  isPointerLocked,
  touchMode,
  isFullscreen = false,
  onToggleFullscreen,
  onRequestLock,
  hoverInfo,
  hoverHint,
  notifications,
  roomCode,
  peerCount,
  selectedStructureType,
  selectedSeedId,
  selectedFertilizerId,
  inventory,
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

  // In-game tool descriptor: replaces native browser tooltips with a styled
  // panel. Shows the hovered tool, or flashes the newly selected tool for
  // ~3s after keyboard (1-6) / click selection changes.
  const [hoveredToolId, setHoveredToolId] = useState<ToolType | null>(null);
  const [flashToolId, setFlashToolId] = useState<ToolType | null>(null);
  const flashTimer = useRef<number | null>(null);

  useEffect(() => {
    setFlashToolId(playerState.activeTool);
    if (flashTimer.current !== null) {
      window.clearTimeout(flashTimer.current);
    }
    flashTimer.current = window.setTimeout(() => setFlashToolId(null), 3000);
    return () => {
      if (flashTimer.current !== null) {
        window.clearTimeout(flashTimer.current);
      }
    };
  }, [playerState.activeTool]);

  const descriptorToolId = hoveredToolId ?? flashToolId;
  const descriptorTool = tools.find((t) => t.id === descriptorToolId) ?? null;

  // ---------------------------------------------------------------------
  // Inventory counts for consumables (Adam, 2026-10-14): anything a tool
  // SPENDS shows how many are left — in the descriptor, in the active
  // sub-selection panel, and as a badge on the hotbar tile itself — so
  // the player never spends their last seed-node blind, and a 0 reads
  // instantly as "go find more ingredients". Color code everywhere:
  // 0 = red (none left), 1 = amber (that's your last one), else plain.
  // ---------------------------------------------------------------------
  // StructureType values are item ids too (structures live in ITEMS),
  // but the unions are declared separately — hence the widened parameter.
  const countOf = (id: ItemId | StructureType): number => inventory[id as ItemId] ?? 0;
  const countTextClass = (n: number): string =>
    n === 0 ? 'text-red-400' : n === 1 ? 'text-amber-300' : 'text-slate-200';
  const countBorderClass = (n: number): string =>
    n === 0 ? 'border-red-500/60' : n === 1 ? 'border-amber-500/60' : 'border-slate-600/60';

  // The primary consumable per hotbar tile (the tile badge). The trowel's
  // badge is its SEED (the planting click spends it); its fertilizer
  // count rides the descriptor and sub-panel below. The lure's badge is
  // its everyday bait, Sweet Nectar.
  const tileBadgeCount: Partial<Record<ToolType, number>> = {
    planter_trowel: countOf(selectedSeedId),
    taming_lure: countOf('sweet_nectar'),
    builder: countOf(selectedStructureType),
  };

  let descriptorExtra: string | null = null;
  if (descriptorTool?.id === 'builder') {
    descriptorExtra = `Selected Blueprint: ${ITEMS[selectedStructureType]?.name || selectedStructureType} — ×${countOf(selectedStructureType)} in pouch`;
  } else if (descriptorTool?.id === 'planter_trowel') {
    descriptorExtra = `Selected Seed: ${ITEMS[selectedSeedId]?.name || selectedSeedId} — ×${countOf(selectedSeedId)} · Loaded Fertilizer: ${ITEMS[selectedFertilizerId]?.name || selectedFertilizerId} — ×${countOf(selectedFertilizerId)}`;
  } else if (descriptorTool?.id === 'taming_lure') {
    descriptorExtra = `Bait: Sweet Nectar ×${countOf('sweet_nectar')} · Carapace Scale ×${countOf('carapace_scale')}`;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col justify-between overflow-hidden ${
        touchMode ? 'p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]' : 'p-4'
      }`}
    >
      {/* Top Bar: Vitals, Biome, Room, Atmosphere, Quick Actions.
          Touch mode gets a narrower vitals card and tighter gaps:
          Tailwind supplies the responsive tools, but the HUD still
          has to choose a phone arrangement — fixed desktop widths
          do not shrink on their own. */}
      <div className="flex items-start justify-between w-full gap-2">
        {/* Left: Bio-Suit Vitals & Tactical Minimap Radar. On a
            SHORT screen (a sideways phone) the stack turns into a
            row — vitals and radar side by side — so the radar stays
            visible without reaching down into the thumbstick's
            field (Adam's landscape playtest, 2026-10-14: hiding it
            sideways took his navigation away). */}
        <div
          className={`flex min-w-0 flex-col gap-2.5 ${
            touchMode ? '[@media(max-height:540px)]:flex-row [@media(max-height:540px)]:items-start' : ''
          }`}
        >
          <div
            className={`pointer-events-auto flex flex-col glass-panel rounded-2xl ${
              touchMode ? 'w-52 gap-1.5 p-2.5' : 'w-72 gap-2 p-3.5'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="font-tech text-xs tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-cyan-400 animate-pulse" /> BIO-SUIT INTEGRITY
              </span>
              {!touchMode && <span className="text-xs text-slate-400 font-mono">VER 2.4.0</span>}
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

          {/* Minimap Widget. Always visible in play (Adam,
              2026-10-14): sideways it rides beside the vitals card
              in the row layout above instead of disappearing. */}
          {isMinimapVisible && (
            <div>
              <Minimap
              playerX={playerState.x}
              playerZ={playerState.z}
              playerRotation={playerState.rotation}
              structures={structures}
              fauna={fauna}
              flora={flora}
              currentBiomeName={currentBiomeName}
              currentBiomeType={currentBiomeType}
              zoneCoordsLabel={zoneCoordsLabel}
              exitTarget={caveExitTarget}
              radarActive={radarActive}
              compact={touchMode}
              />
            </div>
          )}
        </div>

        {/* Center Top: Biome & Day/Night — one grouped bar. Touch
            keeps it only once the screen is wide enough to carry
            all three top groups without squeezing the world out. */}
        <div
          className={`pointer-events-auto glass-panel px-2 py-1.5 rounded-2xl items-center gap-1 shadow-lg ${
            touchMode ? 'hidden min-[760px]:flex' : 'flex'
          }`}
        >
          <div className="px-2.5 py-1 flex items-center gap-2.5">
            <Compass className="w-4 h-4 text-cyan-400" />
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Current Zone</span>
              <span className="text-sm font-tech font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-pink-400">
                {currentBiomeName}
              </span>
              {currentBiomeType && (
                <span className="text-[10px] font-mono text-teal-300/80">
                  Biome · {currentBiomeType} · {zoneCoordsLabel}
                </span>
              )}
              {edgeZoneLabel && (
                <span className="text-[10px] font-mono text-amber-300/90">
                  Edge · {edgeZoneLabel}
                </span>
              )}
            </div>
          </div>

          <div className="w-px h-6 bg-slate-700/60" />

          {/* Day/Night Toggle & Bioluminescence button */}
          <button
            onClick={onToggleDayNight}
            title="Toggle Day / Night Bioluminescence"
            className="hover:bg-slate-800/80 transition-colors p-2 rounded-xl flex items-center gap-2 text-xs font-medium text-slate-200"
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

        {/* Right Top: one grouped action bar — save, session, and system
            buttons live together in a single panel instead of floating
            as separate pills. Inner buttons are flat "ghost" buttons. */}
        <div className="pointer-events-auto glass-panel p-1.5 rounded-2xl flex shrink-0 items-center gap-1 shadow-lg">
          {/* Save World (manual save — autosave also runs every 30s) */}
          {onSave && (
            <button
              onClick={onSave}
              title="Save World Now"
              className="p-2 rounded-xl text-emerald-300 hover:text-emerald-200 hover:bg-emerald-950/50 transition-colors flex items-center gap-1.5"
            >
              <Save className="w-4 h-4 text-emerald-400" />
              <span className="text-[11px] font-mono font-medium hidden md:inline">Save</span>
            </button>
          )}

          <div className="w-px h-6 bg-slate-700/60" />

          {/* Multiplayer Status segment */}
          <button
            onClick={onOpenMultiplayer}
            className={`px-2.5 py-2 rounded-xl flex items-center gap-2 text-xs font-medium transition-colors ${
              roomCode
                ? 'text-emerald-300 bg-emerald-950/40'
                : 'text-slate-300 hover:bg-slate-800/80'
            }`}
          >
            <Users className="w-4 h-4 text-cyan-400" />
            {/* Touch keeps the session button icon-only; the room
                code itself lives in the co-op window it opens. */}
            <span className={touchMode ? 'hidden' : undefined}>
              {roomCode ? `Room: ${roomCode} (${peerCount + 1})` : 'P2P Co-Op'}
            </span>
          </button>

          <div className="w-px h-6 bg-slate-700/60" />

          {/* Sound Toggle */}
          <button
            onClick={onToggleMute}
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors"
          >
            {isMuted ? <VolumeX className="w-4 h-4 text-red-400" /> : <Volume2 className="w-4 h-4 text-cyan-400" />}
          </button>

          {/* Dev Tools Exporter Modal Trigger (desktop-only: it is
              a development utility, and phone width is spent on play) */}
          {onOpenDevTools && !touchMode && (
            <button
              onClick={onOpenDevTools}
              title="Dev Tools: Codebase Source Exporter"
              className="p-2 rounded-xl text-cyan-400 hover:text-cyan-200 hover:bg-cyan-950/50 transition-colors flex items-center gap-1.5"
            >
              <FolderArchive className="w-4 h-4 text-cyan-400" />
              <span className="text-[11px] font-mono font-medium hidden md:inline">Dev Tools</span>
            </button>
          )}

          {/* Minimap Radar Toggle */}
          <button
            onClick={() => setIsMinimapVisible((prev) => !prev)}
            title={isMinimapVisible ? 'Hide Minimap Radar' : 'Show Minimap Radar'}
            className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 ${
              isMinimapVisible
                ? 'text-cyan-300 bg-cyan-950/50'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
            }`}
          >
            <Map className="w-4 h-4 text-cyan-400" />
            <span className="text-[11px] font-mono font-medium hidden md:inline">Map</span>
          </button>

          {/* Full Screen toggle: hands the whole display to the
              game — no URL bar, no browser buttons eating the
              play screen. Both directions: tap again to leave. */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors flex items-center gap-1.5"
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4 text-cyan-400" />
              ) : (
                <Maximize2 className="w-4 h-4 text-cyan-400" />
              )}
              <span className="text-[11px] font-mono font-medium hidden md:inline">
                {isFullscreen ? 'Windowed' : 'Full Screen'}
              </span>
            </button>
          )}

          {/* Mini-Quest List: opens the quest panel (the Q hotkey
              does the same). The panel owns the tracker HUD's
              visibility checkbox and the tracking pick. */}
          <button
            onClick={onOpenQuests}
            title="Mini-Quests [Q]"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors flex items-center gap-1.5"
          >
            <ScrollText className="w-4 h-4 text-emerald-400" />
            <span className="text-[11px] font-mono font-medium hidden md:inline">Quests</span>
          </button>

          {/* Controls Guide */}
          <button
            onClick={onOpenControls}
            title="Controls & Guide"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors"
          >
            <HelpCircle className="w-4 h-4 text-slate-300" />
          </button>
        </div>
      </div>

      {/* Mini-quest tracker (2026-10-15): the little quest HUD.
          Renders only when the player wants it (the quest list's
          checkbox) and a quest is being followed; it lives mid-left
          where neither the top bar, the hotbar, nor the touch
          joystick reaches. */}
      {showQuestHud && questView && (
        <div className="absolute left-3 top-[31%] z-20 pointer-events-none">
          <QuestTracker view={questView} />
        </div>
      )}

      {/* True-Center Reticle: absolutely centered to match the interaction raycast
          (screen-center NDC 0,0). The old flex-centered reticle sat below true
          center because the tall vitals/minimap stack made the top bar much
          taller than the bottom bar. */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative flex items-center justify-center w-7 h-7">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 shadow-sm shadow-cyan-400" />
          <div className="absolute w-5 h-5 rounded-full border border-cyan-400/40" />
          <div className="absolute -top-1 w-1.5 h-0.5 bg-cyan-400/60" />
          <div className="absolute -bottom-1 w-1.5 h-0.5 bg-cyan-400/60" />
          <div className="absolute -left-1 w-0.5 h-1.5 bg-cyan-400/60" />
          <div className="absolute -right-1 w-0.5 h-1.5 bg-cyan-400/60" />
        </div>
      </div>

      {/* Pointer Lock Invitation + Hover Inspector, parked just below the reticle */}
      <div className="absolute inset-x-0 top-1/2 mt-10 flex flex-col items-center gap-2 pointer-events-none">
        {/* Pointer Lock Invitation (mouse devices, while unlocked;
            touch devices have no lock to invite into) */}
        {!isPointerLocked && !touchMode && (
          <button
            onClick={onRequestLock}
            className="pointer-events-auto glass-panel-biolum px-5 py-2 rounded-2xl flex items-center gap-2.5 text-xs font-tech font-bold text-cyan-300 hover:scale-105 active:scale-95 transition-all shadow-xl border border-cyan-500/50 cursor-pointer"
          >
            <Compass className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span>CLICK SCREEN TO LOOK & EXPLORE (ESC TO RELEASE)</span>
          </button>
        )}

        {/* Hover Target Inspector */}
        {hoverInfo && (
          <div
            className={`glass-panel-biolum px-4 py-2 rounded-2xl flex flex-col items-center animate-fade-in text-center shadow-2xl ${
              touchMode ? 'max-w-[86vw]' : 'max-w-md'
            }`}
          >
            <span className="font-tech text-xs tracking-wider text-cyan-300 font-bold">{hoverInfo.name}</span>
            <span className="text-xs text-slate-300 mt-0.5">{hoverInfo.details}{hoverHint ? ` • ${hoverHint}` : ''}</span>
          </div>
        )}
      </div>

      {/* Notification Toast Stack on Right */}
      <div
        className={`absolute flex flex-col gap-2 pointer-events-none ${
          touchMode ? 'right-2 top-16 max-w-[72vw]' : 'right-4 top-20 max-w-sm'
        }`}
      >
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

      {/* Controls Card (Adam, 2026-10-14): the everyday keys live IN the
          HUD — glanceable in the bottom-left corner — instead of only
          inside the Controls Guide modal. Deliberately terse; the full
          guide is one [?] press away. Hidden on small screens so it
          never crowds the hotbar. It floats HIGH (bottom-52) so it sits
          over — never over-lapping — the bottom bar's Bio-Forge /
          Pouch / Codex windows row (Adam: the first placement, down at
          bottom-4, obscured that row). */}
      <div className="absolute left-4 bottom-52 pointer-events-none hidden md:block">
        <div className="glass-panel px-3 py-2.5 rounded-2xl border border-slate-700/50 shadow-lg">
          <div className="text-[9px] font-tech font-bold tracking-widest text-slate-400 uppercase mb-1.5">
            Controls
          </div>
          <div className="space-y-1 text-[10px] font-mono leading-none">
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold w-20">W A S D</span>
              <span className="text-slate-300">Move · W×2 sprint</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold w-20">Mouse</span>
              <span className="text-slate-300">Look · Click uses tool</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold w-20">Wheel · ↑↓</span>
              <span className="text-slate-300">Cycle seed / fertilizer / blueprint</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold w-20">1 – 6</span>
              <span className="text-slate-300">Select tool</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold w-20">Space</span>
              <span className="text-slate-300">Jump · on a Bounce-Shroom: bounce a story up, steer mid-air</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold w-20">B · I · C · M</span>
              <span className="text-slate-300">Forge · Pouch · Codex · Co-op</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-cyan-300 font-bold w-20">?</span>
              <span className="text-slate-300">Full controls guide</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar: Tool Selection, Active Sub-item, and Main Windows */}
      <div className={`flex flex-col items-center w-full ${touchMode ? 'gap-2' : 'gap-3'}`}>
        {/* Contextual Active Sub-Selection Info */}
        {playerState.activeTool === 'builder' && (
          <div
            className={`pointer-events-auto glass-panel px-4 py-1.5 rounded-2xl flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ${
              touchMode ? 'max-w-[74vw] justify-start self-start' : 'max-w-[96vw] justify-center'
            }`}
          >
            <span className="text-slate-400">Selected Blueprint:</span>
            <span className="font-tech font-bold text-purple-300">
              {ITEMS[selectedStructureType]?.name || selectedStructureType}
            </span>
            <span className={`font-mono font-bold ${countTextClass(countOf(selectedStructureType))}`}>
              ×{countOf(selectedStructureType)} in pouch
            </span>
            {touchMode ? (
              <CycleButtons label="blueprint" onCycle={onCycleStructure} />
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">(Change in Bio-Forge [B] or Inventory [I])</span>
            )}
          </div>
        )}

        {playerState.activeTool === 'planter_trowel' && (
          <div
            className={`pointer-events-auto glass-panel px-4 py-1.5 rounded-2xl flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs ${
              touchMode ? 'max-w-[74vw] justify-start self-start' : 'max-w-[96vw] justify-center'
            }`}
          >
            <span className="text-slate-400">Selected Seed:</span>
            <span className="font-tech font-bold text-emerald-300">
              {ITEMS[selectedSeedId]?.name || selectedSeedId}
            </span>
            <span className={`font-mono font-bold ${countTextClass(countOf(selectedSeedId))}`}>
              ×{countOf(selectedSeedId)}
            </span>
            {touchMode && <CycleButtons label="seed" onCycle={onCycleSeed} />}
            <span className="text-slate-400">Loaded Fertilizer:</span>
            <span className="font-tech font-bold text-teal-300">
              {ITEMS[selectedFertilizerId]?.name || selectedFertilizerId}
            </span>
            <span className={`font-mono font-bold ${countTextClass(countOf(selectedFertilizerId))}`}>
              ×{countOf(selectedFertilizerId)}
            </span>
            {touchMode ? (
              <CycleButtons label="fertilizer" onCycle={onCycleFertilizer} />
            ) : (
              <span className="text-[10px] text-slate-400 font-mono">(Wheel / ↑ ↓ switch fertilizer · click mounds to plant / fertilize)</span>
            )}
          </div>
        )}

        {/* In-Game Tool Descriptor — styled panel replacing native browser tooltips.
            Shows the hovered slot, or flashes the newly equipped slot after 1-6 / click selection. */}
        {descriptorTool && (
          <div
            className={`pointer-events-none glass-panel-biolum rounded-2xl flex items-center animate-fade-in border border-cyan-500/30 shadow-2xl ${
              touchMode ? 'max-w-[96vw] gap-3 px-3 py-2' : 'max-w-xl gap-4 px-5 py-3'
            }`}
          >
            <div
              className={`${touchMode ? 'h-9 w-9 text-xl' : 'h-11 w-11 text-2xl'} rounded-xl flex items-center justify-center shrink-0`}
              style={{
                backgroundColor: `${descriptorTool.color}20`,
                border: `1px solid ${descriptorTool.color}50`,
              }}
            >
              {descriptorTool.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-tech font-bold text-sm text-white">{descriptorTool.label}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  [{descriptorTool.key}]
                </span>
                {!hoveredToolId && (
                  <span className="font-tech text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    EQUIPPED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{descriptorTool.desc}</p>
              {descriptorExtra && (
                <p className="text-[11px] text-cyan-300/90 font-medium mt-0.5">{descriptorExtra}</p>
              )}
            </div>
          </div>
        )}

        <div
          className={`flex items-center w-full ${
            touchMode
              ? 'max-w-full flex-col justify-center gap-2'
              : 'max-w-4xl flex-row justify-between'
          }`}
        >
          {/* Main Quick Nav Buttons — one grouped bar, ghost buttons */}
          <div className="pointer-events-auto glass-panel p-1.5 rounded-2xl flex items-center gap-1 shadow-lg">
            <button
              onClick={onOpenBioForge}
              className={`hover:bg-cyan-950/60 text-cyan-300 font-tech font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 ${
                touchMode ? 'px-2.5 py-2' : 'px-3 py-2'
              }`}
            >
              <Hammer className="w-4 h-4 text-cyan-400" />
              <span>{touchMode ? 'Forge' : 'Bio-Forge [B]'}</span>
            </button>

            <button
              onClick={onOpenInventory}
              className={`hover:bg-emerald-950/60 text-emerald-300 font-tech font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 ${
                touchMode ? 'px-2.5 py-2' : 'px-3 py-2'
              }`}
            >
              <Backpack className="w-4 h-4 text-emerald-400" />
              <span>{touchMode ? 'Pouch' : 'Pouch [I]'}</span>
            </button>

            <button
              onClick={onOpenCodex}
              className={`hover:bg-purple-950/60 text-purple-300 font-tech font-bold text-xs rounded-xl flex items-center gap-2 transition-all active:scale-95 ${
                touchMode ? 'px-2.5 py-2' : 'px-3 py-2'
              }`}
            >
              <BookOpen className="w-4 h-4 text-purple-400" />
              <span>{touchMode ? 'Codex' : 'Codex [C]'}</span>
            </button>
          </div>

          {/* Tool Hotbar (1 - 6) */}
          {/* Hotbar Row: Left Hand slot beside the tools */}
          <div
            className={`flex items-end gap-2 ${
              touchMode ? 'max-w-full justify-start overflow-x-auto pb-0.5' : ''
            }`}
          >
            {/* Left Hand (Adam, 2026-10-14): the off-hand slot for
                instruments. Click cycles the ones you own — the Hand
                Lantern-Fern (a light that follows you; see
                threeEngine.setHeldLight) and the Prismatic Field
                Radar (minimap pings) — then stows. */}
            <button
              onClick={onToggleHeldItem}
              title={playerState.heldItemId === 'prismatic_field_radar' ? 'Left Hand: Prismatic Field Radar — click to cycle or stow' : playerState.heldItemId ? 'Left Hand: Hand Lantern-Fern — click to cycle or stow' : 'Left Hand: empty — click to hold an instrument (Lantern-Fern or Field Radar)'}
              className={`pointer-events-auto glass-panel rounded-2xl flex flex-col items-center gap-1 shadow-2xl transition-all active:scale-95 ${
                touchMode ? 'p-1.5' : 'p-2'
              }`}
            >
              <span className={`${touchMode ? 'h-9 w-9' : 'h-10 w-10'} rounded-xl flex items-center justify-center border ${playerState.heldItemId === 'prismatic_field_radar' ? 'bg-violet-950/80 border-violet-400/70 text-violet-300 shadow-md shadow-violet-500/30' : playerState.heldItemId ? 'bg-cyan-950/80 border-cyan-400/70 text-cyan-300 shadow-md shadow-cyan-500/30' : 'bg-slate-900/60 border-slate-700/60 text-slate-500'}`}>
                {playerState.heldItemId === 'prismatic_field_radar' ? <Radar className="w-5 h-5" /> : playerState.heldItemId ? <Flashlight className="w-5 h-5" /> : <Sparkles className="w-5 h-5" />}
              </span>
              {!touchMode && (
                <span className="text-[8px] font-tech font-bold tracking-widest text-slate-400 uppercase">Left Hand</span>
              )}
            </button>

          <div
            className={`pointer-events-auto glass-panel rounded-2xl flex items-center shadow-2xl ${
              touchMode ? 'gap-1.5 p-1.5' : 'gap-2 p-2'
            }`}
          >
            {tools.map((t) => {
              const isActive = playerState.activeTool === t.id;
              // Gauntlet gating (2026-10-15): a tool whose module
              // is not grafted yet renders as a locked silhouette —
              // clicking it explains the lock instead of selecting.
              const isLocked = !unlockedTools.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => (isLocked ? onToolLocked(t.id) : onSelectTool(t.id))}
                  onMouseEnter={() => setHoveredToolId(t.id)}
                  onMouseLeave={() => setHoveredToolId(null)}
                  className={`group relative flex flex-col items-center justify-center ${
                    touchMode ? 'h-12 w-12' : 'h-14 w-14'
                  } rounded-xl transition-all duration-200 border ${
                    isActive
                      ? 'bg-slate-800/90 border-cyan-400 shadow-md shadow-cyan-500/20 scale-105'
                      : isLocked
                        ? 'bg-slate-950/70 border-slate-800 text-slate-600'
                        : 'bg-slate-900/60 border-slate-700/40 hover:bg-slate-800/60 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className={`${touchMode ? 'text-lg' : 'text-xl'} leading-none ${isLocked ? 'opacity-40 grayscale' : ''}`}>{isLocked ? '🔒' : t.icon}</span>
                  <span className="text-[10px] font-tech font-bold mt-1 text-slate-200">{t.key}</span>

                  {/* Consumable count badge: how many of the thing this
                      tile SPENDS are left (see tileBadgeCount above).
                      Red at 0, amber at 1 (your last one). */}
                  {tileBadgeCount[t.id] !== undefined && (
                    <span
                      className={`absolute bottom-0.5 right-0.5 px-1 rounded-md text-[9px] font-mono font-bold border bg-slate-950/85 ${countTextClass(tileBadgeCount[t.id]!)} ${countBorderClass(tileBadgeCount[t.id]!)}`}
                    >
                      ×{tileBadgeCount[t.id]}
                    </span>
                  )}

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
    </div>
  );
};
