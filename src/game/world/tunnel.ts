import type { StructureEntity } from '../../types/game';
import { zoneKey, type ZoneCoords } from './zones';

/**
 * The BioTunnel (Adam, 2026-10-16): ONE organism with two mouths,
 * grown in two places — the tunnel is its body under the world.
 * There is exactly one living pair at a time: a recipe grows both
 * mouths, the player sets them down by hand wherever the tunnel
 * should run, and stepping through one delivers you to the other.
 *
 * Pairing is DERIVED, never stored as truth: the pair is whole
 * exactly when two mouths exist across the current zone and every
 * visited zone's snapshot. Dissolving an end needs no bookkeeping
 * — the survivor simply reads dormant at the next count, and a
 * fresh end set down anywhere re-pairs the moment it lands.
 */
export const TUNNEL_MAX_MOUTHS = 2;

export interface TunnelMouthRef {
  zone: ZoneCoords;
  structure: StructureEntity;
}

/** A world snapshot's shape, structurally — all the search needs. */
type SnapshotLike = { structures: StructureEntity[] };

/**
 * Every BioTunnel mouth in the known world: the live structure
 * list speaks for the current zone (its snapshot in the map is a
 * parked copy from the last departure and may be stale), and each
 * other visited zone speaks through its snapshot.
 */
export function findTunnelMouths(
  currentStructures: StructureEntity[],
  currentZone: ZoneCoords,
  snapshots: Map<string, SnapshotLike>,
): TunnelMouthRef[] {
  const out: TunnelMouthRef[] = [];
  for (const s of currentStructures) {
    if (s.type === 'biotunnel_mouth') out.push({ zone: currentZone, structure: s });
  }
  const currentKey = zoneKey(currentZone.zx, currentZone.zz);
  snapshots.forEach((snap, key) => {
    if (key === currentKey) return;
    const [zx, zz] = key.split(',').map(Number);
    if (!Number.isFinite(zx) || !Number.isFinite(zz)) return;
    for (const s of snap.structures) {
      if (s.type === 'biotunnel_mouth') out.push({ zone: { zx, zz }, structure: s });
    }
  });
  return out;
}
