// ============================================================================
// lifePulse.ts — shared "alive" animation math for grown structures
// ============================================================================
// The game's structures are GROWN, not built, and several of them carry
// life passes in threeEngine (the BioTunnel mouth's paired stir, the
// culture vat's gestation breath). This module is the small shared math
// behind those passes so threeEngine stays lean: a deterministic id seed,
// a heartbeat pulse, and a per-id phase. No THREE imports — pure math.
// ============================================================================

/** FNV-1a 32-bit hash of a string: deterministic, cheap, good spread. */
export function hashId(id: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** A per-entity phase in [0, 1): two mouths of a pair never throb in sync. */
export function phaseForId(id: string): number {
  return hashId(id) / 0xffffffff;
}

/** Seeded PRNG (the game's own mulberry32) for deterministic per-build variation. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A heartbeat in [0, 1]: a quick double-thump, then rest, cycling every
 * periodSec. The two thumps make it read as a heart rather than a metronome —
 * that is the whole of the grotesque's pulse. phaseFrac offsets the cycle so
 * paired mouths throb a half-beat apart.
 */
export function pulseHeartbeat(tSec: number, periodSec: number, phaseFrac: number): number {
  // One cycle per period; wrap the thump gaussians across the 0/1 seam so
  // the second thump doesn't clip when the phase pushes it over the edge.
  const local = (((tSec / periodSec + phaseFrac) % 1) + 1) % 1;
  const thump = (center: number): number => {
    const d = Math.min(Math.abs(local - center), 1 - Math.abs(local - center));
    return Math.exp(-((d / 0.075) * (d / 0.075)));
  };
  return Math.min(1, thump(0) + 0.75 * thump(0.22));
}
