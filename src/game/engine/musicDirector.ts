/**
 * musicDirector.ts — the tunes map, running (Adam's build
 * order, 2026-10-18; map drafted by the HUD lane and pinned
 * with his clean go).
 *
 * The grammar, as written in the map:
 *   — Place seeds the motif: a zone's phrases derive from its
 *     family + coordinates, the same on every visit, in every
 *     world that grows it. You can learn a place by ear.
 *   — Two slow layers: a pad of long tones, and a motif line
 *     that phrases and rests. (The map's third layer — a low
 *     root drone under everything — was RETIRED by Adam's ear
 *     verdict on day one: 'get rid of the hum; the background
 *     music is OK.' The constant tone went; the music stayed.)
 *     Density
 *     follows the country's lushness (the hook passes a flora
 *     count; the master curve is a FIRST PASS — the map holds
 *     it open for tuning by ear, deliberately).
 *   — Day and night are mixes, not tracks: night thins the
 *     motif, drops the register, warms the pad — everything
 *     crossfades, nothing switches.
 *   — Hybrid country blends: the primary carries scale and
 *     motif; the secondary lends ONE instrument, occasionally,
 *     at low weight. The other country is visiting.
 *   — Underground is a treatment: the pad falls away and the
 *     motif thins to single echoing notes, sparser with depth.
 *   — THE SCAR-COMPLEX IS SILENT BY DESIGN: near the scar the
 *     director stops scheduling and fades its own bus to
 *     zero. All channels of the tune. The silence is a place.
 *   — The hearth warms the motif: one soft note joins phrases
 *     near a kept hearth.
 *   — Sky leans per family: comets sign the meadow in glass,
 *     quicken the saltglass, ring the frost brighter, swell
 *     the living valley — and on comet nights the precursor
 *     figure plays WHOLE, once, unvaried: the only time that
 *     country remembers perfectly. Rootwood, fungal, and bone
 *     take no lean; the map says the sky cannot reach them.
 *
 * This module decides WHAT to sing and WHEN. synthCore owns
 * how anything sounds; useAudioEngine owns the world's facts.
 */

import type { BiomeId } from '../world/biomes';
import {
  audioCtx,
  fadeMusicBus,
  hash01,
  midiHz,
  rngStream,
  scheduleTone,
  seedFromText,
  type SynthVoice,
} from './synthCore';

// ---------------------------------------------------------------------------
// What the world tells the director (assembled by the hook)
// ---------------------------------------------------------------------------

export interface MusicContext {
  biome: BiomeId;
  /** Hybrid visitor family, when the zone is a named hybrid. */
  secondary: BiomeId | null;
  worldSeed: string;
  zx: number;
  zz: number;
  /** 0 = full day, 1 = full night (crossfade factor). */
  night: number;
  /** Sky day index — per-night latches key off it. */
  dayIndex: number;
  comet: boolean;
  shower: boolean;
  /** Cavern stratum; 0 on the surface and in ruin interiors. */
  depth: number;
  inRuin: boolean;
  /** Inside the scar's silence. */
  scar: boolean;
  /** 0..1 — kept-hearth warmth by proximity. */
  hearth: number;
  /** Density factor from the country's flora (first-pass). */
  lush: number;
}

// ---------------------------------------------------------------------------
// The families — the map, as a table
// ---------------------------------------------------------------------------

type CometLean = 'glass' | 'quicken' | 'figure' | 'bright' | 'swell' | 'breath' | 'none';

interface FamilySpec {
  root: number; // MIDI
  scale: number[];
  motif: SynthVoice;
  pad: SynthVoice;
  /** Motif phrases per minute at lush 1, full day. */
  phrases: number;
  /** Density multiplier at full night. */
  nightThin: number;
  /** Register shift (semitones) at full night. */
  nightDrop: number;
  spacingMul: number;
  noteDur: number;
  comet: CometLean;
  cutoffMul?: number;
  /** Wetland: every motif note casts a reflection. */
  echo?: boolean;
  /** Fungal: the pad is two reeds detuned against each other. */
  detunedPad?: boolean;
  /** Ember: glass visits the motif rarely. */
  glassVisits?: boolean;
  /** Bone: phrases are a two-note sigh, nothing more. */
  sigh?: boolean;
  /** Bone: some nights the sigh never comes. */
  absentNights?: boolean;
  /** Storm: phrases ride a soft pulse beat (re-homed here
   *  when the drone retired — a beat under phrases, never a
   *  constant bed); the sky breaking ducks the whole tune. */
  pulse?: boolean;
}

