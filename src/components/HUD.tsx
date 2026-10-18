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
  Shield,
  Waves,
  Footprints,
  ChevronLeft,
  ChevronRight,
  ScrollText,
  Settings2,
  Sprout,
  MessageSquare,
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
import { ITEMS } from '../game/items/constants';
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
  /** The HUD arrangement, owned by App (it rides the save —
   *  see useHudLayout). This component only reads/writes it. */
  hudLayout: HudLayout;
  playerState: PlayerState;
  /** The shields' own growth record (Adam's relocation,
   *  2026-10-17) — the Left Hand tile names the held shield's
   *  graft from the shield's state, not the player's. */
  shieldGrowth?: ShieldGrowthMap;
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
  // The About screen's pause door (info screen work order,
  // 2026-10-17): optional so the HUD renders its button only
  // once App wires the opener.
  onOpenAbout?: () => void;
  // The How to Play opener (Adam's program, 2026-10-17):
  // optional in the same pattern — the fixed cluster renders
  // its button only once App wires the modal.
  onOpenHowToPlay?: () => void;
  // The tutorial engine (Slice B): App composes useTutorial
  // and passes its return down; the HUD only renders the
  // chrome while a step is active. Optional — until App
  // wires it, the tutorial simply never appears.
  tutorial?: UseTutorialResult | null;
  onOpenDevTools?: () => void;
  onSave?: () => void;
  currentBiomeName: string;
  /** The current zone's biome TYPE (Meadow/Wetland/Fungal/Ember); null when the world has no seed. */
  currentBiomeType: string | null;
  /** Near the map edge: the next zone's direction, name, and biome. Null away from edges. */
  edgeZoneLabel: string | null;
  /** The current zone's grid coordinates, e.g. "Zone 0, 0" (spawn tracking). */
  zoneCoordsLabel: string;
  // The REFUGE pair (Adam's rulings via the background lane,
  // 2026-10-18): the spawn zone (0,0) keeps Peaceful's peace
  // on every world — isRefuge marks the zone panel while the
  // player stands in it on an armed world, and leavingSafety
  // carries the mode of a just-crossed border so the warning
  // popup can speak exactly (see App's crossing watch).
  isRefuge?: boolean;
  leavingSafety?: GameDifficulty | null;
  // The water module's stance, touch seat (Adam's delegation
  // to the HUD lane, 2026-10-18): non-null exactly while the
  // stance matters (in the water, second growth grown — the
  // same signal that seats the desktop hint). Desktop flips
  // it with F; touch gets the button below.
  waterStance?: { mode: 'swim' | 'walk'; onToggle: () => void } | null;
  /** While inside a cavern: where the cave exit is (the radar draws a
   * violet way-out arrow toward it). Null on the surface. */
  caveExitTarget: { x: number; z: number } | null;
  /** True while a helmet radar is installed (tier ≥ 1): the
   * Minimap draws its find pings. Ownership-derived in App — the
   * radar is helmet gear, never a held item (Adam, 2026-10-16). */
  radarActive: boolean;
  /** The helmet radar's tier (App-derived): 0 = no radar
   * installed, 1 = wayfinding (helm + Prismatic Field Radar),
   * 2 = creature location (the Prismatic Lifefinder growth joins
   * them). Forwarded to the Minimap, which tiers its pings. */
  radarTier: number;
  /** Click on the Left Hand slot: cycle the hand (lantern ↔
   *  shields ↔ empty, as owned — the same cycle Ctrl+wheel /
   *  Ctrl+↑ drives). */
  onToggleHeldItem: () => void;
  /** The shield's raised state + its setter (shield slice,
   *  2026-10-17): the Left Hand tile wears BRACED/LOWERED on a
   *  held shield, and the touch hold button drives the raise
   *  through the setter (desktop raises by right-mouse hold). */
  shieldRaised?: boolean;
  onSetShieldRaised?: (v: boolean) => void;
  /** Gauntlet modules (2026-10-15): the tools whose modules are
   * grafted on. Locked tiles render dimmed with a lock and report
   * their clicks through onToolLocked instead of selecting. */
  unlockedTools: ToolType[];
  onToolLocked: (tool: ToolType) => void;
  /** The striker slot's current draw (weapons build, 2026-10-16):
   *  the drawn weapon's display name and kind, for the slot-7
   *  tile's icon and descriptor. Absent until a weapon is grown. */
  strikerDrawName?: string;
  strikerDrawKind?: 'close' | 'ranged';
  /** Opens the mini-quest LIST (the top-row button; the Q hotkey is
   * App's). The list — not this HUD — owns tracker visibility. */
  onOpenQuests: () => void;
  /** The tracked mini-quest's live view, and whether the player
   * wants the tracker card shown (the list's checkbox). Null view =
   * chain finished or not applicable; the card rests. */
  questView: QuestProgressView | null;
  /** Close the tracked quest's card (its X) — App records the
   * dismissal; the quest stays in the log for re-tracking. */
  onDismissQuest?: () => void;
  /** S3: the pinned saga's live view — rendered in the tracker's
   * saga face while set, alongside (not replacing) the authored
   * quest tracking above. */
  sagaView?: import('./QuestTracker').SagaTrackView | null;
  /** Unpin the saga (its X) — the saga stays active in the log. */
  onDismissSaga?: () => void;
  showQuestHud: boolean;
  dayNightCycle: number;
  onToggleDayNight: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  isPointerLocked: boolean;
  /** Pause-mode latch (Adam, 2026-10-15): set when the player
   *  returns from a background tab; the overlay offers resume. */
  isReturnPaused: boolean;
  onResumeFromReturn: () => void;
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
  /** Swat a toast away early (click). System word now lives
   *  12s (useNotifications) — long enough to read, and no
   *  toast should have to be waited out once read. */
  onDismissNotification: (id: string) => void;
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
import type { QuestProgressView } from '../game/quests/quests';
import { MODULE_FOR_TOOL, gearTierOf } from '../game/quests/quests';
import { type HudLayout, type HudPanelId } from '../hooks/useHudLayout';
import { useAudioSettings } from '../hooks/useAudioSettings';
import { HudPanel } from './HudPanel';
import { HudErrorBoundary } from './HudErrorBoundary';
import { TutorialChrome } from './TutorialChrome';
import type { UseTutorialResult } from '../hooks/useTutorial';

import { HudOptionsPanel } from './HudOptionsPanel';
import type { GameDifficulty } from '../game/saveSystem';
import { CreditsModal } from './CreditsModal';
import { DonateButton } from './DonateButton';
import { FeedbackModal } from './FeedbackModal';
import { multiplayerManager, RELAY_BASE_URL } from '../game/multiplayer';
// Shield faces for the Left Hand tile (shield follow pass,
// 2026-10-17): which held items are shields, from the rules.
import { SHIELD_GRAFTS, graftOf, isShieldItem, lodestoneOf, type ShieldGrowthMap } from '../game/creatures/shields';
// The world's calendar (Shelf 1): the zone panel's day/night
// row answers WHEN as well as where — the day count is the
// world's age from its creation stamp, read live each render.
import { readSkyClock, skyDayFloat } from '../game/world/skyCalendar';

