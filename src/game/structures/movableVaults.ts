/**
 * Movable Vaults — the move verb for containers (The World Asks Back,
 * S6; Adam, 2026-10-17). Design record: ReadMeFiles/MOVABLE_VAULTS.md.
 *
 * Containers (storage pods, sample racks, culture vats) can be lifted
 * whole — tier, contents, and a vat's gestation riding inside — and set
 * down anywhere the player is willing to walk tool-less to reach. The
 * move is the GENTLE verb; the solvent stays the teardown verb.
 *
 * The whole-entity rule (Adam, 2026-10-16): the carry holds THE WHOLE
 * ENTITY, never a hand-picked field subset — contents in their exact
 * slots, tier intact, gestation mid-count, every field the normal zone
 * snapshot would store. Every path below moves that whole entity:
 * put-down, cancel-restore, autosave projection, and the death drop.
 * Fidelity floor = the solvent fix (c281746): nothing is ever taken
 * apart, so nothing can leak.
 *
 * This module is deliberately PURE (no React, no engine, no network):
 * the carry decisions are unit-testable, and the hook in
 * hooks/useCarryVault.ts owns the live wiring.
 */
import type { StructureEntity, StructureType } from '../../types/game';
import type { WorldSnapshot } from '../saveSystem';
import { CELL_SIZE } from './placement';

/**
 * The carry state. The entity is held OUT of all zone lists in an App
 * carry state; `originZoneKey` records where it was lifted so a cancel
 * can restore it exactly — to the live list when the player is back in
 * that zone, or into that zone's parked visited snapshot otherwise.
 *
 * SESSION UI, full stop: this state is never persisted. Saves project
 * a COPY of the carried entity into the current zone (see
 * projectCarryForSave); the carry itself dies with any world reload
 * (a future refactor must never promote it into persisted state).
 */
export interface CarryState {
  /** The WHOLE entity snapshot, lifted at beginCarry. */
  entity: StructureEntity;
  /** zoneKey(zx, zz) of the zone the entity was lifted from. */
  originZoneKey: string;
}

/** The container kinds the Move button serves. */
export const MOVABLE_CONTAINER_TYPES: ReadonlySet<StructureType> = new Set([
  'storage_pod',
  'sample_rack',
  'culture_vat',
]);

export function isMovableContainer(type: StructureType): boolean {
  return MOVABLE_CONTAINER_TYPES.has(type);
}

/**
 * Lift: snapshot the whole entity out of the zone list. structuredClone
 * decouples it from the list's live object — nothing the live world
 * does afterwards can reach into the carry.
 */
export function liftCarrySnapshot(entity: StructureEntity): StructureEntity {
  return structuredClone(entity);
}

/**
 * Put-down: stamp placement coords + facing-derived rotation onto a
 * fresh clone of the whole entity. Everything else — id, tier,
 * storage contents, vat gestation, custom fields — rides untouched.
 */
export function stampCarryForPlacement(
  carry: CarryState,
  gridX: number,
  gridZ: number,
  worldX: number,
  worldZ: number,
  rotation: number,
): StructureEntity {
  return {
    ...structuredClone(carry.entity),
    gridX,
    gridZ,
    worldX,
    worldZ,
    rotation,
  };
}

/**
 * Autosave projection (Adam's catch, 2026-10-16 ~21:03): a save NEVER
 * interrupts a carry. When the save record is built mid-carry, this
 * projects the whole carried entity into the SAVED COPY of the current
 * zone at the player's feet — save-time projection only. Every autosave
 * re-projects from live truth, so nothing accumulates; on reload the
 * vault stands where the last save caught the player mid-carry.
 * Gestation, tier, and contents ride the same whole entity — a vat's
 * projected copy is the same creature's count, never reset or paused.
 */
export function projectCarryForSave(
  carry: CarryState,
  playerX: number,
  playerZ: number,
  rotation: number,
): StructureEntity {
  return {
    ...structuredClone(carry.entity),
    gridX: Math.round(playerX / CELL_SIZE),
    gridZ: Math.round(playerZ / CELL_SIZE),
    worldX: playerX,
    worldZ: playerZ,
    rotation,
  };
}

/**
 * Cancel routing (pure): restore to the live list when the player is
 * still in the origin zone; otherwise park the whole entity into the
 * origin zone's visited snapshot so it is there when the player
 * returns.
 */
export function carryRestoreTarget(
  carry: CarryState,
  currentZoneKey: string,
): 'live' | 'parked' {
  return currentZoneKey === carry.originZoneKey ? 'live' : 'parked';
}

/**
 * Park a whole carried entity into a zone snapshot's structure list —
 * the cancel-from-another-zone and death-drop path. Never mutates the
 * incoming snapshot; returns the new one.
 */
export function mergeCarryIntoParked(
  snapshot: WorldSnapshot | undefined,
  carry: CarryState,
): WorldSnapshot {
  const base: WorldSnapshot =
    snapshot ?? { flora: [], fauna: [], structures: [], drops: [] };
  return {
    ...base,
    structures: [...base.structures, structuredClone(carry.entity)],
  };
}

/**
 * The inert-kit gate predicate: while a carry is live, the whole kit
 * is inert — gauntlet tools, weapons, the (future) shield. The only
 * live click is the put-down click; every other tool/creature/structure
 * attempt gets the soft "hands full" response. This total disarmament
 * is the design's answer to portable storage.
 */
export function carryBlocksInteraction(carry: CarryState | null): boolean {
  return carry !== null;
}