const MAJ_PENT = [0, 2, 4, 7, 9];
const MIN_PENT = [0, 3, 5, 7, 10];
const DORIAN_MOTIF = [0, 2, 3, 7, 9];
const LYD_PENT = [0, 2, 4, 6, 9];
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MIXO = [0, 2, 4, 5, 7, 9, 10];

const FAMILIES: Record<BiomeId, FamilySpec> = {
  // Meadow — the home key. D major pentatonic; the tune every
  // other country modulates away from.
  meadow: {
    root: 50, scale: MAJ_PENT, motif: 'pluck', pad: 'reed',
    phrases: 2.1, nightThin: 0.45, nightDrop: -2, spacingMul: 1, noteDur: 1.6,
    comet: 'glass',
  },
  // Rootwood — the home root, woodier mode, sky shut out.
  rootwood: {
    root: 50, scale: DORIAN_MOTIF, motif: 'knock', pad: 'reed',
    phrases: 1.35, nightThin: 0.5, nightDrop: -3, spacingMul: 1.45, noteDur: 1.3,
    comet: 'none',
  },
  // Wetland — bright water; notes doubled as if reflected.
  wetland: {
    root: 53, scale: LYD_PENT, motif: 'pluck', pad: 'reed',
    phrases: 2.0, nightThin: 0.8, nightDrop: -2, spacingMul: 0.9, noteDur: 1.4,
    comet: 'breath', echo: true,
  },
  // Fungal — the dark hollow; barely changes at night.
  fungal: {
    root: 48, scale: MIN_PENT, motif: 'knock', pad: 'reed',
    phrases: 1.6, nightThin: 0.92, nightDrop: 0, spacingMul: 0.9, noteDur: 0.9,
    comet: 'none', detunedPad: true, cutoffMul: 0.6,
  },
  // Ember — warm ruin country; a tune half-remembered.
  ember: {
    root: 45, scale: MIN_PENT, motif: 'reed', pad: 'reed',
    phrases: 1.2, nightThin: 0.6, nightDrop: -2, spacingMul: 1.2, noteDur: 2.2,
    comet: 'none', cutoffMul: 1.5, glassVisits: true,
  },
  // Saltglass — the sparsest country; the quiet end's showcase.
  saltglass: {
    root: 51, scale: MAJ_PENT, motif: 'glass', pad: 'breath',
    phrases: 0.55, nightThin: 0.5, nightDrop: -12, spacingMul: 1.6, noteDur: 3.4,
    comet: 'quicken',
  },
  // Frost — bright and very slow; the wind is the pad.
  frost: {
    root: 59, scale: [0, 3, 7, 10], motif: 'glass', pad: 'breath',
    phrases: 0.9, nightThin: 1.1, nightDrop: 0, spacingMul: 1.5, noteDur: 2.8,
    comet: 'bright',
  },
  // Precursor — the authored exception (see the figure below).
  precursor: {
    root: 55, scale: MIXO, motif: 'glass', pad: 'reed',
    phrases: 0.8, nightThin: 0.8, nightDrop: 0, spacingMul: 1.1, noteDur: 2.0,
    comet: 'figure',
  },
  // Bone — the home root with the light out of it.
  bone: {
    root: 50, scale: MINOR, motif: 'reed', pad: 'reed',
    phrases: 0.7, nightThin: 0.5, nightDrop: -2, spacingMul: 1.8, noteDur: 2.6,
    comet: 'none', sigh: true, absentNights: true, cutoffMul: 0.7,
  },
  // Storm — charged country; phrases ride a slow pulse.
  storm: {
    root: 52, scale: MINOR, motif: 'reed', pad: 'thrum',
    phrases: 1.5, nightThin: 1.1, nightDrop: 0, spacingMul: 1, noteDur: 1.5,
    comet: 'none', cutoffMul: 1.6, pulse: true,
  },
  // Living — one organism; handled by the breathing line, not
  // phrases. The spec row exists for its root and voices.
  living: {
    root: 48, scale: [0], motif: 'reed', pad: 'reed',
    phrases: 0, nightThin: 1, nightDrop: 0, spacingMul: 1, noteDur: 8,
    comet: 'swell',
  },
};

