/**
 * useShieldWield — the shield family's state and input (Adam, 2026-10-17).
 *
 * Owns everything the Left Hand's ward needs that isn't pure rules:
 * the raised state (right-mouse hold on desktop; the touch hold
 * button drives setShieldRaised, placed by the HUD lane), the
 * guard-break window, the spore-burst cooldown, the graft record,
 * and the per-tick combat input the fauna sim reads at the bite
 * site. The rules themselves live in game/creatures/shields.ts —
 * this hook is state + input + the save, nothing more.
 *
 * APP RULE: App composes this hook and wires it; shield logic does
 * not grow in App.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ItemId } from '../types/game';
import type { ShieldGraftId, ShieldGrowthMap } from '../game/creatures/shields';
import type { CarryState } from '../game/structures/movableVaults';
import { carryBlocksInteraction } from '../game/structures/movableVaults';
import {
  SHIELD_GUARD_BREAK_SECONDS,
  SHIELD_GRAFTS,
  SPORE_COOLDOWN_SECONDS,
  graftOf,
  isDisplacementImmune,
  shieldOf,
  type ShieldCombatInput,
  type ShieldCombatSnapshot,
} from '../game/creatures/shields';

export interface ShieldWieldDeps {
  heldItemId: ItemId | null | undefined;
  /** The shields' own growth record (Adam's relocation,
   *  2026-10-17) — the graft lives with the shield. */
  shieldGrowth: ShieldGrowthMap;
  setShieldGrowth: (growth: ShieldGrowthMap) => void;
  /** S6: while a carry is live the whole kit is inert — the shield
   *  cannot be raised. carryBlocksInteraction is the predicate. */
  carryRef: { current: CarryState | null };
  postNotification: (title: string, message: string, type?: 'harvest' | 'discover' | 'tame' | 'craft' | 'alert' | 'system', iconColor?: string) => void;
}

export interface ShieldWieldApi {
  /** True while the block input is held and the shield is up. */
  raised: boolean;
  raisedRef: { current: boolean };
  /** Input wiring: right-mouse hold (desktop) and the touch hold
   *  button (HUD lane) drive the raise through here. */
  setShieldRaised: (v: boolean) => void;
  /** Rooted Stance: displacement immunity while a Fenback is braced. */
  displacementImmune: () => boolean;
  /** True while a Fenback is braced — drives the ward-arc mesh. */
  wardArcActive: () => boolean;
  /** The graft record, for HUD surfaces. */
  isGrafted: (itemId: ItemId) => boolean;
  /** Stamp a graft (the graft recipes call this through App). */
  graftShield: (itemId: ItemId, kind?: ShieldGraftId) => void;
  /** The per-tick combat input for the fauna sim (bite site only). */
  buildCombatInput: (getPlayerFacing: () => number, payStamina: (n: number) => boolean) => ShieldCombatInput | undefined;
  /** Called by the game loop when the braced drain empties stamina. */
  onStaminaEmpty: () => void;
  /** The hook's own clock — advanced by the game loop each frame. */
  tickClock: (dt: number) => void;
}

