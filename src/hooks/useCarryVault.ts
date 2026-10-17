/**
 * useCarryVault — the S6 Movable Vaults carry state (Adam, 2026-10-17).
 * Design record: ReadMeFiles/MOVABLE_VAULTS.md.
 *
 * App owns ONE carry at a time: lifting a container's panel Move button
 * removes the WHOLE entity from the zone lists into a carry state that
 * records its origin zone. While carrying:
 *  - the whole kit is inert (gauntlet tools, weapons — the gate itself
 *    lives at the top of handleGroundClick / the interact handlers in
 *    useToolInteractions, reading carryRef);
 *  - the ghost driver in useGameLoop renders the carried type with
 *    facing-derived rotation (Adam's pin: no R-rotate input exists in
 *    the game, and none is added — you face the direction you want);
 *  - zone travel needs NO change: the entity is out of the live lists,
 *    so the departing zone's parked snapshot simply doesn't contain
 *    it; the ghost stays live after arrival.
 *  - autosave projects a copy into the saved current zone at the
 *    player's feet (useSaveSession, via getCarryRef); the carry state
 *    itself is NEVER persisted and dies with any world reload.
 *
 * Multiplayer: guests carrying a host structure ride the existing
 * structure broadcast — remove on lift, upsert on set-down; the host
 * stays truth on save.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { GameNotification, StructureEntity } from '../types/game';
import type { WorldSnapshot } from '../game/saveSystem';
import type { ZoneCoords } from '../game/world/zones';
import { zoneKey } from '../game/world/zones';
import { CELL_SIZE, occupancyConflict, placementFor } from '../game/structures/placement';
import { multiplayerManager } from '../game/multiplayer';
import { ITEMS } from '../game/items/constants';
import {
  type CarryState,
  carryBlocksInteraction,
  carryRestoreTarget,
  liftCarrySnapshot,
  mergeCarryIntoParked,
  stampCarryForPlacement,
} from '../game/structures/movableVaults';

export interface CarryVaultDeps {
  structuresList: StructureEntity[];
  addStructure: (structure: StructureEntity) => void;
  removeStructure: (structureId: string) => void;
  playerZoneRef: { current: ZoneCoords };
  playerPosRef: { current: { x: number; z: number } };
  visitedZonesRef: { current: Map<string, WorldSnapshot> };
  getPlacementRotation: () => number;
  instanceKind: () => 'surface' | 'cavern' | 'ruin';
  postNotification: (
    title: string,
    message: string,
    type?: GameNotification['type'],
    iconColor?: string,
  ) => void;
  /**
   * Closes the container panels. Passed in because the panels are App
   * state; the hook owns the Move-button flow through handleMoveVault.
   */
  closePanels: () => void;
}

function carryDisplayName(entity: StructureEntity): string {
  return ITEMS[entity.type]?.name ?? 'Vault';
}