/** THE FIGURE (precursor): eight composed notes, scale degrees
 *  and relative lengths. Every other family GROWS its motif;
 *  this one was WRITTEN — by them. Small seeded variations bend
 *  it night to night; a comet night plays it whole, unvaried. */
const FIGURE_DEGREES = [0, 2, 4, 3, 5, 4, 2, 1];
const FIGURE_BEATS = [1, 1, 2, 1, 1, 2, 3, 4];

// ---------------------------------------------------------------------------
// The director
// ---------------------------------------------------------------------------

const LOOKAHEAD = 0.8; // schedule this far ahead of the clock
// First-pass levels were a WHISPER at real speakers (field
// report, day one: 'day 3, noon, unmuted — and nothing'): the
// peaks below are the ear-tuned second pass — motif and glass
// roughly doubled, pads likewise. (The drone named here was
// retired the same day — see the header grammar note.)
// The quiet end stays honest: sparse families stay sparse in
// TIME (long rests), not in loudness (inaudible notes).
const G = { pad: 0.085, motif: 0.15, glass: 0.12, guest: 0.08, hearth: 0.07 };

export class MusicDirector {
  private mc: MusicContext | null = null;
  private zoneKey = '';
  private rng: () => number = rngStream(1);
  private degreeIdx = 0;
  private nextPad = 0;
  private nextPhrase = 0;
  private nextBreath = 0;
  /** Bus posture: 'open' | 'scar' (0) | 'duck' (storm under a
   *  breaking sky). Fades are issued only on CHANGES. */
  private posture: 'open' | 'scar' | 'duck' = 'open';
  private figureNight = -1; // last dayIndex the whole figure played
  private swellNight = -1;
  private zoneFadeUntil = 0;

  setContext(mc: MusicContext): void {
    const key = `${mc.worldSeed}:${mc.zx},${mc.zz}:${mc.depth}:${mc.inRuin ? 'ruin' : 'surf'}`;
    if (key !== this.zoneKey) {
      // A new place: reseed the walk from the place itself and
      // dip the bus — travel sounds like weather moving.
      this.zoneKey = key;
      this.rng = rngStream(seedFromText(`tunes:${key}`));
      this.degreeIdx = Math.floor(this.rng() * 3);
      const now = audioCtx()?.currentTime ?? 0;
      this.zoneFadeUntil = now + 2.4;
      if (this.posture === 'open') fadeMusicBus(0.15, 0.7);
      this.nextPhrase = Math.min(this.nextPhrase, now + 0.4);
    }
    this.mc = mc;
  }

  /** Called by the hook a few times a second. Schedules
   *  everything due within the lookahead window. */
  update(): void {
    const ac = audioCtx();
    if (!ac || !this.mc) return;
    const now = ac.currentTime;
    const mc = this.mc;
    const spec = FAMILIES[mc.biome];

    // ── Posture: the scar stops the tune; the storm duck ──
    const want: typeof this.posture = mc.scar
      ? 'scar'
      : mc.shower && spec.pulse
        ? 'duck'
        : 'open';
    if (want !== this.posture) {
      this.posture = want;
      fadeMusicBus(want === 'scar' ? 0 : want === 'duck' ? 0.35 : 1, want === 'open' ? 2.8 : 1.4);
    }
    if (this.posture === 'scar') return; // silence is a place: schedule nothing
    if (this.posture === 'open' && now > this.zoneFadeUntil && this.zoneKey) {
      // (Zone dips restore through the same ramp discipline:
      // the fade back is issued once, when the dip expires.)
      if (this.zoneFadeUntil > 0) {
        fadeMusicBus(1, 2.4);
        this.zoneFadeUntil = 0;
      }
    }

    const horizon = now + LOOKAHEAD;
    if (mc.biome === 'living') {
      this.updateBreathing(now, horizon, mc, spec);
      return;
    }
    if (this.nextPad === 0) {
      this.nextPad = now + 1.2;
      this.nextPhrase = now + 2.0;
    }
    while (this.nextPad < horizon) this.schedulePad(mc, spec);
    while (this.nextPhrase < horizon) this.schedulePhrase(mc, spec);
  }

