/**
 * synthCore.ts — the ONE WebAudio synth core (Adam's pin,
 * 2026-10-17: synth-only, no audio files, ever — any exception
 * would be a later NAMED pin, not a drift).
 *
 * Everything the game sings goes through here: the generative
 * music (musicDirector.ts), the creature voices
 * (creatureVoices.ts), and one day the plants. This module owns
 * the AudioContext, the channel graph, and the six named
 * voices; it knows nothing about biomes, species, or occasions.
 *
 * The graph is honest in the way the tunes map demands:
 *
 *   voices → music sub-bus ─┐
 *            (director's)   ├→ channel gains → master → out
 *   voices → creatures ─────┘        (the SOUND shelf)
 *
 * Channel gains read the SOUND shelf (useAudioSettings):
 * switches and sliders the player set in Options, folded
 * through Master exactly as the shelf promises. The shelf is
 * the ONLY volume authority; nothing in the audio program
 * keeps a second opinion. The quiet end stays honest too —
 * gains multiply, they never floor: a slider at zero, or a
 * family written sparse, can produce true silence.
 */

import {
  loadAudioSettings,
  type AudioChannelId,
  type AudioSettingsState,
} from '../../hooks/useAudioSettings';

// ---------------------------------------------------------------------------
// Context lifecycle
// ---------------------------------------------------------------------------

let ctx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let musicBus: GainNode | null = null; // the director's own fader (scar, zone dips)
const channelGains = new Map<AudioChannelId, GainNode>();
let noiseBuffer: AudioBuffer | null = null;

/** Create the context on first use (must be called from, or
 *  after, a user gesture — browsers refuse a running context
 *  before one). Returns null where WebAudio does not exist,
 *  and every caller treats null as "the world is silent today"
 *  rather than an error. */
export function ensureCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    const AC: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    masterGain = ctx.createGain();
    masterGain.connect(ctx.destination);

    // One gain per shelf channel, all folded through Master.
    const channels: AudioChannelId[] = ['music', 'creatures', 'plants', 'interface'];
    for (const id of channels) {
      const g = ctx.createGain();
      g.connect(masterGain);
      channelGains.set(id, g);
    }
    // The director's private fader sits UNDER the music channel:
    // the shelf decides how loud music may be; the director
    // decides how much of that the moment deserves (zone
    // crossfades dip it, the scar takes it to zero).
    musicBus = ctx.createGain();
    musicBus.connect(channelGains.get('music')!);

    // A shared two seconds of white noise — breath, wind, and
    // the click inside a knock are all carved from this.
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    applySettings(loadAudioSettings());
    return ctx;
  } catch {
    return null;
  }
}

export function audioCtx(): AudioContext | null {
  return ctx;
}