export function useCarryVault(deps: CarryVaultDeps) {
  const {
    structuresList,
    addStructure,
    removeStructure,
    playerZoneRef,
    playerPosRef,
    visitedZonesRef,
    getPlacementRotation,
    instanceKind,
    postNotification,
    closePanels,
  } = deps;

  // The live carry (null = not carrying). A ref for the engine/loop
  // listeners and a state for the carry banner — set together, always.
  const carryRef = useRef<CarryState | null>(null);
  const [carrying, setCarrying] = useState<CarryState | null>(null);

  const setCarryBoth = useCallback((carry: CarryState | null) => {
    carryRef.current = carry;
    setCarrying(carry);
  }, []);

  /**
   * LIFT: the container panel's Move button. The whole entity leaves
   * the live list (and the guests' view via broadcast remove) into
   * the carry, origin stamped. The panel closes with it.
   */
  const beginCarry = useCallback(
    (entity: StructureEntity): boolean => {
      if (carryRef.current) {
        postNotification(
          'Already Carrying',
          'Set the carried vault down before lifting another — one haul at a time.',
          'alert',
          '#fbbf24',
        );
        return false;
      }
      const carry: CarryState = {
        entity: liftCarrySnapshot(entity),
        originZoneKey: zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz),
      };
      removeStructure(entity.id);
      multiplayerManager.broadcastEntityRemove('structure', entity.id);
      setCarryBoth(carry);
      postNotification(
        'Vault Lifted',
        `${carryDisplayName(entity)} rides with you — tool-less and defenseless for the haul. Click the ground to set it down; right-click or Esc sets it back where it stood.`,
        'system',
        '#a855f7',
      );
      return true;
    },
    [removeStructure, playerZoneRef, postNotification, setCarryBoth],
  );

  /**
   * PUT-DOWN: the only live click while carrying. Validity is the
   * existing placement math (placementFor + occupancyConflict) — the
   * carried entity is out of the lists, so it can't conflict with
   * itself; a refused spot (red ghost) is refused silently, as
   * placement does today. Rotation is facing-derived (Adam's pin).
   */
  const putDownCarryAt = useCallback(
    (worldX: number, worldZ: number): boolean => {
      const carry = carryRef.current;
      if (!carry) return false;
      if (instanceKind() !== 'surface') {
        // The builder's cavern rule: a vault can only be set down on
        // solid surface ground — never inside a delve or a ruin.
        postNotification(
          'No Footing Here',
          'A vault can only be set down on open surface ground — carry it back out first.',
          'alert',
          '#fbbf24',
        );
        return false;
      }
      const rotation = getPlacementRotation();
      const spot = placementFor(carry.entity.type, worldX, worldZ, rotation);
      const blocked = occupancyConflict(carry.entity.type, spot, structuresList) !== undefined;
      if (blocked) return false;
      const placed = stampCarryForPlacement(carry, spot.gridX, spot.gridZ, spot.worldX, spot.worldZ, rotation);
      addStructure(placed);
      multiplayerManager.broadcastEntityUpsert('structure', placed);
      setCarryBoth(null);
      postNotification(
        'Vault Set Down',
        `${carryDisplayName(placed)} settles — whole, contents and all, exactly as it was lifted.`,
        'craft',
        '#a855f7',
      );
      return true;
    },
    [structuresList, addStructure, getPlacementRotation, instanceKind, postNotification, setCarryBoth],
  );

  /**
   * CANCEL (right-click / Esc / the carry banner's button): the whole
   * entity restores to its EXACT origin — the live list when the player
   * is back in that zone, otherwise written into that zone's parked
   * visited snapshot so it is standing there on return.
   */
  const cancelCarry = useCallback((): void => {
    const carry = carryRef.current;
    if (!carry) return;
    const currentKey = zoneKey(playerZoneRef.current.zx, playerZoneRef.current.zz);
    if (carryRestoreTarget(carry, currentKey) === 'live') {
      addStructure(carry.entity);
    } else {
      visitedZonesRef.current.set(
        carry.originZoneKey,
        mergeCarryIntoParked(visitedZonesRef.current.get(carry.originZoneKey), carry),
      );
    }
    multiplayerManager.broadcastEntityUpsert('structure', carry.entity);
    setCarryBoth(null);
    postNotification(
      'Carry Cancelled',
      'The vault settles back exactly where you lifted it — whole, nothing lost.',
      'system',
      '#94a3b8',
    );
  }, [playerZoneRef, visitedZonesRef, addStructure, postNotification, setCarryBoth]);

  /**
   * DEATH mid-carry: the vault sets down where the player fell — into
   * the LIVE list at the fall position, BEFORE respawnAtSpawn(), so the
   * normal travel parking carries it into the fall zone's snapshot.
   * Recoverable, and it feeds Walk Back (go back for what you dropped).
   * Guests take the same path; the host converges via the broadcast.
   */
  const dropCarryAtFall = useCallback((): boolean => {
    const carry = carryRef.current;
    if (!carry) return false;
    const pos = playerPosRef.current;
    const dropped: StructureEntity = {
      ...liftCarrySnapshot(carry.entity),
      worldX: pos.x,
      worldZ: pos.z,
      gridX: Math.round(pos.x / CELL_SIZE),
      gridZ: Math.round(pos.z / CELL_SIZE),
    };
    addStructure(dropped);
    multiplayerManager.broadcastEntityUpsert('structure', dropped);
    setCarryBoth(null);
    postNotification(
      'The Vault Falls With You',
      'It sets down where you fell — whole. Walk Back for it.',
      'alert',
      '#f87171',
    );
    return true;
  }, [playerPosRef, addStructure, postNotification, setCarryBoth]);

  // Right-click / Esc cancel the carry. The engine preventDefaults the
  // canvas contextmenu, so this document listener is the reliable door;
  // Esc runs alongside the modal-closer (the panel is closed while
  // carrying, so there is nothing for it to fight with). Touch backs
  // out through the carry banner's Cancel button.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && carryBlocksInteraction(carryRef.current)) {
        cancelCarry();
      }
    };
    const onContextMenu = (e: MouseEvent) => {
      if (carryBlocksInteraction(carryRef.current)) {
        e.preventDefault();
        cancelCarry();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('contextmenu', onContextMenu);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('contextmenu', onContextMenu);
    };
  }, [cancelCarry]);

  return {
    carryRef,
    carrying,
    beginCarry,
    putDownCarryAt,
    cancelCarry,
    dropCarryAtFall,
    /** Lazy getter for the save projection (the save timer's idiom). */
    getCarryRef: useCallback(() => carryRef, []),
    /**
     * The container panels' Move button: lift the whole entity, then
     * close the panel with it — the carry takes over from here
     * (ghost, put-down, cancel). Lives in the hook, not App, per the
     * APP RULE: App mounts it, nothing more.
     */
    handleMoveVault: useCallback(
      (structure: StructureEntity): void => {
        if (beginCarry(structure)) closePanels();
      },
      [beginCarry, closePanels],
    ),
  };
}
