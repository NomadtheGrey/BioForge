/**
 * usePlaytestKit — the Playtest Kit's callbacks (Adam,
 * 2026-10-17), extracted from App.tsx on the dev lane's
 * boundary note: a worked seam leaves App as its own hook
 * (the S6 shape; useDebugKit next door is the model).
 *
 * Every callback reaches a REAL seam: items through
 * addInventoryItem, spawns through the sim's own fauna path
 * (a debug spawn is stamped exactly like a natural deal —
 * bonus-route id shape, wildPressureFor stamps, home
 * variant), time through the world clock, the shower
 * through the sky calendar's own event path. Nothing
 * debug-flagged enters the save.
 */

import { useCallback, type RefObject } from 'react';
import type { FaunaEntity, FaunaSpecies, GameNotification, ItemId } from '../types/game';
import { ITEMS } from '../game/items/constants';
import { speciesDef } from '../game/creatures/species';
import { zoneBiomeAt, zoneHops, zoneInfo, type ZoneCoords } from '../game/world/zones';
import { biomeTier } from '../game/world/biomes';
import { wildPressureFor, WILD_APEX_IDS } from '../game/world/worldGen';
import { callShowerTonight } from '../game/world/skyCalendar';

interface UsePlaytestKitParams {
  addInventoryItem: (itemId: ItemId, count: number) => number;
  upsertFauna: (fauna: FaunaEntity) => void;
  postNotification: (title: string, message: string, type: GameNotification['type'], iconColor: string) => void;
  playerPosRef: RefObject<{ x: number; z: number; rotation: number }>;
  worldSeedRef: RefObject<string>;
  playerZone: ZoneCoords;
  setDayNightCycle: (phase: number) => void;
  setHealth: (health: number) => void;
  setStamina: (stamina: number) => void;
  maxHealth: number;
  maxStamina: number;
}

export interface UsePlaytestKitResult {
  handlePlaytestGive: (itemId: ItemId, count: number) => void;
  handlePlaytestSpawn: (species: FaunaSpecies) => void;
  handlePlaytestPhase: (phase: number) => void;
  handlePlaytestShower: () => void;
  handlePlaytestHeal: () => void;
}

export function usePlaytestKit({
  addInventoryItem,
  upsertFauna,
  postNotification,
  playerPosRef,
  worldSeedRef,
  playerZone,
  setDayNightCycle,
  setHealth,
  setStamina,
  maxHealth,
  maxStamina,
}: UsePlaytestKitParams): UsePlaytestKitResult {
  const handlePlaytestGive = useCallback((itemId: ItemId, count: number): void => {
    const fitted = addInventoryItem(itemId, count);
    postNotification(
      'Playtest — Given',
      `${fitted}× ${ITEMS[itemId]?.name ?? itemId} found your pouch.`,
      'craft',
      '#f59e0b',
    );
  }, [addInventoryItem, postNotification]);

  const handlePlaytestSpawn = useCallback((species: FaunaSpecies): void => {
    const def = speciesDef(species);
    if (!def) return;
    // Five meters ahead of the player, exactly where a
    // walking test would want it: playerPosRef's rotation
    // is the camera-derived yaw (atan2 of the facing
    // vector), so the forward unit vector is (sin, cos).
    const p = playerPosRef.current;
    const x = p.x + Math.sin(p.rotation) * 5;
    const z = p.z + Math.cos(p.rotation) * 5;
    const biome = zoneBiomeAt(worldSeedRef.current, playerZone.zx, playerZone.zz);
    const bonus = def.bonusSpawn;
    // The distance gradient's stamp (slice 50/51): mirrors
    // worldGen's deal predicate exactly — only unprovoked
    // hunters, only where the country actually presses,
    // never the apexes themselves.
    const pressure = wildPressureFor(biomeTier(biome), zoneHops(playerZone.zx, playerZone.zz));
    const huntsUnprovoked = !!def.hunt && !def.hunt.provokedOnly && !WILD_APEX_IDS.includes(def.id);
    const zone = zoneInfo(worldSeedRef.current, playerZone.zx, playerZone.zz);
    const fauna: FaunaEntity = {
      id: `fauna_bonus_${def.id}_${Math.random().toString(36).substring(2, 9)}`,
      species: def.id,
      x,
      z,
      y: 0,
      rotation: Math.random() * Math.PI * 2,
      state: 'wandering',
      isTamed: false,
      targetX: x,
      targetZ: z,
      biome,
      speed: bonus ? bonus.speed + (Math.random() * 2 - 1) * bonus.speedJitter : 1.4,
      health: bonus?.health ?? 60,
      maxHealth: bonus?.health ?? 60,
      byproductTimer: 0,
      animTime: 0,
      ...(zone.variant ? { homeVariant: zone.variant.id } : {}),
      ...(huntsUnprovoked && (pressure.dmg > 1 || pressure.aggro > 1)
        ? { wildDmg: pressure.dmg, wildAggro: pressure.aggro }
        : {}),
    };
    upsertFauna(fauna);
    postNotification(
      'Playtest — Spawned',
      `${def.name} materializes 5 m ahead of you, wild as any natural deal.`,
      'system',
      '#f59e0b',
    );
  }, [playerPosRef, worldSeedRef, playerZone, upsertFauna, postNotification]);

  const handlePlaytestPhase = useCallback((phase: number): void => {
    setDayNightCycle(phase);
  }, [setDayNightCycle]);

  const handlePlaytestShower = useCallback((): void => {
    const ok = callShowerTonight(Date.now());
    postNotification(
      ok ? 'Playtest — Shower Called' : 'Playtest — No Sky Yet',
      ok
        ? 'This block’s own seeded shower shows tonight — its radiant, its intensity, tonight’s dealing of it.'
        : 'Load a world first: the sky clock stands only once a world is open.',
      'system',
      '#818cf8',
    );
  }, [postNotification]);

  const handlePlaytestHeal = useCallback((): void => {
    setHealth(maxHealth);
    setStamina(maxStamina);
    postNotification('Playtest — Restored', 'Health and stamina full, through the normal writers.', 'system', '#f43f5e');
  }, [maxHealth, maxStamina, setHealth, setStamina, postNotification]);

  return { handlePlaytestGive, handlePlaytestSpawn, handlePlaytestPhase, handlePlaytestShower, handlePlaytestHeal };
}