/**
 * SessionStats — the FPS + PING readout in the session bar
 * (Adam, 2026-10-16). Both numbers are MEASURED, never
 * decorative: FPS counts real animation frames on this client;
 * PING times a round trip to the co-op relay host — and only
 * while a session is live. Solo, there is no peer and no relay
 * traffic, so PING honestly reads —.
 */
const SessionStats: React.FC = () => {
  const [fps, setFps] = useState<number | null>(null);
  const [ping, setPing] = useState<number | null>(null);

  // Frame counter: tally rAF callbacks over ~0.5s windows.
  useEffect(() => {
    let raf = 0;
    let frames = 0;
    let windowStart = performance.now();
    const tick = (now: number) => {
      frames += 1;
      const elapsed = now - windowStart;
      if (elapsed >= 500) {
        setFps(Math.round((frames * 1000) / elapsed));
        frames = 0;
        windowStart = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // Relay probe: a timed no-cors fetch of the relay's HTTPS
  // origin every 4s while connected (the socket itself exposes
  // no round-trip API to the browser). A failed probe clears
  // the number rather than leaving a stale one up.
  useEffect(() => {
    let cancelled = false;
    const probe = async () => {
      if (!multiplayerManager.isConnected) {
        if (!cancelled) setPing(null);
        return;
      }
      const url = RELAY_BASE_URL.replace(/^wss:/, 'https:');
      const started = performance.now();
      try {
        await fetch(url, { mode: 'no-cors', cache: 'no-store' });
        if (!cancelled) setPing(Math.round(performance.now() - started));
      } catch {
        if (!cancelled) setPing(null);
      }
    };
    probe();
    const id = setInterval(probe, 4000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return (
    <div
      className="flex items-center gap-2 px-1.5 font-mono text-[11px] text-slate-400"
      title="Frames per second on this device, and the round trip to the co-op relay while a session is live"
    >
      <span>
        FPS{' '}
        <span className="text-slate-200 font-semibold">{fps ?? '—'}</span>
      </span>
      <span className="text-slate-600">·</span>
      <span>
        PING{' '}
        <span className="text-slate-200 font-semibold">
          {ping !== null ? `${ping}ms` : '—'}
        </span>
      </span>
    </div>
  );
};

export const HUD: React.FC<HUDProps> = ({
  hudLayout,
  playerState,
  shieldGrowth,
  onSelectTool,
  onCycleSeed,
  onCycleFertilizer,
  onCycleStructure,
  onOpenInventory,
  onOpenBioForge,
  onOpenCodex,
  onOpenMultiplayer,
  onOpenControls,
  onOpenAbout,
  onOpenHowToPlay,
  tutorial,
  onOpenDevTools,
  onSave,
  currentBiomeName,
  currentBiomeType,
  edgeZoneLabel,
  zoneCoordsLabel,
  isRefuge,
  leavingSafety,
  waterStance,
  caveExitTarget,
  radarActive,
  radarTier,
  onToggleHeldItem,
  shieldRaised,
  onSetShieldRaised,
  unlockedTools,
  onToolLocked,
  strikerDrawName,
  strikerDrawKind,
  onOpenQuests,
  questView,
  onDismissQuest,
  sagaView,
  onDismissSaga,
  showQuestHud,
  dayNightCycle,
  onToggleDayNight,
  isMuted,
  onToggleMute,
  isPointerLocked,
  isReturnPaused,
  onResumeFromReturn,
  touchMode,
  isFullscreen = false,
  onToggleFullscreen,
  onRequestLock,
  hoverInfo,
  hoverHint,
  notifications,
  onDismissNotification,
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
  // The HUD arrangement (which panels show, where they were
  // dragged) arrives as the hudLayout prop — App owns the hook
  // since the arrangement rides the game save (2026-10-18).
  // The mix shelf (Adam, 2026-10-17): the Options screen's SOUND
  // section reads and writes it; the audio engine will read it.
  const audioSettings = useAudioSettings();
  const [showHudOptions, setShowHudOptions] = useState<boolean>(false);
  // The credits' third door (Adam, 2026-10-18): the pause
  // popup is where a player lands mid-session — the roll
  // belongs one click from RESUME, not only at the start
  // screen and in Game Info.
  const [showCredits, setShowCredits] = useState<boolean>(false);
  const [showFeedback, setShowFeedback] = useState<boolean>(false);

  // The How to Play pulse (Adam's program, 2026-10-17): the
  // button pulses until the modal has been opened ONCE, then
  // keeps a quiet glow. The memory is per-device, in the
  // tutorial's own localStorage record (design doc §5:
  // 'bioforge.tutorial.v1' = { modalSeen, stepIndex,
  // completed, skipped }) — the HUD only ever reads/writes
  // modalSeen here, merging so the tutorial engine's fields
  // are never clobbered; Slice B's useTutorial owns the rest.
  const [howToSeen, setHowToSeen] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('bioforge.tutorial.v1');
      return raw ? JSON.parse(raw)?.modalSeen === true : false;
    } catch {
      return false;
    }
  });
  const markHowToSeen = () => {
    setHowToSeen(true);
    try {
      const raw = localStorage.getItem('bioforge.tutorial.v1');
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        'bioforge.tutorial.v1',
        JSON.stringify({ ...prev, modalSeen: true }),
      );
    } catch {
      /* per-device memory is a nicety, never a crash */
    }
  };
  // Escape closes the Options panel too (Adam, 2026-10-16): it
  // is HUD-internal state rather than an App modal, so the
  // input hook's Esc-to-close never sees it — this listener is
  // its X button by keyboard.
  useEffect(() => {
    if (!showHudOptions) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowHudOptions(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showHudOptions]);
  // The Prismatic Radar lives IN THE HELMET (Adam, 2026-10-16,
  // correcting a pouch/held reading): it is not a held item. The
  // radar/minimap panel exists only while the radar is INSTALLED —
  // the player has the Homestead Helm (the platform whose band
  // carries it) and the Prismatic Field Radar mounted on it. In
  // this game's ownership-derived gear model, having the crafted
  // item IS having it installed (both are maxStack-1 equipment).
  // No helm + radar, no panel; the session bar's Map switch and
  // the HUD Options toggle still apply on top of this gate.
  const hasRadarUnit =
    (inventory['homestead_helm'] ?? 0) > 0 &&
    (inventory['prismatic_field_radar'] ?? 0) > 0;
  // HudPanel's ✕ delivers just the panel id; hiding is always "true".
  const hideHudPanel = (panelId: HudPanelId) => hudLayout.setHidden(panelId, true);
  const isDay = dayNightCycle > 0.25 && dayNightCycle < 0.75;
  // THE WORLD'S CLOCK (Adam, 2026-10-17 — "if we're having day
  // count and time, let's have HUD put that in a sensible
  // place"): the zone panel's day/night row carries both. The
  // DAY is the world's age — Shelf 1's calendar counts
  // fractional days from the world's creation stamp by wall
  // clock (the world keeps its own time, watched or not), so
  // Day = floor + 1. The TIME is the sun's phase read as a
  // 24-hour dial — the sky rig's own convention: phase 0.25
  // is sunrise (06:00), 0.5 noon, 0.75 sunset, 0 midnight.
  // Both recompute on the once-a-second phase tick that
  // already re-renders this panel. No stamp yet (pre-world)
  // = no day number; the dial always reads.
  const skyClock = readSkyClock();
  const worldDay =
    skyClock.createdAtMs > 0
      ? Math.floor(skyDayFloat(skyClock.createdAtMs, Date.now())) + 1
      : null;
  const phaseMinutes = Math.floor(dayNightCycle * 24 * 60) % (24 * 60);
  const phaseClock = `${String(Math.floor(phaseMinutes / 60)).padStart(2, '0')}:${String(
    phaseMinutes % 60,
  ).padStart(2, '0')}`;

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
    {
      // The seventh slot (weapons build, 2026-10-16): one slot,
      // one drawn weapon — the tile wears the DRAWN weapon's face,
      // and its descriptor names it, so the player always knows
      // which striker is in hand. Tap 7 (or scroll) swaps the draw.
      id: 'striker',
      label: strikerDrawName ?? 'Striker',
      key: '7',
      icon: strikerDrawKind === 'ranged' ? '🎯' : '🗡️',
      desc: strikerDrawName
        ? `In hand: ${strikerDrawName} (${strikerDrawKind === 'ranged' ? 'ranged' : 'close'}) — tap 7 or scroll to swap the draw`
        : 'The Striker slot — grow a Briar Barb or a Spit Pod at the Bio-Forge',
      color: '#facc15',
    },
  ];

  // In-game tool descriptor: replaces native browser tooltips with a styled
  // panel. Shows the hovered tool, or flashes the newly selected tool for
  // ~3s after keyboard (1-7) / click selection changes.
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

  // The Left Hand speaks through the SAME descriptor (Adam,
  // play-pass, 2026-10-17): it was the last tile still wearing
  // a native browser `title`, so hovering it popped the OS
  // tooltip while every gauntlet tile used the game's own
  // panel. Now the hand has hover + flash states mirroring
  // the tools': hover raises its descriptor, and CYCLING the
  // hand (click / Ctrl+wheel / Ctrl+arrows) flashes it for ~3s
  // — which is also how touch players, who have no hover,
  // ever see it. The held/graft facts are hoisted here
  // because the descriptor and the tile both read them.
  const [hoveredHand, setHoveredHand] = useState(false);
  const [flashHand, setFlashHand] = useState(false);
  const handFlashTimer = useRef<number | null>(null);
  const prevHeldItemRef = useRef(playerState.heldItemId ?? null);
  useEffect(() => {
    const held = playerState.heldItemId ?? null;
    // Flash on CHANGE only — the first render must not shout
    // "Left Hand: empty" over the spawn.
    if (prevHeldItemRef.current === held) return;
    prevHeldItemRef.current = held;
    setFlashHand(true);
    if (handFlashTimer.current !== null) window.clearTimeout(handFlashTimer.current);
    handFlashTimer.current = window.setTimeout(() => setFlashHand(false), 3000);
    return () => {
      if (handFlashTimer.current !== null) window.clearTimeout(handFlashTimer.current);
    };
  }, [playerState.heldItemId]);

  const heldItemIdNow = playerState.heldItemId ?? null;
  const heldIsShield = isShieldItem(heldItemIdNow);
  const heldGraftKind = heldIsShield ? graftOf(shieldGrowth, heldItemIdNow as ItemId) : null;
  const heldLodestone = heldIsShield ? lodestoneOf(shieldGrowth, heldItemIdNow as ItemId) : false;
  const heldDisplayName = heldItemIdNow ? ITEMS[heldItemIdNow]?.name ?? heldItemIdNow : null;

  // The hand's descriptor entry, in the tool entries' shape.
  // Its desc ports the words the native title used to carry:
  // the graft kind, the raised state, and the cycle hint.
  const handDescriptor = {
    label: `Left Hand: ${heldDisplayName ?? 'Empty'}`,
    icon: heldIsShield ? '🛡️' : heldItemIdNow ? '🔦' : '✋',
    color: heldIsShield ? '#fb7185' : heldItemIdNow ? '#22d3ee' : '#94a3b8',
    desc: heldIsShield
      ? `${heldGraftKind ? `${SHIELD_GRAFTS[heldGraftKind].name} graft · ` : ''}${heldLodestone ? 'Lodestone set · ' : ''}${shieldRaised ? 'BRACED — the wall is up' : 'Lowered — worn blunting is live'} · hold right-mouse to raise · click or Ctrl+wheel to cycle the hand`
      : heldItemIdNow
        ? 'Click or Ctrl+wheel to cycle the hand'
        : 'Click or Ctrl+wheel to cycle the hand — the lantern and grown shields ride here',
  };
  // Precedence, gentlest first: a hovered TOOL beats the
  // hand's flash; the hovered HAND beats everything (the
  // pointer is the player's attention); the hand's flash
  // shows only when no tool state is speaking.
  const handDescriptorVisible =
    hoveredHand || (flashHand && !hoveredToolId && !flashToolId);

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

  // Gear tier on the tool descriptor (Adam, 2026-10-15): a gauntlet
  // tool exists because a module grafted it on, and the module
  // carries a tier — say so where the player reads about the tool.
  const descriptorModuleId = descriptorTool ? MODULE_FOR_TOOL[descriptorTool.id] : undefined;
  const descriptorTierLine = descriptorModuleId
    ? `Gauntlet module · Tier ${gearTierOf(descriptorModuleId) ?? 1}`
    : null;

  let descriptorExtra: string | null = null;
  if (
    descriptorTool?.id === 'harvest_glove' &&
    (selectedStructureType === 'storage_pod' ||
      selectedStructureType === 'biotunnel_mouth' ||
      selectedStructureType === 'sample_rack')
  ) {
    // The by-hand pod (Adam, 2026-10-15): with the pod selected,
    // the harvest glove's descriptor teaches the exemption —
    // grown, not built; click the ground to set it down.
    descriptorExtra = `Selected Blueprint: ${ITEMS[selectedStructureType]?.name || selectedStructureType} — ×${countOf(selectedStructureType)} in pouch · Click the ground to set it down by hand`;
  } else if (descriptorTool?.id === 'builder') {
    descriptorExtra = `Selected Blueprint: ${ITEMS[selectedStructureType]?.name || selectedStructureType} — ×${countOf(selectedStructureType)} in pouch`;
  } else if (descriptorTool?.id === 'planter_trowel') {
    descriptorExtra = `Selected Planting: ${ITEMS[selectedSeedId]?.name || selectedSeedId} — ×${countOf(selectedSeedId)} · Loaded Fertilizer: ${ITEMS[selectedFertilizerId]?.name || selectedFertilizerId} — ×${countOf(selectedFertilizerId)}`;
  } else if (descriptorTool?.id === 'taming_lure') {
    descriptorExtra = `Bait: Sweet Nectar ×${countOf('sweet_nectar')} · Carapace Scale ×${countOf('carapace_scale')}`;
  }

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex flex-col justify-between overflow-hidden ${
        touchMode ? 'p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]' : 'p-4'
      }`}
    >
      <HudErrorBoundary
        onResetLayout={() => hudLayout.hydrate({ hidden: {}, offsets: {} })}
      >
      {/* Top Bar: Vitals, Biome, Room, Atmosphere, Quick Actions.
          Touch mode gets a narrower vitals card and tighter gaps:
          Tailwind supplies the responsive tools, but the HUD still
          has to choose a phone arrangement — fixed desktop widths
          do not shrink on their own. */}
      <div className="flex items-start justify-between w-full gap-2">
        {/* Left column (Adam's HUD pass, 2026-10-16): ONE stack in
            reading order — Vitals, then the Radar, then the
            mini-quest tracker BELOW the radar (it used to float at
            31% and sit on top of the radar), then the Controls card
            below that. Every panel is a HudPanel: draggable by its
            corner grip, hideable by its ✕, restorable from Pause →
            Options. On a SHORT screen (a sideways phone) the
            vitals + radar pair turns into a row — side by side — so
            the radar stays visible without reaching down into the
            thumbstick's field (Adam's landscape playtest,
            2026-10-14: hiding it sideways took his navigation
            away). */}
        {/* POSITIONING FIX (Adam's playtest, 2026-10-16): the
            column is ABSOLUTELY positioned, out of the top bar's
            flow. In the first HUD pass the stack lived inside the
            top-bar flex row, so the row grew as tall as the whole
            stack (~770px) and the root's justify-between pushed
            the BOTTOM bar — quick nav, hotbar, Left Hand — off the
            bottom edge of shorter windows: the "lost" Gauntlet
            HUD. Out of flow, the column can be any height without
            moving anything else. The p-2 / -m-2 pair leaves room
            for the panels' corner badges, which overhang by 8px.
            NO scroll guard (Adam's playtest, 2026-10-16): the
            max-height + overflow this column used to carry made
            it a clipping container — a panel dragged toward the
            bottom of the screen sliced off at the guard's edge,
            and its clip line cut the resting stack's shadows.
            Panels must travel the full screen; on a very short
            window the resting stack's tail can run past the
            bottom edge instead, which Adam accepted — every
            panel is draggable and hideable. */}
        <div
          className={`absolute z-20 flex min-w-0 flex-col items-start gap-2.5 p-2 -m-2 ${
            touchMode ? 'left-2 top-2' : 'left-4 top-4'
          }`}
        >
          {/* items-start on BOTH stack containers (Adam's
              playtest, 2026-10-17): a flex column STRETCHES its
              children by default, so every panel's HudPanel
              wrapper — its clickable / drag surface — ran as
              wide as the widest sibling (the Controls card at
              26rem), while the Bio-Suit card inside is 18rem.
              The invisible extra strip caught clicks and drags
              meant for whatever sat beneath it. Shrink-wrapped,
              each panel's clickable area IS its card. Every
              panel child here is intrinsically sized (vitals
              w-72/w-52, the Minimap canvas, the tracker, the
              Controls card), so nothing depended on the
              stretch. */}
          <div
            className={`flex min-w-0 items-start gap-2.5 ${
              touchMode
                ? 'flex-col [@media(max-height:540px)]:flex-row [@media(max-height:540px)]:items-start'
                : 'flex-col'
            }`}
          >
          {!hudLayout.isHidden('vitals') && (
            <HudPanel
              id="vitals"
              label="Bio-Suit Vitals"
              offset={hudLayout.offsetOf('vitals')}
              onMove={hudLayout.setOffset}
              onClose={hideHudPanel}
            >
          <div
            className={`flex flex-col glass-panel rounded-2xl ${
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

            </HudPanel>
          )}

          {/* Minimap Widget. Sideways it rides beside the vitals
              card in the row layout above instead of disappearing.
              Two gates now: the HUD-layout choice (the session
              bar's Map button and Pause → Options switch the same
              'radar' panel) AND the installation gate (Adam,
              2026-10-16 — the Prismatic Field Radar must be
              installed in the helmet the player has; see
              hasRadarUnit above). */}
          {!hudLayout.isHidden('radar') && hasRadarUnit && (
            <HudPanel
              id="radar"
              label="Radar / Minimap"
              offset={hudLayout.offsetOf('radar')}
              onMove={hudLayout.setOffset}
              onClose={hideHudPanel}
            >
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
              radarTier={radarTier}
              compact={touchMode}
              />
            </HudPanel>
          )}
          </div>

          {/* Mini-quest tracker (2026-10-15; moved 2026-10-16):
              the little quest HUD now lives IN the left stack,
              directly below the radar — it used to float at
              top-[31%] and cover the radar. Renders only when the
              player wants it (the quest list's checkbox) and a
              quest is being followed, and the HUD layout has not
              hidden it (its ✕ / Pause → Options). */}
          {showQuestHud && (questView || sagaView) && !hudLayout.isHidden('tracker') && (
            <HudPanel
              id="tracker"
              label="Mini-Quest Tracker"
              offset={hudLayout.offsetOf('tracker')}
              onMove={hudLayout.setOffset}
              onClose={hideHudPanel}
            >
              {/* S3: a pinned saga takes the tracker's slot while
                  set — the authored tracked quest rests in the log,
                  untouched, and returns when the saga unpins. */}
              {sagaView ? (
                <QuestTracker saga={sagaView} onDismiss={onDismissSaga} />
              ) : (
                questView && (
                  <QuestTracker view={questView} onDismiss={onDismissQuest} />
                )
              )}
            </HudPanel>
          )}

          {/* Controls Card (Adam, 2026-10-14; moved 2026-10-16):
              the everyday keys live IN the HUD — glanceable in the
              left column, below the quest tracker — instead of only
              inside the Controls Guide modal. It used to float at
              bottom-52 over the bottom bar; the stack order is now
              its home, and dragging can take it anywhere else.
              Deliberately terse; the full guide is one [?] press
              away. Hidden on small screens so it never crowds the
              hotbar. */}
          {!hudLayout.isHidden('controls') && (
            <HudPanel
              id="controls"
              label="Controls Card"
              offset={hudLayout.offsetOf('controls')}
              onMove={hudLayout.setOffset}
              onClose={hideHudPanel}
              className="hidden md:block"
            >
              {/* A smidge wider + roomier (Adam, 2026-10-16):
                  fixed w-[26rem], wider key column, looser rows —
                  comfortable to read at a glance. */}
              <div className="glass-panel w-[26rem] px-4 py-3 rounded-2xl border border-slate-700/50 shadow-lg">
                <div className="text-[9px] font-tech font-bold tracking-widest text-slate-400 uppercase mb-2">
                  Controls
                </div>
                <div className="space-y-1.5 text-[10px] font-mono leading-none">
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">W A S D</span>
                    <span className="text-slate-300">Move · W×2 sprint</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">Mouse</span>
                    <span className="text-slate-300">Look · Click uses tool</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">Space</span>
                    <span className="text-slate-300">Jump · Bounce-Shroom: bounce a story up</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">1 – 7</span>
                    <span className="text-slate-300">Select tool · 7 = Striker</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">7 again · Wheel</span>
                    <span className="text-slate-300">Striker in hand: swap close ↔ ranged draw</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">Wheel</span>
                    <span className="text-slate-300">Cycle planting stock (trowel) / blueprint (builder)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">↑ ↓</span>
                    <span className="text-slate-300">Cycle fertilizer (trowel) / blueprint (builder)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">B · I · C · M · Q</span>
                    <span className="text-slate-300">Forge · Pouch · Codex · Co-op · Quests</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">Esc</span>
                    <span className="text-slate-300">Release mouse · close window</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-cyan-300 font-bold w-28">?</span>
                    <span className="text-slate-300">Full controls guide</span>
                  </div>
                </div>
              </div>
            </HudPanel>
          )}
          {/* (The system stream panel stood here for a day —
              retired by Adam's fold ruling, 2026-10-18: system
              word now arrives in the co-op chat as SYSTEM /
              ADMIN, and a chat log needs no second home. The
              NEWS seat on the start screen remains the archive.) */}
        </div>

        {/* Center Top: Biome & Day/Night — one grouped bar. Touch
            keeps it only once the screen is wide enough to carry
            all three top groups without squeezing the world out.
            NARROWER + TALLER (Adam, 2026-10-16, round 2): the wide
            single row became a w-52 column of rows — zone name,
            biome/coords, then the day/night toggle on its own row —
            centered (mx-auto) in the space between the Bio-Suit
            column on the left and the SESSION bar on the right, so
            it clears both. (Round 1 parked it right against the
            session bar; between is where Adam wants it.) */}
        {!hudLayout.isHidden('zone') && (
          <HudPanel
            id="zone"
            label="Zone Name & Sol-Cycle"
            offset={hudLayout.offsetOf('zone')}
            onMove={hudLayout.setOffset}
            onClose={hideHudPanel}
            className={`mx-auto shrink-0 ${touchMode ? 'hidden min-[760px]:block' : ''}`}
          >
        <div className="glass-panel w-52 px-3 py-2.5 rounded-2xl flex flex-col gap-1.5 shadow-lg">
          <div className="flex items-start gap-2">
            <Compass className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
            <div className="flex flex-col min-w-0">
              <span className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">Current Zone</span>
              <span className="text-sm font-tech font-bold leading-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-teal-300 to-pink-400">
                {currentBiomeName}
              </span>
              {/* THE COORDS, BIG (Adam, next iteration,
                  2026-10-17): the panel's loudest line after
                  the name. They used to ride the biome line at
                  10px — findable, never glanceable — yet the
                  tutorial's zone step teaches X,Z off this very
                  readout, and a player walking by hops steers
                  by them. The label is zones.ts' own string
                  ('Zone 0, 0' = zx, zz). */}
              <span className="font-tech font-extrabold text-[22px] leading-tight tracking-wide text-cyan-200">
                {zoneCoordsLabel}
              </span>
              {currentBiomeType && (
                <span className="text-[10px] font-mono text-teal-300/80">
                  Biome · {currentBiomeType}
                </span>
              )}
              {edgeZoneLabel && (
                <span className="text-[10px] font-mono text-amber-300/90">
                  Edge · {edgeZoneLabel}
                </span>
              )}
              {isRefuge && (
                <span className="text-[10px] font-mono text-emerald-300/90">
                  Refuge · nothing here can harm you
                </span>
              )}
            </div>
          </div>

          <div className="h-px w-full bg-slate-700/60" />

          {/* Day/Night Toggle & Bioluminescence button — its own
              row in the taller arrangement. The row now also
              carries the world's clock (Adam, 2026-10-17): the
              panel already answers WHERE; Day + time answer
              WHEN, on the same card, inheriting its drag, its
              ✕, and its Options toggle for free. The button
              still toggles the bioluminescence mode — its face
              names the mode under the clock line. */}
          <button
            onClick={onToggleDayNight}
            title="Toggle Day / Night Bioluminescence"
            className="hover:bg-slate-800/80 transition-colors px-2 py-1.5 rounded-xl flex items-center gap-2 text-xs font-medium text-slate-200 w-full"
          >
            {isDay ? (
              <Sun className="w-4 h-4 text-amber-400 animate-spin-slow shrink-0" />
            ) : (
              <Moon className="w-4 h-4 text-purple-400 animate-pulse shrink-0" />
            )}
            <span className="flex flex-col items-start leading-tight">
              <span className={`font-tech ${isDay ? 'text-amber-300' : 'text-purple-300'}`}>
                {worldDay !== null ? `Day ${worldDay} · ` : ''}{phaseClock}
              </span>
              <span className="text-[9px] font-mono text-slate-400">
                {isDay ? 'Sol-Cycle' : 'Biolum-Night'}
              </span>
            </span>
          </button>
        </div>
          </HudPanel>
        )}

        {/* The HOW TO PLAY + QUESTS doors used to float here as a
            fixed cluster (2026-10-17) — and were DEAD: the HUD
            root is pointer-events-none, panels opt back in via
            HudPanel, and the cluster never did, so its buttons
            inherited 'none' and no click ever landed (Adam's
            playtest catch). The doors now live in the SESSION
            bar below, inside HudPanel's pointer-events-auto —
            see the second row there. Their DOM ids moved with
            them, so the tutorial's highlight ring still finds
            howto-btn / quests-btn. */}


        {/* Right Top: the session bar — save, session, and system
            buttons in ONE panel instead of floating as separate
            pills. Two rows now (Adam, 2026-10-16): the old single
            row ran so wide it crowded the zone panel into the
            vitals card; stacked, the bar is roughly half as wide.
            Inner buttons are flat "ghost" buttons. */}
        {!hudLayout.isHidden('session') && (
          <HudPanel
            id="session"
            label="Session Bar"
            offset={hudLayout.offsetOf('session')}
            onMove={hudLayout.setOffset}
            onClose={hideHudPanel}
            className="shrink-0"
          >
        <div className={`glass-panel p-1.5 rounded-2xl flex flex-col gap-1 shadow-lg ${touchMode ? 'max-w-[calc(100vw-1rem)]' : ''}`}>
          {/* The bar's TITLE (Adam, 2026-10-16): every other panel
              says what it is at a glance — this one now does too. */}
          <div className="px-1.5 pt-1 pb-0.5 text-[9px] font-tech font-bold tracking-widest text-slate-400 uppercase">
            Session
          </div>
          <div className={`flex items-center gap-1 ${touchMode ? 'flex-wrap' : ''}`}>
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

          {/* FPS + PING, right of the co-op segment (Adam,
              2026-10-16 — the row had the room, so it lives
              here rather than widening the bar). Desktop only:
              touch keeps the row icon-only, as the bar's other
              labels already do. */}
          {!touchMode && (
            <>
              <div className="w-px h-6 bg-slate-700/60" />
              <SessionStats />
            </>
          )}

          {/* CREDITS + DONATE, beside Ping (Adam, 2026-10-18):
              the pause-popup doors work, but a player shouldn't
              have to alt-tab to learn they exist — the Session
              bar is on screen the whole session, so the roll
              and the jar live here too, in the bar's own ghost
              dress. That's four seats for the credits now; the
              DonateButton carries its capped-jar rule itself. */}
          <div className="w-px h-6 bg-slate-700/60" />
          <button
            onClick={() => setShowCredits(true)}
            title="Credits — who grew this"
            className="p-2 rounded-xl text-amber-300 hover:text-amber-200 hover:bg-amber-950/50 transition-colors flex items-center gap-1.5"
          >
            <ScrollText className="w-4 h-4" />
            <span className="text-[11px] font-mono font-medium hidden md:inline">Credits</span>
          </button>
          <DonateButton variant="session" />
          {/* FEEDBACK, beside the pair (Adam, 2026-10-18): the
              player's word to the grower belongs in the same
              always-visible row — a bug found mid-walk is
              reported mid-walk, not after a trip to a menu. */}
          <button
            onClick={() => setShowFeedback(true)}
            title="Feedback — report an issue or make a recommendation"
            className="p-2 rounded-xl text-violet-300 hover:text-violet-200 hover:bg-violet-950/50 transition-colors flex items-center gap-1.5"
          >
            <MessageSquare className="w-4 h-4" />
            <span className="text-[11px] font-mono font-medium hidden md:inline">Feedback</span>
          </button>
          </div>

          {/* Second row: the system toggles and the two list
              openers (quests + guide). */}
          <div className="flex items-center gap-1">
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

          {/* Minimap Radar Toggle — switches the same 'radar'
              layout panel the ✕ and Pause → Options control. */}
          <button
            onClick={() => hudLayout.setHidden('radar', !hudLayout.isHidden('radar'))}
            title={hudLayout.isHidden('radar') ? 'Show Minimap Radar' : 'Hide Minimap Radar'}
            className={`p-2 rounded-xl transition-colors flex items-center gap-1.5 ${
              !hudLayout.isHidden('radar')
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

          {/* HOW TO PLAY + QUESTS (Adam, 2026-10-17): the two
              doors a lost player needs, moved INTO the Session
              bar from the dead floating cluster (see the note in
              the top bar). Inside HudPanel they inherit
              pointer-events-auto and actually click. HOW TO PLAY
              keeps its tutorial pulse — solid and pulsing until
              the guide has been opened once (localStorage
              memory), then a quiet emerald tint. The ids are
              the tutorial highlight ring's anchors. */}
          {onOpenHowToPlay && (
            <button
              id="howto-btn"
              onClick={() => {
                markHowToSeen();
                onOpenHowToPlay();
              }}
              title="How to Play BioForge"
              className={`p-2 rounded-xl flex items-center gap-1.5 transition-all ${
                howToSeen
                  ? 'text-emerald-200 bg-emerald-950/50 hover:bg-emerald-900/50'
                  : 'text-emerald-950 bg-emerald-400 hover:bg-emerald-300 animate-pulse shadow-[0_0_14px_rgba(52,211,153,0.6)]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span className="text-[11px] font-mono font-bold hidden md:inline">How to Play</span>
            </button>
          )}

          <button
            id="quests-btn"
            onClick={onOpenQuests}
            title="Quest Log [Q]"
            className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800/70 transition-colors flex items-center gap-1.5"
          >
            <ScrollText className="w-4 h-4 text-emerald-300" />
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
          </HudPanel>
        )}
      </div>

      {/* The mini-quest tracker used to float here at top-[31%],
          where it covered the radar. It now renders inside the
          left column stack, directly below the radar (see the top
          bar above) — Adam's HUD pass, 2026-10-16. */}

      {/* True-Center Reticle: absolutely centered to match the interaction raycast
          (screen-center NDC 0,0). The old flex-centered reticle sat below true
          center because the tall vitals/minimap stack made the top bar much
          taller than the bottom bar. Toggle-only in HUD Options —
          no grip / ✕ of its own (they would cover the aim point). */}
      {!hudLayout.isHidden('reticle') && (
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
      )}

      {/* Pause Mode — background return (Adam, 2026-10-15): the sim
          is latched on hold; resuming is a deliberate tap. */}
      {isReturnPaused && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-slate-950/50 pointer-events-auto">
          <div className="glass-panel-biolum px-6 py-4 rounded-2xl flex flex-col items-center gap-3 border border-cyan-500/50 shadow-2xl">
            <span className="font-tech text-sm tracking-widest text-cyan-200 font-bold">PAUSED</span>
            <span className="text-xs text-slate-300">You stepped away — the world waited.</span>
            <div className="flex items-center gap-2">
              <button
                onClick={onResumeFromReturn}
                className="px-5 py-2 rounded-2xl text-xs font-tech font-bold text-cyan-300 border border-cyan-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                RESUME
              </button>
              {/* HUD Options (Adam, 2026-10-16): the standing home
                  for HUD settings, and the way back for any panel
                  hidden by its ✕ — it lives here, on the pause
                  overlay, because this overlay can never itself be
                  hidden. */}
              <button
                onClick={() => setShowHudOptions(true)}
                className="px-5 py-2 rounded-2xl text-xs font-tech font-bold text-slate-200 border border-slate-500/60 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <Settings2 className="w-3.5 h-3.5" /> OPTIONS
              </button>
              {/* The About screen's re-read door (info screen
                  work order, 2026-10-17): the primer's opening,
                  re-readable any time — it lives beside OPTIONS
                  on the overlay that can never be hidden. */}
              {onOpenAbout && (
                <button
                  onClick={onOpenAbout}
                  className="px-5 py-2 rounded-2xl text-xs font-tech font-bold text-emerald-200 border border-emerald-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
                >
                  <Sprout className="w-3.5 h-3.5" /> ABOUT
                </button>
              )}
              {/* CREDITS beside ABOUT (Adam, 2026-10-18): the
                  pause popup is the mid-game home for the
                  game's standing screens — options, the primer,
                  and now the roll of who grew this. */}
              <button
                onClick={() => setShowCredits(true)}
                className="px-5 py-2 rounded-2xl text-xs font-tech font-bold text-amber-200 border border-amber-500/50 hover:scale-105 active:scale-95 transition-all cursor-pointer flex items-center gap-1.5"
              >
                <ScrollText className="w-3.5 h-3.5" /> CREDITS
              </button>
              {/* DONATE rides beside CREDITS here too (Adam,
                  2026-10-18) — capped until the page stands. */}
              <DonateButton variant="popup" />
            </div>
          </div>
        </div>
      )}

      {/* LEAVING SAFETY (Adam, 2026-10-18): the border word.
          Crossing out of the spawn refuge on an armed world
          arms everything the world's difficulty governs —
          the player hears it ONCE, at the border, in words
          exact to the mode (PvP harm is Hostile's alone).
          Peaceful worlds never see it: nothing arms there.
          Transient by App's timer; pointer-transparent. */}
      {leavingSafety && (
        <div className="absolute inset-x-0 top-[17%] flex justify-center pointer-events-none z-30 px-4">
          <div className="glass-panel px-5 py-3 rounded-2xl border border-amber-500/50 shadow-2xl flex items-center gap-3 animate-fade-in max-w-md">
            <Shield className="w-5 h-5 text-amber-300 shrink-0" />
            <div className="flex flex-col">
              <span className="font-tech text-xs font-bold tracking-widest text-amber-200">
                LEAVING SAFETY
              </span>
              <span className="text-xs text-slate-200 leading-snug">
                {leavingSafety === 'hostile'
                  ? 'The wild country is armed — hunters hunt, the land can kill you, and explorers can harm explorers. You can harm them; they can harm you.'
                  : 'The wild country is armed — hunters hunt, the land can kill you, and your weapons are live.'}
              </span>
            </div>
          </div>
        </div>
      )}

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

        {/* HUD Options, reachable AT WILL (Adam, 2026-10-16): the
            pause overlay's OPTIONS button is only around at start
            or after an alt-tab pause, so a second door lives here,
            under the click-to-look invitation — any time the mouse
            is free, the Options screen is one click away. Touch has
            no pointer lock to escape, so it gets the button too. */}
        {!isPointerLocked && (
          <button
            onClick={() => setShowHudOptions(true)}
            title="HUD Options — show, hide, and arrange the HUD panels"
            className="pointer-events-auto glass-panel px-4 py-1.5 rounded-2xl flex items-center gap-2 text-[11px] font-tech font-bold text-slate-200 hover:text-white hover:bg-slate-800/70 active:scale-95 transition-all shadow-lg cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5 text-cyan-300" />
            <span>OPTIONS</span>
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

      {/* Notification Toast Stack on Right — a HUD panel like the
          rest (drag it, hide it) whenever a toast is on screen. */}
      {notifications.length > 0 && !hudLayout.isHidden('notifications') && (
      <div
        className={`absolute ${
          touchMode ? 'right-2 top-16 max-w-[72vw]' : 'right-4 top-20 max-w-sm'
        }`}
      >
        <HudPanel
          id="notifications"
          label="Notifications"
          offset={hudLayout.offsetOf('notifications')}
          onMove={hudLayout.setOffset}
          onClose={hideHudPanel}
        >
        <div className="flex flex-col gap-2">
        {notifications.slice(0, 4).map((n) => (
          <div
            key={n.id}
            onClick={() => onDismissNotification(n.id)}
            title="Dismiss"
            className="glass-panel p-3 rounded-2xl flex items-start gap-3 border border-slate-700/60 shadow-lg animate-slide-left pointer-events-auto cursor-pointer"
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
        </HudPanel>
      </div>
      )}

      {/* The Controls Card used to float here at bottom-52; it
          now lives in the left column stack under the quest
          tracker (see the top bar above) — Adam's HUD pass,
          2026-10-16. */}

      {/* Bottom Bar: Tool Selection, Active Sub-item, and Main Windows */}
      <div className={`flex flex-col items-center w-full ${touchMode ? 'gap-2' : 'gap-3'}`}>
        {/* Contextual Active Sub-Selection Info */}
        {(playerState.activeTool === 'builder' ||
          (playerState.activeTool === 'harvest_glove' &&
            (selectedStructureType === 'storage_pod' ||
              selectedStructureType === 'sample_rack'))) && (
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
            <span className="text-slate-400">Selected Planting:</span>
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
            Shows the hovered slot, or flashes the newly equipped slot after 1-6 / click selection.
            The Left Hand renders through the same panel (its own
            block, same chrome) whenever its hover/flash state is
            the one speaking — see handDescriptorVisible. */}
        {!descriptorTool && handDescriptorVisible && (
          <div
            className={`pointer-events-none glass-panel-biolum rounded-2xl flex items-center animate-fade-in border border-cyan-500/30 shadow-2xl ${
              touchMode ? 'max-w-[96vw] gap-3 px-3 py-2' : 'max-w-xl gap-4 px-5 py-3'
            }`}
          >
            <div
              className={`${touchMode ? 'h-9 w-9 text-xl' : 'h-11 w-11 text-2xl'} rounded-xl flex items-center justify-center shrink-0`}
              style={{
                backgroundColor: `${handDescriptor.color}20`,
                border: `1px solid ${handDescriptor.color}50`,
              }}
            >
              {handDescriptor.icon}
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-tech font-bold text-sm text-white">{handDescriptor.label}</span>
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700">
                  [ALT]
                </span>
                {!hoveredHand && (
                  <span className="font-tech text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    IN HAND
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 mt-0.5">{handDescriptor.desc}</p>
            </div>
          </div>
        )}
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
              {descriptorTierLine && (
                <p className="text-[11px] text-amber-300/90 font-medium mt-0.5">{descriptorTierLine}</p>
              )}
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
          {!hudLayout.isHidden('quicknav') && (
            <HudPanel
              id="quicknav"
              label="Quick Nav"
              offset={hudLayout.offsetOf('quicknav')}
              onMove={hudLayout.setOffset}
              onClose={hideHudPanel}
            >
          <div className="glass-panel p-1.5 rounded-2xl flex items-center gap-1 shadow-lg">
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
            </HudPanel>
          )}

          {/* Tool Hotbar (1 - 7) */}
          {/* Hotbar Row: Left Hand slot beside the tools — one
              HudPanel, so the pair drags and hides together. */}
          {!hudLayout.isHidden('hotbar') && (
            <HudPanel
              id="hotbar"
              label="Tool Hotbar & Left Hand"
              offset={hudLayout.offsetOf('hotbar')}
              onMove={hudLayout.setOffset}
              onClose={hideHudPanel}
            >
          <div
            className={`flex items-end gap-2 ${
              touchMode ? 'max-w-full justify-start overflow-x-auto pb-0.5' : ''
            }`}
          >
            {/* Left Hand (Adam, 2026-10-14): the off-hand slot.
                The radar left it in the 2026-10-16 conversion
                (helmet gear, never held); the SHIELD family
                joined it in 2026-10-17. The hand now cycles —
                click, Ctrl+wheel, or Ctrl+↑ — through what the
                player owns: lantern ↔ Scute Shield ↔ Lantern
                Shield ↔ Fenback Shield, wrapping among what's
                owned — the hand fills itself and stands empty
                only when nothing is owned. The tile wears
                the held thing's face: lantern light (cyan), a
                shield's ward (rose, BRACED while raised), or
                the empty hand. */}
            {(() => {
              const heldId = playerState.heldItemId ?? null;
              const heldShield = isShieldItem(heldId);
              // The slot holds a graft KIND now (Platforms
              // Parallel, 2026-10-17): the tile names it, rather
              // than wearing a bare grafted dot.
              const heldGraft = heldShield ? graftOf(shieldGrowth, heldId as ItemId) : null;
              const heldGrafted = heldGraft !== null;
              const heldLodestoneTile = heldShield ? lodestoneOf(shieldGrowth, heldId as ItemId) : false;
              const heldName = heldId ? ITEMS[heldId]?.name ?? heldId : null;
              return (
                <button
                  onClick={onToggleHeldItem}
                  onMouseEnter={() => setHoveredHand(true)}
                  onMouseLeave={() => setHoveredHand(false)}
                  className={`pointer-events-auto glass-panel rounded-2xl flex flex-col items-center gap-1 shadow-2xl transition-all active:scale-95 ${
                    touchMode ? 'p-1.5' : 'p-2'
                  }`}
                >
                  <span className={`relative ${touchMode ? 'h-9 w-9' : 'h-10 w-10'} rounded-xl flex items-center justify-center border ${
                    heldShield
                      ? shieldRaised
                        ? 'bg-rose-950/90 border-rose-400 text-rose-200 shadow-md shadow-rose-500/40'
                        : 'bg-rose-950/60 border-rose-500/60 text-rose-300 shadow-md shadow-rose-500/20'
                      : heldId
                        ? 'bg-cyan-950/80 border-cyan-400/70 text-cyan-300 shadow-md shadow-cyan-500/30'
                        : 'bg-slate-900/60 border-slate-700/60 text-slate-500'
                  }`}>
                    {heldShield ? (
                      <Shield className="w-5 h-5" />
                    ) : heldId ? (
                      <Flashlight className="w-5 h-5" />
                    ) : (
                      <Sparkles className="w-5 h-5" />
                    )}
                    {heldGrafted && (
                      <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-rose-400 border border-rose-200" />
                    )}
                    {heldLodestoneTile && (
                      <span className="absolute -bottom-1 -right-1 w-2.5 h-2.5 rounded-full bg-cyan-300 border border-cyan-100" />
                    )}
                  </span>
                  {!touchMode && (
                    <span className={`text-[8px] font-tech font-bold tracking-widest uppercase ${heldShield ? 'text-rose-300' : 'text-slate-400'}`}>
                      {heldShield ? (shieldRaised ? 'Braced' : 'Shield') : 'Left Hand'}
                    </span>
                  )}
                </button>
              );
            })()}

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
            </HudPanel>
          )}
        </div>
      </div>

      {/* Touch STANCE button — the water module on mobile
          (Adam's delegation to the HUD lane, 2026-10-18:
          'let HUD decide what to do about Mobile and
          swimming/blocking'). The decision: swimming gets a
          tap toggle in the RAISE button's family — same glass
          disc, stacked directly above it in one stable column
          (the column never reshuffles when a shield joins) —
          present only while the stance matters, which App's
          waterHint signal already knows. It names the ACTION
          (tap Swim while walking the water; tap Walk while
          swimming), the RAISE button's own convention.
          Blocking, the delegation's other half, needed no new
          work: the touch RAISE hold below has carried it
          since the shield follow pass. */}
      {touchMode && waterStance && (
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            waterStance.onToggle();
          }}
          onContextMenu={(e) => e.preventDefault()}
          className="absolute right-4 bottom-[12.75rem] z-30 pointer-events-auto glass-panel rounded-full w-16 h-16 flex flex-col items-center justify-center gap-0.5 shadow-2xl transition-all select-none touch-none border-cyan-500/50 text-cyan-300 bg-slate-950/70"
          title={
            waterStance.mode === 'walk'
              ? 'Swim — stop walking the water and swim it'
              : 'Walk — take the held step on the water'
          }
        >
          {waterStance.mode === 'walk' ? (
            <Waves className="w-6 h-6" />
          ) : (
            <Footprints className="w-6 h-6" />
          )}
          <span className="text-[8px] font-tech font-bold tracking-widest uppercase">
            {waterStance.mode === 'walk' ? 'Swim' : 'Walk'}
          </span>
        </button>
      )}

      {/* Touch RAISE hold (shield follow pass, 2026-10-17): on
          touch there is no right-mouse to hold, so the raise is
          a thumb hold — present only while a shield is in the
          Left Hand. Press-and-hold raises; release lowers. The
          wield hook owns the state; this is only its button. */}
      {touchMode && onSetShieldRaised && isShieldItem(playerState.heldItemId) && (
        <button
          onPointerDown={(e) => {
            e.preventDefault();
            onSetShieldRaised(true);
          }}
          onPointerUp={() => onSetShieldRaised(false)}
          onPointerLeave={() => onSetShieldRaised(false)}
          onPointerCancel={() => onSetShieldRaised(false)}
          onContextMenu={(e) => e.preventDefault()}
          className={`absolute right-4 bottom-32 z-30 pointer-events-auto glass-panel rounded-full w-16 h-16 flex flex-col items-center justify-center gap-0.5 shadow-2xl transition-all select-none touch-none ${
            shieldRaised
              ? 'border-rose-400 text-rose-200 bg-rose-950/80 scale-105'
              : 'border-rose-500/50 text-rose-300 bg-slate-950/70'
          }`}
          title="Hold to raise the shield"
        >
          <Shield className="w-6 h-6" />
          <span className="text-[8px] font-tech font-bold tracking-widest uppercase">
            {shieldRaised ? 'Braced' : 'Raise'}
          </span>
        </button>
      )}

      {/* The HUD Options screen (Pause → OPTIONS). Rendered at the
          root so it survives the pause overlay closing. */}
      {/* The tutorial's chrome (Slice B): step card + target
          ring, rendered only while the engine says a step is
          up. Fixed-position inside the component, so it rides
          above every panel but below the modals. */}
      {tutorial?.active && tutorial.step && <TutorialChrome tutorial={tutorial} />}

      {showHudOptions && (
        <HudOptionsPanel layout={hudLayout} audio={audioSettings} onClose={() => setShowHudOptions(false)} />
      )}
      {showCredits && (
        <CreditsModal isOpen={showCredits} onClose={() => setShowCredits(false)} />
      )}
      {showFeedback && (
        <FeedbackModal
          isOpen={showFeedback}
          onClose={() => setShowFeedback(false)}
          contextLine={`${zoneCoordsLabel} · ${currentBiomeName ?? 'Unknown country'} · ${touchMode ? 'touch' : 'desktop'}`}
        />
      )}
      </HudErrorBoundary>
    </div>
  );
};
