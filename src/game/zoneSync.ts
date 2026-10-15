// ============================================================================
// zoneSync.ts — zone-scoped routing for remote entity events
// ============================================================================
// With independent zone travel (2026-10-15), an entity event that
// arrives over the wire happened in the SENDER's zone, which may not
// be the zone the receiver is standing in. These helpers decide
// where the event belongs and apply it to a stored snapshot when it
// doesn't belong to the live lists:
//
//   LIVE  — the receiver's loaded lists (their current zone, or the
//           instance they're inside). App applies these itself.
//   STORE — a snapshot the receiver keeps: their parked surface
//           while inside one of its instances, or — for the host,
//           who authors the save — ANY zone in the visited map, so a
//           guest's work in a far zone lands in the host's record.
//   DROP  — someone else's business in a zone the receiver has no
//           stake in.
//
// Extracted from App.tsx on the push-size trigger (the standing
// split-on-trigger strategy): the routing rules are pure decisions
// over (tag, identity, stores) and belong together in one module.

import type { WorldSnapshot } from './saveSystem';
import type { EntityKind, EntitySnapshot } from './multiplayer';
import { generateSeededWorld } from './worldGen';

/** Apply one entity upsert/remove to a stored snapshot, returning
 *  the new snapshot (list membership replaced, never mutated). */
export function applyEntityToSnapshot(
  snap: WorldSnapshot,
  kind: EntityKind,
  entity: EntitySnapshot | null,
  removeId?: string
): WorldSnapshot {
  const replaceIn = <T extends { id: string }>(list: T[]): T[] => {
    if (removeId) return list.filter((e) => e.id !== removeId);
    if (!entity) return list;
    const ent = entity as unknown as T;
    const idx = list.findIndex((e) => e.id === ent.id);
    if (idx === -1) return [...list, ent];
    const next = [...list];
    next[idx] = ent;
    return next;
  };
  switch (kind) {
    case 'flora':
      return { ...snap, flora: replaceIn(snap.flora) };
    case 'fauna':
      return { ...snap, fauna: replaceIn(snap.fauna) };
    case 'structure':
      return { ...snap, structures: replaceIn(snap.structures) };
    case 'drop':
      return { ...snap, drops: replaceIn(snap.drops) };
  }
}

/** Where does an event stamped `tag` belong for this receiver? */
export function routeForZoneTag(
  tag: string,
  myTag: string,
  myZoneKey: string,
  isHost: boolean
): 'live' | 'store' | 'drop' {
  if (tag === myTag) return 'live';
  if (!tag.startsWith('zone:')) return 'drop';
  const key = tag.slice('zone:'.length);
  // My own zone, while I'm inside one of its instances: the event
  // belongs to my parked surface.
  if (key === myZoneKey) return 'store';
  // Anyone else's zone: only the host keeps the whole country's
  // record; guests simply aren't concerned.
  return isHost ? 'store' : 'drop';
}

/** The mutable stores a receiver routes INTO. App supplies these
 *  from its refs: the visited-zones map, accessors for the parked
 *  surface snapshot while inside an instance, the world seed (for
 *  growing a zone the host has somehow never held), and the
 *  receiver's own zone key. */
export interface ZoneStores {
  visited: Map<string, WorldSnapshot>;
  parked: () => WorldSnapshot | null;
  setParked: (snap: WorldSnapshot) => void;
  seed: string;
  myZoneKey: string;
}

/** Apply a remote entity event to the receiver's stored snapshot
 *  for the sender's zone (the STORE route). */
export function storeEntityEvent(
  stores: ZoneStores,
  tag: string,
  kind: EntityKind,
  entity: EntitySnapshot | null,
  removeId?: string
): void {
  const key = tag.slice('zone:'.length);
  const parked = stores.parked();
  if (parked && key === stores.myZoneKey) {
    stores.setParked(applyEntityToSnapshot(parked, kind, entity, removeId));
    return;
  }
  let snap = stores.visited.get(key);
  if (!snap) {
    // Defensive only: since guests receive zones FROM the host
    // before entering them, the host should always hold a requested
    // zone already. If an event ever outruns that, grow the
    // pristine version first (deterministic), then apply.
    const [zx, zz] = key.split(',').map(Number);
    if (!stores.seed || Number.isNaN(zx) || Number.isNaN(zz)) return;
    const gen = generateSeededWorld(stores.seed, zx, zz);
    snap = { flora: gen.flora, fauna: gen.fauna, structures: gen.structures, drops: [] };
  }
  stores.visited.set(key, applyEntityToSnapshot(snap, kind, entity, removeId));
}

/** A membership copy of a snapshot: the arrays are new (so later
 *  live-list edits can't mutate the stored snapshot's membership);
 *  the entities inside are shared, as everywhere in this system. */
export function snapshotOf(snap: WorldSnapshot): WorldSnapshot {
  return { flora: [...snap.flora], fauna: [...snap.fauna], structures: [...snap.structures], drops: [...snap.drops] };
}

/** The world_sync travel payload: where the sender stands, every
 *  zone it knows (with the current one refreshed from its live
 *  lists), and the world seed — everything a guest needs to wander
 *  independently under host authority. */
export function buildZoneSyncTravel(
  visited: Map<string, WorldSnapshot>,
  curKey: string,
  current: WorldSnapshot,
  worldSeed: string
): { zone: string; zones: Record<string, WorldSnapshot>; worldSeed: string } {
  return {
    zone: curKey,
    zones: { ...Object.fromEntries(visited), [curKey]: current },
    worldSeed,
  };
}
