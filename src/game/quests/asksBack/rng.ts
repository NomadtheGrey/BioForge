// =====================================================================
// THE WORLD ASKS BACK — deterministic randomness (S2, ported from the
// lab's rng.mts, 2026-10-16)
// =====================================================================
//
// The generator's dice box. It reuses BioForge's OWN seeded RNG
// (game/motion: mulberry32 via createSeededRandom, FNV-1a via
// hashStringToSeed), so the determinism story is the game's story:
// the same (worldSeed, zone, day, profile, salt) inputs produce the
// same saga, forever, with no stored saga needed for offers.
//
// Port notes vs the lab: none, beyond the import path. The
// DYNQ_NO_UBIQUITOUS lever is dropped — the lab measured it as a
// honest negative (no significant repetition effect).

import { hashStringToSeed, createSeededRandom } from '../../engine/motion';

export { hashStringToSeed };

/** A small seeded dice box: pick / int / chance / shuffled / weighted. */
export class Dice {
  private next: () => number;
  constructor(seed: number) {
    this.next = createSeededRandom(seed);
  }
  /** [0, 1) */
  f(): number {
    return this.next();
  }
  /** inclusive integer in [min, max] */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
  /** Fisher–Yates, seeded. Returns a new array. */
  shuffled<T>(arr: readonly T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    let total = 0;
    for (const [, w] of entries) total += w;
    let r = this.next() * total;
    for (const [v, w] of entries) {
      r -= w;
      if (r <= 0) return v;
    }
    return entries[entries.length - 1][0];
  }
}

/** One canonical seed per quest-generation input tuple. */
export function questSeed(
  worldSeed: string,
  zx: number,
  zz: number,
  day: number,
  profileTag: string,
  salt: string,
): number {
  return hashStringToSeed(
    `dynq|${worldSeed}|${zx}|${zz}|${day}|${profileTag}|${salt}`,
  );
}

/** Short stable hex id for a generated saga. */
export function questId(
  worldSeed: string,
  zx: number,
  zz: number,
  day: number,
  profileTag: string,
  arc: string,
): string {
  const h = hashStringToSeed(
    `dynq-id|${worldSeed}|${zx}|${zz}|${day}|${profileTag}|${arc}`,
  );
  return `q_dyn_${h.toString(16).padStart(8, '0')}`;
}
