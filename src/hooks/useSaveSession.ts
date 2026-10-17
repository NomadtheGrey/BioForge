/**
 * BioForge Save Session Domain Hook
 * Extracted from App.tsx (2026-10-15, the seam-by-seam refactor —
 * seam 3 of 6, a pure move: no behavior changes).
 *
 * Owns the save session: the boot gate (hasStarted) and the start
 * screen's library, which save is attached (currentSaveRef), the
 * latest-state mirror snapshots are assembled from, saveNow +
 * autosave + pagehide, and the library verbs (apply / select /
 * create / delete / manual save). A session with no save attached
 * (start screen, co-op guest) simply never writes.
 *
 * The debug-kit stash arrives through a LAZY getter: the debug
 * hook is called further down App's body than this one, and
 * saveNow only reads the stash when a save actually happens
 * (post-mount). Zone/instance state arrives as the refs and verbs
 * of the travel and instances hooks, which are called above.
 */

import { useRef, useState, useCallback, useEffect } from 'react';
import type { BioForgeThreeEngine } from '../game/threeEngine';
import {
  AUTOSAVE_INTERVAL_MS, listSaveMetadata, deleteSavedGame, buildSavedGame,
  createSaveMetadata, loadSavedGame, storeSavedGame,
  type GameDifficulty, type SaveMetadata, type SavedGameRecord, type WorldSnapshot,
} from '../game/saveSystem';
import type { FieldNotesState } from '../game/fieldNotesBook';
import { EMPTY_ASKS_BACK, type AsksBackState } from '../game/asksBackState';
// THE WORLD ASKS BACK, S4: the save-load restore runs the same
// consequence apply path as zone travel (load mode — removals +
// settled individuals, never abundance on player-shaped lists).
import { applyZoneConsequences } from '../game/asksBack/applyConsequences';
import { INITIAL_STRUCTURES } from './useWorldEntities';
import { SPAWN_ZONE, zoneKey, zoneBiomeAt, zoneVariantAt, zoneFaceAt } from '../game/zones';
import { generateSeededWorld } from '../game/worldGen';
import { multiplayerManager } from '../game/multiplayer';
import type { InstanceState } from './useInstances';
import type { ZoneCoords } from '../game/zones';
import type {
  CodexEntry, DroppedItemEntity, FaunaEntity, FloraEntity, GameNotification,
  ItemId, PlayerState, QuestProgressState, StructureEntity,
} from '../types/game';

// The inventory is a counted map (item id -> how many), not a list.
export type InventoryMap = Record<ItemId, number>;

export interface SaveSessionDeps {
  engineRef: { current: BioForgeThreeEngine | null };
  playerPosRef: { current: { x: number; z: number; rotation: number } };
  instanceRef: { current: InstanceState };
  playerZoneRef: { current: ZoneCoords };
  setPlayerZone: (zone: ZoneCoords) => void;
  visitedZonesRef: { current: Map<string, WorldSnapshot> };
  worldSeedRef: { current: string };
  setSessionSeed: (seed: string) => void;
  cavePlantingsRef: { current: Record<string, FloraEntity[]> };
  resetInstanceState: () => void;
  // The latest-state mirror's ingredients, as values (refreshed each
  // render, exactly as App's own mirror was).
  floraList: FloraEntity[];
  faunaList: FaunaEntity[];
  structuresList: StructureEntity[];
  droppedItems: DroppedItemEntity[];
  inventory: InventoryMap;
  playerState: PlayerState;
  codexList: CodexEntry[];
  fieldNotesState: FieldNotesState;
  dayNightCycle: number;
  restoreInventory: (saved: InventoryMap) => void;
  restorePlayerState: (state: PlayerState) => void;
  setCodexList: (list: CodexEntry[]) => void;
  setFieldNotesState: (state: FieldNotesState) => void;
  setDayNightCycle: (value: number) => void;
  setQuestProgress: (progress: QuestProgressState) => void;
  replaceWorld: (world: WorldSnapshot) => void;
  enterFullscreenOnTouch: () => void;
  postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
  /** LAZY: the debug kit's stash ref itself (saveNow reads the
   *  stashed pouch; apply/create CLEAR the swap by nulling it). */
  getDebugStashRef: () => { current: InventoryMap | null };
  captureCavePlantings: (key: string) => void;
  plantingsKey: (instanceId: string, depth: number) => string;
  /** The World Asks Back (2026-10-16): the saga event ledger,
   *  saved under the save record's `asksBack` key. */
  asksBackState: AsksBackState;
  setAsksBackState: (state: AsksBackState) => void;
}

