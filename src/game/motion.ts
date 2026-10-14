// ============================================================================
// motion.ts — ambient motion & noise toolkit
// ============================================================================
// Small reusable helpers for making the world feel alive and for procedural
// jobs that need randomness with manners. Everything here is SEEDED: give a
// helper the same seed and it repeats the same behavior, which means a given
// creature wiggles the same way on every player's screen and generated
// content can be reproduced from a world seed later.
//
// What lives here:
//   - createSeededRandom   deterministic random stream (mulberry32)
//   - hashStringToSeed     stable seed from an id string (e.g. a fauna id)
//   - createNoise1D / 2D   smooth value noise (+ fbm) for wander, sway, gen
//   - BrownianWiggle       bounded Brownian jitter for idle creature life
//   - PeekCycle            hidden -> peeking -> hidden timing for shy fauna
//
// The wiggle design rule (settled with Adam, 2026-10-13/14): Brownian motion
// must be BOUNDED. A raw Brownian random walk accumulates drift and the
// creature slowly wanders off its own life. Here every channel is a tiny
// spring: random impulses push the offset around, the spring pulls it back
// toward zero, and a hard clamp caps how far it can ever get. "Nothing
// crazy, just enough to make it look alive."
// ============================================================================

// --------------------------------------------------------------------------
// Seeded random
// --------------------------------------------------------------------------

/** Deterministic PRNG (mulberry32). Same seed -> same stream, forever. */
export function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable numeric seed from any string id (FNV-1a). 'fauna_3' seeds its own wiggle. */
export function hashStringToSeed(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

// --------------------------------------------------------------------------
// Smooth value noise
// --------------------------------------------------------------------------
// Classic value noise: random values on an integer lattice, smoothly
// interpolated between them. Unlike raw random, the output glides — perfect
// for wander steering, plant sway, and (later) zone generation, where white
// noise would look like static and smooth noise looks like weather.

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 1D smooth noise. Returns a sampler: x (any real) -> value in [-1, 1]. */
export function createNoise1D(seed: number): (x: number) => number {
  const random = createSeededRandom(seed);
  // Pre-generate a lattice of random values; wrap at 256 for a tiling field.
  const lattice: number[] = [];
  for (let i = 0; i < 256; i++) lattice.push(random() * 2 - 1);
  const at = (i: number) => lattice[((i % 256) + 256) % 256];
  return (x: number) => {
    const xi = Math.floor(x);
    const frac = x - xi;
    const a = at(xi);
    const b = at(xi + 1);
    return a + (b - a) * smoothstep(frac);
  };
}

/** Fractal 1D noise: a few octaves of createNoise1D summed for richer motion. */
export function createNoise1DFbm(seed: number, octaves = 3): (x: number) => number {
  const layers = Array.from({ length: octaves }, (_, i) => createNoise1D(seed + i * 1013));
  return (x: number) => {
    let sum = 0;
    let weight = 0;
    let amp = 1;
    let freq = 1;
    for (const layer of layers) {
      sum += layer(x * freq) * amp;
      weight += amp;
      amp *= 0.5;
      freq *= 2;
    }
    return sum / weight;
  };
}

/** 2D smooth noise. Returns a sampler: (x, y) -> value in [-1, 1]. For maps/generation. */
export function createNoise2D(seed: number): (x: number, y: number) => number {
  const random = createSeededRandom(seed);
  const lattice: number[] = [];
  for (let i = 0; i < 256 * 256; i++) lattice.push(random() * 2 - 1);
  const at = (ix: number, iy: number) =>
    lattice[(((iy & 255) << 8) | (ix & 255))];
  return (x: number, y: number) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const fx = smoothstep(x - xi);
    const fy = smoothstep(y - yi);
    const top = at(xi, yi) + (at(xi + 1, yi) - at(xi, yi)) * fx;
    const bottom = at(xi, yi + 1) + (at(xi + 1, yi + 1) - at(xi, yi + 1)) * fx;
    return top + (bottom - top) * fy;
  };
}

// --------------------------------------------------------------------------
// BrownianWiggle — bounded Brownian jitter
// --------------------------------------------------------------------------
// Three independent spring channels (x, z, and a gentle rock/tilt). Each
// frame the channel takes a small random impulse, integrates it, and the
// spring + damping bleed the energy back out toward rest. The offset can
// never exceed its clamp, so a creature shivers in place forever without
// ever drifting away from where the simulation says it is.
//
// This is a RENDER-side toy: it nudges how a mesh is drawn, never the
// entity's simulated position, so it needs no network sync and cannot
// affect gameplay, pathing, or saves.

export interface WiggleSample {
  x: number;
  z: number;
  rock: number;
}

export interface WiggleOptions {
  /** Max horizontal offset in meters per axis. Default 0.05 (5 cm). */
  maxOffset?: number;
  /** Max tilt in radians. Default 0.05 (~3 degrees). */
  maxRock?: number;
  /** How hard random impulses shove. 1.4 keeps typical drift ~2 cm with
   *  only rare touches of the clamp — alive, not restless. */
  impulse?: number;
  /** Spring pull back toward rest. Default 6. */
  spring?: number;
  /** Velocity damping per second. Default 3. */
  damping?: number;
}