  // ── Layer: the pad ────────────────────────────────────────
  private schedulePad(mc: MusicContext, spec: FamilySpec): void {
    const at = this.nextPad;
    if (mc.depth === 0) {
      // Underground the pad FALLS AWAY (the map's treatment) —
      // skipped entirely, only the interval advances.
      const night = mc.night;
      const drop = spec.nightDrop * night + (mc.biome === 'wetland' ? -12 * night : 0);
      const tones = [0, 2, 4]; // scale degrees: third, fifth, ninth-ish
      const count = 2 + (this.rng() < 0.5 ? 1 : 0);
      for (let i = 0; i < count; i++) {
        const deg = spec.scale[tones[i] % spec.scale.length];
        const freq = midiHz(spec.root + 12 + deg + drop);
        const gain = G.pad * (mc.biome === 'frost' ? 1 + night * 0.5 : 1);
        scheduleTone({
          bus: 'music', voice: spec.pad, freq, at: at + i * 0.7,
          dur: 16 + this.rng() * 6, gain, bright: 0.4, cutoffMul: spec.cutoffMul,
        });
        if (spec.detunedPad) {
          // Fungal: a second reed, cents off the first — the
          // hollow's air is thick. The detune widens at night.
          scheduleTone({
            bus: 'music', voice: spec.pad, freq, at: at + i * 0.7,
            dur: 15, gain: gain * 0.7, bright: 0.35,
            detune: Math.round(6 + night * 7), cutoffMul: spec.cutoffMul,
          });
        }
      }
      // Wetland under a bright sky breathes: the marsh exhales.
      if (mc.biome === 'wetland' && (mc.comet || mc.shower) && mc.night > 0.3) {
        scheduleTone({
          bus: 'music', voice: 'breath', freq: 300, at, dur: 12,
          gain: 0.09, bright: 0.5,
        });
      }
    }
    this.nextPad = at + 17 + this.rng() * 9;
  }

  // ── Layer: the motif ──────────────────────────────────────
  private schedulePhrase(mc: MusicContext, spec: FamilySpec): void {
    const at = this.nextPhrase;
    const night = mc.night;
    const rng = this.rng;

    // Bone's absent nights: the seed decides, and some nights
    // the sigh simply doesn't come. Absence is in the grammar.
    const boneAbsent =
      spec.absentNights && night > 0.4 &&
      hash01(`bone-night:${mc.worldSeed}:${mc.zx},${mc.zz}:${mc.dayIndex}`) < 0.35;

    // Precursor on a comet night: the figure plays WHOLE, once.
    const wholeFigure =
      spec.comet === 'figure' && mc.comet && night > 0.35 && this.figureNight !== mc.dayIndex;

    let density = spec.phrases * mc.lush;
    density *= 1 - night * (1 - spec.nightThin);
    if (spec.comet === 'quicken' && mc.comet) density *= 2.2; // saltglass's festival
    if (mc.depth > 0) density /= 1 + mc.depth;
    if (mc.inRuin) density *= 0.6;
    const gap = density > 0 ? (60 / density) * (0.7 + rng() * 0.6) : 30;

    if (!boneAbsent) {
      if (spec.pulse) {
        // Storm's pulse, re-homed: two soft beats under the
        // phrase — the held breath made audible at the
        // phrase's feet, then gone. Not a bed; a heartbeat
        // the phrase borrows.
        scheduleTone({ bus: 'music', voice: 'thrum', freq: midiHz(spec.root - 12), at, dur: 1.1, gain: 0.055, bright: 0.2 });
        scheduleTone({ bus: 'music', voice: 'thrum', freq: midiHz(spec.root - 12), at: at + 1.6, dur: 1.1, gain: 0.04, bright: 0.2 });
      }
      if (mc.biome === 'precursor') this.scheduleFigure(mc, spec, at, wholeFigure);
      else if (spec.sigh) this.scheduleSigh(mc, spec, at);
      else this.scheduleWalk(mc, spec, at);
    }
    if (wholeFigure) this.figureNight = mc.dayIndex;
    this.nextPhrase = at + gap;
  }