export function useSaveSession(deps: SaveSessionDeps) {
  const {
    engineRef, playerPosRef, instanceRef,
    playerZoneRef, setPlayerZone, visitedZonesRef, worldSeedRef, setSessionSeed,
    cavePlantingsRef, resetInstanceState,
    floraList, faunaList, structuresList, droppedItems,
    inventory, playerState, codexList, fieldNotesState, asksBackState, dayNightCycle,
    restoreInventory, restorePlayerState, setCodexList, setFieldNotesState, setAsksBackState, setDayNightCycle, setQuestProgress,
    replaceWorld, enterFullscreenOnTouch, postNotification, getDebugStashRef,
    captureCavePlantings, plantingsKey,
  } = deps;

    // --------------------------------------------------------------------------
    // Save System — start gate, snapshots, autosave
  // --------------------------------------------------------------------------
  // hasStarted is the boot gate: the start screen stays up until the
  // player picks a saved world, starts a new one, or takes the co-op door.
  const [hasStarted, setHasStarted] = useState(false);

  // The library shown on the start screen (metadata only — worlds load on
  // demand when one is picked).
  const [saveList, setSaveList] = useState<SaveMetadata[]>([]);

  // Which save the current session belongs to. A ref, not state: the
  // autosave timer and pagehide handler must always see the latest value
  // without re-subscribing. Null means "no save attached" — the start
  // screen is still up, or this is a co-op guest session.
  const currentSaveRef = useRef<SaveMetadata | null>(null);


  // A mirror of every state slice a save needs, refreshed each render.
  // Timers and network callbacks read from here so they never act on
  // stale closures. (The engine loop keeps its own per-list refs; this
  // one exists purely for save/snapshot assembly.)
  const latestStateRef = useRef({
    floraList, faunaList, structuresList, droppedItems,
    inventory, playerState, codexList, fieldNotesState, asksBackState, dayNightCycle,
  });
  useEffect(() => {
    latestStateRef.current = {
      floraList, faunaList, structuresList, droppedItems,
      inventory, playerState, codexList, fieldNotesState, asksBackState, dayNightCycle,
    };
  });

  // The world-only portion of current state (what world_sync sends and
  // what a save stores as its world). While the player is inside a
  // cavern, "the world" is the PARKED surface world: instances are
  // regenerated from their seed on entry and are never themselves
  // saved or synced — a guest joining a host who is underground gets
  // the surface, which is where they'll arrive.
  const buildWorldSnapshot = (): WorldSnapshot => {
    const inst = instanceRef.current;
    if (inst.kind !== 'surface') return inst.parked;
    const s = latestStateRef.current;
    return { flora: s.floraList, fauna: s.faunaList, structures: s.structuresList, drops: s.droppedItems };
  };


  // Player state for a save: the React state holds vitals and tool picks,
  // but the live position truth is playerPosRef (the game loop moves the
  // ref every tick) — so position is overlaid from the ref. Inside a
  // cavern, the saved position is the mouth's surface exit anchor: you
  // wake up OUTSIDE the cave you were exploring, on solid ground.
  const buildCurrentPlayerState = () => {
    const inst = instanceRef.current;
    if (inst.kind === 'ruin') {
      // Wake up OUTSIDE the ruin, at its landmark's exit anchor.
      const landmark = inst.parked.structures.find((s) => s.id === inst.landmarkId);
      const exitX = landmark?.ruin?.exitX ?? playerPosRef.current.x;
      const exitZ = landmark?.ruin?.exitZ ?? playerPosRef.current.z;
      return {
        ...latestStateRef.current.playerState,
        x: exitX,
        z: exitZ,
        rotation: landmark
          ? Math.atan2(exitX - landmark.worldX, exitZ - landmark.worldZ)
          : playerPosRef.current.rotation,
        level: 0,
      };
    }
    if (inst.kind === 'cavern') {
      const mouth = inst.parked.structures.find((s) => s.id === inst.mouthId);
      const exitX = mouth?.cave?.exitX ?? playerPosRef.current.x;
      const exitZ = mouth?.cave?.exitZ ?? playerPosRef.current.z;
      return {
        ...latestStateRef.current.playerState,
        x: exitX,
        z: exitZ,
        rotation: mouth
          ? Math.atan2(exitX - mouth.worldX, exitZ - mouth.worldZ)
          : playerPosRef.current.rotation,
        level: 0,
      };
    }
    return {
      ...latestStateRef.current.playerState,
      x: playerPosRef.current.x,
      z: playerPosRef.current.z,
      rotation: playerPosRef.current.rotation,
    };
  };

  // Writes the current session to its save slot. The two guard clauses
  // are the whole safety story: no save attached → nothing to write;
  // connected as a guest → the world belongs to the host, never save it.
  const saveNow = useCallback((): void => {
    const meta = currentSaveRef.current;
    if (!meta) return;
    if (multiplayerManager.isConnected && !multiplayerManager.isHost) return;
    const s = latestStateRef.current;
    // A save taken mid-delve: capture the cave's plantings first (the
    // snapshot itself still writes the parked surface world, so the
    // player wakes up outside — with their cave garden on record).
    if (instanceRef.current.kind === 'cavern') {
      captureCavePlantings(plantingsKey(instanceRef.current.instanceId, instanceRef.current.depth));
    }
    // While a debug-kit swap is active, the STASH is the pouch of
    // record — saves never see the kit (see toggleDebugKit).
    const record = buildSavedGame(meta, buildWorldSnapshot(), getDebugStashRef().current ?? s.inventory, buildCurrentPlayerState(), s.dayNightCycle, s.codexList, cavePlantingsRef.current, s.fieldNotesState, s.asksBackState);
    // Zone travel (2026-10-15): the record also carries every visited
    // zone's snapshot plus where the player is standing. The `world`
    // field above already holds the CURRENT zone's snapshot (the save
    // format's mirror rule); `zones` keeps the rest of the country.
    // buildWorldSnapshot covers the parked-surface case too — inside a
    // cave, the snapshot it returns IS the current zone's surface.
    record.zones = {
      ...Object.fromEntries(visitedZonesRef.current),
      [zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz)]: buildWorldSnapshot(),
    };
    record.currentZone = { ...playerZoneRef.current };
    currentSaveRef.current = { ...meta, savedAt: record.savedAt };
    void storeSavedGame(record);
    // buildWorldSnapshot/buildCurrentPlayerState only read refs, so this
    // callback safely stays stable for the interval/pagehide effects.
  }, []);


  // Load the save library once at boot, for the start screen.
  useEffect(() => {
    void listSaveMetadata().then(setSaveList);
  }, []);

  // Autosave on an interval while a world is open.
  useEffect(() => {
    if (!hasStarted) return;
    const id = setInterval(saveNow, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [hasStarted, saveNow]);

  // Save when the page goes away. `pagehide` is the reliable leave
  // signal — it fires on tab close and navigation, including mobile
  // browsers where beforeunload often never runs.
  useEffect(() => {
    const onPageHide = () => saveNow();
    window.addEventListener('pagehide', onPageHide);
    return () => window.removeEventListener('pagehide', onPageHide);
  }, [saveNow]);


  // The 2026-10-15 types pass, as an epoch: saves CREATED before it
  // played by the old gauntlet rules (see the migration in
  // applySavedGame). Midnight EDT on the day the pass landed.
  const GAUNTLET_TYPES_PASS_EPOCH_MS = Date.UTC(2026, 9, 15, 4, 0, 0);

  // Applies a loaded record to every state holder at once: world lists,
  // pouch, player (state AND the loop's position ref), codex, and clock.
    const applySavedGame = (record: SavedGameRecord): void => {
      resetInstanceState();
      // The world's per-cave plantings come back with it (older saves
      // have none — an empty record, every cave wild).
      cavePlantingsRef.current = record.cavePlantings ?? {};
      // Zone travel (2026-10-15): restore the visited-zones map and the
      // zone the player saved in. Pre-travel saves have neither field:
      // their world IS the spawn zone, and the map starts from it.
      const restoredZones = new Map<string, WorldSnapshot>(Object.entries(record.zones ?? {}));
      const restoredZone: ZoneCoords = record.currentZone ?? { zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz };
      if (!restoredZones.has(zoneKey(restoredZone.zx, restoredZone.zz))) {
        restoredZones.set(zoneKey(restoredZone.zx, restoredZone.zz), record.world);
      }
      // The Heart Tile (Adam, 2026-10-16): the spawn base's default
      // respawn point. Worlds saved before it existed have a plain
      // root floor at the heart cell — convert it in place (same id,
      // same cell; only the type changes) so every world wakes on
      // the tile. Idempotent: a world that has one is untouched.
      const spawnSnap = restoredZones.get(zoneKey(SPAWN_ZONE.zx, SPAWN_ZONE.zz));
      if (spawnSnap && !spawnSnap.structures.some((s) => s.type === 'heart_tile')) {
        const heartCell = spawnSnap.structures.find(
          (s) => s.type === 'root_tile_floor' && s.gridX === 0 && s.gridZ === 0,
        );
        if (heartCell) heartCell.type = 'heart_tile';
      }
      visitedZonesRef.current = restoredZones;
      playerZoneRef.current = restoredZone;
      setPlayerZone(restoredZone);
      worldSeedRef.current = record.worldSeed ?? '';
      setSessionSeed(record.worldSeed ?? '');
      // THE WORLD ASKS BACK, S4: the restored zone loads through the
      // same consequence apply path as travel (the world author only —
      // a guest's restored lists are their host's truth already). Load
      // mode: removals + settled individuals materialize; abundance
      // never scales a player-shaped snapshot.
      const restoredKey = zoneKey(restoredZone.zx, restoredZone.zz);
      const restoredSnap = restoredZones.get(restoredKey) ?? record.world;
      const isAuthor = !multiplayerManager.isConnected || multiplayerManager.isHost;
      const appliedSnap = isAuthor
        ? applyZoneConsequences(
            { fauna: restoredSnap.fauna, flora: restoredSnap.flora },
            restoredZone.zx, restoredZone.zz,
            record.asksBack ?? EMPTY_ASKS_BACK,
            'load',
          )
        : { fauna: restoredSnap.fauna, flora: restoredSnap.flora };
      if (appliedSnap.fauna !== restoredSnap.fauna || appliedSnap.flora !== restoredSnap.flora) {
        const withApplied = { ...restoredSnap, fauna: appliedSnap.fauna, flora: appliedSnap.flora };
        restoredZones.set(restoredKey, withApplied);
        replaceWorld(withApplied);
      } else {
        replaceWorld(restoredSnap);
      }
      // Repaint the ground with the RESTORED zone's biome (pre-seed
      // saves pass null and keep the plain quadrant colors). This is
      // the only biome repaint on load — handleSelectSave used to do
      // it for the spawn zone before zones could be restored mid-map.
      engineRef.current?.setZoneBiome(record.worldSeed ? zoneBiomeAt(record.worldSeed, restoredZone.zx, restoredZone.zz) : null, record.worldSeed ? zoneFaceAt(record.worldSeed, restoredZone.zx, restoredZone.zz)?.tint ?? null : null, record.worldSeed && zoneFaceAt(record.worldSeed, restoredZone.zx, restoredZone.zz) ? { distanceMult: zoneFaceAt(record.worldSeed, restoredZone.zx, restoredZone.zz)!.lightDistanceMult, intensityMult: zoneFaceAt(record.worldSeed, restoredZone.zx, restoredZone.zz)!.lightIntensityMult } : null);
      // Gauntlet migration (types pass, 2026-10-15): the gauntlet is
      // issued equipment now, so every loaded world wears one — grant
      // it where an older save predates the starter kit. And fairness
      // for the old rules: before the pass, the ONLY way to hold a
      // gauntlet was to craft it for remote synthesis — a pre-pass
      // save holding one had paid for the graft's gift, so the graft
      // itself is granted. Post-pass saves can't false-trigger this:
      // their gauntlet is the starter, and createdAt says so.
      const migratedInventory = { ...record.inventory };
      if ((migratedInventory['field_synthesizer_gauntlet'] || 0) < 1) {
        migratedInventory['field_synthesizer_gauntlet'] = 1;
      }
      // The graft grant stands on its OWN condition (bug fix,
      // 2026-10-15): written as an else-if behind the gauntlet grant
      // above, it could only fire for a save that ALREADY held the
      // gauntlet item — but that item id is new in the pass, so no
      // pre-pass save ever held it, the gauntlet grant always fired
      // first, and the graft was never granted at all. The reported
      // symptom (Adam's daughter): the save wears a "Field
      // Synthesizer Gauntlet" in the pouch while field synthesis
      // stays locked and the graft recipe sits unlocked. The two
      // grants are independent facts; they are checked independently.
      if (
        record.createdAt < GAUNTLET_TYPES_PASS_EPOCH_MS &&
        (migratedInventory['gauntlet_synthesizer_upgrade'] || 0) < 1
      ) {
        migratedInventory['gauntlet_synthesizer_upgrade'] = 1;
      }
      getDebugStashRef().current = null;
      restoreInventory(migratedInventory);
      restorePlayerState(record.playerState);
      playerPosRef.current = {
        x: record.playerState.x,
        z: record.playerState.z,
        rotation: record.playerState.rotation,
      };
      setCodexList(record.codexList);
      setFieldNotesState(record.fieldNotes ?? { unlocked: [], witnessed: [] });
      // The World Asks Back: an old record lacks the key and lands
      // here with an empty memory — offers regenerate from seed +
      // day, so the fallback contradicts nothing.
      setAsksBackState(record.asksBack ?? EMPTY_ASKS_BACK);
      setDayNightCycle(record.dayNightCycle);
    };

    const handleSelectSave = (id: string): void => {
      void loadSavedGame(id).then((record) => {
        if (!record) {
          postNotification('Save Unreadable', 'That world could not be loaded (missing, or written by an older format).', 'system', '#ef4444');
          return;
        }
        applySavedGame(record);
        enterFullscreenOnTouch();
        currentSaveRef.current = {
          id: record.id, name: record.name, difficulty: record.difficulty,
          worldSeed: record.worldSeed ?? '',
          createdAt: record.createdAt, savedAt: record.savedAt,
        };
        // (The biome repaint happens inside applySavedGame now — it
        // knows the zone the save was taken in.)
        setHasStarted(true);
        postNotification(
          'World Loaded',
          record.worldSeed ? `Welcome back to ${record.name} · Seed ${record.worldSeed}` : `Welcome back to ${record.name}.`,
          'system',
          '#10b981'
        );
      });
    };

    const handleCreateSave = (name: string, difficulty: GameDifficulty, worldSeed: string): void => {
      enterFullscreenOnTouch();
      resetInstanceState();
      cavePlantingsRef.current = {};
      getDebugStashRef().current = null;
      const meta = createSaveMetadata(name, difficulty, worldSeed);
      currentSaveRef.current = meta;
      // A new world starts the mini-quest chain fresh (2026-10-15):
      // nothing latched, the first quest tracked, the tracker HUD on
      // — the player can hide it from the quest list's checkbox [Q].
      setQuestProgress({ completedIds: [], trackedId: 'q_first_harvest', showHud: true });
      // The seed earns its keep: a new world's flora and fauna are GROWN
      // from it (seeded surface scatter — game/worldGen.ts) instead of
      // reusing the fixed hand-placed starter layout. Starter structures
      // (forge, floors, mound) stay fixed — they're the homestead, not
      // wilderness. Generate from meta.worldSeed: createSaveMetadata
      // guarantees a non-empty seed, and the world must match the seed
      // its save advertises.
      const generated = generateSeededWorld(meta.worldSeed, 0, 0, { landform: true });
      const spawnWorld: WorldSnapshot = {
        flora: generated.flora,
        fauna: generated.fauna,
        // Starter structures stay fixed (the homestead); world-grown
        // structures (v4: the spawn zone's cave mouth) join them here.
        structures: [...INITIAL_STRUCTURES, ...generated.structures],
        drops: [],
      };
      replaceWorld(spawnWorld);
      // Zone travel: a new world starts at home — the visited map
      // holds just the spawn zone (the very lists now live), the
      // player stands in it, and the session seed is this world's.
      visitedZonesRef.current = new Map([[zoneKey(SPAWN_ZONE.zx, SPAWN_ZONE.zz), spawnWorld]]);
      playerZoneRef.current = { zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz };
      setPlayerZone({ zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz });
      worldSeedRef.current = meta.worldSeed;
      setSessionSeed(meta.worldSeed);
      // The ground wears the spawn zone's biome tint (always meadow).
      engineRef.current?.setZoneBiome(zoneBiomeAt(meta.worldSeed, SPAWN_ZONE.zx, SPAWN_ZONE.zz));
      setHasStarted(true);
      // First save right away — but deferred a beat: saveNow reads
      // latestStateRef, which only syncs after the replaceWorld render
      // commits, so saving in this same tick would snapshot the PREVIOUS
      // world into the new save. Writing it now (50 ms later) means the
      // world exists in the library from minute one.
      window.setTimeout(() => saveNow(), 50);
      postNotification('New World Created', `${meta.name} · Seed ${meta.worldSeed} — grown from your seed. Autosaving as you play.`, 'system', '#10b981');
    };

    const handleDeleteSave = (id: string): void => {
      void deleteSavedGame(id)
        .then(() => listSaveMetadata())
        .then(setSaveList);
    };



    const handleManualSave = (): void => {
      const meta = currentSaveRef.current;
      if (!meta) {
        postNotification('Nothing to Save', 'You are visiting as a co-op guest — there is no local world attached to this session.', 'system', '#f59e0b');
        return;
      }
      if (multiplayerManager.isConnected && !multiplayerManager.isHost) {
        postNotification('Guest Session', "You are playing in the host's world — only the host can save it.", 'system', '#f59e0b');
        return;
      }
      saveNow();
      postNotification('World Saved', `${meta.name} was saved just now.`, 'system', '#10b981');
    };

  return {
    hasStarted, setHasStarted, saveList, currentSaveRef, latestStateRef,
    buildWorldSnapshot, buildCurrentPlayerState, saveNow,
    applySavedGame, handleSelectSave, handleCreateSave, handleDeleteSave, handleManualSave,
  };
}
