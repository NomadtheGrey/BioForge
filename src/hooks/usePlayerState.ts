/**
 * BioForge Player State Domain Hook
 * Manages explorer vitals, coordinates, and equipped tool configurations
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback } from 'react';
import { PlayerState, ToolType, StructureType, ItemId, QuestProgressState } from '../types/game';
import type { ShieldGrowthMap } from '../game/creatures/shields';

export interface UsePlayerStateResult {
  playerState: PlayerState;
  setActiveTool: (tool: ToolType) => void;
  setSelectedStructureType: (structureType: StructureType) => void;
  setSelectedSeedId: (seedId: ItemId) => void;
  setSelectedFertilizerId: (fertilizerId: ItemId) => void;
  setHeldItemId: (itemId: ItemId | null) => void;
  setQuestProgress: (progress: QuestProgressState) => void;
  setShieldGrowth: (growth: ShieldGrowthMap) => void;
  /** The shields' OWN growth record (Adam's relocation,
   *  2026-10-17) — held beside PlayerState, never inside it;
   *  it persists under the save record's shieldGrowth key. */
  shieldGrowth: ShieldGrowthMap;
  setPlayerTransform: (x: number, z: number, rotation: number) => void;
  setPlayerLevel: (level: number) => void;
  setStamina: (stamina: number) => void;
  setHealth: (health: number) => void;
  restorePlayerState: (saved: PlayerState) => void;
}

export function usePlayerState(): UsePlayerStateResult {
  const [playerState, setPlayerState] = useState<PlayerState>({
    x: 0,
    z: 0,
    rotation: 0,
    level: 0,
    health: 100,
    maxHealth: 100,
    stamina: 100,
    maxStamina: 100,
    energy: 100,
    maxEnergy: 100,
    activeTool: 'harvest_glove',
    selectedStructureType: 'root_tile_floor',
    selectedSeedId: 'seed_lantern_fern',
    selectedFertilizerId: 'growth_fertilizer',
    heldItemId: null,
  });

  const setActiveTool = useCallback((tool: ToolType): void => {
    setPlayerState((prev) => (prev.activeTool === tool ? prev : { ...prev, activeTool: tool }));
  }, []);

  const setSelectedStructureType = useCallback((structureType: StructureType): void => {
    setPlayerState((prev) => ({ ...prev, selectedStructureType: structureType }));
  }, []);

  const setSelectedSeedId = useCallback((seedId: ItemId): void => {
    setPlayerState((prev) => ({ ...prev, selectedSeedId: seedId }));
  }, []);

  const setSelectedFertilizerId = useCallback((fertilizerId: ItemId): void => {
    setPlayerState((prev) => ({ ...prev, selectedFertilizerId: fertilizerId }));
  }, []);

  const setHeldItemId = useCallback((itemId: ItemId | null): void => {
    setPlayerState((prev) => ({ ...prev, heldItemId: itemId }));
  }, []);

  // Mini-quest progress rides PlayerState (and therefore the save)
  // like heldItemId does — one functional write, no field-by-field
  // poking from App.
  const setQuestProgress = useCallback((progress: QuestProgressState): void => {
    setPlayerState((prev) => ({ ...prev, questProgress: progress }));
  }, []);

  // The shields' growth record (Adam, 2026-10-17): its own
  // state beside PlayerState — a graft is a property of the
  // shield, not of the player. useSaveSession persists it
  // under the save record's shieldGrowth key and folds any
  // legacy PlayerState.shieldGrafts into it at load.
  const [shieldGrowth, setShieldGrowthState] = useState<ShieldGrowthMap>({});
  const setShieldGrowth = useCallback((growth: ShieldGrowthMap): void => {
    setShieldGrowthState(growth);
  }, []);

  const setPlayerTransform = useCallback((x: number, z: number, rotation: number): void => {
    setPlayerState((prev) => ({
      ...prev,
      x,
      z,
      rotation,
    }));
  }, []);

  const setPlayerLevel = useCallback((level: number): void => {
    setPlayerState((prev) => (prev.level === level ? prev : { ...prev, level }));
  }, []);

  const setHealth = useCallback((health: number): void => {
    setPlayerState((prev) => {
      const clamped = Math.max(0, Math.min(prev.maxHealth, health));
      return prev.health === clamped ? prev : { ...prev, health: clamped };
    });
  }, []);

  const setStamina = useCallback((stamina: number): void => {
    setPlayerState((prev) => {
      const clamped = Math.max(0, Math.min(prev.maxStamina, stamina));
      return prev.stamina === clamped ? prev : { ...prev, stamina: clamped };
    });
  }, []);

    // Restores a complete saved player state (position, vitals, tool picks)
  // in one shot, instead of poking each field through its own setter.
  const restorePlayerState = useCallback((saved: PlayerState): void => {
    // Saves from before story levels have no level field — ground story.
    // The grafts moved to the shields' own growth records (Adam,
    // 2026-10-17): a legacy save's playerState still carries them
    // inline — useSaveSession folds them into shieldGrowth at
    // load, and they are stripped here so they never live in
    // PlayerState (or re-save inside it) again.
    const { shieldGrafts: _legacyGrafts, ...rest } = saved as PlayerState & { shieldGrafts?: unknown };
    setPlayerState({ ...rest, level: saved.level ?? 0 });
  }, []);

  return {
    playerState,
    setActiveTool,
    setSelectedStructureType,
    setSelectedSeedId,
    setSelectedFertilizerId,
    setHeldItemId,
    setQuestProgress,
    setShieldGrowth,
    shieldGrowth,
    setPlayerTransform,
    setPlayerLevel,
    setStamina,
    setHealth,
    restorePlayerState,
  };
}
