/**
 * BioForge Typed Event Bus
 * Adheres to CODE_MANIFESTO.md Rule 6 (Event-Driven Pub/Sub)
 */

export type GameEventMap = {
  'flora:harvested': { floraId: string; species: string; yieldItemId: string; yieldCount: number; x: number; z: number };
  'flora:planted': { species: string; x: number; z: number };
  'flora:fertilized': { floraId: string; fertilizerType: 'growth' | 'yield' };
  'fauna:tamed': { faunaId: string; species: string; tamedBy: string };
  'structure:placed': { structureId: string; type: string; x: number; z: number };
  'structure:dissolved': { structureId: string; type: string; x: number; z: number };
  'scan:completed': { targetType: string; speciesKey: string; name: string };
  'item:collected': { itemId: string; count: number };
  'weather:cycleChanged': { cycle: number; isDay: boolean };
  'audio:playSfx': { sfxName: string };
};

type EventCallback<T> = (payload: T) => void;

class GameEventBus {
  private listeners: Map<keyof GameEventMap, Set<EventCallback<unknown>>> = new Map();

  public on<K extends keyof GameEventMap>(event: K, callback: EventCallback<GameEventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const set = this.listeners.get(event)!;
    set.add(callback as EventCallback<unknown>);

    // Unsubscribe helper adhering to Rule 7 (Memory Management)
    return () => {
      set.delete(callback as EventCallback<unknown>);
    };
  }

  public emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const set = this.listeners.get(event);
    if (!set || set.size === 0) return;
    set.forEach((cb) => cb(payload));
  }

  public clear(): void {
    this.listeners.clear();
  }
}

export const gameEvents = new GameEventBus();
