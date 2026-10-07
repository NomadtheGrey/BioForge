/**
 * BioForge Player State Domain Hook
 * Manages explorer vitals, coordinates, and equipped tool configurations
 * Enforces CODE_MANIFESTO.md Rules 1 (Guard Clauses), 8 (Modular Separation), 9 (Strict Type Safety)
 */

import { useState, useCallback } from 'react';
import { PlayerState, ToolType, StructureType, ItemId } from '../types/game';

export interface UsePlayerStateResult {
  playerState: PlayerState;
  setActiveTool: (tool: ToolType) => void;
  setSelectedStructureType: (structureType: StructureType) => void;
  setSelectedSeedId: (seedId: ItemId) => void;
  setSelectedFertilizerId: (fertilizerId: ItemId) => void;
  setPlayerTransform: (x: number, z: number, rotation: number) => void;
}

export function usePlayerState(): UsePlayerStateResult {
  const [playerState, setPlayerState] = useState<PlayerState>({
    x: 0,
    z: 0,
    rotation: 0,
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

  const setPlayerTransform = useCallback((x: number, z: number, rotation: number): void => {
    setPlayerState((prev) => ({
      ...prev,
      x,
      z,
      rotation,
    }));
  }, []);

  return {
    playerState,
    setActiveTool,
    setSelectedStructureType,
    setSelectedSeedId,
    setSelectedFertilizerId,
    setPlayerTransform,
  };
}