interface WiggleChannel {
  offset: number;
  velocity: number;
}

export class BrownianWiggle {
  private readonly random: () => number;
  private readonly maxOffset: number;
  private readonly maxRock: number;
  private readonly impulse: number;
  private readonly spring: number;
  private readonly damping: number;
  private readonly channelX: WiggleChannel = { offset: 0, velocity: 0 };
  private readonly channelZ: WiggleChannel = { offset: 0, velocity: 0 };
  private readonly channelRock: WiggleChannel = { offset: 0, velocity: 0 };

  constructor(seed: number, options: WiggleOptions = {}) {
    this.random = createSeededRandom(seed);
    this.maxOffset = options.maxOffset ?? 0.05;
    this.maxRock = options.maxRock ?? 0.05;
    this.impulse = options.impulse ?? 1.4;
    this.spring = options.spring ?? 6;
    this.damping = options.damping ?? 3;
  }

  private stepChannel(channel: WiggleChannel, dt: number, max: number, shoveScale = 1): void {
    // Random Brownian impulse, in [-impulse, +impulse], scaled per channel.
    const shove = (this.random() * 2 - 1) * this.impulse * shoveScale;
    // Spring force pulls the offset back toward zero — this is what makes
    // the motion bounded instead of a random walk to the next county.
    const force = shove - this.spring * channel.offset;
    channel.velocity += force * dt;
    channel.velocity *= Math.exp(-this.damping * dt);
    channel.offset += channel.velocity * dt;
    // Hard clamp as a final guarantee, whatever the tuning.
    if (channel.offset > max) channel.offset = max;
    if (channel.offset < -max) channel.offset = -max;
  }

  /** Advance the wiggle by dt seconds and return the current offsets. */
  update(dt: number): WiggleSample {
    // Guard against tab-switch hitches: a huge dt would teleport the spring.
    const step = Math.min(Math.max(dt, 0), 0.05);
    if (step > 0) {
      this.stepChannel(this.channelX, step, this.maxOffset);
      this.stepChannel(this.channelZ, step, this.maxOffset);
      // The rock channel gets a gentler shove so creatures sway, not wobble.
      this.stepChannel(this.channelRock, step, this.maxRock, 0.6);
    }
    return {
      x: this.channelX.offset,
      z: this.channelZ.offset,
      rock: this.channelRock.offset,
    };
  }
}

// --------------------------------------------------------------------------
// PeekCycle — hidden -> peeking -> hidden
// --------------------------------------------------------------------------
// Timing helper for shy creatures (first customer: the burrow mouse). The
// creature stays hidden for a randomized stretch, then peeks — an eased
// amount rises 0 -> 1, holds briefly, and settles back. Whatever renders
// the creature reads `amount` to decide how much of it shows (head height,
// burrow lid, and so on). Utility only for now; behavior wiring comes with
// the burrow pass.

export type PeekPhase = 'hidden' | 'peeking';

export interface PeekState {
  phase: PeekPhase;
  /** 0 = fully hidden, 1 = fully peeked. Eased, never snaps. */
  amount: number;
}

export interface PeekOptions {
  /** Hidden stretch range in seconds. Default 3–8. */
  minHiddenSeconds?: number;
  maxHiddenSeconds?: number;
  /** Total peek duration in seconds (rise + hold + settle). Default 1.6. */
  peekSeconds?: number;
}

export class PeekCycle {
  private readonly random: () => number;
  private readonly minHidden: number;
  private readonly maxHidden: number;
  private readonly peekSeconds: number;
  private phase: PeekPhase = 'hidden';
  private timeInPhase = 0;
  private phaseDuration: number;

  constructor(seed: number, options: PeekOptions = {}) {
    this.random = createSeededRandom(seed);
    this.minHidden = options.minHiddenSeconds ?? 3;
    this.maxHidden = options.maxHiddenSeconds ?? 8;
    this.peekSeconds = options.peekSeconds ?? 1.6;
    this.phaseDuration = this.rollHiddenDuration();
  }

  private rollHiddenDuration(): number {
    return this.minHidden + this.random() * (this.maxHidden - this.minHidden);
  }

  /** Advance the cycle by dt seconds and return the current peek state. */
  update(dt: number): PeekState {
    this.timeInPhase += dt;
    if (this.timeInPhase >= this.phaseDuration) {
      this.timeInPhase = 0;
      if (this.phase === 'hidden') {
        this.phase = 'peeking';
        this.phaseDuration = this.peekSeconds;
      } else {
        this.phase = 'hidden';
        this.phaseDuration = this.rollHiddenDuration();
      }
    }
    if (this.phase === 'hidden') return { phase: 'hidden', amount: 0 };
    // Peek shape: ease up in the first third, hold, ease down in the last.
    const t = this.timeInPhase / this.phaseDuration;
    if (t < 1 / 3) return { phase: 'peeking', amount: smoothstep(t * 3) };
    if (t > 2 / 3) return { phase: 'peeking', amount: 1 - smoothstep((t - 2 / 3) * 3) };
    return { phase: 'peeking', amount: 1 };
  }
}
