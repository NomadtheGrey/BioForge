/**
 * useDebugKit — the backquote (`) debug-kit swap (Adam, 2026-10-15:
 * a for-now development tool while the starter throttle settles).
 *
 * The key swaps the pouch for the full DEBUG_KIT and back. The
 * real pouch waits in debugStashRef, and App's saveNow writes the
 * STASH while a swap is active — a debug session can never pollute
 * a save with free goods. Creating or loading a world clears the
 * swap (App sets debugStashRef.current = null there).
 *
 * (Extracted from App.tsx under the push-size ceiling, like
 * useQuests and useStorage before it.)
 */

import { useCallback, useRef, type RefObject } from 'react';
import type { GameNotification, ItemId } from '../types/game';
import { DEBUG_KIT } from '../game/items/constants';

interface UseDebugKitParams {
  getInventory: () => Record<ItemId, number>;
  restoreInventory: (saved: Record<ItemId, number>) => void;
  postNotification: (title: string, message: string, type: GameNotification['type'], iconColor: string) => void;
}

export interface UseDebugKitResult {
  /** The real pouch while a swap is active; null when not swapped. */
  debugStashRef: RefObject<Record<ItemId, number> | null>;
  toggleDebugKit: () => void;
}

export function useDebugKit({ getInventory, restoreInventory, postNotification }: UseDebugKitParams): UseDebugKitResult {
  const debugStashRef = useRef<Record<ItemId, number> | null>(null);

  const toggleDebugKit = useCallback((): void => {
    if (debugStashRef.current === null) {
      debugStashRef.current = { ...getInventory() };
      restoreInventory({ ...DEBUG_KIT });
      postNotification(
        'Debug Kit ON',
        'Pouch swapped to the full debug kit — press ` again to swap back. Saves keep your real pouch.',
        'system',
        '#f59e0b',
      );
    } else {
      restoreInventory(debugStashRef.current);
      debugStashRef.current = null;
      postNotification('Debug Kit OFF', 'Your real pouch is back.', 'system', '#34d399');
    }
  }, [getInventory, restoreInventory, postNotification]);

  return { debugStashRef, toggleDebugKit };
}
