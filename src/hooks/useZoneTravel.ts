/**
 * BioForge Zone Travel Domain Hook
 * Extracted from App.tsx (2026-10-15, the seam-by-seam refactor —
 * seam 1 of 6, a pure move: no behavior changes).
 *
 * Owns everything about WHERE the player is in the zone grid and
 * how they cross between zones: the current zone (state + ref),
 * the visited-zones snapshot map, the session world seed, the
 * sustained edge-push state the game loop accumulates, the guest's
 * pending-crossing handshake (guests never roll zones — the host
 * sends them, 2026-10-15), and the crossing verbs themselves.
 *
 * Dependencies arrive as one object. Two of them are LAZY on
 * purpose: buildWorldSnapshot and the save callback live further
 * down App's body than this hook is called, so App passes closures
 * / a ref that are only exercised after mount, when those bindings
 * exist. (Same idiom as App's travelToZoneRef.)
 */

import { useRef, useState } from 'react';
import type { BioForgeThreeEngine } from '../game/threeEngine';
import type { FirstPersonMovementController } from '../game/controller';
import type { WorldSnapshot } from '../game/saveSystem';
import { SPAWN_ZONE, zoneBiomeAt, zoneVariantAt, zoneFaceAt, zoneHops, zoneInfo, zoneKey, biomeDisplayName, type ZoneCoords } from '../game/zones';
import { generateSeededWorld } from '../game/worldGen';
import { LANDFORM_EPOCH_MS } from '../game/terrain';
import { multiplayerManager } from '../game/multiplayer';
import { snapshotOf, buildZoneSyncTravel as buildZoneSyncTravelPayload, type ZoneStores } from '../game/zoneSync';
import type { GameNotification } from '../types/game';

// Zone identification is a HELMET feature (Adam, 2026-10-15):
// naming the land is a sense, and the helmet is the sensory
// platform. No such helmet exists yet, so this is false for
// everyone — labels carry the placeholder + upgrade message,
// arrivals stay vague. When the helmet lands, this becomes an
// equipment check and every gated label lights up at once.
export const ZONE_ID_INSTALLED = false;

// Travel tuning: the movement clamp pins the player at ±48 (the
// engine's WORLD_BOUNDARY in collision.ts); arriving players land
// just inside the far side; a crossing asks for a deliberate
// half-second-ish lean, long enough that bumping the wall while
// exploring never triggers it by accident.
export const WORLD_EDGE_COORD = 48;
export const ZONE_ENTRY_INSET = 47.4;
export const ZONE_PUSH_SECONDS = 0.4;
export const ZONE_PUSH_MIN_COMPONENT = 0.35;

export type TravelDirection = 'N' | 'S' | 'E' | 'W';

// A GUEST's crossing, parked while waiting on the host: guests
// never roll a zone themselves (Adam, 2026-10-15 — the host sends
// zone info). travelToZone files the request; the multiplayer
// callbacks complete it when the host's snapshot lands. Walking
// off the edge or a silent host cancels it.
export interface PendingTravel {
  dir: TravelDirection;
  nx: number;
  nz: number;
  entryX: number;
  entryZ: number;
  slowTimer: number;
  failTimer: number;
}

export interface ZoneTravelDeps {
  engineRef: { current: BioForgeThreeEngine | null };
  playerPosRef: { current: { x: number; z: number; rotation: number } };
  movementController: { current: FirstPersonMovementController };
  jumpRef: { current: { y: number; vy: number; bounceFlip: boolean } };
  // Only the kind is read (crossings are surface-only); the full
  // instance state stays with App / the instances hook.
  instanceRef: { current: { kind: string } };
  replaceWorld: (world: WorldSnapshot) => void;
  applyPlayerLevel: (level: number) => void;
  postNotification: (title: string, message: string, type?: GameNotification['type'], iconColor?: string) => void;
  /** LAZY: App's snapshot builder, defined below this hook's call. */
  buildWorldSnapshot: () => WorldSnapshot;
  /** LAZY: the day/night clock for host world re-syncs. */
  getDayNightCycle: () => number;
  /** LAZY: saveNow, assigned into this ref by App once defined. */
  saveNowRef: { current: () => void };
  /** LAZY: the open save's creation time (pond gate, P5 move 2):
   *  zones generated on travel belong to the OPEN world, whose
   *  epoch decides whether pond life may be sown in them. */
  getWorldCreatedAt: () => number;
}