  /** The ordinary motif: a seeded walk across the scale. */
  private scheduleWalk(mc: MusicContext, spec: FamilySpec, at: number): void {
    const rng = this.rng;
    const night = mc.night;
    const drop = spec.nightDrop * night;
    // Meadow at night: the pluck rests and the reed carries.
    const voice: SynthVoice =
      mc.biome === 'meadow' && night > 0.55 ? 'reed' : spec.motif;
    const baseGain = voice === 'glass' ? G.glass : G.motif;
    const len = mc.depth > 0 ? 1 + (rng() < 0.4 ? 1 : 0) : 2 + Math.floor(rng() * 4);
    const spacing = (0.9 + rng() * 1.1) * spec.spacingMul * (mc.depth > 0 ? 1.6 : 1);
    let t = at;
    for (let i = 0; i < len; i++) {
      const step = [-2, -1, -1, 0, 1, 1, 2][Math.floor(rng() * 7)];
      this.degreeIdx = Math.max(0, Math.min(spec.scale.length * 2 - 1, this.degreeIdx + step));
      const octave = this.degreeIdx >= spec.scale.length ? 12 : 0;
      const deg = spec.scale[this.degreeIdx % spec.scale.length];
      let noteVoice = voice;
      if (spec.glassVisits && rng() < 0.1) noteVoice = 'glass';
      const freq = midiHz(spec.root + 12 + deg + octave + drop);
      const cometHigh = spec.comet === 'bright' && mc.comet ? 12 : 0;
      scheduleTone({
        bus: 'music', voice: noteVoice, freq: midiHz(spec.root + 12 + deg + octave + drop + cometHigh),
        at: t, dur: spec.noteDur, gain: baseGain, bright: 0.6, cutoffMul: spec.cutoffMul,
      });
      if (spec.echo) {
        // Wetland: the note casts its reflection.
        scheduleTone({
          bus: 'music', voice: noteVoice, freq, at: t + 0.32, dur: spec.noteDur * 0.8,
          gain: baseGain * 0.38, bright: 0.5, cutoffMul: spec.cutoffMul,
        });
      }
      if (mc.depth > 0) {
        // Underground echoes: single notes, long tails of air.
        scheduleTone({
          bus: 'music', voice: noteVoice, freq, at: t + 0.75, dur: spec.noteDur,
          gain: baseGain * 0.3, bright: 0.35,
        });
      }
      t += spacing * (0.7 + rng() * 0.7);
    }
    // Meadow's sky lean: one high glass note signs the phrase.
    if (spec.comet === 'glass' && mc.comet && night > 0.3) {
      scheduleTone({
        bus: 'music', voice: 'glass', freq: midiHz(spec.root + 36),
        at: t + 0.4, dur: 2.6, gain: G.glass * 0.8, bright: 0.9,
      });
    }
    this.phraseTail(mc, spec, t);
  }

  /** Bone: two notes, long air. One, at deep night. */
  private scheduleSigh(mc: MusicContext, spec: FamilySpec, at: number): void {
    const drop = spec.nightDrop * mc.night;
    scheduleTone({
      bus: 'music', voice: 'reed', freq: midiHz(spec.root + drop),
      at, dur: 3.2, gain: G.motif * 0.8, bright: 0.35, cutoffMul: spec.cutoffMul,
    });
    if (mc.night < 0.75) {
      scheduleTone({
        bus: 'music', voice: 'reed', freq: midiHz(spec.root - 2 + drop),
        at: at + 3.8, dur: 3.6, gain: G.motif * 0.7, bright: 0.3, cutoffMul: spec.cutoffMul,
      });
    }
    this.phraseTail(mc, spec, at + 4);
  }