export function resumeAudio(): void {
  if (ctx && ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
}

export function suspendAudio(): void {
  if (ctx && ctx.state === 'running') void ctx.suspend().catch(() => undefined);
}

// ---------------------------------------------------------------------------
// The SOUND shelf, applied
// ---------------------------------------------------------------------------

/** Fold a settings snapshot into the graph. Sliders are read
 *  as gains exactly as the shelf defines them (effectiveGain:
 *  channel × master, switch = hard zero). Short ramps keep a
 *  slider drag from zippering. */
export function applySettings(settings: AudioSettingsState): void {
  if (!ctx || !masterGain) return;
  const t = ctx.currentTime;
  // The shelf's own shape: each channel is { on, level }; Master
  // sits on its own node and everything else folds through it
  // by graph construction (the same fold effectiveGain computes
  // arithmetically for one-shot readers).
  const master = settings.master;
  masterGain.gain.setTargetAtTime(master && master.on ? master.level : 0, t, 0.08);
  for (const [id, node] of channelGains) {
    const ch = settings[id];
    node.gain.setTargetAtTime(ch && ch.on ? ch.level : 0, t, 0.08);
  }
}

/** The director's fader: 1 = the shelf's music level, 0 = the
 *  designed silence. Ramps over `seconds` — a crossfade, never
 *  a switch (the map's law: travel sounds like weather). */
export function fadeMusicBus(to: number, seconds: number): void {
  if (!ctx || !musicBus) return;
  musicBus.gain.setTargetAtTime(
    Math.max(0, Math.min(1, to)),
    ctx.currentTime,
    Math.max(0.05, seconds / 3),
  );
}

// ---------------------------------------------------------------------------
// The six voices (named once, in the tunes map)
// ---------------------------------------------------------------------------

export type SynthVoice = 'reed' | 'glass' | 'thrum' | 'pluck' | 'knock' | 'breath';

export interface ToneOpts {
  /** 'music' routes through the director's fader; everything
   *  else goes straight to its shelf channel. */
  bus: 'music' | AudioChannelId;
  voice: SynthVoice;
  /** Hertz. For breath: the band-pass center. */
  freq: number;
  /** Absolute ctx time to start. */
  at: number;
  /** Envelope length, seconds. */
  dur: number;
  /** Linear gain at the envelope's peak (small: 0.03–0.25). */
  gain: number;
  /** Cents sharp/flat — the individual's detune lives here. */
  detune?: number;
  /** Stereo position, −1 (left) … 1 (right). */
  pan?: number;
  /** 0 = far/muffled, 1 = near/bright: sets the low-pass. */
  bright?: number;
  /** Glide the pitch to this frequency across the tone (the
   *  death descent, a knock's woody drop). */
  glideTo?: number;
  /** Filter emphasis for reed (ember's rougher reed reads a
   *  higher cutoff, fungal's muffled one a lower). */
  cutoffMul?: number;
}

function destinationFor(bus: ToneOpts['bus']): AudioNode | null {
  if (!ctx) return null;
  if (bus === 'music') return musicBus;
  return channelGains.get(bus) ?? null;
}

/**
 * Schedule ONE tone — the only sound-producing function in the
 * game. Fire and forget: callers compose by scheduling.
 *
 * Envelope character per voice (the map's definitions):
 *   reed  — sawtooth through a low-pass, slow swell: grown wind.
 *   glass — sine + an inharmonic partial, long ring: bells that
 *           aren't bells.
 *   thrum — low triangle pulse: the ground's heartbeat.
 *   pluck — short triangle, fast decay: fingers on gut string.
 *   knock — pitch-dropping sine + a breath of click: wood time.
 *   breath— filtered noise swell: wind and water's cousin.
 */
export function scheduleTone(o: ToneOpts): void {
  if (!ctx) return;
  const dest = destinationFor(o.bus);
  if (!dest || o.gain <= 0) return;
  const t = Math.max(o.at, ctx.currentTime);
  const bright = o.bright ?? 1;
  const cutoff = (600 + bright * 8400) * (o.cutoffMul ?? 1);

  // Per-tone chain: sources → tone filter → envelope → pan → bus.
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = Math.max(120, cutoff);
  filter.Q.value = 0.4;
  const env = ctx.createGain();
  env.gain.value = 0;
  let head: AudioNode = filter;
  filter.connect(env);
  if (o.pan !== undefined && ctx.createStereoPanner) {
    const panner = ctx.createStereoPanner();
    panner.pan.value = Math.max(-1, Math.min(1, o.pan));
    env.connect(panner);
    panner.connect(dest);
  } else {
    env.connect(dest);
  }

  const startOsc = (
    type: OscillatorType,
    freq: number,
    gainScale: number,
    glideTo?: number,
  ): OscillatorNode => {
    const osc = ctx!.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, freq), t);
    if (o.detune) osc.detune.setValueAtTime(o.detune, t);
    if (glideTo !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, glideTo), t + o.dur);
    }
    const g = ctx!.createGain();
    g.gain.value = gainScale;
    osc.connect(g);
    g.connect(head);
    osc.start(t);
    osc.stop(t + o.dur + 0.1);
    return osc;
  };

  const peak = o.gain;
  const end = t + o.dur;
  switch (o.voice) {
    case 'reed': {
      startOsc('sawtooth', o.freq, 1, o.glideTo);
      const a = Math.min(1.4, o.dur * 0.35);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + a);
      env.gain.setValueAtTime(peak, Math.max(t + a, end - a));
      env.gain.linearRampToValueAtTime(0, end);
      break;
    }
    case 'glass': {
      startOsc('sine', o.freq, 1, o.glideTo);
      startOsc('sine', o.freq * 2.756, 0.32); // the not-a-bell partial
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.006);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      break;
    }
    case 'thrum': {
      filter.frequency.value = Math.min(filter.frequency.value, 340);
      startOsc('triangle', o.freq, 1, o.glideTo);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.02);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      break;
    }
    case 'pluck': {
      startOsc('triangle', o.freq, 1, o.glideTo);
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      break;
    }
    case 'knock': {
      startOsc('sine', o.freq, 1, o.glideTo ?? o.freq * 0.55);
      // A breath of click at the head — wood is partly noise.
      if (noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 1800;
        const ng = ctx.createGain();
        ng.gain.value = 0.4;
        src.connect(hp);
        hp.connect(ng);
        ng.connect(head);
        src.start(t, Math.random() * 1.2);
        src.stop(t + 0.03);
      }
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + 0.003);
      env.gain.exponentialRampToValueAtTime(0.0001, end);
      break;
    }
    case 'breath': {
      if (!noiseBuffer) return;
      filter.type = 'bandpass';
      filter.frequency.value = Math.max(80, o.freq);
      filter.Q.value = 0.7;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer;
      src.loop = true;
      src.connect(head);
      src.start(t, Math.random() * 1.5);
      src.stop(end + 0.1);
      const a = o.dur * 0.45;
      env.gain.setValueAtTime(0, t);
      env.gain.linearRampToValueAtTime(peak, t + a);
      env.gain.linearRampToValueAtTime(0, end);
      break;
    }
  }
}

// ---------------------------------------------------------------------------
// Small shared helpers
// ---------------------------------------------------------------------------

/** MIDI note → hertz. The family table speaks in MIDI. */
export function midiHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

/** FNV-1a string hash → [0, 1). Audio keeps its own tiny hash
 *  rather than importing the world generator's: the music must
 *  never be coupled to how the world happens to seed itself. */
export function hash01(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** A small deterministic stream (mulberry32) for motif walks:
 *  the same seed sings the same family of phrases forever. */
export function rngStream(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seedFromText(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