export interface UseZoneTravelResult {
  playerZone: ZoneCoords;
  setPlayerZone: (zone: ZoneCoords) => void;
  playerZoneRef: { current: ZoneCoords };
  visitedZonesRef: { current: Map<string, WorldSnapshot> };
  worldSeedRef: { current: string };
  sessionSeed: string;
  setSessionSeed: (seed: string) => void;
  edgePushRef: { current: { dir: TravelDirection; since: number } | null };
  pendingTravelRef: { current: PendingTravel | null };
  cancelPendingTravel: () => void;
  travelToZoneRef: { current: ((dir: TravelDirection) => void) | null };
  zoneStores: () => ZoneStores;
  buildZoneSyncTravel: () => { zone: string; zones: Record<string, WorldSnapshot>; worldSeed: string };
  completeTravel: (nx: number, nz: number, entry: { x: number; z: number }, hostSnapshot?: WorldSnapshot) => void;
  respawnAtSpawn: () => void;
}

export function useZoneTravel(deps: ZoneTravelDeps): UseZoneTravelResult {
  const {
    engineRef, playerPosRef, movementController, jumpRef, instanceRef,
    replaceWorld, applyPlayerLevel, postNotification,
    buildWorldSnapshot, getDayNightCycle, saveNowRef, getWorldCreatedAt,
  } = deps;

  // The world is a grid of zones; the player stands in exactly one.
  // Every VISITED zone keeps a snapshot here, persisting exactly as
  // left; unvisited zones aren't stored — they roll from (seed,
  // coords) on arrival. The host's map is the authority for
  // player-made changes across the country.
  const [playerZone, setPlayerZone] = useState<ZoneCoords>({ zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz });
  const playerZoneRef = useRef<ZoneCoords>({ zx: SPAWN_ZONE.zx, zz: SPAWN_ZONE.zz });
  const visitedZonesRef = useRef<Map<string, WorldSnapshot>>(new Map());
  // The seed of the world being played, whatever door the player came
  // through (own save → its seed; co-op guest → the host's seed, from
  // world_sync). Zone generation and zone identity both read it.
  const worldSeedRef = useRef<string>('');
  const [sessionSeed, setSessionSeed] = useState<string>('');
  // The sustained edge push, accumulated by the game loop: which edge
  // the player is leaning on, and since when. Push-through crossing:
  // hold your movement against the border for ZONE_PUSH_SECONDS and
  // you step through into the next zone.
  const edgePushRef = useRef<{ dir: TravelDirection; since: number } | null>(null);
  const pendingTravelRef = useRef<PendingTravel | null>(null);
  const cancelPendingTravel = (): void => {
    const p = pendingTravelRef.current;
    if (!p) return;
    window.clearTimeout(p.slowTimer);
    window.clearTimeout(p.failTimer);
    pendingTravelRef.current = null;
  };
  // The game loop calls travel through this ref (the loop lives in
  // App until seam 6; the indirection keeps call order irrelevant).
  const travelToZoneRef = useRef<((dir: TravelDirection) => void) | null>(null);

  // The stores the zone-sync router writes into (game/zoneSync.ts):
  // the visited map, the parked surface while inside an instance
  // (owned by App's instance machinery — read structurally here),
  // and the session seed.
  const zoneStores = (): ZoneStores => ({
    visited: visitedZonesRef.current,
    parked: () => {
      const inst = instanceRef.current as { kind: string; parked?: WorldSnapshot };
      return inst.kind !== 'surface' ? (inst.parked ?? null) : null;
    },
    setParked: (snap: WorldSnapshot) => {
      const inst = instanceRef.current as { kind: string; parked?: WorldSnapshot };
      if (inst.kind !== 'surface') inst.parked = snap;
    },
    seed: worldSeedRef.current,
    myZoneKey: zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz),
  });

  // A membership copy of the zone currently loaded — the deps'
  // buildWorldSnapshot already answers "the surface world" (the
  // parked lists while inside an instance, which ARE the current
  // zone's surface); snapshotOf copies the arrays so stored
  // membership can't drift.
  const snapshotCurrentZone = (): WorldSnapshot => snapshotOf(buildWorldSnapshot());

  // The world_sync travel payload for the zone I stand in (zoneSync.ts).
  const buildZoneSyncTravel = (): { zone: string; zones: Record<string, WorldSnapshot>; worldSeed: string } =>
    buildZoneSyncTravelPayload(visitedZonesRef.current, zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz), buildWorldSnapshot(), worldSeedRef.current);

  // The crossing itself, once the far zone is IN HAND. Solo players
  // and hosts hold every zone already (their map, or a fresh roll of
  // their own seed); guests arrive here only with a host-sent
  // snapshot (hostSnapshot) — a guest never rolls a zone itself.
  const completeTravel = (nx: number, nz: number, entry: { x: number; z: number }, hostSnapshot?: WorldSnapshot): void => {
    // No crossing from underground: instances are entered from a
    // zone and exited back into it; the border out there isn't real.
    if (instanceRef.current.kind !== 'surface') return;
    const seed = worldSeedRef.current;
    if (!seed) return; // seedless contexts keep the single-zone world
    const cur = playerZoneRef.current;
    const pos = playerPosRef.current;
    // 1. Park the zone being left exactly as it stands — MINUS the
    //    pets set to Follow: they cross with their person (Adam,
    //    2026-10-15). Stay/guard pets keep their posts here, and
    //    this zone's snapshot goes back in the map either way.
    const leaving = snapshotCurrentZone();
    const followers = leaving.fauna.filter((f) => f.isTamed && f.command === 'follow');
    visitedZonesRef.current.set(zoneKey(cur.zx, cur.zz), {
      ...leaving,
      fauna: leaving.fauna.filter((f) => !(f.isTamed && f.command === 'follow')),
    });
    // 2. The far side: the host's snapshot when one was sent (and
    //    it joins my map as my copy of the truth); else a visited
    //    zone returns exactly as it was left; else — host or solo
    //    only — a new one rolls from (seed, coords), the coords a
    //    parameter of every roll.
    const nextKey = zoneKey(nx, nz);
    let target = hostSnapshot ?? visitedZonesRef.current.get(nextKey);
    if (hostSnapshot) visitedZonesRef.current.set(nextKey, hostSnapshot);
    if (!target) {
      const gen = generateSeededWorld(seed, nx, nz, { landform: getWorldCreatedAt() >= LANDFORM_EPOCH_MS });
      target = { flora: gen.flora, fauna: gen.fauna, structures: gen.structures, drops: [] };
      visitedZonesRef.current.set(nextKey, target);
    }
    // Follow pets materialize beside their person in a loose ring,
    // already walking to the arrival point.
    const arrivals = followers.map((f, i) => ({
      ...f,
      x: entry.x + ((i % 3) - 1) * 1.6,
      z: entry.z + (Math.floor(i / 3) - 0.5) * 1.6,
      targetX: entry.x,
      targetZ: entry.z,
    }));
    replaceWorld({
      flora: target.flora,
      fauna: [...target.fauna, ...arrivals],
      structures: target.structures,
      drops: target.drops,
    });
    // 3. Stand there: identity, paint, position, story, momentum.
    playerZoneRef.current = { zx: nx, zz: nz };
    setPlayerZone({ zx: nx, zz: nz });
    engineRef.current?.setZoneBiome(zoneBiomeAt(seed, nx, nz), zoneFaceAt(seed, nx, nz)?.tint ?? null, zoneFaceAt(seed, nx, nz) ? { distanceMult: zoneFaceAt(seed, nx, nz)!.lightDistanceMult, intensityMult: zoneFaceAt(seed, nx, nz)!.lightIntensityMult } : null);
    applyPlayerLevel(0);
    jumpRef.current = { y: 0, vy: 0, bounceFlip: false };
    playerPosRef.current = { x: entry.x, z: entry.z, rotation: pos.rotation };
    engineRef.current?.setPlayerPosition(entry.x, entry.z, 0);
    movementController.current.velocity.set(0, 0, 0);
    // 4. Announce the arrival — as fully as the player's gear
    //    allows. Zone identification is a helmet feature: without
    //    it the land stays unnamed, but dead reckoning (how far
    //    from home, which zone address) is the player's own.
    const hops = zoneHops(nx, nz);
    if (nx === SPAWN_ZONE.zx && nz === SPAWN_ZONE.zz) {
      postNotification('Home Again', 'The spawn zone — your homestead country.', 'system', '#38bdf8');
    } else if (ZONE_ID_INSTALLED) {
      const info = zoneInfo(seed, nx, nz);
      postNotification(info.name, `${biomeDisplayName(info.biome)} · ${hops} zone${hops === 1 ? '' : 's'} from home`, 'system', '#38bdf8');
    } else {
      postNotification('Unidentified Country', `${hops} zone${hops === 1 ? '' : 's'} from home · Zone ${nx}, ${nz} — a helmet zone identifier would name this land.`, 'system', '#38bdf8');
    }
    // 5. Persist shortly (the deferred beat lets the zone swap
    //    render first, the same trick world creation uses), and if
    //    hosting, re-sync the map so guests' copies stay true.
    window.setTimeout(() => saveNowRef.current(), 250);
    if (multiplayerManager.isConnected && multiplayerManager.isHost) {
      multiplayerManager.broadcastWorldSync(buildWorldSnapshot(), getDayNightCycle(), buildZoneSyncTravel());
    }
  };

  // The edge push, resolved into a crossing. Called by the game
  // loop (through travelToZoneRef) when the lean has been
  // sustained. Solo players and hosts complete immediately; a
  // GUEST asks the host for the zone and waits at the border —
  // the host is the world's one source of truth, zones included.
  const travelToZone = (dir: TravelDirection): void => {
    if (instanceRef.current.kind !== 'surface') return;
    if (pendingTravelRef.current) return; // one crossing at a time
    if (!worldSeedRef.current) return;
    const cur = playerZoneRef.current;
    const nx = dir === 'E' ? cur.zx + 1 : dir === 'W' ? cur.zx - 1 : cur.zx;
    const nz = dir === 'S' ? cur.zz + 1 : dir === 'N' ? cur.zz - 1 : cur.zz;
    // Arrive just inside the far edge, level with where you left on
    // the cross-axis, facing the way you were facing.
    const pos = playerPosRef.current;
    const clampAxis = (v: number): number => Math.max(-ZONE_ENTRY_INSET, Math.min(ZONE_ENTRY_INSET, v));
    const entry = {
      x: dir === 'E' ? -ZONE_ENTRY_INSET : dir === 'W' ? ZONE_ENTRY_INSET : clampAxis(pos.x),
      z: dir === 'S' ? -ZONE_ENTRY_INSET : dir === 'N' ? ZONE_ENTRY_INSET : clampAxis(pos.z),
    };
    if (multiplayerManager.isConnected && !multiplayerManager.isHost) {
      const pending: PendingTravel = { dir, nx, nz, entryX: entry.x, entryZ: entry.z, slowTimer: 0, failTimer: 0 };
      pending.slowTimer = window.setTimeout(() => {
        if (pendingTravelRef.current === pending) {
          postNotification('Crossing…', 'Waiting on the host to send that zone.', 'system', '#94a3b8');
        }
      }, 900);
      pending.failTimer = window.setTimeout(() => {
        if (pendingTravelRef.current === pending) {
          cancelPendingTravel();
          postNotification('No Answer From the Host', 'That zone never arrived — the way stays shut for now. Lean into the edge to try again.', 'system', '#f59e0b');
        }
      }, 6000);
      pendingTravelRef.current = pending;
      multiplayerManager.broadcastZoneRequest(zoneKey(nx, nz));
      return;
    }
    completeTravel(nx, nz, entry);
  };
  travelToZoneRef.current = travelToZone;

  // Death respawn (Adam, 2026-10-15): wake at the ORIGINAL SPAWN
  // BASE — the spawn zone, at its heart (0, 0). Solo players and
  // hosts complete at once through the same arrival path as any
  // crossing; a guest asks the host for the spawn zone like any
  // other zone — the host is the truth — and steps through when
  // it arrives (the sync layer completes pending travels from
  // their fields, this one included). Surface only in v1: the
  // game's one health-drain today (scar heat) is a surface
  // effect; instance deaths join when cave/ruin dangers exist.
  const respawnAtSpawn = (): void => {
    if (instanceRef.current.kind !== 'surface') return;
    if (!worldSeedRef.current) return;
    // The wake point is the Heart Tile (Adam, 2026-10-16): the
    // spawn base's default respawn point, standing at its heart.
    // The tile's own position rules when it can be read from the
    // spawn snapshot; the heart coordinates are its home either way.
    const spawnSnap = visitedZonesRef.current.get(zoneKey(SPAWN_ZONE.zx, SPAWN_ZONE.zz));
    const heartTile = spawnSnap?.structures.find((s) => s.type === 'heart_tile');
    const entry = heartTile ? { x: heartTile.worldX, z: heartTile.worldZ } : { x: 0, z: 0 };
    if (multiplayerManager.isConnected && !multiplayerManager.isHost) {
      if (pendingTravelRef.current) return; // a crossing is already waiting
      const pending: PendingTravel = { dir: 'N', nx: SPAWN_ZONE.zx, nz: SPAWN_ZONE.zz, entryX: entry.x, entryZ: entry.z, slowTimer: 0, failTimer: 0 };
      pending.slowTimer = window.setTimeout(() => {
        if (pendingTravelRef.current === pending) {
          postNotification('Waking…', 'Waiting on the host to send the spawn zone.', 'system', '#94a3b8');
        }
      }, 900);
      pending.failTimer = window.setTimeout(() => {
        if (pendingTravelRef.current === pending) {
          cancelPendingTravel();
          postNotification('No Answer From the Host', 'The way home never arrived — you remain where you fell, alive but far from base.', 'system', '#f59e0b');
        }
      }, 6000);
      pendingTravelRef.current = pending;
      multiplayerManager.broadcastZoneRequest(zoneKey(SPAWN_ZONE.zx, SPAWN_ZONE.zz));
      return;
    }
    completeTravel(SPAWN_ZONE.zx, SPAWN_ZONE.zz, entry);
  };

  return {
    playerZone, setPlayerZone, playerZoneRef, visitedZonesRef, worldSeedRef,
    sessionSeed, setSessionSeed, edgePushRef, pendingTravelRef, cancelPendingTravel,
    travelToZoneRef, zoneStores, buildZoneSyncTravel, completeTravel, respawnAtSpawn,
  };
}