  /** Precursor: THE FIGURE — two detuned voices almost
   *  agreeing. Variations bend a degree or two; the comet
   *  night's playing is whole and exact. */
  private scheduleFigure(mc: MusicContext, spec: FamilySpec, at: number, whole: boolean): void {
    const rng = this.rng;
    const tempo = 1.05 * (1 + mc.night * 0.3); // memory tired, in the dark
    const detune = Math.round(6 + mc.night * 7); // …and wider apart
    let t = at;
    FIGURE_DEGREES.forEach((degIdx, i) => {
      let d = degIdx;
      if (!whole && i > 0 && i < 7 && rng() < 0.22) d = Math.max(0, Math.min(MIXO.length - 1, d + (rng() < 0.5 ? -1 : 1)));
      const freq = midiHz(spec.root + 12 + MIXO[d]);
      scheduleTone({ bus: 'music', voice: 'glass', freq, at: t, dur: 2.1, gain: G.glass, bright: 0.7, detune: -detune });
      scheduleTone({ bus: 'music', voice: 'reed', freq, at: t, dur: 2.1, gain: G.motif * 0.55, bright: 0.55, detune });
      t += FIGURE_BEATS[i] * tempo * 0.55;
    });
    this.phraseTail(mc, spec, t);
  }

  /** What any phrase may end with: the hybrid's visiting
   *  instrument, and the hearth's warm note. */
  private phraseTail(mc: MusicContext, spec: FamilySpec, t: number): void {
    if (mc.secondary && this.rng() < 0.22) {
      const guest = FAMILIES[mc.secondary];
      const deg = spec.scale[Math.floor(this.rng() * spec.scale.length)];
      scheduleTone({
        bus: 'music', voice: guest.motif, freq: midiHz(spec.root + 12 + deg),
        at: t + 0.5, dur: guest.noteDur, gain: G.guest, bright: 0.55,
      });
    }
    if (mc.hearth > 0) {
      const deg = spec.scale[2 % spec.scale.length];
      scheduleTone({
        bus: 'music', voice: spec.pad, freq: midiHz(spec.root + 12 + deg),
        at: t + 1.1, dur: 3.2, gain: G.hearth * mc.hearth, bright: 0.5,
      });
    }
  }

  // ── Living: the breathing line (no phrases, ever) ─────────
  private updateBreathing(now: number, horizon: number, mc: MusicContext, spec: FamilySpec): void {
    if (this.nextBreath === 0) this.nextBreath = now + 0.3;
    while (this.nextBreath < horizon) {
      const at = this.nextBreath;
      const night = mc.night;
      const third = night > 0.5 ? 3 : 4; // the cluster warms toward minor
      const swell =
        spec.comet === 'swell' && mc.comet && night > 0.35 && this.swellNight !== mc.dayIndex;
      const gainMul = swell ? 1.6 : 1;
      for (const deg of [0, 7, third]) {
        scheduleTone({
          bus: 'music', voice: 'reed', freq: midiHz(spec.root + 12 + deg),
          at, dur: 13, gain: 0.085 * gainMul, bright: 0.4,
        });
      }
      scheduleTone({
        bus: 'music', voice: 'breath', freq: 240, at: at + 2, dur: 9,
        gain: 0.05 * gainMul, bright: 0.4,
      });
      if (swell) this.swellNight = mc.dayIndex;
      // Minutes per breath; slower at night. (Second pass:
      // the first pass's breaths stood so far apart that the
      // valley could read as silent — closer together now.)
      this.nextBreath = at + 18 + night * 8;
    }
  }
}


// ---------------------------------------------------------------------------
// The live readout — the Options SOUND section (and any future
// kit surface) asks the standing director how the music is.
// A silent world should be able to say why: wrong posture
// (the scar), a sparse family resting, or a dead context are
// three different silences with three different fixes.
// ---------------------------------------------------------------------------

let activeDirector: MusicDirector | null = null;
export function setActiveDirector(d: MusicDirector | null): void {
  activeDirector = d;
}

export interface DirectorDebug {
  family: string;
  secondary: string | null;
  posture: string;
  zone: string;
  nextPhraseInSec: number | null;
  night: number;
}

export function directorDebug(): DirectorDebug | null {
  const d = activeDirector;
  if (!d) return null;
  const mc = (d as unknown as { mc: MusicContext | null }).mc;
  if (!mc) return null;
  const now = audioCtx()?.currentTime ?? 0;
  const next = (d as unknown as { nextPhrase: number }).nextPhrase;
  return {
    family: mc.biome,
    secondary: mc.secondary,
    posture: (d as unknown as { posture: string }).posture,
    zone: `${mc.zx},${mc.zz}`,
    nextPhraseInSec: next > 0 ? Math.max(0, Math.round(next - now)) : null,
    night: Math.round(mc.night * 100) / 100,
  };
}