export function useShieldWield(deps: ShieldWieldDeps): ShieldWieldApi {
  const { heldItemId, shieldGrowth, setShieldGrowth, carryRef, postNotification } = deps;

  const heldShield = shieldOf(heldItemId ?? null) ?? null;

  const [raised, setRaisedState] = useState(false);
  const raisedRef = useRef(false);
  const clockRef = useRef(0);
  const guardBrokenUntilRef = useRef(0);
  const sporeReadyAtRef = useRef(0);

  // Mirror the latest deps into refs for the stable closures below.
  const heldShieldRef = useRef(heldShield);
  heldShieldRef.current = heldShield;
  const growthRef = useRef(shieldGrowth);
  growthRef.current = shieldGrowth;

  const setRaisedBoth = useCallback((v: boolean) => {
    raisedRef.current = v;
    setRaisedState(v);
  }, []);

  /** The raise, refused unless a shield is held, the kit is live,
   *  and the guard is up. Lowering is always allowed. */
  const setShieldRaised = useCallback(
    (v: boolean) => {
      if (!v) {
        if (raisedRef.current) setRaisedBoth(false);
        return;
      }
      if (!heldShieldRef.current) return;
      if (carryBlocksInteraction(carryRef.current)) return; // S6: hands full
      if (clockRef.current < guardBrokenUntilRef.current) return;
      if (!raisedRef.current) setRaisedBoth(true);
    },
    [carryRef, setRaisedBoth]
  );

  // The hand changing away from a shield lowers it — a raised
  // lantern is nonsense, and a stowed shield is not a wall.
  useEffect(() => {
    if (!heldShieldRef.current && raisedRef.current) setRaisedBoth(false);
  }, [heldItemId, setRaisedBoth]);

  // Right-mouse hold raises the shield (desktop). The S6 carry
  // cancels on contextmenu while carrying — the raise refuses
  // while a carry is live, so the two never fight.
  useEffect(() => {
    const down = (e: MouseEvent) => {
      if (e.button !== 2) return;
      setShieldRaised(true);
    };
    const up = (e: MouseEvent) => {
      if (e.button === 2) setShieldRaised(false);
    };
    const blur = () => setShieldRaised(false);
    window.addEventListener('mousedown', down);
    window.addEventListener('mouseup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('mousedown', down);
      window.removeEventListener('mouseup', up);
      window.removeEventListener('blur', blur);
    };
  }, [setShieldRaised]);

  const isGrafted = useCallback(
    (itemId: ItemId): boolean => graftOf(growthRef.current, itemId) !== null,
    []
  );

  /** Stamp a graft into a shield's slot (Platforms Parallel,
   *  2026-10-17): the kind is the stamp — 'spikes' is the only
   *  kind today, and the slot refuses a second graft while one
   *  stands (one graft per shield). */
  const graftShield = useCallback(
    (itemId: ItemId, kind: ShieldGraftId = 'spikes') => {
      if (graftOf(growthRef.current, itemId)) return;
      const next: ShieldGrowthMap = { ...growthRef.current, [itemId]: { graft: kind } };
      setShieldGrowth(next);
      const def = SHIELD_GRAFTS[kind];
      postNotification(
        `${def.name} Grafted`,
        `${def.name} take hold across the shield's face — strikes that land on it will answer.`,
        'craft',
        '#65a30d'
      );
    },
    [setShieldGrowth, postNotification]
  );

  const displacementImmune = useCallback((): boolean => {
    return isDisplacementImmune(heldShieldRef.current, raisedRef.current);
  }, []);

  const wardArcActive = useCallback((): boolean => {
    const s = heldShieldRef.current;
    return !!s && s.tier === 3 && raisedRef.current;
  }, []);

  /** Guard break: the shield drops and a brief vulnerable beat
   *  runs before it can rise again. */
  const breakGuard = useCallback(() => {
    setRaisedBoth(false);
    guardBrokenUntilRef.current = clockRef.current + SHIELD_GUARD_BREAK_SECONDS;
    postNotification(
      'Guard Broken',
      'The blows beat your guard down — the shield drops for a breath. Back off or brace for it.',
      'alert',
      '#f59e0b'
    );
  }, [postNotification, setRaisedBoth]);

  const onStaminaEmpty = useCallback(() => {
    if (raisedRef.current) breakGuard();
  }, [breakGuard]);

  /**
   * The per-tick combat input for the fauna sim. Undefined when the
   * Left Hand holds no shield — the sim then skips shield work
   * entirely (the common case costs one null check).
   */
  const buildCombatInput = useCallback(
    (getPlayerFacing: () => number, payStamina: (n: number) => boolean): ShieldCombatInput | undefined => {
      const shield = heldShieldRef.current;
      if (!shield) return undefined;
      return {
        snapshot: (): ShieldCombatSnapshot => ({
          shield,
          raised: raisedRef.current,
          graft: graftOf(growthRef.current, shield.itemId),
          carrying: carryBlocksInteraction(carryRef.current),
          guardBroken: clockRef.current < guardBrokenUntilRef.current,
          playerFacing: getPlayerFacing(),
          now: clockRef.current,
          sporeReady: clockRef.current >= sporeReadyAtRef.current,
        }),
        payStamina,
        onSporeBurst: () => {
          sporeReadyAtRef.current = clockRef.current + SPORE_COOLDOWN_SECONDS;
        },
        onGuardBreak: () => breakGuard(),
        triggerSporeFx: (_x: number, _z: number) => {
          // Presentation is engine-side; the game loop passes the
          // real trigger through this same input object when it
          // builds it per tick (see App's wiring). This default is
          // a no-op so the sim never depends on the engine.
        },
      };
    },
    [breakGuard, carryRef]
  );

  /** The hook's own clock — advanced by the game loop each frame.
   *  Guard-break windows and spore cooldowns run on it. */
  const tickClock = useCallback((dt: number) => {
    clockRef.current += dt;
  }, []);

  return {
    raised,
    raisedRef,
    setShieldRaised,
    displacementImmune,
    wardArcActive,
    isGrafted,
    graftShield,
    buildCombatInput,
    onStaminaEmpty,
    tickClock,
  };
}
