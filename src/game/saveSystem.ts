/**
 * BioForge Save System
 * ---------------------------------------------------------------------------
 * Local-first persistence for whole game worlds, built on the browser's
 * IndexedDB. Why IndexedDB and not localStorage:
 *   - A world snapshot (every plant, critter, structure, and drop) is far
 *     too big for localStorage's ~5 MB string quota as the game grows.
 *   - IndexedDB stores structured objects directly — no JSON stringifying
 *     the entire world on every autosave.
 *   - It costs nothing, needs no account, and works fully offline, which
 *     matches the project's local-first decision (2026-10-11). Cloud sync
 *     can ride the multiplayer transport later without changing this API.
 *
 * One record per saved game. A record is the metadata (what the start
 * screen's save list shows) plus the full world snapshot (what loading
 * actually restores). Every record carries a format `version` so a future
 * version of the game can recognise — and one day migrate — older saves
 * instead of silently misreading them.
 *
 * All world entity types are plain JSON-shaped data (they already travel
 * over the multiplayer wire as JSON), so they store and restore verbatim.
 */

import {
  CodexEntry,
  DroppedItemEntity,
  FaunaEntity,
  FloraEntity,
  ItemId,
  PlayerState,
  StructureEntity,
} from '../types/game';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Bump ONLY when the record shape changes in an incompatible way. */
export const SAVE_FORMAT_VERSION = 1;

/** How often the game autosaves while a world is open (App uses this). */
export const AUTOSAVE_INTERVAL_MS = 30000;

/** Longest world name the start screen will accept. */
export const MAX_SAVE_NAME_LENGTH = 40;

/** Longest world seed the start screen will accept. */
export const MAX_WORLD_SEED_LENGTH = 32;

const DATABASE_NAME = 'bioforge-saves';
const DATABASE_VERSION = 1;
const SAVE_STORE_NAME = 'saves';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * World difficulty. Only 'peaceful' is playable today — normal and hostile
 * need hostile creature AI that doesn't exist yet — but saves record the
 * choice from day one so the field never needs a format migration later.
 */
export type GameDifficulty = 'peaceful' | 'normal' | 'hostile';

/** Everything in the 3D world that belongs to a save (not to the player). */
export interface WorldSnapshot {
  flora: FloraEntity[];
  fauna: FaunaEntity[];
  structures: StructureEntity[];
  drops: DroppedItemEntity[];
}

/** The light-weight part of a save — all the start screen's list needs. */
export interface SaveMetadata {
  id: string;
  name: string;
  difficulty: GameDifficulty;
  /**
   * The world's seed, chosen (or rolled) on the New Game screen. World
   * generation will grow flora and fauna from this seed (hashStringToSeed
   * in game/motion.ts turns the text into a number). Saves written before
   * seeds existed simply have no seed — readers treat that as ''.
   */
  worldSeed: string;
  createdAt: number;
  savedAt: number;
}

/** A complete saved game: metadata + world + the player's own progress. */
export interface SavedGameRecord extends SaveMetadata {
  version: number;
  world: WorldSnapshot;
  inventory: Record<ItemId, number>;
  playerState: PlayerState;
  dayNightCycle: number;
  codexList: CodexEntry[];
}

// ---------------------------------------------------------------------------
// IndexedDB plumbing (promise wrappers — the raw API is callback-based)
// ---------------------------------------------------------------------------

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    // Runs on first ever open (and on future version bumps): create the
    // store. Records are keyed by their own `id` field.
    request.onupgradeneeded = () => {
      const db = request.result;
      if (db.objectStoreNames.contains(SAVE_STORE_NAME)) return;
      db.createObjectStore(SAVE_STORE_NAME, { keyPath: 'id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Runs one request against the saves store inside a transaction and
 * resolves with the request's result. The database connection is closed
 * when the transaction finishes, so nothing leaks between saves.
 */
async function transact<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  const db = await openDatabase();
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(SAVE_STORE_NAME, mode);
    const request = action(transaction.objectStore(SAVE_STORE_NAME));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Metadata for every saved game, most recently played first — exactly
 * what the start screen's list renders. The heavy world data stays on
 * disk until a save is actually chosen.
 */
export async function listSaveMetadata(): Promise<SaveMetadata[]> {
  const records = await transact<SavedGameRecord[]>('readonly', (store) => store.getAll());
  const metadata = records.map((record) => ({
    id: record.id,
    name: record.name,
    difficulty: record.difficulty,
    worldSeed: record.worldSeed ?? '',
    createdAt: record.createdAt,
    savedAt: record.savedAt,
  }));
  metadata.sort((a, b) => b.savedAt - a.savedAt);
  return metadata;
}

/**
 * Loads one full saved game by id. Returns null when the save is missing
 * or was written by an incompatible format version — the caller treats
 * null as "cannot load this world" rather than guessing at the data.
 */
export async function loadSavedGame(id: string): Promise<SavedGameRecord | null> {
  const record = await transact<SavedGameRecord | undefined>('readonly', (store) => store.get(id));
  if (!record) return null;
  if (record.version !== SAVE_FORMAT_VERSION) return null;
  return record;
}

/** Writes (or overwrites) one complete saved game. */
export async function storeSavedGame(record: SavedGameRecord): Promise<void> {
  await transact('readwrite', (store) => store.put(record));
}

/** Permanently removes one saved game. There is no undo — the UI confirms. */
export async function deleteSavedGame(id: string): Promise<void> {
  await transact('readwrite', (store) => store.delete(id));
}

/**
 * Rolls a fresh world seed: a six-digit number as text. Short enough to
 * read aloud, text a friend, or type back in — and any text works as a
 * seed, so a player can equally well type a word or a phrase instead.
 */
export function generateWorldSeed(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Builds the metadata for a brand-new world. Ids follow the codebase's
 * existing style (prefixed random string, like peer ids) — short, unique
 * enough at family scale, and readable in dev tools.
 */
export function createSaveMetadata(name: string, difficulty: GameDifficulty, worldSeed: string): SaveMetadata {
  const trimmed = name.trim().slice(0, MAX_SAVE_NAME_LENGTH);
  const seed = worldSeed.trim().slice(0, MAX_WORLD_SEED_LENGTH);
  const now = Date.now();
  return {
    id: 'save_' + Math.random().toString(36).substring(2, 10),
    name: trimmed.length > 0 ? trimmed : 'Unnamed World',
    difficulty,
    worldSeed: seed.length > 0 ? seed : generateWorldSeed(),
    createdAt: now,
    savedAt: now,
  };
}

/**
 * Assembles a complete save record from live game state, stamping it with
 * the current time and the current format version. App calls this for the
 * autosave tick, for save-on-exit, and for the first save of a new world.
 */
export function buildSavedGame(
  metadata: SaveMetadata,
  world: WorldSnapshot,
  inventory: Record<ItemId, number>,
  playerState: PlayerState,
  dayNightCycle: number,
  codexList: CodexEntry[]
): SavedGameRecord {
  return {
    ...metadata,
    savedAt: Date.now(),
    version: SAVE_FORMAT_VERSION,
    world,
    inventory,
    playerState,
    dayNightCycle,
    codexList,
  };
}
